import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";

let p: Payload;
let applicant: User, reviewer: User, outsider: User;
let qr: Buffer;
let game: number | undefined;
const suffix = Date.now();
const password = randomBytes(20).toString("hex");
const gameName = `申请流程测试-${suffix}`;

test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development") throw new Error("Development only");
  p = await getPayload({ config, key: "community-application-browser" });
  const create = (kind: string, roles: User["roles"]) => p.create({ collection: "users", overrideAccess: true,
    context: { system: true }, data: { name: `${kind}-${suffix}`, email: `${kind}-${suffix}@example.invalid`, password, roles } });
  applicant = await create("Applicant", ["member"]);
  reviewer = await create("President", ["president"]);
  outsider = await create("Outsider", ["member"]);
  qr = await sharp(randomBytes(384 * 384 * 3), { raw: { width: 384, height: 384, channels: 3 } }).png().toBuffer();
  expect(qr.length).toBeGreaterThan(40_000);
});
test.afterAll(async () => {
  if (!p) return;
  if (applicant) await p.delete({ collection: "community-applications", overrideAccess: true, where: { applicant: { equals: applicant.id } } });
  if (game) await p.delete({ collection: "games", id: game, overrideAccess: true });
  for (const user of [applicant, reviewer, outsider]) if (user) await p.delete({ collection: "users", id: user.id, overrideAccess: true, context: { system: true } });
  await p.destroy();
});
async function login(page: Page, user: User) {
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(user.name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test("完整申请、备案提示、私有二维码、社长查看全部资料后批准", async ({ page, browser, request }) => {
  await login(page, applicant);
  await page.goto("/community/apply");
  await page.getByLabel("姓名", { exact: true }).fill("测试申请人");
  await page.getByLabel("手机号", { exact: true }).fill("13900000000");
  await page.getByLabel("微信名片二维码", { exact: true }).setInputFiles({ name: "card.png", mimeType: "image/png", buffer: qr });
  await page.getByLabel("新游戏名称", { exact: false }).fill("X");
  await page.getByLabel("申请说明", { exact: false }).fill("希望负责本游戏的日常交流和社群组织工作。");
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.locator("form").getByRole("status")).toContainText("新游戏名称需为 2–80 字");
  await page.getByLabel("新游戏名称", { exact: false }).fill(gameName);
  await page.getByRole("checkbox", { name: "我同意批准后", exact: false }).check();
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.getByRole("heading", { name: "申请已提交" })).toBeVisible();
  await expect(page.getByText("批准与网站初始化不代表已经创建或进入微信群。", { exact: false })).toBeVisible();
  const application = (await p.find({ collection: "community-applications", overrideAccess: true, where: { applicant: { equals: applicant.id } }, depth: 0 })).docs[0];
  expect(application.realName).toBe("测试申请人");
  const url = `/community/applications/${application.id}/qr`;
  expect((await request.get(url)).status()).toBe(401);
  const ownImage = await page.request.get(url, { headers: { Origin: "http://localhost:3000" } });
  expect(ownImage.status()).toBe(200);
  expect(ownImage.headers()["cache-control"]).toContain("no-store");
  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    await login(other, outsider);
    expect((await other.request.get(url, { headers: { Origin: "http://localhost:3000" } })).status()).toBe(404);
    expect((await other.goto("/community/review"))?.status()).toBe(404);
  } finally { await otherContext.close(); }
  await page.context().clearCookies();
  await login(page, reviewer);
  await page.goto("/community/review");
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: gameName, exact: true }) });
  for (const content of ["测试申请人", "13900000000", applicant.name, applicant.email]) await expect(card.getByText(content, { exact: true })).toBeVisible();
  await expect(card.getByRole("img", { name: "申请人的微信名片二维码" })).toBeVisible();
  expect(await card.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await card.getByLabel("审核意见", { exact: false }).fill("请补充每周可投入的组织时间。");
  await card.getByRole("button", { name: "退回补充", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("审核结果已保存");
  await page.context().clearCookies(); await login(page, applicant);
  await page.goto("/community/apply");
  await expect(page.getByText("处理意见：请补充每周可投入的组织时间。", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "修改并重新提交", exact: true }).click();
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue("测试申请人");
  await page.getByLabel("申请说明", { exact: false }).fill("每周投入三小时，组织游戏交流并人工联系和拉群。");
  await page.getByRole("button", { name: "修改并重新提交", exact: true }).click();
  await expect(page.getByRole("heading", { name: "申请已提交" })).toBeVisible();
  await page.getByRole("button", { name: "撤回网站申请", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("网站申请已撤回");
  await page.getByRole("link", { name: "修改并重新提交", exact: true }).click();
  await page.getByRole("button", { name: "修改并重新提交", exact: true }).click();
  await expect(page.getByRole("heading", { name: "申请已提交" })).toBeVisible();
  expect((await p.find({ collection: "community-applications", overrideAccess: true, where: { applicant: { equals: applicant.id } } })).totalDocs).toBe(1);
  await page.context().clearCookies(); await login(page, reviewer);
  await page.goto("/community/review");
  await card.getByRole("button", { name: "批准", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("审核结果已保存");
  const resolved = await p.findByID({ collection: "community-applications", id: application.id, overrideAccess: true, depth: 0 });
  expect(resolved.status).toBe("approved");
  game = Number(resolved.game);
  expect((await p.findByID({ collection: "users", id: applicant.id, overrideAccess: true })).roles).toEqual(["member"]);
  await page.context().clearCookies(); await login(page, applicant);
  await page.goto("/community/apply");
  await page.getByRole("checkbox", { name: "允许在任期间", exact: false }).uncheck();
  await page.getByRole("button", { name: "保存名片与展示设置", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("名片及展示设置已更新");
  const created = await p.findByID({ collection: "games", id: game, overrideAccess: true });
  expect(await (await page.request.get(`/community/${created.slug}/contacts`, { headers: { Origin: "http://localhost:3000" } })).json()).toEqual([]);
});

test("无效二维码被拒绝并保留填写资料", async ({ page }) => {
  await login(page, applicant);
  await page.goto("/community/apply");
  await page.getByLabel("姓名", { exact: true }).fill("测试申请人");
  await page.getByLabel("手机号", { exact: true }).fill("13900000000");
  await page.getByLabel("微信名片二维码", { exact: true }).setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("invalid") });
  await page.getByLabel("新游戏名称", { exact: false }).fill("失败申请测试");
  await page.getByLabel("申请说明", { exact: false }).fill("这是一条测试错误资料保留的申请说明。");
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.locator("form").getByRole("status")).toContainText("有效微信名片二维码图片");
  await expect(page.getByLabel("姓名", { exact: true })).toHaveValue("测试申请人");
  expect((await p.find({ collection: "community-applications", overrideAccess: true, where: { proposedGame: { equals: "失败申请测试" } } })).totalDocs).toBe(0);
});
