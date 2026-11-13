import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { activity, submitSignup } from "../../src/lib/activity-signups";
import { readCSV } from "../csv";

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
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, manager);
  await page.goto(`/activities/events/${event}/manage`);
  await page.getByRole("button", { name: "报名抽签", exact: true }).click();
  await expect(page.getByText("当前报名：")).toContainText("2 人");
  await expect(page.getByRole("button", { name: "导出抽签结果 CSV" })).toBeDisabled();
  const countInput = page.getByLabel("中签人数");
  expect(await countInput.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none");
  for (const palette of ["classic", "summer", "simple"]) {
    await page.evaluate(name => {
      document.documentElement.dataset.zPalette = name;
      document.documentElement.dataset.zTheme = name === "simple" ? "light" : "dark";
    }, palette);
    await countInput.locator("xpath=ancestor::section[1]").screenshot({ path: join(process.env.TEMP!, `zijing-lottery-${palette}.png`) });
  }
  await page.getByLabel("中签人数").fill("1");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "抽签并公布结果" }).click();
  await expect(page.getByRole("status").filter({ hasText: "抽签完成" })).toBeVisible();
  const lotteryDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出抽签结果 CSV" }).click();
  const downloaded = await lotteryDownload;
  expect(downloaded.suggestedFilename()).toMatch(/抽签结果-\d+\.csv$/);
  const lotteryRows = readCSV(await readFile((await downloaded.path())!, "utf8")).records;
  expect(lotteryRows).toHaveLength(2);
  expect(lotteryRows.map(row => row["抽签结果"]).sort()).toEqual(["已中签", "未中签"].sort());
  expect(lotteryRows.map(row => row["Q1. 合成报名内容"]).sort()).toEqual(["合成答案0", "合成答案1"]);
  await page.getByRole("button", { name: "统计与导出", exact: true }).click();
  const resultsPanel = page.locator(".questionnaire-results");
  await expect(resultsPanel.getByRole("heading", { name: "导出筛选答卷", exact: true })).toBeVisible();
  for (const name of ["成员明细：每条信息组记录一行", "按题明细：每个答案一行", "答卷表：每份答卷一行（推荐）"]) {
    const option = resultsPanel.getByRole("radio", { name, exact: true });
    await expect(option).toBeVisible();
    await option.check();
  }
  await expect(resultsPanel.getByRole("button", { name: "导出筛选答卷 CSV" })).toBeVisible();
  await resultsPanel.screenshot({ path: join(process.env.TEMP!, "zijing-export-panel.png") });
  const filteredDownload = page.waitForEvent("download");
  await resultsPanel.getByRole("button", { name: "导出筛选答卷 CSV" }).click();
  const filteredRows = readCSV(await readFile((await (await filteredDownload).path())!, "utf8")).records;
  expect(filteredRows.map(row => row["抽签结果"]).sort()).toEqual(["已中签", "未中签"].sort());
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await resultsPanel.screenshot({ path: join(process.env.TEMP!, "zijing-export-mobile.png") });
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
