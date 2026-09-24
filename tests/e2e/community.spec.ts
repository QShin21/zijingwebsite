import "dotenv/config";
import { test, expect } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import { randomBytes } from "node:crypto";
let p: Payload;
const suffix = Date.now();
const email = `community-browser-${suffix}@example.invalid`;
const account = `${suffix}83`;
const password = randomBytes(24).toString("hex");
const slug = `browser-community-${suffix}`;
let userID: number;
let gameID: number;
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development") throw new Error("Development only");
  p = await getPayload({ config });
  userID = (await p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { email, account, name: "浏览器社群成员", password, roles: ["member"] } })).id;
  gameID = (await p.create({ collection: "games", overrideAccess: true, context: { system: true },
    data: { title: "浏览器社群", slug, _status: "published" } })).id;
});
test.afterAll(async () => {
  if (!p) return;
  await p.delete({ collection: "comments", overrideAccess: true,
    where: { author: { equals: userID } } });
  await p.delete({ collection: "forum-posts", overrideAccess: true,
    where: { author: { equals: userID } } });
  await p.delete({ collection: "games", id: gameID, overrideAccess: true });
  await p.delete({ collection: "users", id: userID, overrideAccess: true, context: { system: true } });
});
test("数字账户登录、社群发帖与论坛回复", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("数字账户或邮箱").fill(account);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto(`/community/${slug}`);
  await page.getByLabel("标题").fill("浏览器真实发帖流程");
  await page.getByLabel("内容").fill("在论坛里测试完整的发表流程。");
  await page.getByRole("button", { name: "发布到论坛" }).click();
  await expect(page).toHaveURL(new RegExp(`/community/${slug}/forum/\\d+`));
  await expect(page.getByRole("heading", { name: "浏览器真实发帖流程" })).toBeVisible();
  await page.getByLabel("回复").fill("这是通过浏览器发布的回复。");
  await page.getByRole("button", { name: "发表回复" }).click();
  await expect(page.getByText("这是通过浏览器发布的回复。")).toBeVisible();
});
