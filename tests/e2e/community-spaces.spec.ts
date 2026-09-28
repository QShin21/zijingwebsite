import "dotenv/config";
import { test, expect } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
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
  if (event) await p.delete({ collection: "community-reactions", overrideAccess: true, where: { targetType: { equals: "community-posts" }, targetId: { equals: event } } });
  if (game) for (const collection of ["comments", "community-showcase", "community-applications", "community-posts", "forum-posts", "community-messages"] as const) await p.delete({ collection, overrideAccess: true, where: { game: { equals: game } } });
  if (game) await p.delete({ collection: "games", id: game, overrideAccess: true });
  for (const user of [member, admin, vice]) if (user) await p.delete({ collection: "users", id: user.id, overrideAccess: true, context: { system: true } });
});
test("多管理员微信、活动互动、风采投稿审核及B站预览", async ({ page, browser }) => {
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
  await page.getByRole("button", { name: "点赞 · 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "已点赞 · 取消 · 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "我要参加 · 0", exact: true }).click();
  await expect(page.getByRole("button", { name: "已表达参加意愿 · 取消 · 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "已表达参加意愿 · 取消 · 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "我要参加 · 0", exact: true })).toBeVisible();
  await page.getByLabel("写留言", { exact: true }).fill("期待周末社群活动"); await page.getByRole("button", { name: "发布留言" }).click();
  await expect(page.getByText("期待周末社群活动", { exact: true })).toBeVisible();
  await page.goto(`/community/${slug}/showcase`); await page.getByText("分享社群风采", { exact: true }).click();
  await page.getByLabel("标题", { exact: true }).fill("精彩活动图文记录"); await page.getByLabel("精彩记录", { exact: true }).fill("与伙伴们一起留下难忘的瞬间。");
  await page.getByLabel(/活动照片/).setInputFiles({ name: "activity.png", mimeType: "image/png", buffer: picture });
  await page.getByLabel("视频链接", { exact: true }).fill("https://www.bilibili.com/video/BV1B7411m7LV/");
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.getByText("投稿已提交，请在“我的投稿”查看审核状态。")).toBeVisible();
  await page.getByRole("link", { name: "我的投稿", exact: true }).click();
  await expect(page.getByRole("heading", { name: "精彩活动图文记录" })).toBeVisible(); await expect(page.locator(".showcase-card")).toContainText("待审核");
  const other = await browser.newContext(); const managerPage = await other.newPage();
  await managerPage.goto(`/community/${slug}/showcase`); await expect(managerPage.getByRole("heading", { name: "精彩活动图文记录" })).toHaveCount(0);
  await managerPage.goto("/login"); await managerPage.getByLabel("昵称或邮箱").fill(admin.name); await managerPage.getByLabel("密码", { exact: true }).fill(password); await managerPage.getByRole("button", { name: "登录", exact: true }).click(); await expect(managerPage).toHaveURL(/\/account$/);
  await managerPage.goto(`/community/${slug}/showcase?view=review`); await managerPage.getByRole("button", { name: "批准发布" }).click();
  await page.goto(`/community/${slug}/showcase`); await expect(page.getByRole("heading", { name: "精彩活动图文记录" })).toBeVisible();
  await expect(page.locator(".showcase-images img")).toHaveCount(1);
  await page.getByRole("button", { name: "站内预览 B 站视频" }).click();
  await expect(page.getByTitle("B站视频预览")).toHaveAttribute("src", /https:\/\/player\.bilibili\.com\/player\.html.*bvid=BV1B7411m7LV/);
  await expect(page.getByRole("link", { name: "前往 B 站观看 ↗" })).toHaveAttribute("href", "https://www.bilibili.com/video/BV1B7411m7LV/");
  for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 960 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await page.screenshot({ path: `.data/community-showcase-${width}.png` }); }
  await other.close();
});
