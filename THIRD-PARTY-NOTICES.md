# Third-party notices

OndaLibre's own code (everything outside `lib/`) is MIT-licensed — see `LICENSE`.

| Component | Version | File | Licence | Copyright |
|---|---|---|---|---|
| [hls.js](https://github.com/video-dev/hls.js) | 1.6.13 (light build) | `lib/hls.light.min.js` | Apache-2.0 | © 2017 Dailymotion and contributors; portions © 2013–2015 Brightcove |

The full hls.js licence text is in `lib/hls.js.LICENSE.txt` and must stay with the file when you
redistribute it. Change made to the upstream file: the trailing `sourceMappingURL` comment was removed
(the source map is not shipped). Nothing else was altered.

Nothing else is bundled: no fonts, icon sets, third-party images, CSS frameworks or analytics.
Station logo URLs in `stations.js` point to independently hosted broadcaster artwork (listed in the
[TDTChannels radio directory](https://github.com/LaQuay/TDTChannels/blob/master/RADIO.md)).
Those images are not included in the repository and are not covered by OndaLibre's MIT licence.
Their owners retain all relevant rights; an image URL is not a reuse licence. The logo and icons in
`assets/` and `index.html` were drawn for this project and are covered by the MIT licence.
