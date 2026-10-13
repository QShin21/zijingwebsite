import { readFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

type SyntheticUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  password: string;
};
const qaRoot = process.env.REBUILD_QA_ROOT || "";
test.skip(
  !qaRoot.includes("/.data/rebuild-qa-20261013"),
  "Requires the isolated synthetic rebuild runner",
);
async function users() {
  const fixture = JSON.parse(
    await readFile(path.join(qaRoot, "synthetic-browser-users.json"), "utf8"),
  ) as {
    syntheticOnly: boolean;
    notifications: boolean;
    users: SyntheticUser[];
  };
  if (!fixture.syntheticOnly || fixture.notifications)
    throw new Error("Synthetic-only fixture required");
  return fixture.users;
}
async function signIn(page: Page, role: string, destination = "/account") {
  const actor = (await users()).find((user) => user.role === role)!;
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel("昵称或邮箱", { exact: true }).fill(actor.name);
  await page.getByLabel("密码", { exact: true }).fill(actor.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"),
  );
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
async function accessible(page: Page) {
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(report.violations).toEqual([]);
}

test("登录错误就地聚焦，密码显隐和主题切换保留输入", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login?returnTo=%2Fteams%3Fgame%3D1");
  const identifier = page.getByLabel("昵称或邮箱", { exact: true });
  const password = page.getByLabel("密码", { exact: true });
  await identifier.fill("合成不存在账号-20261013");
  await password.fill("Synthetic-Invalid-Password-20261013!");
  await page.getByRole("button", { name: "显示密码", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "隐藏密码", exact: true }).click();
  await page.getByRole("button", { name: "切换到深色主题" }).click();
  await expect(identifier).toHaveValue("合成不存在账号-20261013");
  await expect(password).toHaveValue("Synthetic-Invalid-Password-20261013!");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  const error = page.locator("main").getByRole("alert");
  await expect(error).toContainText("昵称、邮箱或密码错误");
  await expect(error).toBeFocused();
  await expect(identifier).toHaveValue("合成不存在账号-20261013");
  await expect(password).toHaveValue("Synthetic-Invalid-Password-20261013!");
  await noOverflow(page);
  await accessible(page);
  await page.screenshot({
    path: testInfo.outputPath("login-mobile-dark.png"),
    fullPage: true,
  });
});

test("注册与恢复校验保留输入，不发送真实邮件", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  await page.getByLabel("邮箱前缀").fill("synthetic-not-sent-20261013");
  await page.getByLabel(/^昵称/).fill("合成注册校验20261013");
  await page
    .getByLabel("密码", { exact: true })
    .fill("Synthetic-Password-A-20261013!");
  await page
    .getByLabel("确认密码", { exact: true })
    .fill("Synthetic-Password-B-20261013!");
  await page.getByRole("button", { name: "验证并注册", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "两次输入需一致",
  );
  await expect(page.locator("main").getByRole("alert")).toBeFocused();
  await expect(page.getByLabel(/^昵称/)).toHaveValue("合成注册校验20261013");
  await expect(page.getByLabel("密码", { exact: true })).toHaveValue(
    "Synthetic-Password-A-20261013!",
  );
  await noOverflow(page);
  await accessible(page);
  await page.screenshot({
    path: testInfo.outputPath("register-mobile.png"),
    fullPage: true,
  });
  await page.goto("/account/reset");
  await page
    .getByLabel("注册邮箱", { exact: true })
    .fill("synthetic-no-email@example.invalid");
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "请使用清华师生或校友邮箱",
  );
  await expect(page.getByLabel("注册邮箱", { exact: true })).toHaveValue(
    "synthetic-no-email@example.invalid",
  );
  await page.getByLabel("六位验证码").fill("123456");
  await page
    .getByLabel("新密码", { exact: true })
    .fill("Synthetic-New-A-20261013!");
  await page
    .getByLabel("确认新密码", { exact: true })
    .fill("Synthetic-New-B-20261013!");
  await page.getByRole("button", { name: "更新密码", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "请核对注册邮箱与新密码",
  );
  await expect(page.getByLabel("新密码", { exact: true })).toHaveValue(
    "Synthetic-New-A-20261013!",
  );
  await noOverflow(page);
  await accessible(page);
});

test("本人事务与权限入口、深链和退出完整导航", async ({ page }, testInfo) => {
  await signIn(page, "member");
  await expect(
    page.getByRole("heading", { name: "我的紫荆", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "我的活动报名", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "我的进群记录", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "管理工作台", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "查看全部申请", exact: false }).click();
  await expect(page).toHaveURL(/\/account\?view=history$/);
  await expect(
    page.getByRole("heading", { name: "申请记录", exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({
    path: testInfo.outputPath("account-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("account-mobile.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    (window as Window & { authSentinel?: string }).authSentinel =
      "must-reset-on-logout";
  });
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/events$/);
  expect(
    await page.evaluate(
      () => (window as Window & { authSentinel?: string }).authSentinel,
    ),
  ).toBeUndefined();
  await page.goto("/news?mode=latest");
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/news?mode=latest",
  );
  await signIn(page, "member", "/news?mode=latest");
});

test("长文、旧荣誉链接与管理角色仍走原授权", async ({ page }, testInfo) => {
  await signIn(page, "president");
  await expect(
    page.getByRole("heading", { name: "管理工作台", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "骨干招新管理", exact: false }),
  ).toBeVisible();
  for (const route of [
    "/about",
    "/contact",
    "/privacy",
    "/news",
    "/recruitment",
    "/join",
    "/join/members",
    "/join/teams",
    "/teams",
  ]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main h1")).toBeVisible();
    await noOverflow(page);
  }
  await page.goto("/honors?view=mine&page=2");
  await expect(page).toHaveURL(/\/teams\/honors\?view=mine&page=2$/);
  await page.goto("/privacy");
  await accessible(page);
  await page.screenshot({
    path: testInfo.outputPath("privacy-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("privacy-mobile.png"),
    fullPage: true,
  });
});
