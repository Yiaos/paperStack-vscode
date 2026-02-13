import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:53199",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        contextOptions: {
          // Bypass CSP for local development
          bypassCSP: true,
        },
        launchOptions: {
          args: [
            // Disable Private Network Access checks for local development
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 53199 --strictPort",
    port: 53199,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
