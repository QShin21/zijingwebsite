import { memberTest } from "./member-layout-fixture";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mobileTabs } from "./navigation-helpers";

// Existing site.spec.ts keeps the real CMS publishing, permission, registration,
// redirect and album regressions. These tests cover the V2 "紫荆赛场" shell.
test("desktop top navigation exposes the current section", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/events");
  const nav = page.getByRole("navigation", { name: "主导航", exact: true });
  await expect(nav.locator('a[href="/events"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(mobileTabs(page)).toBeHidden();
});

test("mobile bottom tabs navigate and mark the current destination", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/announcements");
  const tabs = mobileTabs(page);
  await expect(tabs).toBeVisible();
  await expect(tabs.locator('a[href="/announcements"]')).toHaveAttribute("aria-current", "page");
  await tabs.locator('a[href="/events"]').click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(tabs.locator('a[href="/events"]')).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeHidden();
});

test("mobile navigation remains operable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await mobileTabs(page).locator('a[href="/events"]').click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.locator("main h1")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("reduced motion and essential interface accessibility", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // Decorative stage canvas stays hidden from assistive technology; CSS sweep stops.
  await expect(page.locator("canvas").first()).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到正文" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

for (const width of [320, 390, 768, 1080, 1440, 1920]) {
  memberTest(`V2 responsive routes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/events", "/teams", "/honors", "/join", "/join/staff", "/news", "/gallery", "/contact", "/account", "/teams/recruitment"]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toHaveCount(1);
      const metrics = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(metrics.document, `${route} overflows at ${width}px`).toBeLessThanOrEqual(metrics.viewport);
    }
  });
}
