import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Existing site.spec.ts keeps the real CMS publishing, permission, registration,
// redirect and album regressions. These tests cover the redesigned interface.
test("desktop navigation exposes the current section", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/events");
  const nav = page.getByRole("navigation", { name: "主导航", exact: true });
  await expect(nav.locator('a[href="/events"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "面包屑" })).toBeVisible();
});

test("mobile menu closes on navigation, Escape and outside interaction", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.locator(".mobile-nav");
  const trigger = menu.locator("summary");
  // Native details works before hydration; Escape/outside dismissal is a client enhancement.
  await expect(menu).toHaveAttribute("data-enhanced", "true");
  await trigger.click();
  await expect(menu).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open");
  await expect(trigger).toBeFocused();
  await trigger.click();
  // Touch the page gutter, outside the expanded menu and its content.
  await page.mouse.click(5, 150);
  await expect(menu).not.toHaveAttribute("open");
  await trigger.click();
  await menu.locator('a[href="/events"]').click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(menu).not.toHaveAttribute("open");
  await trigger.click();
  await expect(menu.locator('a[href="/events"]')).toHaveAttribute("aria-current", "page");
});

test("mobile navigation remains operable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto("http://localhost:3000/");
    await page.locator(".mobile-nav summary").click();
    await page.locator('.mobile-nav a[href="/events"]').click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.locator("main h1")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("reduced motion and essential interface accessibility", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const art = page.locator(".arena-monogram");
  if (await art.count()) await expect(art).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到正文" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

for (const width of [320, 390, 768, 1080, 1440, 1920]) {
  test(`redesign responsive routes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/events", "/teams", "/honors", "/join", "/join/staff", "/news", "/gallery", "/contact"]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toHaveCount(1);
      const metrics = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(metrics.document, `${route} overflows at ${width}px`).toBeLessThanOrEqual(metrics.viewport);
    }
  });
}
