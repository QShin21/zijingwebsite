import { defineConfig } from "@playwright/test";
import path from "node:path";
import { existsSync } from "node:fs";

const root = process.env.REBUILD_QA_ROOT;
const port = process.env.REBUILD_QA_SERVER_PORT || "3364";
const browserExecutable = process.env.REBUILD_QA_BROWSER;
const label = process.env.REBUILD_QA_RUN_LABEL || "playwright";
if (!root?.includes("/.data/rebuild-qa-20261013") || !/^\d+$/.test(port))
  throw new Error("Use the dedicated rebuild QA runner");
if (!browserExecutable || !existsSync(browserExecutable))
  throw new Error("The approved existing QA Chromium executable is required");
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error("Use a simple QA run label");
const output = path.join(root, "runs", label);
export default defineConfig({
  testDir: "../tests/e2e", fullyParallel: false, workers: 1,
  timeout: 90000, expect: { timeout: 15000 },
  outputDir: path.join(output, "test-results"),
  reporter: [["list"], ["json", { outputFile: path.join(output, "playwright-results.json") }],
    ["html", { outputFolder: path.join(output, "playwright-report"), open: "never" }]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure", screenshot: "only-on-failure",
    launchOptions: { executablePath: browserExecutable } },
  // The dedicated server is started explicitly by rebuild-qa.mjs dev. This
  // config never starts the root package script or reuses an unknown server.
});
