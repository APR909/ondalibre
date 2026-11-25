/* SPDX-License-Identifier: MIT — OndaLibre
 * No external dependencies. Repository and PWA integrity checks.
 * Run: node tests/project-integrity.test.cjs
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const assert = (condition, message) => {
  if (!condition) throw Error(message);
};
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const exists = file => fs.existsSync(path.join(root, file));

function validateProject() {
  const cases = [];
  const verify = (label, fn) => { fn(); cases.push(label); };
  const html = read("index.html");
  const css = read("styles.css");
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const context = { window: {} };
  vm.runInNewContext(read("stations.js"), context, { timeout: 3000 });
  const stations = context.window.STATIONS;
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const idSet = new Set(ids);
  const scriptPaths = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
  const styles = [...html.matchAll(/<link\b[^>]*\bhref="([^"]+\.css)"/g)].map(m => m[1]);
  const assets = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map(m => m[1]);
  verify("All HTML IDs are unique", () => {
    assert(ids.length === idSet.size, "Duplicate HTML ID");
  });
  verify("Labels and aria-labelledby reference existing IDs", () => {
    for (const [, id] of html.matchAll(/(?:\bfor|\baria-labelledby)="([^"]+)"/g)) {
      for (const ref of id.split(/\s+/)) assert(idSet.has(ref), "Missing label target: " + ref);
    }
  });
  verify("DOM bindings for app, login and stats exist", () => {
    const scripts = ["app.js","stats.js","auth.js","now-playing.js"];
    for (const file of scripts) {
      const source = read(file);
      const direct = [...source.matchAll(/(?:getElementById\("|\\$\("#)([a-zA-Z0-9_-]+)"/g)]
        .map(m => m[1]);
      for (const id of direct) assert(idSet.has(id), file + " uses missing #" + id);
    }
  });
  verify("Required page controls have usable labels", () => {
    for (const id of ["q","vol","play","prev","next","personalShowFavorites",
      "personalClearRecents","authSignOut","nowPlayingTitle"]) {
      assert(idSet.has(id), "Missing core control #" + id);
    }
    assert(/<html\b[^>]*lang="es"/.test(html), "No Spanish language declaration");
  });
  verify("Scripts load in safe dependency order", () => {
    const names = ["stations.js","auth-config.js","auth.js","app.js",
      "stats.js","now-playing.js"];
    let last = -1;
    for (const file of names) {
      const index = scriptPaths.indexOf(file);
      assert(index > last, "Script missing/misordered: " + file);
      last = index;
    }
  });
  verify("All bundled scripts, styles, graphics and manifest exist", () => {
    for (const asset of [...scriptPaths,...styles,...assets,"manifest.webmanifest"]) {
      const file = asset.split("?")[0].split("#")[0];
      assert(!file.includes(".."), "Unsafe local asset " + file);
      assert(exists(file), "Missing asset: " + file);
    }
    for (const icon of manifest.icons) assert(exists(icon.src), "Missing PWA icon: " + icon.src);
  });
  verify("Manifest is valid and retains installable standalone configuration", () => {
    assert(manifest.name === "OndaLibre", "Wrong manifest name");
    assert(manifest.display === "standalone", "PWA not standalone");
    assert(manifest.icons.some(x => x.sizes === "192x192"), "Missing 192 icon");
    assert(manifest.icons.some(x => x.sizes === "512x512"), "Missing 512 icon");
    assert(manifest.icons.some(x => x.purpose === "maskable"), "Missing maskable icon");
  });
  verify("PWA PNG assets contain correct image dimensions", () => {
    const targets = [
      ["assets/icon-180.png",180],["assets/icon-192.png",192],
      ["assets/icon-512.png",512],["assets/icon-maskable-512.png",512]
    ];
    for (const [file, dimension] of targets) {
      const data = fs.readFileSync(path.join(root,file));
      assert(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), "Bad PNG header: "+file);
      assert(data.readUInt32BE(16)===dimension && data.readUInt32BE(20)===dimension,
        "Wrong PNG dimensions: "+file);
    }
  });
  verify("Station catalog has unique IDs and required metadata", () => {
    assert(Array.isArray(stations) && stations.length >= 60, "Unexpected station count");
    const unique = new Set();
    for (const s of stations) {
      assert(typeof s.id === "string" && /^[a-z0-9_-]+$/.test(s.id), "Invalid station ID");
      assert(!unique.has(s.id), "Duplicate station ID: " + s.id);
      unique.add(s.id);
      assert(typeof s.name === "string" && !!s.name.trim(), "Missing name for "+s.id);
      assert(typeof s.desc === "string" && typeof s.genre === "string", "Missing genre/desc for "+s.id);
      assert(Array.isArray(s.tags) && s.tags.every(t => typeof t === "string"), "Invalid tags: "+s.id);
      assert(["audio","hls"].includes(s.type), "Unexpected stream type: "+s.id);
    }
  });
  verify("Expansion includes 19 expected broadcasters without duplicate streams", () => {
    const expected = [
      "radiomarca", "capitalradio", "radiointereconomia", "los40urban",
      "los40dance", "radiomaria", "rac105", "flaixfm", "flaixbac",
      "radioteletaxi", "apunt", "ondaregional", "ondaregionalmusica",
      "ondavasca", "flamencoradio", "copegranada", "ondacadiz",
      "esradiocyl", "radio7"
    ];
    const ids = new Set(stations.map(x => x.id));
    for (const id of expected) assert(ids.has(id), "Missing newly added station: " + id);
    const urls = stations.map(x => x.url);
    assert(urls.length === new Set(urls).size, "Duplicate stream URL");
  });
  verify("Expanded station regions and audio formats are valid", () => {
    const allowedRegions = ["Andalucía","Aragón","Asturias","Baleares","Canarias",
      "Castilla-La Mancha","Castilla y León","Cataluña","Comunidad Valenciana",
      "Extremadura","Galicia","Murcia","País Vasco"];
    const newStations = stations.slice(41);
    for (const st of newStations) {
      assert(st.tags.includes("Nacional") ||
        st.tags.some(tag => allowedRegions.includes(tag)),
        "Missing expansion area for " + st.id);
      if (st.type === "hls") assert(/\\.m3u8(?:[?#]|$)/.test(st.url),
        "Invalid HLS playlist for " + st.id);
      if (st.type === "audio") assert(!/\\.m3u8(?:[?#]|$)/.test(st.url),
        "Unexpected HLS for audio station " + st.id);
    }
  });
  verify("Station URLs and logos use HTTPS", () => {
    for (const s of stations) {
      for (const property of ["url","site","logo"]) {
        assert(typeof s[property] === "string" && s[property].startsWith("https://"),
          "Invalid HTTPS "+property+" for "+s.id);
        const url = new URL(s[property]);
        assert(!url.username&&!url.password, "Credentials in "+property+" for "+s.id);
      }
      if (s.backgroundUrl) assert(new URL(s.backgroundUrl).protocol === "https:",
        "Unsafe background stream: "+s.id);
      if (s.nowPlayingApi) assert(new URL(s.nowPlayingApi).protocol === "https:",
        "Unsafe metadata endpoint: "+s.id);
    }
  });
  verify("Configured music metadata sources have exact matching aliases", () => {
    for (const s of stations.filter(x=>x.metadataSource)) {
      const source = s.metadataSource;
      assert(source.type === "tuneping", "Unknown metadata source");
      assert(typeof source.query === "string" && source.query.length > 0, "Missing query for "+s.id);
      assert(Array.isArray(source.names) && source.names.length > 0, "No aliases for "+s.id);
    }
  });
  verify("Dark/light/contrast CSS themes and reduced-motion rules exist", () => {
    assert(css.includes(':root[data-theme="light"]'), "No light theme");
    assert(css.includes(':root[data-theme="contrast"]'), "No contrast theme");
    assert(css.includes("prefers-reduced-motion"), "No reduced motion");
    assert(css.includes(".personal-home"), "Missing personal home CSS");
  });
  verify("Optional login remains lazy and no inline third-party SDK in HTML", () => {
    assert(!scriptPaths.some(s=>s.includes("accounts.google.com")), "Google SDK loaded eagerly");
    assert(read("auth.js").includes('script.src = "https://accounts.google.com/gsi/client?hl=es"'),
      "Google optional loading changed");
  });
  for (const label of cases) console.log("PASS "+label);
  console.log(cases.length+" project integrity tests passed.");
  return cases;
}
if (require.main === module) {
  try { validateProject(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { validateProject };
