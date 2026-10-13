import { test, expect } from "@playwright/test";
import { memberTest } from "./member-layout-fixture";
import sharp from "sharp";
import tokens from "../../src/design/tokens.json" with { type: "json" };

const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(", ")})`;

test("system dark without a preference renders light HTML, metadata and native navigation before JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    colorScheme: "dark",
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  try {
    const page = await context.newPage();
    const response = await page.goto("/events");
    expect(response?.status()).toBe(200);
    expect(await response!.text()).toContain('data-z-theme="light"');
    await expect(page.locator("html")).toHaveAttribute("data-z-theme", "light");
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      "content",
      "light",
    );
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      rgb(tokens.light.paper),
    );
    await expect(page.locator(".z-header")).toHaveCSS(
      "background-color",
      rgb(tokens.light["header-bg"]),
    );
    await page.getByLabel("打开导航", { exact: true }).click();
    await page
      .getByRole("navigation", { name: "移动导航" })
      .getByRole("link", { name: "通知", exact: true })
      .click();
    await expect(page).toHaveURL(/\/announcements$/);
    await expect(page.locator("html")).toHaveAttribute("data-z-theme", "light");
  } finally {
    await context.close();
  }
});

test("an invalid preference falls back to light even on a dark system", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL, colorScheme: "dark" });
  try {
    await context.addCookies([
      { name: "zijing_theme", value: "invalid-theme", url: baseURL! },
    ]);
    const page = await context.newPage();
    await page.goto("/events");
    await expect(page.locator("html")).toHaveAttribute("data-z-theme", "light");
    await expect(
      page.getByRole("button", { name: "切换到深色主题", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  } finally {
    await context.close();
  }
});

memberTest(
  "explicit themes preserve form input and consent, persist across routes and reopening, without hydration errors",
  async ({ page, context, browser, baseURL }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/community/apply");
    await expect(page.locator(".z-mobile-menu")).toHaveAttribute(
      "data-enhanced",
      "true",
    );
    await expect(page.locator("html")).toHaveAttribute("data-z-theme", "light");
    await page.getByLabel("姓名", { exact: true }).fill("合成主题申请人");
    await page.getByLabel("手机号", { exact: true }).fill("00000000000");
    const buffer = await sharp({
      create: { width: 160, height: 160, channels: 3, background: "#6839ae" },
    })
      .png()
      .toBuffer();
    const file = page.getByLabel("微信名片二维码", { exact: true });
    await file.setInputFiles({
      name: "synthetic-theme.png",
      mimeType: "image/png",
      buffer,
    });
    await page.getByLabel("新游戏名称", { exact: false }).fill("合成主题社群");
    await page
      .getByLabel("申请说明", { exact: false })
      .fill("这是隔离的合成主题测试资料，不会向真实成员提交或发送通知。");
    const consent = page.getByRole("checkbox", {
      name: "我同意展示我的微信名片作为进群联系方式",
      exact: true,
    });
    await expect(consent).not.toBeChecked();
    await page.getByRole("button", { name: "提交审核", exact: true }).click();
    const alert = page.locator("form.application-form").getByRole("alert");
    await expect(alert).toHaveText("由于入社流程规定，必须展示管理联系方式");
    await expect(consent).toBeFocused();
    await page
      .getByRole("button", { name: "切换到深色主题", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-z-theme", "dark");
    await expect(page.getByLabel("姓名", { exact: true })).toHaveValue(
      "合成主题申请人",
    );
    await expect(consent).not.toBeChecked();
    await expect(alert).toHaveText("由于入社流程规定，必须展示管理联系方式");
    expect(
      await file.evaluate(
        (input) => (input as HTMLInputElement).files?.[0].name,
      ),
    ).toBe("synthetic-theme.png");
    const preference = (await context.cookies()).find(
      (cookie) => cookie.name === "zijing_theme",
    );
    expect(preference?.value).toBe("dark");
    expect(preference?.sameSite).toBe("Lax");
    expect(preference?.path).toBe("/");
    await page.goto("/account");
    await expect(page.locator("html")).toHaveAttribute("data-z-theme", "dark");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "切换到浅色主题", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const reopened = await browser.newContext({
      baseURL,
      colorScheme: "light",
      javaScriptEnabled: false,
    });
    try {
      await reopened.addCookies([preference!]);
      const nextPage = await reopened.newPage();
      const response = await nextPage.goto("/events");
      expect(await response!.text()).toContain('data-z-theme="dark"');
      await expect(nextPage.locator("body")).toHaveCSS(
        "background-color",
        rgb(tokens.dark.paper),
      );
    } finally {
      await reopened.close();
    }
    await expect(page.locator(".z-mobile-menu")).toHaveAttribute(
      "data-enhanced",
      "true",
    );
    await page
      .getByRole("button", { name: "切换到浅色主题", exact: true })
      .click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-z-theme", "light");
    expect(
      (await context.cookies()).find((cookie) => cookie.name === "zijing_theme")
        ?.value,
    ).toBe("light");
    expect(errors).toEqual([]);
  },
);
