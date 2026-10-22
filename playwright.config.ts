import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke config.
 *
 * WHY THIS SHAPE
 * The storefront server-renders `getAllRaffles`, so a test must run against a
 * live functions endpoint. Booting the mock (port 3001) and the app (port 4000,
 * separate from the 3000/3111 dev/preview ports so a stray server never makes a
 * run look green) makes `npm run test:e2e` self-contained and credential-free.
 *
 * The Next server is started WITHOUT NEXT_PUBLIC_API_BASE_URL being re-read at
 * runtime: those values are inlined at build time, so `webServer` builds first
 * (`next build`) with the env below and then serves that build. Reusing an old
 * .next would silently point the tests at production.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        channel: "chrome",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: [
    {
      command: "node mock/server.mjs",
      url: "http://127.0.0.1:3001/raffleapp-dbc1b/us-central1/getAllRaffles",
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
      stdout: "pipe",
    },
    {
      command: "npm run e2e:serve",
      url: "http://127.0.0.1:4000",
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL:
          "http://127.0.0.1:3001/raffleapp-dbc1b/us-central1",
        NEXT_PUBLIC_QUICK_TICKET_BASE_URL: "http://127.0.0.1:3001/quick-ticket",
        NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:4000",
      },
      stdout: "pipe",
    },
  ],
});
