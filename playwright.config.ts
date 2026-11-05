import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against the real Go API.
 * - default: starts `bun run dev` (:5174, /api proxied to :8080)
 * - E2E_BASE_URL=http://localhost:8082 runs against the nginx image instead
 * Credentials: ADMIN_USERNAME / ADMIN_PASSWORD (backend compose defaults admin / admin12345).
 */
const external = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: external ?? "http://localhost:5174",
    trace: "retain-on-failure",
    locale: "en-US",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /smoke/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /smoke/ },
  ],
  webServer: external
    ? undefined
    : { command: "bun run dev", url: "http://localhost:5174", reuseExistingServer: true, timeout: 60_000 },
});
