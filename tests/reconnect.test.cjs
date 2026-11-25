/* SPDX-License-Identifier: MIT — OndaLibre
 * Run from repository root: node tests/reconnect.test.cjs
 * Zero dependencies; executes the real app.js against a simulated browser.
 */
"use strict";
async function runReconnectTests(code) {
  const results = [];
  const assert = (ok, reason) => { if (!ok) throw Error(reason); };
  function browser(opts = {}) {
    let now = 1000000, nextId = 0, plays = 0, srcSets = 0;
    const timers = new Map(), elements = {}, listeners = {}, hlsInstances = [], signals = [];
    class Element {
      constructor(tag) {
        this.tag = tag; this.dataset = {}; this.attrs = {}; this.children = [];
        this.listeners = {}; this.style = {}; this.classList = { toggle() {} };
        this.paused = true; this.volume = .8; this.muted = false;
        this.value = "80"; this._src = ""; this.currentSrc = "";
      }
      set src(v) { this._src = v; this.currentSrc = v; this.attrs.src = v; srcSets++; }
      get src() { return this._src; }
      set crossOrigin(v) { this.attrs.crossorigin = v; }
      get crossOrigin() { return this.attrs.crossorigin || ""; }
      setAttribute(k, v) {
        this.attrs[k] = String(v);
        if (k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = String(v);
      }
      getAttribute(k) { return this.attrs[k] ?? null; }
      removeAttribute(k) {
        delete this.attrs[k];
        if (k === "src") { this._src = ""; this.currentSrc = ""; }
      }
      addEventListener(k, fn) { (this.listeners[k] ||= []).push(fn); }
      emit(k, data) {
        for (const fn of this.listeners[k] || []) fn(data);
        if (k === "error") this.onerror?.(data);
      }
      append(...xs) { this.children.push(...xs); }
      replaceChildren(...xs) { this.children = xs; }
      querySelector() { return new Element("nested"); }
      closest() { return null; }
      remove() {}
      load() {}
      canPlayType() { return opts.nativeHls ? "maybe" : ""; }
      pause() { const playing = !this.paused; this.paused = true; if (playing) this.emit("pause"); }
      play() {
        plays++;
        if (opts.denyOnce) { opts.denyOnce = false; return Promise.reject({ name: "NotAllowedError" }); }
        this.paused = false;
        return Promise.resolve();
      }
    }
    const $ = sel => elements[sel] ||= new Element(sel);
    const audio = $("#audio");
    class Hls {
      static Events = { ERROR: "error", MANIFEST_PARSED: "manifest" };
      static isSupported() { return true; }
      constructor() { this.handlers = {}; hlsInstances.push(this); }
      on(k, fn) { this.handlers[k] = fn; }
      attachMedia() {}
      loadSource(url) { this.src = url; }
      destroy() { this.destroyed = true; }
      manifest() { this.handlers.manifest(); }
      fatal() { this.handlers.error(null, { fatal: true }); }
    }
    const stations = [
      { id: "a", name: "A", type: "audio", url: "https://radio.test/a.mp3",
        tags: ["Música"], genre: "Pop", site: "https://radio.test/" },
      { id: "b", name: "B", type: "audio", url: "https://radio.test/b.mp3",
        tags: ["Música"], genre: "Rock", site: "https://radio.test/" },
      { id: "h", name: "HLS", type: "hls", url: "https://radio.test/h.m3u8",
        tags: ["Noticias"], genre: "Noticias", site: "https://radio.test/" },
      { id: "alt", name: "Alternative", type: "hls",
        url: "https://radio.test/alt.m3u8",
        backgroundUrl: "https://radio.test/alt.mp3",
        tags: ["Noticias"], genre: "Noticias", site: "https://radio.test/" }
    ];
    const document = {
      documentElement: { dataset: {}, getAttribute() { return null; }, setAttribute() {} },
      baseURI: "https://apr909.github.io/ondalibre/",
      querySelector: $,
      querySelectorAll: s => s === "#list .st" ? $("#list").children : [],
      createElement: name => new Element(name),
      createElementNS: (_ns, name) => new Element(name),
      addEventListener() {},
      dispatchEvent: ev => signals.push(ev)
    };
    const mediaSession = { actions: {}, playbackState: "none",
      setActionHandler(k, fn) { this.actions[k] = fn; } };
    const navigator = { onLine: true, vendor: "", audioSession: { type: "auto" }, mediaSession };
    const window = {
      Hls, STATIONS: stations, MediaMetadata: class {},
      addEventListener(k, fn) { (listeners[k] ||= []).push(fn); },
      scrollTo() {}
    };
    const storage = new Map();
    if (opts.custom) storage.set("ondalibre.custom", JSON.stringify(opts.custom));
    if (opts.corrupt) { storage.set("ondalibre.favs", "{}"); storage.set("ondalibre.custom", "{}"); }
    const localStorage = {
      getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v))
    };
    const URLMock = class {
      constructor(s, base) {
        this.href = s.startsWith("http") ? s : (base || "") + s;
        this.protocol = this.href.startsWith("https:") ? "https:" : "http:";
        this.username = ""; this.password = "";
      }
    };
    function setTimer(fn, ms) { const k = ++nextId; timers.set(k, { due: now + ms, fn }); return k; }
    const clearTimer = id => timers.delete(id);
    function tick(ms) {
      const target = now + ms;
      let count = 0;
      while (true) {
        const entry = [...timers].filter(([, v]) => v.due <= target)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!entry) break;
        if (++count > 100) throw Error("Infinite timer loop");
        timers.delete(entry[0]); now = entry[1].due; entry[1].fn();
      }
      now = target;
    }
    const fn = new Function("document", "window", "navigator", "localStorage",
      "matchMedia", "getComputedStyle", "location", "URL", "MediaMetadata",
      "CustomEvent", "Date", "setTimeout", "clearTimeout", code);
    fn(document, window, navigator, localStorage,
      () => ({ matches: false, addEventListener() {} }),
      () => ({ getPropertyValue: () => "#0b0717" }),
      { hash: "", protocol: "https:" }, URLMock, window.MediaMetadata,
      class { constructor(type, data) { this.type = type; this.detail = data.detail; } },
      { now: () => now }, setTimer, clearTimer);
    function choose(id, action = "st-main") {
      $("#list").listeners.click[0]({ target: { closest(s) {
        if (s === ".st") return { dataset: { id } };
        if (s === "." + action) return { setAttribute() {} };
        return null;
      } } });
    }
    return {
      audio, navigator, mediaSession, choose, tick, storage, signals,
      kind: () => $("#nowState").dataset.kind,
      status: () => $("#nowState").textContent,
      plays: () => plays, sources: () => srcSets,
      timers: () => timers.size, hls: () => hlsInstances.at(-1),
      hlsCount: () => hlsInstances.length,
      playButton: () => $("#play").emit("click"),
      network(online) {
        navigator.onLine = online;
        for (const cb of listeners[online ? "online" : "offline"] || []) cb();
      }
    };
  }

  async function check(name, fn) {
    try { await fn(); results.push({ name, passed: true }); }
    catch (err) { results.push({ name, passed: false, error: String(err.message || err) }); }
  }
  await check("Playback, favourites and volume still work", () => {
    const h = browser(); h.choose("a"); h.audio.emit("playing");
    assert(h.kind() === "live" && h.audio.volume === .8, "Player/volume regression");
    assert(h.signals.at(-1).detail.playing, "Listening stats event missing");
    h.choose("a", "st-fav");
    assert(JSON.parse(h.storage.get("ondalibre.favs")).includes("a"), "Favourite not stored");
  });
  await check("Two-second retry, then five-second retry", () => {
    const h = browser(); h.choose("a"); h.audio.emit("playing");
    const before = h.plays(); h.audio.emit("error");
    assert(h.kind() === "retrying", "Didn't schedule retry");
    assert(h.signals.at(-1).detail.playing === false, "Stats still marked playing");
    h.tick(1999); assert(h.plays() === before, "Retry too soon");
    h.tick(1); assert(h.plays() === before + 1, "Retry missing");
    h.audio.emit("playing"); h.audio.emit("error");
    h.tick(4999); assert(h.kind() === "retrying", "Five-second delay missing");
    h.tick(1); assert(h.kind() === "connecting", "Second retry missing");
  });
  await check("Five retries exhausted, manual play resets", () => {
    const h = browser(); h.choose("a"); h.audio.emit("playing");
    for (const delay of [2000, 5000, 10000, 20000, 30000]) {
      h.audio.emit("error"); assert(h.kind() === "retrying", "No retry");
      h.tick(delay); h.audio.emit("playing");
    }
    h.audio.emit("error");
    assert(h.kind() === "error" && !h.timers(), "Retry cap ignored");
    h.playButton(); assert(h.kind() === "connecting", "Manual restart failed");
  });
  await check("Offline waits; reconnects on online event", () => {
    const h = browser(); h.choose("a"); h.audio.emit("playing"); h.network(false);
    assert(h.kind() === "retrying" && h.timers() === 0, "Offline loop detected");
    h.tick(90000); h.network(true);
    assert(h.kind() === "connecting", "No immediate online recovery");
    h.audio.emit("playing"); assert(h.kind() === "live", "Recovery failed");
  });
  await check("Stop and station switch cancel stale retry timers", () => {
    const h = browser(); h.choose("a"); h.audio.emit("playing"); h.audio.emit("error");
    const count = h.plays(); h.playButton(); h.tick(100000);
    assert(h.kind() === "idle" && h.plays() === count, "Stop didn't cancel retry");
    h.choose("a"); h.audio.emit("playing"); h.audio.emit("error");
    h.choose("b"); h.audio.emit("playing"); h.tick(60000);
    assert(h.kind() === "live" && h.audio.currentSrc.endsWith("/b.mp3"), "Old station restarted");
  });
  await check("HLS fatal stream rebuilds after retry", () => {
    const h = browser(); h.choose("h"); h.hls().manifest(); h.audio.emit("playing");
    const old = h.hls(); old.fatal();
    assert(h.kind() === "retrying" && old.destroyed, "HLS not cleaned");
    h.tick(2000); assert(h.hlsCount() === 2, "HLS not rebuilt");
    h.hls().manifest(); h.audio.emit("playing");
    assert(h.kind() === "live", "HLS recovery failed");
  });
  await check("Buffering watchdog ignores transient waits", () => {
    const h = browser(); h.choose("a"); h.audio.emit("playing");
    h.audio.emit("waiting"); assert(h.kind() === "buffering", "Buffering not reflected");
    h.tick(14999); assert(h.kind() === "buffering", "Premature retry");
    h.audio.emit("playing"); h.tick(100);
    assert(h.kind() === "live", "Did not clear buffering");
    h.audio.emit("stalled"); h.tick(15000);
    assert(h.kind() === "retrying", "Long stall not recovered");
  });
  await check("Repeated waiting events cannot indefinitely defer watchdog", () => {
    const h = browser(); h.choose("a"); h.audio.emit("playing");
    h.audio.emit("waiting"); h.tick(7000);
    h.audio.emit("waiting"); h.audio.emit("stalled"); h.tick(7999);
    assert(h.kind() === "buffering", "Watchdog fired early");
    h.tick(1);
    assert(h.kind() === "retrying", "Repeated buffering events reset the deadline");
  });
  await check("Headset pause never auto-restarts; Play resumes", () => {
    const h = browser(); h.choose("a"); h.audio.emit("playing");
    const srcSets = h.sources(); h.mediaSession.actions.pause();
    assert(h.kind() === "paused", "Pause not retained");
    h.audio.emit("error"); h.tick(80000);
    assert(h.kind() === "paused", "Paused radio reconnected itself");
    h.mediaSession.actions.play(); h.audio.emit("playing");
    assert(h.kind() === "live" && h.sources() === srcSets, "Resume recreated stream");
  });
  await check("AAC/MP3 alternative falls back to original HLS", () => {
    const h = browser(); h.choose("alt");
    assert(h.audio.currentSrc.endsWith("alt.mp3"), "Preferred continuous feed missing");
    h.audio.emit("error");
    assert(h.hlsCount() === 1, "HLS fallback not used");
    h.hls().fatal();
    assert(h.kind() === "retrying", "HLS fallback did not schedule retry");
    h.tick(2000);
    assert(h.audio.currentSrc.endsWith("alt.mp3"), "Retry did not restore best source");
  });
  await check("Custom station CORS fallback and malformed preferences", () => {
    const corrupted = browser({ corrupt: true });
    corrupted.choose("a"); corrupted.audio.emit("playing");
    assert(corrupted.kind() === "live", "Malformed preferences crashed app");
    const h = browser({ custom: [{ id: "u1", name: "User station",
      url: "https://radio.test/custom.mp3", tags: ["Mías"] }] });
    h.choose("u1"); assert(h.audio.crossOrigin === "anonymous", "Initial CORS missing");
    h.audio.emit("error");
    assert(h.kind() === "connecting" && h.audio.crossOrigin === "", "CORS fallback missing");
    h.audio.emit("error");
    assert(h.kind() === "retrying", "Custom fallback did not retry");
  });
  await check("Autoplay-denied audio requires user gesture", async () => {
    const h = browser({ denyOnce: true }); h.choose("a");
    await Promise.resolve(); await Promise.resolve();
    assert(h.kind() === "paused" && h.timers() === 0, "Autoplay block caused retry");
    h.tick(80000); assert(h.kind() === "paused", "Retried while blocked");
    h.playButton(); h.audio.emit("playing");
    assert(h.kind() === "live", "Manual Play could not resume");
  });
  const failures = results.filter(t => !t.passed);
  if (failures.length) throw Error(failures.map(t => t.name + ": " + t.error).join("\n"));
  return results;
}
if (typeof module !== "undefined" && require.main === module) {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  runReconnectTests(source).then(tests => {
    for (const test of tests) console.log("PASS " + test.name);
    console.log(tests.length + " regression tests passed.");
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
