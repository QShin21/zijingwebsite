import "dotenv/config";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import sharp from "sharp";
import { test, expect } from "@playwright/test";

const root = path.resolve(process.env.MEDIA_DIR || "media"), id = randomUUID() + ".mp4", imageName = "synthetic-honor-public-" + randomUUID() + ".png";
const files = [path.join(root, imageName), path.join(root, ".team-honor-videos", id), path.join(root, ".showcase-videos", id), path.join(root, ".showcase-videos", ".team-honor-reserved", id)];
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback only");
  await mkdir(path.dirname(files[1]), { recursive: true }); await mkdir(path.dirname(files[3]), { recursive: true });
  const bytes = Buffer.alloc(64); bytes.writeUInt32BE(24, 0); bytes.write("ftyp", 4); bytes.write("isom", 8);
  await writeFile(files[0], await sharp({ create: { width: 3, height: 3, channels: 3, background: "purple" } }).png().toBuffer(), { flag: "wx" });
  for (const file of files.slice(1, 3)) await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  await writeFile(files[3], "synthetic permanent isolation marker\n", { flag: "wx", mode: 0o600 });
});
test.afterAll(async () => { for (const file of files) await unlink(file).catch(() => {}); });

test("真实 Media HTTP 保留公开图片，但解码目录/反斜杠/Range 无法旁路私有荣誉和旧视频标记", async ({ request }) => {
  const ready = await request.get("/health/ready"); expect(ready.status()).toBe(200); expect(await ready.json()).toMatchObject({ status: "ready" });
  const publicImage = await request.get("/api/media/file/" + imageName); expect(publicImage.status()).toBe(200); expect(publicImage.headers()["content-type"]).toBe("image/png");
  for (const directory of [".team-honor-videos", ".showcase-videos", ".showcase-videos%2F.team-honor-reserved"]) {
    for (const separator of ["%2F", "%2f", "%5C", "%252F"]) {
      const target = "/api/media/file/" + directory + separator + id;
      expect((await request.get(target)).status()).toBe(403);
      expect((await request.get(target, { headers: { Range: "bytes=0-15" } })).status()).toBe(403);
      expect((await request.head(target)).status()).toBe(404);
    }
  }
  for (const target of ["/api/private-team-honor-videos/" + id, "/api/showcase-videos/" + id]) {
    expect((await request.get(target)).status()).toBe(404); expect((await request.head(target)).status()).toBe(404);
    expect((await request.get(target, { headers: { Range: "bytes=0-15" } })).status()).toBe(404);
  }
});
