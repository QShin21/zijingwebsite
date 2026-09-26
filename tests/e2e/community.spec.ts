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
  const form = page.locator("form.member-form").nth(1);
  await form.getByLabel("邮箱 @ 前的部分").fill(`new-${suffix}`);
  await form.getByLabel("验证码", { exact: true }).fill("123456");
  await form.locator('input[name="name"]').fill(nickname.toUpperCase());
  await form.locator('input[name="password"]').fill(password);
  await form.locator('input[name="confirm"]').fill(password);
  await form.getByRole("button", { name: "验证并注册" }).click();
  await expect(page.getByRole("status")).toHaveText("该昵称已被使用，请更换昵称");
});
test.afterAll(async () => {
  if (!p) return;
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
  await page.goto(`/community/${slug}`);
  await page.getByLabel("标题").fill("浏览器真实发帖流程");
  await page.getByLabel("内容").fill("在论坛里测试完整的发表流程。");
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
