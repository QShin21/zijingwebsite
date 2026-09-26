import { expect, test } from "@playwright/test";

test("注册两步支持学生、校友后缀和手动完整邮箱", async ({ page }) => {
  await page.goto("/register");
  for (const form of await page.locator("form.member-form").all()) {
    const suffix = form.getByLabel("邮箱后缀");
    const local = form.getByLabel("邮箱 @ 前的部分");
    const submitted = form.locator('input[name="email"]');
    await expect(suffix).toHaveValue("mails.tsinghua.edu.cn");
    await local.fill("student");
    await expect(submitted).toHaveValue("student@mails.tsinghua.edu.cn");
    await suffix.selectOption("tsinghua.org.cn");
    await expect(submitted).toHaveValue("student@tsinghua.org.cn");
    await local.fill("student@example.com");
    expect(
      await local.evaluate((el: HTMLInputElement) => el.checkValidity()),
    ).toBe(false);
    await local.fill("student");
    await suffix.selectOption("manual");
    const full = form.getByLabel("完整清华邮箱");
    await expect(full).toHaveValue("student@tsinghua.org.cn");
    await full.fill("teacher@tsinghua.edu.cn");
    await expect(submitted).toHaveValue("teacher@tsinghua.edu.cn");
    await suffix.selectOption("mails.tsinghua.edu.cn");
    await expect(local).toHaveValue("student");
    await suffix.selectOption("manual");
    await expect(full).toHaveValue("teacher@tsinghua.edu.cn");
    await full.fill("");
    expect(
      await full.evaluate((el: HTMLInputElement) => el.checkValidity()),
    ).toBe(false);
  }
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
