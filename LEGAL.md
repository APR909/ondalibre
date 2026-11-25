# Legal review

Reviewed 2026-11-14 against Spanish and EU law, for a site hosted in or aimed at Spain.
This is an engineering review, not legal advice. If you plan to earn money from the site or grow it
beyond a personal project, have a lawyer confirm sections 2.1 and 2.5.

## 1. Problems found and fixed

| # | Problem in the previous version | Why it mattered | Fix |
|---|---|---|---|
| 1 | hls.js was loaded from the jsDelivr CDN | Every visitor's IP address went to a third party with no notice (GDPR arts. 5 and 13) | Library is now bundled in `lib/`; loading the page contacts only your own host |
| 2 | Stream servers could set cookies. Some providers send identifying cookies | Third-party identifier cookies may require consent under LSSI art. 22.2 | Most built-in streams use CORS anonymous mode; Kiss FM instead requires normal media mode and its server could set cookies. The privacy notice discloses this exception; assess consent requirements before publication. `no-referrer` hides the page address from stream servers |
| 3 | Radio MARCA was linked by a direct URL, while its official source is served through a geo-block endpoint | Linking around an access restriction counts as a new communication to the public (CJEU, VG Bild-Kunst, C-392/19) | Station removed |
| 4 | Several URLs pointed at numbered relay servers that rotate; MáximaFM, iCat and Canal Sur returned errors | Broken, and not the broadcaster's published entry point | Replaced with broadcasters' own entry points; MáximaFM removed. Kiss FM was later re-added using its ad-handler redirect with an explicit non-CORS media exception |
| 5 | No privacy information, no non-affiliation statement, no takedown route | Transparency duty (GDPR art. 13); the link safe harbour depends on acting when notified (LSSI art. 17) | "Acerca de" view with privacy, legal notice and takedown sections |
| 6 | Stations had no visible link to the broadcaster | Attribution, and it makes clear the site is a directory | Every row links to the official website |
| 7 | Player icons used the same path data as Material Icons (Apache-2.0) with no attribution; favicon was an emoji glyph | Minor licence-hygiene issue | Icons redrawn for this project; favicon is an original SVG |
| 8 | hls.js licence text was not distributed | Apache-2.0 s. 4 requires it when you redistribute | `lib/hls.js.LICENSE.txt` and `THIRD-PARTY-NOTICES.md` |
| 9 | Station tags were inserted as raw HTML | Self-XSS through the "add station" form (security, not legal) | List is built with DOM nodes; URLs restricted to http/https |

## 2. Risks that remain, and how to keep them low

### 2.1 Copyright: linking to live streams — low, if you keep the current shape
- Linking to content that the rightholder made freely available online is not a new communication
  to the public (CJEU Svensson C-466/12, BestWater C-348/13). The player links to official streams,
  to the same Spanish audience the stations already address, and passes them through untouched,
  adverts included.
- What raises the risk:
  - **Relaying or proxying audio through your server.** You would then be retransmitting and need
    licences from the broadcasters and the collecting societies (SGAE, AGEDI-AIE).
  - **A record or download feature.**
  - **Removing or replacing the stations' adverts.**
  - **Running it for profit** (ads, subscriptions). For-profit linkers are presumed to know whether
    what they link is lawful (GS Media C-160/15).
  - **Adding foreign stations aimed at another country's listeners.** In Warner Music v TuneIn
    ([2021] EWCA Civ 441) the English Court of Appeal held a radio aggregator liable for linking
    UK users to stations not licensed for the UK. It is a UK ruling applying the same EU case law.
    Summary: https://wiggin.co.uk/insight/court-of-appeal-dismisses-appeal-by-online-radio-aggregation-service-against-decision-that-it-was-liable-for-acts-of-communication-to-the-public-thereby-infringing-copyright/

### 2.2 Broadcasters' terms of use — low to medium
Some broadcasters' website terms say their streams may only be used in their own players. I did not
read each broadcaster's terms. They can ask you to remove a link or change the URL at any time.
Remove on request; that also keeps you inside LSSI art. 17.

### 2.3 Trademarks and broadcaster logos — permission review required
Station names and station-identifying logos are displayed to identify broadcasters.
The names are used referentially; however, linked logos remain third-party intellectual property
and trademarks. The logo URLs in `stations.js` were sourced from the public TDTChannels radio
directory, which does not itself grant OndaLibre a licence to reproduce or redistribute the
artwork. Remote embedding can also be disallowed by a broadcaster or image host.
**Review use rights/terms or request permission before public or commercial distribution.**
Display of a mark is not an endorsement. Remove/replace an image promptly on request.

### 2.4 The name "OndaLibre" — check before publishing
"Onda Libre" is already used by radio stations, for example Onda Libre La Iruela (Jaén) and the
Universidad Libre's station in Cali, and it echoes Onda Lliure, the first Spanish free radio. I did
not search the trademark registers. Search OEPM and EUIPO (TMview, classes 9, 38 and 41) or pick a
more distinctive name. The name appears in `index.html`, `README.md`, `LICENSE` and the
`ondalibre.*` storage keys in `app.js` and `theme.js`.

### 2.5 Operator identification (LSSI art. 10) — depends on you
A purely personal, non-commercial page is outside the LSSI. Once there is any economic activity
(ads, donations, sponsorship) you must show your name, tax ID, address and e-mail. Either way, the
About view needs a real contact so takedown requests can reach you; it currently shows a placeholder.

### 2.6 Cookies and local storage — review the Kiss FM exception
`localStorage` holds device preferences (theme, volume, favourites, own stations and last
station). For signed-in users, it additionally stores per-account listening history under a
SHA-256-derived pseudonymous key, with radio names, primary genres and approximate playback
seconds. Google tokens, names, emails and raw account subject identifiers are not persisted with
the history. History stays on the device and is deleted on explicit request or when browser data
is cleared; sign-out only hides it. Storage and consent requirements must be reviewed for this
optional functionality under LSSI art. 22.2 and applicable privacy law; this note is not a
legal determination. Adding remote analytics, ads or embeds would require further review.

### 2.7 Personal data — small residual
- The optional “Ahora suena” feature may retrieve track titles from the public Tuneping
  API (api.tuneping.com) when one of 12 configured Spanish music stations is played and
  the page is visible. It first looks up the station by exact name and country, then
  queries the uniquely matched station UUID. Ambiguous matches, outdated data and
  non-song classifications are rejected. Gozadera FM continues to use its own AzuraCast
  endpoint at azura.abcorp.es. The browser omits credentials and referrer, never sends
  Google tokens, favourites or listening history, and stops polling in hidden tabs.
  Providers still receive IP/request metadata. Real-device API/CORS availability and
  applicable usage terms and privacy/consent duties require review before publication.
- Station logos are fetched directly from external image providers, including Facebook/X and
  Wikimedia, when the relevant image enters view or is selected. These hosts may receive the
  visitor's IP address and request metadata. List images are lazy-loaded with no referrer, but
  they are still third-party requests; review whether the privacy notice and applicable consent
  obligations are sufficient.
- Your web host logs visitor IP addresses. On GitHub Pages that host is GitHub, which may store
  logs in the United States. The About view
  mentions it in general terms; name the host there if you want to be thorough.
- When a listener plays a station, the broadcaster's servers see the listener's IP address. That is
  inherent in direct playback and is disclosed.
- Built-in Kiss FM uses normal audio mode because its broadcaster issues a signed stream URL via a
  redirect; the streaming provider could set or read third-party cookies when the listener chooses it.
  Review applicable consent requirements before deploying this exception.
- Stations a listener adds are tried in anonymous mode first; if their server lacks CORS headers the
  player falls back to normal mode, where that server could set cookies. This is disclosed and only
  affects streams the listener chose to add.

### 2.8 Optional Google Identity Services
- Two local listening-statistics tabs (radios and genres) become available after Google login.
  No statistics are recorded for signed-out listeners. Their percentages reflect approximate
  time played on this browser, not global user popularity. A local clear-history control is
  provided, and the raw Google identifier is not saved. Local data is neither protected by
  server authentication nor synchronized across devices.
- The Google login panel is optional. The Google JS SDK is fetched only when the visitor opens
  the panel and an OAuth web client ID has been configured. Google may process account data and
  use its own cookies/identifiers. The About view must continue explaining this interaction.
- Only basic name and email are displayed in this browser tab; tokens are not persisted and
  OndaLibre does not run a backend. The decoded browser token is NOT independently
  cryptographically verified and must never be used for access control. Add a backend token
  verifier and appropriate privacy/security measures before building real accounts or sync.
- Configure approved JavaScript origins in Google Cloud. Never publish an OAuth client secret.
- Check Google's identity integration policies and applicable EU data-protection obligations before
  offering the feature publicly. Do not interpret this implementation note as legal approval.

### 2.9 Accessibility — not mandatory here
RD 1112/2018 binds the public sector and Ley 11/2023 (European Accessibility Act) covers specific
commercial services. Neither applies to a personal project. The site nonetheless has keyboard
operation, visible focus, labelled controls and a high-contrast theme.

## 3. Open-source and replication check

| Item | Origin | Licence | Free to copy and modify? |
|---|---|---|---|
| `index.html`, `styles.css`, `app.js`, `theme.js`, `manifest.webmanifest`, logo and icons in `assets/` | Written for this project | MIT | Yes, keep the copyright notice |
| `stations.js` | Hand-written directory metadata and links, including third-party logo URLs | MIT for code/metadata as applicable | The external linked artwork is not licensed by this project |
| `lib/hls.light.min.js` | hls.js 1.6.13, unmodified apart from the removed source-map comment | Apache-2.0 | Yes, keep its licence file. Apache-2.0 code can be shipped inside an MIT project |
| Fonts | System fonts only | — | Nothing is distributed |
| Radio Browser (only recommended in the README) | Community database | Public domain | Yes |

No copyleft code is bundled and no third-party logo image files are distributed in the repo.
The remotely linked logo images have separate, potentially restricted rights. No build tooling,
secrets or minified first-party code. The Google OAuth client ID (if configured) is a public identifier, NOT a client
secret. Files carry SPDX licence identifiers.

## 4. Before you publish

- [ ] Replace the "Responsable de esta copia" placeholder in the About view (`index.html`) with a name and contact address.
- [ ] Check the name against OEPM and EUIPO, or rename.
- [ ] Put the code in a public repository with `LICENSE`, `THIRD-PARTY-NOTICES.md` and `lib/hls.js.LICENSE.txt`; optionally link the repository from the About view.
- [ ] Serve over HTTPS.
- [ ] If enabling Google login, create an OAuth Web client, configure allowed origins and consent/branding, and review the new third-party data flow and privacy text.
- [ ] Review permission/terms for remote station logos and the privacy implications of image-host requests.
- [ ] Do not add analytics, ads, web fonts or embeds without revisiting 2.6.
- [ ] Remove any station within a few days if its broadcaster asks.
- [ ] Re-test the stream URLs from time to time; broadcasters change them.
