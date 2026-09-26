import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    // Browser tests use a loopback-only SMTP receiver, never a real mailbox.
    env: {
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "2526",
      SMTP_FROM: "test@example.invalid",
      SMTP_USER: "test",
      SMTP_PASSWORD: "test",
    },
    url: "http://localhost:3000/health/live",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
