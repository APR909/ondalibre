/* SPDX-License-Identifier: MIT — OndaLibre
 * Optional song data only from a broadcaster's public metadata feed.
 * Browsers cannot reliably read song names from cross-origin audio streams.
 */
(() => {
  "use strict";
  const title = document.getElementById("nowPlayingTitle");
  const detail = document.getElementById("nowPlayingDetail");
  const audio = document.getElementById("audio");
  if (!title || !detail || !audio) return;

  const musicGenres = new Set(["Pop", "Rock", "Clásica", "Clásicos", "Música",
    "Música en español", "Alternativa", "Flamenco", "Reguetón"]);
  let current = null, live = false, generation = 0, timer = 0, request = null;

  const clean = (s, fallback = "", max = 120) =>
    typeof s === "string" ? (s.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) || fallback) : fallback;

  function show(line, subline) {
    title.textContent = line;
    title.title = line;
    detail.textContent = subline;
    detail.title = subline;
  }

  function musical(st) {
    return musicGenres.has(st.genre) || (st.tags || []).includes("Música");
  }

  function summary(st) {
    if (musical(st)) return {
      title: st.genre === "Clásica" ? "Música clásica en directo" : "Música en directo",
      detail: (st.genre && st.genre !== "Otros" ? st.genre + " · " : "") + "Canción no disponible"
    };
    if (st.genre === "Noticias") return {
      title: "Noticias y programas", detail: "Información en directo"
    };
    return { title: "Programación en directo", detail: clean(st.desc, "Radio en directo") };
  }

  function stop() {
    clearTimeout(timer);
    timer = 0;
    if (request) { request.abort(); request = null; }
  }

  // AzuraCast uses now_playing.song.artist/title for public stations.
  // Never attribute a track to an unrelated station on the same server.
  function extractTrack(data, station) {
    const entries = Array.isArray(data) ? data : [data];
    const match = entries.find((item) =>
      item && item.station && station.id === "gozaderafm"
      && /gozadera/i.test(String(item.station.name || "") + " " + String(item.station.shortcode || "")));
    const song = match && match.now_playing && match.now_playing.song;
    if (!song) return null;
    const artist = clean(song.artist, "", 105);
    const songTitle = clean(song.title, "", 105);
    if (!artist || !songTitle
      || /^(unknown|desconocido|sin artista|gozadera fm)$/i.test(artist)
      || /^(unknown|gozadera fm|rotacion|rotación|indicativo|publicidad)$/i.test(songTitle)) return null;
    return { artist, songTitle };
  }

  async function refresh(station, seq) {
    if (!live || generation !== seq) return;
    let url;
    try {
      url = new URL(station.nowPlayingApi);
      if (url.protocol !== "https:" || url.username || url.password) return;
    } catch { return; }

    const controller = new AbortController();
    request = controller;
    let delay = 45000;
    try {
      const response = await fetch(url.href, {
        mode: "cors", credentials: "omit", cache: "no-store",
        referrerPolicy: "no-referrer", signal: controller.signal
      });
      if (!response.ok) throw new Error("Metadata unavailable");
      const song = extractTrack(await response.json(), station);
      if (generation !== seq || !live) return;
      const fallback = summary(station);
      if (song) show(song.songTitle, song.artist);
      else show(fallback.title, fallback.detail);
    } catch (error) {
      if (error && error.name === "AbortError") return;
      delay = 90000;
      if (generation === seq && live) {
        const fallback = summary(station);
        show(fallback.title, fallback.detail);
      }
    } finally {
      if (request === controller) request = null;
      if (generation === seq && live) timer = setTimeout(() => refresh(station, seq), delay);
    }
  }

  document.addEventListener("ondalibre:playback", (event) => {
    generation++;
    stop();
    const selected = event.detail && event.detail.station;
    if (!selected) {
      current = null; live = false;
      show("Selecciona una radio", "Información de la emisión");
      return;
    }

    current = (window.STATIONS || []).find((s) => s.id === selected.id) || selected;
    live = !!event.detail.playing && !audio.paused;
    const kind = document.getElementById("nowState")?.dataset.kind;

    if (!live) {
      if (kind === "paused") show("Emisión en pausa", current.name);
      else if (kind === "connecting") show("Conectando con la radio…", current.name);
      else if (kind === "error") show("No hay señal", "Comprueba la emisión");
      else if (kind === "live") show("Recuperando el audio…", current.name);
      else show("Emisión detenida", current.name);
      return;
    }

    const info = summary(current);
    show(info.title, info.detail);
    if (musical(current) && typeof current.nowPlayingApi === "string") {
      refresh(current, generation);
    }
  });

  // The main player may restore the last station before this module loads.
  const lastName = document.getElementById("nowName")?.textContent;
  if (lastName && lastName !== "Elige una emisora") {
    show("Emisión detenida", lastName);
  }
})();
