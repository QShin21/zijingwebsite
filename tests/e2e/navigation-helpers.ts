import type { Page } from "@playwright/test";

/** The native details menu remains available before client enhancement. */
export function mobileMenu(page: Page) {
  return page.locator("details").filter({
    has: page.getByLabel("打开导航", { exact: true }),
  });
}
