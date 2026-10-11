import "dotenv/config";
import { test, expect } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { discardVideo } from '../../src/lib/showcase-videos';
import sharp from "sharp";
import { randomBytes } from "node:crypto";
let p: Payload; let member: User; let admin: User; let vice: User; let game: number; let event: number;
const suffix = Date.now(); const slug = `spaces-${suffix}`; const password = randomBytes(24).toString("hex");
let picture: Buffer;
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development") throw new Error("Development only");
  p = await getPayload({ config });
  picture = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#a885df" } }).png().toBuffer();
  const createUser = (name: string, roles: User["roles"]) => p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: `${name}-${suffix}`, email: `${randomBytes(5).toString("hex")}-${suffix}@example.invalid`, password, roles } });
  member = await createUser("投稿成员", ["member"]); admin = await createUser("社群管理员", ["member"]); vice = await createUser("审核负责人", ["vicePresident"]);
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "社群功能验收", slug, _status: "published" } })).id;
  for (const user of [admin, vice]) {
    const application = await p.create({ collection: "community-applications", overrideAccess: false, user,
      data: { game, proposedGame: "社群功能验收", applicant: user.id, realName: "测试联系人", phone: "13900000000", reason: "社群功能自动化验收申请说明", wechatQr: `data:image/png;base64,${picture.toString("base64")}` } });
    await p.update({ collection: "community-applications", id: application.id, overrideAccess: false, user: vice, data: { status: "approved" } });
  }
  admin = await p.findByID({ collection: "users", id: admin.id, overrideAccess: true, depth: 0 });
  event = (await p.create({ collection: "community-posts", overrideAccess: false, user: admin, data: { game, author: admin.id, title: "周末社群活动", category: "event", body: "一起来分享游戏体验。" } })).id;
});
test.afterAll(async () => {
  if (!p) return;
  if (game) { const videos = await p.find({ collection: 'community-showcase', overrideAccess: true, where: { game: { equals: game } }, limit: 100 }); for (const doc of videos.docs) if (doc.videoURL?.startsWith('/api/showcase-videos/')) await discardVideo(doc.videoURL); }
  if (game) for (const collection of ["community-showcase", "community-applications", "community-posts"] as const) await p.delete({ collection, overrideAccess: true, where: { game: { equals: game } } });
  if (game) await p.delete({ collection: "games", id: game, overrideAccess: true });
  for (const user of [member, admin, vice]) if (user) await p.delete({ collection: "users", id: user.id, overrideAccess: true, context: { system: true } });
});
test("多管理员微信、只读活动、网页风采投稿审核及B站预览", async ({ page, browser }) => {
  await page.goto("/login"); await page.getByLabel("昵称或邮箱").fill(member.name); await page.getByLabel("密码", { exact: true }).fill(password); await page.getByRole("button", { name: "登录", exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(`/community/${slug}`);
    await page.getByRole("button", { name: /添加社群管理员微信/ }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img")).toHaveCount(2);
    await expect(dialog).not.toContainText("13900000000");
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `.data/community-contacts-${width}.png` });
    await page.getByRole("button", { name: "关闭弹窗" }).click();
  }
  await page.goto(`/community/${slug}/updates/${event}`);
  await expect(page.getByRole("button", { name: /点赞|参加|发布留言/ })).toHaveCount(0);
  const token = (await page.context().cookies()).find(cookie => cookie.name === 'payload-token')!.value;
  expect((await page.request.post('/api/community-showcase', { headers: { Authorization: `JWT ${token}` }, data: {
    game, author: member.id, title: '禁止共享接口投稿', body: '仅网页动作可投稿', context: { webShowcaseWrite: true },
  } })).status()).toBe(403);
  await page.goto(`/community/${slug}/showcase`); await page.getByText("分享社群风采", { exact: true }).click();
  await page.getByLabel("标题", { exact: true }).fill("精彩活动图文记录"); await page.getByLabel("精彩记录", { exact: true }).fill("与伙伴们一起留下难忘的瞬间。");
  await page.getByLabel(/活动照片/).setInputFiles({ name: "activity.png", mimeType: "image/png", buffer: picture });
  await page.getByLabel("视频链接或 B 站嵌入代码（选填）", { exact: true }).fill("https://www.bilibili.com/video/BV1B7411m7LV/");
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.getByText("投稿已提交，请在“我的投稿”查看审核状态。")).toBeVisible();
  await page.getByRole("link", { name: "我的投稿", exact: true }).click();
  await expect(page.getByRole("heading", { name: "精彩活动图文记录" })).toBeVisible(); await expect(page.locator(".showcase-card")).toContainText("待审核");
  const other = await browser.newContext(); const managerPage = await other.newPage();
  await managerPage.goto(`/community/${slug}/showcase`); await expect(managerPage.getByRole("heading", { name: "精彩活动图文记录" })).toHaveCount(0);
  await managerPage.goto("/login"); await managerPage.getByLabel("昵称或邮箱").fill(admin.name); await managerPage.getByLabel("密码", { exact: true }).fill(password); await managerPage.getByRole("button", { name: "登录", exact: true }).click(); await expect(managerPage).toHaveURL(/\/account$/);
  await managerPage.goto(`/community/${slug}/showcase?view=review`); await managerPage.getByRole("button", { name: "批准发布" }).click();
  await expect(managerPage.getByRole("status")).toContainText("审核已保存");
  await page.goto(`/community/${slug}/showcase`); await expect(page.getByRole("heading", { name: "精彩活动图文记录" })).toBeVisible();
  await expect(page.locator(".showcase-images img")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /站内预览 B 站视频|收起预览/ })).toHaveCount(0);
  await expect(page.getByTitle("B站视频预览")).toBeVisible();
  await expect(page.getByTitle("B站视频预览")).toHaveAttribute("src", /https:\/\/player\.bilibili\.com\/player\.html.*bvid=BV1B7411m7LV/);
  await expect(page.getByRole("link", { name: "前往 B 站观看 ↗" })).toHaveAttribute("href", "https://www.bilibili.com/video/BV1B7411m7LV/");
  for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 960 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: `.data/community-showcase-${width}.png` }); }
  await other.close();
});


test('仅标题投稿与 MP4 审核、播放、拖动和隐藏权限', async ({ page, browser }) => {
  await page.goto('/login'); await page.getByLabel('昵称或邮箱').fill(member.name); await page.getByLabel('密码', { exact: true }).fill(password); await page.getByRole('button', { name: '登录', exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
  await page.goto(`/community/${slug}/showcase`); await page.getByText('分享社群风采', { exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('只有标题也能投稿'); await page.getByRole('button', { name: '提交审核', exact: true }).click();
  await expect(page.getByText('投稿已提交，请在“我的投稿”查看审核状态。')).toBeVisible();
  await page.getByLabel('标题', { exact: true }).fill('双端预览视频');
  // Generate a synthetic clip in memory; never commit or import real media.
  const clip = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#6633aa'; ctx.fillRect(0, 0, 320, 180);
    const stream = canvas.captureStream(24), chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4;codecs=avc1.42001E' });
    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = event => chunks.push(event.data); recorder.onerror = reject;
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/mp4' }));
      recorder.start(); const timer = setInterval(() => ctx.fillRect(0, 0, 320, 180), 40);
      setTimeout(() => { clearInterval(timer); recorder.stop(); stream.getTracks().forEach(track => track.stop()); }, 1800);
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByLabel('上传 MP4 视频', { exact: false }).setInputFiles({ name: 'synthetic.mp4', mimeType: 'video/mp4', buffer: Buffer.from(clip) });
  await page.getByRole('button', { name: '提交审核', exact: true }).click();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('');
  await page.goto(`/community/${slug}/showcase?view=mine`);
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: '双端预览视频', exact: true }) });
  await expect(card).toBeVisible(); const player = card.locator('video'); await expect(player).toBeVisible();
  const url = (await player.getAttribute('src'))!;
  expect(url).toMatch(/^\/api\/showcase-videos\/[0-9a-f-]+\.mp4$/);
  const partial = await page.request.get(url, { headers: { Range: 'bytes=0-31', 'Sec-Fetch-Site': 'same-origin' } });
  expect(partial.status(), await partial.text()).toBe(206); expect((await partial.body()).length).toBe(32);
  expect((await page.request.get(url, { headers: { Range: 'bytes=99999999-', 'Sec-Fetch-Site': 'same-origin' } })).status()).toBe(416);
  const guest = await browser.newContext(); expect((await guest.request.get(url)).status()).toBe(404);
  const record = (await p.find({ collection: 'community-showcase', overrideAccess: true, where: { and: [{ game: { equals: game } }, { title: { equals: '双端预览视频' } }] } })).docs[0];
  await p.update({ collection: 'community-showcase', id: record.id, overrideAccess: false, user: admin, context: { webShowcaseWrite: true }, data: { status: 'visible' } });
  expect((await guest.request.get(url)).status()).toBe(200);
  await page.goto(`/community/${slug}/showcase`);
  const published = page.locator('video[aria-label="风采视频预览"]');
  await expect.poll(() => published.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(2);
  await published.evaluate(async (el: HTMLVideoElement) => { el.muted = true; await el.play(); });
  await expect.poll(() => published.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(0.1);
  await published.evaluate((el: HTMLVideoElement) => { el.pause(); el.currentTime = 1; });
  await expect.poll(() => published.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThanOrEqual(1);
  const response = await page.request.get(`/community/${slug}/showcase`, { headers: { 'Sec-Fetch-Site': 'same-origin' } }); expect(response.headers()['content-security-policy']).toContain("frame-src 'self' https://player.bilibili.com");
  await p.update({ collection: 'community-showcase', id: record.id, overrideAccess: false, user: admin, context: { webShowcaseWrite: true }, data: { status: 'hidden' } });
  expect((await guest.request.get(url)).status()).toBe(404); await guest.close();
});
