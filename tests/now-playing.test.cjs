/* SPDX-License-Identifier: MIT — OndaLibre
 * Run: node tests/now-playing.test.cjs — standalone browser simulation.
 */
"use strict";
async function runNowPlayingTests(source) {
  const results = [];
  const id = "11111111-2222-4333-8444-555555555555";
  const station = {
    id: "rockfm", name: "Rock FM", genre: "Rock", tags: ["Música"],
    site: "https://rockfm.fm/", url: "https://radio.test/stream.mp3",
    metadataSource: { type: "tuneping", query: "Rock FM", names: ["Rock FM"] }
  };
  const gozadera = { id: "gozaderafm", name: "Gozadera FM", genre: "Reguetón",
    tags: ["Música"], nowPlayingApi: "https://azura.abcorp.es/api/nowplaying" };
  const news = { id: "radio5", name: "Radio 5", genre: "Noticias", tags: ["Noticias"] };
  const items = [station, gozadera, news];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
  const stationRow = (override = {}) => ({
    id, name: "Rock FM", country: "ES", homepage: "https://rockfm.fm/",
    stream_url: "https://radio.test/stream.mp3", ...override
  });
  const songRow = (override = {}) => ({
    station: { id }, title: "Bohemian Rhapsody", artist: "Queen",
    confidence: "high", classification: "song",
    confirmed_at: new Date().toISOString(), ...override
  });
  function harness(handler) {
    let hidden = false, next = 0;
    const timers = new Map(), listeners = {}, requests = [];
    const elements = Object.fromEntries(
      ["nowPlayingTitle", "nowPlayingDetail", "audio", "nowState", "nowName"]
        .map(key => [key, { textContent: "", title: "", dataset: {}, paused: true }]));
    const document = {
      get hidden() { return hidden; },
      getElementById: key => elements[key] || null,
      addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }
    };
    class FakeAbortController {
      constructor() { this.signal = { aborted: false }; }
      abort() { this.signal.aborted = true; }
    }
    class FakeURL {
      constructor(value) {
        this.base = String(value); this.protocol = this.base.startsWith("https:") ? "https:" : "http:";
        this.hostname = (this.base.match(/^https?:\/\/([^/:?#]+)/) || ["",""])[1];
        this.username = ""; this.password = ""; this.parameters = {};
        this.searchParams = { set: (key, val) => { this.parameters[key] = String(val); } };
      }
      get href() {
        const query = Object.entries(this.parameters).map(([k,v]) =>
          encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
        return this.base + (query ? "?" + query : "");
      }
    }
    const fetchMock = (url, options) => {
      requests.push({ url: String(url), options });
      return handler(String(url), options);
    };
    const timer = (fn, ms) => {
      const key = ++next; timers.set(key, { fn, ms }); return key;
    };
    const clear = key => timers.delete(key);
    new Function("document", "window", "fetch", "URL", "AbortController",
      "setTimeout", "clearTimeout", source)(
      document, { STATIONS: items }, fetchMock, FakeURL, FakeAbortController, timer, clear);
    const emit = (type, detail) => {
      for (const fn of listeners[type] || []) fn({ detail });
    };
    const play = id => {
      elements.audio.paused = false;
      elements.nowState.dataset.kind = "live";
      emit("ondalibre:playback", { playing: true, station: items.find(s => s.id === id) });
    };
    const pause = (id, kind = "paused") => {
      elements.audio.paused = true;
      elements.nowState.dataset.kind = kind;
      emit("ondalibre:playback", { playing: false, station: items.find(s => s.id === id) });
    };
    return {
      elements, requests, timers, emit, play, pause,
      title: () => elements.nowPlayingTitle.textContent,
      detail: () => elements.nowPlayingDetail.textContent,
      setHidden(value) { hidden = value; emit("visibilitychange"); },
      async nextPoll() {
        const first = timers.entries().next().value;
        if (!first) return;
        timers.delete(first[0]); first[1].fn(); await flush();
      }
    };
  }
  async function check(name, fn) {
    try { await fn(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: String(error.message || error) }); }
  }
  await check("News station uses only generic metadata, no requests", async () => {
    const h = harness(async () => { throw Error("Should not request"); });
    h.play("radio5"); await flush();
    assert(h.title() === "Noticias y programas" && h.requests.length === 0, "News changed");
  });
  await check("Spanish station discovery uses exact match and live song", async () => {
    const h = harness(async url => ({
      ok: true, json: async () => url.includes("?")
        ? { data: [stationRow()] } : { data: songRow() }
    }));
    h.play("rockfm"); await flush();
    assert(h.title() === "Bohemian Rhapsody" && h.detail() === "Queen", "Track not displayed");
    assert(h.requests.length === 2, "No two-step discovery");
    assert(h.requests[0].url.includes("country=ES") && h.requests[0].url.includes("q=Rock%20FM"),
      "Lookup not country-scoped");
    assert(h.requests.every(r => r.options.credentials === "omit"
      && r.options.referrerPolicy === "no-referrer"), "Third-party request privacy");
  });
  await check("Similar or wrong-country stations are never used", async () => {
    const h = harness(async () => ({
      ok: true, json: async () => ({ data: [
        stationRow({ name: "Rock FM Madrid 99.3" }),
        stationRow({ country: "PT" })] })
    }));
    h.play("rockfm"); await flush();
    assert(h.title() === "Música en directo" && h.requests.length === 1, "False identity match");
  });
  await check("Ambiguous relays with no official identity match are ignored", async () => {
    const h = harness(async () => ({
      ok: true, json: async () => ({ data: [
        stationRow({ homepage: "https://x.example", stream_url: "https://x.example/1" }),
        stationRow({ id: "22222222-3333-4444-8555-666666666666",
          homepage: "https://y.example", stream_url: "https://y.example/2" })] })
    }));
    h.play("rockfm"); await flush();
    assert(h.requests.length === 1 && h.title() === "Música en directo", "Ambiguous identity accepted");
  });
  await check("Ads, stale songs and wrong station ID show fallback", async () => {
    for (const row of [songRow({ classification: "ad_break" }),
      songRow({ confidence: "low" }),
      songRow({ confirmed_at: "2020-01-01T00:00:00Z" }),
      songRow({ station: { id: "99999999-8888-4777-8666-555555555555" } })]) {
      const h = harness(async url => ({
        ok: true, json: async () => url.includes("?") ? { data: [stationRow()] } : { data: row }
      }));
      h.play("rockfm"); await flush();
      assert(h.title() === "Música en directo", "Invalid track shown");
    }
  });
  await check("Pause stops polling, and a second play caches station identity", async () => {
    const h = harness(async url => ({
      ok: true, json: async () => url.includes("?") ? { data: [stationRow()] } : { data: songRow() }
    }));
    h.play("rockfm"); await flush();
    h.pause("rockfm");
    assert(h.timers.size === 0 && h.title() === "Emisión en pausa", "Pause didn't stop metadata");
    h.play("rockfm"); await flush();
    assert(h.requests.length === 3, "Station identity not cached");
  });
  await check("Switching to news ignores delayed response from previous station", async () => {
    let deliver;
    const h = harness(url => url.includes("?")
      ? new Promise(resolve => { deliver = resolve; })
      : Promise.resolve({ ok: true, json: async () => ({ data: songRow() }) }));
    h.play("rockfm"); await flush();
    h.play("radio5");
    deliver({ ok: true, json: async () => ({ data: [stationRow()] }) });
    await flush();
    assert(h.title() === "Noticias y programas" && h.requests.length === 1, "Stale metadata applied");
  });
  await check("Visibilitychange suspends metadata and resumes on return", async () => {
    const h = harness(async url => ({
      ok: true, json: async () => url.includes("?") ? { data: [stationRow()] } : { data: songRow() }
    }));
    h.play("rockfm"); await flush();
    h.setHidden(true);
    assert(h.timers.size === 0, "Background metadata poll left running");
    h.setHidden(false); await flush();
    assert(h.requests.length === 3 && h.title() === "Bohemian Rhapsody", "Visible update missing");
  });
  await check("Provider failure displays fallback with three-minute retry delay", async () => {
    const h = harness(async () => { throw Error("Network / CORS"); });
    h.play("rockfm"); await flush();
    assert(h.title() === "Música en directo", "No fallback");
    assert([...h.timers.values()][0]?.ms === 180000, "Aggressive retry on error");
  });
  await check("Gozadera AzuraCast source remains working and station-isolated", async () => {
    const h = harness(async () => ({ ok: true, json: async () => [
      { station: { name: "Another station" }, now_playing: { song: { artist: "X", title: "Wrong" } } },
      { station: { name: "Gozadera FM" }, now_playing: { song: { artist: "Bad Bunny", title: "NUEVAYoL" } } }
    ] }));
    h.play("gozaderafm"); await flush();
    assert(h.title() === "NUEVAYoL" && h.detail() === "Bad Bunny", "AzuraCast regression");
    assert(h.requests.length === 1, "Unexpected requests");
  });
  await check("Reconnect, buffering, stop labels remain working", async () => {
    const h = harness(async () => { throw Error("Should not fetch"); });
    h.pause("rockfm", "retrying");
    assert(h.title().includes("Reconectando"), "Reconnect label missing");
    h.pause("rockfm", "buffering");
    assert(h.title().includes("Recuperando"), "Buffer label missing");
    h.emit("ondalibre:playback", { station: null, playing: false });
    assert(h.title() === "Selecciona una radio", "Stop label missing");
  });
  const bad = results.filter(r => !r.pass);
  if (bad.length) throw Error(bad.map(r => r.name + ": " + r.error).join("\n"));
  return results;
}
if (typeof module !== "undefined" && require.main === module) {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "..", "now-playing.js"), "utf8");
  runNowPlayingTests(source).then(tests => {
    for (const test of tests) console.log("PASS " + test.name);
    console.log(tests.length + " now-playing tests passed.");
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
