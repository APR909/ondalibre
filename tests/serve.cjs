/* SPDX-License-Identifier: MIT — OndaLibre
 * Minimal static HTTP server for local browser tests only.
 * Run: node tests/serve.cjs
 */
"use strict";
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 4173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8"
};
http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname); }
  catch { response.writeHead(400); response.end(); return; }
  const candidate = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    response.writeHead(403); response.end(); return;
  }
  fs.stat(candidate, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found"); return;
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(candidate)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    fs.createReadStream(candidate).pipe(response);
  });
}).listen(port, "127.0.0.1", () => console.log("OndaLibre test server on http://127.0.0.1:" + port));
