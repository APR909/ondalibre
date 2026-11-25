/* SPDX-License-Identifier: MIT — OndaLibre
 * Browser smoke tests with deterministic HTMLMediaElement responses.
 * Do not claim these tests verify real radio availability or Android background audio.
 */
"use strict";
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  const exceptions = [];
  page.__uncaught = exceptions;
  page.on("pageerror", error => exceptions.push(error.message));
  // The test must be fully deterministic: no outbound logos, streams, Google
  // SDK or metadata endpoints are requested during browser smoke runs.
  await page.route(/^https:\/\//, route => route.abort());
  await page.addInitScript(() => {
    const playing = new WeakMap();
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true, get() { return !(playing.get(this)); }
    });
    HTMLMediaElement.prototype.play = function () {
      playing.set(this, true);
      queueMicrotask(() => this.dispatchEvent(new Event("playing")));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      playing.set(this, false);
      this.dispatchEvent(new Event("pause"));
    };
    HTMLMediaElement.prototype.load = function () {};
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
});

test.afterEach(async ({ page }) => {
  expect(page.__uncaught || [], "Uncaught browser JavaScript exceptions").toEqual([]);
});

test("homepage, radio directory, and accessibility essentials render", async ({ page }) => {
  await expect(page.locator("#list li.st")).toHaveCount(60);
  await expect(page.getByRole("heading", { name: "Para ti" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Favoritas", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Escuchadas recientemente" })).toBeVisible();
  await expect(page.locator("#personalFavorites .personal-empty")).toBeVisible();
  await expect(page.locator("#personalRecents .personal-empty")).toBeVisible();
  // Mobile browsers use hardware volume buttons, so the slider is hidden there.
  // It remains in the DOM for persisted settings and desktop rendering.
  await expect(page.locator("#vol")).toHaveCount(1);
  if (test.info().project.name === "android-viewport-chromium") {
    await expect(page.locator("#vol")).toBeHidden();
  } else {
    await expect(page.getByRole("slider", { name: "Volumen" })).toBeVisible();
  }
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(node => node.id);
    return ids.filter((id,i) => ids.indexOf(id)!==i);
  });
  expect(duplicateIds).toEqual([]);
});

test("search, favorite, quick playback, and recents work without external streams", async ({ page }) => {
  await page.locator("#q").fill("Rock FM");
  await expect(page.locator("#list li.st")).toHaveCount(1);
  await page.locator("#list .st-fav").click();
  const quick = page.locator('#personalFavorites [data-quick-play="rockfm"]');
  await expect(quick).toBeVisible();
  await quick.click();
  await expect(page.locator("#nowName")).toHaveText("Rock FM");
  await expect(page.locator("#nowState")).toHaveText("En directo");
  await expect(page.locator('#personalRecents [data-quick-play="rockfm"]')).toBeVisible();
  await expect(page.locator(".player")).toHaveAttribute("data-playing", "true");
  await quick.click();
  await expect(page.locator("#nowState")).toHaveText("Parado");
  await expect(page.locator('#personalRecents [data-quick-play="rockfm"]')).toHaveCount(1);
});

test("local favorites, recents, volume and theme survive refresh", async ({ page }) => {
  await page.locator("#q").fill("Rock FM");
  await page.locator("#list .st-fav").click();
  await page.locator('#personalFavorites [data-quick-play="rockfm"]').click();
  await expect(page.locator("#nowState")).toHaveText("En directo");
  await page.locator('[data-theme-btn="light"]').click();
  await page.locator("#vol").evaluate(element => {
    element.value = "35";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#volValue")).toHaveText("35%");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('#personalFavorites [data-quick-play="rockfm"]')).toBeVisible();
  await expect(page.locator('#personalRecents [data-quick-play="rockfm"]')).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#volValue")).toHaveText("35%");
  await expect(page.locator("#nowState")).toHaveText("Parado");
});

test("favorite list and recent-history clearing do not erase favorites", async ({ page }) => {
  await page.locator("#q").fill("Rock FM");
  await page.locator("#list .st-fav").click();
  await page.locator('#personalFavorites [data-quick-play="rockfm"]').click();
  await expect(page.locator('#personalRecents [data-quick-play="rockfm"]')).toBeVisible();
  await page.locator("#personalClearRecents").click();
  await expect(page.locator("#personalRecents .personal-empty")).toBeVisible();
  await expect(page.locator('#personalFavorites [data-quick-play="rockfm"]')).toBeVisible();
  await page.locator("#personalShowFavorites").click();
  await expect(page.locator("#list li.st")).toHaveCount(1);
  await expect(page.locator("#btnFav")).toHaveAttribute("aria-pressed", "true");
});

test("About, settings and 390px layout remain navigable", async ({ page }) => {
  await page.locator('a[data-nav="about"]').click();
  await expect(page.locator("#about")).toBeVisible();
  await expect(page.locator("#home")).toBeHidden();
  await page.locator('a[data-nav="home"]').click();
  await expect(page.locator("#home")).toBeVisible();
  await page.locator('[data-theme-btn="contrast"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "contrast");
  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport + 2);
});


test("grouped content, genre and region selectors are labeled and show station counts", async ({ page }) => {
  await expect(page.getByLabel("Contenido", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Género", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Zona", { exact: true })).toBeVisible();
  await expect(page.locator("#filterCount")).toHaveText("60 emisoras disponibles");
  await expect(page.locator("#clearFilters")).toBeHidden();
  await expect(page.locator("#filterRegion option[value='Andalucía']")).toHaveText("Andalucía");
  await expect(page.locator("#filterRegion option[value='granada']")).toContainText("Granada");
  await expect(page.locator("#filterGenre option[value='Clásica']")).toHaveText("Clásica");
});

test("content choices filter music/news and genres adapt to the chosen type", async ({ page }) => {
  await page.locator("#filterType").selectOption("music");
  await expect(page.locator("#list li.st")).toHaveCount(27);
  await expect(page.locator("#list [data-id='rockfm']")).toHaveCount(1);
  await expect(page.locator("#list [data-id='radio5']")).toHaveCount(0);
  await page.locator("#filterGenre").selectOption("Rock");
  await expect(page.locator("#list li.st")).toHaveCount(1);
  await expect(page.locator("#list [data-id='rockfm']")).toHaveCount(1);
  await page.locator("#filterType").selectOption("news");
  await expect(page.locator("#filterGenre")).toHaveValue("all");
  await expect(page.locator("#filterGenre option[value='Rock']")).toHaveCount(0);
  await expect(page.locator("#list li.st")).toHaveCount(33);
  await expect(page.locator("#list [data-id='radio5']")).toHaveCount(1);
});

test("autonomous community includes regional public stations and Granada locals", async ({ page }) => {
  await page.locator("#filterRegion").selectOption("Andalucía");
  await expect(page.locator("#list li.st")).toHaveCount(9);
  await expect(page.locator("#list [data-id='canalsur']")).toHaveCount(1);
  await expect(page.locator("#list [data-id='canalfiesta']")).toHaveCount(1);
  await page.locator("#filterRegion").selectOption("Cataluña");
  await expect(page.locator("#list li.st")).toHaveCount(8);
  await expect(page.locator("#list [data-id='catradio']")).toHaveCount(1);
  await expect(page.locator("#list [data-id='icat']")).toHaveCount(1);
  await page.locator("#filterRegion").selectOption("granada");
  await expect(page.locator("#list li.st")).toHaveCount(5);
  await expect(page.locator("#list [data-id='sergranada']")).toHaveCount(1);
  await expect(page.locator("#list [data-id='rockfm']")).toHaveCount(0);
});

test("combinable filters report correct count and can be cleared together", async ({ page }) => {
  await page.locator("#filterType").selectOption("music");
  await page.locator("#filterRegion").selectOption("Andalucía");
  await expect(page.locator("#list li.st")).toHaveCount(4);
  await expect(page.locator("#filterCount")).toHaveText("Mostrando 4 de 60 emisoras");
  await page.locator("#filterGenre").selectOption("Reguetón");
  await expect(page.locator("#list li.st")).toHaveCount(1);
  await expect(page.locator("#list [data-id='gozaderafm']")).toHaveCount(1);
  await page.locator("#q").fill("no-existe");
  await expect(page.locator("#list li.empty")).toHaveCount(1);
  await expect(page.locator("#filterCount")).toHaveText("Mostrando 0 de 60 emisoras");
  await page.locator("#clearFilters").click();
  await expect(page.locator("#list li.st")).toHaveCount(60);
  await expect(page.locator("#filterType")).toHaveValue("all");
  await expect(page.locator("#filterGenre")).toHaveValue("all");
  await expect(page.locator("#filterRegion")).toHaveValue("all");
  await expect(page.locator("#q")).toHaveValue("");
  await expect(page.locator("#clearFilters")).toBeHidden();
});

test("search ignores accents and includes region and music metadata", async ({ page }) => {
  await page.locator("#q").fill("clasica");
  await expect(page.locator("#list [data-id='radioclasica']")).toHaveCount(1);
  await page.locator("#q").fill("pais vasco");
  await expect(page.locator("#list li.st")).toHaveCount(7);
  await page.locator("#q").fill("galicia");
  await expect(page.locator("#list li.st")).toHaveCount(2);
  await page.locator("#q").fill("");
  await expect(page.locator("#list li.st")).toHaveCount(60);
});

test("popular shortcuts reset other filters without changing audio", async ({ page }) => {
  await page.locator("#q").fill("Rock FM");
  await page.locator("#list .st-fav").click();
  await page.locator("#btnFav").click();
  await page.locator("#filterType").selectOption("music");
  await page.locator('#chips [data-preset="granada"]').click();
  await expect(page.locator("#list li.st")).toHaveCount(5);
  await expect(page.locator("#filterRegion")).toHaveValue("granada");
  await expect(page.locator("#btnFav")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#q")).toHaveValue("");
  await expect(page.locator('#chips [data-preset="granada"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('#chips [data-preset="news"]').click();
  await expect(page.locator("#list li.st")).toHaveCount(33);
  await page.locator('#chips [data-preset="all"]').click();
  await expect(page.locator("#list li.st")).toHaveCount(60);
  await expect(page.locator('#personalFavorites [data-quick-play="rockfm"]')).toBeVisible();
});

test("custom stations appear in dedicated type and zone and can be deleted", async ({ page }) => {
  await page.locator("#btnAdd").click();
  await page.locator("#fName").fill("Mi Radio Demo");
  await page.locator("#fUrl").fill("https://example.invalid/live.mp3");
  await page.locator('#frm button[value="ok"]').click();
  await page.locator("#filterType").selectOption("custom");
  await expect(page.locator("#list li.st")).toHaveCount(1);
  await expect(page.locator("#filterGenre option[value='Personalizadas']")).toHaveCount(1);
  await page.locator("#filterRegion").selectOption("custom");
  await expect(page.locator("#list li.st")).toHaveCount(1);
  await expect(page.locator("#list .st-name")).toHaveText("Mi Radio Demo");
  await page.locator("#list .st-del").click();
  await expect(page.locator("#list li.empty")).toHaveCount(1);
  await page.locator("#clearFilters").click();
  await expect(page.locator("#list li.st")).toHaveCount(60);
});

test("view all favorites clears category filters but preserves favorites", async ({ page }) => {
  await page.locator("#q").fill("Rock FM");
  await page.locator("#list .st-fav").click();
  await page.locator("#filterRegion").selectOption("Andalucía");
  await expect(page.locator("#list li.empty")).toHaveCount(1);
  await page.locator("#personalShowFavorites").click();
  await expect(page.locator("#list li.st")).toHaveCount(1);
  await expect(page.locator("#list [data-id='rockfm']")).toHaveCount(1);
  await expect(page.locator("#filterRegion")).toHaveValue("all");
  await expect(page.locator("#filterType")).toHaveValue("all");
  await expect(page.locator("#q")).toHaveValue("");
  await expect(page.locator("#btnFav")).toHaveAttribute("aria-pressed", "true");
});


test("expanded 19 stations appear with individual search results", async ({ page }) => {
  for (const id of ["radiomarca", "capitalradio", "radiointereconomia",
    "los40urban", "los40dance", "radiomaria", "rac105", "flaixfm",
    "flaixbac", "radioteletaxi", "apunt", "ondaregional",
    "ondaregionalmusica", "ondavasca", "flamencoradio",
    "copegranada", "ondacadiz", "esradiocyl", "radio7"]) {
    await expect(page.locator('#list [data-id="' + id + '"]')).toHaveCount(1);
  }
  await page.locator("#q").fill("economia");
  await expect(page.locator("#list [data-id='capitalradio']")).toHaveCount(1);
  await expect(page.locator("#list [data-id='radiointereconomia']")).toHaveCount(1);
  await page.locator("#q").fill("flamenco");
  await expect(page.locator("#list [data-id='flamencoradio']")).toHaveCount(1);
});

test("new autonomous communities and COPE Granada filter correctly", async ({ page }) => {
  await page.locator("#filterRegion").selectOption("Comunidad Valenciana");
  await expect(page.locator("#list [data-id='apunt']")).toHaveCount(1);
  await page.locator("#filterRegion").selectOption("Murcia");
  await expect(page.locator("#list li.st")).toHaveCount(2);
  await page.locator("#filterType").selectOption("music");
  await expect(page.locator("#list [data-id='ondaregionalmusica']")).toHaveCount(1);
  await expect(page.locator("#list [data-id='ondaregional']")).toHaveCount(0);
  await page.locator("#filterRegion").selectOption("Castilla y León");
  await expect(page.locator("#list li.empty")).toHaveCount(1);
  await page.locator("#filterType").selectOption("news");
  await expect(page.locator("#list [data-id='esradiocyl']")).toHaveCount(1);
  await page.locator("#filterRegion").selectOption("granada");
  await expect(page.locator("#list [data-id='copegranada']")).toHaveCount(1);
  await page.locator("#filterType").selectOption("all");
  await expect(page.locator("#list li.st")).toHaveCount(5);
});

test("new MP3 stations use existing player and recent/favorite panels", async ({ page }) => {
  await page.locator("#q").fill("Radio Marca");
  await page.locator("#list [data-id='radiomarca'] .st-fav").click();
  await page.locator("#list [data-id='radiomarca'] .st-main").click();
  await expect(page.locator("#nowName")).toHaveText("Radio Marca");
  await expect(page.locator("#nowState")).toHaveText("En directo");
  await expect(page.locator('#personalFavorites [data-quick-play="radiomarca"]')).toBeVisible();
  await expect(page.locator('#personalRecents [data-quick-play="radiomarca"]')).toBeVisible();
  await page.locator("#q").fill("LOS40 Dance");
  await page.locator("#list [data-id='los40dance'] .st-main").click();
  await expect(page.locator("#nowName")).toHaveText("LOS40 Dance");
  await expect(page.locator("#nowState")).toHaveText("En directo");
  await expect(page.locator('#personalRecents [data-quick-play="los40dance"]')).toBeVisible();
});
