import { beforeEach, expect, it, vi } from "vitest";
import type { Payload, AccessArgs } from "payload";
import { publicMediaRead } from "../src/lib/public-media-access";

const fs = vi.hoisted(() => ({ lstat: vi.fn() }));
vi.mock("node:fs/promises", async (original) => ({
  ...await original<typeof import("node:fs/promises")>(),
  lstat: fs.lstat,
}));
import { isReservedHonorVideo } from "../src/lib/team-honor-videos";

const filename = "11111111-2222-4333-8444-555555555555.mp4";
beforeEach(() => vi.resetAllMocks());

it("公开 Media 只允许静态图片 basename，不能读取私有目录、视频或路径别名", async () => {
  const read = (name: unknown, isReadingStaticFile = true) => publicMediaRead({
    isReadingStaticFile, data: { filename: name },
    req: { user: null, payload: { db: { pool: { query: async () => ({ rows: [{ allowed: true }] }) } } } },
  } as unknown as AccessArgs);
  for (const name of ["正常公开图片.png", "image-card.JPG", "public.webp"]) expect(await read(name)).toBe(true);
  for (const name of [null, "", "private.mp4", ".hidden.png", "../public.png", "nested/public.png", "nested\\public.png", ".team-honor-videos/" + filename, ".showcase-videos/" + filename, "bad\0.png"]) expect(await read(name)).toBe(false);
  expect(await read(undefined, false)).toBe(true);
});

it.each(["EACCES", "EIO", "ENOTDIR"])("永久标记读取 %s 时失败关闭，不查询或放行旧视频", async (code) => {
  fs.lstat.mockRejectedValue(Object.assign(new Error("synthetic storage failure"), { code }));
  const execute = vi.fn();
  const p = { db: { drizzle: { execute } } } as unknown as Payload;
  await expect(isReservedHonorVideo(p, filename)).rejects.toMatchObject({ status: 503, message: "暂时无法核验视频归属" });
  expect(execute).not.toHaveBeenCalled();
});

it("已存在的永久标记（包括符号链接）无需读取已清除的荣誉引用", async () => {
  fs.lstat.mockResolvedValue({ isSymbolicLink: () => true });
  const execute = vi.fn();
  expect(await isReservedHonorVideo({ db: { drizzle: { execute } } } as unknown as Payload, filename)).toBe(true);
  expect(execute).not.toHaveBeenCalled();
});

it("仅 ENOENT 允许继续核验数据库归属，未隔离的普通风采仍可读取", async () => {
  fs.lstat.mockRejectedValue(Object.assign(new Error("synthetic missing marker"), { code: "ENOENT" }));
  const execute = vi.fn().mockResolvedValue({ rows: [{ reserved: false }] });
  expect(await isReservedHonorVideo({ db: { drizzle: { execute } } } as unknown as Payload, filename)).toBe(false);
  expect(execute).toHaveBeenCalledOnce();
});
