<p align="center"><img src="assets/logo.svg" width="96" height="96" alt="OndaLibre logo"></p>

# OndaLibre

**A minimal, open-source live radio player for the web.** Pick a station and listen: Spanish public
and commercial stations in one page that works on phone and desktop.

- Static files only: no backend, no build step, no required account
- No first-party cookies or analytics; streaming hosts are contacted when selected, and Google only when the account panel is opened
- Animated mini equalizer in the player while audio is actually playing (respects reduced-motion settings)
- Optional Google Identity Services sign-in and private listening rankings, saved per account in this browser
- Dark, light and high-contrast themes
- Installable on a phone's home screen
- MIT licensed and small enough to read in one sitting

*Reproductor de radio en directo de código abierto. Sin servidor, sin cuentas ni cookies propias.*

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

- **Description:** `Minimal open-source live web radio player. Static, no backend, no first-party cookies. Dark, light and high-contrast themes.`
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
| `auth-config.js` | Public OAuth web client ID (blank until configured) |
| `auth.js` | Loads Google Identity Services on request; derives a pseudonymous local account key |
| `stats.js` | Tracks approximate listening time for signed-in users; renders local radio and genre rankings |
| `lib/` | hls.js (Apache-2.0) and its licence |
| `assets/` | Logo, app icons, social preview image |
| `manifest.webmanifest` | Lets phones install the page as an app |
| `.nojekyll` | Tells GitHub Pages to serve the files untouched |
| `LEGAL.md` | Legal review and pre-publication checklist |
| `THIRD-PARTY-NOTICES.md` | Licences of bundled code |

## Features

- Plays MP3/AAC streams natively and HLS (`.m3u8`) through hls.js
- Four small animated bars in the bottom player while a radio is actually playing; pause, stalls and errors stop the motion
- **Mis radios** and **Mis géneros** tabs after Google sign-in: top 10 ranked by share of actual playing time, with percentage bars, total time and clear-history control
- Dark, light and high-contrast themes; follows the system setting until the listener chooses
- Search, type filters, favourites, add/remove your own stream URLs (kept in `localStorage`)
- Phone layout with large touch targets, safe-area support and lock-screen controls
- Keyboard: `Space` play/stop, `←` / `→` previous / next; OS media keys via Media Session
- The About view keeps the audio playing and is readable with JavaScript disabled

## Optional Google sign-in (static GitHub Pages)

OndaLibre includes a small, optional **Sign in with Google** panel. Google Identity Services is
loaded only after the user opens it. The resulting name and email are displayed **in memory** for
this browser tab only, with an explicit sign-out button. The Google ID token is **not stored**,
posted to OndaLibre, or used to protect any data. Once signed in, the listener also sees
**Mis radios** and **Mis géneros**: personal rankings by approximate playing time, saved
**locally on that browser** under a SHA-256 derivative of the Google account subject.
No email address, raw Google subject or ID token is saved alongside the history.
The radio player and local favourites work without signing in.
**This does not create server-verified accounts or sync favourites or statistics between
devices.** A secure user system requires a server that validates the ID token signature, issuer,
audience and expiry and stores user data appropriately.

To enable the button:

1. Go to [Google Cloud Console — Clients](https://console.cloud.google.com/auth/clients)
   and create or select a project. Configure the OAuth consent screen/branding.
2. Create an OAuth client of type **Web application**. Add the **Authorized JavaScript origin**
   `https://apr909.github.io` (just the origin — **not** `/ondalibre/`).
   For local testing, also add `http://localhost:8080` if needed.
3. Copy the client ID (it ends in `.apps.googleusercontent.com`) and set it in
   `auth-config.js` as `window.ONDA_GOOGLE_CLIENT_ID = "...";`. The client ID is public;
   **never commit an OAuth client secret**.
4. Commit that file to `main` and deploy with GitHub Pages. On the site, open
   **Iniciar sesión** and select the Google button. If your OAuth app is in testing mode,
   add your account as a test user in Google Cloud.

This feature intentionally does not load Google on page load and does not silently sign anyone in.
Google's own services may use cookies or other information when the account panel is opened;
see [Google's privacy policy](https://policies.google.com/privacy).

Google's implementation docs: [JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference)
and [client ID setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

## Personal listening statistics (local to this device)

- Statistics are recorded **only while a Google account is signed in** and the radio is playing.
  Connecting, pausing and buffering do not intentionally contribute listening time.
- The bars show each radio's or primary genre's share of **all time listened** for that account
  on this browser, not a percentage of listeners or an aggregate across users.
- Genre categories are assigned in `stations.js`. For a user-added radio, the default category
  is `Personalizadas`.
- These are approximate wall-clock timings, not a measurement of audio samples. Browser suspension,
  network disruptions and overlapping open tabs can affect accuracy.
- The data is saved in this device's `localStorage` under an account-specific pseudonymous key;
  it survives sign-out and subsequent sign-in of the same account on the same browser.
  **Nothing is uploaded or shared with Google or OndaLibre.**
- **Borrar mis estadísticas** clears that account's local history, without touching another account
  on the same device. Clearing browser data also removes all history.
- The decoded Google ID token is **not cryptographically verified in this static app**: these tabs
  are convenience features, not a secure authentication or access-control boundary. For verified
  identities, cloud synchronization or global popularity charts, use a backend and database.

## Adding stations

Use the "Añadir" button (saved in that browser only) or edit `stations.js`:

```js
{ id: "miradio", name: "Mi Radio", desc: "…", tags: ["Música"], type: "audio", // or "hls"
  url: "https://example.com/stream.mp3", site: "https://example.com/" }
```

Follow the rules in the header of `stations.js`: official, freely accessible streams only, always
with the broadcaster's website. Built-in stations should use HTTPS and permit anonymous CORS
playback. Kiss FM is an exception: its official stream passes through a signed redirect, so
OndaLibre uses ordinary browser audio playback (no CORS). Its streaming provider could send or
set third-party cookies. No cookies are set by OndaLibre itself.
[Radio Browser](https://www.radio-browser.info/) is a public-domain database for finding stream URLs.

## Theming

Each theme is a block of custom properties in `styles.css` (`--bg`, `--surface`, `--text`,
`--muted`, `--line`, `--accent`, plus border and focus-ring widths). Change those and nothing else.

## Before you publish

See the checklist at the end of `LEGAL.md`. The essentials: fill in the "Responsable de esta copia"
line in the About view, and check the project name is free to use.

Optional hardening if your host lets you set headers (GitHub Pages does not):

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; connect-src https:; media-src https: blob:; worker-src blob:; img-src 'self' data: https://*.googleusercontent.com; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'
```

## Licence

MIT for OndaLibre's code (`LICENSE`). hls.js is Apache-2.0 (`THIRD-PARTY-NOTICES.md`). The licence
covers the code only: station names are trademarks of their owners and the audio belongs to the
broadcasters.
