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
  await expect(page.locator("#list li.st")).toHaveCount(41);
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
