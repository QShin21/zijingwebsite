import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { decideCommunityApplication } from "../../src/lib/community-operations";
let p: Payload, organizer: User, member: User, leader: User, stranger: User;
let game: number, post: number, application: number;
const suffix = randomBytes(6).toString("hex"), password = randomBytes(24).toString("hex"), slug = `join-flow-${suffix}`;
const sameOrigin = { Origin: "http://localhost:3000" };
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Isolated loopback only");
  p = await getPayload({ config, key: "club-operations-browser" });
  const create = (label: string, roles: User["roles"]) => p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: `${label}-${suffix}`, email: `${label}-${suffix}@example.invalid`, password, roles } });
  organizer = await create("Organizer", ["backbone"]); member = await create("Participant", ["member"]); leader = await create("Leader", ["president"]); stranger = await create("Stranger", ["backbone"]);
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "隔离人工进群社群", slug, _status: "published", demo: true } })).id;
  const qr = "data:image/png;base64," + (await sharp({ create: { width: 40, height: 40, channels: 3, background: "white" } }).png().toBuffer()).toString("base64");
  const app = await p.create({ collection: "community-applications", user: organizer, overrideAccess: false, data: { game, applicant: organizer.id, proposedGame: "隔离人工进群社群", reason: "承担游戏社群运营并提供个人名片，由我人工拉群。", realName: "合成组织者", phone: "13900000000", wechatQr: qr, contactConsent: true } });
  application = app.id; await decideCommunityApplication(p, leader, app.id, "approved", "", app.updatedAt);
  organizer = await p.findByID({ collection: "users", id: organizer.id, overrideAccess: true, depth: 0 });
  post = (await p.create({ collection: "community-posts", user: organizer, overrideAccess: false, context: { manageSignupForm: true }, data: { game, author: organizer.id, title: "隔离表单与权限检查", body: "合成验收记录，不发真实通知", category: "event", signupForm: { enabled: true, questions: [{ id: "name", label: "称呼", type: "text", required: true }] } } })).id;
});
test.afterAll(async () => {
  if (!p) return;
  for (const collection of ["event-signups", "community-joins", "community-posts"] as const) await p.delete({ collection, overrideAccess: true, where: { game: { equals: game } } });
  if (application) await p.delete({ collection: "community-applications", id: application, overrideAccess: true });
  await p.delete({ collection: "games", id: game, overrideAccess: true });
  for (const user of [organizer, member, leader, stranger]) if (user) await p.delete({ collection: "users", id: user.id, overrideAccess: true, context: { system: true } });
  await p.destroy();
});
async function login(page: Page, user: User) {
  await page.goto("/login"); await page.getByLabel("昵称或邮箱").fill(user.name); await page.getByLabel("密码", { exact: true }).fill(password); await page.getByRole("button", { name: "登录", exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
}
test("人工进群完整回执、后台确认、隐私隔离及旧会话撤权", async ({ page, browser, request }) => {
  const ready = await request.get("/health/ready");
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ status: "ready", schema: "club-operations-1" });
  await login(page, member);
  await expect(page.getByText("尚未人工确认进群", { exact: true })).toBeVisible();
  await page.goto(`/community/${slug}`);
  await page.getByRole("button", { name: "添加社群管理员微信", exact: false }).click();
  await expect(page.getByRole("dialog").getByText("保存或扫描名片不会自动进群。", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await page.goto("/account"); await expect(page.getByText("尚未人工确认进群", { exact: true })).toBeVisible();
  await page.goto(`/community/${slug}/join`);
  await page.getByRole("button", { name: "记录加入意向", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "网站已记录意向" })).toBeVisible();
  await page.getByRole("button", { name: "我已发送好友申请" }).click();
  await expect(page.getByRole("status").filter({ hasText: "你已报告发送好友申请" })).toBeVisible();
  expect((await request.get(`/community/${slug}/contacts`)).status()).toBe(401);
  const second = await browser.newContext();
  try {
    const managerPage = await second.newPage(); await login(managerPage, organizer);
    await expect(managerPage.getByText("骨干", { exact: false }).first()).toBeVisible();
    await managerPage.goto(`/community/${slug}/members`);
    await managerPage.getByRole("button", { name: "好友已通过，等待拉群" }).click();
    await expect(managerPage.getByText("管理员已确认好友通过 · 等待人工拉群", { exact: true })).toBeVisible();
    await managerPage.getByRole("button", { name: "已人工拉群，确认进群" }).click();
    await expect(managerPage.getByText("暂无待处理进群意向。", { exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole("status").filter({ hasText: "管理员已人工确认进群" })).toBeVisible();
    await page.goto("/account"); await expect(page.getByText("已有管理员人工确认进群", { exact: true })).toBeVisible();
    const endpoint = `/api/activities/community-posts/${post}/signup`;
    const formResponse = await page.request.get(endpoint, { headers: sameOrigin });
    expect(formResponse.status()).toBe(200);
    const current = await formResponse.json();
    expect((await page.request.post(endpoint, { headers: { Origin: "http://localhost:3000" }, data: { version: current.version, answers: { name: "隔离填写者" } } })).status()).toBe(200);
    expect((await managerPage.request.get(endpoint + "?mode=manage", { headers: sameOrigin })).status()).toBe(200);
    for (const mode of ["entries", "stats", "export"]) expect((await managerPage.request.get(endpoint + "?mode=" + mode, { headers: sameOrigin })).status()).toBe(403);
    organizer = await p.update({ collection: "users", id: organizer.id, overrideAccess: false, user: leader, data: { communityOffices: organizer.communityOffices!.map(office => ({ ...office, status: "revoked" as const })) } });
    expect((await managerPage.goto(`/community/${slug}/members`))?.status()).toBe(404);
    expect((await managerPage.request.get(endpoint + "?mode=manage", { headers: sameOrigin })).status()).toBe(403);
    const contacts = await page.request.get(`/community/${slug}/contacts`, { headers: sameOrigin }); expect(await contacts.json()).toEqual([]);
    await page.context().clearCookies(); await login(page, stranger);
    const joins = await page.request.get(`/api/community-joins?where[game][equals]=${game}`, { headers: sameOrigin }); expect((await joins.json()).docs).toEqual([]);
    const graphql = await page.request.post("/api/graphql", { headers: { Origin: "http://localhost:3000" }, data: { query: `query { CommunityJoins(where: { game: { equals: ${game} } }) { docs { id status } } }` } });
    // This deployment intentionally exposes REST only; GraphQL remains unavailable.
    expect(graphql.status()).toBe(404);
    expect(JSON.stringify(await graphql.json())).not.toContain("memberName");
    expect((await page.request.patch(`/api/community-joins/${(await p.find({ collection: "community-joins", overrideAccess: true, where: { game: { equals: game } } })).docs[0].id}`, { headers: { Origin: "http://localhost:3000" }, data: { status: "joined", context: { communityJoinWrite: true, system: true } } })).status()).toBe(403);
  } finally { await second.close(); }
});
test("预览居中、进群空态、联系兜底及四个响应式断点", async ({ page }) => {
  await login(page, leader);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/activities/community-posts/${post}/manage`);
    await page.getByRole("button", { name: "预览填写效果", exact: true }).click();
    const dialog = page.locator("dialog.questionnaire-dialog"); await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox(); expect(box).not.toBeNull(); expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(3);
    expect(box!.y).toBeGreaterThan(0); await dialog.getByRole("button", { name: "关闭预览", exact: true }).click();
    await page.goto(`/community/${slug}/join`); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto("/contact"); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole("link", { name: "申请组织已有或新游戏社群", exact: true })).toBeVisible();
    expect(await page.locator('main a[href="/contact"]').count()).toBe(0);
  }
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});
