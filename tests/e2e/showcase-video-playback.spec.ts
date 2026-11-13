import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import sharp from "sharp";

const suffix = randomBytes(5).toString("hex");
const password = randomBytes(16).toString("hex");
const slug = `video-test-${suffix}`;
let p: Payload, admin: User, biliId: number;

test.beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  if (process.env.APP_ENV !== "development" || process.env.LOTTERY_TEST !== "isolated" ||
      db.hostname !== "127.0.0.1" || db.port !== "55463" || db.pathname !== "/lottery_migrate")
    throw new Error("Browser test requires the isolated migrated test database");
  p = await getPayload({ config });
  admin = await p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { name: `视频测试-${suffix}`, email: `video-${suffix}@example.invalid`, password, roles: ["vicePresident"] } });
  const game = await p.create({ collection: "games", overrideAccess: true, context: { system: true },
    data: { title: "合成视频社群", slug, _status: "published" } });
  const create = (title: string, videoURL: string, images: { source: string; caption: string }[] = []) => p.create({ collection: "community-showcase", user: admin,
    overrideAccess: false, context: { webShowcaseWrite: true }, data: { title, videoURL, images, game: game.id, author: admin.id } });
  biliId = (await create("合成 B 站风采", "https://www.bilibili.com/video/BV1B7411m7LV/?p=2")).id;
  const cover = await sharp({ create: { width: 32, height: 32, channels: 3, background: "purple" } }).png().toBuffer();
  await create("合成本地播放风采", "https://videos.example.invalid/synthetic.mp4",
    [{ source: `data:image/png;base64,${cover.toString("base64")}`, caption: "合成封面" }]);
});
test.afterAll(async () => { if (p) await p.destroy(); });

test("风采卡片播放与标题跳转各自生效，详情视频随屏幕放大", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(admin.name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.route("https://player.bilibili.com/player.html?**", route => route.fulfill({ contentType: "text/html", body: "<p>合成播放器</p>" }));
  await page.goto(`/community/${slug}/showcase`);
  const card = page.locator("article").filter({ has: page.getByRole("link", { name: "合成 B 站风采", exact: true }) });
  await expect(card.getByRole("button", { name: "播放视频：合成 B 站风采" })).toBeVisible();
  await card.screenshot({ path: join(process.env.TEMP!, "zijing-showcase-card.png") });
  await card.getByRole("button", { name: "播放视频：合成 B 站风采" }).click();
  await expect(page).toHaveURL(new RegExp(`/community/${slug}/showcase$`));
  const frame = card.locator('iframe[title="合成 B 站风采视频播放器"]');
  await expect(frame).toBeVisible();
  const playerURL = new URL((await frame.getAttribute("src"))!);
  expect(playerURL.hostname).toBe("player.bilibili.com");
  expect(playerURL.searchParams.get("bvid")).toBe("BV1B7411m7LV");
  expect(playerURL.searchParams.get("p")).toBe("2");
  expect(playerURL.searchParams.get("autoplay")).toBe("1");
  expect(await frame.getAttribute("allow")).toContain("autoplay");
  await card.getByRole("link", { name: "合成 B 站风采", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/community/${slug}/showcase/${biliId}$`));
  const detailPlayer = page.locator('iframe[title="B站视频预览"]');
  await expect(detailPlayer).toBeVisible();
  const desktopSize = await detailPlayer.boundingBox();
  expect(desktopSize!.width).toBeGreaterThan(800);
  expect(desktopSize!.width / desktopSize!.height).toBeCloseTo(16 / 9, 1);
  await detailPlayer.screenshot({ path: join(process.env.TEMP!, "zijing-showcase-detail.png") });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await detailPlayer.boundingBox())!.width).toBeLessThanOrEqual(390);
});

test("站内同类视频以原生控件在卡片内播放", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(admin.name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
    const recorder = new MediaRecorder(canvas.captureStream(10), { mimeType: "video/mp4;codecs=avc1.42E01E" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    recorder.start();
    const ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? "purple" : "gold"; ctx.fillRect(0, 0, 32, 32);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await new Promise<void>(resolve => { recorder.onstop = () => resolve(); recorder.stop(); });
    return Array.from(new Uint8Array(await new Blob(chunks, { type: "video/mp4" }).arrayBuffer()));
  });
  await page.route("https://videos.example.invalid/synthetic.mp4", route => route.fulfill({ contentType: "video/mp4", body: Buffer.from(bytes) }));
  await page.goto(`/community/${slug}/showcase`);
  const card = page.locator("article").filter({ has: page.getByRole("link", { name: "合成本地播放风采", exact: true }) });
  await expect(card.locator("img")).toBeVisible();
  await card.getByRole("button", { name: "播放视频：合成本地播放风采" }).click();
  const video = card.locator("video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("controls", "");
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
  await expect(page).toHaveURL(new RegExp(`/community/${slug}/showcase$`));
});
