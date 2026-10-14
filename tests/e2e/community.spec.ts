import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import { randomBytes } from "node:crypto";
let p: Payload;
const suffix = Date.now();
const email = `community-browser-${suffix}@example.invalid`;
const nickname = `Shin-${suffix}`;
const password = randomBytes(24).toString("hex");
const slug = `browser-community-${suffix}`;
let userID: number;
let gameID: number;
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development")
    throw new Error("Development only");
  p = await getPayload({ config });
  userID = (
    await p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        email,
        name: nickname,
        password,
        roles: ["member"],
      },
    })
  ).id;
  gameID = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: { title: "浏览器社群", slug, _status: "published" },
    })
  ).id;
});

const retiredPaths = (slug: string) => [
  `/community/${slug}/chat`, `/community/${slug}/chat/feed`, `/community/${slug}/chat/stream`,
  "/community/chat-images/1", "/community/stickers?q=test", "/api/community-messages",
  "/api/community-messages/1", "/admin/collections/community-messages",
];
async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(nickname);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test("社群保留通知、风采和微信入口，已移除论坛与聊天", async ({ page }) => {
  await login(page);
  await page.goto(`/community/${slug}`);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  const sections = page.getByRole("navigation", { name: "社群分区" });
  await expect(sections.getByRole("link")).toHaveCount(4);
  await expect(sections.getByRole("link", { name: "社群首页", exact: true })).toHaveAttribute("href", `/community/${slug}`);
  for (const [name, section] of [["活动与通知", "updates"], ["社群风采", "showcase"], ["进群进度", "join"]])
    await expect(sections.getByRole("link", { name, exact: true })).toHaveAttribute("href", `/community/${slug}/${section}`);
  await expect(page.locator('a[href*="/chat"]')).toHaveCount(0);
  await page.getByRole("button", { name: /添加社群管理员微信/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("旧聊天页面和接口对访客及登录用户都返回404，拒绝发送和修改", async ({ page }) => {
  for (const signedIn of [false, true]) {
    if (signedIn) await login(page);
    for (const path of retiredPaths(slug)) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(404);
      expect(response.headers()["cache-control"]).toBe("private, no-store");
    }
    expect((await page.request.post("/api/community-messages", { data: { game: gameID, body: "retired" } })).status()).toBe(404);
    expect((await page.request.patch("/api/community-messages/1", { data: { status: "visible" } })).status()).toBe(404);
  }
});

test("访客仅活动通知可用，直接社群接口与伪造会话被拒绝", async ({ page, context }) => {
  for (const path of ["/events", "/announcements"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("navigation", { name: "主导航", exact: true }).getByRole("link")).toHaveCount(2);
  }
  for (const path of ["/community", "/teams", "/honors", "/news", "/gallery", "/join/members", "/contact"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/login\?/);
  }
  for (const path of [`/community/${slug}/contacts`, "/api/games"]) {
    expect((await page.request.get(path)).status()).toBe(401);
  }
  await context.addCookies([{ name: "payload-token", value: "forged", domain: "localhost", path: "/" }]);
  await page.goto(`/community/${slug}`); await expect(page).toHaveURL(/\/login\?/);
});

test("邮箱也可登录同一账号，错误登录统一提示", async ({ page }) => {
  for (const [identifier, secret] of [[nickname, "wrong-password"], [`missing-${suffix}`, password]]) {
    await page.goto("/login");
    await page.getByLabel("昵称或邮箱").fill(identifier);
    await page.getByLabel("密码", { exact: true }).fill(secret);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("昵称、邮箱或密码错误，请核对后重试。");
  }
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(email.toUpperCase());
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  const profile = page.getByRole("region", { name: "账号资料", exact: true });
  await expect(profile.getByText(nickname, { exact: true })).toBeVisible();
  await expect(profile.getByText(email, { exact: true })).toBeVisible();
});

test("注册拒绝已占用昵称且没有数字账户输入", async ({ page }) => {
  await page.goto("/register");
  await expect(page.locator('input[name="account"]')).toHaveCount(0);
  const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "创建账号", exact: true }) });
  await form.getByLabel("邮箱前缀").fill(`new-${suffix}`);
  await form.locator('input[name="name"]').fill(nickname.toUpperCase());
  await form.locator('input[name="password"]').fill(password);
  await form.locator('input[name="confirm"]').fill(password);
  await form.getByRole("button", { name: "验证并注册" }).click();
  await expect(form.getByRole("alert")).toHaveText("该昵称已被使用，请更换昵称");
});
test.afterAll(async () => {
  if (!p) return;
  await p.delete({ collection: "games", id: gameID, overrideAccess: true });
  await p.delete({
    collection: "users",
    id: userID,
    overrideAccess: true,
    context: { system: true },
  });
});
test("昵称登录、论坛关闭与社群只读导航", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(nickname.toLowerCase());
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  const profile = page.getByRole("region", { name: "账号资料", exact: true });
  await expect(profile.getByText(nickname, { exact: true })).toBeVisible();
  await expect(profile.getByText(email, { exact: true })).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/account",
      "/community/apply",
      `/community/${slug}`,
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        route,
      ).toBeLessThanOrEqual(width);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations, route).toEqual([]);
    }
  }
  for (const path of [`/community/${slug}/forum`, `/community/${slug}/forum/1`, '/api/forum-posts', '/api/comments', '/api/community-reactions', '/api/miniapp/reactions']) {
    expect((await page.request.get(path)).status()).toBe(404);
    expect((await page.request.post(path, { data: {} })).status()).toBe(404);
  }
  await page.goto(`/community/${slug}`);
  await expect(page.getByRole("link", { name: /论坛/ })).toHaveCount(0);
  await p.update({
    collection: "users",
    id: userID,
    overrideAccess: true,
    context: { system: true },
    data: { roles: ["vicePresident"] },
  });
  await page.goto("/community/review");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "社群管理员申请审核",
  );
  await page.setViewportSize({ width: 390, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
