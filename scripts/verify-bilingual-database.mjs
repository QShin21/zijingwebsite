import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";

// Bilingual translation queue verification on a throwaway embedded PostgreSQL.
// Never reads .env, never connects to an existing server, never calls a real AI provider
// (tests stub fetch with a synthetic key). Synthetic data/logs are retained under .data/.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await fs.mkdir(path.join(repo, ".data"), { recursive: true });
const directory = await fs.mkdtemp(path.join(repo, ".data/bilingual-verify-"));
const port = await new Promise((resolve, reject) => {
  const server = net.createServer(); server.on("error", reject);
  server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); });
});
const user = "zijing_bilingual_synthetic", password = "Synthetic-Only-Bilingual-Database";
const postgres = new EmbeddedPostgres({ databaseDir: path.join(directory, "pg"), port, user, password, persistent: true,
  postgresFlags: ["-h", "127.0.0.1", "-k", ""], onLog() {}, onError(message) { console.error(String(message)); } });
const env = {
  PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8", TZ: "UTC",
  NODE_ENV: "development", APP_ENV: "development", DB_PUSH: "false", BILINGUAL_TEST: "isolated",
  DATABASE_URL: `postgresql://${user}:${password}@127.0.0.1:${port}/bilingual_synthetic`,
  PAYLOAD_SECRET: "Synthetic-Only-Bilingual-Secret-20261114",
  DOTENV_CONFIG_PATH: path.join(directory, "empty.env"), DOTENV_CONFIG_QUIET: "true",
  SERVER_URL: "http://localhost:3000", NEXT_PUBLIC_SERVER_URL: "http://localhost:3000",
  MEDIA_DIR: path.join(directory, "media"), SMTP_HOST: "", S3_BUCKET: "", QUESTIONNAIRE_AI_API_KEY: "", QUESTIONNAIRE_AI_BASE_URL: "",
  NEXT_TELEMETRY_DISABLED: "1", DISABLE_PAYLOAD_HMR: "true",
};
await fs.writeFile(env.DOTENV_CONFIG_PATH, "# synthetic\n");
await fs.mkdir(env.MEDIA_DIR);
async function run(args, logName) {
  const log = await fs.open(path.join(directory, logName), "w");
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] });
      const write = (chunk) => { process.stdout.write(chunk); void log.write(chunk); };
      child.stdout.on("data", write); child.stderr.on("data", write);
      child.on("error", reject);
      child.on("close", resolve);
    });
    if (code !== 0) throw new Error(`${logName} failed (exit ${code})`);
  } finally { await log.close(); }
}
let failed = false;
try {
  await postgres.initialise(); await postgres.start();
  const client = postgres.getPgClient(); await client.connect();
  await client.query("CREATE DATABASE bilingual_synthetic"); await client.end();
  console.log(`Isolated synthetic run: ${directory}`);
  await run(["--import", "tsx", "scripts/bilingual-database-setup.ts"], "upgrade.log");
  await run([path.join(repo, "node_modules/vitest/vitest.mjs"), "run", "tests/content-translation.integration.test.ts", "--reporter=default"], "integration.log");
} catch (error) { failed = true; console.error(error); }
finally {
  if (postgres.process?.exitCode === null) await postgres.stop();
  else postgres.process = undefined;
}
console.log(`Synthetic logs retained: ${directory}`);
process.exit(failed ? 1 : 0);
