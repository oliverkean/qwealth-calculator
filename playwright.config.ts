import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone-320",
      use: {
        viewport: { width: 320, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-336",
      use: {
        viewport: { width: 336, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-375",
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-640",
      use: { viewport: { width: 640, height: 1024 }, hasTouch: true },
    },
    {
      name: "tablet-768",
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    { name: "laptop-1024", use: { viewport: { width: 1024, height: 900 } } },
    { name: "laptop-1280", use: { viewport: { width: 1280, height: 900 } } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "wide-1920", use: { viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
