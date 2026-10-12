import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
import config from "../../src/payload.config";
import {
  profileFixture,
  saveLoadedProfile as saveTeamProfile,
} from "../team-profiles-fixture";
import { emptyTeamProfile } from "../../src/lib/team-profiles-model";

let p: Payload, f: Awaited<ReturnType<typeof profileFixture>>;
test.beforeAll(async () => {
  p = await getPayload({ config, key: "team-profiles-browser" });
});
test.beforeEach(async () => {
  f = await profileFixture(p);
});
test.afterEach(async () => {
  if (f) await f.cleanup();
});
test.afterAll(async () => {
  if (p) await p.destroy();
});
const panel = (page: Page) => page.locator("#team-members");
async function login(page: Page, user = f.member) {
  const response = await page.request.post("/api/users/login", {
    data: { email: user.email, password: f.password },
  });
  expect(response.ok()).toBe(true);
  await page.context().setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
}
async function editor(page: Page, team = f.first) {
  await page.goto(`/teams/profiles/${team.id}`);
  await expect(
    panel(page).getByLabel("公开昵称", { exact: true }),
  ).toBeVisible();
}
async function fill(page: Page, name = "合成网页队员") {
  await panel(page).getByLabel("公开昵称", { exact: true }).fill(name);
  await panel(page)
    .getByLabel("位置 / 游戏角色（可选）", { exact: true })
    .fill("中路");
  await panel(page)
    .getByLabel("简短介绍（可选）", { exact: true })
    .fill("合成简介验收资料，禁止生产导入。\n期待与队友共同训练。");
}
async function save(page: Page, visible = true) {
  await panel(page)
    .getByLabel("在本代表队页面展示我的简介", { exact: true })
    .setChecked(visible);
  await panel(page)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "确认保存简介", exact: true })
    .click();
  await expect(
    panel(page)
      .locator("[role=status]")
      .filter({
        hasText: visible ? "简介已保存并选择展示" : "简介已保存并隐藏",
      }),
  ).toBeVisible();
}

test("访客沿用登录边界；未入队者无编辑入口且伪造上下文被拒", async ({
  page,
  browser,
}) => {
  const guest = await browser.newContext();
  expect(
    (await guest.request.get(`/api/team-profiles/${f.first.id}`)).status(),
  ).toBe(401);
  const guestPage = await guest.newPage();
  await guestPage.goto(`/teams/${f.first.slug}`);
  await expect(guestPage).toHaveURL(/\/login/);
  await guest.close();
  await login(page, f.viewer);
  await page.goto(`/teams/${f.first.slug}`);
  await expect(
    panel(page).getByText("暂无选择展示的队员简介。", { exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("button", { name: "编辑我的队内简介" }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.put(`/api/team-profiles/${f.first.id}`, {
        data: {
          revision: null,
          profile: { ...emptyTeamProfile(), displayName: "越权简介" },
        },
      })
    ).status(),
  ).toBe(403);
  const raw = await page.request.get(
    `/api/team-member-profiles?context=${encodeURIComponent(JSON.stringify({ teamProfileOwn: f.membership.id, teamProfilePublic: [{ id: f.membership.id }] }))}`,
  );
  expect([401, 403]).toContain(raw.status());
});

test("本人上传头像、预览、单次保存、修改/取消与隐藏；桌面/窄屏可用", async ({
  page,
}) => {
  await login(page);
  await page.goto(`/teams/${f.first.slug}`);
  await panel(page)
    .getByRole("button", { name: "编辑我的队内简介", exact: true })
    .click();
  await fill(page);
  const picture = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "purple" },
  })
    .png()
    .toBuffer();
  await panel(page).getByLabel("头像（可选）", { exact: true }).setInputFiles({
    name: "synthetic-avatar.png",
    mimeType: "image/png",
    buffer: picture,
  });
  await expect(
    panel(page).getByRole("button", { name: "移除头像", exact: true }),
  ).toBeVisible();
  await panel(page)
    .getByLabel("在本代表队页面展示我的简介", { exact: true })
    .check();
  await panel(page)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await expect(
    panel(page).getByRole("heading", { name: "展示预览", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width === 390)
      await panel(page).screenshot({
        path: ".data/team-profiles-preview-390.png",
      });
  }
  expect(
    (await new AxeBuilder({ page }).include("#team-members").analyze())
      .violations,
  ).toEqual([]);
  await panel(page).screenshot({
    path: ".data/team-profiles-preview-1440.png",
  });
  let writes = 0;
  await page.route(`**/api/team-profiles/${f.first.id}`, async (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    await route.continue();
  });
  const saveButton = panel(page).getByRole("button", {
    name: "确认保存简介",
    exact: true,
  });
  await saveButton.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect(
    panel(page).getByRole("button", { name: "正在保存…", exact: true }),
  ).toBeDisabled();
  await expect(
    panel(page)
      .locator("[role=status]")
      .filter({ hasText: "简介已保存并选择展示" }),
  ).toBeVisible();
  expect(writes).toBe(1);
  await page.unroute(`**/api/team-profiles/${f.first.id}`);
  const response = await page.request.get(`/api/team-profiles/${f.first.id}`),
    view = await response.json();
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(view.profiles[0].avatar).toMatch(/^data:image\/webp;base64,/);
  expect(JSON.stringify(view)).not.toMatch(
    /PRIVATE_PROFILE_TEST_ANSWER|"membership"|realName|student|reviewNote/,
  );
  await panel(page)
    .getByLabel("公开昵称", { exact: true })
    .fill("应取消的修改");
  await panel(page)
    .getByRole("button", { name: "取消修改", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "编辑我的队内简介", exact: true })
    .click();
  await expect(panel(page).getByLabel("公开昵称", { exact: true })).toHaveValue(
    "合成网页队员",
  );
  await save(page, false);
  await expect(
    panel(page).getByText("暂无选择展示的队员简介。", { exact: true }),
  ).toBeVisible();
  await panel(page)
    .getByRole("button", { name: "移除头像", exact: true })
    .click();
  await save(page, false);
  expect(
    (await (await page.request.get(`/api/team-profiles/${f.first.id}`)).json())
      .own.profile.avatar,
  ).toBeNull();
});

test("加载失败可重试，保存失败保留输入与预览并能实际重试成功", async ({
  page,
}) => {
  await login(page);
  const endpoint = `**/api/team-profiles/${f.first.id}`;
  await page.route(endpoint, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "合成加载失败，请重试" }),
    }),
  );
  await page.goto(`/teams/profiles/${f.first.id}`);
  await expect(panel(page).getByRole("alert")).toContainText("加载失败");
  await page.unroute(endpoint);
  await panel(page)
    .getByRole("button", { name: "重新加载已保存资料", exact: true })
    .click();
  await fill(page, "失败后保留昵称");
  await page.route(endpoint, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "合成保存失败，请重试" }),
        })
      : route.continue(),
  );
  await panel(page)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "确认保存简介", exact: true })
    .click();
  await expect(panel(page).getByRole("alert")).toContainText("保存失败");
  await expect(panel(page).getByLabel("公开昵称", { exact: true })).toHaveValue(
    "失败后保留昵称",
  );
  await expect(
    panel(page).getByRole("button", { name: "确认保存简介", exact: true }),
  ).toBeEnabled();
  await panel(page)
    .getByRole("button", { name: "返回修改", exact: true })
    .click();
  await page.unroute(endpoint);
  await save(page);
  await expect(
    panel(page).getByRole("heading", { name: "失败后保留昵称", exact: true }),
  ).toBeVisible();
});

test("简介预览返回和取消后焦点回到可继续操作的控件，不保存草稿", async ({ page }) => {
  await login(page); await editor(page); await fill(page, "合成焦点未保存草稿");
  await panel(page).getByRole("button", { name: "预览简介", exact: true }).click();
  await panel(page).getByRole("button", { name: "返回修改", exact: true }).click();
  await expect(panel(page).getByLabel("公开昵称", { exact: true })).toBeFocused();
  await panel(page).getByRole("button", { name: "取消修改", exact: true }).click();
  const entry = panel(page).getByRole("button", { name: "编辑我的队内简介", exact: true });
  await expect(entry).toBeFocused(); await entry.press("Enter");
  await expect(panel(page).getByLabel("公开昵称", { exact: true })).toBeFocused();
  await expect(panel(page).getByLabel("公开昵称", { exact: true })).toHaveValue("");
  expect((await (await page.request.get(`/api/team-profiles/${f.first.id}`)).json()).own.profile).toBeNull();
});

test("撤销资格后旧页面拒绝提交，旧会话读取名单也立即隐藏", async ({ page }) => {
  await saveTeamProfile(p, f.member, f.first.id, null, {
    ...emptyTeamProfile(),
    displayName: "撤销资格合成队员",
    visible: true,
  });
  await login(page);
  await editor(page);
  await fill(page, "旧页面修改");
  await f.changeMembership({
    status: "revoked",
    revokedAt: new Date().toISOString(),
  });
  await panel(page)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "确认保存简介", exact: true })
    .click();
  await expect(panel(page).getByRole("alert")).toContainText("入队资格已失效");
  await expect(
    panel(page).getByLabel("公开昵称", { exact: true }),
  ).toBeDisabled();
  expect(
    (await (await page.request.get(`/api/team-profiles/${f.first.id}`)).json())
      .profiles,
  ).toEqual([]);
  expect(
    (
      await p.find({
        collection: "team-member-profiles",
        overrideAccess: true,
        where: { membership: { equals: f.membership.id } },
      })
    ).docs[0].displayName,
  ).toBe("撤销资格合成队员");
});

test("改队伍重置表单，未加入新队不能写，新队入队后简介独立", async ({
  page,
}) => {
  await saveTeamProfile(p, f.member, f.first.id, null, {
    ...emptyTeamProfile(),
    displayName: "第一队原有昵称",
    visible: true,
  });
  await login(page);
  await editor(page);
  await fill(page, "第一队未保存草稿");
  await page.goto(`/teams/profiles/${f.second.id}`);
  await expect(
    panel(page).getByText("通过入队审核且仍在队后，可以填写自己的队内简介。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(panel(page).getByLabel("公开昵称", { exact: true })).toHaveCount(
    0,
  );
  await f.enroll(f.second.id);
  await page.reload();
  await expect(panel(page).getByLabel("公开昵称", { exact: true })).toHaveValue(
    "",
  );
  await fill(page, "第二队新昵称");
  await save(page);
  expect(
    (await (await page.request.get(`/api/team-profiles/${f.first.id}`)).json())
      .profiles[0].displayName,
  ).toBe("第一队原有昵称");
  expect(
    (await (await page.request.get(`/api/team-profiles/${f.second.id}`)).json())
      .profiles[0].displayName,
  ).toBe("第二队新昵称");
  await page.getByRole("link", { name: "返回代表队页面", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/teams/${f.second.slug}#team-members$`),
  );
});

test("两个页面旧版本冲突保留输入；真实接口拒绝 XSS、敏感字段、跨站保存", async ({
  page,
}) => {
  await saveTeamProfile(p, f.member, f.first.id, null, {
    ...emptyTeamProfile(),
    displayName: "双页面初始昵称",
    visible: true,
  });
  await login(page);
  await editor(page);
  const second = await page.context().newPage();
  await editor(second);
  await fill(page, "已保存的新昵称");
  await fill(second, "冲突时保留的昵称");
  await save(page);
  await panel(second)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await panel(second)
    .getByRole("button", { name: "确认保存简介", exact: true })
    .click();
  await expect(panel(second).getByRole("alert")).toContainText("其他页面更新");
  await expect(
    panel(second).getByLabel("公开昵称", { exact: true }),
  ).toHaveValue("冲突时保留的昵称");
  const endpoint = `/api/team-profiles/${f.first.id}`,
    profile = { ...emptyTeamProfile(), displayName: "合成请求" };
  for (const invalid of [
    { ...profile, biography: "<img onerror=alert(1)>" },
    { ...profile, avatar: "https://untrusted.example/private" },
    { ...profile, realName: "不能公开的资料" },
  ])
    expect(
      (
        await page.request.put(endpoint, {
          data: { revision: 2, profile: invalid },
        })
      ).status(),
    ).toBe(400);
  const crossSite = await page.request.put(endpoint, {
    headers: { Origin: "https://untrusted.example" },
    data: { revision: 2, profile },
  });
  // Payload can reject the origin before authenticating the cookie (401); our
  // route rejects authenticated cross-site requests with 403. Both deny writes.
  expect([401, 403]).toContain(crossSite.status());
  expect(
    (await (await page.request.get(endpoint)).json()).own.profile.displayName,
  ).toBe("已保存的新昵称");
  await second.close();
});
