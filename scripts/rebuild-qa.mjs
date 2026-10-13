import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

// This runner intentionally never imports dotenv or a repository config in its
// own process. Every child gets an allowlisted synthetic environment and cwd.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repo, ".data/rebuild-qa-20261013");
const [action = "help", profileName = "main", ...args] = process.argv.slice(2);
const profiles = {
  main: { port: 55613, database: "zijing_rebuild_synthetic", user: "rebuild_synthetic" },
  consent: { port: 55614, database: "community_contact_consent_qa_synthetic", user: "consent_synthetic" },
  "post-edit": { port: 55615, database: "miniapp_post_edit_qa_synthetic", user: "miniapp_synthetic" },
  native: { port: 55578, database: "miniapp_team_qa_synthetic", user: "rebuild_synthetic" },
  "native-integration": { port: 55439, database: "zijing_integration_synthetic", user: "zijing" },
  "consent-web": { port: 40071, database: "community_contact_consent_web_qa_synthetic", user: "consent_synthetic" },
  visual: { port: 55616, database: "zijing_rebuild_clubqa_synthetic", user: "rebuild_synthetic" },
  contracts: { port: 55617, database: "zijing_rebuild_contracts_synthetic", user: "rebuild_synthetic" },
  browser: { port: 55618, database: "zijing_rebuild_browser_synthetic", user: "rebuild_synthetic" },
  "prod-browser": { port: 55619, database: "zijing_rebuild_prod_browser_synthetic", user: "rebuild_synthetic" },
};
const profile = profiles[profileName];
if (!profile) throw new Error("Unknown disposable QA profile");
const directory = profileName === "main" ? root : path.join(root, profileName);
const app = path.join(directory, "app");
const databaseDir = path.join(directory, "pg");
const password = "Synthetic-Rebuild-Only-20261013";
const empty = path.join(directory, "empty.env");
const databaseURL = `postgresql://${profile.user}:${password}@127.0.0.1:${profile.port}/${profile.database}`;
const serverPort = process.env.REBUILD_QA_SERVER_PORT || "3364";
if (!/^\d+$/.test(serverPort)) throw new Error("A numeric loopback server port is required");
const serverURL = `http://localhost:${serverPort}`;
const browserExecutable = process.env.REBUILD_QA_BROWSER || path.join(repo, ".data/visual-direction-browsers-20261013/chromium-1208/chrome-linux64/chrome");
const runLabel = process.env.REBUILD_QA_RUN_LABEL || `${action}-${Date.now()}`;
if (!/^[a-zA-Z0-9_-]+$/.test(runLabel)) throw new Error("Use a simple QA run label");
const visualTheme = process.env.REBUILD_QA_THEME || "light";
if (!["light", "dark"].includes(visualTheme)) throw new Error("Use light or dark for the synthetic visual run");
const allowedSource = [
  "src", "public", "tests", "scripts",
  "docs/privacy-page-20261013.json", "docs/PRIVACY_NOTICE_20261013.md",
  "miniprogram/src", "miniprogram/package.json", "miniprogram/project.config.json",
  "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json",
  "next-env.d.ts", "next.config.mjs", "postcss.config.mjs", "vitest.config.ts",
  "playwright.config.ts", "eslint.config.mjs", "AGENTS.md",
];
const safeEnv = {
  PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
  LANG: "C.UTF-8", TZ: "UTC", NODE_ENV: "development",
  APP_ENV: "development", DATABASE_URL: databaseURL, DB_PUSH: "false",
  PAYLOAD_SECRET: "Synthetic-Rebuild-QA-20261013-Not-A-Production-Secret",
  PAYLOAD_CONFIG_PATH: path.join(app, "src/payload.config.ts"),
  DOTENV_CONFIG_PATH: empty, DOTENV_CONFIG_QUIET: "true",
  SERVER_URL: serverURL, NEXT_PUBLIC_SERVER_URL: serverURL,
  MEDIA_DIR: path.join(directory, "media"),
  SMTP_HOST: "", SMTP_PORT: "2526", SMTP_FROM: "synthetic@example.invalid",
  SMTP_USER: "synthetic", SMTP_PASSWORD: "synthetic",
  S3_BUCKET: "", S3_REGION: "", S3_ENDPOINT: "", S3_ACCESS_KEY_ID: "", S3_SECRET_ACCESS_KEY: "",
  QUESTIONNAIRE_AI_API_KEY: "", QUESTIONNAIRE_AI_LIVE_TEST: "0", QUESTIONNAIRE_AI_BASE_URL: "",
  NEXT_TELEMETRY_DISABLED: "1", DISABLE_PAYLOAD_HMR: "true",
  COMMUNITY_CONTACT_CONSENT_DB_PORT: String(profile.port), MINIAPP_POST_EDIT_DB_PORT: String(profile.port),
  REBUILD_QA_ROOT: directory, REBUILD_QA_PROFILE: profileName, REBUILD_QA_SERVER_PORT: serverPort,
  REBUILD_QA_BROWSER: browserExecutable,
  REBUILD_QA_RUN_LABEL: runLabel,
  CLUB_EVIDENCE_DIR: path.join(directory, "evidence"),
  CLUB_THEME_INTEGRATED: "true", CLUB_STYLE_THEME: visualTheme,
};

async function prepare() {
  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(path.join(directory, "media"), { recursive: true });
  await fs.mkdir(path.join(directory, "logs"), { recursive: true });
  await fs.writeFile(empty, "", { mode: 0o600 });
  await fs.writeFile(path.join(directory, "SYNTHETIC_ONLY.json"), JSON.stringify({
    task: "frontend-rebuild-20261013", profile: profileName, host: "127.0.0.1",
    port: profile.port, database: profile.database, user: profile.user,
    databaseDir, mediaDir: safeEnv.MEDIA_DIR, runtime: app,
    production: false, notifications: false,
  }, null, 2) + "\n");
  await fs.writeFile(path.join(directory, "environment.json"), JSON.stringify({
    environmentAllowlist: Object.keys(safeEnv),
    appEnvironment: safeEnv.APP_ENV, nodeEnvironment: safeEnv.NODE_ENV,
    database: { hostname: "127.0.0.1", port: profile.port, name: profile.database, user: profile.user, syntheticCredentialsOnly: true },
    automaticSchemaPush: false, dotenvPath: empty,
    nextAndPayloadEnvironmentSentinel: path.join(app, ".env"),
    mediaDirectory: safeEnv.MEDIA_DIR, serverURL, browserExecutable,
    smtp: { seedAndVitest: "disabled", devAndPlaywright: "127.0.0.1:2526", builtBrowser: profileName === "prod-browser" ? "127.0.0.1:2526" : "disabled", syntheticRecipientsOnly: true },
    realS3: false, realAI: false, externalNotifications: false,
    inheritedAppEnvironment: false,
  }, null, 2) + "\n");
}

async function sync() {
  await prepare();
  await fs.mkdir(app, { recursive: true });
  await fs.mkdir(path.join(app, "docs/evidence"), { recursive: true });
  // Payload's CLI searches parent directories if no .env file was loaded.
  // A new empty sentinel stops that search; it is never copied from the repo.
  await fs.writeFile(path.join(app, ".env"), "# Synthetic QA sentinel: intentionally empty.\n", { mode: 0o600 });
  for (const item of allowedSource) {
    try {
      await fs.cp(path.join(repo, item), path.join(app, item), {
        recursive: true, force: true,
        filter: (source) => !path.basename(source).startsWith(".env") && !path.basename(source).includes("private.config"),
      });
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  try { await fs.symlink(path.join(repo, "node_modules"), path.join(app, "node_modules"), "dir"); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  await fs.writeFile(path.join(directory, "snapshot.json"), JSON.stringify({
    createdAt: new Date().toISOString(), source: repo, allowlist: allowedSource,
    rootEnvironmentRead: false, ownEmptyEnvironmentSentinel: true,
  }, null, 2) + "\n");
  console.log(`Synthetic ${profileName} snapshot ready: ${app}`);
}

async function portAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
  });
}

async function child(command, childArgs, extraEnv = {}) {
  await prepare();
  const startedAt = new Date().toISOString();
  const proc = spawn(command, childArgs, { cwd: app, env: { ...safeEnv, ...extraEnv }, stdio: "inherit" });
  const completion = new Promise((resolve, reject) => {
    proc.once("error", reject); proc.once("close", (value) => resolve(value ?? 1));
  });
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => proc.kill(signal));
  const processDirectory = path.join(directory, "processes");
  const processFile = path.join(processDirectory, `${runLabel}.json`);
  const processRecord = {
    action, profile: profileName, label: runLabel, startedAt,
    runnerPID: process.pid, childPID: proc.pid, cwd: app,
    executable: path.basename(command), status: "running",
  };
  const [code] = await Promise.all([
    completion,
    (async () => {
      await fs.mkdir(processDirectory, { recursive: true });
      await fs.writeFile(processFile, JSON.stringify(processRecord, null, 2) + "\n");
    })(),
  ]);
  await fs.appendFile(path.join(directory, "runs.jsonl"), JSON.stringify({
    action, profile: profileName, label: runLabel, startedAt, finishedAt: new Date().toISOString(),
    cwd: app, executable: path.basename(command),
    suites: childArgs.filter((argument) => /^tests\//.test(argument)),
    effectiveServerURL: extraEnv.SERVER_URL || safeEnv.SERVER_URL,
    effectiveSMTPHost: extraEnv.SMTP_HOST ?? safeEnv.SMTP_HOST,
    effectiveNodeEnvironment: extraEnv.NODE_ENV || safeEnv.NODE_ENV,
    visualTheme,
    exitCode: code,
  }) + "\n");
  await fs.writeFile(processFile, JSON.stringify({
    ...processRecord, status: "finished", finishedAt: new Date().toISOString(), exitCode: code,
  }, null, 2) + "\n");
  process.exitCode = code;
}

if (action === "sync" || action === "init") await sync();
else if (action === "environment") {
  await prepare();
  console.log(`Synthetic environment metadata: ${path.join(directory, "environment.json")}`);
}
else if (action === "db") {
  // Loading embedded-postgres installs a process exit hook. Keep it out of
  // test/migration runners so a failing child retains its real exit status.
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  await prepare();
  await portAvailable(profile.port); // Never connect to or stop an existing process.
  const postgres = new EmbeddedPostgres({
    databaseDir, port: profile.port, user: profile.user, password, persistent: true,
    postgresFlags: ["-h", "127.0.0.1", "-k", directory],
    onLog: (message) => { if (/ready to accept connections/.test(String(message))) console.log(`Synthetic ${profileName} PostgreSQL ready at 127.0.0.1:${profile.port}`); },
    onError: (error) => console.error(String(error)),
  });
  try { await fs.access(path.join(databaseDir, "PG_VERSION")); }
  catch { await postgres.initialise(); }
  await postgres.start();
  const client = postgres.getPgClient(); await client.connect();
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [profile.database])).rowCount)
    await client.query(`CREATE DATABASE "${profile.database}"`);
  await client.end();
  console.log(`Disposable ${profileName} database ready; only this process owns ${databaseDir}`);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await postgres.stop(); process.exit(0); });
  setInterval(() => {}, 60000);
} else if (action === "migrate") {
  await child(process.execPath, [path.join(repo, "node_modules/payload/bin.js"), "migrate"]);
} else if (action === "seed") {
  await child(process.execPath, [path.join(repo, "node_modules/tsx/dist/cli.mjs"), "scripts/demo.ts"]);
  if (!process.exitCode) await child(process.execPath, [path.join(repo, "node_modules/tsx/dist/cli.mjs"), "scripts/rebuild-qa-seed.ts"]);
} else if (action === "dev") {
  await portAvailable(Number(serverPort));
  await child(process.execPath, [path.join(repo, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", serverPort], { SMTP_HOST: "127.0.0.1" });
} else if (action === "build") {
  await child(process.execPath, [path.join(repo, "node_modules/next/dist/bin/next"), "build", "--webpack", ...args], { NODE_ENV: "production" });
} else if (action === "start") {
  await portAvailable(Number(serverPort));
  await child(process.execPath, [path.join(repo, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", serverPort], {
    NODE_ENV: "production", SMTP_HOST: profileName === "prod-browser" ? "127.0.0.1" : "",
  });
} else if (action === "copy-build") {
  if (!["prod-browser", "visual", "consent-web"].includes(profileName))
    throw new Error("Production artifact copies are restricted to dedicated synthetic browser profiles");
  await portAvailable(Number(serverPort));
  const buildSource = path.join(root, "contracts/app/.next");
  const buildID = (await fs.readFile(path.join(buildSource, "BUILD_ID"), "utf8")).trim();
  if (!buildID) throw new Error("A completed contracts production build is required");
  await prepare();
  await fs.rm(path.join(app, ".next"), { recursive: true, force: true });
  await fs.cp(buildSource, path.join(app, ".next"), {
    recursive: true,
    filter: (source) => !["cache", "dev"].includes(path.basename(source)),
  });
  await fs.writeFile(path.join(directory, "production-artifact.json"), JSON.stringify({
    copiedAt: new Date().toISOString(), source: buildSource, buildID,
    destination: path.join(app, ".next"), appEnvironment: "development",
    syntheticDatabase: profile.database, deployment: false,
  }, null, 2) + "\n");
  console.log(`Copied completed synthetic production artifact to ${profileName}; build ID ${buildID}`);
} else if (action === "vitest") {
  await child(process.execPath, [path.join(repo, "node_modules/vitest/vitest.mjs"), "run", ...args], { SERVER_URL: "http://localhost:3000", NEXT_PUBLIC_SERVER_URL: "http://localhost:3000" });
} else if (action === "playwright") {
  await child(process.execPath, [path.join(repo, "node_modules/@playwright/test/cli.js"), "test", "--config", "scripts/rebuild-qa-playwright.config.ts", ...args], { SMTP_HOST: "127.0.0.1" });
} else if (action === "exec") {
  if (!args.length) throw new Error("Provide an executable and arguments after the profile");
  await child(args[0], args.slice(1));
} else {
  console.log(`Usage: node scripts/rebuild-qa.mjs init|sync|environment|db|migrate|seed|dev|build|start|copy-build|vitest|playwright|exec [${Object.keys(profiles).join("|")}] [arguments]`);
  console.log("All work is limited to .data/rebuild-qa-20261013. Use REBUILD_QA_SERVER_PORT=3000 only for legacy E2E hardcoded origins; default is 3364.");
}
