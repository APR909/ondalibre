/* SPDX-License-Identifier: MIT — OndaLibre
 * Applies the saved theme before first paint. With no saved choice the CSS
 * follows the system (prefers-color-scheme / prefers-contrast). */
(function () {
  try {
    var t = localStorage.getItem("ondalibre.theme");
    if (t === "dark" || t === "light" || t === "contrast") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) { /* storage unavailable: keep system theme */ }
})();
