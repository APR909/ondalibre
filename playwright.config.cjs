/* SPDX-License-Identifier: MIT — OndaLibre
 * Real Chromium browser smoke tests, desktop and Android-sized viewport.
 * Test media is mocked; no live station or Google account is contacted.
 */
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.cjs",
  timeout: 25000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "desktop-chromium",
      use: { viewport: { width: 1280, height: 900 } } },
    { name: "android-viewport-chromium",
      use: { viewport: { width: 390, height: 844 },
        isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }
  ],
  webServer: {
    command: "node tests/serve.cjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 15000
  }
});
