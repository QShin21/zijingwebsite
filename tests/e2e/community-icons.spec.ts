import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";

let p: Payload, admin: User, member: User, image: Buffer, game: number;
const suffix = randomBytes(5).toString("hex"),
  password = randomBytes(24).toString("hex"),
  slug = "icons-browser-" + suffix;
const artifacts = ".data/icon-evidence";
test.beforeAll(async () => {
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Local synthetic database only");
  p = await getPayload({ config, key: "community-icons-browser" });
  await mkdir(artifacts, { recursive: true });
  for (const [index, title] of [
    "王者荣耀",
    "CS2",
    "星露谷物语",
    "蛋仔派对",
    "英雄联盟",
  ].entries()) {
    const record = await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title,
        summary: "图标验收 " + suffix,
        slug: index ? slug + "-" + index : slug,
        _status: "published",
        demo: true,
        sort: -10000 + index,
      },
    });
    if (!index) game = record.id;
  }
  const user = (
    label: string,
    communityOffices: User["communityOffices"] = [],
  ) =>
    p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        name: label + suffix,
        email: label + suffix + "@example.invalid",
        password,
        roles: ["member"],
        communityOffices,
      },
    });
  admin = await user("icon-ui-admin", [{ game, status: "active" }]);
  member = await user("icon-ui-member");
  const left = await sharp({
    create: { width: 240, height: 240, channels: 4, background: "#884dce" },
  })
    .png()
    .toBuffer();
  const right = await sharp({
    create: { width: 240, height: 240, channels: 4, background: "#eac15c" },
  })
    .png()
    .toBuffer();
  image = await sharp({
    create: { width: 480, height: 240, channels: 4, background: "#0000" },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: 240, top: 0 },
    ])
    .png()
    .toBuffer();
});
test.afterAll(async () => {
  if (p) await p.destroy();
});
async function login(page: Page, actor: User, target: string) {
  await page.goto("/login?returnTo=" + encodeURIComponent(target));
  await page.locator('[name="identifier"]').fill(actor.name);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(target.replace(/[?]/g, "\\?")));
}
test("default logos, real upload, keyboard/drag crop, re-edit, responsive themes and revoked access", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, admin, "/community?q=" + suffix);
  const card = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "王者荣耀", exact: true }),
    })
    .first();
  await expect(card.getByRole("link", { name: "修改社群图标" })).toBeVisible();
  for (const title of [
    "王者荣耀",
    "CS2",
    "星露谷物语",
    "蛋仔派对",
    "英雄联盟",
  ]) {
    const logo = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
      .first()
      .locator("img");
    await expect(logo).toHaveCount(1);
    await logo.scrollIntoViewIfNeeded();
    await expect
      .poll(
        () => logo.evaluate((el) => (el as HTMLImageElement).naturalWidth),
        { timeout: 30000 },
      )
      .toBeGreaterThan(0);
    await logo.evaluate((el) => (el as HTMLImageElement).decode());
  }
  await page.mouse.move(0, 0);
  await page.locator('div[class*="communities"]').screenshot({ path: artifacts + "/cards-detail.png" });
  await page.screenshot({
    path: artifacts + "/cards-desktop.png",
    fullPage: true,
  });
  await card.getByRole("link", { name: "修改社群图标" }).click();
  await expect(
    page.getByRole("heading", { name: "修改社群图标", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("选择游戏图标")
    .setInputFiles({
      name: "synthetic-icon.png",
      mimeType: "image/png",
      buffer: image,
    });
  const zoom = page.getByRole("slider", { name: "放大", exact: true });
  await expect(zoom).toBeEnabled();
  await zoom.focus();
  await page.keyboard.press("ArrowRight");
  await expect(zoom).toHaveValue("1.01");
  const crop = page.getByLabel("图标裁切预览"),
    box = await crop.boundingBox();
  if (!box) throw new Error("Crop not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  expect(
    Number(await page.getByRole("slider", { name: "水平位置" }).inputValue()),
  ).toBeLessThan(50);
  await page.getByRole("button", { name: "保存社群图标", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "社群图标已保存" }),
  ).toBeVisible();
  const served = await page.request.get("/api/game-icons/" + slug);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/webp");
  expect(await sharp(await served.body()).metadata()).toMatchObject({
    width: 512,
    height: 512,
  });
  await page.reload();
  await expect(zoom).toBeEnabled();
  await expect(zoom).toHaveValue("1.01");
  await page.getByRole("button", { name: "重置裁切" }).click();
  await page.getByRole("button", { name: "保存社群图标", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "社群图标已保存" }),
  ).toBeVisible();

  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.zTheme = theme;
    }, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
        theme + width,
      ).toBeLessThanOrEqual(0);
      await expect(
        page.getByRole("button", { name: "保存社群图标", exact: true }),
      ).toBeVisible();
      if (width === 390 || width === 1440)
        await page.evaluate(() => { window.scrollTo(0, 0); (document.activeElement as HTMLElement | null)?.blur(); });
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: artifacts + "/editor-" + theme + "-" + width + ".png",
          fullPage: true,
        });
    }
    const result = await new AxeBuilder({ page })
      .include('[aria-label="社群图标编辑"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await p.update({
    collection: "users",
    id: admin.id,
    overrideAccess: true,
    context: { system: true },
    data: {
      communityOffices: admin.communityOffices!.map((office) => ({
        ...office,
        status: "revoked" as const,
      })),
    },
  });
  await zoom.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "保存社群图标", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "无权修改此社群图标" }),
  ).toBeVisible();
  await page.context().clearCookies();
  await login(page, member, "/community");
  await expect(page.getByRole("link", { name: "修改社群图标" })).toHaveCount(0);
  const denied = await page.goto("/community/" + slug + "/appearance");
  expect(denied?.status()).toBe(404);
});
