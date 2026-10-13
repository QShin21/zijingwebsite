import { memberTest } from "./member-layout-fixture";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [320, 390, 768, 1440]) {
  memberTest(
    `member and community reading layouts at ${width}px`,
    async ({ page }) => {
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
          ["/login", "/register", "/account/reset", "/community"].includes(
            route,
          )
        ) {
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          expect(result.violations, route).toEqual([]);
        }
        if (width < 1050 && route === "/community") {
          await page.locator(".z-mobile-menu summary").click();
          const navigation = page.getByRole("navigation", { name: "移动导航" });
          await expect(
            navigation.getByRole("link", { name: "游戏社群", exact: true }),
          ).toHaveAttribute("href", "/community");
          const targets = await navigation
            .getByRole("link")
            .evaluateAll((links) =>
              links.map((link) => link.getAttribute("href")),
            );
          expect(new Set(targets).size).toBe(targets.length);
        }
      }
    },
  );
}

test("registration guidance, server feedback and unique mobile community navigation", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(
    page.getByRole("button", { name: "验证并注册", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("邮箱前缀")).toHaveCount(1);
  await expect(page.locator('input[name="name"]')).toHaveAttribute(
    "aria-describedby",
    "nickname-hint",
  );
  await page.goto("/login?reset=1");
  await expect(page.locator("main").getByRole("status")).toContainText(
    "密码已更新",
  );
  await page.getByLabel("昵称或邮箱").fill("design-invalid@example.invalid");
  await page
    .getByLabel("密码", { exact: true })
    .fill("invalid-design-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "昵称、邮箱或密码错误",
  );
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/community");
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/community");
  await page.locator(".z-mobile-menu summary").click();
  const navigation = page.getByRole("navigation", { name: "移动导航" });
  const link = navigation.locator('a[href="/community"]');
  await expect(link).toHaveCount(0);
  expect(
    await navigation
      .getByRole("link")
      .evaluateAll((links) => links.map((item) => item.getAttribute("href"))),
  ).toEqual(["/events", "/announcements", "/register", "/login"]);
});
