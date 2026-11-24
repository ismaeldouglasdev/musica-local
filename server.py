#!/usr/bin/env python3
"""Musica Local - busca e toca audio do YouTube sem o peso do site completo.

Servidor minimo (somente biblioteca padrao do Python) + yt-dlp para buscar e
baixar o audio. A interface fica em static/ e usa HTML5 <audio>.

Uso:
    python3 server.py [--host 127.0.0.1] [--port 8090]
"""

import argparse
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
CACHE_DIR = os.path.expanduser(os.environ.get("MUSICA_CACHE_DIR", "~/.cache/musica-local"))
DOWNLOAD_DIR = os.path.expanduser(os.environ.get("MUSICA_DOWNLOAD_DIR", "~/Downloads"))
PLAYLIST_DIR = os.path.join(CACHE_DIR, "playlists")
AUDIO_DIR = os.path.join(CACHE_DIR, "audio")
YTDLP = os.environ.get("MUSICA_YTDLP", os.path.expanduser("~/.local/bin/yt-dlp"))
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8090

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
AUDIO_EXTS = (".webm", ".m4a", ".mp4", ".opus", ".ogg", ".mp3")
SEARCH_TTL_SECONDS = 600
CACHE_LIMIT_BYTES = int(os.environ.get("MUSICA_CACHE_LIMIT_MB", "2048")) * 1024 * 1024
RECOMMEND_TTL_SECONDS = 1800
MAX_PLAYLIST_ITEMS = 200
YOUTUBE_HOSTS = (
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
)

MIME_TYPES = {
    ".webm": "audio/webm",
    ".weba": "audio/webm",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".opus": "audio/ogg",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
}

_search_cache = {}
_search_cache_guard = threading.Lock()
_recommend_cache = {}
_recommend_guard = threading.Lock()
_video_locks = {}
_video_locks_guard = threading.Lock()


class YtError(Exception):
    """Erro amigavel para mostrar na interface."""

    def __init__(self, message, detail=""):
        super().__init__(message)
        self.message = message
        self.detail = detail


def ensure_dirs():
    os.makedirs(AUDIO_DIR, exist_ok=True)


def lock_for(video_id):
    with _video_locks_guard:
        if video_id not in _video_locks:
            _video_locks[video_id] = threading.Lock()
        return _video_locks[video_id]


def run_ytdlp(args, timeout=120):
    cmd = [YTDLP, "--ignore-config", "--no-warnings", "--no-progress"] + list(args)
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError:
        raise YtError("O programa de download nao foi encontrado.", YTDLP)
    except subprocess.TimeoutExpired:
        raise YtError("O YouTube demorou demais para responder. Tente de novo.")

    if proc.returncode != 0:
        lines = (proc.stderr or "").strip().splitlines()
        detail = lines[-1] if lines else ""
        low = detail.lower()
        if any(token in low for token in ("sign in", "not a bot", "confirm you", "403", "forbidden")):
            raise YtError(
                "O YouTube recusou o pedido agora. Tente de novo em alguns minutos.",
                detail,
            )
        raise YtError("Nao foi possivel acessar o YouTube.", detail)
    return proc.stdout


def parse_json_output(output):
    text = (output or "").strip()
    if not text:
        raise YtError("O YouTube nao devolveu resultados.")
    start = text.find("{")
    if start > 0:
        text = text[start:]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise YtError("Resposta inesperada do YouTube.")


def is_youtube_url(value):
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    return host in YOUTUBE_HOSTS


def normalize_entry(entry):
    video_id = entry.get("id")
    if not video_id or not VIDEO_ID_RE.match(video_id):
        return None
    duration = entry.get("duration")
    try:
        duration = int(duration) if duration is not None else None
    except (TypeError, ValueError):
        duration = None
    channel = entry.get("channel") or entry.get("uploader") or entry.get("uploader_id") or ""
    return {
        "id": video_id,
        "title": entry.get("title") or "(sem titulo)",
        "channel": channel,
        "duration": duration,
        "thumb": "https://i.ytimg.com/vi/%s/mqdefault.jpg" % video_id,
        "url": "https://www.youtube.com/watch?v=%s" % video_id,
    }


def search(query, limit=24):
    limit = max(1, min(int(limit), 40))
    key = (query.strip().lower(), limit)
    now = time.time()
    with _search_cache_guard:
        cached = _search_cache.get(key)
        if cached and now - cached[0] < SEARCH_TTL_SECONDS:
            return cached[1]

    output = run_ytdlp(
        ["--flat-playlist", "--dump-single-json", "ytsearch%d:%s" % (limit, query)],
        timeout=75,
    )
    data = parse_json_output(output)
    items = []
    for entry in data.get("entries") or []:
        item = normalize_entry(entry)
        if item:
            items.append(item)
    with _search_cache_guard:
        _search_cache[key] = (now, items)
    return items


def mix_items(video_id, limit):
    """Mix automatico do YouTube (RD<id>) baseado numa musica ja ouvida."""
    url = "https://www.youtube.com/watch?v=%s&list=RD%s" % (video_id, video_id)
    output = run_ytdlp(
        ["--flat-playlist", "--dump-single-json", "--playlist-items", "1-%d" % limit, url],
        timeout=150,
    )
    data = parse_json_output(output)
    items = []
    for entry in data.get("entries") or []:
        item = normalize_entry(entry)
        if item:
            items.append(item)
    return items


def recommend(seed_ids, query="", fresh=False, use_cache=False):
    """Recomendacoes estilo algoritmo: mix do YouTube das ultimas ouvidas."""
    seeds = []
    for seed in seed_ids:
        seed = (seed or "").strip()
        if VIDEO_ID_RE.match(seed) and seed not in seeds:
            seeds.append(seed)
        if len(seeds) >= 8:
            break
    if use_cache:
        for cached in cache_items()[:12]:
            cid = cached.get("id")
            if cid and cid not in seeds:
                seeds.append(cid)
            if len(seeds) >= 8:
                break
    term = (query or "").strip()[:100]
    if not seeds and not term:
        return []

    key = (tuple(seeds), term.lower())
    now = time.time()
    if not fresh:
        with _recommend_guard:
            cached = _recommend_cache.get(key)
            if cached and now - cached[0] < RECOMMEND_TTL_SECONDS:
                return cached[1]

    items = []
    seen = set(seeds)

    for video_id in seeds[:4]:
        try:
            candidates = mix_items(video_id, 20)
        except YtError:
            continue
        for item in candidates:
            if item["id"] not in seen:
                seen.add(item["id"])
                items.append(item)
        if len(items) >= 16:
            break

    if len(items) < 8 and term:
        try:
            output = run_ytdlp(
                ["--flat-playlist", "--dump-single-json", "ytsearch12:%s" % term],
                timeout=75,
            )
            data = parse_json_output(output)
            for entry in data.get("entries") or []:
                item = normalize_entry(entry)
                if item and item["id"] not in seen:
                    seen.add(item["id"])
                    items.append(item)
        except YtError:
            pass

    items = items[:24]
    if items:
        with _recommend_guard:
            _recommend_cache[key] = (now, items)
    return items


def resolve(url):
    if not is_youtube_url(url):
        raise YtError("Cole um link do YouTube valido.")
    parsed = urlparse(url)
    is_playlist = "list=" in (parsed.query or "")
    args = ["--dump-single-json"]
    if not is_playlist:
        args.append("--no-playlist")
    args.append(url)
    data = parse_json_output(run_ytdlp(args, timeout=90))

    if data.get("_type") == "playlist" or data.get("entries"):
        items = []
        for entry in (data.get("entries") or [])[:MAX_PLAYLIST_ITEMS]:
            item = normalize_entry(entry)
            if item:
                items.append(item)
        if not items:
            raise YtError("Essa playlist nao tem musicas disponiveis.")
        return {
            "type": "playlist",
            "title": data.get("title") or "Playlist",
            "items": items,
        }

    item = normalize_entry(data)
    if not item:
        raise YtError("Video nao encontrado.")
    return {"type": "video", "title": item["title"], "items": [item]}


def find_audio(video_id):
    for ext in AUDIO_EXTS:
        path = os.path.join(AUDIO_DIR, video_id + ext)
        if os.path.isfile(path) and os.path.getsize(path) > 1024:
            return path
    return None


def meta_path(video_id):
    return os.path.join(AUDIO_DIR, video_id + ".json")


def read_meta(video_id):
    path = meta_path(video_id)
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def write_meta(video_id, meta):
    if not VIDEO_ID_RE.match(video_id or "") or not isinstance(meta, dict):
        return
    clean = {"id": video_id}
    for key in ("title", "channel", "thumb"):
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            clean[key] = value.strip()[:500]
    duration = meta.get("duration")
    if isinstance(duration, (int, float)) and duration > 0:
        clean["duration"] = int(duration)
    if len(clean) == 1:
        return
    path = meta_path(video_id)
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump(clean, handle, ensure_ascii=False)
        os.replace(tmp, path)
    except OSError:
        try:
            os.remove(tmp)
        except OSError:
            pass


def meta_from_query(query):
    def first(name):
        values = query.get(name) or []
        return values[0] if values else ""

    meta = {
        "title": first("title"),
        "channel": first("channel"),
        "thumb": first("thumb"),
    }
    duration = first("duration")
    if duration:
        try:
            meta["duration"] = float(duration)
        except ValueError:
            pass
    return {key: value for key, value in meta.items() if value not in ("", None)}


def fetch_oembed(video_id):
    url = "https://www.youtube.com/oembed?" + urlencode(
        {"url": "https://www.youtube.com/watch?v=" + video_id, "format": "json"}
    )
    request = urllib.request.Request(url, headers={"User-Agent": "MusicaLocal/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=4) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    return {
        "title": data.get("title") or "",
        "channel": data.get("author_name") or "",
        "thumb": data.get("thumbnail_url") or "",
    }


def backfill_cache_meta():
    """Preenche titulos das musicas antigas que ainda nao tem sidecar."""
    if not os.path.isdir(AUDIO_DIR):
        return
    for name in os.listdir(AUDIO_DIR):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in AUDIO_EXTS or not VIDEO_ID_RE.match(stem):
            continue
        if os.path.isfile(meta_path(stem)):
            continue
        meta = fetch_oembed(stem)
        if meta:
            write_meta(stem, meta)


def cache_items():
    items = []
    seen = set()
    if not os.path.isdir(AUDIO_DIR):
        return items
    for name in os.listdir(AUDIO_DIR):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in AUDIO_EXTS or not VIDEO_ID_RE.match(stem):
            continue
        if stem in seen:
            continue
        path = os.path.join(AUDIO_DIR, name)
        try:
            size = os.path.getsize(path)
            mtime = os.path.getmtime(path)
        except OSError:
            continue
        if size <= 1024:
            continue
        seen.add(stem)
        meta = read_meta(stem)
        items.append(
            {
                "id": stem,
                "title": meta.get("title") or "Musica " + stem,
                "channel": meta.get("channel") or "YouTube",
                "duration": meta.get("duration"),
                "thumb": meta.get("thumb")
                or "https://i.ytimg.com/vi/%s/mqdefault.jpg" % stem,
                "size": size,
                "mtime": mtime,
            }
        )
    items.sort(key=lambda item: item.get("mtime") or 0, reverse=True)
    return items


def prepare(video_id, meta=None):
    if not VIDEO_ID_RE.match(video_id or ""):
        raise YtError("Musica invalida.")
    ensure_dirs()
    if meta:
        write_meta(video_id, meta)
    existing = find_audio(video_id)
    if existing:
        return existing

    with lock_for(video_id):
        existing = find_audio(video_id)
        if existing:
            if meta:
                write_meta(video_id, meta)
            return existing

        tmpdir = tempfile.mkdtemp(prefix="dl-", dir=AUDIO_DIR)
        try:
            output_template = os.path.join(tmpdir, "audio.%(ext)s")
            run_ytdlp(
                [
                    "-f",
                    "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best",
                    "--no-playlist",
                    "-o",
                    output_template,
                    "https://www.youtube.com/watch?v=%s" % video_id,
                ],
                timeout=240,
            )
            downloaded = [
                os.path.join(tmpdir, name)
                for name in os.listdir(tmpdir)
                if os.path.getsize(os.path.join(tmpdir, name)) > 1024
            ]
            if not downloaded:
                raise YtError("Nao foi possivel baixar o audio.")
            source = downloaded[0]
            ext = os.path.splitext(source)[1].lower()
            destination = os.path.join(AUDIO_DIR, video_id + ext)
            os.replace(source, destination)
            if meta:
                write_meta(video_id, meta)
            enforce_cache_limit(protect_id=video_id)
            return destination
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)


def playlist_protected_ids():
    """Ids de videos que estao em alguma playlist - nunca despejados do cache."""
    protected = set()
    if not os.path.isdir(PLAYLIST_DIR):
        return protected
    for name in os.listdir(PLAYLIST_DIR):
        if not name.endswith(".json"):
            continue
        try:
            with open(os.path.join(PLAYLIST_DIR, name), "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError):
            continue
        for item in data.get("items") or []:
            vid = item.get("id") if isinstance(item, dict) else None
            if vid:
                protected.add(vid)
    return protected


def remove_cached_video(video_id):
    freed = 0
    if os.path.isdir(AUDIO_DIR):
        for name in os.listdir(AUDIO_DIR):
            stem, _ext = os.path.splitext(name)
            if stem != video_id:
                continue
            path = os.path.join(AUDIO_DIR, name)
            try:
                freed += os.path.getsize(path)
                os.remove(path)
            except OSError:
                pass
    return freed


def enforce_cache_limit(protect_id=None):
    """Remove os audios mais antigos ate o cache voltar a caber no limite.

    Musicas que estao em playlists (e o protect_id) nunca sao removidas.
    Retorna quantos arquivos de audio foram despejados.
    """
    if CACHE_LIMIT_BYTES <= 0:
        return 0
    items = cache_items()
    total = sum(item["size"] for item in items)
    if total <= CACHE_LIMIT_BYTES:
        return 0
    protected = playlist_protected_ids()
    if protect_id:
        protected.add(protect_id)
    removed = 0
    for item in reversed(items):  # do mais antigo para o mais recente
        if total <= CACHE_LIMIT_BYTES:
            break
        vid = item["id"]
        if vid in protected:
            continue
        freed = remove_cached_video(vid)
        if freed:
            total -= freed
            removed += 1
    return removed


def cache_stats():
    items = cache_items()
    return {
        "count": len(items),
        "bytes": sum(item["size"] for item in items),
        "limit": CACHE_LIMIT_BYTES,
        "items": items,
    }


def safe_filename(value, fallback="musica"):
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", value or "")
    value = re.sub(r"\s+", " ", value).strip().strip(".")[:80]
    return value or fallback


def download_name(video_id, meta, audio_path):
    ext = os.path.splitext(audio_path)[1].lower()
    base = safe_filename(meta.get("title") or meta.get("channel") or "musica")
    return "%s - %s%s" % (base, video_id, ext)


DOWNLOAD_INDEX = os.path.join(CACHE_DIR, "downloads.json")
_download_index = None
_download_index_guard = threading.Lock()


def load_download_index():
    global _download_index
    if _download_index is not None:
        return _download_index
    data = {}
    try:
        with open(DOWNLOAD_INDEX, "r", encoding="utf-8") as handle:
            loaded = json.load(handle)
        if isinstance(loaded, dict):
            data = loaded
    except (OSError, ValueError):
        pass
    _download_index = data
    return data


def record_download(key, filename):
    with _download_index_guard:
        index = load_download_index()
        index[key] = filename
        path = DOWNLOAD_INDEX + ".tmp"
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(index, handle, ensure_ascii=False)
            os.replace(path, DOWNLOAD_INDEX)
        except OSError:
            try:
                os.remove(path)
            except OSError:
                pass


def find_existing_download(video_id, folder=None, index_key=None):
    """Procura numa pasta se ja existe arquivo salvo deste mesmo video."""
    folder = folder or DOWNLOAD_DIR
    index_key = index_key or video_id
    index = load_download_index()
    recorded = index.get(index_key)
    if recorded and os.path.isfile(os.path.join(folder, recorded)):
        return recorded

    marker = " - " + video_id
    try:
        names = os.listdir(folder)
    except OSError:
        return None
    for name in names:
        stem, ext = os.path.splitext(name)
        if ext.lower() in AUDIO_EXTS and stem.endswith(marker):
            record_download(index_key, name)
            return name
    return None


def save_to_downloads(video_id, meta, audio_path, folder=None, index_key=None):
    """Copia o audio pronto para a pasta de destino, sem duplicar o video."""
    folder = folder or DOWNLOAD_DIR
    index_key = index_key or video_id
    existing = find_existing_download(video_id, folder, index_key)
    if existing:
        return existing, True

    name = download_name(video_id, meta, audio_path)
    try:
        os.makedirs(folder, exist_ok=True)
        destination = os.path.join(folder, name)
        if os.path.exists(destination):
            stem, ext = os.path.splitext(name)
            counter = 2
            while os.path.exists(os.path.join(folder, "%s (%d)%s" % (stem, counter, ext))):
                counter += 1
            destination = os.path.join(folder, "%s (%d)%s" % (stem, counter, ext))
        shutil.copy2(audio_path, destination)
    except OSError as exc:
        raise YtError("Nao foi possivel salvar o arquivo.", str(exc))
    saved = os.path.basename(destination)
    record_download(index_key, saved)
    return saved, False


PLAYLIST_ID_RE = re.compile(r"^[a-z0-9-]{6,40}$")
_playlist_guard = threading.Lock()


def playlist_path(playlist_id):
    return os.path.join(PLAYLIST_DIR, playlist_id + ".json")


def clean_playlist_name(name):
    name = re.sub(r"\s+", " ", (name or "")).strip()[:60]
    return name


def playlist_summary(data):
    items = data.get("items") if isinstance(data.get("items"), list) else []
    return {
        "id": data.get("id"),
        "name": data.get("name") or "Playlist",
        "created": data.get("created") or 0,
        "count": len(items),
    }


def list_playlists():
    playlists = []
    try:
        names = os.listdir(PLAYLIST_DIR)
    except OSError:
        return playlists
    for name in names:
        if not name.endswith(".json"):
            continue
        playlist_id = name[:-5]
        if not PLAYLIST_ID_RE.match(playlist_id):
            continue
        data = load_playlist(playlist_id)
        if data:
            playlists.append(playlist_summary(data))
    playlists.sort(key=lambda pl: pl.get("name") or "")
    return playlists


def load_playlist(playlist_id):
    if not PLAYLIST_ID_RE.match(playlist_id or ""):
        return None
    path = playlist_path(playlist_id)
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or data.get("id") != playlist_id:
        return None
    if not isinstance(data.get("items"), list):
        data["items"] = []
    return data


def save_playlist(data):
    playlist_id = data.get("id")
    if not PLAYLIST_ID_RE.match(playlist_id or ""):
        return False
    os.makedirs(PLAYLIST_DIR, exist_ok=True)
    path = playlist_path(playlist_id)
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False)
        os.replace(tmp, path)
        return True
    except OSError:
        try:
            os.remove(tmp)
        except OSError:
            pass
        return False


def create_playlist(name):
    name = clean_playlist_name(name)
    if not name:
        raise YtError("De um nome para a playlist.")
    playlist_id = uuid.uuid4().hex[:12]
    while os.path.exists(playlist_path(playlist_id)):
        playlist_id = uuid.uuid4().hex[:12]
    data = {
        "id": playlist_id,
        "name": name,
        "created": int(time.time()),
        "items": [],
    }
    if not save_playlist(data):
        raise YtError("Nao foi possivel criar a playlist.")
    return data


def delete_playlist(playlist_id):
    if not PLAYLIST_ID_RE.match(playlist_id or ""):
        return False
    try:
        os.remove(playlist_path(playlist_id))
        return True
    except OSError:
        return False


def playlist_item_from_raw(raw):
    if not isinstance(raw, dict):
        return None
    video_id = str(raw.get("id") or "")
    if not VIDEO_ID_RE.match(video_id):
        return None
    item = {
        "id": video_id,
        "title": str(raw.get("title") or "(sem titulo)")[:300],
        "channel": str(raw.get("channel") or raw.get("uploader") or "")[:200],
        "duration": raw.get("duration") if isinstance(raw.get("duration"), (int, float)) else None,
        "thumb": str(raw.get("thumb") or "")[:500],
        "url": "https://www.youtube.com/watch?v=%s" % video_id,
    }
    if not item["thumb"]:
        item["thumb"] = "https://i.ytimg.com/vi/%s/mqdefault.jpg" % video_id
    return item


def add_playlist_item(playlist_id, raw_item):
    with _playlist_guard:
        data = load_playlist(playlist_id)
        if not data:
            raise YtError("Playlist nao encontrada.")
        item = playlist_item_from_raw(raw_item)
        if not item:
            raise YtError("Musica invalida.")
        for existing in data["items"]:
            if existing.get("id") == item["id"]:
                return data, False
        data["items"].append(item)
        if not save_playlist(data):
            raise YtError("Nao foi possivel salvar a playlist.")
        return data, True


def remove_playlist_item(playlist_id, video_id):
    with _playlist_guard:
        data = load_playlist(playlist_id)
        if not data:
            return False
        before = len(data["items"])
        data["items"] = [i for i in data["items"] if i.get("id") != video_id]
        if len(data["items"]) == before:
            return False
        return save_playlist(data)


def playlist_download_folder(data):
    return os.path.join(DOWNLOAD_DIR, safe_filename(data.get("name") or "Playlist", "Playlist"))


def save_playlist_item(data, item):
    video_id = item.get("id")
    folder = playlist_download_folder(data)
    index_key = "pl:%s:%s" % (data.get("id"), video_id)
    meta = {k: item.get(k) for k in ("title", "channel", "thumb", "duration")}
    audio_path = prepare(video_id, meta)
    return save_to_downloads(video_id, meta, audio_path, folder=folder, index_key=index_key)


def save_playlist_all(data):
    saved = 0
    existed = 0
    failed = 0
    done_ids = []
    for item in list(data.get("items") or []):
        try:
            _, was_existing = save_playlist_item(data, item)
            done_ids.append(item.get("id"))
            if was_existing:
                existed += 1
            else:
                saved += 1
        except YtError:
            failed += 1
        except Exception:  # noqa: BLE001 - continuar com as proximas
            failed += 1
    return {"saved": saved, "existed": existed, "failed": failed, "ids": done_ids}


def clear_cache():
    """Remove apenas os arquivos baixados pelo proprio app, dentro do cache."""
    freed = 0
    if os.path.isdir(AUDIO_DIR):
        for name in os.listdir(AUDIO_DIR):
            path = os.path.join(AUDIO_DIR, name)
            if os.path.isfile(path):
                try:
                    freed += os.path.getsize(path)
                    os.remove(path)
                except OSError:
                    pass
    return freed


def update_ytdlp():
    try:
        proc = subprocess.run(
            [YTDLP, "-U"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=180,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise YtError("Nao foi possivel atualizar o programa agora.", str(exc))
    output = (proc.stdout or "").strip()
    if proc.returncode != 0:
        raise YtError("A atualizacao falhou.", output[-400:])
    return output[-400:] or "Programa atualizado."


class Handler(BaseHTTPRequestHandler):
    server_version = "MusicaLocal/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_error_json(self, message, status=500, detail=""):
        self.send_json({"ok": False, "error": message, "detail": detail}, status)

    def serve_file(self, path, download_name=None):
        size = os.path.getsize(path)
        ext = os.path.splitext(path)[1].lower()
        content_type = MIME_TYPES.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"

        start = 0
        end = size - 1
        status = 200
        range_header = self.headers.get("Range")
        if range_header:
            match = re.match(r"bytes=(\d*)-(\d*)$", range_header.strip())
            if match:
                if match.group(1):
                    start = int(match.group(1))
                    end = int(match.group(2)) if match.group(2) else size - 1
                elif match.group(2):
                    start = max(0, size - int(match.group(2)))
                if start >= size:
                    self.send_response(416)
                    self.send_header("Content-Range", "bytes */%d" % size)
                    self.end_headers()
                    return
                end = min(end, size - 1)
                if end < start:
                    end = size - 1
                status = 206

        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if download_name:
            ascii_name = download_name.encode("ascii", "ignore").decode("ascii") or "musica"
            quoted = quote(download_name)
            self.send_header(
                "Content-Disposition",
                "attachment; filename=\"%s\"; filename*=UTF-8''%s" % (ascii_name, quoted),
            )
        if status == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command == "HEAD":
            return

        with open(path, "rb") as handle:
            handle.seek(start)
            remaining = length
            while remaining > 0:
                chunk = handle.read(min(65536, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def serve_static(self, relative):
        safe = os.path.normpath(relative).lstrip("/")
        if safe.startswith("..") or os.path.isabs(safe):
            return self.send_error_json("Caminho invalido.", 400)
        path = os.path.join(STATIC_DIR, safe)
        if not os.path.isfile(path):
            return self.send_error_json("Arquivo nao encontrado.", 404)
        return self.serve_file(path)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)
        try:
            if path == "/api/health":
                return self.send_json({"ok": True, "version": self.server_version})

            if path == "/api/search":
                term = (query.get("q") or [""])[0].strip()
                if not term:
                    return self.send_json({"ok": True, "items": []})
                if is_youtube_url(term):
                    data = resolve(term)
                    return self.send_json(
                        {
                            "ok": True,
                            "type": data["type"],
                            "title": data["title"],
                            "items": data["items"],
                        }
                    )
                limit = int((query.get("limit") or ["24"])[0] or 24)
                return self.send_json({"ok": True, "items": search(term, limit)})

            if path == "/api/playlists":
                return self.send_json({"ok": True, "playlists": list_playlists()})

            if path.startswith("/api/playlists/"):
                rest = path[len("/api/playlists/"):]
                playlist_id = rest.split("/", 1)[0]
                data = load_playlist(playlist_id)
                if not data:
                    return self.send_error_json("Playlist nao encontrada.", 404)
                return self.send_json({"ok": True, "playlist": data})

            if path == "/api/recommend":
                raw_ids = (query.get("ids") or [""])[0]
                seed_ids = [part.strip() for part in raw_ids.split(",") if part.strip()]
                term = (query.get("q") or [""])[0]
                fresh = (query.get("fresh") or [""])[0] in ("1", "true", "yes")
                use_cache = (query.get("cache") or [""])[0] in ("1", "true", "yes")
                return self.send_json(
                    {"ok": True, "items": recommend(seed_ids, term, fresh, use_cache)}
                )

            if path == "/api/resolve":
                url = (query.get("url") or [""])[0].strip()
                data = resolve(url)
                return self.send_json({"ok": True, **data})

            if path.startswith("/api/prepare/"):
                video_id = path.rsplit("/", 1)[-1]
                prepare(video_id, meta_from_query(query))
                return self.send_json(
                    {"ok": True, "id": video_id, "audio_url": "/api/audio/%s" % video_id}
                )

            if path.startswith("/api/save/"):
                video_id = path.rsplit("/", 1)[-1]
                meta = meta_from_query(query)
                audio_path = prepare(video_id, meta)
                saved, exists = save_to_downloads(video_id, meta, audio_path)
                return self.send_json({"ok": True, "file": saved, "exists": exists})

            if path.startswith("/api/download/"):
                video_id = path.rsplit("/", 1)[-1]
                meta = meta_from_query(query)
                audio_path = prepare(video_id, meta)
                return self.serve_file(audio_path, download_name(video_id, meta, audio_path))

            if path.startswith("/api/audio/"):
                video_id = path.rsplit("/", 1)[-1]
                return self.serve_file(prepare(video_id, meta_from_query(query)))

            if path == "/api/cache":
                return self.send_json({"ok": True, **cache_stats()})

            if path in ("/", "/index.html"):
                return self.serve_static("index.html")
            if path.startswith("/static/"):
                return self.serve_static(path[len("/static/"):])

            return self.send_error_json("Pagina nao encontrada.", 404)

        except YtError as exc:
            return self.send_error_json(exc.message, 502, exc.detail)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:  # noqa: BLE001 - nao derrubar o servidor por um request
            sys.stderr.write("erro inesperado: %r\n" % (exc,))
            return self.send_error_json("Erro inesperado no programa.", 500, str(exc))

    def do_HEAD(self):
        self.do_GET()

    def read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > 1048576:
            return {}
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}
        return data if isinstance(data, dict) else {}

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)
        try:
            if path == "/api/cache/clear":
                freed = clear_cache()
                return self.send_json({"ok": True, "freed_bytes": freed, **cache_stats()})
            if path == "/api/update":
                message = update_ytdlp()
                return self.send_json({"ok": True, "message": message})

            if path == "/api/playlists":
                body = self.read_json_body()
                data = create_playlist(body.get("name") or "")
                return self.send_json({"ok": True, "playlist": playlist_summary(data)})

            if path.startswith("/api/playlists/"):
                rest = path[len("/api/playlists/"):]
                parts = rest.split("/")
                playlist_id = parts[0]
                action = parts[1] if len(parts) > 1 else ""
                data = load_playlist(playlist_id)
                if not data:
                    return self.send_error_json("Playlist nao encontrada.", 404)

                if action == "delete":
                    delete_playlist(playlist_id)
                    return self.send_json({"ok": True})
                if action == "items":
                    body = self.read_json_body()
                    data, added = add_playlist_item(playlist_id, body.get("item"))
                    return self.send_json(
                        {"ok": True, "added": added, "playlist": playlist_summary(data)}
                    )
                if action == "remove":
                    body = self.read_json_body()
                    video_id = str(body.get("video_id") or "")
                    removed = remove_playlist_item(playlist_id, video_id)
                    data = load_playlist(playlist_id) or data
                    return self.send_json(
                        {"ok": True, "removed": removed, "playlist": playlist_summary(data)}
                    )
                if action == "save-all":
                    result = save_playlist_all(data)
                    return self.send_json({"ok": True, **result})
                if action == "save" and len(parts) > 2:
                    video_id = parts[2]
                    item = None
                    for entry in data.get("items") or []:
                        if entry.get("id") == video_id:
                            item = entry
                            break
                    if not item:
                        return self.send_error_json("Musica nao esta na playlist.", 404)
                    saved, exists = save_playlist_item(data, item)
                    return self.send_json({"ok": True, "file": saved, "exists": exists})

            return self.send_error_json("Pagina nao encontrada.", 404)
        except YtError as exc:
            return self.send_error_json(exc.message, 502, exc.detail)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write("erro inesperado: %r\n" % (exc,))
            return self.send_error_json("Erro inesperado no programa.", 500, str(exc))


def main():
    parser = argparse.ArgumentParser(description="Musica Local")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    ensure_dirs()
    if not os.access(YTDLP, os.X_OK):
        sys.stderr.write("aviso: yt-dlp nao executavel em %s\n" % YTDLP)
    threading.Thread(target=backfill_cache_meta, daemon=True).start()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    sys.stdout.write("Musica Local em http://%s:%d\n" % (args.host, args.port))
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
