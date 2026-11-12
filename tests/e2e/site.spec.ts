import { browserTestOrigin } from "./browser-test-origin";
import "dotenv/config";
import { test, expect } from "@playwright/test";
import type { Payload } from "payload";
import { getBrowserSuitePayload } from "./payload-fixture";
import config from "../../src/payload.config";
import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import sharp from "sharp";
let p: Payload,
  adminID: number,
  eventID: number,
  deniedPreviewEventID: number,
  teamID: number,
  leaderID: number;
const suffix = Date.now(),
  email = `browser-${suffix}@example.invalid`,
  password = randomBytes(24).toString("hex"),
  slug = `browser-event-${suffix}`;
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development")
    throw new Error("Development only");
  p = await getBrowserSuitePayload("site", config);
  adminID = (
    await p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: { email, password, roles: ["president"], name: "测试社长" },
    })
  ).id;
});
test.beforeEach(async ({ page }, info) => {
  if (/三类招新|首页配置|布局/.test(info.title)) {
    expect(
      (
        await page.request.post("/api/users/login", {
          data: { email, password },
        })
      ).ok(),
    ).toBe(true);
  }
});

test.afterAll(async () => {
  if (deniedPreviewEventID)
    await p.delete({
      collection: "events",
      id: deniedPreviewEventID,
      overrideAccess: true,
    });
  if (eventID)
    await p.delete({ collection: "events", id: eventID, overrideAccess: true });
  if (leaderID)
    await p.delete({ collection: "users", id: leaderID, overrideAccess: true });
  if (teamID)
    await p.delete({ collection: "teams", id: teamID, overrideAccess: true });
  if (adminID)
    await p.delete({ collection: "users", id: adminID, overrideAccess: true });
  await p.destroy();
});
test("后台登录、创建活动草稿、预览、发布、访客查看、撤下", async ({
  page,
  browser,
}) => {
  await page.goto("/admin/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto("/admin/collections/events/create");
  await page.locator("#field-title").fill("浏览器验收 · 活动发布全链路");
  await page.locator("#field-slug").fill(slug);
  await page.getByRole("button", { name: /保存草稿|Save Draft/ }).click();
  await expect(page).toHaveURL(/\/events\/\d+/);
  eventID = Number(new URL(page.url()).pathname.split("/").pop());
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.goto(`/events/${slug}`);
  await expect(
    publicPage.getByRole("heading", { name: "暂时找不到这一页" }),
  ).toBeVisible();
  const guestPreview = await visitor.request.get(`/preview/events/${eventID}`);
  expect(guestPreview.status()).toBe(404);
  expect(await guestPreview.text()).not.toContain(
    "浏览器验收 · 活动发布全链路",
  );
  await page.goto(`/preview/events/${eventID}`);
  const preview = page.getByRole("complementary", { name: "预览状态" });
  await expect(preview).toContainText("草稿预览 · 仅当前授权人员可见");
  await expect(preview).toContainText("不代表已发布");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "浏览器验收 · 活动发布全链路",
  );
  // V2 draft banner: the edit link is a ghost button without the trailing arrow glyph.
  const edit = preview.getByRole("link", {
    name: "返回内容编辑",
    exact: true,
  });
  await expect(edit).toHaveAttribute(
    "href",
    `/admin/collections/events/${eventID}`,
  );
  await edit.click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/collections/events/${eventID}$`),
  );
  await page
    .getByRole("button", { name: /^发布修改$|^Publish Changes$/ })
    .click();
  await expect
    .poll(async () => {
      const r = await page.request.get("/api/events/" + eventID);
      return (await r.json())._status;
    })
    .toBe("published");
  await publicPage.goto(`/events/${slug}`);
  await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText(
    "浏览器验收 · 活动发布全链路",
  );
  await publicPage.goto("/events");
  await expect(
    publicPage.getByRole("link", {
      name: "浏览器验收 · 活动发布全链路",
      exact: true,
    }),
  ).toBeVisible();
  // V2: "/" is a guest page (主场), so guests are no longer redirected to /events.
  await publicPage.goto("/");
  await expect(publicPage).toHaveURL(/\/$/);
  await expect(
    publicPage
      .getByRole("region", { name: "接下来的赛程", exact: true })
      .getByRole("link", { name: "浏览器验收 · 活动发布全链路", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page
      .getByRole("region", { name: "接下来的赛程", exact: true })
      .getByRole("link", { name: "浏览器验收 · 活动发布全链路", exact: true }),
  ).toBeVisible();
  const renamed = await page.request.patch(`/api/events/${eventID}`, {
    headers: { Origin: browserTestOrigin },
    data: { slug: `${slug}-renamed` },
  });
  expect(renamed.ok()).toBeTruthy();
  const redirect = await page.request.get(`/events/${slug}`, {
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toBe(`/events/${slug}-renamed`);
  await publicPage.goto(`/events/${slug}-renamed`);
  await expect(publicPage.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${browserTestOrigin}/events/${slug}-renamed`,
  );
  const withdrawn = await page.request.patch(`/api/events/${eventID}`, {
    headers: { Origin: browserTestOrigin },
    data: { _status: "draft" },
  });
  expect(withdrawn.ok()).toBeTruthy();
  await publicPage.goto(`/events/${slug}`);
  await expect(
    publicPage.getByRole("heading", { name: "暂时找不到这一页" }),
  ).toBeVisible();
  await visitor.close();
});
test("404 HTTP 状态与预览环境不收录", async ({ request }) => {
  expect(
    (await request.get("/missing-page-for-test", { maxRedirects: 0 })).status(),
  ).toBe(307);
  expect((await request.get("/events/missing-event-for-test")).status()).toBe(
    404,
  );
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /",
  );
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "<loc>",
  );
});
test("公开 API、预览、首次注册与分部越权拒绝", async ({ request }) => {
  expect(
    (
      await request.post("/api/users/first-register", {
        data: {
          email: "intruder@example.invalid",
          password: "not-a-real-password",
        },
      })
    ).ok(),
  ).toBe(false);
  const user = await p.findByID({
    collection: "users",
    id: adminID,
    overrideAccess: true,
  });
  teamID = (
    await p.create({
      collection: "teams",
      overrideAccess: false,
      user,
      data: {
        title: "其他分部",
        slug: `browser-team-${suffix}`,
        _status: "published",
        demo: true,
      },
    })
  ).id;
  leaderID = (
    await p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        email: `leader-${suffix}@example.invalid`,
        password,
        roles: ["communityAdmin"],

        name: "测试社群管理员",
        teams: [],
      },
    })
  ).id;
  const login = await request.post("/api/users/login", {
    data: { email: `leader-${suffix}@example.invalid`, password },
  });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).token;
  const headers = {
    Authorization: `JWT ${token}`,
    Origin: browserTestOrigin,
  };
  const res = await request.patch(`/api/teams/${teamID}`, {
    headers,
    data: { title: "越权修改" },
  });
  expect(res.ok()).toBe(false);
  const users = await request.get("/api/users", { headers });
  const json = await users.json();
  expect(json.docs).toHaveLength(1);
  expect(
    json.docs.every((u: { id: number }) => u.id === leaderID),
  ).toBeTruthy();
  const previewTitle = "浏览器验收 · 权限隔离预览草稿";
  deniedPreviewEventID = (
    await p.create({
      collection: "events",
      overrideAccess: false,
      user,
      data: {
        title: previewTitle,
        slug: `browser-private-preview-${suffix}`,
        _status: "draft",
        demo: true,
      },
    })
  ).id;
  const preview = await request.get(`/preview/events/${deniedPreviewEventID}`, {
    headers,
  });
  expect(preview.status()).toBe(404);
  expect(await preview.text()).not.toContain(previewTitle);
});
test("公开页可访问性、CSP 与实际加载指标", async ({ page }) => {
  const records = [];
  for (const route of ["/events", "/announcements", "/login", "/privacy"]) {
    const response = await page.goto(route);
    expect(response?.headers()["content-security-policy"]).toContain(
      "object-src 'none'",
    );
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    const timing = await page.evaluate(() => {
      const n = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      return {
        responseMs: n.responseEnd - n.startTime,
        domReadyMs: n.domContentLoadedEventEnd - n.startTime,
      };
    });
    records.push({ route, violations: result.violations.length, ...timing });
  }
  await fs.writeFile(
    "docs/evidence/browser-metrics.json",
    JSON.stringify(
      { environment: "local Chromium; no network throttling", records },
      null,
      2,
    ),
  );
});
test("三类招新、历史批次和所有公开栏目", async ({ page }) => {
  for (const kind of ["members", "teams", "staff"]) {
    await page.goto(`/join/${kind}`);
    // V2 routes: /join/members|teams list legacy batches in 往期招新记录; /join/staff keeps 历史招新资料 cards.
    const archive = page.getByRole("region", {
      name: kind === "staff" ? "历史招新资料" : "往期招新记录",
      exact: true,
    });
    await expect(archive).toBeVisible();
    const title = `演示 · ${kind} 招新批次`;
    const entry =
      kind === "staff"
        ? archive.getByRole("heading", { name: title, exact: true }).getByRole("link", { name: title, exact: true })
        : archive.getByRole("link", { name: title, exact: true });
    await entry.click();
    await expect(page).toHaveURL(new RegExp(`/recruitment/demo-${kind}$`));
    // Legacy batch detail keeps the closed state and never offers external sign-up.
    await expect(page.getByRole("heading", { name: "已关闭" })).toBeVisible();
    await expect(page.getByRole("link", { name: /前往外部报名/ })).toHaveCount(
      0,
    );
  }
  for (const route of [
    "/about",
    "/events",
    "/teams",
    "/honors",
    "/news",
    "/gallery",
    "/contact",
    "/privacy",
    "/teams/demo-team",
    "/gallery/demo-album",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toBeVisible();
  }
});
test("首页配置即时更新、回顾关联、相册分页和长中文标题", async ({ page }) => {
  const user = await p.findByID({
    collection: "users",
    id: adminID,
    overrideAccess: true,
  });
  const settings = await p.findGlobal({ slug: "site", overrideAccess: true });
  const title =
    "演示 · 超长中文活动标题用于验证手机排版与真实内容维护流程".repeat(3);
  const event = await p.create({
    collection: "events",
    overrideAccess: false,
    user,
    data: {
      title,
      slug: `layout-${suffix}`,
      _status: "published",
      demo: true,
      registrationURL: "https://example.com/form",
    },
  });
  const news = await p.create({
    collection: "news",
    overrideAccess: false,
    user,
    data: {
      title: "演示 · 关联回顾",
      slug: `review-${suffix}`,
      event: event.id,
      type: "回顾",
      _status: "published",
      demo: true,
    },
  });
  const bytes = await sharp({
    create: { width: 48, height: 48, channels: 3, background: "#592a91" },
  })
    .png()
    .toBuffer();
  const image = await p.create({
    collection: "media",
    overrideAccess: false,
    user,
    data: {
      alt: "演示 · 相册分页测试图",
      credit: "程序生成测试图",
      demo: true,
    },
    file: {
      data: bytes,
      size: bytes.length,
      name: `album-${suffix}.png`,
      mimetype: "image/png",
    },
  });
  const album = await p.create({
    collection: "albums",
    overrideAccess: false,
    user,
    data: {
      title: "演示 · 分页相册",
      slug: `album-${suffix}`,
      event: event.id,
      _status: "published",
      demo: true,
      photos: Array.from({ length: 13 }, (_, i) => ({
        image: image.id,
        caption: `测试图 ${i + 1}`,
      })),
    },
  });
  try {
    await p.updateGlobal({
      slug: "site",
      overrideAccess: false,
      user,
      data: {
        heroTitle: "演示 · 首页后台配置验证",
        modules: [
          { kind: "events", enabled: true },
          { kind: "events", enabled: true },
          { kind: "join", enabled: true },
          { kind: "news", enabled: false },
        ],
        featuredEvents: [event.id],
      },
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "演示 · 首页后台配置验证",
    );
    // V2 主场: CMS hero title and featured events drive the stage; blocks follow site.homeSections.
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
    const upcoming = page.getByRole("region", { name: "接下来的赛程", exact: true });
    await expect(upcoming).toHaveCount(1);
    const blocks = () =>
      page.locator("main [data-section]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-section")));
    // The legacy modules field no longer changes the V2 page.
    await p.updateGlobal({
      slug: "site",
      overrideAccess: false,
      user,
      data: { modules: [{ kind: "events", enabled: false }, { kind: "join", enabled: false }] },
    });
    await page.reload();
    await expect(upcoming).toHaveCount(1);
    // Real V2 config: order, titles and visibility; omitted blocks append in default order.
    await p.updateGlobal({
      slug: "site",
      overrideAccess: false,
      user,
      data: {
        homeSections: [
          { kind: "notices", enabled: true, title: "演示 · 首页公告区" },
          { kind: "upcoming", enabled: true, title: "演示 · 首页赛程区" },
          { kind: "highlights", enabled: false },
        ],
      },
    });
    await page.reload();
    expect((await blocks()).slice(0, 2)).toEqual(["notices", "upcoming"]);
    expect(await blocks()).not.toContain("highlights");
    await expect(page.getByRole("region", { name: "演示 · 首页公告区", exact: true })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "演示 · 首页赛程区", exact: true })).toHaveCount(1);
    await expect(upcoming).toHaveCount(0);
    await p.updateGlobal({
      slug: "site",
      overrideAccess: false,
      user,
      data: {
        homeSections: (["upcoming", "open", "notices", "promoted", "communities", "highlights", "about"] as const).map((kind) => ({
          kind,
          enabled: false,
        })),
      },
    });
    await page.reload();
    // Every configurable block hidden; the stage (CMS hero) is not a configurable block.
    expect(await blocks()).toEqual([]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "演示 · 首页后台配置验证",
    );
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/events/${event.slug}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "演示 · 关联回顾" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "前往外部报名", exact: true }),
    ).toHaveAttribute("href", "https://example.com/form");
    await p.update({
      collection: "events",
      id: event.id,
      overrideAccess: false,
      user,
      data: { registrationClosed: true },
    });
    await page.reload();
    await expect(
      page.getByRole("link", { name: "前往外部报名", exact: true }),
    ).toHaveCount(0);
    await page.goto(`/news/${news.slug}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await page.goto(`/gallery/${album.slug}`);
    await expect(page.locator("main img")).toHaveCount(12);
    await page.getByRole("link", { name: "下一页" }).click();
    await expect(page.locator("main img")).toHaveCount(1);
    await expect(page.getByText("测试图 13", { exact: true })).toBeVisible();
  } finally {
    await p.updateGlobal({
      slug: "site",
      overrideAccess: false,
      user,
      data: {
        heroTitle: settings.heroTitle ?? null,
        modules: settings.modules,
        homeSections: settings.homeSections,
        featuredEvents: settings.featuredEvents,
      },
    });
    await p.delete({
      collection: "albums",
      id: album.id,
      overrideAccess: true,
    });
    await p.delete({ collection: "news", id: news.id, overrideAccess: true });
    await p.delete({
      collection: "events",
      id: event.id,
      overrideAccess: true,
    });
    await p.delete({ collection: "media", id: image.id, overrideAccess: true });
  }
});
for (const width of [360, 390, 768, 1440])
  test(`布局 ${width}px、导航、键盘焦点与截图`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "跳到正文" })).toBeFocused();
    if (width < 1024) {
      // V2: fixed bottom tabs below 1024px replace the old disclosure menu.
      await page
        .getByRole("navigation", { name: "主要栏目" })
        .getByRole("link", { name: "日程", exact: true })
        .click();
      await expect(page).toHaveURL(/events/);
    } else {
      await page
        .getByRole("navigation", { name: "主导航" })
        .getByRole("link", { name: "日程", exact: true })
        .click();
      await expect(page).toHaveURL(/events/);
    }
    for (const route of [
      "/events",
      "/join",
      "/teams/demo-team",
      "/recruitment/demo-staff",
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/");
    await page.screenshot({
      path: `docs/evidence/home-${width}.png`,
      fullPage: true,
    });
  });
