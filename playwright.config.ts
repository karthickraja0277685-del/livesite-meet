import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // Ensure Chromium resolves `*.sites.localhost` to 127.0.0.1 automatically
          args: ["--host-resolver-rules=MAP *.sites.localhost 127.0.0.1"]
        }
      }
    }
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ALLOW_E2E_TEST_AUTH: "true",
      NEXT_PUBLIC_SITES_BASE_DOMAIN: "sites.localhost:3000"
    }
  }
});