import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import pg from "pg";
import os from 'node:os';
const base = path.resolve(process.env.BACKUP_DEST || "backups");
const command = process.argv[2] || "create";
const source = new URL(process.env.DATABASE_URL);
const bin =
  process.env.PG_BIN ||
  (process.platform === "win32" ? ".data/tools/pgsql/bin" : "");
const executable = (name) =>
  bin
    ? path.resolve(bin, name + (process.platform === "win32" ? ".exe" : ""))
    : name;
const envFor = (u) => ({
  ...process.env,
  PGHOST: u.hostname,
  PGPORT: u.port || "5432",
  PGUSER: decodeURIComponent(u.username),
  PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: u.pathname.slice(1),
});
function run(name, args, url) {
  execFileSync(executable(name), args, {
    env: envFor(url),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
const hash = (data) => createHash("sha256").update(data).digest("hex");
async function files(dir, root = dir) {
  const output = {};
  for (const e of await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => [])) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) Object.assign(output, await files(f, root));
    else if (e.isFile())
      output[path.relative(root, f).replaceAll("\\", "/")] = hash(
        await fs.readFile(f),
      );
  }
  return output;
}
async function census(url) {
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const tables = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows;
    const result = {};
    for (const { tablename } of tables) {
      const safe = '"' + tablename.replaceAll('"', '""') + '"';
      const rows = (
        await client.query(
          `SELECT row_to_json(t)::text AS row FROM ${safe} t ORDER BY row_to_json(t)::text`,
        )
      ).rows;
      result[tablename] = {
        count: rows.length,
        sha256: hash(rows.map((r) => r.row).join("\n")),
      };
    }
    return result;
  } finally {
    await client.end();
  }
}
await fs.mkdir(base, { recursive: true, mode: 0o700 });
if(process.platform==='win32')execFileSync('icacls',[base,'/inheritance:r','/grant:r',`${os.userInfo().username}:(OI)(CI)F`],{windowsHide:true,stdio:'pipe'});
if (command === "create") {
  if (process.env.S3_BUCKET && !process.env.MEDIA_BACKUP_SOURCE)
    throw new Error(
      "S3 模式需要先同步对象存储到 MEDIA_BACKUP_SOURCE，禁止缺媒体备份",
    );
  const directory = path.join(
    base,
    "zijing-" + new Date().toISOString().replaceAll(":", "-"),
  );
  await fs.mkdir(directory, { mode: 0o700 });
  const media = path.resolve(
    process.env.MEDIA_BACKUP_SOURCE || process.env.MEDIA_DIR || "media",
  );
  await fs.mkdir(media, { recursive: true });
  const before = await census(source);
  const mediaBefore = await files(media);
  run(
    "pg_dump",
    [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--file",
      path.join(directory, "database.dump"),
    ],
    source,
  );
  await fs.cp(media, path.join(directory, "media"), { recursive: true });
  const after = await census(source);
  if (
    JSON.stringify(before) !== JSON.stringify(after) ||
    JSON.stringify(mediaBefore) !== JSON.stringify(await files(media))
  )
    throw new Error("备份期间发生写入；暂停内容维护后重试，不使用此不完整备份");
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    tables: before,
    media: mediaBefore,
    databaseSHA256: hash(
      await fs.readFile(path.join(directory, "database.dump")),
    ),
    offsiteConfigured: Boolean(process.env.BACKUP_REMOTE),
  };
  await fs.writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 },
  );
  if (process.env.BACKUP_REMOTE)
    await fs.cp(
      directory,
      path.join(
        path.resolve(process.env.BACKUP_REMOTE),
        path.basename(directory),
      ),
      { recursive: true, errorOnExist: true, force: false },
    );
  const days = Number(process.env.BACKUP_RETENTION_DAYS || 14);
  if (!Number.isFinite(days) || days < 1) throw new Error("保留天数至少为 1");
  for (const entry of await fs.readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("zijing-")) continue;
    const old = path.resolve(base, entry.name);
    if (!old.startsWith(base + path.sep))
      throw new Error("Unsafe retention path");
    const stat = await fs.stat(old);
    if (
      Date.now() - stat.mtimeMs > days * 86400000 &&
      (await fs.stat(path.join(old, "manifest.json")).catch(() => null))
    )
      await fs.rm(old, { recursive: true });
  }
  console.log(
    JSON.stringify({
      backup: directory,
      complete: true,
      offsite: process.env.BACKUP_REMOTE
        ? "copied; verify remote storage ownership"
        : "NOT CONFIGURED",
    }),
  );
} else if (command === "verify") {
  if (process.env.APP_ENV === "production")
    throw new Error("恢复演练只能在 development/staging 环境执行");
  const directory = path.resolve(process.argv[3] || "");
  const manifest = JSON.parse(
    await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  if (
    hash(await fs.readFile(path.join(directory, "database.dump"))) !==
    manifest.databaseSHA256
  )
    throw new Error("数据库备份校验失败");
  const target = new URL(process.env.RESTORE_DATABASE_URL || source.toString());
  target.pathname = "/zijing_restore_" + Date.now();
  if (!["127.0.0.1", "localhost", "db"].includes(target.hostname))
    throw new Error("恢复目标必须为隔离的本地数据库");
  const adminURL = new URL(target);
  adminURL.pathname = "/postgres";
  const client = new pg.Client({ connectionString: adminURL.toString() });
  await client.connect();
  const name = target.pathname.slice(1);
  await client.query(`CREATE DATABASE "${name}"`);
  await client.end();
  run(
    "pg_restore",
    [
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      "--dbname",
      name,
      path.join(directory, "database.dump"),
    ],
    target,
  );
  const actual = await census(target);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.tables))
    throw new Error("恢复后记录计数或内容哈希不一致");
  const restoredMedia = path.resolve(".data", name, "media");
  await fs.cp(path.join(directory, "media"), restoredMedia, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  if (
    JSON.stringify(await files(restoredMedia)) !==
    JSON.stringify(manifest.media)
  )
    throw new Error("恢复后媒体校验失败");
  const report = {
    verifiedAt: new Date().toISOString(),
    database: name,
    tables: Object.keys(actual).length,
    records: Object.values(actual).reduce((n, v) => n + v.count, 0),
    mediaFiles: Object.keys(manifest.media).length,
    result: "PASS",
    sourceUntouched: true,
  };
  await fs.mkdir("docs/evidence", { recursive: true });
  await fs.writeFile(
    "docs/evidence/restore.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} else throw new Error("Use create or verify <backup directory>");
