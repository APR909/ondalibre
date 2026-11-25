/* SPDX-License-Identifier: MIT — OndaLibre
 * Run from repository root: node tests/personal-home.test.cjs
 * Tests the actual app.js in a dependency-free simulated browser.
 */
"use strict";
async function runPersonalHomeTests(source) {
  const results = [];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const stations = Array.from({ length: 10 }, (_, i) => ({
    id: "radio" + i, name: "Radio " + i, desc: "Radio de prueba",
    type: "audio", url: "https://radio.test/" + i + ".mp3",
    tags: ["Música"], genre: i % 2 ? "Rock" : "Pop",
    site: "https://radio.test/"
  }));
  function createHarness(initial = {}) {
    const data = new Map(Object.entries(initial));
    const elements = {}, events = [], windowEvents = {};
    let assignedSources = 0, plays = 0;
    class Element {
      constructor(tag) {
        this.tag = tag; this.children = []; this.listeners = {}; this.attrs = {};
        this.dataset = {}; this.style = {}; this.value = ""; this.hidden = false;
        this.disabled = false; this.paused = true; this.volume = .8;
        this.classList = { toggle() {} }; this.currentSrc = ""; this._src = "";
        this.textContent = "";
      }
      set src(value) {
        assignedSources++; this._src = value; this.currentSrc = value; this.attrs.src = value;
      }
      get src() { return this._src; }
      setAttribute(key, value) {
        this.attrs[key] = String(value);
        if (key.startsWith("data-"))
          this.dataset[key.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = String(value);
      }
      getAttribute(key) { return this.attrs[key] ?? null; }
      removeAttribute(key) {
        delete this.attrs[key];
        if (key === "src") { this._src = ""; this.currentSrc = ""; }
      }
      addEventListener(name, cb) { (this.listeners[name] ||= []).push(cb); }
      emit(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
      append(...children) { this.children.push(...children); }
      replaceChildren(...children) { this.children = children; }
      querySelector() { return new Element("matched"); }
      closest() { return null; }
      remove() {}
      load() {}
      pause() { this.paused = true; this.emit("pause"); }
      play() { plays++; this.paused = false; return Promise.resolve(); }
      canPlayType() { return ""; }
      scrollIntoView(options) { this.scrolled = options; }
      setCustomValidity() {}
    }
    const $ = selector => elements[selector] ||= new Element(selector);
    const audio = $("#audio");
    const doc = {
      documentElement: { dataset: {}, setAttribute() {}, getAttribute() { return null; } },
      baseURI: "https://apr909.github.io/ondalibre/",
      querySelector: $,
      querySelectorAll(sel) {
        if (sel === "#list .st") return $("#list").children.filter(el => el.attrs.class === "st");
        if (sel === "#personalHome [data-quick-play]")
          return [...$("#personalFavorites").children, ...$("#personalRecents").children]
            .filter(el => el.attrs["data-quick-play"]);
        return [];
      },
      createElement: tag => new Element(tag),
      createElementNS: (_ns, tag) => new Element(tag),
      addEventListener() {},
      dispatchEvent: e => events.push(e)
    };
    const mediaSession = {
      actions: {}, playbackState: "none", setActionHandler(name, fn) { this.actions[name] = fn; }
    };
    const nav = { onLine: true, audioSession: {}, mediaSession };
    const win = {
      STATIONS: stations, addEventListener(key, fn) { (windowEvents[key] ||= []).push(fn); },
      scrollTo() {}, MediaMetadata: class {}, Hls: { isSupported: () => false }
    };
    const storage = {
      getItem: key => data.get(key) ?? null,
      setItem: (key, value) => { data.set(key, String(value)); },
      removeItem: key => data.delete(key)
    };
    const URLMock = class {
      constructor(s, base) {
        this.href = s.startsWith("http") ? s : String(base || "") + s;
        this.protocol = this.href.startsWith("https:") ? "https:" : "http:";
        this.username = ""; this.password = "";
      }
    };
    const args = ["document", "window", "navigator", "localStorage", "matchMedia",
      "getComputedStyle", "location", "URL", "MediaMetadata", "CustomEvent",
      "setTimeout", "clearTimeout"];
    new Function(...args, source)(
      doc, win, nav, storage,
      () => ({ matches: false, addEventListener() {} }),
      () => ({ getPropertyValue: () => "#100c22" }),
      { hash: "", protocol: "https:" }, URLMock, win.MediaMetadata,
      class { constructor(type, opts) { this.type = type; this.detail = opts.detail; } },
      () => 1, () => {});
    function rowClick(id, targetClass) {
      $("#list").emit("click", { target: { closest(sel) {
        if (sel === ".st") return { dataset: { id } };
        if (sel === "." + targetClass) return { setAttribute() {} };
        return null;
      } } });
    }
    const buttons = section => elements[section].children.filter(x => x.attrs["data-quick-play"]);
    function quickPlay(id, section = "#personalFavorites") {
      const button = buttons(section).find(x => x.dataset.quickPlay === id);
      assert(button, "Missing quick button " + id);
      $("#personalHome").emit("click", { target: { closest(sel) {
        return sel === "[data-quick-play]" ? button : null;
      } } });
    }
    function live() { audio.emit("playing"); }
    return {
      data, storage, elements, events, audio, rowClick, quickPlay, live,
      favorites: () => buttons("#personalFavorites").map(b => b.dataset.quickPlay),
      recents: () => buttons("#personalRecents").map(b => b.dataset.quickPlay),
      status: () => $("#nowState").dataset.kind,
      selectedUrl: () => audio.currentSrc,
      playCount: () => plays,
      sourceCount: () => assignedSources,
      showAll() { $("#personalShowFavorites").emit("click"); },
      clear() { $("#personalClearRecents").emit("click"); },
      search(value) { $("#q").value = value; $("#q").emit("input", { target: { value } }); },
      recentRecord: () => JSON.parse(data.get("ondalibre.recents.v1") || "[]")
    };
  }
  async function check(name, task) {
    try { await task(); results.push({ name, passed: true }); }
    catch (e) { results.push({ name, passed: false, message: String(e.message || e) }); }
  }
  await check("Empty personal home has safe introductory states", () => {
    const h = createHarness();
    assert(h.favorites().length === 0 && h.recents().length === 0, "Home not empty");
    assert(h.elements["#personalShowFavorites"].hidden === true, "Empty favorites link shown");
    assert(h.elements["#personalClearRecents"].hidden === true, "Empty clear-history shown");
    assert(!h.data.has("ondalibre.recents.v1"), "Empty history should not write data");
  });
  await check("Favoriting instantly creates a one-tap card", () => {
    const h = createHarness();
    h.rowClick("radio2", "st-fav");
    assert(h.favorites().join() === "radio2", "Favorite card missing");
    assert(h.elements["#personalShowFavorites"].hidden === false, "See all hidden");
    assert(JSON.parse(h.data.get("ondalibre.favs"))[0] === "radio2", "Favorite not saved");
  });
  await check("Quick favorites play via the same audio and stats events", () => {
    const h = createHarness();
    h.rowClick("radio3", "st-fav"); h.quickPlay("radio3"); h.live();
    assert(h.status() === "live", "Quick play did not start");
    assert(h.selectedUrl().endsWith("/3.mp3"), "Wrong selected radio");
    assert(h.events.some(e => e.detail?.playing && e.detail.station.id === "radio3"),
      "Playback stats event missing");
    assert(h.recents()[0] === "radio3", "Playing radio not added to recents");
    assert(h.elements["#personalFavorites"].children[0].attrs["data-active"] === "true",
      "Quick card did not reflect selected station");
  });
  await check("Merely selecting a radio does not add it to recents", () => {
    const h = createHarness();
    h.rowClick("radio0", "st-main");
    assert(h.recents().length === 0 && !h.data.has("ondalibre.recents.v1"),
      "Connecting radio was counted before playing");
  });
  await check("Recents are ordered by successful play, unique and limited to eight IDs", () => {
    const h = createHarness();
    for (let i = 0; i < 10; i++) { h.rowClick("radio" + i, "st-main"); h.live(); }
    assert(h.recentRecord().length === 8, "Recent storage not bounded");
    assert(h.recentRecord()[0] === "radio9" && h.recentRecord().at(-1) === "radio2",
      "Recent order incorrect");
    assert(h.recents().length === 6, "UI should show six compact quick links");
    h.rowClick("radio5", "st-main"); h.live();
    assert(h.recentRecord()[0] === "radio5" && new Set(h.recentRecord()).size === 8,
      "Re-listening did not move radio to front exactly once");
  });
  await check("Recents survive refresh in same browser without Google login", () => {
    const h = createHarness();
    h.rowClick("radio7", "st-main"); h.live();
    const again = createHarness(Object.fromEntries(h.data));
    assert(again.recents().join() === "radio7", "Recent not restored");
    assert(again.status() !== "live", "Refresh should not auto-play radio");
  });
  await check("Clear history preserves favorites and never stops audio", () => {
    const h = createHarness();
    h.rowClick("radio1", "st-fav"); h.quickPlay("radio1"); h.live();
    h.clear();
    assert(h.recents().length === 0 && !h.data.has("ondalibre.recents.v1"), "History not cleared");
    assert(h.favorites()[0] === "radio1", "Favorites were lost");
    assert(h.status() === "live", "Clear history interrupted playback");
  });
  await check("Quick radio selection works while main list is filtered", () => {
    const h = createHarness();
    h.rowClick("radio1", "st-fav");
    h.search("no-station-matches-this");
    h.quickPlay("radio1"); h.live();
    assert(h.status() === "live" && h.selectedUrl().endsWith("/1.mp3"),
      "Quick play accidentally depended on catalog filters");
  });
  await check("Ver todas switches existing list to favorites", () => {
    const h = createHarness();
    h.rowClick("radio4", "st-fav"); h.showAll();
    assert(h.elements["#btnFav"].attrs["aria-pressed"] === "true", "Favorites filter not activated");
    assert(h.elements["#list"].children.length === 1, "Main list did not show favorites");
    assert(h.elements["#list"].scrolled?.block === "start", "Did not scroll to catalog");
  });
  await check("Same quick card stops current radio without duplicate history", () => {
    const h = createHarness();
    h.rowClick("radio0", "st-fav"); h.quickPlay("radio0"); h.live();
    const before = h.recentRecord().length;
    h.quickPlay("radio0");
    assert(h.status() === "idle" && h.recentRecord().length === before,
      "Stop did not preserve history");
  });
  await check("Deleting custom radio removes shortcuts and recent history", () => {
    const own = { id: "u123", name: "Radio propia",
      type: "audio", url: "https://radio.test/custom.mp3", tags: ["Mías"] };
    const h = createHarness({ "ondalibre.custom": JSON.stringify([own]) });
    h.rowClick("u123", "st-fav");
    h.rowClick("u123", "st-main"); h.live();
    h.rowClick("u123", "st-del");
    assert(!h.favorites().includes("u123") && !h.recents().includes("u123"),
      "Deleted station remained on personal home");
    assert(!h.recentRecord().includes("u123"), "Deleted station remained in history");
  });
  await check("Corrupted history cannot crash startup or insert fake stations", () => {
    for (const data of ["{}", "false", "[1,null,\"no-such-station\",\"radio2\",\"radio2\"]"]) {
      const h = createHarness({ "ondalibre.recents.v1": data });
      assert(h.recents().every(id => id === "radio2"), "Invalid history was rendered");
    }
  });
  const failed = results.filter(x => !x.passed);
  if (failed.length) throw Error(failed.map(x => x.name + ": " + x.message).join("\n"));
  return results;
}
if (typeof module !== "undefined" && require.main === module) {
  const fs = require("node:fs");
  const path = require("node:path");
  const code = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  runPersonalHomeTests(code).then(results => {
    for (const test of results) console.log("PASS " + test.name);
    console.log(results.length + " personalized home tests passed.");
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
