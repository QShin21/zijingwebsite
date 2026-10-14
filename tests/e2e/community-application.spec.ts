import { browserTestOrigin } from "./browser-test-origin";
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
  await page.getByRole("textbox", { name: "姓名", exact: true }).fill("测试申请人");
  await page.getByRole("textbox", { name: "手机号", exact: true }).fill("13900000000");
  await page.getByLabel(/^微信名片二维码（(?:必填|更换时上传)）$/).setInputFiles({ name: "card.png", mimeType: "image/png", buffer: qr });
  await page.getByLabel("新游戏名称", { exact: false }).fill("X");
  await page.getByLabel("申请说明", { exact: false }).fill("希望负责本游戏的日常交流和社群组织工作。");
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const consent = page.locator("form.application-form").getByRole("checkbox", { name: "我同意展示我的微信名片作为进群联系方式", exact: true });
  await expect(consent).not.toBeChecked();
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.locator('form.application-form').getByRole('alert')).toHaveText('由于入社流程规定，必须展示管理联系方式');
  await expect(consent).toHaveAccessibleDescription(/由于入社流程规定，必须展示管理联系方式/);
  await expect(consent).toBeFocused();
  await expect(consent).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("textbox", { name: "姓名", exact: true })).toHaveValue("测试申请人");
  expect(await page.getByLabel(/^微信名片二维码（(?:必填|更换时上传)）$/).evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe("card.png");
  expect((await p.find({ collection: "community-applications", overrideAccess: true, where: { applicant: { equals: applicant.id } } })).totalDocs).toBe(0);
  await consent.check();
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.locator("form").getByRole("status")).toContainText("新游戏名称需为 2–80 字");
  await page.getByLabel("新游戏名称", { exact: false }).fill(gameName);
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.getByRole("heading", { name: "申请已提交" })).toBeVisible();
  await expect(page.getByText("批准与网站初始化不代表已经创建或进入微信群。", { exact: false })).toBeVisible();
  const application = (await p.find({ collection: "community-applications", overrideAccess: true, where: { applicant: { equals: applicant.id } }, depth: 0 })).docs[0];
  expect(application.realName).toBe("测试申请人");
  const url = `/community/applications/${application.id}/qr`;
  expect((await request.get(url)).status()).toBe(401);
  const ownImage = await page.request.get(url, { headers: { Origin: browserTestOrigin } });
  expect(ownImage.status()).toBe(200);
  expect(ownImage.headers()["cache-control"]).toContain("no-store");
  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    await login(other, outsider);
    expect((await other.request.get(url, { headers: { Origin: browserTestOrigin } })).status()).toBe(404);
    expect((await other.goto("/community/review"))?.status()).toBe(404);
  } finally { await otherContext.close(); }
  await page.context().clearCookies();
  await login(page, reviewer);
  await page.goto("/community/review");
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: gameName, exact: true }) });
  for (const content of ["测试申请人", "13900000000", applicant.name, applicant.email]) await expect(card.getByText(content, { exact: true })).toBeVisible();
  await card.locator("summary").filter({ hasText: /^核对微信名片$/ }).click();
  await expect(card.getByRole("img", { name: "申请人的微信名片二维码" })).toBeVisible();
  await expect.poll(() => card.getByRole("img", { name: "申请人的微信名片二维码", exact: true }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await card.getByLabel("审核意见", { exact: false }).fill("请补充每周可投入的组织时间。");
  await card.getByRole("button", { name: "退回补充", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("审核结果已保存");
  await page.context().clearCookies(); await login(page, applicant);
  const history = page.getByRole("navigation", { name: "申请记录视图", exact: true }).getByRole("link", { name: "查看全部申请", exact: true });
  await expect(history).toHaveAttribute("href", "/account?view=history#applications-title");
  await history.click();
  await expect(page).toHaveURL(url => url.pathname === "/account" && url.search === "?view=history" && url.hash === "#applications-title");
  const applicationLink = page.getByRole("region", { name: "申请记录", exact: true }).getByRole("link", { name: gameName, exact: true });
  await expect(applicationLink).toHaveAttribute("href", `/community/apply?edit=${application.id}`);
  await applicationLink.click();
  await expect(page).toHaveURL(url => url.pathname === "/community/apply" && url.search === `?edit=${application.id}` && url.hash === "");
  await expect(page.getByRole("textbox", { name: "姓名", exact: true })).toHaveValue("测试申请人");
  await page.goto("/community/apply");
  await expect(card.getByRole("heading", { name: "处理意见", exact: true })).toBeVisible();
  await expect(card.getByText("请补充每周可投入的组织时间。", { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: "修改并重新提交", exact: true })).toHaveAttribute("href", `/community/apply?edit=${application.id}`);
  await card.getByRole("link", { name: "修改并重新提交", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "姓名", exact: true })).toHaveValue("测试申请人");
  await expect(consent).toBeChecked();
  await page.getByLabel("申请说明", { exact: false }).fill("每周投入三小时，组织游戏交流并人工联系和拉群。");
  await page.getByRole("button", { name: "修改并重新提交", exact: true }).click();
  await expect(page.getByRole("heading", { name: "申请已提交" })).toBeVisible();
  await page.getByRole("button", { name: "撤回网站申请", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "网站申请已撤回" })).toHaveText("网站申请已撤回，微信联系不受此操作影响。");
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
  await card.locator("summary").filter({ hasText: /^管理我的联系名片$/ }).click();
  await card.getByRole("checkbox", { name: "我同意展示我的微信名片作为进群联系方式", exact: true }).uncheck();
  await card.getByRole("button", { name: "保存名片与展示设置", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "名片及展示设置已更新" })).toHaveText("名片及展示设置已更新。");
  const created = await p.findByID({ collection: "games", id: game, overrideAccess: true });
  expect(await (await page.request.get(`/community/${created.slug}/contacts`, { headers: { Origin: browserTestOrigin } })).json()).toEqual([]);
});

test("无效二维码被拒绝并保留填写资料", async ({ page }) => {
  await login(page, applicant);
  await page.goto("/community/apply");
  await page.getByRole("textbox", { name: "姓名", exact: true }).fill("测试申请人");
  await page.getByRole("textbox", { name: "手机号", exact: true }).fill("13900000000");
  await page.getByLabel(/^微信名片二维码（(?:必填|更换时上传)）$/).setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("invalid") });
  await page.getByLabel("新游戏名称", { exact: false }).fill("失败申请测试");
  await page.getByLabel("申请说明", { exact: false }).fill("这是一条测试错误资料保留的申请说明。");
  await page.locator("form.application-form").getByRole("checkbox", { name: "我同意展示我的微信名片作为进群联系方式", exact: true }).check();
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.locator("form").getByRole("status")).toContainText("有效微信名片二维码图片");
  await expect(page.getByRole("textbox", { name: "姓名", exact: true })).toHaveValue("测试申请人");
  expect((await p.find({ collection: "community-applications", overrideAccess: true, where: { proposedGame: { equals: "失败申请测试" } } })).totalDocs).toBe(0);
});

test("历史false或缺失授权不可批准，退回后本人明确同意再重提同一编号", async ({ page }) => {
  const database = new URL(process.env.DATABASE_URL || 'postgresql://unconfigured');
  test.skip(database.hostname !== '127.0.0.1' || database.port !== '40071' || database.pathname !== '/community_contact_consent_web_qa_synthetic', 'Legacy SQL fixture is limited to the explicitly authorized fresh synthetic web database.');
  const proposedGame = gameName + '-legacy';
  await login(page, applicant); await page.goto('/community/apply');
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('合成历史申请人');
  await page.getByRole('textbox', { name: '手机号', exact: true }).fill('13900000000');
  await page.getByLabel(/^微信名片二维码（(?:必填|更换时上传)）$/).setInputFiles({ name: 'legacy.png', mimeType: 'image/png', buffer: qr });
  await page.getByLabel('新游戏名称', { exact: false }).fill(proposedGame);
  await page.getByLabel('申请说明', { exact: false }).fill('合成历史申请，验证必须由申请人本人补充同意。');
  const consent = page.locator('form.application-form').getByRole('checkbox', { name: '我同意展示我的微信名片作为进群联系方式', exact: true });
  await consent.check(); await page.getByRole('button', { name: '提交审核', exact: true }).click();
  await expect(page.getByRole('heading', { name: '申请已提交' })).toBeVisible();
  const saved = (await p.find({ collection: 'community-applications', overrideAccess: true, where: { and: [{ applicant: { equals: applicant.id } }, { proposedGame: { equals: proposedGame } }] }, depth: 0 })).docs[0];
  expect(saved.contactConsent).toBe(true);
  const { Pool } = await import('pg');
  const sql = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await page.context().clearCookies(); await login(page, reviewer);
    for (const oldConsent of [false, null]) {
      // Only this just-created synthetic row models a pre-policy record.
      const result = await sql.query('UPDATE community_applications SET contact_consent=$1 WHERE id=$2 AND applicant_id=$3 AND proposed_game=$4 AND status=\'pending\' RETURNING id', [oldConsent, saved.id, applicant.id, proposedGame]);
      expect(result.rowCount).toBe(1);
      await page.goto('/community/review');
      const card = page.locator('article').filter({ has: page.getByRole('heading', { name: proposedGame, exact: true }) });
      await expect(card.getByRole('button', { name: '批准', exact: true })).toBeDisabled();
      await expect(card.getByText('由于入社流程规定，必须展示管理联系方式', { exact: false })).toBeVisible();
      await expect(card.getByText('请退回申请，由本人勾选', { exact: false })).toBeVisible();
      await expect(card.getByRole('button', { name: '退回补充', exact: true })).toBeEnabled();
    }
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: proposedGame, exact: true }) });
    await card.getByLabel('审核意见', { exact: false }).fill('请本人明确同意展示微信名片作为进群联系方式后重新提交。');
    await card.getByRole('button', { name: '退回补充', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('审核结果已保存');
    const returned = await p.findByID({ collection: 'community-applications', id: saved.id, overrideAccess: true, depth: 0 });
    expect(returned.status).toBe('returned'); expect(returned.contactConsent).not.toBe(true);
    await page.context().clearCookies(); await login(page, applicant);
    await page.goto('/community/apply?edit=' + saved.id);
    await expect(consent).not.toBeChecked();
    await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue('合成历史申请人');
    await page.getByRole('button', { name: '修改并重新提交', exact: true }).click();
    await expect(page.locator('form.application-form').getByRole('alert')).toHaveText('由于入社流程规定，必须展示管理联系方式');
    await expect(consent).toHaveAccessibleDescription(/由于入社流程规定，必须展示管理联系方式/);
    await expect(consent).toBeFocused();
    expect((await p.findByID({ collection: 'community-applications', id: saved.id, overrideAccess: true, depth: 0 })).updatedAt).toBe(returned.updatedAt);
    await consent.check(); await page.getByRole('button', { name: '修改并重新提交', exact: true }).click();
    await expect(page.getByRole('heading', { name: '申请已提交' })).toBeVisible();
    const resubmitted = await p.findByID({ collection: 'community-applications', id: saved.id, overrideAccess: true, depth: 0 });
    expect(resubmitted.status).toBe('pending'); expect(resubmitted.contactConsent).toBe(true); expect(resubmitted.id).toBe(saved.id);
    expect((await p.find({ collection: 'community-applications', overrideAccess: true, where: { proposedGame: { equals: proposedGame } } })).totalDocs).toBe(1);
  } finally { await sql.end(); }
});
