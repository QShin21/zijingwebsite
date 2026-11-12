import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { memberTest } from "./member-layout-fixture";
import { mobileTabs } from "./navigation-helpers";

const consentLabel = "我同意展示我的微信名片作为进群联系方式";
const consentError = "由于入社流程规定，必须展示管理联系方式";
const memberRoutes = [
  "/",
  "/community",
  "/community/demo-game",
  "/community/demo-game/join",
  "/teams",
  "/teams/recruitment",
  "/teams/apply",
  "/teams/honors",
  "/join/staff",
  "/activities",
  "/announcements",
  "/events",
  "/gallery",
  "/account",
  "/privacy",
];

for (const width of [320, 390, 768, 1024, 1440]) {
  memberTest(
    `rebuild member routes preserve one title and fit ${width}px`,
    async ({ page }, info) => {
      memberTest.setTimeout(180000);
      await page.setViewportSize({ width, height: 960 });
      const metrics: { route: string; width: number; scrollWidth: number }[] =
        [];
      for (const route of memberRoutes) {
        const response = await page.goto(route);
        expect(response?.status(), route).toBe(200);
        await expect(page.locator("main h1"), route).toHaveCount(1);
        await expect(page.locator("main h1"), route).toBeVisible();
        const scrollWidth = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        expect(
          scrollWidth,
          `${route} overflows ${width}px`,
        ).toBeLessThanOrEqual(width);
        metrics.push({ route, width, scrollWidth });
      }
      await info.attach("responsive-route-metrics", {
        body: JSON.stringify({ synthetic: true, metrics }, null, 2),
        contentType: "application/json",
      });
    },
  );
}

test("rebuild uses classic SSR on a dark system before hydration and keeps native mobile navigation", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    colorScheme: "dark",
    viewport: { width: 390, height: 900 },
  });
  try {
    const page = await context.newPage();
    const response = await page.goto("/events");
    expect(response?.status()).toBe(200);
    expect(await response!.text()).toContain('data-z-theme="classic"');
    await expect(page.locator("html")).toHaveAttribute(
      "data-z-theme",
      "classic",
    );
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      "content",
      "dark",
    );
    const background = await page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).backgroundColor);
    const components = background.match(/[\d.]+/g)!.map(Number);
    expect(
      Math.max(...components.slice(0, 3)),
      "the classic surface remains dark",
    ).toBeLessThan(80);
    // V2 has no hamburger: the server-rendered bottom tabs work without JavaScript.
    await mobileTabs(page)
      .getByRole("link", { name: "公告", exact: true })
      .click();
    await expect(page).toHaveURL(/\/announcements$/);
    await expect(page.locator("main h1")).toHaveCount(1);
  } finally {
    await context.close();
  }
});

memberTest(
  "rebuild theme control preserves text, files, consent and exact error; dark preference reaches fresh SSR",
  async ({ page, context, browser, baseURL }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 960 });
    await page.goto("/community/apply");
    const form = page.locator("form.application-form");
    await expect(form).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("html")).toHaveAttribute(
      "data-z-theme",
      "classic",
    );
    await page
      .getByRole("textbox", { name: "姓名", exact: true })
      .fill("合成重构申请人");
    await page
      .getByRole("textbox", { name: "手机号", exact: true })
      .fill("00000000000");
    await page.getByLabel("新游戏名称", { exact: false }).fill("合成主题社群");
    const reason = page.getByLabel("申请说明", { exact: false });
    const text =
      "仅用于隔离合成重构验收，保留长文本、文件和本人明确选择。".repeat(20);
    await reason.fill(text);
    const file = page.getByLabel(/^微信名片二维码（(?:必填|更换时上传)）$/);
    await file.setInputFiles({
      name: "synthetic-rebuild-card.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: { width: 80, height: 80, channels: 3, background: "#6a398a" },
      })
        .png()
        .toBuffer(),
    });
    const consent = page.getByRole("checkbox", {
      name: consentLabel,
      exact: true,
    });
    await expect(consent).not.toBeChecked();
    await page.getByRole("button", { name: "提交审核", exact: true }).click();
    await expect(form.getByRole("alert")).toHaveText(consentError);
    await expect(consent).toBeFocused();
    await page
      .getByRole("combobox", { name: "界面风格" })
      .selectOption("summer");
    await expect(page.locator("html")).toHaveAttribute(
      "data-z-theme",
      "summer",
    );
    await expect(
      page.getByRole("textbox", { name: "姓名", exact: true }),
    ).toHaveValue("合成重构申请人");
    await expect(reason).toHaveValue(text);
    await expect(consent).not.toBeChecked();
    await expect(form.getByRole("alert")).toHaveText(consentError);
    expect(
      await file.evaluate(
        (input) => (input as HTMLInputElement).files?.[0]?.name,
      ),
    ).toBe("synthetic-rebuild-card.png");
    const cookie = (await context.cookies()).find(
      (item) => item.name === "zijing_theme",
    );
    expect(cookie).toMatchObject({
      value: "summer",
      path: "/",
      sameSite: "Lax",
    });
    const reopened = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      colorScheme: "light",
    });
    try {
      await reopened.addCookies([cookie!]);
      const nextPage = await reopened.newPage();
      const response = await nextPage.goto("/events");
      expect(await response!.text()).toContain('data-z-theme="summer"');
      await expect(nextPage.locator("html")).toHaveAttribute(
        "data-z-theme",
        "summer",
      );
      await expect(
        nextPage.locator('meta[name="color-scheme"]'),
      ).toHaveAttribute("content", "dark");
    } finally {
      await reopened.close();
    }
    await consent.check();
    await page
      .getByRole("combobox", { name: "界面风格" })
      .selectOption("winter");
    await expect(consent).toBeChecked();
    await expect(reason).toHaveValue(text);
    expect(
      await file.evaluate(
        (input) => (input as HTMLInputElement).files?.[0]?.name,
      ),
    ).toBe("synthetic-rebuild-card.png");
    await page.goto("/account");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute(
      "data-z-theme",
      "winter",
    );
    expect(errors).toEqual([]);
  },
);

memberTest(
  "rebuild keyboard entry, reduced motion and key pages remain accessible in both themes",
  async ({ page, baseURL }) => {
    memberTest.setTimeout(180000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 960 });
    for (const theme of ["classic", "summer", "winter", "simple"] as const) {
      await page
        .context()
        .addCookies([{ name: "zijing_theme", value: theme, url: baseURL! }]);
      for (const route of [
        "/",
        "/community",
        "/community/apply",
        "/teams",
        "/account",
      ]) {
        await page.goto(route);
        await page.keyboard.press("Tab");
        await expect(
          page.getByRole("link", { name: "跳到正文", exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.locator("#main")).toBeFocused();
        expect(
          await page.evaluate(
            () => getComputedStyle(document.documentElement).scrollBehavior,
          ),
        ).toBe("auto");
        const violations = (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations;
        expect(violations, `${theme} ${route}`).toEqual([]);
      }
    }
  },
);

memberTest(
  "rebuild missing content offers a usable return path and expired sessions cannot read member areas",
  async ({ page, context }) => {
    const response = await page.goto("/events/rebuild-synthetic-missing-event");
    expect(response?.status()).toBe(404);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator('main a[href^="/"]').first()).toBeVisible();
    await context.clearCookies({ name: "payload-token" });
    await page.goto("/community/apply");
    await expect(page).toHaveURL(/\/login\?/);
    await expect(page.locator("form.application-form")).toHaveCount(0);
    expect(
      (await page.request.get("/community/demo-game/contacts")).status(),
    ).toBe(401);
  },
);
