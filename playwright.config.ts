import { defineConfig, devices } from "@playwright/test";

// E2E tests run against the real app and the local Supabase stack
// (pnpm db:start). Auth emails are read from Mailpit.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true } },
  ],
  expect: { timeout: 10_000 },
  // A production build: stable and fast, unlike on-demand dev compilation.
  webServer: {
    command: "pnpm build && pnpm start --port 3000",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
