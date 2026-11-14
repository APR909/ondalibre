/* SPDX-License-Identifier: MIT — OndaLibre
 * Client-side live radio player. No backend or first-party cookies.
 * External streaming hosts are contacted only when a station is played.
 */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const root = document.documentElement;
  const audio = $("#audio");

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
  let state = "idle";        // idle | connecting | live | error
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
      const busy = isCur && (state === "live" || state === "connecting");
      li.classList.toggle("is-current", isCur);
      li.classList.toggle("is-live", live);
      li.querySelector(".st-main use").setAttribute("href", busy ? "#i-stop" : "#i-play");
      li.querySelector(".st-main").setAttribute("aria-label", `${busy ? "Detener" : "Reproducir"} ${s.name}`);
      li.querySelector(".st-tags").textContent = live ? "En directo" : (s.tags || []).join(" · ");
    });
  }

  /* ---------- player ---------- */
  // Listening statistics use media playback events, not button presses.
  // Genre is explicit for built-in stations; private stations are grouped as such.
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

  function setState(next, text) {
    state = next;
    const label = text || { idle: "Parado", connecting: "Conectando…", live: "En directo", error: "Sin señal" }[next];
    const st = $("#nowState");
    st.textContent = label;
    // Reflect real playback, not merely a user click or pending connection.
    $(".player").dataset.playing = String(next === "live" && !audio.paused);
    st.dataset.kind = next;
    const busy = next === "live" || next === "connecting";
    $("#playIco").setAttribute("href", busy ? "#i-stop" : "#i-play");
    $("#play").setAttribute("aria-label", busy ? "Detener" : "Reproducir");
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = busy ? "playing" : "paused";
    syncList();
    publishPlayback();
  }

  function teardown() {
    clearTimeout(timer);
    needsGesture = false;
    attempt++;
    if (hls) { hls.destroy(); hls = null; }
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  function select(station) {
    current = station;
    save(KEY.last, station.id);
    $("#play").disabled = false;
    $("#nowName").textContent = station.name;
  }

  /* anonymous = CORS mode without credentials: the stream server's cookies are neither sent nor stored. */
  // A few broadcasters (currently Kiss FM) use signed streaming redirects that
  // cannot be played in CORS mode. They use ordinary HTML audio without CORS.
  // This may allow the broadcaster to read/set its own third-party cookies.
  function connect(station, anonymous = station.cors !== "no-cors") {
    teardown();
    const me = attempt;
    select(station);
    setState("connecting");

    const fail = () => {
      if (me !== attempt) return;
      // Only for stations the listener added: retry once without CORS for servers that lack CORS headers.
      if (anonymous && isCustom(station) && !isHls) { connect(station, false); return; }
      teardown();
      setState("error", station.site ? "Sin señal. Prueba más tarde o en la web oficial." : "Sin señal. Revisa la dirección.");
    };

    const isHls = station.type === "hls" || /\.m3u8(\?|$)/i.test(station.url);
    const startPlayback = () => {
      if (me !== attempt) return;
      audio.play().catch((err) => {
        if (me !== attempt || (err && err.name === "AbortError")) return;
        if (err && err.name === "NotAllowedError") {
          // The HLS manifest is loaded asynchronously. Some browsers require
          // a fresh user gesture, so keep the media attached for the next tap.
          clearTimeout(timer);
          needsGesture = true;
          setState("idle", "Pulsa Reproducir otra vez");
          return;
        }
        fail();
      });
    };
    if (anonymous) audio.crossOrigin = "anonymous"; else audio.removeAttribute("crossorigin");

    // iPhone/iPad/Safari play HLS natively, which is lighter and keeps playing in the background.
    const nativeHls = /Apple/.test(navigator.vendor || "") && audio.canPlayType("application/vnd.apple.mpegurl");
    if (isHls && !nativeHls && window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls();
      hls.on(window.Hls.Events.ERROR, (_evt, data) => { if (data.fatal) fail(); });
      // Do not call play() before hls.js has attached a supported media source.
      hls.on(window.Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.attachMedia(audio);
      hls.loadSource(station.url);
    } else {
      audio.src = station.url;           // MP3/AAC everywhere; HLS natively on Safari
      startPlayback();
    }
    audio.onerror = fail;
    timer = setTimeout(fail, 20000);

    if ("mediaSession" in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: station.name, artist: "En directo", album: "OndaLibre",
        artwork: [192, 512].map((n) => ({ src: new URL(`assets/icon-${n}.png`, document.baseURI).href, sizes: `${n}x${n}`, type: "image/png" })) });
    }
  }

  function stop() { teardown(); setState("idle"); }
  function toggle() {
    if (!current) return;
    if (state === "live" || state === "connecting") { stop(); return; }
    if (needsGesture && hls) {
      needsGesture = false;
      setState("connecting");
      const me = attempt;
      audio.play().catch((err) => {
        if (me !== attempt || (err && err.name === "AbortError")) return;
        if (err && err.name === "NotAllowedError") {
          needsGesture = true;
          setState("idle", "Pulsa Reproducir otra vez");
        } else {
          teardown();
          setState("error", "Sin señal. Prueba más tarde.");
        }
      });
      timer = setTimeout(() => {
        if (me !== attempt || state !== "connecting") return;
        teardown();
        setState("error", "Sin señal. Prueba más tarde.");
      }, 20000);
      return;
    }
    connect(current);
  }
  function step(dir) {
    const list = visible().length ? visible() : all();
    const i = current ? list.findIndex((s) => s.id === current.id) : -1;
    connect(list[(i + dir + list.length) % list.length]);
  }

  audio.addEventListener("playing", () => { clearTimeout(timer); setState("live"); });
  audio.addEventListener("waiting", () => {
    if (state === "live") {
      $("#nowState").textContent = "Cargando…";
      $(".player").dataset.playing = "false";
      publishPlayback(false);
    }
  });
  audio.addEventListener("stalled", () => {
    $(".player").dataset.playing = "false";
    publishPlayback(false);
  });
  // Paused from outside (headphones unplugged, OS controls): a live stream cannot resume, so stop.
  audio.addEventListener("pause", () => { if (state === "live" && audio.paused) stop(); });

  if ("mediaSession" in navigator) {
    const on = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch { /* unsupported */ } };
    on("play", () => current && connect(current));
    on("pause", stop);
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
      if (current && current.id === s.id) { stop(); current = null; $("#play").disabled = true; $("#nowName").textContent = "Elige una emisora"; }
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
  vol.value = Math.min(100, Math.max(0, Number(load(KEY.vol, 80)) || 0));
  audio.volume = vol.value / 100;
  vol.addEventListener("input", () => { audio.volume = vol.value / 100; save(KEY.vol, Number(vol.value)); });

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
