import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getPayload, type Payload } from "payload";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import config from "../../src/payload.config";
import { profileFixture, saveLoadedProfile } from "../team-profiles-fixture";
import { defaultTeamForm, saveTeamRecruitment } from "../../src/lib/team-core";
import { teamHonorService } from "../../src/lib/team-honor-service";

let p: Payload, f: Awaited<ReturnType<typeof profileFixture>>;
let batchID: number, honorID: number;
const extraGames: number[] = [];
const evidence = process.env.CLUB_EVIDENCE_DIR || ".data/club-visual-evidence";
const metrics: {
  route: string;
  width: number;
  scrollWidth: number;
  h1: number;
}[] = [];

test.beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  if (
    process.env.APP_ENV !== "development" ||
    !["localhost", "127.0.0.1"].includes(db.hostname)
  ) {
    throw new Error("Dedicated synthetic club QA database only");
  }
  test.skip(
    !db.pathname.endsWith("_clubqa_synthetic"),
    "Cloud visual checks require a dedicated *_clubqa_synthetic database; regular seeded CI runs leave these fixtures untouched.",
  );
  p = await getPayload({ config, key: "club-visual-browser" });
  f = await profileFixture(p);
  await mkdir(evidence, { recursive: true });
  for (const [index, title] of [
    "合成 · 星际对战",
    "合成 · 策略卡牌",
    "合成 · 竞速世界",
  ].entries()) {
    const game = await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title,
        slug: `club-visual-${f.suffix}-${index}`,
        _status: "published",
        demo: true,
        summary:
          "合成视觉验收资料：寻找游戏伙伴，了解交流安排与精彩记录。禁止生产导入。",
      },
    });
    extraGames.push(game.id);
  }
  await p.update({
    collection: "games",
    id: f.game.id,
    overrideAccess: true,
    context: { system: true },
    data: {
      title: "合成 · 战术竞技",
      summary:
        "合成验收社群。与伙伴分享游戏经历，联系管理员，在微信中人工加入社群。",
    },
  });
  await p.update({
    collection: "teams",
    id: f.first.id,
    user: f.admin,
    overrideAccess: false,
    context: { teamCoreWrite: true },
    data: {
      title: "合成 · 战术竞技代表队",
      summary: "合成代表队档案，仅用于 cloud browser 视觉验收。",
      body: {
        root: {
          type: "root",
          version: 1,
          direction: "ltr",
          format: "",
          indent: 0,
          children: [
            {
              type: "paragraph",
              version: 1,
              direction: "ltr",
              format: "",
              indent: 0,
              children: [
                {
                  type: "text",
                  version: 1,
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text: "合成训练与选拔说明。公开资料经本人授权，申请和审核沿用现有流程。禁止生产导入。",
                },
              ],
            },
          ],
        },
      },
    },
  });
  const batch = (
    await p.find({
      collection: "team-recruitments",
      overrideAccess: true,
      depth: 0,
      where: { team: { equals: f.first.id } },
    })
  ).docs[0];
  const saved = await saveTeamRecruitment(p, f.admin, {
    id: batch.id,
    revision: batch.updatedAt,
    teamID: f.first.id,
    title: "合成 · 秋季代表队选拔",
    status: "open",
    form: {
      ...defaultTeamForm,
      intro:
        "合成招新说明：填写游戏、位置、训练时间与联系渠道，提交后由社群管理员人工选拔。",
      end: new Date(Date.now() + 86400_000).toISOString(),
    },
  });
  batchID = saved.id;
  const image = await sharp({
    create: { width: 80, height: 80, channels: 3, background: "#a688db" },
  })
    .png()
    .toBuffer();
  await saveLoadedProfile(p, f.member, f.first.id, null, {
    displayName: "合成队员 · Nova",
    position: "指挥 / 战术协作",
    biography: "合成简介，仅供视觉验收。\n一起复盘，一起进步。",
    avatar: "data:image/png;base64," + image.toString("base64"),
    visible: true,
  });
  const submitted = await teamHonorService.change(p, f.member, "submit", {
    input: {
      team: f.first.id,
      title: "合成 · 秋季团体优胜",
      competition: "合成校际联赛",
      placing: "团体优胜",
      date: "2026-10-01",
      description: "合成赛事和成绩，用于真实网页档案与权限回归，禁止生产导入。",
      images: [
        {
          source: "data:image/png;base64," + image.toString("base64"),
          caption: "合成证据图",
        },
      ],
    },
  });
  const approved = await teamHonorService.change(p, f.admin, "approve", {
    id: submitted.id,
    revision: submitted.revision,
    submittedVersion: submitted.submittedVersion,
  });
  honorID = approved.id;
});

test.afterAll(async () => {
  if (metrics.length)
    await writeFile(
      path.join(evidence, "responsive-metrics.json"),
      JSON.stringify(
        {
          environment: "cloud browser",
          source: "real Next.js + Chromium + isolated synthetic PostgreSQL",
          metrics,
        },
        null,
        2,
      ),
    );
  if (!p) return;
  if (honorID)
    await p.delete({
      collection: "team-honor-records",
      overrideAccess: true,
      id: honorID,
    });
  for (const id of extraGames)
    await p.delete({ collection: "games", overrideAccess: true, id });
  if (f) await f.cleanup();
  await p.destroy();
});

async function login(page: Page, admin = false) {
  const user = admin ? f.admin : f.member;
  expect(
    (
      await page.request.post("/api/users/login", {
        data: { email: user.email, password: f.password },
      })
    ).ok(),
  ).toBe(true);
}
async function screenshot(page: Page, name: string) {
  await page.evaluate(() => {
    document.querySelector("[data-cloud-evidence]")?.remove();
    const label = document.createElement("div");
    label.dataset.cloudEvidence = "true";
    label.textContent = "cloud browser · 合成验收资料 · 非线上站点";
    label.style.cssText =
      "padding:10px 14px;background:#222738;color:#eef0f7;font:12px/1.6 Arial,sans-serif;border:1px solid #4b5164;border-radius:6px;margin-top:16px";
    document.querySelector("main")?.prepend(label);
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: path.join(evidence, name + ".png"),
    fullPage: true,
    animations: "disabled",
  });
}

test("负责页面在四个视口无溢出、标题清晰并通过正文无障碍扫描", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await login(page, true);
  const routes = [
    ["community-directory", "/community"],
    ["community-detail", `/community/${f.game.slug}`],
    ["community-join", `/community/${f.game.slug}/join`],
    ["community-apply", "/community/apply"],
    ["team-establishment", "/teams/apply"],
    ["team-recruitment", "/teams/recruitment"],
    ["team-selection", `/teams/recruitment/${batchID}`],
    ["team-directory", "/teams"],
    ["team-detail", `/teams/${f.first.slug}`],
    ["honor-directory", "/teams/honors"],
    ["honor-record", `/teams/honors/${honorID}`],
    [
      "honor-archive",
      `/community/${f.game.slug}/showcase/team-honors/${f.first.id}`,
    ],
  ];
  const desktopCaptures = new Set([
    "community-directory",
    "community-detail",
    "community-apply",
    "team-recruitment",
    "team-directory",
    "team-detail",
    "honor-directory",
  ]);
  const mobileCaptures = new Set([
    "community-directory",
    "team-establishment",
    "team-selection",
    "honor-archive",
  ]);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    for (const [name, route] of routes) {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);
      if (name === "team-detail")
        await expect(page.locator("#team-members [role=status]")).toHaveCount(
          0,
        );
      const sizes = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        h1: document.querySelectorAll("h1").length,
      }));
      metrics.push({ route, width, ...sizes });
      expect(sizes.scrollWidth, `${route} at ${width}`).toBeLessThanOrEqual(
        width,
      );
      if (width === 1440 || width === 390) {
        const accessibility = await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(accessibility.violations, `${route} at ${width}`).toEqual([]);
      }
      if (
        (width === 1440 && desktopCaptures.has(name)) ||
        (width === 390 && mobileCaptures.has(name))
      )
        await screenshot(page, `${name}-${width}`);
    }
  }
  for (const route of ["/events", "/activities", "/join/members"]) {
    await page.goto(route);
    expect(await page.locator('main [class*="ClubPages_page"]').count()).toBe(
      0,
    );
  }
});

test("微信名片未同意仍阻止提交，提示精确且键盘焦点可见", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 960 });
  await page.goto("/community/apply");
  const consent = page.getByRole("checkbox", {
    name: "我同意展示我的微信名片作为进群联系方式",
    exact: true,
  });
  await expect(consent).not.toBeChecked();
  const realName = page.getByLabel("姓名", { exact: true });
  await realName.fill("合成测试申请人");
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await expect(page.locator("form.application-form [role=alert]")).toHaveText(
    "由于入社流程规定，必须展示管理联系方式",
  );
  await expect(consent).toBeFocused();
  await expect(realName).toHaveValue("合成测试申请人");
  expect(
    (
      await p.find({
        collection: "community-applications",
        overrideAccess: true,
        where: { applicant: { equals: f.member.id } },
      })
    ).totalDocs,
  ).toBe(0);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(consent).toBeFocused();
  expect(
    await consent.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe("solid");
  await screenshot(page, "community-consent-error-390");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/community");
  const card = page.locator('main a[href^="/community/"]').first();
  await card.hover();
  expect(
    await card.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
});

test("队员简介预览、返回、取消与空态沿用原流程", async ({ page }) => {
  await login(page);
  await page.goto(`/teams/profiles/${f.first.id}`);
  const panel = page.locator("#team-members");
  const nickname = panel.getByLabel("公开昵称", { exact: true });
  await nickname.fill("合成队员 · Nova Preview");
  await panel.getByRole("button", { name: "预览简介", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "展示预览" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 960 });
  await screenshot(page, "team-profile-preview-1440");
  await panel.getByRole("button", { name: "返回修改", exact: true }).click();
  await expect(nickname).toBeFocused();
  await page.setViewportSize({ width: 390, height: 960 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await screenshot(page, "team-profile-editor-390");
  await panel.getByRole("button", { name: "取消修改", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "编辑我的队内简介", exact: true }),
  ).toBeFocused();
  await expect(
    panel.getByRole("heading", { name: "合成队员 · Nova", exact: true }),
  ).toBeVisible();
  await page.goto(`/teams/${f.second.slug}`);
  await expect(
    page.getByText("暂无选择展示的队员简介。", { exact: true }),
  ).toBeVisible();
  await page.goto(`/teams?game=${2147483647}`);
  await expect(
    page.getByText("没有符合当前筛选条件的内容，请调整条件或清除筛选。", {
      exact: true,
    }),
  ).toBeVisible();
  await screenshot(page, "team-filter-empty-390");
  await page.goto(`/teams/honors?team=${f.second.id}`);
  await expect(
    page.getByText("暂无可展示的队伍荣誉档案，批准后的记录会自动汇总。", {
      exact: true,
    }),
  ).toBeVisible();
  const syntheticGames = [f.game.id, ...extraGames];
  try {
    for (const id of syntheticGames)
      await p.update({
        collection: "games",
        id,
        overrideAccess: true,
        context: { system: true },
        data: { _status: "draft" },
      });
    await page.goto("/community");
    await expect(
      page.getByRole("heading", { name: "还没有公开社群", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await screenshot(page, "community-directory-empty-390");
  } finally {
    for (const id of syntheticGames)
      await p.update({
        collection: "games",
        id,
        overrideAccess: true,
        context: { system: true },
        data: { _status: "published" },
      });
  }
});

test("简介实际请求的加载、网络失败和重试状态可用", async ({ page }) => {
  await login(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/team-profiles/${f.first.id}`, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`/teams/profiles/${f.first.id}`);
  await expect(
    page.getByText("正在加载队员简介…", { exact: true }),
  ).toBeVisible();
  release();
  await expect(page.getByLabel("公开昵称", { exact: true })).toBeVisible();
  await page.unroute(`**/api/team-profiles/${f.first.id}`);
  await page.route(`**/api/team-profiles/${f.first.id}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "合成网络中断，请重试" }),
    }),
  );
  await page.reload();
  await expect(page.locator("#team-members [role=alert]")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重新加载已保存资料" }),
  ).toBeVisible();
  await page.unroute(`**/api/team-profiles/${f.first.id}`);
  await page.getByRole("button", { name: "重新加载已保存资料" }).click();
  await expect(page.getByLabel("公开昵称", { exact: true })).toBeVisible();
});
