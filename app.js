/* SPDX-License-Identifier: MIT — OndaLibre
 * Client-side live radio player. No backend or first-party cookies.
 * Streaming hosts are contacted on playback; station artwork is loaded lazily
 * from third-party providers as each station comes into view.
 */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const root = document.documentElement;
  const audio = $("#audio");

  // Where supported (notably newer Safari), mark this page as a long-running
  // media player rather than transient sound. Unsupported browsers ignore it.
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch { /* Audio Session API is experimental and optional */ }

  /* ---------- storage (fails soft when unavailable) ---------- */
  const KEY = { favs: "ondalibre.favs", custom: "ondalibre.custom", vol: "ondalibre.vol", last: "ondalibre.last", theme: "ondalibre.theme" };
  const load = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

  /* ---------- state ---------- */
  const savedFavs = load(KEY.favs, []);
  const favs = new Set(Array.isArray(savedFavs) ? savedFavs.filter((id) => typeof id === "string") : []);
  const savedCustom = load(KEY.custom, []);
  let custom = (Array.isArray(savedCustom) ? savedCustom : [])
    .filter((s) => s && typeof s.id === "string" && typeof s.name === "string"
      && s.name.trim() && typeof s.url === "string" && isHttpUrl(s.url))
    .map((s) => ({
      ...s,
      tags: Array.isArray(s.tags) ? s.tags.filter((tag) => typeof tag === "string").slice(0, 10) : ["Mías"],
      desc: typeof s.desc === "string" ? s.desc : "Añadida por ti",
      genre: typeof s.genre === "string" && s.genre ? s.genre : "Personalizadas"
    }));
  let tag = "Todas";
  let onlyFavs = false;
  let query = "";
  let current = null;        // selected station
  let state = "idle";        // idle | connecting | live | paused | error
  let hls = null;
  let attempt = 0;           // increments on every (re)connect; stale callbacks are ignored
  let timer = 0;
  let needsGesture = false; // HLS manifest loaded but browser requires another play tap

  const all = () => [...window.STATIONS, ...custom];
  const isCustom = (s) => custom.includes(s);

  function isHttpUrl(u) {
    try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; }
  }

  /* ---------- tiny DOM helpers (no innerHTML with data) ---------- */
  function el(name, attrs = {}, ...kids) {
    const n = document.createElement(name);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "text") n.textContent = v; else n.setAttribute(k, v);
    }
    n.append(...kids);
    return n;
  }
  function icon(id) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(NS, "use");
    use.setAttribute("href", "#" + id);
    svg.append(use);
    return svg;
  }

  /* ---------- station identification artwork ---------- */
  // External brand assets are only linked, not bundled or covered by MIT.
  // A text identifier remains visible if a host blocks hotlinking.
  function stationArtwork(station, eager = false) {
    const wrap = el("span", { class: "station-art", "aria-hidden": "true" });
    const initials = String(station.name || "Radio").trim()
      .split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase() || "FM";
    wrap.append(el("span", { class: "station-art-fallback", text: initials }));
    if (typeof station.logo === "string") {
      let safeUrl = null;
      try {
        const url = new URL(station.logo);
        if (url.protocol === "https:" && !url.username && !url.password) safeUrl = url.href;
      } catch { /* absent or invalid logo: use initials */ }
      if (safeUrl) {
        const img = el("img", { src: safeUrl, alt: "", loading: eager ? "eager" : "lazy",
          decoding: "async", referrerpolicy: "no-referrer" });
        img.addEventListener("error", () => img.remove(), { once: true });
        wrap.append(img);
      }
    }
    return wrap;
  }

  /* ---------- theme ---------- */
  function activeTheme() {
    const t = root.getAttribute("data-theme");
    if (t) return t;
    if (matchMedia("(prefers-contrast: more)").matches) return "contrast";
    return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function syncTheme() {
    const t = activeTheme();
    document.querySelectorAll("[data-theme-btn]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeBtn === t)));
    // Phone browser chrome / status bar follows the theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue("--bg").trim() || "#101010";
  }
  $(".themes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-btn]");
    if (!b) return;
    root.setAttribute("data-theme", b.dataset.themeBtn);
    try { localStorage.setItem(KEY.theme, b.dataset.themeBtn); } catch { /* ignore */ }
    syncTheme();
  });
  for (const q of ["(prefers-contrast: more)", "(prefers-color-scheme: light)"]) {
    matchMedia(q).addEventListener("change", syncTheme);
  }

  /* ---------- views (#about) ---------- */
  function route() {
    const hash = location.hash.slice(1);
    const available = root.dataset.authenticated === "true";
    const view = hash === "about" ? "about"
      : available && (hash === "stats-radios" || hash === "stats-genres") ? hash : "home";
    root.setAttribute("data-view", view);
    document.querySelectorAll("[data-nav]").forEach((a) => {
      if (a.dataset.nav === view) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = ({ about: "Acerca de", "stats-radios": "Mis radios",
      "stats-genres": "Mis géneros", home: "Radio en directo" })[view] + " · OndaLibre";
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* ---------- list ---------- */
  function visible() {
    const q = query.trim().toLowerCase();
    return all().filter((s) => {
      if (onlyFavs && !favs.has(s.id)) return false;
      if (tag !== "Todas" && !(s.tags || []).includes(tag)) return false;
      return !q || [s.name, s.desc, ...(s.tags || [])].join(" ").toLowerCase().includes(q);
    });
  }

  function renderChips() {
    const tags = ["Todas", ...new Set(all().flatMap((s) => s.tags || []))];
    if (!tags.includes(tag)) tag = "Todas";
    $("#chips").replaceChildren(...tags.map((t) =>
      el("button", { type: "button", "data-tag": t, "aria-pressed": String(t === tag), text: t })));
  }

  function renderList() {
    const items = visible().map((s) => {
      const li = el("li", { class: "st", "data-id": s.id });
      li.append(
        el("button", { type: "button", class: "st-main" },
          icon("i-play"),
          stationArtwork(s),
          el("span", { class: "st-txt" },
            el("span", { class: "st-name", text: s.name }),
            el("span", { class: "st-desc", text: s.desc || "Añadida por ti" })),
          el("span", { class: "st-tags" })));
      if (s.site && isHttpUrl(s.site)) {
        li.append(el("a", { class: "ico", href: s.site, target: "_blank", rel: "noopener noreferrer",
          "aria-label": `Web oficial de ${s.name}`, title: "Web oficial" }, icon("i-out")));
      }
      if (isCustom(s)) {
        li.append(el("button", { type: "button", class: "ico st-del", "aria-label": `Quitar ${s.name}`, title: "Quitar" }, icon("i-x")));
      }
      li.append(el("button", { type: "button", class: "ico st-fav", "aria-pressed": String(favs.has(s.id)),
        "aria-label": `Favorita: ${s.name}`, title: "Favorita" }, icon("i-star")));
      return li;
    });
    $("#list").replaceChildren(...(items.length ? items : [el("li", { class: "empty", text: "No hay emisoras que coincidan." })]));
    syncList();
  }

  /* Updates rows in place so keyboard focus is never lost. */
  function syncList() {
    document.querySelectorAll("#list .st").forEach((li) => {
      const s = all().find((x) => x.id === li.dataset.id);
      if (!s) return;
      const isCur = !!current && current.id === s.id;
      const live = isCur && state === "live";
      const busy = isCur && ["live", "connecting", "buffering", "retrying"].includes(state);
      li.classList.toggle("is-current", isCur);
      li.classList.toggle("is-live", live);
      li.querySelector(".st-main use").setAttribute("href", busy ? "#i-stop" : "#i-play");
      li.querySelector(".st-main").setAttribute("aria-label", `${busy ? "Detener" : "Reproducir"} ${s.name}`);
      li.querySelector(".st-tags").textContent = live ? "En directo" : (s.tags || []).join(" · ");
    });
  }

  /* ---------- player and automatic recovery ---------- */
  // Retries are bounded: never hammer a broadcaster, and never restart after
  // an explicit Stop, a system Pause, or a station switch.
  const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];
  const BUFFER_TIMEOUT_MS = 15000;
  const STABLE_PLAY_MS = 60000;
  let retryCount = 0;
  let retryTimer = 0;
  let stallTimer = 0;
  let wantsPlayback = false;
  let lastPlayingAt = 0;
  let internalPause = false;

  function clearPlaybackTimers() {
    clearTimeout(timer); timer = 0;
    clearTimeout(retryTimer); retryTimer = 0;
    clearTimeout(stallTimer); stallTimer = 0;
  }

  // Listening statistics use media playback events, not button presses.
  function publishPlayback(playing = state === "live" && !audio.paused) {
    document.dispatchEvent(new CustomEvent("ondalibre:playback", {
      detail: {
        playing: !!(current && playing),
        station: current ? {
          id: current.id, name: current.name,
          genre: current.genre || (isCustom(current) ? "Personalizadas" : "Otros")
        } : null
      }
    }));
  }

  function setState(next, label) {
    state = next;
    const labels = {
      idle: "Parado", connecting: "Conectando…", buffering: "Cargando…",
      retrying: "Reconectando…", live: "En directo",
      paused: "Pausado", error: "Sin señal"
    };
    const st = $("#nowState");
    st.textContent = label || labels[next];
    st.dataset.kind = next;
    $(".player").dataset.playing = String(next === "live" && !audio.paused);
    const busy = ["live", "connecting", "buffering", "retrying"].includes(next);
    $("#playIco").setAttribute("href", busy ? "#i-stop" : "#i-play");
    $("#play").setAttribute("aria-label", busy ? "Detener" : "Reproducir");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = next === "live" && !audio.paused ? "playing" : "paused";
    }
    syncList();
    publishPlayback();
  }

  function teardown() {
    clearPlaybackTimers();
    attempt++;
    audio.onerror = null; // disconnect callbacks from the previous media source
    if (hls) {
      const previous = hls;
      hls = null;
      previous.destroy();
    }
    // A teardown-induced pause must never cancel the pending retry.
    internalPause = true;
    try { audio.pause(); } finally { internalPause = false; }
    audio.removeAttribute("src");
    audio.load();
    needsGesture = false;
  }

  function select(station) {
    current = station;
    save(KEY.last, station.id);
    $("#play").disabled = false;
    $("#nowName").textContent = station.name;
    const playerArt = $("#nowArt");
    playerArt.replaceChildren(stationArtwork(station, true));
    playerArt.hidden = false;
  }

  function scheduleRetry() {
    if (!wantsPlayback || !current || state === "retrying") return;
    // A long uninterrupted session counts as a successful recovery. Brief
    // success followed by a new failure still consumes the retry budget.
    if (lastPlayingAt && Date.now() - lastPlayingAt >= STABLE_PLAY_MS) retryCount = 0;

    if (retryCount >= RETRY_DELAYS_MS.length) {
      wantsPlayback = false;
      teardown();
      setState("error", "Sin señal. Pulsa Reproducir.");
      return;
    }
    const delay = RETRY_DELAYS_MS[retryCount++];
    const station = current;
    state = "retrying"; // ignore pause events caused by disposing the old stream
    teardown();
    if (navigator.onLine === false) {
      setState("retrying", "Sin Internet · esperando conexión");
      return; // the online event will retry immediately
    }
    const seconds = Math.round(delay / 1000);
    setState("retrying", "Reconectando " + retryCount + "/" + RETRY_DELAYS_MS.length + " · " + seconds + " s");
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      if (!wantsPlayback || state !== "retrying" || current !== station) return;
      connect(station, station.cors !== "no-cors", true, true);
    }, delay);
  }

  /* anonymous = CORS mode without credentials. Kiss FM uses ordinary media mode. */
  function connect(station, anonymous = station.cors !== "no-cors", allowContinuous = true, recovering = false) {
    if (!recovering) { retryCount = 0; lastPlayingAt = 0; }
    wantsPlayback = true;
    state = "connecting"; // do not misinterpret teardown as a user pause
    teardown();
    const me = attempt;
    select(station);

    if (navigator.onLine === false) {
      scheduleRetry();
      return;
    }
    setState("connecting", recovering ? "Reconectando… (" + retryCount + "/" + RETRY_DELAYS_MS.length + ")" : null);

    // Prefer a continuous MP3/AAC alternative when native HLS is unavailable.
    const nativeHls = !!audio.canPlayType("application/vnd.apple.mpegurl");
    const originalHls = station.type === "hls" || /\.m3u8(\?|$)/i.test(station.url);
    const useContinuous = allowContinuous && originalHls && !nativeHls
      && typeof station.backgroundUrl === "string" && isHttpUrl(station.backgroundUrl)
      && !/\.m3u8(\?|$)/i.test(station.backgroundUrl);
    const streamUrl = useContinuous ? station.backgroundUrl : station.url;
    const isHls = originalHls && !useContinuous;

    const fail = () => {
      if (me !== attempt || !wantsPlayback || state === "paused") return;
      // Try the broadcaster's original format before consuming a retry.
      if (useContinuous) { connect(station, anonymous, false, true); return; }
      // User-added streams may lack CORS; preserve their existing fallback.
      if (anonymous && isCustom(station) && !isHls) { connect(station, false, false, true); return; }
      scheduleRetry();
    };
    const startPlayback = () => {
      if (me !== attempt || !wantsPlayback || state === "paused") return;
      audio.play().catch((err) => {
        if (me !== attempt || !wantsPlayback || (err && err.name === "AbortError")) return;
        if (err && err.name === "NotAllowedError") {
          // Never retry autoplay failures without a fresh user interaction.
          wantsPlayback = false;
          clearPlaybackTimers();
          needsGesture = true;
          setState("paused", "Pulsa Reproducir otra vez");
          return;
        }
        fail();
      });
    };

    if (anonymous) audio.crossOrigin = "anonymous"; else audio.removeAttribute("crossorigin");

    // Register lock-screen metadata before calling play().
    if ("mediaSession" in navigator && window.MediaMetadata) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: station.name, artist: "En directo", album: "OndaLibre",
          artwork: [192, 512].map((n) => ({
            src: new URL("assets/icon-" + n + ".png", document.baseURI).href,
            sizes: n + "x" + n, type: "image/png"
          }))
        });
      } catch { /* unsupported metadata should not block playback */ }
    }

    audio.onerror = fail;
    timer = setTimeout(fail, 20000);
    if (isHls && !nativeHls && window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls();
      hls.on(window.Hls.Events.ERROR, (_evt, data) => { if (data && data.fatal) fail(); });
      hls.on(window.Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.attachMedia(audio);
      hls.loadSource(streamUrl);
    } else {
      audio.src = streamUrl;
      startPlayback();
    }
  }

  function stop() {
    wantsPlayback = false;
    retryCount = 0;
    lastPlayingAt = 0;
    teardown();
    setState("idle");
  }

  // Preserve audio/HLS when the OS or headset pauses; never auto-unpause calls.
  function pausePlayback() {
    if (!current || !["live", "connecting", "buffering", "retrying"].includes(state)) return;
    wantsPlayback = false;
    clearPlaybackTimers();
    audio.pause();
    setState("paused");
  }

  function resume() {
    if (!current || (state === "live" && !audio.paused)) return;
    if (state === "connecting" && !audio.paused) return;
    // A deliberate Play after exhausted retries starts a fresh budget.
    if (state === "retrying" || state === "error" || state === "idle") {
      connect(current);
      return;
    }
    const canResume = (state === "paused" || needsGesture)
      && (hls || audio.currentSrc || audio.getAttribute("src"));
    if (!canResume) { connect(current); return; }

    wantsPlayback = true;
    needsGesture = false;
    const me = attempt;
    clearPlaybackTimers();
    setState("connecting", "Reanudando…");
    timer = setTimeout(() => {
      if (me === attempt && wantsPlayback && state === "connecting") scheduleRetry();
    }, 20000);
    audio.play().catch((err) => {
      if (me !== attempt || !wantsPlayback || (err && err.name === "AbortError")) return;
      if (err && err.name === "NotAllowedError") {
        wantsPlayback = false;
        clearPlaybackTimers();
        needsGesture = true;
        setState("paused", "Pulsa Reproducir otra vez");
      } else {
        scheduleRetry();
      }
    });
  }

  function toggle() {
    if (!current) return;
    if (["live", "connecting", "buffering", "retrying"].includes(state)) stop();
    else resume();
  }

  function step(dir) {
    const list = visible().length ? visible() : all();
    const i = current ? list.findIndex((s) => s.id === current.id) : -1;
    connect(list[(i + dir + list.length) % list.length]);
  }

  function bufferWatchdog() {
    if (!wantsPlayback || !["live", "buffering"].includes(state)) return;
    // Repeated "waiting" events must not postpone an existing deadline.
    if (state === "buffering" && stallTimer) return;
    setState("buffering", "Cargando…");
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      stallTimer = 0;
      if (wantsPlayback && state === "buffering") scheduleRetry();
    }, BUFFER_TIMEOUT_MS);
  }

  audio.addEventListener("playing", () => {
    if (!wantsPlayback || audio.paused) return;
    clearTimeout(timer); timer = 0;
    clearTimeout(stallTimer); stallTimer = 0;
    lastPlayingAt = Date.now();
    setState("live");
  });
  audio.addEventListener("waiting", bufferWatchdog);
  audio.addEventListener("stalled", bufferWatchdog);
  audio.addEventListener("ended", () => {
    if (wantsPlayback && ["live", "buffering"].includes(state)) scheduleRetry();
  });
  audio.addEventListener("pause", () => {
    if (!internalPause && state === "live" && audio.paused) {
      wantsPlayback = false;
      clearPlaybackTimers();
      setState("paused");
    }
  });

  window.addEventListener("offline", () => {
    if (!wantsPlayback || !current) return;
    if (state === "retrying") {
      clearTimeout(retryTimer); retryTimer = 0;
      setState("retrying", "Sin Internet · esperando conexión");
    } else if (["live", "buffering", "connecting"].includes(state)) {
      scheduleRetry();
    }
  });
  window.addEventListener("online", () => {
    if (wantsPlayback && current && state === "retrying") {
      clearTimeout(retryTimer); retryTimer = 0;
      connect(current, current.cors !== "no-cors", true, true);
    }
  });

  if ("mediaSession" in navigator) {
    const on = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch { /* unsupported */ } };
    on("play", resume);
    on("pause", pausePlayback);
    on("stop", stop);
    on("previoustrack", () => step(-1));
    on("nexttrack", () => step(1));
  }

  /* ---------- events ---------- */
  $("#list").addEventListener("click", (e) => {
    const li = e.target.closest(".st");
    if (!li) return;
    const s = all().find((x) => x.id === li.dataset.id);
    if (!s) return;

    if (e.target.closest(".st-fav")) {
      favs.has(s.id) ? favs.delete(s.id) : favs.add(s.id);
      save(KEY.favs, [...favs]);
      if (onlyFavs) renderList();
      else e.target.closest(".st-fav").setAttribute("aria-pressed", String(favs.has(s.id)));
    } else if (e.target.closest(".st-del")) {
      if (current && current.id === s.id) {
        stop(); current = null; $("#play").disabled = true;
        $("#nowName").textContent = "Elige una emisora";
        $("#nowArt").replaceChildren(); $("#nowArt").hidden = true;
      }
      custom = custom.filter((x) => x.id !== s.id);
      favs.delete(s.id);
      save(KEY.custom, custom); save(KEY.favs, [...favs]);
      renderChips(); renderList();
    } else if (e.target.closest(".st-main")) {
      if (current && current.id === s.id) toggle(); else connect(s);
    }
  });

  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tag]");
    if (!b) return;
    tag = b.dataset.tag;
    document.querySelectorAll("#chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderList();
  });
  $("#q").addEventListener("input", (e) => { query = e.target.value; renderList(); });
  $("#btnFav").addEventListener("click", (e) => {
    onlyFavs = !onlyFavs;
    e.currentTarget.setAttribute("aria-pressed", String(onlyFavs));
    renderList();
  });

  $("#play").addEventListener("click", toggle);
  $("#prev").addEventListener("click", () => step(-1));
  $("#next").addEventListener("click", () => step(1));

  const vol = $("#vol");
  const volValue = $("#volValue");
  vol.value = Math.min(100, Math.max(0, Number(load(KEY.vol, 80)) || 0));
  const syncVolume = () => {
    const amount = Math.max(0, Math.min(100, Math.round(Number(audio.volume) * 100)));
    const percentage = (audio.muted ? 0 : amount) + "%";
    vol.value = String(amount);
    volValue.textContent = percentage;
    vol.setAttribute("aria-valuetext", percentage);
  };
  audio.volume = vol.value / 100;
  vol.addEventListener("input", () => {
    audio.muted = false;
    audio.volume = Number(vol.value) / 100;
    save(KEY.vol, Number(vol.value));
    syncVolume();
  });
  audio.addEventListener("volumechange", syncVolume);
  syncVolume();

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || $("#dlg").open) return;
    const t = e.target;
    if (t.closest("input, textarea, select, [contenteditable]")) return;
    if (e.code === "Space" && !t.closest("button, a")) { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  });

  /* ---------- add station ---------- */
  const dlg = $("#dlg"), frm = $("#frm"), fUrl = $("#fUrl"), fName = $("#fName");
  $("#btnAdd").addEventListener("click", () => { frm.reset(); fUrl.setCustomValidity(""); dlg.showModal(); });
  fUrl.addEventListener("input", () => fUrl.setCustomValidity(""));
  frm.addEventListener("submit", (e) => {
    if (!e.submitter || e.submitter.value !== "ok") return;      // cancelled
    const name = fName.value.trim(), url = fUrl.value.trim();
    let problem = "";
    if (!isHttpUrl(url)) problem = "La dirección debe empezar por https:// o http://";
    else if (location.protocol === "https:" && url.startsWith("http://")) problem = "Los navegadores bloquean emisiones http:// en páginas https://. Busca una dirección https://";
    if (problem || !name) {
      e.preventDefault();
      fUrl.setCustomValidity(problem);
      frm.reportValidity();
      return;
    }
    const st = { id: "u" + Date.now().toString(36), name, url, desc: "Añadida por ti", tags: ["Mías"], genre: "Personalizadas",
      type: /\.m3u8(\?|$)/i.test(url) ? "hls" : "audio" };
    custom.push(st);
    save(KEY.custom, custom);
    renderChips(); renderList();
    connect(st);
  });

  /* ---------- boot ---------- */
  syncTheme();
  route();
  renderChips();
  renderList();
  const last = all().find((s) => s.id === load(KEY.last, null));
  if (last) { select(last); syncList(); }
})();
