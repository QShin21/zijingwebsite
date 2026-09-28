import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
import { test, expect } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
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

test("独立分区、连续聊天、历史翻页与新消息保留", async ({ page }) => {
  const user = await p.findByID({ collection: "users", id: userID, overrideAccess: true });
  for (let i = 1; i <= 65; i++) await p.create({ collection: "community-messages", overrideAccess: false, user,
    data: { game: gameID, author: userID, body: `历史聊天第${i}条`, createdAt: new Date(Date.now() - 3600000 + i * 1000).toISOString() } });
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(nickname);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto(`/community/${slug}`);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  for (const [name, section] of [["活动与通知", "updates"], ["论坛讨论", "forum"], ["社群交流", "chat"], ["社群风采", "showcase"]])
    await expect(page.getByRole("navigation", { name: "社群分区" }).getByRole("link", { name, exact: true })).toHaveAttribute("href", `/community/${slug}/${section}`);
  await page.getByRole("button", { name: /添加社群管理员微信/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto(`/community/${slug}/chat`);
  await expect(page.locator(".chat-message")).toHaveCount(50);
  await page.getByRole("button", { name: "加载更早消息" }).click();
  await expect(page.locator(".chat-message")).toHaveCount(65);
  await expect(page.getByText("历史聊天第1条", { exact: true })).toBeVisible();
  await page.getByLabel("发消息").fill("新发言不会覆盖聊天历史");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByText("新发言不会覆盖聊天历史", { exact: true })).toBeVisible();
  await expect(page.locator(".chat-message")).toHaveCount(66);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("访客仅活动通知可用，直接社群接口与伪造会话被拒绝", async ({ page, context }) => {
  for (const path of ["/events", "/announcements"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("navigation", { name: "主导航", exact: true }).getByRole("link")).toHaveCount(2);
  }
  for (const path of ["/community", `/community/${slug}/chat`, "/teams", "/honors", "/news", "/gallery", "/join/members", "/contact"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/login\?/);
  }
  for (const path of [`/community/${slug}/chat/feed`, `/community/${slug}/chat/stream`, `/community/${slug}/contacts`, "/api/community-messages", "/api/games"]) {
    expect((await page.request.get(path)).status()).toBe(401);
  }
  await context.addCookies([{ name: "payload-token", value: "forged", domain: "localhost", path: "/" }]);
  await page.goto(`/community/${slug}`); await expect(page).toHaveURL(/\/login\?/);
});

test("实时推送连续发言、隐藏、重连补齐超过50条消息", async ({ page, browser }) => {
  const observer = await browser.newContext(); const reader = await observer.newPage();
  const login = async (target: typeof page) => {
    await target.goto("/login"); await target.getByLabel("昵称或邮箱").fill(nickname);
    await target.getByLabel("密码", { exact: true }).fill(password);
    await target.getByRole("button", { name: "登录", exact: true }).click(); await expect(target).toHaveURL(/\/account$/);
    await target.goto(`/community/${slug}/chat`);
    await expect(target.getByRole("status")).toContainText("实时更新");
  };
  try {
    await login(page); await login(reader);
    for (let i = 0; i < 3; i++) {
      await page.getByLabel("发消息").fill(`实时连续发言${i}`);
      await page.getByRole("button", { name: "发送", exact: true }).click();
      await expect(reader.getByText(`实时连续发言${i}`, { exact: true })).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole("button", { name: "发送", exact: true })).toBeDisabled();
    }
    const target = await p.find({ collection: "community-messages", overrideAccess: true, where: { game: { equals: gameID }, body: { equals: "实时连续发言0" } } });
    await p.update({ collection: "community-messages", id: target.docs[0].id, overrideAccess: true, user: { ...(await p.findByID({ collection: "users", id: userID })), roles: ["vicePresident"] }, data: { status: "hidden" } });
    await expect(reader.getByText("实时连续发言0", { exact: true })).toHaveCount(0, { timeout: 3000 });
    await observer.setOffline(true);
    const user = await p.findByID({ collection: "users", id: userID });
    for (let i = 0; i < 55; i++) await p.create({ collection: "community-messages", overrideAccess: false, user, data: { game: gameID, author: userID, body: `断线补齐${i}` } });
    await observer.setOffline(false);
    await expect(reader.getByText("断线补齐54", { exact: true })).toBeVisible();
    await expect(reader.locator(".chat-bubble").filter({ hasText: /^断线补齐/ })).toHaveCount(55);
  } finally { await observer.close(); }
});

test("回车发送、Ctrl回车换行、图片和表情发送", async ({ page, browser }) => {
  await page.goto("/login"); await page.getByLabel("昵称或邮箱").fill(nickname);
  await page.getByLabel("密码", { exact: true }).fill(password); await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/); await page.goto(`/community/${slug}/chat`);
  const input = page.getByLabel("发消息");
  await expect(page.getByRole("button", { name: "隐藏消息", exact: true })).toHaveCount(0);
  await expect(page.locator(".chat-top [role=status]")).toContainText("已连接");
  await input.fill("第一行"); await page.keyboard.down("Control"); await input.press("Enter"); await page.keyboard.up("Control");
  await expect(input).toHaveValue("第一行\n"); await input.press("End"); await input.press("a");
  await expect(input).toHaveValue("第一行\na");
  await input.dispatchEvent("keydown", { key: "Enter", isComposing: true }); await expect(input).toHaveValue("第一行\na");
  await input.press("Enter"); await expect(page.locator(".chat-bubble").filter({ hasText: "第一行" })).toContainText("a"); await expect(input).toHaveValue("");
  const picture = await sharp({ create: { width: 2800, height: 1800, channels: 3, background: "#9966bb" } }).png().toBuffer();
  await page.getByLabel("添加图片", { exact: true }).setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: picture });
  await expect(page.getByAltText("待发送图片")).toBeVisible();
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.locator(".chat-image")).toHaveCount(1); await expect(page.getByAltText("待发送图片")).toHaveCount(0);
  const source = await page.locator(".chat-image").getAttribute("src");
  const downloaded = await page.evaluate(async url => {
    const response = await fetch(url);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { status: response.status, dataUrl };
  }, source!);
  expect(downloaded.status).toBe(200);
  const meta = await sharp(Buffer.from(downloaded.dataUrl.split(",")[1]!, "base64")).metadata(); expect(meta.width).toBe(2048); expect(meta.format).toBe("webp");
  const guest = await browser.newContext(); expect((await guest.request.get(source!)).status()).toBe(401); await guest.close();
  const sticker = "https://img.doutupk.com/production/uploads/image/2020/01/test.gif";
  await page.route("**/community/stickers?*", async route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.has("q")) await route.fulfill({ json: { images: [sticker] } });
    else if (params.has("preview")) await route.fulfill({ contentType: "image/png", body: picture });
    else await route.fulfill({ json: { image: `data:image/png;base64,${picture.toString("base64")}` } });
  });
  await page.getByRole("button", { name: "搜索表情包" }).click(); await page.getByLabel("表情关键词").fill("开心"); await page.getByLabel("表情关键词").press("Enter");
  await page.getByRole("button", { name: "选择表情 1", exact: true }).click(); await expect(page.getByAltText("待发送图片")).toBeVisible();
  await input.press("Enter"); await expect(page.locator(".chat-image")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("邮箱也可登录同一账号，错误登录统一提示", async ({ page }) => {
  for (const [identifier, secret] of [[nickname, "wrong-password"], [`missing-${suffix}`, password]]) {
    await page.goto("/login");
    await page.getByLabel("昵称或邮箱").fill(identifier);
    await page.getByLabel("密码", { exact: true }).fill(secret);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("昵称、邮箱或密码错误");
  }
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(email.toUpperCase());
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator("main h1")).toContainText(nickname);
});

test("注册拒绝已占用昵称且没有数字账户输入", async ({ page }) => {
  await page.goto("/register");
  await expect(page.locator('input[name="account"]')).toHaveCount(0);
  const form = page.locator("form.registration-form");
  await form.getByLabel("邮箱前缀").fill(`new-${suffix}`);
  await form.locator('input[name="name"]').fill(nickname.toUpperCase());
  await form.locator('input[name="password"]').fill(password);
  await form.locator('input[name="confirm"]').fill(password);
  await form.getByRole("button", { name: "验证并注册" }).click();
  await expect(page.getByRole("status")).toHaveText("该昵称已被使用，请更换昵称");
});
test.afterAll(async () => {
  if (!p) return;
  await p.delete({ collection: "community-messages", overrideAccess: true, where: { game: { equals: gameID } } });
  await p.delete({
    collection: "comments",
    overrideAccess: true,
    where: { author: { equals: userID } },
  });
  await p.delete({
    collection: "forum-posts",
    overrideAccess: true,
    where: { author: { equals: userID } },
  });
  await p.delete({ collection: "games", id: gameID, overrideAccess: true });
  await p.delete({
    collection: "users",
    id: userID,
    overrideAccess: true,
    context: { system: true },
  });
});
test("昵称登录、社群发帖与论坛回复", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(nickname.toLowerCase());
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator("main h1")).toContainText(nickname);
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
  await page.goto(`/community/${slug}/forum`);
  await page.getByLabel("标题").fill("浏览器真实发帖流程");
  await page.getByLabel("内容", { exact: true }).fill("在论坛里测试完整的发表流程。");
  await page.getByRole("button", { name: "发布到论坛" }).click();
  await expect(page).toHaveURL(new RegExp(`/community/${slug}/forum/\\d+`));
  await expect(
    page.getByRole("heading", { name: "浏览器真实发帖流程" }),
  ).toBeVisible();
  await page.getByLabel("回复").fill("这是通过浏览器发布的回复。");
  await page.getByRole("button", { name: "发表回复" }).click();
  await expect(page.getByText("这是通过浏览器发布的回复。")).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
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
