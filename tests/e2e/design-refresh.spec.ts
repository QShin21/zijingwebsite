import { memberTest } from "./member-layout-fixture";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 390, 768, 1440]) {
  memberTest(`member and community reading layouts at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/login",
      "/register",
      "/account/reset",
      "/community",
      "/community/demo-game",
      "/about",
      "/privacy",
      "/announcements",
      "/missing-design-page",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toHaveCount(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        route,
      ).toBeLessThanOrEqual(width);
      if (
        [390, 1440].includes(width) &&
        ["/login", "/register", "/account/reset", "/community"].includes(route)
      ) {
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(result.violations, route).toEqual([]);
      }
    }
  });
}

test("registration guidance, server feedback and unique mobile community navigation", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "验证并注册", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("邮箱前缀")).toHaveCount(1);
  await expect(page.locator('input[name="name"]')).toHaveAttribute(
    "aria-describedby",
    "nickname-hint",
  );
  await page.goto("/login?reset=1");
  await expect(page.getByRole("status")).toContainText("密码已更新");
  await page
    .getByLabel("昵称或邮箱")
    .fill("design-invalid@example.invalid");
  await page
    .getByLabel("密码", { exact: true })
    .fill("invalid-design-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("错误");
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/community");
  await page.locator(".mobile-nav summary").click();
  const link = page.locator('.mobile-nav a[href="/community"]');
  await expect(page).toHaveURL(/\/login\?/);
  await expect(link).toHaveCount(0);
  await expect(page.locator(".mobile-nav nav a")).toHaveCount(3);
});
