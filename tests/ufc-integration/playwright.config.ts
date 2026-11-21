import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testMatch: "checkout.spec.ts",
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    launchOptions: {
      // Restrict even WebSockets and SDK traffic that bypass Playwright routing.
      args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"],
    },
    channel: "chrome",
    baseURL: "http://127.0.0.1:48311",
    ignoreHTTPSErrors: true, // ephemeral, local Storage TLS certificate
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/ufc-integration/server.cjs",
      cwd: "../..",
      url: "http://127.0.0.1:48312/__test/ready",
      timeout: 60_000,
      reuseExistingServer: false,
      stderr: "pipe",
    },
    {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 48311",
      cwd: "../..",
      url: "http://127.0.0.1:48311/bet/fixture-ufc",
      timeout: 120_000,
      reuseExistingServer: false,
      stderr: "pipe",
    },
  ],
});
