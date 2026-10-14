import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { normalizeSignup } from "../../src/lib/signup-schema";
import AxeBuilder from "@axe-core/playwright";

type SyntheticUser = { id: number; email: string; password: string; role: string };
let p: Payload, users: SyntheticUser[], president: User, event: number, batch: number | undefined;
const suffix = randomBytes(5).toString("hex"), slug = "rebuild-activity-" + suffix;
const root = process.env.REBUILD_QA_ROOT || "";
const title = "合成重构活动 · 报名交互 " + suffix;
const batchTitle = "合成重构批次 " + suffix;
const shots = root + "/evidence/rebuild-activity";
test.beforeAll(async () => {
  if (!root.includes("/.data/rebuild-qa-20261013") || process.env.APP_ENV !== "development" || new URL(process.env.DATABASE_URL!).hostname !== "127.0.0.1") throw new Error("isolated synthetic QA only");
  users = JSON.parse(await readFile(root + "/synthetic-browser-users.json", "utf8")).users;
  const resolved = await config; resolved.typescript.autoGenerate = false; resolved.admin.importMap.autoGenerate = false;
  p = await getPayload({ config: resolved });
  president = await p.findByID({ collection: "users", id: users.find(user => user.role === "president")!.id, overrideAccess: true });
  const form = normalizeSignup({ enabled: true, pageSize: 1, questions: [
    { id: "name", type: "text", label: "合成报名姓名", required: true },
    { id: "note", type: "textarea", label: "合成参与说明", required: true },
  ] });
  event = (await p.create({ collection: "events", overrideAccess: false, user: president, context: { manageSignupForm: true }, data: {
    title, slug, summary: "隔离合成活动，用于验证页面阅读、报名回执与表单保值。", location: "合成活动地点", type: "交流", startAt: new Date(Date.now() + 86400000).toISOString(), endAt: new Date(Date.now() + 172800000).toISOString(), _status: "published", signupForm: form,
  } })).id;
  await mkdir(shots, { recursive: true });
});
test.afterAll(async () => {
  if (!p) return;
  if (event) { await p.delete({ collection: "event-signups", overrideAccess: true, where: { and: [{ activityType: { equals: "events" } }, { activityID: { equals: event } }] } }); await p.delete({ collection: "events", id: event, overrideAccess: true }); }
  const drafts = await p.find({ collection: "staff-batches", overrideAccess: true, where: { title: { equals: batchTitle } } });
  for (const row of drafts.docs) await p.delete({ collection: "staff-batches", id: row.id, overrideAccess: true });
  await p.destroy();
});
async function login(page: Page, role: string) {
  const actor = users.find(user => user.role === role)!;
  const response = await page.request.post("/api/users/login", { data: { email: actor.email, password: actor.password } });
  expect(response.ok()).toBe(true);
}
test("activity detail to questionnaire: validation, theme retention, failed write, receipt and one record", async ({ page }) => {
  test.setTimeout(150000);
  await login(page, "member");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/events/" + slug);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByRole("link", { name: "填写报名问卷", exact: true })).toBeVisible();
  await page.screenshot({ path: shots + "/detail-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "填写报名问卷", exact: true }).click();
  await page.setViewportSize({ width: 360, height: 960 });
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByRole("alert", { name: "请核对以下题目" })).toContainText("合成报名姓名");
  await expect(page.locator("fieldset.signup-question")).toBeFocused();
  await page.getByLabel("合成报名姓名", { exact: true }).fill("合成填写保留");
  await page.getByRole("button", { name: "切换到深色主题", exact: true }).click();
  await expect(page.getByLabel("合成报名姓名", { exact: true })).toHaveValue("合成填写保留");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: shots + "/form-mobile-dark.png", fullPage: true });
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByLabel("合成参与说明", { exact: true }).fill("网络恢复后提交的合成说明");
  await page.getByRole("button", { name: "核对并提交", exact: true }).click();
  const endpoint = `/api/activities/events/${event}/signup`;
  await page.route("**" + endpoint, async route => { if (route.request().method() === "POST") await route.abort("failed"); else await route.continue(); });
  await page.getByRole("button", { name: "提交并确认报名", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "提交结果尚未确认" })).toBeVisible();
  await expect(page.locator(".questionnaire-review")).toContainText("合成填写保留");
  await page.unroute("**" + endpoint);
  await page.getByRole("button", { name: "提交并确认报名", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已报名", exact: true })).toBeVisible();
  const records = await p.find({ collection: "event-signups", overrideAccess: true, where: { and: [{ activityID: { equals: event } }, { activityType: { equals: "events" } }] } });
  expect(records.docs).toHaveLength(1); expect(records.docs[0].answers).toEqual({ name: "合成填写保留", note: "网络恢复后提交的合成说明" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: shots + "/receipt-mobile-dark.png", fullPage: true });
  const denied = await page.request.get(endpoint + "?mode=entries"); expect(denied.status()).toBe(403);
  await page.getByRole("button", { name: "切换到浅色主题", exact: true }).click();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});
test("staff batch business refusal preserves fields then saves the same draft record", async ({ page }) => {
  test.setTimeout(150000);
  await login(page, "president"); await page.goto("/staff/manage");
  const create = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "创建骨干招新批次" }) }).first();
  await create.locator(":scope > summary").click();
  await create.getByLabel("批次标题", { exact: true }).fill(batchTitle);
  await create.getByRole("textbox", { name: "批次说明", exact: true }).fill("合成业务拒绝后应保留的说明");
  await create.getByLabel("截止时间", { exact: true }).fill("2020-01-01T12:00");
  await create.getByRole("button", { name: "发布骨干招新", exact: true }).click();
  await expect(create.getByRole("alert")).toContainText("发布需提供未来截止时间");
  await expect(create.getByLabel("批次标题", { exact: true })).toHaveValue(batchTitle);
  await expect(create.getByRole("textbox", { name: "批次说明", exact: true })).toHaveValue("合成业务拒绝后应保留的说明");
  await create.getByLabel("截止时间", { exact: true }).fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  await create.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "草稿未公开" })).toBeVisible();
  const saved = await p.find({ collection: "staff-batches", overrideAccess: true, where: { title: { equals: batchTitle } } });
  expect(saved.docs).toHaveLength(1); batch = saved.docs[0].id;
  expect((await page.request.get(`/api/staff/batches/${batch}/application`)).status()).toBe(404);
  await page.setViewportSize({ width: 390, height: 960 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: shots + "/staff-manager-mobile.png", fullPage: true });
});
