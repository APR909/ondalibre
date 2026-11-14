/* SPDX-License-Identifier: MIT — OndaLibre station directory
 *
 * Each entry: { id, name, desc, tags[], genre, url, type: "audio" | "hls", site }
 * The genre is the primary editorial category used for personal listening statistics.
 *
 * Rules for this file (see LEGAL.md):
 *  - Only link streams the broadcaster itself publishes, freely and without
 *    login, token or geo-block. Never add a URL that works around a restriction.
 *  - Always fill in `site` with the broadcaster's official website.
 *  - Names only: no logos or artwork without the owner's permission.
 *  - Remove an entry promptly if its broadcaster asks.
 *
 * Original URLs were reviewed on 2026-11-14. New entries are sourced from
 * published station directories; playback and CORS need browser verification.
 * Kiss FM uses a temporary signed URL and the browser's no-CORS media mode.
 */
window.STATIONS = [
  { id: "rne", name: "Radio Nacional", desc: "Información y magacines de la radio pública estatal",
    tags: ["Noticias", "Pública"], genre: "Noticias", type: "hls",
    url: "https://rtvelivestream.rtve.es/rtvesec/rne/rne_r1_main.m3u8",
    site: "https://www.rtve.es/play/radio/" },
  { id: "radioclasica", name: "Radio Clásica", desc: "Música clásica, ópera y jazz",
    tags: ["Clásica", "Pública"], genre: "Clásica", type: "hls",
    url: "https://rtvelivestream.rtve.es/rtvesec/rne/rne_r2_main.m3u8",
    site: "https://www.rtve.es/play/radio/" },
  { id: "radio3", name: "Radio 3", desc: "Música alternativa y cultura",
    tags: ["Música", "Pública"], genre: "Alternativa", type: "hls",
    url: "https://rtvelivestream.rtve.es/rtvesec/rne/rne_r3_main.m3u8",
    site: "https://www.rtve.es/play/radio/" },
  { id: "radio5", name: "Radio 5", desc: "Noticias las 24 horas",
    tags: ["Noticias", "Pública"], genre: "Noticias", type: "hls",
    url: "https://rtvelivestream.rtve.es/rtvesec/rne/rne_r5_madrid_main.m3u8",
    site: "https://www.rtve.es/play/radio/" },
  { id: "ser", name: "Cadena SER", desc: "Información, tertulia y deportes",
    tags: ["Noticias"], genre: "Noticias", type: "audio",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER.mp3",
    site: "https://cadenaser.com/" },
  { id: "cope", name: "COPE", desc: "Información, tertulia y deportes",
    tags: ["Noticias"], genre: "Noticias", type: "audio",
    url: "https://net1-cope-rrcast.flumotion.com/cope/net1.mp3",
    site: "https://www.cope.es/" },
  { id: "ondacero", name: "Onda Cero", desc: "Información, tertulia y deportes",
    tags: ["Noticias"], genre: "Noticias", type: "hls",
    url: "https://atres-live.ondacero.es/live/ondacero/bitrate_1.m3u8",
    site: "https://www.ondacero.es/" },
  { id: "esradio", name: "esRadio", desc: "Actualidad y opinión",
    tags: ["Noticias"], genre: "Noticias", type: "audio",
    url: "https://libertaddigital-radio-live1.flumotion.com/libertaddigital/ld-live1-med.aac",
    site: "https://esradio.libertaddigital.com/" },
  { id: "canalsur", name: "Canal Sur Radio", desc: "La radio pública de Andalucía",
    tags: ["Noticias", "Pública"], genre: "Noticias", type: "audio",
    url: "https://rtva-live-radio.flumotion.com/rtva/csr.mp3",
    site: "https://www.canalsur.es/" },
  { id: "canalfiesta", name: "Canal Fiesta Radio", desc: "Música en español desde Andalucía",
    tags: ["Música", "Pública"], genre: "Pop", type: "audio",
    url: "https://rtva-live-radio.flumotion.com/rtva/cfr.mp3",
    site: "https://www.canalsur.es/" },
  { id: "catradio", name: "Catalunya Ràdio", desc: "La radio pública de Cataluña",
    tags: ["Noticias", "Pública"], genre: "Noticias", type: "audio",
    url: "https://shoutcast.ccma.cat/ccma/catalunyaradio.mp3",
    site: "https://www.3cat.cat/" },
  { id: "icat", name: "iCat", desc: "Música y cultura contemporánea",
    tags: ["Música", "Pública"], genre: "Alternativa", type: "audio",
    url: "https://shoutcast.ccma.cat/ccma/icatHD.mp3",
    site: "https://www.3cat.cat/" },
  { id: "los40", name: "LOS40", desc: "Pop y éxitos actuales",
    tags: ["Música"], genre: "Pop", type: "audio",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40.mp3",
    site: "https://los40.com/" },
  { id: "dial", name: "Cadena Dial", desc: "Música en español",
    tags: ["Música"], genre: "Música en español", type: "audio",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/CADENADIAL.mp3",
    site: "https://www.cadenadial.com/" },
  { id: "cadena100", name: "Cadena 100", desc: "Pop de ayer y de hoy",
    tags: ["Música"], genre: "Pop", type: "audio",
    url: "https://cadena100-cope-rrcast.flumotion.com/cope/cadena100.mp3",
    site: "https://www.cadena100.es/" },
  { id: "rockfm", name: "Rock FM", desc: "Clásicos del rock",
    tags: ["Música", "Rock"], genre: "Rock", type: "audio",
    url: "https://rockfm-cope-rrcast.flumotion.com/cope/rockfm.mp3",
    site: "https://www.rockfm.fm/" },
  { id: "kissfm", name: "Kiss FM", desc: "Grandes éxitos de los 80, 90 y hasta hoy",
    tags: ["Música", "Clásicos"], genre: "Clásicos", type: "audio",
    // The broadcaster's ad-handler issues a temporary signed streaming URL.
    // This MP3 endpoint may not expose CORS; ordinary <audio> playback is required.
    cors: "no-cors",
    url: "https://adhandler.kissfmradio.cires21.com/get_link?url=https://bbkissfm.kissfmradio.cires21.com/bbkissfm.mp3&lang=es",
    site: "https://www.kissfm.es/player/" },
  { id: "los40classic", name: "LOS40 Classic (antes M80 Radio)", desc: "Clásicos del pop y rock de los 80, 90 y 2000",
    tags: ["Música", "Clásicos"], genre: "Clásicos", type: "audio",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40_CLASSIC.mp3",
    site: "https://los40.com/los40_classic/" },
  { id: "radiole", name: "Radiolé", desc: "Copla, flamenco y rumba",
    tags: ["Música", "Flamenco"], genre: "Flamenco", type: "audio",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/RADIOLE.mp3",
    site: "https://www.radiole.com/" }
];
