import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { assertMediaManifest, copyBackupMedia, files, mediaSnapshot, restoreBackupMedia, verifyBackupMedia } from "../scripts/backup.mjs";

const temporary: string[] = [];
const oldUUID = "12345678-1234-1234-1234-123456789012.mp4";
const privateUUID = "12345678-1234-1234-1234-123456789013.mp4";
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
afterEach(async () => {
  vi.restoreAllMocks();
  for (const directory of temporary.splice(0)) await fs.rm(directory, { recursive: true, force: true });
});
async function fixture(separate = true) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "zijing-honor-backup-"));
  temporary.push(root);
  const live = path.join(root, "live-media"), source = separate ? path.join(root, "object-mirror") : live;
  const backup = path.join(root, "backup"), restored = path.join(root, "restored-media");
  for (const directory of [source, backup, path.join(live, ".team-honor-videos"), path.join(live, ".showcase-videos", ".team-honor-reserved")])
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(source, "public.webp"), "synthetic public media");
  await fs.writeFile(path.join(live, ".team-honor-videos", privateUUID), "synthetic private honor bytes", { mode: 0o600 });
  await fs.writeFile(path.join(live, ".showcase-videos", oldUUID), "synthetic old video bytes", { mode: 0o600 });
  await fs.writeFile(path.join(live, ".showcase-videos", ".team-honor-reserved", oldUUID), "synthetic permanent reservation", { mode: 0o600 });
  return { root, live, source, backup, restored };
}

it.each([true, false])("v3 完整备份并恢复原私有目录，媒体镜像分离=%s", async separate => {
  const f = await fixture(separate), snapshot = await mediaSnapshot(f.source, f.live);
  const manifest = { version: 3, ...snapshot, tables: { team_honor_records: { count: 1 } } };
  expect(snapshot.localHonorVideos).toEqual({ [privateUUID]: digest("synthetic private honor bytes") });
  expect(snapshot.honorVideoReservations).toEqual({ [oldUUID]: digest("synthetic permanent reservation") });
  expect(snapshot.localVideos).toHaveProperty(".team-honor-reserved/" + oldUUID);
  if (separate) expect(Object.keys(snapshot.media)).toEqual(["public.webp"]);
  await copyBackupMedia(f.backup, f.source, f.live, snapshot);
  const report = await restoreBackupMedia(f.backup, f.restored, manifest);
  expect(report).toMatchObject({ mediaDirectory: f.restored, localVideoFiles: 2, localHonorVideoFiles: 1, honorVideoReservations: 1, honorStorageVerified: true });
  expect(await fs.readFile(path.join(f.restored, ".team-honor-videos", privateUUID), "utf8")).toBe("synthetic private honor bytes");
  expect(await fs.readFile(path.join(f.restored, ".showcase-videos", ".team-honor-reserved", oldUUID), "utf8")).toBe("synthetic permanent reservation");
  expect(Object.keys(await files(f.restored))).toHaveLength(4);
  if (process.platform !== "win32") {
    expect((await fs.stat(path.join(f.restored, ".team-honor-videos"))).mode & 0o077).toBe(0);
    expect((await fs.stat(path.join(f.restored, ".team-honor-videos", privateUUID))).mode & 0o077).toBe(0);
  }
});

it.each(["private", "reservation"])("备份 %s 字节被篡改时停止恢复", async kind => {
  const f = await fixture(), snapshot = await mediaSnapshot(f.source, f.live), manifest = { version: 3, ...snapshot };
  await copyBackupMedia(f.backup, f.source, f.live, snapshot);
  const filename = kind === "private" ? path.join(f.backup, "local-honor-videos", privateUUID)
    : path.join(f.backup, "local-videos", ".team-honor-reserved", oldUUID);
  await fs.writeFile(filename, "tampered synthetic bytes");
  await expect(restoreBackupMedia(f.backup, f.restored, manifest)).rejects.toThrow("哈希");
  await expect(fs.stat(f.restored)).rejects.toMatchObject({ code: "ENOENT" });
});

it("v3 私有目录或隔离标记缺失时不能按空目录通过", async () => {
  const f = await fixture(), snapshot = await mediaSnapshot(f.source, f.live), manifest = { version: 3, ...snapshot };
  await copyBackupMedia(f.backup, f.source, f.live, snapshot);
  await fs.rm(path.join(f.backup, "local-videos", ".team-honor-reserved", oldUUID));
  await expect(verifyBackupMedia(f.backup, manifest)).rejects.toThrow("哈希");
  await fs.writeFile(path.join(f.backup, "local-videos", ".team-honor-reserved", oldUUID), "synthetic permanent reservation");
  await fs.rm(path.join(f.backup, "local-honor-videos"), { recursive: true });
  await expect(verifyBackupMedia(f.backup, manifest)).rejects.toMatchObject({ code: "ENOENT" });
});

it("v3 永久标记清单必须与本地视频清单完全一致", () => {
  expect(() => assertMediaManifest({ version: 3, media: {}, localVideos: { [".team-honor-reserved/" + oldUUID]: digest("marker") },
    localHonorVideos: {}, honorVideoReservations: {} })).toThrow("隔离标记");
  expect(() => assertMediaManifest({ version: 3, media: {}, localVideos: {}, honorVideoReservations: {} })).toThrow("manifest");
});

it("S3 镜像与本地视频同路径字节冲突时拒绝完整备份", async () => {
  const f = await fixture();
  await fs.mkdir(path.join(f.source, ".showcase-videos"));
  await fs.writeFile(path.join(f.source, ".showcase-videos", oldUUID), "different mirrored bytes");
  const snapshot = await mediaSnapshot(f.source, f.live);
  await expect(copyBackupMedia(f.backup, f.source, f.live, snapshot)).rejects.toThrow("冲突");
});

it.each([1, 2])("无荣誉记录及隔离文件的旧 manifest v%s 可恢复，明确不宣称荣誉完整", async version => {
  const f = await fixture(version === 2);
  await fs.rm(path.join(f.live, ".team-honor-videos"), { recursive: true });
  await fs.rm(path.join(f.live, ".showcase-videos", ".team-honor-reserved"), { recursive: true });
  const snapshot = await mediaSnapshot(f.source, f.live);
  await copyBackupMedia(f.backup, f.source, f.live, snapshot);
  const manifest = { version, media: snapshot.media, ...(version === 2 ? { localVideos: snapshot.localVideos } : {}),
    tables: { team_honor_records: { count: 0 } } };
  expect((await restoreBackupMedia(f.backup, f.restored, manifest)).honorStorageVerified).toBe(false);
  expect(await fs.readFile(path.join(f.restored, ".showcase-videos", oldUUID), "utf8")).toBe("synthetic old video bytes");
});

it.each(["records", "private-media", "reservation"])("旧 manifest 含 %s 时拒绝声称完整", kind => {
  const manifest = { version: 2, media: kind === "private-media" ? { [".team-honor-videos/" + privateUUID]: digest("private") } : {},
    localVideos: kind === "reservation" ? { [".team-honor-reserved/" + oldUUID]: digest("marker") } : {},
    tables: { team_honor_records: { count: kind === "records" ? 1 : 0 } } };
  expect(() => assertMediaManifest(manifest)).toThrow("旧 manifest");
});

it("v1 备份额外携带未登记的永久标记时拒绝恢复，不能静默丢掉隔离状态", async () => {
  const f = await fixture(), snapshot = await mediaSnapshot(f.source, f.live);
  await copyBackupMedia(f.backup, f.source, f.live, snapshot);
  await fs.rm(path.join(f.backup, "local-honor-videos"), { recursive: true });
  const manifest = { version: 1, media: snapshot.media, tables: { team_honor_records: { count: 0 } } };
  await expect(verifyBackupMedia(f.backup, manifest)).rejects.toThrow("永久隔离标记");
});

it.each(["EACCES", "EIO"])("媒体读取错误 %s 阻止备份，不当作空目录", async code => {
  const f = await fixture(), error = Object.assign(new Error("synthetic read failure"), { code });
  vi.spyOn(fs, "lstat").mockRejectedValueOnce(error);
  await expect(mediaSnapshot(f.source, f.live)).rejects.toBe(error);
});

it("符号链接不进入可用备份", async () => {
  const f = await fixture();
  await fs.symlink(path.join(f.live, ".team-honor-videos", privateUUID), path.join(f.source, "linked-video"));
  await expect(mediaSnapshot(f.source, f.live)).rejects.toThrow("符号链接");
});
