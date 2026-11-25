/* SPDX-License-Identifier: MIT — OndaLibre
 * Unit tests for private, local listening statistics; no Google/backend.
 * Run: node tests/stats.test.cjs
 */
"use strict";
async function runStatsTests(source) {
  const results = [];
  const a = "a".repeat(64), b = "b".repeat(64);
  const assert = (yes, why) => { if (!yes) throw new Error(why); };

  function harness(saved = {}) {
    let clock = 0, tick = null;
    const store = new Map(Object.entries(saved));
    const listeners = {}, windowListeners = {}, nodes = {}, notices = [];
    class Element {
      constructor(tag) {
        this.tag = tag; this.children = []; this.handlers = {};
        this.dataset = {}; this.attributes = {}; this.style = {};
        this.textContent = ""; this.hidden = false;
      }
      replaceChildren(...items) { this.children = items; }
      append(...items) { this.children.push(...items); }
      setAttribute(name, value) { this.attributes[name] = String(value); }
      addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); }
      click() { for (const callback of this.handlers.click || []) callback({}); }
    }
    const get = id => nodes[id] ||= new Element(id);
    const links = [new Element("nav1"),new Element("nav2")];
    const clear = [new Element("clear1"),new Element("clear2")];
    const notes = [new Element("note1"),new Element("note2")];
    const root = { dataset: {} };
    const document = {
      documentElement: root,
      getElementById: get,
      querySelectorAll(sel) {
        return ({
          "[data-account-only]": links, "[data-clear-stats]": clear,
          ".stats-note": notes
        })[sel] || [];
      },
      createElement: type => new Element(type),
      addEventListener(name, cb) { (listeners[name] ||= []).push(cb); }
    };
    const location = { hash: "#" };
    const window = {
      confirm: () => true,
      dispatchEvent: event => notices.push(event.type),
      addEventListener(name, cb) { (windowListeners[name] ||= []).push(cb); }
    };
    const localStorage = {
      getItem: key => store.get(key) ?? null,
      setItem(key, val) { store.set(key, String(val)); },
      removeItem: key => store.delete(key)
    };
    new Function("document", "window", "localStorage", "performance",
      "setInterval", "location", "Event", "Intl", source)(
      document, window, localStorage, { now: () => clock },
      callback => { tick = callback; return 1; }, location, class {
        constructor(type) { this.type = type; }
      }, Intl
    );
    const send = (name, detail) => {
      for (const callback of listeners[name] || []) callback({ detail });
    };
    const station = (id, name, genre) => ({ id, name, genre });
    return {
      store, root, nodes, links, clear, notes, location, station,
      auth: key => send("ondalibre:auth", { accountKey: key }),
      playback: (playing, st) => send("ondalibre:playback", { playing, station: st }),
      seconds: n => { clock += n * 1000; },
      tick: () => tick(),
      hidePage: () => { for (const fn of windowListeners.pagehide || []) fn(); },
      total: () => get("statsRadiosTotal").textContent,
      radioRows: () => get("statsRadiosList").children,
      genreRows: () => get("statsGenresList").children,
      saved: key => JSON.parse(store.get("ondalibre.stats.v1." + key) || "null")
    };
  }
  async function check(name, fn) {
    try { await fn(); results.push({ name, passed: true }); }
    catch (err) { results.push({ name, passed: false, message: String(err.message || err) }); }
  }

  await check("Signed-out listening is not stored or shown", () => {
    const h = harness();
    h.playback(true, h.station("rock", "Rock FM", "Rock"));
    h.seconds(120); h.tick(); h.playback(false, null);
    assert(h.store.size === 0, "Anonymous listening persisted");
    assert(h.radioRows().length === 0, "Stats available without login");
  });
  await check("Signed-in listening counts only playing seconds", () => {
    const h = harness();
    h.auth(a);
    h.playback(true, h.station("rock", "Rock FM", "Rock"));
    h.seconds(90); h.tick(); h.playback(false, null);
    h.seconds(120); h.tick();
    assert(Math.round(h.saved(a).stations.rock.seconds) === 90, "Pause counted");
    assert(h.total().includes("1 min"), "Total not rendered");
  });
  await check("Two radios and genres show percentages, not click counts", () => {
    const h = harness(); h.auth(a);
    h.playback(true, h.station("one", "First", "Rock"));
    h.seconds(60); h.playback(true, h.station("two", "Second", "Pop"));
    h.seconds(30); h.playback(false, null);
    const rows = h.radioRows(), genres = h.genreRows();
    assert(rows.length === 2 && genres.length === 2, "Missing ranking rows");
    const first = rows[0].children[0].children[1].textContent;
    assert(first.includes("66,7"), "Wrong proportional bar: " + first);
    assert(rows[0].children[1].attributes.role === "progressbar", "Missing accessible progressbar");
  });
  await check("Different accounts have separate history", () => {
    const h = harness(); h.auth(a);
    h.playback(true, h.station("one", "First", "Pop"));
    h.seconds(20); h.auth(b);
    assert(h.radioRows()[0].className === "stats-empty", "Other account shows past history");
    h.playback(true, h.station("two", "Second", "Jazz"));
    h.seconds(10); h.tick();
    h.auth(a);
    assert(h.radioRows().length === 1 && h.radioRows()[0].children[0].children[0].textContent === "First", "Account restored wrong data");
    assert(h.saved(a).stations.one.seconds === 20, "First account lost data");
    assert(h.saved(b).stations.two.seconds === 10, "Second account lost data");
  });
  await check("Sign-out hides charts and guards stats routes", () => {
    const h = harness(); h.auth(a);
    h.location.hash = "#stats-radios";
    h.auth(null);
    assert(h.root.dataset.authenticated === "false", "Account flag remains");
    assert(h.links.every(n => n.hidden), "Private navigation not hidden");
    assert(h.location.hash === "#", "Private route not cleared");
    assert(h.radioRows().length === 0, "Private content remains visible");
  });
  await check("Clear history only removes current account and preserves playback", () => {
    const h = harness(); h.auth(a);
    h.playback(true, h.station("a", "A", "Pop")); h.seconds(8); h.tick();
    h.auth(b); h.playback(true, h.station("b", "B", "Rock"));
    h.seconds(3); h.tick();
    h.clear[0].click();
    assert(h.saved(b) === null, "Clear did not erase current account");
    assert(h.saved(a).stations.a.seconds === 8, "Other account was erased");
    h.seconds(10); h.tick();
    assert(Math.round(h.saved(b).stations.b.seconds) === 10, "Playing did not resume counting");
  });
  await check("Invalid account key does not unlock stats", () => {
    const h = harness();
    h.auth("../../sensitive");
    assert(h.root.dataset.authenticated === "false", "Invalid key accepted");
    assert(h.links.every(n => n.hidden), "Navigation visible");
  });
  await check("Corrupted saved history does not crash and is ignored", () => {
    const h = harness({ ["ondalibre.stats.v1."+a]: "{not-json" });
    h.auth(a);
    assert(h.radioRows().length === 1 && h.radioRows()[0].className === "stats-empty", "Corruption not handled");
  });
  await check("Malformed and oversized durations are filtered out", () => {
    const saved = JSON.stringify({ version: 1, stations: {
      wrong: { name: "Bad", genre: "Rock", seconds: -5 },
      huge: { name: "Bad", genre: "Pop", seconds: 999999999999 },
      good: { name: "Good", genre: "Jazz", seconds: 15 }
    }});
    const h = harness({["ondalibre.stats.v1."+a]: saved});
    h.auth(a);
    assert(h.radioRows().length === 1 && h.radioRows()[0].children[0].children[0].textContent === "Good", "Invalid rows accepted");
  });
  await check("Page hide persists partial listening time", () => {
    const h = harness(); h.auth(a);
    h.playback(true, h.station("one", "One", "Rock"));
    h.seconds(11); h.hidePage();
    assert(h.saved(a).stations.one.seconds === 11, "Pagehide did not flush stats");
  });
  const failures = results.filter(r => !r.passed);
  if (failures.length) throw Error(failures.map(r => r.name + ": " + r.message).join("\n"));
  return results;
}
if (typeof module !== "undefined" && require.main === module) {
  const fs = require("node:fs"), path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "..", "stats.js"), "utf8");
  runStatsTests(source).then(tests => {
    for (const test of tests) console.log("PASS " + test.name);
    console.log(tests.length + " statistics tests passed.");
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
