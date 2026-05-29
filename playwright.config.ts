import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config dédiée aux tests Golden Phase 2B Mettrik.
 *
 * - Cible : Chromium uniquement (économie RAM Mac fragile).
 * - 1 worker max (instance unique, RAM ~250 MB).
 * - Base URL = staging Vercel niveau 2 (audit_token requis pour bypass auth gate).
 */
export default defineConfig({
  testDir: "./tests/golden",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "https://mettrik-niveau2.vercel.app",
    headless: true,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
