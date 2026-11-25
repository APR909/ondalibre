<p align="center"><img src="assets/logo.svg" width="96" height="96" alt="OndaLibre logo"></p>

# OndaLibre

**OndaLibre — radio en directo con estética neón y código abierto.** Escucha 60 emisoras españolas
nacionales, autonómicas y locales desde una interfaz rápida y luminosa para móvil y ordenador.

- Static files only: no backend, no build step, no required account
- Personalized home with one-tap favorites and recent stations, stored locally without sign-in
- No first-party cookies or remote analytics; personal listening history stays on-device. Audio hosts are contacted on playback, logo providers when station images appear, and Google only when the account panel is opened
- Animated mini equalizer in the player while audio is actually playing (respects reduced-motion settings)
- Compact **Ahora suena** panel: current track title/artist when a supported station provides public data; otherwise an accurate station-category description
- Optional Google Identity Services sign-in and private listening rankings, saved per account in this browser
- Neon-branded dark, light and high-contrast themes (purple, cyan and pink accents)
- Installable on a phone's home screen
- MIT licensed and small enough to read in one sitting

*Reproductor de radio online con diseño neón. 60 emisoras españolas, favoritas y filtros regionales; sin servidor propio ni cuentas obligatorias.*

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

- **Description:** `Radio online de código abierto con estética neón. 60 emisoras españolas en directo, favoritas, filtros regionales y PWA.`
- **Topics:** `radio` `web-radio` `internet-radio` `hls` `vanilla-js` `static-site` `pwa` `accessibility` `spain` `neon-design`
- **Social preview** (Settings → General): upload `assets/social-preview.png` when refreshed with the Neon design.

## On a phone

Open the site and use "Add to Home Screen" (iOS Safari: Share menu; Android Chrome: ⋮ menu) to get a
full-screen app icon. OndaLibre uses HTML `<audio>` and Media Session to support lock-screen playback
and headset / system-media controls. **Background playback depends on the browser, OS and station
stream, and cannot be guaranteed by a static PWA.** MP3/AAC and native HLS are generally preferable
to JavaScript-fed HLS for background playback. Volume is set with the phone's hardware keys.

**Lock-screen smoke test:** on iOS Safari and Android Chrome (and separately as an installed home-screen
app), start a radio and wait until it says `En directo`. Lock the phone for 2–3 minutes; verify audio
continues, then test Pause → Play and previous/next from the system player. Repeat with an MP3 station
and a native-HLS station if available. Incoming calls, battery-saving policies, interrupted internet
connectivity and OS process eviction can still stop playback. If one station fails, try a different
stream format before assuming every radio is affected.

To avoid breaking system media controls, an external Pause **keeps the station media attached**;
Play attempts to resume the existing element without recreating the stream. Explicit Stop still
releases it. Where supported, the experimental Audio Session API is configured for `playback`.
The lock-screen media metadata is registered before starting playback.

On Android and other browsers without native HLS, **Radio Nacional**, **Radio 5** and **Onda Cero**
prefer published continuous MP3/AAC streams, because HLS.js needs ongoing JavaScript to fetch
segments and may stop when the browser is backgrounded. The original HLS stream is retried if the
alternative fails. The Radio Nacional / Radio 5 MP3 sources include **Andalusian territorial
broadcasts**, which may differ briefly from their national main feeds. Other HLS-only stations
may remain unreliable in the background on browsers without native HLS.

**If sound stops with the screen off:**
- **Android:** try Chrome, start playback with a tap while the page is visible, then lock the
  screen. Check Android Settings → Apps → Chrome (or OndaLibre) → Battery → allow background use.
  Disable Battery Saver for this test. Exact menus vary by phone manufacturer. If the installed
  shortcut fails, compare with a normal Chrome tab.
- **iPhone:** try the same station in Safari before testing the home-screen web app. Safari/WebKit
  may suspend web-app audio and has had PWA audio regressions in iOS 26. There is no universal
  permission switch in a web manifest to enable iOS background execution.
- Compare **Rock FM** (direct MP3) with **Radio Nacional** (native HLS on Safari; continuous MP3
  on browsers without native HLS). This separates stream-format issues from device restrictions.

**No browser-only solution can guarantee uninterrupted locked-screen audio on every device.**
For guaranteed native background execution on iOS, the app would need to be packaged as a native
iOS app with the appropriate Background Audio entitlement and audio session configuration.
These playback code paths have been tested using JavaScript simulations; a real device test is
still required.

## Run it

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

Any static host works; GitHub Pages is described above.

## Files

| File | Purpose |
|---|---|
| `index.html` | Markup: personalized home, station list, About and stats views, player bar |
| `styles.css` | All styling; the three themes are custom-property blocks at the top |
| `theme.js` | Applies the saved theme before first paint |
| `app.js` | Player logic, personalized home, recent listening history, favourites, custom stations |
| `stations.js` | The station directory, including external logo URLs — edit this to make it yours |
| `auth-config.js` | Public Google OAuth web client ID for this deployment |
| `auth.js` | Loads Google Identity Services on request; derives a pseudonymous local account key |
| `stats.js` | Tracks approximate listening time for signed-in users; renders local radio and genre rankings |
| `now-playing.js` | Shows station summaries; optionally polls public broadcaster metadata for track titles |
| `lib/` | hls.js (Apache-2.0) and its licence |
| `assets/` | Logo, app icons, social preview image |
| `manifest.webmanifest` | Lets phones install the page as an app |
| `.nojekyll` | Tells GitHub Pages to serve the files untouched |
| `LEGAL.md` | Legal review and pre-publication checklist |
| `THIRD-PARTY-NOTICES.md` | Licences of bundled code |

## Features

- Plays MP3/AAC streams natively and HLS (`.m3u8`) through hls.js
- Automatic radio reconnection after network/stream failures: bounded exponential-style backoff, offline/online handling and buffering watchdog
- Four small animated bars in the bottom player while a radio is actually playing; pause, stalls and errors stop the motion
- Responsive **Ahora suena** panel with station-matched, recent song/artist metadata for 12 additional music broadcasters (best-effort third-party coverage); generic fallback elsewhere
- **Mis radios** and **Mis géneros** tabs after Google sign-in: top 10 ranked by share of actual playing time, with percentage bars, total time and clear-history control
- Neon visual identity (variant 04) with dark, light and high-contrast themes; follows the system setting until the listener chooses
- Accent-insensitive search, combinable content/genre/region filters, quick views (Granada, music, news), live results counter, favourites and custom stations (kept in `localStorage`)
- **Para ti** at the top of the catalogue: one-tap recent/favorite station shortcuts, a full favorites view and a clear-recent-history control
- 60 curated Spanish stations: national networks, autonomous public broadcasters and local radio (including Granada)
- Station logos in the directory and bottom player, with safe text fallback if a provider blocks an image
- Current volume percentage shown next to the desktop slider
- Phone layout with large touch targets, safe-area support and lock-screen controls
- Keyboard: `Space` play/stop, `←` / `→` previous / next; OS media keys via Media Session
- The About view keeps the audio playing and is readable with JavaScript disabled

## Automated quality checks

OndaLibre runs automated tests on every push to `main`, pull request and manual GitHub
Actions dispatch. Two independent CI jobs ensure a failing unit test cannot be hidden by
an unrelated browser result:

- **Node.js, zero runtime dependencies:** project integrity (PWA icons and actual PNG
  dimensions, asset/script links, HTML IDs, accessibility label references, 60 unique
  station entries, HTTPS stream/logo URLs and safe script order); radio reconnection,
  favorites/recent stations, musical metadata, optional Google sign-in UI and private
  listening statistics. Run `npm test` with Node.js 22 or newer; **no npm install is
  required** for these core tests.
- **Playwright Chromium:** real-browser smoke tests on desktop (1280 × 900) and an
  Android-sized touch viewport (390 × 844). They cover rendering, search, quick
  playback, favorites, recently played stations, local persistence, volume, themes,
  navigation and unexpected JavaScript exceptions. Run locally with
  `npm install`, `npx playwright install chromium` and `npm run test:browser`.
  Browser automation dependencies are **development-only**; the website itself
  remains static and requires neither npm nor a backend.

The browser tests simulate the HTML audio element and block third-party requests, so
results do not depend on broadcasters being online, metadata providers or Google
accounts. **They do not verify live radio audio, CORS, Brave/Android background
playback, network conditions or authentication against Google's servers.** Those
still require device/manual integration tests. The CI workflow uploads Playwright
screenshots and traces when a browser test fails.

See [GitHub Actions](https://github.com/APR909/ondalibre/actions) and
`.github/workflows/reconnect-tests.yml`. Test suites are under `tests/`, and
`playwright.config.cjs` configures the two Chromium viewports.

## Filters and navigation

The station catalogue now has three independent, native HTML selectors, designed for
keyboard, screen reader and touch use:

- **Contenido**: all stations, music, news/programmes or personal stations. It uses
  the existing editorial genre and personal-radio list rather than assuming
  that a public broadcaster necessarily broadcasts news.
- **Género**: the real genres available for the chosen type (e.g. pop, rock,
  flamenco, classical). Changing content type removes an incompatible genre
  selection instead of trapping the user in an empty list.
- **Zona**: national coverage, a supported autonomous community, local Granada
  stations or personal stations. Canal Sur/Canal Fiesta and Catalunya Ràdio/iCat
  have been correctly tagged as regional services; Granada radio is also part
  of the Andalusian category.

Selectors can be combined with the search box and **Favoritas**. Searches are
accent-insensitive and include station name, editorial description, genre
and regional tags. A visible live result counter reports how many of the
60+ stations match, and **Limpiar filtros** restores the complete list.
Convenient quick filters (**Todas**, **Música**, **Noticias**, **Granada**)
switch directly to common views. **Para ti** → **Ver todas** resets search,
genre and zone but preserves favorite selection. All filters remain local
to the page and do not reconnect or stop the current radio.

Filter options update when a personal station is added/removed. The full
catalogue can always be restored even after no results. The interface uses
one-column native dropdowns on phones and three columns on wide screens.
The Chromium regression suite covers type/genre combinations, communities,
Granada, search, empty states, shortcuts, favorites and custom stations.
No new libraries or servers are required.

## Personalized home: «Para ti»

The top of the Emisoras page now has two compact panels:

- **Favoritas**: up to six quick-play station cards, including a direct link to the existing
  filtered favorites list (**Ver todas**). Changes to favorite stars immediately update
  the panel; adding favorites does not require Google login.
- **Escuchadas recientemente**: up to six quick-play shortcuts, ordered from newest to
  oldest. The browser stores at most **eight unique station IDs** in
  `localStorage["ondalibre.recents.v1"]`. History is updated **only after the audio fires
  a successful `playing` event**, not when a station is selected, merely connecting,
  buffering or failing. Re-listening moves a station to the front.
- **Borrar historial** clears only these local recent shortcuts. It does not remove
  favorites, playback, signed-in listening statistics or other settings.
- Both panels use the same player controls as the full list: changing stations works
  even when the catalogue is filtered, and selecting the current station again stops it.
  Removing a personal station removes it from quick access and recent history.
- No backend, new permissions or third-party libraries are required. These preferences
  are **per browser/device**, independent of the optional Google login, and are not
  synchronized or uploaded. Storage errors and malformed history are handled safely.

Run `node tests/personal-home.test.cjs` for the 12 focused regression tests.
The existing player and Now Playing tests continue to run unchanged.

## Optional Google sign-in (static GitHub Pages)

OndaLibre includes a small, optional **Sign in with Google** panel. Google Identity Services is
loaded only after the user opens it. The resulting name and email are displayed **in memory** for
this browser tab only, with an explicit sign-out button. The Google ID token is **not stored**,
posted to OndaLibre, or used to protect any data. Once signed in, the listener also sees
**Mis radios** and **Mis géneros**: personal rankings by approximate playing time, saved
**locally on that browser** under a SHA-256 derivative of the Google account subject.
No email address, raw Google subject or ID token is saved alongside the history.
The radio player and local favourites work without signing in. The **Salir de OndaLibre** action clears only the local in-memory profile and hides listening statistics; it does not sign the person out of Google itself.
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

## Ampliación de emisoras — noviembre de 2026

OndaLibre incorpora **19 emisoras nuevas**, para un catálogo total de **60 radios españolas**.
Las URLs públicas y los enlaces oficiales proceden del
[directorio TDTChannels](https://github.com/LaQuay/TDTChannels/blob/master/RADIO.md).

| Ámbito | Emisoras incorporadas |
|---|---|
| Nacional — deporte, economía y programas | Radio Marca, Capital Radio, Radio Intereconomía, Radio María |
| Nacional — música urbana y electrónica | LOS40 Urban, LOS40 Dance |
| Cataluña | RAC105, Flaix FM, Flaixbac, Radio TeleTaxi |
| Comunidad Valenciana | À Punt Ràdio |
| Región de Murcia | Onda Regional de Murcia, Onda Regional Música |
| País Vasco | Onda Vasca, Radio 7 |
| Andalucía y Granada | Flamenco Radio, COPE Granada, Onda Cádiz Radio |
| Castilla y León | esRadio Castilla y León |

Cada nueva entrada incluye un identificador único, género editorial, región, URL de
emisión, enlace a la web oficial e imagen enlazada desde el directorio. Las radios
deportivas, económicas y habladas se agrupan con **Noticias y programas**, no con
Música. Los filtros permiten explorar también Comunidad Valenciana, Murcia y
Castilla y León, y el acceso rápido **Granada** incorpora COPE Granada.

Se conservan las fuentes MP3/AAC cuando las emisoras las publican, y HLS donde
es el formato disponible. Las pruebas automáticas verifican la integridad del
catálogo, la ausencia de IDs y URLs duplicadas y la integración con búsqueda,
filtros, favoritas, historial y controles de reproducción. Las pruebas de
Chromium **simulan el audio** y no garantizan que una URL externa siga emitiendo
ni la reproducción con el móvil bloqueado. Las 19 fuentes nuevas requieren una
comprobación de audio real por emisora y dispositivo; los proveedores pueden
cambiar sus CDN o restricciones CORS. OndaLibre no aloja ni redistribuye el sonido.

## Adding stations

Use the "Añadir" button (saved in that browser only) or edit `stations.js`:

```js
{ id: "miradio", name: "Mi Radio", desc: "…", tags: ["Música"], type: "audio", // or "hls"
  url: "https://example.com/stream.mp3", site: "https://example.com/" }
```

Follow the rules in the header of `stations.js`: official, freely accessible streams only, always
with the broadcaster's website. The list includes national networks and regional broadcasters
from Aragón, Asturias, Baleares, Canarias, Castilla-La Mancha, Castilla y León,
Cataluña, Comunidad Valenciana, Extremadura, Galicia, Murcia,
the Basque Country and Andalusia. Use the **Regional** filter or a community name to narrow the
list; each station also has a primary genre for local listening statistics. Gozadera FM
is included under Reguetón, Andalucía and Granada.

Streams were cross-referenced with broadcaster pages and the
[TDTChannels radio directory](https://github.com/LaQuay/TDTChannels/blob/master/RADIO.md) in
November 2026. These are public HTTPS stream endpoints from broadcasters and their delivery
providers, **not audio files hosted by OndaLibre**. Availability, browser CORS support and any
geographical limitations can change; individual new streams still require real-audio browser testing across devices. Private credentials, paid-access streams and geo-block bypass URLs are excluded; publicly listed HLS/CDN paths may still change.

Built-in stations should permit anonymous CORS playback. Kiss FM is an exception: its official
stream passes through a signed redirect, so OndaLibre uses ordinary browser audio playback
(no CORS). Its streaming provider could send or set third-party cookies. No cookies are set by
OndaLibre itself.
[Radio Browser](https://www.radio-browser.info/) is a public-domain database for finding stream URLs.

## Automatic reconnection

If an active radio encounters a network/media error, a fatal hls.js failure, an unexpected end
of the stream, or continuous buffering for **15 seconds**, OndaLibre attempts a fresh connection.
Reconnect delays increase through **2, 5, 10, 20 and 30 seconds** (maximum five retries).
The initial connection also has a **20-second timeout**. If the station still fails, the
player shows **Sin señal. Pulsa Reproducir.** and stops automatically retrying.
A healthy session that plays uninterrupted for at least 60 seconds resets the retry budget.

When the browser reports that the device is **offline**, the player waits without network
polling and retries immediately on the browser's **online** event. It does not restart an
explicitly stopped station, a station paused from system/headset controls, or a station replaced
by another. Autoplay permission errors require a fresh manual Play gesture instead of
automatic attempts. The existing MP3/AAC-to-HLS and custom CORS fallbacks remain in place.

**Browser limitation:** hidden-tab timers can be throttled or suspended on Android/iOS;
reconnection cannot execute while the browser process is suspended or terminated. This
feature does not guarantee background audio in Brave or another mobile browser.

The dependency-free regression suite can be run with `node tests/reconnect.test.cjs`
and covers backoff, HLS failures, buffering, network events, manual stop/pause and source switching.

## Now-playing information

The bottom player includes a compact **Ahora suena** panel. For news and general radio,
it displays a generic description (such as “Noticias y programas”). For musical stations,
it displays “Música en directo” and the genre unless a verifiable live title/artist is
available. **OndaLibre does not infer or guess song titles from the audio.** Many broadcasters
do not publish accessible track metadata; the HTML audio element does not expose ICY stream
titles across origins.

**Expanded coverage:** `stations.js` now opts in 12 major Spanish music networks:
LOS40, LOS40 Classic, Cadena Dial, Cadena 100, Rock FM, Kiss FM, Europa FM, Melodía FM,
MegaStar FM, Radiolé, Radio 3 and Canal Fiesta Radio. The integration uses the
[public Tuneping API](https://tuneping.com/es/docs/) in best-effort mode, without an API key.
It searches the station directory by official name and country `ES`, verifies the
broadcaster identity (requiring an exact alias, unique candidate, matching stream, or unique
official homepage) and only then requests the live title for that station's UUID.
It **rejects ambiguous relays**. Song data must be marked `classification: song`,
have non-low confidence, and have a confirmation timestamp no more than 3 minutes old.
The page polls at most every 60 seconds while the selected station is playing and visible;
a provider/network failure backs off to 3 minutes. Station resolution is cached in memory
for the current tab. No credentials, profiles or listening statistics are transmitted.
Not every station in Tuneping necessarily publishes song titles: the available coverage
depends entirely on station metadata. **Live API and CORS compatibility must still be
verified in Android/desktop browsers**; OndaLibre never bypasses a CORS restriction.

Gozadera FM retains its separate public AzuraCast now-playing source, with strict
station-name matching. Its live endpoint and CORS availability also require browser
verification. If no credible metadata is available, the player shows the appropriate
generic programme/music description. Buffering, reconnection, pauses, stopping and station
switches cancel or suspend pending metadata updates, so stale songs cannot overwrite
another station's programme information.

**Privacy:** when these optional third-party feeds are requested, their providers may
receive the listener's IP address and technical request metadata. OndaLibre omits
credentials and referrer, does not transmit account details or local listening history,
and stops querying in hidden tabs. Consult the About page for privacy disclosure.
Tuneping is a third-party public beta service; the API may rate-limit, change or be
unavailable. The interface remains fully functional without it.

The regression suite `node tests/now-playing.test.cjs` verifies station identity,
staleness checks, correct song attribution, Gozadera compatibility, cancellation and
failure handling; `node tests/reconnect.test.cjs` checks the core player.

## Station logos and volume display

OndaLibre links station-identifying images in `stations.js` using the **logo** column published
by the community-maintained [TDTChannels radio list](https://github.com/LaQuay/TDTChannels/blob/master/RADIO.md).
Images are loaded **from third-party hosts** such as Facebook, X/Twitter and Wikimedia, not shipped
in this repository. List images use `loading="lazy"`, `decoding="async"` and
`referrerpolicy="no-referrer"`; if a logo URL is missing or blocked, the interface shows the
station's initials rather than a broken image. The same station art appears next to the
currently selected station in the lower player (including while it is playing).

**Privacy:** loading these third-party images reveals the visitor's IP address and connection
metadata to the image host. The application's privacy notice explicitly describes this.
**Rights:** logos and station brands belong to their owners and are **not** covered by OndaLibre's
MIT licence. A link to a logo does not establish permission to reuse it; before wider or commercial
distribution, review rights and remove/change links upon owner request. Third-party image URLs can
change at any time. No official endorsement is implied.

On desktop, the volume slider displays a live `0–100%` readout reflecting the current in-app
audio level. On phones, the volume control stays hidden because the device's hardware volume
buttons control output volume instead.

## Visual identity — variant 04 «Neón»

The site uses the user-selected Neon variant for `assets/logo.svg` (the source SVG from
the OndaLibre logo comparison, unchanged apart from its accessible label). The visual
system matches its violet border, pink transmitter and lilac/cyan broadcast waves.
The header, player, buttons, current station, mini equalizer and statistics share those
accents. Unlike a decorative skin, the palette defines corresponding **light** and
**high-contrast** themes, and respects reduced-motion preferences.

Core colours: midnight `#100C22` / page `#0B0717`, violet `#A146F7`,
lilac `#D6A2FF`, cyan `#77E4FF`, pink `#FF718F`. The original app
functionality, personal listening statistics and optional Google sign-in remain intact.

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
covers the code only: station names and linked logos are the intellectual property or trademarks
of their owners, and the audio belongs to the broadcasters.
