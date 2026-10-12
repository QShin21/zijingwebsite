import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import pg from "pg";
import os from 'node:os';
const hash = (data) => createHash("sha256").update(data).digest("hex");
const missing = error => { if (error.code === "ENOENT") return null; throw error; };
export async function files(dir, root = dir) {
  const info = await fs.lstat(dir).catch(missing);
  if (!info) return {};
  if (!info.isDirectory()) throw new Error("备份媒体路径必须为实际目录，不能使用符号链接");
  const output = {};
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) Object.assign(output, await files(f, root));
    else if (e.isFile()) output[path.relative(root, f).replaceAll("\\", "/")] = hash(await fs.readFile(f));
    else throw new Error("备份媒体中存在符号链接或非普通文件，无法确认完整性");
  }
  return output;
}
const reservations = localVideos => Object.fromEntries(Object.entries(localVideos)
  .filter(([name]) => name.startsWith(".team-honor-reserved/"))
  .map(([name, value]) => [name.slice(".team-honor-reserved/".length), value]));
const sameFiles = (actual, expected) => Object.keys(actual).length === Object.keys(expected).length &&
  Object.entries(actual).every(([name, value]) => expected[name] === value);
export async function mediaSnapshot(mediaSource, mediaDirectory) {
  const media = await files(mediaSource);
  const localVideos = await files(path.join(mediaDirectory, ".showcase-videos"));
  const localHonorVideos = await files(path.join(mediaDirectory, ".team-honor-videos"));
  return { media, localVideos, localHonorVideos, honorVideoReservations: reservations(localVideos) };
}
async function copyDirectory(sourceDirectory, destination) {
  const info = await fs.lstat(sourceDirectory).catch(missing);
  if (!info) { await fs.mkdir(destination, { recursive: true, mode: 0o700 }); return; }
  if (!info.isDirectory()) throw new Error("备份媒体路径必须为实际目录");
  await fs.cp(sourceDirectory, destination, { recursive: true, errorOnExist: true, force: false });
}
export async function copyBackupMedia(directory, mediaSource, mediaDirectory, snapshot) {
  await copyDirectory(mediaSource, path.join(directory, "media"));
  await copyDirectory(path.join(mediaDirectory, ".showcase-videos"), path.join(directory, "local-videos"));
  await copyDirectory(path.join(mediaDirectory, ".team-honor-videos"), path.join(directory, "local-honor-videos"));
  await verifyBackupMedia(directory, { version: 3, ...snapshot });
}
function checkedMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.entries(value).some(([name, digest]) => !name || name.startsWith("/") ||
      name.split("/").some(part => !part || part === "." || part === "..") ||
      typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)))
    throw new Error("媒体备份 manifest 缺失或哈希格式无效");
  return value;
}
export function assertMediaManifest(manifest) {
  const version = manifest.version ?? 1;
  if (![1, 2, 3].includes(version)) throw new Error("不支持的媒体备份 manifest 版本");
  checkedMap(manifest.media);
  if (version >= 2) checkedMap(manifest.localVideos);
  for (const [field, folder] of [["localVideos", ".showcase-videos"], ["localHonorVideos", ".team-honor-videos"]]) {
    if ((field === "localVideos" && version >= 2) || version === 3) {
      checkedMap(manifest[field]);
      for (const [name, digest] of Object.entries(manifest[field])) {
        const mirrored = manifest.media[folder + "/" + name];
        if (mirrored && mirrored !== digest) throw new Error("媒体镜像与本地视频 manifest 内容冲突");
      }
    }
  }
  if (version === 3) {
    checkedMap(manifest.localHonorVideos);
    checkedMap(manifest.honorVideoReservations);
    if (!sameFiles(reservations(manifest.localVideos), manifest.honorVideoReservations))
      throw new Error("永久荣誉隔离标记与本地视频 manifest 不一致");
  } else {
    const honorTable = manifest.tables?.team_honor_records;
    if (honorTable && (!Number.isSafeInteger(honorTable.count) || honorTable.count < 0))
      throw new Error("旧备份荣誉记录计数无效");
    const honorMedia = Object.keys(manifest.media).some(name => name.startsWith(".team-honor-videos/") ||
      name.startsWith(".showcase-videos/.team-honor-reserved/"));
    if (honorTable?.count || honorMedia || Object.keys(reservations(manifest.localVideos || {})).length)
      throw new Error("旧 manifest 未确认荣誉私有视频与永久隔离标记完整性，请使用 v3 备份");
  }
  return version;
}
async function requiredFiles(directory) {
  const info = await fs.lstat(directory);
  if (!info.isDirectory()) throw new Error("备份媒体目录无效");
  return files(directory);
}
export async function verifyBackupMedia(directory, manifest) {
  const version = assertMediaManifest(manifest);
  if (!sameFiles(await requiredFiles(path.join(directory, "media")), manifest.media))
    throw new Error("媒体备份哈希校验失败");
  if (version >= 2 && !sameFiles(await requiredFiles(path.join(directory, "local-videos")), manifest.localVideos))
    throw new Error("本地视频与永久隔离标记备份哈希校验失败");
  if (version === 3) {
    if (!sameFiles(await requiredFiles(path.join(directory, "local-honor-videos")), manifest.localHonorVideos))
      throw new Error("私有荣誉视频备份哈希校验失败");
  } else if (Object.keys(await files(path.join(directory, "local-honor-videos"))).length ||
    Object.keys(await files(path.join(directory, "local-videos", ".team-honor-reserved"))).length)
    throw new Error("旧 manifest 未包含私有荣誉视频或永久隔离标记，不能确认完整性");
  return version;
}
export async function restoreBackupMedia(directory, mediaDirectory, manifest) {
  const version = await verifyBackupMedia(directory, manifest);
  await fs.cp(path.join(directory, "media"), mediaDirectory, { recursive: true, errorOnExist: true, force: false });
  const expected = { ...manifest.media };
  async function restoreComponent(folder, target, recorded) {
    const destination = path.join(mediaDirectory, target), existing = await files(destination);
    if (Object.entries(existing).some(([name, digest]) => recorded[name] !== digest))
      throw new Error("媒体镜像与本地私有视频备份冲突，停止恢复");
    for (const [name, digest] of Object.entries(recorded)) {
      const key = target + "/" + name;
      if (expected[key] && expected[key] !== digest) throw new Error("媒体备份 manifest 内容冲突");
      expected[key] = digest;
    }
    await fs.cp(path.join(directory, folder), destination, { recursive: true, force: false });
    if (!sameFiles(await files(destination), recorded)) throw new Error("恢复后本地视频哈希不一致");
  }
  if (version >= 2) await restoreComponent("local-videos", ".showcase-videos", manifest.localVideos);
  if (version === 3) {
    await restoreComponent("local-honor-videos", ".team-honor-videos", manifest.localHonorVideos);
    if (!sameFiles(await files(path.join(mediaDirectory, ".showcase-videos", ".team-honor-reserved")), manifest.honorVideoReservations))
      throw new Error("恢复后永久荣誉隔离标记哈希不一致");
  }
  if (!sameFiles(await files(mediaDirectory), expected)) throw new Error("恢复后媒体哈希不一致");
  return { mediaDirectory: path.resolve(mediaDirectory), localVideoFiles: Object.keys(manifest.localVideos || {}).length,
    localHonorVideoFiles: Object.keys(manifest.localHonorVideos || {}).length,
    honorVideoReservations: Object.keys(manifest.honorVideoReservations || {}).length, honorStorageVerified: version === 3 };
}

async function main() {
await import("dotenv/config");
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
  const mediaDirectory = path.resolve(process.env.MEDIA_DIR || "media");
  const mediaBefore = await mediaSnapshot(media, mediaDirectory);
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
  await copyBackupMedia(directory, media, mediaDirectory, mediaBefore);
  const after = await census(source);
  if (
    JSON.stringify(before) !== JSON.stringify(after) ||
    JSON.stringify(mediaBefore) !== JSON.stringify(await mediaSnapshot(media, mediaDirectory))
  )
    throw new Error("备份期间发生写入；暂停内容维护后重试，不使用此不完整备份");
  const manifest = {
    version: 3,
    createdAt: new Date().toISOString(),
    tables: before,
    ...mediaBefore,
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
  await verifyBackupMedia(directory, manifest);
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
  const restored = await restoreBackupMedia(directory, restoredMedia, manifest);
  const report = {
    verifiedAt: new Date().toISOString(),
    database: name,
    tables: Object.keys(actual).length,
    records: Object.values(actual).reduce((n, v) => n + v.count, 0),
    mediaFiles: Object.keys(manifest.media).length,
    ...restored,
    result: "PASS",
    sourceUntouched: true,
  };
  await fs.mkdir("docs/evidence", { recursive: true });
  await fs.writeFile(
    process.env.RESTORE_EVIDENCE_PATH || "docs/evidence/restore.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} else throw new Error("Use create or verify <backup directory>");
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
