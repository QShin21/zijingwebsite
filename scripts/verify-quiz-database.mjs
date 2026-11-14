import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import EmbeddedPostgres from "embedded-postgres";

// Throwaway loopback database and synthetic accounts only. The subprocess never
// loads the project's .env or connects to the existing development database.
const root = process.cwd();
await fs.mkdir(path.join(root, ".data"), { recursive: true });
const directory = await fs.mkdtemp(path.join(root, ".data", "quiz-verify-"));
const port = await new Promise((resolve, reject) => {
  const server = net.createServer(); server.on("error", reject);
  server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); });
});
const user = "quiz_synthetic", password = "Quiz-Synthetic-Password-Only";
const databaseDir = path.join(directory, "pg");
const postgres = new EmbeddedPostgres({ databaseDir, port, user, password, persistent: true,
  postgresFlags: ["-h", "127.0.0.1"], onLog() {}, onError(message) { console.error(String(message)); } });
let pgCtl, started = false, web;
const env = { ...process.env, NODE_ENV: "development", APP_ENV: "development", DB_PUSH: "false", QUIZ_TEST: "isolated",
  DATABASE_URL: `postgresql://${user}:${password}@127.0.0.1:${port}/quiz_synthetic`, PAYLOAD_SECRET: "Quiz-Synthetic-Secret-Only-20261114",
  DOTENV_CONFIG_PATH: path.join(directory, "empty.env"), DOTENV_CONFIG_QUIET: "true", SERVER_URL: "http://localhost:3000",
  NEXT_PUBLIC_SERVER_URL: "http://localhost:3000", MEDIA_DIR: path.join(directory, "media"),
  QUESTIONNAIRE_AI_API_KEY: "", CONTENT_TRANSLATION_WORKER: "off", SMTP_HOST: "", S3_BUCKET: "", NEXT_TELEMETRY_DISABLED: "1" };
await fs.writeFile(env.DOTENV_CONFIG_PATH, "# isolated synthetic test\n");
await fs.mkdir(env.MEDIA_DIR);
let failed = false;
try {
  await postgres.initialise();
  if (process.platform === "win32") {
    const require = createRequire(import.meta.url), nativeRequire = createRequire(require.resolve("embedded-postgres"));
    ({ pg_ctl: pgCtl } = await import(pathToFileURL(nativeRequire.resolve("@embedded-postgres/windows-x64")).href));
    execFileSync(pgCtl, ["start", "-D", databaseDir, "-l", path.join(directory, "postgres.log"), "-o", `-p ${port} -h 127.0.0.1`, "-w"], { windowsHide: true, stdio: "inherit" });
  } else await postgres.start();
  started = true;
  const client = postgres.getPgClient(); await client.connect(); await client.query("CREATE DATABASE quiz_synthetic"); await client.end();
  console.log(`Isolated quiz test database: ${directory}`);
  async function run(args) {
    const status = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit", windowsHide: true });
      child.on("error", reject); child.on("close", resolve);
    });
    if (status !== 0) throw new Error(`Quiz verification failed: ${status}`);
  }
  await run(["--import", "tsx", "scripts/quiz-database-setup.ts"]);
  if (process.argv.includes("--browser")) {
    const webPort = await new Promise((resolve, reject) => {
      const server = net.createServer(); server.on("error", reject);
      server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); });
    });
    const origin = `http://127.0.0.1:${webPort}`;
    env.QUIZ_BROWSER_ORIGIN = origin; env.SERVER_URL = origin; env.NEXT_PUBLIC_SERVER_URL = origin;
    web = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(webPort)],
      { cwd: root, env: { ...env, NODE_ENV: "production", PORT: String(webPort) }, stdio: "inherit", windowsHide: true });
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { const response = await fetch(origin + "/health/ready"); if (response.ok) { ready = true; break; } } catch { /* Startup. */ }
      await delay(500);
    }
    if (!ready) throw new Error("Synthetic browser server did not become ready");
  }
  await run([path.join(root, "node_modules/vitest/vitest.mjs"), "run", "tests/quiz-prizes.integration.test.ts", "--reporter=default"]);
} catch (error) { failed = true; console.error(error); }
finally {
  if (web) web.kill();
  if (started) {
    if (process.platform === "win32") execFileSync(pgCtl, ["stop", "-D", databaseDir, "-m", "fast", "-w"], { windowsHide: true, stdio: "inherit" });
    else await postgres.stop();
  }
}
process.exit(failed ? 1 : 0);
