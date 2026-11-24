(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* elementos                                                           */
  /* ------------------------------------------------------------------ */

  var audio = document.getElementById("audio");
  var searchForm = document.getElementById("searchForm");
  var input = document.getElementById("q");
  var btnBuscar = document.getElementById("btnBuscar");
  var hint = document.getElementById("hint");
  var notice = document.getElementById("notice");
  var resultsEl = document.getElementById("results");
  var recoBox = document.getElementById("recoBox");
  var recoGrid = document.getElementById("recoGrid");
  var recoHint = document.getElementById("recoHint");
  var btnRecarregarReco = document.getElementById("btnRecarregarReco");
  var emptyBusca = document.getElementById("emptyBusca");
  var queueEl = document.getElementById("queue");
  var favoritesEl = document.getElementById("favorites");
  var historyEl = document.getElementById("history");
  var downloadsEl = document.getElementById("downloads");
  var emptyFila = document.getElementById("emptyFila");
  var emptyFavoritos = document.getElementById("emptyFavoritos");
  var emptyHistorico = document.getElementById("emptyHistorico");
  var emptyBaixadas = document.getElementById("emptyBaixadas");
  var baixadasInfo = document.getElementById("baixadasInfo");
  var playlistsEl = document.getElementById("playlists");
  var emptyPlaylists = document.getElementById("emptyPlaylists");
  var playlistListView = document.getElementById("playlistListView");
  var playlistDetailView = document.getElementById("playlistDetailView");
  var playlistDetailName = document.getElementById("playlistDetailName");
  var playlistDetailInfo = document.getElementById("playlistDetailInfo");
  var playlistSongsEl = document.getElementById("playlistSongs");
  var emptyPlaylistSongs = document.getElementById("emptyPlaylistSongs");
  var btnNovaPlaylist = document.getElementById("btnNovaPlaylist");
  var btnVoltarPlaylists = document.getElementById("btnVoltarPlaylists");
  var btnTocarPlaylist = document.getElementById("btnTocarPlaylist");
  var btnShufflePlaylist = document.getElementById("btnShufflePlaylist");
  var btnBaixarPlaylist = document.getElementById("btnBaixarPlaylist");
  var btnAddPlaylist = document.getElementById("btnAddPlaylist");
  var btnExcluirPlaylist = document.getElementById("btnExcluirPlaylist");
  var filaBadge = document.getElementById("filaBadge");
  var baixadasBadge = document.getElementById("baixadasBadge");
  var limparBaixadas = document.getElementById("limparBaixadas");
  var cover = document.getElementById("cover");
  var nowTitle = document.getElementById("nowTitle");
  var nowChannel = document.getElementById("nowChannel");
  var btnPrev = document.getElementById("btnPrev");
  var btnPlay = document.getElementById("btnPlay");
  var btnNext = document.getElementById("btnNext");
  var btnFav = document.getElementById("btnFav");
  var btnDl = document.getElementById("btnDl");
  var btnPlAdd = document.getElementById("btnPlAdd");
  var curTime = document.getElementById("curTime");
  var durTime = document.getElementById("durTime");
  var seek = document.getElementById("seek");
  var volume = document.getElementById("volume");
  var loading = document.getElementById("loading");
  var modalBackdrop = document.getElementById("modalBackdrop");
  var plPickerBackdrop = document.getElementById("plPickerBackdrop");
  var plPickerSong = document.getElementById("plPickerSong");
  var plPickerList = document.getElementById("plPickerList");
  var btnPlPickerNova = document.getElementById("btnPlPickerNova");
  var btnFecharPlPicker = document.getElementById("btnFecharPlPicker");
  var selBar = document.getElementById("selBar");
  var selCount = document.getElementById("selCount");
  var selTodas = document.getElementById("selTodas");
  var selBaixar = document.getElementById("selBaixar");
  var selPlaylist = document.getElementById("selPlaylist");
  var selFila = document.getElementById("selFila");
  var selLimpar = document.getElementById("selLimpar");
  var cacheInfo = document.getElementById("cacheInfo");
  var btnAjustes = document.getElementById("btnAjustes");
  var btnFecharAjustes = document.getElementById("btnFecharAjustes");
  var btnLimparCache = document.getElementById("btnLimparCache");
  var btnAtualizar = document.getElementById("btnAtualizar");
  var toast = document.getElementById("toast");

  var STORAGE = {
    favorites: "musica_favoritos_v1",
    history: "musica_historico_v1",
    queue: "musica_fila_v1",
    index: "musica_indice_v1",
    volume: "musica_volume_v1",
    lastSearch: "musica_ultima_busca_v1",
    playback: "musica_playback_v1",
    playingState: "musica_playing_v1"
  };

  var MAX_HISTORY = 120;
  var state = {
    view: "buscar",
    results: [],
    recs: [],
    recoLoading: false,
    queue: [],
    index: -1,
    favorites: [],
    history: [],
    downloads: [],
    downloadedIds: {},
    playlists: [],
    playlist: null,
    playlistLoading: false,
    addingToPlaylist: null,
    savingPlaylist: false,
    plPickerItem: null,
    plPickerBulk: null,
    selected: {},
    playback: {},
    lastPosSave: 0,
    resumePending: false,
    downloadsLoading: false,
    volume: 80,
    searching: false,
    hasSearched: false,
    loading: false,
    currentSrcId: null,
    downloading: {},
    seeking: false,
    prefetched: {},
    toastTimer: null
  };

  /* ------------------------------------------------------------------ */
  /* utilidades                                                          */
  /* ------------------------------------------------------------------ */

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* armazenamento cheio ou bloqueado: seguir sem salvar */
    }
  }

  function isItem(item) {
    return !!item &&
      typeof item.id === "string" &&
      /^[A-Za-z0-9_-]{11}$/.test(item.id) &&
      typeof item.title === "string";
  }

  function cleanList(list) {
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!isItem(item) || seen[item.id]) continue;
      seen[item.id] = true;
      out.push({
        id: item.id,
        title: item.title,
        channel: typeof item.channel === "string" ? item.channel : "",
        duration: typeof item.duration === "number" && isFinite(item.duration) ? item.duration : null,
        thumb: typeof item.thumb === "string" && item.thumb
          ? item.thumb
          : "https://i.ytimg.com/vi/" + item.id + "/mqdefault.jpg",
        url: "https://www.youtube.com/watch?v=" + item.id
      });
    }
    return out;
  }

  function thumbOf(item) {
    return item && item.thumb
      ? item.thumb
      : "https://i.ytimg.com/vi/" + (item ? item.id : "") + "/mqdefault.jpg";
  }

  function metaQuery(item) {
    if (!item) return "";
    var parts = [];
    function add(key, value) {
      if (value === null || value === undefined || value === "") return;
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
    }
    add("title", item.title);
    add("channel", item.channel);
    add("duration", item.duration);
    add("thumb", thumbOf(item));
    return parts.length ? "?" + parts.join("&") : "";
  }

  function indexOfId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return i;
    }
    return -1;
  }

  function findById(list, id) {
    var index = indexOfId(list, id);
    return index === -1 ? null : list[index];
  }

  function isFav(id) {
    return indexOfId(state.favorites, id) !== -1;
  }

  function pad2(number) {
    return number < 10 ? "0" + number : String(number);
  }

  function fmtTime(seconds) {
    var total = Number(seconds);
    if (!isFinite(total) || total <= 0) return "0:00";
    total = Math.floor(total);
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var secs = total % 60;
    if (hours > 0) return hours + ":" + pad2(minutes) + ":" + pad2(secs);
    return minutes + ":" + pad2(secs);
  }

  function fmtBytes(bytes) {
    var value = Number(bytes) || 0;
    if (value < 1024) return value + " B";
    if (value < 1048576) return Math.round(value / 1024) + " KB";
    return (value / 1048576).toFixed(1).replace(".", ",") + " MB";
  }

  var LONG_AUDIO_SECONDS = 1200; // 20 min: acima disso avisa antes de baixar
  var BULK_WARN_BYTES = 150 * 1048576; // 150 MB estimados em acoes em massa

  function estAudioBytes(seconds) {
    return (Number(seconds) || 0) * 16000; // ~128 kbps
  }

  function confirmLongAudio(items, what) {
    var totalSec = 0;
    var longest = null;
    for (var i = 0; i < items.length; i++) {
      var d = Number(items[i].duration) || 0;
      if (d <= 0) continue;
      totalSec += d;
      if (!longest || d > longest.duration) longest = items[i];
    }
    if (!totalSec) return true;

    var estTotal = estAudioBytes(totalSec);
    var singleLong = items.length === 1 && Number(items[0].duration) > LONG_AUDIO_SECONDS;
    var bulkBig = items.length > 1 && (estTotal > BULK_WARN_BYTES || totalSec > 3600);
    if (!singleLong && !bulkBig) return true;

    var msg;
    if (singleLong) {
      msg = "\"" + items[0].title + "\" tem " + fmtTime(items[0].duration) +
        " (≈ " + fmtBytes(estAudioBytes(items[0].duration)) + ").";
    } else {
      msg = "São " + items.length + " arquivos, ~" + fmtTime(totalSec) + " no total" +
        " (≈ " + fmtBytes(estTotal) + " estimados).";
      if (longest && Number(longest.duration) > LONG_AUDIO_SECONDS) {
        msg += " O maior é \"" + longest.title + "\" com " + fmtTime(longest.duration) + ".";
      }
    }
    return window.confirm("Atenção: áudio(s) muito longo(s) — pode ser mix/podcast de horas.\n" +
      msg + "\n\nBaixar mesmo assim?");
  }

  function currentItem() {
    if (state.index < 0 || state.index >= state.queue.length) return null;
    return state.queue[state.index];
  }

  function friendlyError(err) {
    var message = err && err.message ? err.message : "Não foi possível completar a ação.";
    if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(message)) {
      return "O programa não respondeu. Verifique se ele está aberto e tente de novo.";
    }
    if (/recusou|403|forbidden/i.test(message)) {
      return message + " Se continuar, abra Ajustes e toque em Atualizar programa.";
    }
    return message;
  }

  function fetchJSON(url, options) {
    return window.fetch(url, options || {}).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!response.ok || data.ok === false) {
          throw new Error(data.error || "O programa não conseguiu completar a ação.");
        }
        return data;
      });
    });
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("out");
    toast.hidden = false;
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(function () {
      toast.classList.add("out");
      window.setTimeout(function () {
        toast.hidden = true;
        toast.classList.remove("out");
      }, 190);
    }, 3400);
  }

  function showNotice(message) {
    notice.textContent = message;
    notice.hidden = false;
  }

  function setHint(message) {
    hint.textContent = message;
  }

  /* ------------------------------------------------------------------ */
  /* persistencia                                                        */
  /* ------------------------------------------------------------------ */

  function saveQueue() {
    writeJSON(STORAGE.queue, state.queue);
    writeJSON(STORAGE.index, state.index);
  }

  function saveFavorites() {
    writeJSON(STORAGE.favorites, state.favorites);
  }

  function saveHistory() {
    writeJSON(STORAGE.history, state.history);
  }

  function savePlaybackPos() {
    var item = currentItem();
    if (!item || !audio.getAttribute("src") || !isFinite(audio.currentTime)) return;
    if (audio.currentTime < 3) {
      clearPlaybackPos(item.id);
      return;
    }
    state.playback[item.id] = Math.floor(audio.currentTime);
    var keys = Object.keys(state.playback);
    while (keys.length > 150) {
      delete state.playback[keys.shift()];
    }
    writeJSON(STORAGE.playback, state.playback);
    state.lastPosSave = audio.currentTime;
  }

  function clearPlaybackPos(id) {
    if (state.playback[id] === undefined) return;
    delete state.playback[id];
    writeJSON(STORAGE.playback, state.playback);
  }

  /* ------------------------------------------------------------------ */
  /* desenho das listas                                                  */
  /* ------------------------------------------------------------------ */

  function imgTag(item) {
    return '<img src="' + esc(thumbOf(item)) + '" alt="" loading="lazy" onerror="this.style.opacity=0">';
  }

  var DL_ICON_SVG =
    '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var DL_ICON_DOWNLOAD = DL_ICON_SVG +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
    '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var DL_ICON_SAVED = DL_ICON_SVG +
    '<path d="M20 6 9 17l-5-5"/></svg>';

  function isDownloaded(id) {
    return !!state.downloadedIds[id];
  }

  function dlIconSvg(saved) {
    return saved ? DL_ICON_SAVED : DL_ICON_DOWNLOAD;
  }

  function dlButtonHtml(item) {
    var saved = isDownloaded(item.id);
    return '<button type="button" class="small dl' + (saved ? " saved" : "") + '" ' +
      'data-action="download" title="' + (saved ? "Já baixada — clique para salvar cópia" : "Baixar música") + '">' +
      dlIconSvg(saved) + "</button>";
  }

  function selBtnHtml() {
    return '<button type="button" class="sel-btn" data-action="select" title="Selecionar">' +
      '<span class="sel-check">✓</span></button>';
  }

  function isSelected(id) {
    return !!state.selected[id];
  }

  function cardHtml(item) {
    var fav = isFav(item.id);
    return '' +
      '<article class="card' + (isSelected(item.id) ? " sel-on" : "") + '" data-id="' + esc(item.id) + '">' +
        selBtnHtml() +
        '<button type="button" class="thumb" data-action="play" title="Tocar ' + esc(item.title) + '">' +
          imgTag(item) +
          (item.duration ? '<span class="dur">' + fmtTime(item.duration) + '</span>' : "") +
          '<span class="play-hint">▶</span>' +
        '</button>' +
        '<div class="card-body">' +
          '<div class="card-title" data-action="play" title="' + esc(item.title) + '">' + esc(item.title) + '</div>' +
          '<div class="card-channel">' + esc(item.channel || "YouTube") + '</div>' +
          '<div class="card-actions">' +
            '<button type="button" class="small primary" data-action="play">▶ Tocar</button>' +
            '<button type="button" class="small" data-action="queue" title="Adicionar à fila">+ Fila</button>' +
            dlButtonHtml(item) +
            '<button type="button" class="small pladd" data-action="pladd" title="Adicionar à playlist">＋</button>' +
            '<button type="button" class="small fav' + (fav ? " on" : "") + '" data-action="fav" title="' + (fav ? "Remover dos favoritos" : "Favoritar") + '">' + (fav ? "♥" : "♡") + '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function rowHtml(item, context) {
    var fav = isFav(item.id);
    var canRemove = context === "queue" || context === "favorites";
    return '' +
      '<div class="row' + (isSelected(item.id) ? " sel-on" : "") + '" data-id="' + esc(item.id) + '">' +
        selBtnHtml().replace('class="sel-btn"', 'class="sel-btn row-sel"') +
        '<button type="button" class="row-thumb" data-action="play" title="Tocar">' + imgTag(item) + '</button>' +
        '<div class="row-info">' +
          '<div class="row-title" data-action="play">' + esc(item.title) + '</div>' +
          '<div class="row-channel">' + esc(item.channel || "YouTube") + '</div>' +
        '</div>' +
        '<span class="row-dur">' + fmtTime(item.duration) + '</span>' +
        '<div class="row-actions">' +
          dlButtonHtml(item) +
          '<button type="button" class="small fav' + (fav ? " on" : "") + '" data-action="fav" title="' + (fav ? "Remover dos favoritos" : "Favoritar") + '">' + (fav ? "♥" : "♡") + '</button>' +
          (canRemove ? '<button type="button" class="small" data-action="remove" title="Remover">✕</button>' : "") +
        '</div>' +
      '</div>';
  }

  function renderResults() {
    resultsEl.innerHTML = state.results.map(cardHtml).join("");
    emptyBusca.hidden = !(state.hasSearched && state.results.length === 0);
    updateRecoVisibility();
  }

  function updateRecoVisibility() {
    recoBox.hidden = state.results.length > 0 || (!state.recoLoading && state.recs.length === 0);
  }

  function renderReco() {
    if (state.recoLoading) {
      recoGrid.innerHTML = '<p class="hint reco-loading">Buscando recomendações…</p>';
    } else {
      recoGrid.innerHTML = state.recs.map(cardHtml).join("");
    }
    updateRecoVisibility();
  }

  function recoSeeds() {
    var seeds = [];
    var sources = state.history.concat(state.downloads).concat(state.favorites);
    for (var i = 0; i < sources.length && seeds.length < 5; i++) {
      if (seeds.indexOf(sources[i].id) === -1) seeds.push(sources[i].id);
    }
    return seeds;
  }

  /* ------------------------------------------------------------------ */
  /* playlists                                                           */
  /* ------------------------------------------------------------------ */

  function playlistRowHtml(pl) {
    return '' +
      '<div class="row" data-id="' + esc(pl.id) + '">' +
        '<button type="button" class="row-thumb pl-thumb" data-action="open" title="Abrir playlist">☰</button>' +
        '<div class="row-info">' +
          '<div class="row-title" data-action="open">' + esc(pl.name) + '</div>' +
          '<div class="row-channel">' + pl.count + (pl.count === 1 ? " música" : " músicas") + '</div>' +
        '</div>' +
        '<div class="row-actions">' +
          '<button type="button" class="small" data-action="play" title="Tocar tudo">▶</button>' +
          '<button type="button" class="small" data-action="shuffle" title="Tocar em ordem aleatória">🔀</button>' +
          '<button type="button" class="small" data-action="saveall" title="Baixar tudo para Downloads/' + esc(pl.name) + '">⬇</button>' +
          '<button type="button" class="small" data-action="delete" title="Excluir playlist">✕</button>' +
        '</div>' +
      '</div>';
  }

  function playlistSongRowHtml(item) {
    return '' +
      '<div class="row' + (isSelected(item.id) ? " sel-on" : "") + '" data-id="' + esc(item.id) + '">' +
        selBtnHtml().replace('class="sel-btn"', 'class="sel-btn row-sel"') +
        '<button type="button" class="row-thumb" data-action="play" title="Tocar">' + imgTag(item) + '</button>' +
        '<div class="row-info">' +
          '<div class="row-title" data-action="play">' + esc(item.title) + '</div>' +
          '<div class="row-channel">' + esc(item.channel || "YouTube") + '</div>' +
        '</div>' +
        '<span class="row-dur">' + fmtTime(item.duration) + '</span>' +
        '<div class="row-actions">' +
          '<button type="button" class="small dl' + (isDownloaded(item.id) ? " saved" : "") + '" data-action="plsave" title="' + (isDownloaded(item.id) ? "Já no cache — salvar cópia na pasta da playlist" : "Baixar para a pasta da playlist") + '">' + dlIconSvg(isDownloaded(item.id)) + '</button>' +
          '<button type="button" class="small" data-action="plremove" title="Remover da playlist">✕</button>' +
        '</div>' +
      '</div>';
  }

  function renderPlaylists() {
    playlistsEl.innerHTML = state.playlists.map(playlistRowHtml).join("");
    emptyPlaylists.hidden = state.playlists.length > 0;
  }

  function loadPlaylists() {
    fetchJSON("/api/playlists").then(function (data) {
      state.playlists = Array.isArray(data.playlists) ? data.playlists : [];
      renderPlaylists();
    }).catch(function () {
      /* sem playlists por agora */
    });
  }

  function showPlaylistList() {
    state.playlist = null;
    playlistListView.hidden = false;
    playlistDetailView.hidden = true;
    renderPlaylists();
  }

  function openPlaylist(id) {
    fetchJSON("/api/playlists/" + encodeURIComponent(id)).then(function (data) {
      state.playlist = data.playlist;
      renderPlaylistDetail();
    }).catch(function (err) {
      showToast(friendlyError(err));
    });
  }

  function renderPlaylistDetail() {
    var pl = state.playlist;
    if (!pl) {
      showPlaylistList();
      return;
    }
    playlistListView.hidden = true;
    playlistDetailView.hidden = false;
    playlistDetailName.textContent = pl.name || "Playlist";
    var count = Array.isArray(pl.items) ? pl.items.length : 0;
    playlistDetailInfo.textContent = count + (count === 1 ? " música" : " músicas") +
      " · baixadas em Downloads/" + (pl.name || "Playlist") + "/";
    playlistSongsEl.innerHTML = (pl.items || []).map(playlistSongRowHtml).join("");
    emptyPlaylistSongs.hidden = count > 0;
    updateAddButton();
  }

  function updateAddButton() {
    var active = !!state.addingToPlaylist;
    btnAddPlaylist.textContent = active ? "✓ Adicionando" : "＋ Adicionar";
    btnAddPlaylist.title = active
      ? "Toque em ＋ nos cards de resultado para adicionar. Clique aqui para parar."
      : "Buscar músicas para adicionar";
  }

  function setAddingToPlaylist(id) {
    state.addingToPlaylist = id;
    updateAddButton();
    if (id) {
      var pl = findById(state.playlists, id);
      var name = pl ? pl.name : "playlist";
      switchView("buscar");
      setHint("Adicionando a \"" + name + "\": busque músicas e toque no botão ＋ dos cards.");
      input.focus();
    } else {
      setHint("Digite o nome de uma música ou artista e aperte Buscar.");
    }
  }

  function createPlaylist() {
    var name = window.prompt("Nome da playlist:");
    if (name === null) return;
    name = name.trim();
    if (!name) {
      showToast("De um nome para a playlist.");
      return;
    }
    fetchJSON("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name })
    }).then(function () {
      showToast("Playlist criada.");
      loadPlaylists();
    }).catch(function (err) {
      showToast(friendlyError(err));
    });
  }

  function deletePlaylist(pl) {
    if (!pl) return;
    if (!window.confirm("Excluir a playlist \"" + pl.name + "\"? As músicas baixadas na pasta dela não são apagadas.")) return;
    fetchJSON("/api/playlists/" + encodeURIComponent(pl.id) + "/delete", { method: "POST" }).then(function () {
      showToast("Playlist excluída.");
      if (state.playlist && state.playlist.id === pl.id) showPlaylistList();
      loadPlaylists();
    }).catch(function (err) {
      showToast(friendlyError(err));
    });
  }

  function shuffledCopy(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function playPlaylistAll() {
    var pl = state.playlist;
    if (!pl || !pl.items || !pl.items.length) {
      showToast("A playlist está vazia.");
      return;
    }
    playCollection(pl.items, 0);
  }

  function playPlaylistShuffled() {
    var pl = state.playlist;
    if (!pl || !pl.items || !pl.items.length) {
      showToast("A playlist está vazia.");
      return;
    }
    playCollection(shuffledCopy(pl.items), 0);
    showToast("Tocando \"" + pl.name + "\" em ordem aleatória.");
  }

  function savePlaylistAll() {
    var pl = state.playlist;
    if (!pl || state.savingPlaylist) return;
    if (!pl.items || !pl.items.length) {
      showToast("A playlist está vazia.");
      return;
    }
    if (!window.confirm("Baixar todas as " + pl.items.length + " músicas para Downloads/" + pl.name + "/?")) return;
    if (!confirmLongAudio(pl.items || [])) return;
    state.savingPlaylist = true;
    btnBaixarPlaylist.disabled = true;
    btnBaixarPlaylist.textContent = "Baixando…";
    fetchJSON("/api/playlists/" + encodeURIComponent(pl.id) + "/save-all", { method: "POST" }).then(function (data) {
      var parts = [];
      if (data.saved) parts.push(data.saved + " baixadas");
      if (data.existed) parts.push(data.existed + " já existiam");
      if (data.failed) parts.push(data.failed + " falharam");
      showToast("Playlist \"" + pl.name + "\": " + (parts.join(", ") || "nada a fazer") + ".");
      if (Array.isArray(data.ids)) {
        for (var i = 0; i < data.ids.length; i++) markDownloaded(data.ids[i]);
      }
      loadDownloads();
    }).catch(function (err) {
      showToast(friendlyError(err));
    }).then(function () {
      state.savingPlaylist = false;
      btnBaixarPlaylist.disabled = false;
      btnBaixarPlaylist.textContent = "⬇ Baixar tudo";
    });
  }

  function savePlaylistSong(item, btn) {
    var pl = state.playlist;
    if (!pl || !isItem(item)) return;
    if (!confirmLongAudio([item])) return;
    if (btn) setDownloadButton(btn, true);
    showToast("Baixando \"" + item.title + "\"…");
    fetchJSON("/api/playlists/" + encodeURIComponent(pl.id) + "/save/" + encodeURIComponent(item.id), { method: "POST" }).then(function (data) {
      showToast((data.exists ? "Já estava na pasta: " : "Salvo em Downloads/" + pl.name + "/: ") + (data.file || item.title));
      markDownloaded(item.id);
      loadDownloads();
    }).catch(function (err) {
      showToast(friendlyError(err));
    }).then(function () {
      if (btn) setDownloadButton(btn, false);
    });
  }

  function addToPlaylist(item) {
    if (!state.addingToPlaylist || !isItem(item)) return;
    fetchJSON("/api/playlists/" + encodeURIComponent(state.addingToPlaylist) + "/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: item })
    }).then(function (data) {
      showToast(data.added ? "Adicionado a \"" + (data.playlist.name || "playlist") + "\"." : "Essa música já está na playlist.");
      loadPlaylists();
      if (state.playlist && state.playlist.id === state.addingToPlaylist) {
        openPlaylist(state.playlist.id);
      }
    }).catch(function (err) {
      showToast(friendlyError(err));
    });
  }

  function removePlaylistSong(video_id) {
    var pl = state.playlist;
    if (!pl) return;
    fetchJSON("/api/playlists/" + encodeURIComponent(pl.id) + "/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: video_id })
    }).then(function () {
      openPlaylist(pl.id);
      loadPlaylists();
    }).catch(function (err) {
      showToast(friendlyError(err));
    });
  }

  function renderPlPicker() {
    var item = state.plPickerItem;
    if (state.plPickerBulk && state.plPickerBulk.length) {
      plPickerSong.textContent = state.plPickerBulk.length +
        (state.plPickerBulk.length === 1 ? " música selecionada" : " músicas selecionadas");
    } else {
      plPickerSong.textContent = item ? "\"" + item.title + "\"" : "";
    }
    if (!state.playlists.length) {
      plPickerList.innerHTML = '<p class="hint">Nenhuma playlist ainda. Crie uma abaixo.</p>';
      return;
    }
    plPickerList.innerHTML = state.playlists.map(function (pl) {
      return '<button type="button" class="pl-pick" data-id="' + esc(pl.id) + '">' +
        '<span class="pl-pick-name">' + esc(pl.name) + '</span>' +
        '<span class="pl-pick-count">' + pl.count + "</span>" +
        '</button>';
    }).join("");
  }

  function openPlPicker(item) {
    if (!isItem(item)) return;
    state.plPickerItem = item;
    plPickerBackdrop.hidden = false;
    plPickerList.innerHTML = '<p class="hint">Carregando…</p>';
    fetchJSON("/api/playlists").then(function (data) {
      state.playlists = Array.isArray(data.playlists) ? data.playlists : [];
      renderPlPicker();
    }).catch(function () {
      state.playlists = [];
      renderPlPicker();
    });
    btnFecharPlPicker.focus();
  }

  function closePlPicker() {
    plPickerBackdrop.hidden = true;
    state.plPickerItem = null;
    state.plPickerBulk = null;
  }

  function openPlPickerBulk() {
    var items = selectedItems();
    if (!items.length) return;
    state.plPickerBulk = items;
    state.plPickerItem = null;
    plPickerBackdrop.hidden = false;
    plPickerList.innerHTML = '<p class="hint">Carregando…</p>';
    fetchJSON("/api/playlists").then(function (data) {
      state.playlists = Array.isArray(data.playlists) ? data.playlists : [];
      renderPlPicker();
    }).catch(function () {
      state.playlists = [];
      renderPlPicker();
    });
    btnFecharPlPicker.focus();
  }

  function addItemToPlaylist(playlist_id, item) {
    if (!item) return;
    fetchJSON("/api/playlists/" + encodeURIComponent(playlist_id) + "/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: item })
    }).then(function (data) {
      var name = data.playlist && data.playlist.name ? data.playlist.name : "playlist";
      showToast(data.added ? "Adicionado a \"" + name + "\"." : "Essa música já está em \"" + name + "\".");
      loadPlaylists();
      closePlPicker();
    }).catch(function (err) {
      showToast(friendlyError(err));
    });
  }

  function pickPlaylistFromModal(playlist_id) {
    if (state.plPickerBulk && state.plPickerBulk.length) {
      bulkToPlaylist(playlist_id);
    } else {
      addItemToPlaylist(playlist_id, state.plPickerItem);
    }
  }

  function createPlaylistAndAdd() {
    var item = state.plPickerItem;
    var bulk = state.plPickerBulk;
    var name = window.prompt("Nome da nova playlist:");
    if (name === null) return;
    name = name.trim();
    if (!name) {
      showToast("De um nome para a playlist.");
      return;
    }
    fetchJSON("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name })
    }).then(function (data) {
      var pl = data.playlist;
      showToast("Playlist \"" + pl.name + "\" criada.");
      loadPlaylists();
      if (bulk && bulk.length) {
        state.plPickerBulk = bulk;
        bulkToPlaylist(pl.id);
      } else if (item) {
        addItemToPlaylist(pl.id, item);
      } else {
        closePlPicker();
      }
    }).catch(function (err) {
      showToast(friendlyError(err));
    });
  }

  /* ------------------------------------------------------------------ */
  /* multi-selecao                                                      */
  /* ------------------------------------------------------------------ */

  function toggleSelect(item) {
    if (!isItem(item)) return;
    if (state.selected[item.id]) {
      delete state.selected[item.id];
    } else {
      state.selected[item.id] = item;
    }
    refreshSelStyles();
    updateSelBar();
  }

  function selectedItems() {
    var ids = Object.keys(state.selected);
    var items = [];
    for (var i = 0; i < ids.length; i++) {
      items.push(state.selected[ids[i]]);
    }
    return items;
  }

  function refreshSelStyles() {
    var nodes = document.querySelectorAll("#results .card, #recoGrid .card, .list .row");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle("sel-on", isSelected(nodes[i].getAttribute("data-id")));
    }
  }

  function updateSelBar() {
    var count = Object.keys(state.selected).length;
    selBar.hidden = count === 0;
    selCount.textContent = count + (count === 1 ? " selecionada" : " selecionadas");
    selTodas.disabled = count === 0;
    selBaixar.disabled = count === 0;
    selPlaylist.disabled = count === 0;
    selFila.disabled = count === 0;
  }

  function visibleItems() {
    switch (state.view) {
      case "baixadas": return state.downloads;
      case "fila": return state.queue;
      case "favoritos": return state.favorites;
      case "historico": return state.history;
      case "playlists": return (state.playlist && state.playlist.items) || [];
      case "buscar":
      default: return state.results.length ? state.results : state.recs;
    }
  }

  function selectAllVisible() {
    var items = visibleItems();
    var added = 0;
    for (var i = 0; i < items.length; i++) {
      if (!isItem(items[i])) continue;
      if (!state.selected[items[i].id]) added += 1;
      state.selected[items[i].id] = items[i];
    }
    if (!added && !Object.keys(state.selected).length) {
      showToast("Nada para selecionar aqui.");
      return;
    }
    refreshSelStyles();
    updateSelBar();
    if (added) showToast(added + (added === 1 ? " música selecionada" : " músicas selecionadas") + ".");
  }

  function clearSelection() {
    state.selected = {};
    refreshSelStyles();
    updateSelBar();
  }

  function bulkDownload() {
    var items = selectedItems();
    if (!items.length || state.savingPlaylist) return;
    if (!confirmLongAudio(items)) return;
    state.savingPlaylist = true;
    selBaixar.disabled = true;
    selPlaylist.disabled = true;
    selFila.disabled = true;

    var index = 0;
    var saved = 0;
    var existed = 0;
    var failed = 0;

    function next() {
      if (index >= items.length) {
        state.savingPlaylist = false;
        updateSelBar();
        loadDownloads();
        var parts = [];
        if (saved) parts.push(saved + " baixadas");
        if (existed) parts.push(existed + " já existiam");
        if (failed) parts.push(failed + " falharam");
        showToast(parts.length ? parts.join(", ") + "." : "Nada a baixar.");
        return;
      }
      var item = items[index];
      index += 1;
      selCount.textContent = "Baixando " + index + "/" + items.length + "…";
      fetchJSON("/api/save/" + encodeURIComponent(item.id) + metaQuery(item)).then(function (data) {
        if (data.exists) existed += 1;
        else saved += 1;
        markDownloaded(item.id);
      }).catch(function () {
        failed += 1;
      }).then(next);
    }
    next();
  }

  function bulkAddToQueue() {
    var items = selectedItems();
    if (!items.length) return;
    var added = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!isItem(item) || indexOfId(state.queue, item.id) !== -1) continue;
      state.queue.push(item);
      added += 1;
    }
    if (!added) {
      showToast("As músicas já estão na fila.");
      return;
    }
    if (state.index < 0) state.index = 0;
    saveQueue();
    renderQueue();
    updatePlayer();
    showToast(added + (added === 1 ? " música adicionada" : " músicas adicionadas") + " à fila.");
  }

  function bulkToPlaylist(playlist_id) {
    var items = state.plPickerBulk || (state.plPickerItem ? [state.plPickerItem] : []);
    if (!items.length) return;
    var index = 0;
    var added = 0;
    var duplicated = 0;
    var failed = 0;

    function next() {
      if (index >= items.length) {
        var name = "playlist";
        var pl = findById(state.playlists, playlist_id);
        if (pl) name = pl.name;
        var parts = [];
        if (added) parts.push(added + " adicionadas");
        if (duplicated) parts.push(duplicated + " já estavam");
        if (failed) parts.push(failed + " falharam");
        showToast("\"" + name + "\": " + (parts.join(", ") || "nada a fazer") + ".");
        loadPlaylists();
        if (state.playlist && state.playlist.id === playlist_id) openPlaylist(playlist_id);
        clearSelection();
        closePlPicker();
        return;
      }
      var item = items[index];
      index += 1;
      selCount.textContent = "Adicionando " + index + "/" + items.length + "…";
      fetchJSON("/api/playlists/" + encodeURIComponent(playlist_id) + "/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: item })
      }).then(function (data) {
        if (data.added) added += 1;
        else duplicated += 1;
      }).catch(function () {
        failed += 1;
      }).then(next);
    }
    next();
  }

  function sortRecsSavedFirst() {
    state.recs.sort(function (a, b) {
      return (isDownloaded(b.id) ? 1 : 0) - (isDownloaded(a.id) ? 1 : 0);
    });
  }

  function loadRecs(fresh) {
    if (state.recoLoading) return;
    state.recoLoading = true;
    renderReco();

    var params = [];
    var seeds = recoSeeds();
    if (seeds.length) params.push("ids=" + encodeURIComponent(seeds.join(",")));
    var lastSearch = readJSON(STORAGE.lastSearch, "");
    if (lastSearch) params.push("q=" + encodeURIComponent(lastSearch));
    if (!seeds.length && !lastSearch) {
      state.recoLoading = false;
      renderReco();
      return;
    }
    params.push("cache=1");
    if (fresh) params.push("fresh=1");

    fetchJSON("/api/recommend?" + params.join("&")).then(function (data) {
      state.recs = cleanList(data.items || []);
      sortRecsSavedFirst();
      recoHint.textContent = state.recs.length
        ? "Baseadas nas músicas que você ouviu."
        : "";
    }).catch(function () {
      state.recs = [];
      recoHint.textContent = "";
    }).then(function () {
      state.recoLoading = false;
      renderReco();
    });
  }

  function renderQueue() {
    queueEl.innerHTML = state.queue.map(function (item) {
      return rowHtml(item, "queue");
    }).join("");
    emptyFila.hidden = state.queue.length > 0;
    updateBadge();
    highlightQueue();
  }

  function renderFavorites() {
    favoritesEl.innerHTML = state.favorites.map(function (item) {
      return rowHtml(item, "favorites");
    }).join("");
    emptyFavoritos.hidden = state.favorites.length > 0;
  }

  function renderHistory() {
    historyEl.innerHTML = state.history.map(function (item) {
      return rowHtml(item, "history");
    }).join("");
    emptyHistorico.hidden = state.history.length > 0;
  }

  function downloadRowHtml(item) {
    return '' +
      '<div class="row' + (isSelected(item.id) ? " sel-on" : "") + '" data-id="' + esc(item.id) + '">' +
        selBtnHtml().replace('class="sel-btn"', 'class="sel-btn row-sel"') +
        '<button type="button" class="row-thumb" data-action="play" title="Tocar">' + imgTag(item) + '</button>' +
        '<div class="row-info">' +
          '<div class="row-title" data-action="play">' + esc(item.title) + '</div>' +
          '<div class="row-channel">' + esc(item.channel || "YouTube") + '</div>' +
        '</div>' +
        '<span class="row-dur">' + (item.duration ? fmtTime(item.duration) : "") + '</span>' +
        '<div class="row-actions">' +
          '<button type="button" class="small pladd" data-action="pladd" title="Adicionar à playlist">＋</button>' +
          '<span class="row-size">' + fmtBytes(item.size) + '</span>' +
        '</div>' +
      '</div>';
  }

  function renderDownloads() {
    downloadsEl.innerHTML = state.downloads.map(downloadRowHtml).join("");
    emptyBaixadas.hidden = state.downloads.length > 0;
    baixadasBadge.textContent = String(state.downloads.length);
    baixadasBadge.hidden = state.downloads.length === 0;

    if (!state.downloads.length) {
      baixadasInfo.textContent = "Toque no botão ↓ de uma música para baixar. Elas ficam salvas aqui para ouvir offline.";
      return;
    }

    var total = 0;
    for (var i = 0; i < state.downloads.length; i++) {
      total += Number(state.downloads[i].size) || 0;
    }
    baixadasInfo.textContent = state.downloads.length +
      (state.downloads.length === 1 ? " música baixada" : " músicas baixadas") +
      " · " + fmtBytes(total) + ".";
  }

  function loadDownloads() {
    if (state.downloadsLoading) return;
    state.downloadsLoading = true;
    fetchJSON("/api/cache").then(function (data) {
      state.downloads = Array.isArray(data.items) ? data.items : [];
      state.downloadedIds = {};
      for (var i = 0; i < state.downloads.length; i++) {
        state.downloadedIds[state.downloads[i].id] = true;
      }
      sortRecsSavedFirst();
      renderResults();
      renderReco();
      renderDownloads();
    }).catch(function () {
      if (state.view === "baixadas") {
        showToast("Não foi possível carregar as músicas baixadas.");
      }
    }).then(function () {
      state.downloadsLoading = false;
    });
  }

  function setDownloadButton(btn, busy) {
    if (!btn) return;
    if (busy) {
      btn.dataset.icon = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add("busy");
      btn.textContent = "…";
      btn.title = "Baixando…";
    } else {
      btn.disabled = false;
      btn.classList.remove("busy");
      var holder = btn.closest("[data-id]");
      var saved = holder ? isDownloaded(holder.getAttribute("data-id")) : false;
      var isPl = btn.getAttribute("data-action") === "plsave";
      btn.innerHTML = dlIconSvg(saved);
      btn.classList.toggle("saved", saved);
      btn.title = saved
        ? (isPl ? "Já no cache — salvar cópia na pasta da playlist" : "Já baixada — clique para salvar cópia")
        : (isPl ? "Baixar para a pasta da playlist" : "Baixar música");
    }
  }

  function downloadItem(item, btn) {
    if (!isItem(item) || state.downloading[item.id]) return;
    if (!confirmLongAudio([item])) return;
    state.downloading[item.id] = true;
    setDownloadButton(btn, true);
    showToast("Baixando \"" + item.title + "\"…");

    fetchJSON("/api/save/" + encodeURIComponent(item.id) + metaQuery(item)).then(function (data) {
      if (data.exists) {
        showToast("Já estava em Downloads: " + (data.file || item.title));
      } else {
        showToast("Salvo em Downloads: " + (data.file || item.title));
      }
      markDownloaded(item.id);
      loadDownloads();
      window.setTimeout(loadDownloads, 3000);
    }).catch(function (err) {
      showToast(friendlyError(err));
    }).then(function () {
      delete state.downloading[item.id];
      setDownloadButton(btn, false);
    });
  }

  function updateBadge() {
    filaBadge.textContent = String(state.queue.length);
    filaBadge.hidden = state.queue.length === 0;
  }

  function highlightQueue() {
    var rows = queueEl.querySelectorAll(".row");
    var current = currentItem();
    for (var i = 0; i < rows.length; i++) {
      if (current && rows[i].getAttribute("data-id") === current.id) {
        rows[i].classList.add("current");
      } else {
        rows[i].classList.remove("current");
      }
    }
  }

  function syncFavButtons(id) {
    var buttons = document.querySelectorAll('[data-action="fav"]');
    var fav = isFav(id);
    for (var i = 0; i < buttons.length; i++) {
      var holder = buttons[i].closest("[data-id]");
      if (!holder || holder.getAttribute("data-id") !== id) continue;
      buttons[i].classList.toggle("on", fav);
      buttons[i].textContent = fav ? "♥" : "♡";
      buttons[i].title = fav ? "Remover dos favoritos" : "Favoritar";
    }
  }

  function markDownloaded(id) {
    if (!id) return;
    state.downloadedIds[id] = true;
    var buttons = document.querySelectorAll('[data-action="download"], [data-action="plsave"]');
    for (var i = 0; i < buttons.length; i++) {
      var holder = buttons[i].closest("[data-id]");
      if (!holder || holder.getAttribute("data-id") !== id) continue;
      if (buttons[i].classList.contains("busy") || buttons[i].disabled) continue;
      var isPl = buttons[i].getAttribute("data-action") === "plsave";
      buttons[i].classList.add("saved");
      buttons[i].innerHTML = dlIconSvg(true);
      buttons[i].title = isPl ? "Já no cache — salvar cópia na pasta da playlist" : "Já baixada — clique para salvar cópia";
    }
  }

  /* ------------------------------------------------------------------ */
  /* player                                                              */
  /* ------------------------------------------------------------------ */

  function setPlayIcon(playing) {
    btnPlay.textContent = playing ? "❚❚" : "▶";
    btnPlay.classList.toggle("playing", playing);
    btnPlay.setAttribute("aria-label", playing ? "Pausar" : "Tocar");
  }

  function updateLoading() {
    loading.hidden = !state.loading;
  }

  function updateFavButton() {
    var item = currentItem();
    var fav = item ? isFav(item.id) : false;
    btnFav.classList.toggle("on", fav);
    btnFav.textContent = fav ? "♥" : "♡";
    btnFav.title = fav ? "Remover dos favoritos" : "Favoritar";
  }

  function updatePlayer() {
    var item = currentItem();
    if (!item) {
      cover.innerHTML = "<span>♪</span>";
      nowTitle.textContent = "Nada tocando";
      nowChannel.textContent = "Escolha uma música para começar";
      updateFavButton();
      highlightQueue();
      return;
    }

    cover.innerHTML = "";
    var image = document.createElement("img");
    image.alt = "";
    image.src = thumbOf(item);
    image.onerror = function () {
      cover.innerHTML = "<span>♪</span>";
    };
    cover.appendChild(image);

    nowTitle.textContent = item.title;
    nowChannel.textContent = item.channel || "YouTube";
    updateFavButton();
    highlightQueue();
  }

  function safePlay() {
    var promise;
    try {
      promise = audio.play();
    } catch (err) {
      state.loading = false;
      updateLoading();
      showToast("Não foi possível tocar. Tente outra música.");
      return;
    }
    if (promise && typeof promise.catch === "function") {
      promise.catch(function (err) {
        if (err && err.name === "AbortError") return;
        state.loading = false;
        updateLoading();
        setPlayIcon(false);
        if (err && err.name === "NotAllowedError") {
          state.resumePending = true;
          showToast("Toque na tela ou aperte uma tecla para continuar a música.");
        } else {
          showToast("Não foi possível tocar. Tente outra música.");
        }
      });
    }
  }

  function startCurrent() {
    var item = currentItem();
    if (!item) {
      showToast("Escolha uma música primeiro.");
      return;
    }

    updatePlayer();

    if (state.currentSrcId === item.id && audio.getAttribute("src")) {
      safePlay();
      return;
    }

    state.currentSrcId = item.id;
    state.loading = true;
    updateLoading();
    audio.src = "/api/audio/" + encodeURIComponent(item.id) + metaQuery(item);
    safePlay();
  }

  function stopPlayback() {
    audio.pause();
    audio.removeAttribute("src");
    try {
      audio.load();
    } catch (err) {
      /* alguns navegadores antigos reclamam de load() sem src */
    }
    state.currentSrcId = null;
    state.loading = false;
    updateLoading();
    setPlayIcon(false);
    seek.value = "0";
    curTime.textContent = "0:00";
    durTime.textContent = "0:00";
  }

  function togglePlay() {
    var item = currentItem();
    if (!item) {
      if (state.queue.length) {
        state.index = Math.max(0, Math.min(state.index, state.queue.length - 1));
        updatePlayer();
        startCurrent();
      } else {
        showToast("Escolha uma música para começar.");
      }
      return;
    }

    if (state.currentSrcId !== item.id || !audio.getAttribute("src")) {
      startCurrent();
      return;
    }

    if (audio.paused) {
      safePlay();
    } else {
      audio.pause();
    }
  }

  function playNext() {
    if (!state.queue.length) return;
    if (state.index < state.queue.length - 1) {
      state.index += 1;
      saveQueue();
      startCurrent();
    } else {
      audio.pause();
      showToast("Fim da fila.");
    }
  }

  function playPrevious() {
    var item = currentItem();
    if (!item) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (state.index > 0) {
      state.index -= 1;
      saveQueue();
      startCurrent();
    } else {
      audio.currentTime = 0;
    }
  }

  function seekBy(delta) {
    var item = currentItem();
    if (!item || !audio.getAttribute("src")) return;
    var duration = isFinite(audio.duration) ? audio.duration : 0;
    var target = audio.currentTime + delta;
    if (duration > 0) target = Math.min(duration, Math.max(0, target));
    else target = Math.max(0, target);
    audio.currentTime = target;
  }

  function playCollection(items, startIndex) {
    state.queue = cleanList(items);
    if (!state.queue.length) return;
    state.index = Math.max(0, Math.min(Number(startIndex) || 0, state.queue.length - 1));
    saveQueue();
    renderQueue();
    updatePlayer();
    startCurrent();
  }

  function playFromResults(item) {
    var index = indexOfId(state.results, item.id);
    if (index === -1) return;
    playCollection(state.results, index);
  }

  function playSingle(item) {
    if (!isItem(item)) return;
    var index = indexOfId(state.queue, item.id);
    if (index === -1) {
      var insertAt = state.index >= 0 ? state.index + 1 : state.queue.length;
      state.queue.splice(insertAt, 0, item);
      index = insertAt;
    }
    state.index = index;
    saveQueue();
    renderQueue();
    updatePlayer();
    startCurrent();
  }

  function addToQueue(item) {
    if (indexOfId(state.queue, item.id) !== -1) {
      showToast("Essa música já está na fila.");
      return;
    }
    state.queue.push(item);
    if (state.index < 0) state.index = 0;
    saveQueue();
    renderQueue();
    updatePlayer();
    showToast("Adicionado à fila.");
  }

  function removeFromQueue(id) {
    var index = indexOfId(state.queue, id);
    if (index === -1) return;
    var wasCurrent = index === state.index;
    state.queue.splice(index, 1);

    if (!state.queue.length) {
      state.index = -1;
      stopPlayback();
    } else if (wasCurrent) {
      state.index = Math.min(index, state.queue.length - 1);
      stopPlayback();
    } else if (index < state.index) {
      state.index -= 1;
    }
    saveQueue();
    renderQueue();
    updatePlayer();
  }

  function clearQueue() {
    if (!state.queue.length) return;
    if (!window.confirm("Limpar a fila? A música atual vai parar.")) return;
    state.queue = [];
    state.index = -1;
    saveQueue();
    stopPlayback();
    renderQueue();
    updatePlayer();
  }

  function toggleFavorite(item) {
    if (!isItem(item)) return;
    var index = indexOfId(state.favorites, item.id);
    if (index === -1) {
      state.favorites.unshift(item);
      showToast("Adicionado aos favoritos.");
    } else {
      state.favorites.splice(index, 1);
      showToast("Removido dos favoritos.");
    }
    saveFavorites();
    renderFavorites();
    syncFavButtons(item.id);
    updateFavButton();
  }

  function removeFavorite(id) {
    var index = indexOfId(state.favorites, id);
    if (index === -1) return;
    state.favorites.splice(index, 1);
    saveFavorites();
    renderFavorites();
    syncFavButtons(id);
    updateFavButton();
    showToast("Removido dos favoritos.");
  }

  function addHistory(item) {
    if (!isItem(item)) return;
    if (state.history.length && state.history[0].id === item.id) return;
    state.history = [item].concat(state.history.filter(function (old) {
      return old.id !== item.id;
    })).slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
  }

  function clearHistory() {
    if (!state.history.length) return;
    if (!window.confirm("Apagar o histórico?")) return;
    state.history = [];
    saveHistory();
    renderHistory();
  }

  function prefetchNext() {
    if (state.index < 0 || state.index >= state.queue.length - 1) return;
    var next = state.queue[state.index + 1];
    if (!next || state.prefetched[next.id]) return;
    state.prefetched[next.id] = true;
    window.fetch("/api/prepare/" + encodeURIComponent(next.id) + metaQuery(next)).then(function (response) {
      if (!response.ok) state.prefetched[next.id] = false;
    }).catch(function () {
      state.prefetched[next.id] = false;
    });
  }

  /* ------------------------------------------------------------------ */
  /* busca                                                               */
  /* ------------------------------------------------------------------ */

  function setBusy(busy) {
    state.searching = busy;
    btnBuscar.disabled = busy;
    btnBuscar.textContent = busy ? "Buscando…" : "Buscar";
  }

  function doSearch(term) {
    var query = String(term || "").trim();
    if (!query || state.searching) {
      if (!query) input.focus();
      return;
    }

    notice.hidden = true;
    emptyBusca.hidden = true;
    state.hasSearched = true;
    resultsEl.innerHTML = "";
    setHint("Buscando…");
    setBusy(true);

    fetchJSON("/api/search?q=" + encodeURIComponent(query)).then(function (data) {
      writeJSON(STORAGE.lastSearch, query);
      var items = cleanList(data.items || []);
      state.results = items;
      renderResults();

      if (!items.length) {
        setHint("Nenhum resultado para \"" + query + "\".");
        emptyBusca.hidden = false;
        return;
      }

      if (data.type === "video") {
        setHint("Link reconhecido. Tocando a música…");
        playCollection(items, 0);
      } else if (data.type === "playlist") {
        setHint("Playlist \"" + (data.title || "sem nome") + "\" com " + items.length + " músicas. Tocando a primeira…");
        playCollection(items, 0);
      } else {
        setHint(items.length + (items.length === 1 ? " música encontrada" : " músicas encontradas") + " para \"" + query + "\".");
      }
    }).catch(function (err) {
      state.results = [];
      renderResults();
      emptyBusca.hidden = true;
      showNotice(friendlyError(err));
      setHint("Digite o nome de uma música ou artista e aperte Buscar.");
    }).then(function () {
      setBusy(false);
    });
  }

  /* ------------------------------------------------------------------ */
  /* ajustes                                                             */
  /* ------------------------------------------------------------------ */

  function openSettings() {
    modalBackdrop.hidden = false;
    cacheInfo.textContent = "Carregando…";
    fetchJSON("/api/cache").then(function (data) {
      var count = Number(data.count) || 0;
      var limit = Number(data.limit) || 0;
      if (count === 0) {
        cacheInfo.textContent = "Nenhuma música baixada ainda.";
      } else {
        cacheInfo.textContent = count + (count === 1 ? " música baixada" : " músicas baixadas") + " (" + fmtBytes(data.bytes) + ")" +
          (limit ? " de " + fmtBytes(limit) + " — músicas de playlists nunca são removidas automaticamente" : ".");
      }
    }).catch(function () {
      cacheInfo.textContent = "Não foi possível ler o espaço usado.";
    });
    btnFecharAjustes.focus();
  }

  function closeSettings() {
    modalBackdrop.hidden = true;
    btnAjustes.focus();
  }

  function clearCache() {
    if (!window.confirm("Apagar todas as músicas baixadas? Elas serão baixadas de novo quando você tocar.")) return;
    btnLimparCache.disabled = true;
    fetchJSON("/api/cache/clear", { method: "POST" }).then(function (data) {
      cacheInfo.textContent = "Nenhuma música baixada ainda.";
      showToast("Espaço liberado: " + fmtBytes(data.freed_bytes) + ".");
    }).catch(function (err) {
      showToast(friendlyError(err));
    }).then(function () {
      btnLimparCache.disabled = false;
    });
  }

  function updateProgram() {
    btnAtualizar.disabled = true;
    btnAtualizar.textContent = "Atualizando…";
    fetchJSON("/api/update", { method: "POST" }).then(function () {
      showToast("Programa atualizado.");
    }).catch(function (err) {
      showToast(friendlyError(err));
    }).then(function () {
      btnAtualizar.disabled = false;
      btnAtualizar.textContent = "Atualizar programa";
    });
  }

  /* ------------------------------------------------------------------ */
  /* eventos                                                             */
  /* ------------------------------------------------------------------ */

  searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    doSearch(input.value);
  });

  resultsEl.addEventListener("click", function (event) {
    var actionEl = event.target.closest ? event.target.closest("[data-action]") : null;
    if (!actionEl) return;
    var card = actionEl.closest(".card");
    if (!card) return;
    var item = findById(state.results, card.getAttribute("data-id"));
    if (!item) return;

    var action = actionEl.getAttribute("data-action");
    if (action === "play") playFromResults(item);
    else if (action === "select") toggleSelect(item);
    else if (action === "queue") addToQueue(item);
    else if (action === "download") downloadItem(item, actionEl);
    else if (action === "pladd") {
      if (state.addingToPlaylist) addToPlaylist(item);
      else openPlPicker(item);
    }
    else if (action === "fav") toggleFavorite(item);
  });

  recoGrid.addEventListener("click", function (event) {
    var actionEl = event.target.closest ? event.target.closest("[data-action]") : null;
    if (!actionEl) return;
    var card = actionEl.closest(".card");
    if (!card) return;
    var id = card.getAttribute("data-id");
    var item = findById(state.recs, id);
    if (!item) return;

    var action = actionEl.getAttribute("data-action");
    if (action === "play") playCollection(state.recs, indexOfId(state.recs, id));
    else if (action === "select") toggleSelect(item);
    else if (action === "queue") addToQueue(item);
    else if (action === "download") downloadItem(item, actionEl);
    else if (action === "pladd") {
      if (state.addingToPlaylist) addToPlaylist(item);
      else openPlPicker(item);
    }
    else if (action === "fav") toggleFavorite(item);
  });

  btnRecarregarReco.addEventListener("click", function () {
    loadRecs(true);
  });

  function bindListClicks(container, context) {
    container.addEventListener("click", function (event) {
      var actionEl = event.target.closest ? event.target.closest("[data-action]") : null;
      if (!actionEl) return;
      var row = actionEl.closest(".row");
      if (!row) return;

      var id = row.getAttribute("data-id");
      var item = findById(state.queue, id) ||
        findById(state.favorites, id) ||
        findById(state.history, id) ||
        findById(state.results, id) ||
        findById(state.recs, id) ||
        findById(state.downloads, id);
      if (!item) return;

      var action = actionEl.getAttribute("data-action");
      if (action === "play") playSingle(item);
      else if (action === "select") toggleSelect(item);
      else if (action === "download") downloadItem(item, actionEl);
      else if (action === "pladd") openPlPicker(item);
      else if (action === "fav") toggleFavorite(item);
      else if (action === "remove") {
        if (context === "queue") removeFromQueue(id);
        else removeFavorite(id);
      }
    });
  }

  bindListClicks(queueEl, "queue");
  bindListClicks(favoritesEl, "favorites");
  bindListClicks(historyEl, "history");
  bindListClicks(downloadsEl, "downloads");

  playlistsEl.addEventListener("click", function (event) {
    var actionEl = event.target.closest ? event.target.closest("[data-action]") : null;
    if (!actionEl) return;
    var row = actionEl.closest(".row");
    if (!row) return;
    var pl = findById(state.playlists, row.getAttribute("data-id"));
    if (!pl) return;
    var action = actionEl.getAttribute("data-action");
    if (action === "open") openPlaylist(pl.id);
    else if (action === "play" || action === "shuffle") {
      fetchJSON("/api/playlists/" + encodeURIComponent(pl.id)).then(function (data) {
        var items = cleanList((data.playlist && data.playlist.items) || []);
        if (!items.length) {
          showToast("A playlist está vazia.");
          return;
        }
        if (action === "shuffle") {
          playCollection(shuffledCopy(items), 0);
          showToast("Tocando \"" + pl.name + "\" em ordem aleatória.");
        } else {
          playCollection(items, 0);
        }
      }).catch(function (err) {
        showToast(friendlyError(err));
      });
    }
    else if (action === "saveall") {
      fetchJSON("/api/playlists/" + encodeURIComponent(pl.id)).then(function (data) {
        state.playlist = data.playlist;
        renderPlaylistDetail();
        savePlaylistAll();
      }).catch(function (err) {
        showToast(friendlyError(err));
      });
    }
    else if (action === "delete") deletePlaylist(pl);
  });

  playlistSongsEl.addEventListener("click", function (event) {
    var actionEl = event.target.closest ? event.target.closest("[data-action]") : null;
    if (!actionEl) return;
    var row = actionEl.closest(".row");
    if (!row || !state.playlist) return;
    var item = findById(state.playlist.items || [], row.getAttribute("data-id"));
    if (!item) return;
    var action = actionEl.getAttribute("data-action");
    if (action === "play") playSingle(item);
    else if (action === "select") toggleSelect(item);
    else if (action === "plsave") savePlaylistSong(item, actionEl);
    else if (action === "plremove") removePlaylistSong(item.id);
  });

  btnNovaPlaylist.addEventListener("click", createPlaylist);
  btnVoltarPlaylists.addEventListener("click", showPlaylistList);
  btnTocarPlaylist.addEventListener("click", playPlaylistAll);
  btnShufflePlaylist.addEventListener("click", playPlaylistShuffled);
  btnBaixarPlaylist.addEventListener("click", savePlaylistAll);
  btnAddPlaylist.addEventListener("click", function () {
    if (state.addingToPlaylist && state.playlist && state.playlist.id === state.addingToPlaylist) {
      setAddingToPlaylist(null);
    } else if (state.playlist) {
      setAddingToPlaylist(state.playlist.id);
    }
  });
  btnExcluirPlaylist.addEventListener("click", function () {
    deletePlaylist(state.playlist ? findById(state.playlists, state.playlist.id) || { id: state.playlist.id, name: state.playlist.name } : null);
  });

  document.getElementById("tabs").addEventListener("click", function (event) {
    var tab = event.target.closest ? event.target.closest(".tab") : null;
    if (!tab) return;
    switchView(tab.getAttribute("data-view"));
  });

  function switchView(name) {
    state.view = name;
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-view") === name);
    }
    var views = ["buscar", "baixadas", "playlists", "fila", "favoritos", "historico"];
    for (var j = 0; j < views.length; j++) {
      document.getElementById("view-" + views[j]).hidden = views[j] !== name;
    }
    if (name === "buscar") loadRecs(false);
    if (name === "baixadas") loadDownloads();
    if (name === "playlists") {
      loadPlaylists();
      if (state.playlist) renderPlaylistDetail();
      else showPlaylistList();
    }
    if (name === "fila") renderQueue();
    if (name === "favoritos") renderFavorites();
    if (name === "historico") renderHistory();
  }

  btnPlay.addEventListener("click", togglePlay);
  btnPrev.addEventListener("click", playPrevious);
  btnNext.addEventListener("click", playNext);

  btnFav.addEventListener("click", function () {
    var item = currentItem();
    if (!item) {
      showToast("Escolha uma música primeiro.");
      return;
    }
    toggleFavorite(item);
  });

  btnDl.addEventListener("click", function () {
    var item = currentItem();
    if (!item) {
      showToast("Escolha uma música primeiro.");
      return;
    }
    downloadItem(item, btnDl);
  });

  btnPlAdd.addEventListener("click", function () {
    var item = currentItem();
    if (!item) {
      showToast("Escolha uma música primeiro.");
      return;
    }
    openPlPicker(item);
  });

  document.getElementById("limparFila").addEventListener("click", clearQueue);
  document.getElementById("limparHistorico").addEventListener("click", clearHistory);

  seek.addEventListener("pointerdown", function () {
    state.seeking = true;
  });

  window.addEventListener("pointerup", function () {
    state.seeking = false;
  });

  seek.addEventListener("input", function () {
    if (isFinite(audio.duration) && audio.duration > 0) {
      var seconds = (Number(seek.value) / 1000) * audio.duration;
      curTime.textContent = fmtTime(seconds);
    }
  });

  seek.addEventListener("change", function () {
    if (isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    }
    state.seeking = false;
  });

  volume.addEventListener("input", function () {
    state.volume = Number(volume.value);
    audio.volume = state.volume / 100;
    writeJSON(STORAGE.volume, state.volume);
  });

  audio.addEventListener("play", function () {
    setPlayIcon(true);
    state.loading = false;
    state.resumePending = false;
    updateLoading();
    writeJSON(STORAGE.playingState, true);
  });

  audio.addEventListener("pause", function () {
    setPlayIcon(false);
    savePlaybackPos();
  });

  audio.addEventListener("waiting", function () {
    state.loading = true;
    updateLoading();
  });

  audio.addEventListener("canplay", function () {
    state.loading = false;
    updateLoading();
  });

  audio.addEventListener("playing", function () {
    state.loading = false;
    updateLoading();
    setPlayIcon(true);
    var item = currentItem();
    if (item) {
      addHistory(item);
      prefetchNext();
    }
  });

  audio.addEventListener("loadedmetadata", function () {
    var item = currentItem();
    var savedPos = item ? Number(state.playback[item.id]) : 0;
    if (savedPos > 5 && isFinite(audio.duration) && savedPos < audio.duration - 8) {
      audio.currentTime = savedPos;
      curTime.textContent = fmtTime(savedPos);
    }
    if (isFinite(audio.duration) && audio.duration > 0) {
      durTime.textContent = fmtTime(audio.duration);
    }
  });

  audio.addEventListener("durationchange", function () {
    if (isFinite(audio.duration) && audio.duration > 0) {
      durTime.textContent = fmtTime(audio.duration);
    }
  });

  audio.addEventListener("timeupdate", function () {
    if (!isFinite(audio.duration) || audio.duration <= 0) return;
    if (!state.seeking) {
      seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
      curTime.textContent = fmtTime(audio.currentTime);
    }
    if (audio.currentTime - state.lastPosSave > 5) {
      savePlaybackPos();
    }
  });

  audio.addEventListener("ended", function () {
    var item = currentItem();
    if (item) clearPlaybackPos(item.id);
    playNext();
  });

  audio.addEventListener("error", function () {
    if (!state.currentSrcId || !audio.getAttribute("src")) return;
    state.loading = false;
    updateLoading();
    setPlayIcon(false);
    state.currentSrcId = null;
    try {
      audio.removeAttribute("src");
      audio.load();
    } catch (err) {
      /* sem consequencia */
    }
    var message = "Não foi possível tocar esta música. Tente outra.";
    if (audio.error && audio.error.code === 4) {
      message = "O navegador não conseguiu tocar este formato de áudio.";
    }
    showToast(message);
  });

  btnAjustes.addEventListener("click", openSettings);
  btnFecharAjustes.addEventListener("click", closeSettings);
  btnLimparCache.addEventListener("click", clearCache);
  btnAtualizar.addEventListener("click", updateProgram);

  modalBackdrop.addEventListener("click", function (event) {
    if (event.target === modalBackdrop) closeSettings();
  });

  plPickerList.addEventListener("click", function (event) {
    var btn = event.target.closest ? event.target.closest(".pl-pick") : null;
    if (!btn) return;
    pickPlaylistFromModal(btn.getAttribute("data-id"));
  });

  btnPlPickerNova.addEventListener("click", createPlaylistAndAdd);
  btnFecharPlPicker.addEventListener("click", closePlPicker);

  selTodas.addEventListener("click", selectAllVisible);
  selBaixar.addEventListener("click", bulkDownload);
  selPlaylist.addEventListener("click", openPlPickerBulk);
  selFila.addEventListener("click", bulkAddToQueue);
  selLimpar.addEventListener("click", clearSelection);
  plPickerBackdrop.addEventListener("click", function (event) {
    if (event.target === plPickerBackdrop) closePlPicker();
  });

  window.addEventListener("pagehide", function () {
    savePlaybackPos();
    writeJSON(STORAGE.playingState, !audio.paused && !!audio.getAttribute("src"));
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      savePlaybackPos();
      writeJSON(STORAGE.playingState, !audio.paused && !!audio.getAttribute("src"));
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (!plPickerBackdrop.hidden) {
        closePlPicker();
        return;
      }
      if (!modalBackdrop.hidden) {
        closeSettings();
        return;
      }
    }
    if (!modalBackdrop.hidden || !plPickerBackdrop.hidden) return;

    var tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return;

    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowRight") {
      seekBy(5);
    } else if (event.key === "ArrowLeft") {
      seekBy(-5);
    }
  });

  /* ------------------------------------------------------------------ */
  /* inicio                                                              */
  /* ------------------------------------------------------------------ */

  function init() {
    state.queue = cleanList(readJSON(STORAGE.queue, []));
    state.favorites = cleanList(readJSON(STORAGE.favorites, []));
    state.history = cleanList(readJSON(STORAGE.history, []));

    var savedPlayback = readJSON(STORAGE.playback, {});
    if (savedPlayback && typeof savedPlayback === "object" && !Array.isArray(savedPlayback)) {
      state.playback = savedPlayback;
    }

    var savedIndex = Number(readJSON(STORAGE.index, -1));
    if (!isFinite(savedIndex)) savedIndex = -1;
    savedIndex = Math.floor(savedIndex);
    if (state.queue.length === 0) {
      state.index = -1;
    } else if (savedIndex < 0 || savedIndex >= state.queue.length) {
      state.index = 0;
    } else {
      state.index = savedIndex;
    }

    var savedVolume = Number(readJSON(STORAGE.volume, 80));
    if (!isFinite(savedVolume)) savedVolume = 80;
    state.volume = Math.max(0, Math.min(100, savedVolume));

    audio.volume = state.volume / 100;
    volume.value = String(state.volume);

    renderResults();
    renderQueue();
    renderFavorites();
    renderHistory();
    renderReco();
    loadDownloads();
    loadRecs(false);
    loadPlaylists();
    updatePlayer();
    updateBadge();
    switchView("buscar");

    var wasPlaying = readJSON(STORAGE.playingState, false) === true;
    if (wasPlaying && currentItem()) {
      state.resumePending = true;
      startCurrent();
    }

    function resumeOnGesture() {
      if (!state.resumePending || audio.paused === false) return;
      if (currentItem() && audio.getAttribute("src")) safePlay();
    }
    document.addEventListener("pointerdown", resumeOnGesture);
    document.addEventListener("keydown", resumeOnGesture);

    input.focus();
  }

  init();
})();
