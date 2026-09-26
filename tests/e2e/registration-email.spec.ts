import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("邮箱只填一次，前后缀同栏，后缀可选择也可直接输入", async ({ page }) => {
  await page.goto("/register");
  const prefix = page.getByLabel("邮箱前缀");
  const suffix = page.getByRole("combobox", { name: "邮箱后缀" });
  await expect(prefix).toHaveCount(1);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await prefix.fill("student");
  await suffix.click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.getByRole("option", { name: /校友邮箱/ }).click();
  await expect(suffix).toHaveValue("tsinghua.org.cn");
  await suffix.fill("tsinghua.edu.cn");
  await suffix.press("Tab");
  await expect(suffix).toHaveValue("tsinghua.edu.cn");
  await prefix.fill("student@example.com");
  expect(
    await prefix.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(false);
  await prefix.fill("student");
  await suffix.focus();
  await suffix.press("ArrowDown");
  await suffix.press("Enter");
  await expect(suffix).toHaveValue("mails.tsinghua.edu.cn");
  await suffix.click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const left = await prefix.boundingBox(),
      right = await suffix.boundingBox();
    expect(Math.abs(left!.y - right!.y)).toBeLessThan(2);
  }
});
