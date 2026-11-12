import { test, expect } from "@playwright/test";

/**
 * V2 "紫荆赛场" guest smoke checks (public routes only, synthetic environment).
 * Written for the V2 rebuild; not yet executed at the time of writing.
 */
const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(", ")})`;
const guestRoutes = [
  "/",
  "/events",
  "/announcements",
  "/about",
  "/contact",
  "/privacy",
  "/join",
  "/join/staff",
  "/login",
  "/register",
];

test("guest home renders the V2 stage with one h1 and is not redirected", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "紫荆主场" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "加入紫荆" }).first(),
  ).toBeVisible();
  const html = await response!.text();
  expect(html).not.toContain("data:image");
});

test("first focus is the skip link and main is reachable", async ({ page }) => {
  await page.goto("/events");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到正文" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`no horizontal overflow on guest routes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of guestRoutes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBeLessThan(400);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `${route} @ ${width}`).toBeLessThanOrEqual(0);
    }
  });
}

test("mobile shows the five-item bottom tab bar for guests; desktop shows the top navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "主要栏目" });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("link")).toHaveText([
    "主场",
    "日程",
    "公告",
    "加入",
    "登录",
  ]);
  await page.setViewportSize({ width: 1280, height: 860 });
  await expect(tabs).toBeHidden();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
});

test("explicit night theme persists across navigation and is server-rendered", async ({
  page,
}) => {
  await page.goto("/events");
  await page.getByRole("combobox", { name: "界面风格" }).selectOption("summer");
  await expect(page.locator("html")).toHaveAttribute("data-z-theme", "summer");
  const response = await page.goto("/announcements");
  expect(await response!.text()).toContain('data-z-theme="summer"');
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    rgb("#14242f"),
  );
});

test("reduced motion: campus content remains visible and automatic motion stops", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("[data-running]").first()).toHaveAttribute(
      "data-running",
      "false",
    );
  } finally {
    await context.close();
  }
});

test("可报名 is a server-filtered calendar view (signupOpen=1) with its own tab and checkbox state", async ({
  page,
}) => {
  const response = await page.goto("/events?signupOpen=1");
  expect(response?.status()).toBe(200);
  const tabs = page.getByRole("navigation", { name: "日程范围" });
  await expect(
    tabs.getByRole("link", { name: "可报名", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    tabs.getByRole("link", { name: "全部", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("checkbox", { name: "只看报名开放" }),
  ).toBeChecked();
  await expect(page.locator("main h1")).toHaveCount(1);
});

test("member-only V2 areas send guests to login with a safe return path", async ({
  page,
}) => {
  for (const route of ["/community", "/teams", "/account", "/news"]) {
    await page.goto(route);
    const url = new URL(page.url());
    expect(url.pathname, route).toBe("/login");
    expect(url.searchParams.get("returnTo"), route).toBe(route);
  }
});
