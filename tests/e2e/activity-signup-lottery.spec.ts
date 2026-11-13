import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { activity, submitSignup } from "../../src/lib/activity-signups";

const suffix = randomBytes(5).toString("hex"), password = randomBytes(16).toString("hex");
let p: Payload, manager: User, members: User[], event: number;
const form = { enabled: true, questions: [{ id: "note", label: "合成报名内容", type: "text", required: true }] };

test.beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  if (process.env.APP_ENV !== "development" || process.env.LOTTERY_TEST !== "isolated" ||
    db.hostname !== "127.0.0.1" || db.port !== "55463" || db.pathname !== "/lottery_migrate")
    throw new Error("Browser test requires the isolated migrated lottery database");
  p = await getPayload({ config });
  const create = (index: number, roles: User["roles"]) => p.create({ collection: "users", overrideAccess: true,
    context: { system: true }, data: { name: `抽签浏览${index}-${suffix}`, email: `lottery-ui-${index}-${suffix}@example.invalid`, password, roles } });
  manager = await create(0, ["vicePresident"]);
  members = await Promise.all([create(1, ["member"]), create(2, ["member"])]);
  event = (await p.create({ collection: "events", overrideAccess: false, user: manager,
    context: { manageSignupForm: true }, data: { title: "抽签浏览器合成活动", slug: `lottery-ui-${suffix}`,
      _status: "published", signupForm: form } })).id;
  const version = (await activity(p, "events", event, members[0])).version;
  for (let i = 0; i < members.length; i++) await submitSignup(p, "events", event, members[i], version, { note: `合成答案${i}` });
});
test.afterAll(async () => { if (p) await p.destroy(); });

async function login(page: Page, user: User) {
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(user.name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test("管理端抽签后，两位报名人从网页回执各自读取结果", async ({ page, browser }) => {
  await login(page, manager);
  await page.goto(`/activities/events/${event}/manage`);
  await page.getByRole("button", { name: "报名抽签", exact: true }).click();
  await expect(page.getByText("当前报名：")).toContainText("2 人");
  await page.getByLabel("中签人数").fill("1");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "抽签并公布结果" }).click();
  await expect(page.getByRole("status").filter({ hasText: "抽签完成" })).toBeVisible();
  await page.getByRole("button", { name: "报名名单", exact: true }).click();
  await page.getByRole("button", { name: "查看 / 刷新报名名单" }).click();
  await expect(page.getByText("抽签结果：已中签", { exact: true })).toHaveCount(1);
  await expect(page.getByText("抽签结果：未中签", { exact: true })).toHaveCount(1);

  const results: string[] = [];
  for (const member of members) {
    const context = await browser.newContext();
    const visitor = await context.newPage();
    await login(visitor, member);
    await visitor.goto(`/activities/events/${event}/fill`);
    const result = visitor.locator("dt").filter({ hasText: /^抽签结果$/ }).locator("xpath=..").locator("dd");
    await expect(result).toBeVisible();
    results.push(await result.innerText());
    await expect(visitor.getByText("合成报名内容", { exact: true })).toBeVisible();
    await context.close();
  }
  expect(results.sort()).toEqual(["已中签", "未中签"].sort());
});
