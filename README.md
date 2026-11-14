<p align="center"><img src="assets/logo.svg" width="96" height="96" alt="OndaLibre logo"></p>

# OndaLibre

**A minimal, open-source live radio player for the web.** Pick a station and listen: Spanish public
and commercial stations in one page that works on phone and desktop.

- Static files only: no backend, no build step, no accounts
- No cookies, no analytics, no third-party requests except the audio stream you pick
- Dark, light and high-contrast themes
- Installable on a phone's home screen
- MIT licensed and small enough to read in one sitting

*Reproductor de radio en directo de código abierto. Sin servidor, sin cuentas, sin cookies.*

## Publish on GitHub Pages

The folder is ready as-is: all paths are relative, so it works under `https://USER.github.io/REPO/`.

1. Create a new **public** repository on GitHub (for example `ondalibre`), with no README or licence.
2. Upload the files. Either drag the contents of this folder into "uploading an existing file" on the
   empty repository page, or from a terminal inside the folder:
   ```bash
   git init -b main
   git add -A
   git commit -m "OndaLibre: live web radio player"
   git remote add origin https://github.com/USER/REPO.git
   git push -u origin main
   ```
3. In the repository: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)` → Save.**
4. After a minute the site is live at `https://USER.github.io/REPO/`.

Suggested repository details ("About" box on the repository page):

- **Description:** `Minimal open-source live web radio player. Static, no backend, no cookies. Dark, light and high-contrast themes.`
- **Topics:** `radio` `web-radio` `internet-radio` `hls` `vanilla-js` `static-site` `pwa` `accessibility` `spain`
- **Social preview** (Settings → General): upload `assets/social-preview.png`.

## On a phone

Open the site and use "Add to Home Screen" (iOS Safari: Share menu; Android Chrome: ⋮ menu) to get a
full-screen app icon. Playback continues with the screen locked, with controls on the lock screen.
Volume is set with the phone's hardware keys.

## Run it

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

Any static host works; GitHub Pages is described above.

## Files

| File | Purpose |
|---|---|
| `index.html` | Markup: station list, About view (`#about`), player bar |
| `styles.css` | All styling; the three themes are custom-property blocks at the top |
| `theme.js` | Applies the saved theme before first paint |
| `app.js` | Player logic, list, favourites, custom stations |
| `stations.js` | The station directory — edit this to make it yours |
| `lib/` | hls.js (Apache-2.0) and its licence |
| `assets/` | Logo, app icons, social preview image |
| `manifest.webmanifest` | Lets phones install the page as an app |
| `.nojekyll` | Tells GitHub Pages to serve the files untouched |
| `LEGAL.md` | Legal review and pre-publication checklist |
| `THIRD-PARTY-NOTICES.md` | Licences of bundled code |

## Features

- Plays MP3/AAC streams natively and HLS (`.m3u8`) through hls.js
- Dark, light and high-contrast themes; follows the system setting until the listener chooses
- Search, type filters, favourites, add/remove your own stream URLs (kept in `localStorage`)
- Phone layout with large touch targets, safe-area support and lock-screen controls
- Keyboard: `Space` play/stop, `←` / `→` previous / next; OS media keys via Media Session
- The About view keeps the audio playing and is readable with JavaScript disabled

## Adding stations

Use the "Añadir" button (saved in that browser only) or edit `stations.js`:

```js
{ id: "miradio", name: "Mi Radio", desc: "…", tags: ["Música"], type: "audio", // or "hls"
  url: "https://example.com/stream.mp3", site: "https://example.com/" }
```

Follow the rules in the header of `stations.js`: official, freely accessible streams only, always
with the broadcaster's website. Built-in stations must be HTTPS and send CORS headers, because they
are requested in anonymous mode so the stream server's cookies are never stored.
[Radio Browser](https://www.radio-browser.info/) is a public-domain database for finding stream URLs.

## Theming

Each theme is a block of custom properties in `styles.css` (`--bg`, `--surface`, `--text`,
`--muted`, `--line`, `--accent`, plus border and focus-ring widths). Change those and nothing else.

## Before you publish

See the checklist at the end of `LEGAL.md`. The essentials: fill in the "Responsable de esta copia"
line in the About view, and check the project name is free to use.

Optional hardening if your host lets you set headers (GitHub Pages does not):

```
Content-Security-Policy: default-src 'self'; media-src https: blob:; connect-src https:; worker-src blob:; img-src 'self' data:; object-src 'none'; base-uri 'none'
```

## Licence

MIT for OndaLibre's code (`LICENSE`). hls.js is Apache-2.0 (`THIRD-PARTY-NOTICES.md`). The licence
covers the code only: station names are trademarks of their owners and the audio belongs to the
broadcasters.
