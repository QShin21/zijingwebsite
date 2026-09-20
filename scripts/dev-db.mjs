import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
if (process.env.APP_ENV === "production")
  throw new Error("Development database only");
const url = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname))
  throw new Error("Local database only");
const pg = new EmbeddedPostgres({
  databaseDir: ".data/postgres",
  user: url.username,
  password: url.password,
  port: Number(url.port),
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
});
if (!fs.existsSync(".data/postgres/PG_VERSION")) await pg.initialise();
let stop;
if (process.platform === "win32") {
  const require = createRequire(import.meta.url),
    nativeRequire = createRequire(require.resolve("embedded-postgres"));
  const { pg_ctl } = await import(
    pathToFileURL(nativeRequire.resolve("@embedded-postgres/windows-x64")).href
  );
  const args = ["-D", ".data/postgres"];
  if (process.argv[2] === "stop") {
    execFileSync(pg_ctl, ["stop", ...args, "-m", "fast", "-w"], {
      windowsHide: true,
      stdio: "inherit",
    });
    process.exit(0);
  }
  try {
    execFileSync(pg_ctl, ["status", ...args], {
      windowsHide: true,
      stdio: "ignore",
    });
  } catch {
    execFileSync(
      pg_ctl,
      [
        "start",
        ...args,
        "-l",
        ".data/postgres.log",
        "-o",
        `-p ${url.port} -h 127.0.0.1`,
        "-w",
      ],
      { windowsHide: true, stdio: "inherit" },
    );
  }
  stop = () =>
    execFileSync(pg_ctl, ["stop", ...args, "-m", "fast", "-w"], {
      windowsHide: true,
      stdio: "inherit",
    });
} else {
  await pg.start();
  stop = () => pg.stop();
}
const client = pg.getPgClient();
await client.connect();
const db = url.pathname.slice(1);
if (!/^[a-z_][a-z0-9_]*$/.test(db)) throw new Error("Invalid database name");
if (
  !(await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [db]))
    .rowCount
)
  await client.query(`CREATE DATABASE "${db}"`);
await client.end();
console.log(`Development PostgreSQL ready on 127.0.0.1:${url.port}`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
