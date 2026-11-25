/* SPDX-License-Identifier: MIT — OndaLibre
 * "Ahora suena" reads optional public station metadata; never analyses audio,
 * invents song titles, or sends listening history / Google data to providers.
 * The station directory explicitly opts into a supported provider.
 */
(() => {
  "use strict";

  const titleEl = document.getElementById("nowPlayingTitle");
  const detailEl = document.getElementById("nowPlayingDetail");
  const audio = document.getElementById("audio");
  if (!titleEl || !detailEl || !audio) return;

  const musicGenres = new Set(["Pop", "Rock", "Clásica", "Clásicos",
    "Música", "Música en español", "Alternativa", "Flamenco", "Reguetón"]);
  const SUCCESS_INTERVAL_MS = 60000;
  const FAILURE_INTERVAL_MS = 180000;
  const REQUEST_TIMEOUT_MS = 8000;
  const MAX_AGE_MS = 180000;
  const TUNEPING_BASE = "https://api.tuneping.com/v1";
  const discoveryCache = new Map(); // in memory only; no account identifiers
  let selected = null;
  let live = false;
  let revision = 0;
  let timer = 0;
  let activeRequest = null;
  let abortTimeout = 0;

  function clean(value, fallback = "", length = 120) {
    return typeof value === "string"
      ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, length) || fallback
      : fallback;
  }

  function show(line, subline, provider = "") {
    titleEl.textContent = line;
    titleEl.title = line;
    detailEl.textContent = subline;
    detailEl.title = provider ? subline + " · Datos: " + provider : subline;
  }

  function musical(station) {
    return musicGenres.has(station.genre)
      || (Array.isArray(station.tags) && station.tags.includes("Música"));
  }

  function summary(station) {
    if (musical(station)) return {
      title: station.genre === "Clásica" ? "Música clásica en directo" : "Música en directo",
      detail: (station.genre && station.genre !== "Otros" ? station.genre + " · " : "")
        + "Canción no disponible"
    };
    if (station.genre === "Noticias") return {
      title: "Noticias y programas", detail: "Información en directo"
    };
    return { title: "Programación en directo",
      detail: clean(station.desc, "Radio en directo", 100) };
  }

  function fallback(station) {
    const info = summary(station);
    show(info.title, info.detail);
  }

  function cancelRequest() {
    clearTimeout(timer);
    clearTimeout(abortTimeout);
    timer = 0;
    abortTimeout = 0;
    if (activeRequest) {
      activeRequest.abort();
      activeRequest = null;
    }
  }

  function relevant(station, seq) {
    return live && selected && selected.id === station.id
      && revision === seq && !audio.paused;
  }

  function validSong(artist, songTitle) {
    const a = clean(artist, "", 105);
    const t = clean(songTitle, "", 105);
    if (!a || !t) return null;
    const junk = /^(?:unknown|desconocido|sin artista|sin t[ií]tulo|publicidad|indicativo|rotaci[oó]n|en directo|live|on air|gozadera fm)$/i;
    if (junk.test(a) || junk.test(t) || /^https?:\/\//i.test(t)) return null;
    return { artist: a, title: t };
  }

  // The AzuraCast server may host many radios: never take the first song.
  function extractAzuraCast(payload, station) {
    const entries = Array.isArray(payload) ? payload : [payload];
    const entry = entries.find(item => item && item.station &&
      station.id === "gozaderafm" &&
      /gozadera/i.test(String(item.station.name || "") + " " + String(item.station.shortcode || "")));
    const song = entry && entry.now_playing && entry.now_playing.song;
    return song ? validSong(song.artist, song.title) : null;
  }

  // A radio's directory name alone is not enough to select a fuzzy match.
  // Require exact canonical name, country and unambiguous broadcaster identity.
  function normalized(value) {
    return clean(value, "", 160).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/\((?:espana|spain)\)$/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  function hostname(value) {
    try {
      const url = new URL(value);
      return url.hostname.toLowerCase().replace(/^www\./, "");
    } catch { return ""; }
  }

  function validStationMatch(candidate, source) {
    if (!candidate || candidate.country !== "ES" || typeof candidate.id !== "string") return false;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate.id)) return false;
    return Array.isArray(source.names) && source.names.some(name =>
      normalized(candidate.name) === normalized(name));
  }

  function findProviderId(payload, station) {
    const source = station.metadataSource;
    if (!source || !Array.isArray(payload && payload.data)) return null;
    const matches = payload.data.filter(item => validStationMatch(item, source));
    if (!matches.length) return null;
    if (matches.length === 1) return matches[0].id;

    // Prefer the same actual stream, or a unique official broadcaster homepage.
    const stationUrls = [station.url, station.backgroundUrl].filter(Boolean);
    const streamMatches = matches.filter(item => stationUrls.some(url =>
      String(item.stream_url || "").split("?")[0] === url.split("?")[0]));
    if (streamMatches.length === 1) return streamMatches[0].id;
    const siteHost = hostname(station.site);
    const homepageMatches = matches.filter(item => hostname(item.homepage) === siteHost);
    if (homepageMatches.length === 1) return homepageMatches[0].id;
    // Ambiguous regional relays are not silently attributed to the national feed.
    return null;
  }

  function extractTuneping(payload, providerId) {
    const row = payload && (payload.data || payload);
    if (!row || Array.isArray(row) || row.is_stale === true ||
        row.classification !== "song" ||
        (row.station && row.station.id !== providerId)) return null;
    if (row.confidence === "low") return null;
    const stamp = Date.parse(row.confirmed_at || row.observed_at || "");
    if (!Number.isFinite(stamp) || stamp > Date.now() + 60000
      || Date.now() - stamp > MAX_AGE_MS) return null;
    return validSong(row.artist, row.title);
  }

  async function requestJson(url, seq) {
    if (revision !== seq) throw new Error("Stale request");
    const controller = new AbortController();
    activeRequest = controller;
    abortTimeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        mode: "cors", credentials: "omit", cache: "no-store",
        referrerPolicy: "no-referrer", signal: controller.signal
      });
      if (!response.ok) throw new Error("Metadata API unavailable: " + response.status);
      return await response.json();
    } finally {
      clearTimeout(abortTimeout);
      abortTimeout = 0;
      if (activeRequest === controller) activeRequest = null;
    }
  }

  async function tunePingTrack(station, seq) {
    const source = station.metadataSource;
    if (!source || source.type !== "tuneping" ||
        typeof source.query !== "string" || source.query.length > 80) return null;

    let id = discoveryCache.get(station.id) || null;
    if (!id) {
      const url = new URL(TUNEPING_BASE + "/stations");
      url.searchParams.set("q", source.query);
      url.searchParams.set("country", "ES");
      url.searchParams.set("has_now_playing", "true");
      url.searchParams.set("limit", "50");
      const directory = await requestJson(url.href, seq);
      if (!relevant(station, seq)) return null;
      id = findProviderId(directory, station);
      if (!id) return null;
      discoveryCache.set(station.id, id);
    }

    const data = await requestJson(TUNEPING_BASE + "/stations/" + id + "/now-playing", seq);
    return relevant(station, seq) ? extractTuneping(data, id) : null;
  }

  async function broadcasterTrack(station, seq) {
    let endpoint;
    try {
      endpoint = new URL(station.nowPlayingApi);
      if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) return null;
    } catch { return null; }
    const data = await requestJson(endpoint.href, seq);
    return relevant(station, seq) ? extractAzuraCast(data, station) : null;
  }

  function schedule(station, seq, delay) {
    if (relevant(station, seq) && !document.hidden) {
      timer = setTimeout(() => refresh(station, seq), delay);
    }
  }

  async function refresh(station, seq) {
    if (!relevant(station, seq) || document.hidden) return;
    let delay = SUCCESS_INTERVAL_MS;
    try {
      const track = station.nowPlayingApi
        ? await broadcasterTrack(station, seq)
        : await tunePingTrack(station, seq);
      if (!relevant(station, seq)) return;
      if (track) {
        show(track.title, track.artist,
          station.nowPlayingApi ? "Emisora" : "Tuneping");
      } else fallback(station);
    } catch (error) {
      if (!relevant(station, seq)) return;
      delay = FAILURE_INTERVAL_MS;
      fallback(station);
    } finally {
      schedule(station, seq, delay);
    }
  }

  function shouldFetch(station) {
    return musical(station) &&
      (typeof station.nowPlayingApi === "string" ||
       (station.metadataSource && station.metadataSource.type === "tuneping"));
  }

  function startIfPossible() {
    if (selected && live && shouldFetch(selected) && !document.hidden) {
      refresh(selected, revision);
    }
  }

  document.addEventListener("ondalibre:playback", event => {
    revision++;
    cancelRequest();
    const station = event.detail && event.detail.station;
    if (!station) {
      selected = null; live = false;
      show("Selecciona una radio", "Información de la emisión");
      return;
    }

    selected = (window.STATIONS || []).find(item => item.id === station.id) || station;
    live = !!event.detail.playing && !audio.paused;
    const kind = document.getElementById("nowState")?.dataset.kind;
    if (!live) {
      if (kind === "paused") show("Emisión en pausa", selected.name);
      else if (kind === "retrying") show("Reconectando con la radio…", selected.name);
      else if (kind === "buffering") show("Recuperando la emisión…", selected.name);
      else if (kind === "connecting") show("Conectando con la radio…", selected.name);
      else if (kind === "error") show("No hay señal", "Comprueba la emisión");
      else if (kind === "live") show("Recuperando el audio…", selected.name);
      else show("Emisión detenida", selected.name);
      return;
    }
    fallback(selected);
    startIfPossible();
  });

  // Avoid extra cross-origin requests while the app is in the background.
  document.addEventListener("visibilitychange", () => {
    revision++;
    cancelRequest();
    if (selected && live && !document.hidden) {
      fallback(selected);
      startIfPossible();
    }
  });

  const lastName = document.getElementById("nowName")?.textContent;
  if (lastName && lastName !== "Elige una emisora") show("Emisión detenida", lastName);
})();
