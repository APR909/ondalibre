/* SPDX-License-Identifier: MIT — OndaLibre
 * Private, per-account listening history stored ONLY in this browser.
 * Google login is UI-only, not server-verified; these statistics must NEVER
 * be used for authorization, billing, or cross-device identity.
 * Listening time is approximate wall-clock time in the "playing" state.
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const audio = document.getElementById("audio");
  const radioList = document.getElementById("statsRadiosList");
  const genreList = document.getElementById("statsGenresList");
  const radioTotal = document.getElementById("statsRadiosTotal");
  const genreTotal = document.getElementById("statsGenresTotal");
  const STORAGE_PREFIX = "ondalibre.stats.v1.";
  const fmtPercent = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
  const safeText = (value, fallback, limit) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : fallback;
  let accountKey = null;
  let stations = Object.create(null); // { stationId: { name, genre, seconds } }
  let playback = null; // last observed station while audio is actually playing
  let since = performance.now();
  let dirty = false;

  function storageKey() { return accountKey ? STORAGE_PREFIX + accountKey : null; }

  function readHistory() {
    const result = Object.create(null);
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return result;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || typeof parsed.stations !== "object" || !parsed.stations) return result;
      for (const [id, entry] of Object.entries(parsed.stations).slice(0, 500)) {
        if (!entry || typeof entry !== "object" || !id || id.length > 100) continue;
        const seconds = Number(entry.seconds);
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 315360000) continue;
        Object.defineProperty(result, id, {
          value: {
            name: safeText(entry.name, "Emisora", 100),
            genre: safeText(entry.genre, "Otros", 60),
            seconds
          },
          writable: true, enumerable: true, configurable: true
        });
      }
    } catch { /* unavailable or corrupt storage: start empty */ }
    return result;
  }

  function persist() {
    if (!accountKey || !dirty) return;
    try {
      localStorage.setItem(storageKey(), JSON.stringify({ version: 1, stations }));
      dirty = false;
    } catch {
      // Continue showing the in-memory session; storage may be disabled/full.
      document.querySelectorAll(".stats-note").forEach((note) => {
        note.textContent = "No se pueden guardar las estadísticas en este navegador. Comprueba sus permisos o espacio.";
      });
    }
  }

  function countElapsed() {
    const now = performance.now();
    const elapsed = Math.max(0, (now - since) / 1000);
    since = now;
    if (!accountKey || !playback || elapsed === 0) return;
    // No analyser or audio capture. All data stays on the local device.
    const { id, name, genre } = playback;
    if (!stations[id] && Object.keys(stations).length >= 500) return;
    const row = stations[id] || { name, genre, seconds: 0 };
    row.name = name;
    row.genre = genre;
    row.seconds += elapsed;
    stations[id] = row;
    dirty = true;
  }

  function duration(seconds) {
    seconds = Math.max(0, Math.round(seconds));
    if (seconds < 60) return seconds + " s";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + " min";
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours + " h" + (remainder ? " " + remainder + " min" : "");
  }

  function totalSeconds() {
    return Object.values(stations).reduce((sum, x) => sum + x.seconds, 0);
  }

  function renderRanking(container, rows, total, emptyText) {
    container.replaceChildren();
    if (!rows.length || total < 1) {
      const li = document.createElement("li");
      li.className = "stats-empty";
      li.textContent = emptyText;
      container.append(li);
      return;
    }
    // Percentages are of ALL recorded listening time, not just the top 10.
    const best = rows.sort((a, b) => b.seconds - a.seconds).slice(0, 10);
    for (const { name, seconds } of best) {
      const percentage = Math.max(0, Math.min(100, seconds / total * 100));
      const li = document.createElement("li");
      li.className = "stats-item";

      const heading = document.createElement("div");
      heading.className = "stats-row";
      const label = document.createElement("span");
      label.className = "stats-label";
      label.textContent = name;
      const value = document.createElement("strong");
      value.className = "stats-percentage";
      value.textContent = fmtPercent.format(percentage) + " %";
      heading.append(label, value);

      const track = document.createElement("div");
      track.className = "stats-track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", name);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", percentage.toFixed(1));
      track.setAttribute("aria-valuetext", fmtPercent.format(percentage) + " por ciento de las escuchas");
      const fill = document.createElement("div");
      fill.className = "stats-fill";
      fill.style.width = percentage.toFixed(2) + "%";
      track.append(fill);

      const subtitle = document.createElement("small");
      subtitle.className = "stats-duration";
      subtitle.textContent = duration(seconds) + " de escucha";
      li.append(heading, track, subtitle);
      container.append(li);
    }
  }

  function render() {
    if (!accountKey) {
      radioList.replaceChildren();
      genreList.replaceChildren();
      radioTotal.textContent = "Inicia sesión para consultar tu actividad.";
      genreTotal.textContent = "Inicia sesión para consultar tu actividad.";
      return;
    }
    const rows = Object.values(stations);
    const total = totalSeconds();
    radioTotal.textContent = total >= 1 ? "Tiempo total escuchado: " + duration(total)
      : "Todavía no hay escuchas registradas.";
    genreTotal.textContent = radioTotal.textContent;
    renderRanking(radioList, rows.map((x) => ({ name: x.name, seconds: x.seconds })), total,
      "Empieza a reproducir una radio para ver aquí tus emisoras favoritas.");
    const groups = Object.create(null);
    for (const row of rows) {
      const genre = safeText(row.genre, "Otros", 60);
      groups[genre] = (groups[genre] || 0) + row.seconds;
    }
    renderRanking(genreList, Object.entries(groups).map(([name, seconds]) => ({ name, seconds })), total,
      "Escucha alguna emisora para conocer los géneros que más utilizas.");
  }

  // Player publishes both successful playback and buffering/pause/stop events.
  document.addEventListener("ondalibre:playback", (event) => {
    countElapsed();
    const detail = event.detail || {};
    const st = detail.station;
    playback = detail.playing && st && typeof st.id === "string" && st.id.length <= 100
      ? { id: st.id, name: safeText(st.name, "Emisora", 100),
          genre: safeText(st.genre, "Otros", 60) }
      : null;
    if (accountKey) { persist(); render(); }
  });

  // The login script sends a SHA-256 derivative of Google's "sub" claim.
  // No JWT, email, name, or un-hashed Google user ID is stored with history.
  document.addEventListener("ondalibre:auth", (event) => {
    countElapsed();
    persist();
    const incoming = event.detail && event.detail.accountKey;
    accountKey = typeof incoming === "string" && /^[a-f0-9]{64}$/.test(incoming) ? incoming : null;
    stations = accountKey ? readHistory() : Object.create(null);
    dirty = false;
    since = performance.now();
    root.dataset.authenticated = accountKey ? "true" : "false";
    document.querySelectorAll("[data-account-only]").forEach((link) => {
      link.hidden = !accountKey;
    });
    if (!accountKey && /^#stats-(radios|genres)$/.test(location.hash)) {
      location.hash = "#";
    }
    window.dispatchEvent(new Event("hashchange"));
    render();
  });

  // No statistics are recorded for visitors who have not signed in.
  setInterval(() => {
    countElapsed();
    persist();
    if (accountKey && /^#stats-(radios|genres)$/.test(location.hash)) render();
  }, 5000);

  window.addEventListener("pagehide", () => { countElapsed(); persist(); });
  document.querySelectorAll("[data-clear-stats]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!accountKey) return;
      if (!window.confirm("¿Borrar todas las estadísticas de escucha de esta cuenta en este navegador?")) return;
      // Flush previous listening then clear. If audio is playing, new counts
      // start immediately after the reset.
      try { localStorage.removeItem(storageKey()); } catch { /* unavailable */ }
      stations = Object.create(null);
      dirty = false;
      since = performance.now();
      render();
    });
  });

  render();
})();
