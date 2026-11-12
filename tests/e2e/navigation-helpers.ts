import type { Page } from "@playwright/test";

/**
 * V2 mobile navigation: a server-rendered bottom tab bar (no hamburger menu).
 * Guests: 主场·日程·公告·加入·登录; members: 主场·日程·社群·代表队·我的.
 */
export function mobileTabs(page: Page) {
  return page.getByRole("navigation", { name: "主要栏目" });
}

/** Retained name for older specs: resolves to the V2 bottom tab bar. */
export const mobileMenu = mobileTabs;
