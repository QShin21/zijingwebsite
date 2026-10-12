import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { assessClubRollback, honorStorageCounts } from "../scripts/club-operations-rollback-check";

const temporary: string[] = [];
const legacy = { backbone: 0, new_states: 0, joins: 0, promotions: 0, staff_batches: 0, staff_applications: 0,
  reduced_grants: 0, revoked_grants: 0, legacy_owner_private_access: 0, legacy_historical_private_access: 0, revoked_cards: 0, member_offices: 0 };
afterEach(async () => {
  vi.restoreAllMocks();
  for (const directory of temporary.splice(0)) await fs.rm(directory, { recursive: true, force: true });
});
async function media() {
  const root = await fs.mkdtemp(path.join(tmpdir(), "zijing-honor-rollback-"));
  temporary.push(root);
  return root;
}
function database(rows: Record<string, unknown> = legacy, present: unknown = true, honors: unknown = "0") {
  return { query: vi.fn(async (sql: string) => {
    if (sql.includes("WITH current_events")) return { rows: [{ ...rows }] };
    if (sql.includes("to_regclass")) return { rows: [{ present }] };
    if (sql.includes("FROM team_honor_records")) return { rows: [{ honor_records: honors }] };
    throw new Error("Unexpected synthetic read");
  }) };
}

it("仅全部既有权限和新存储检查均为零时允许基线回滚", async () => {
  const db = database(), result = await assessClubRollback(db, await media());
  expect(result).toMatchObject({ compatibleWithBaseline: true, checksComplete: true, requiresHonorVideoIsolation: false });
  expect(result.counts).toEqual({ ...legacy, honor_records: 0, honor_private_files: 0, honor_video_reservations: 0 });
  for (const name of Object.keys(legacy)) expect(db.query.mock.calls[0][0]).toContain(name);
});

it.each(Object.keys(legacy))("保留既有 %s 非零时的回滚阻断", async name => {
  const result = await assessClubRollback(database({ ...legacy, [name]: 1 }), await media());
  expect(result.compatibleWithBaseline).toBe(false);
  expect(result.counts[name]).toBe(1);
});

it("荣誉记录即使没有媒体也阻断旧应用", async () => {
  const result = await assessClubRollback(database(legacy, true, "2"), await media());
  expect(result).toMatchObject({ compatibleWithBaseline: false, requiresHonorVideoIsolation: true, counts: { honor_records: 2 } });
  expect(result.recommendation).toContain("honor video isolation");
});

it.each(["private", "reservation"])("只剩 %s 文件时仍阻断旧应用，无需当前荣誉引用", async kind => {
  const root = await media(), directory = kind === "private" ? path.join(root, ".team-honor-videos")
    : path.join(root, ".showcase-videos", ".team-honor-reserved");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "12345678-1234-1234-1234-123456789012.mp4"), "synthetic bytes");
  const result = await assessClubRollback(database(legacy, false), root);
  expect(result).toMatchObject({ compatibleWithBaseline: false, requiresHonorVideoIsolation: true, counts: { honor_records: 0 } });
  expect(result.counts[kind === "private" ? "honor_private_files" : "honor_video_reservations"]).toBe(1);
});

it("旧 schema 没有荣誉表且无私有文件时仍兼容，缺表不等于读错误", async () => {
  const db = database(legacy, false);
  expect((await assessClubRollback(db, await media())).compatibleWithBaseline).toBe(true);
  expect(db.query).toHaveBeenCalledTimes(2);
});

it.each([0, 1, 2])("第 %s 项数据库读取失败时不给回滚结论", async failing => {
  const root = await media(), db = database(), original = db.query.getMockImplementation()!;
  let calls = 0;
  db.query.mockImplementation(async sql => {
    if (calls++ === failing) throw new Error("synthetic database read failure");
    return original(sql);
  });
  await expect(assessClubRollback(db, root)).rejects.toThrow("synthetic database read failure");
});

it.each(["EACCES", "EIO"])("私有目录读取错误 %s 不变成零文件", async code => {
  const root = await media(), error = Object.assign(new Error("synthetic storage error"), { code });
  vi.spyOn(fs, "lstat").mockRejectedValueOnce(error);
  await expect(assessClubRollback(database(), root)).rejects.toBe(error);
});

it("只剩永久标记的目录无法枚举时不给兼容结论", async () => {
  const root = await media();
  await fs.mkdir(path.join(root, ".showcase-videos", ".team-honor-reserved"), { recursive: true });
  const error = Object.assign(new Error("synthetic reservation read failure"), { code: "EACCES" });
  vi.spyOn(fs, "readdir").mockRejectedValueOnce(error);
  await expect(assessClubRollback(database(legacy, false), root)).rejects.toBe(error);
});

it("缺失或无效数据库计数及表存在性均阻断判断", async () => {
  const root = await media();
  await expect(assessClubRollback(database({}), root)).rejects.toThrow("count");
  await expect(assessClubRollback(database(legacy, null), root)).rejects.toThrow("availability");
  await expect(assessClubRollback(database(legacy, true, "invalid"), root)).rejects.toThrow("count");
});

it("私有目录符号链接或错误文件类型不能获得兼容结论", async () => {
  const root = await media(), outside = path.join(root, "synthetic-directory");
  await fs.mkdir(outside);
  await fs.symlink(outside, path.join(root, ".team-honor-videos"));
  await expect(honorStorageCounts(root)).rejects.toThrow("real directory");
  await fs.rm(path.join(root, ".team-honor-videos"));
  await fs.writeFile(path.join(root, ".team-honor-videos"), "synthetic wrong type");
  await expect(honorStorageCounts(root)).rejects.toThrow("real directory");
});
