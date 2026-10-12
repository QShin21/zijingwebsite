import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import { profileFixture, saveLoadedProfile } from "../team-profiles-fixture";
import { emptyTeamProfile } from "../../src/lib/team-profiles-model";
let p: Payload, f: Awaited<ReturnType<typeof profileFixture>>;
test.beforeAll(async () => {
  p = await getPayload({ config });
});
test.beforeEach(async () => {
  f = await profileFixture(p);
});
test.afterEach(async () => {
  await f.cleanup();
});
test.afterAll(async () => {
  await p.destroy();
});
const panel = (page: Page) => page.locator("#team-members");
async function open(page: Page) {
  expect(
    (
      await page.request.post("/api/users/login", {
        data: { email: f.member.email, password: f.password },
      })
    ).ok(),
  ).toBe(true);
  await page.context().setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
  await page.goto(`/teams/profiles/${f.first.id}`);
  await expect(
    panel(page).getByLabel("公开昵称", { exact: true }),
  ).toBeVisible();
}
async function rejoin() {
  await f.changeMembership({
    status: "revoked",
    revokedAt: new Date().toISOString(),
  });
  await f.changeMembership({
    status: "active",
    joinedAt: new Date(Date.now() + 1000).toISOString(),
    revokedAt: null,
  });
}
const record = async () =>
  (
    await p.find({
      collection: "team-member-profiles",
      overrideAccess: true,
      depth: 0,
      where: { membership: { equals: f.membership.id } },
    })
  ).docs[0];

test("旧预览页及重放PUT跨再入队周期均409；刷新后隐藏默认且新明确选择才能展示", async ({
  page,
}) => {
  await saveLoadedProfile(p, f.member, f.first.id, null, {
    ...emptyTeamProfile(),
    displayName: "周期旧公开简介",
    visible: true,
  });
  await open(page);
  const endpoint = `/api/team-profiles/${f.first.id}`;
  const old = await (await page.request.get(endpoint)).json();
  const before = await record();
  await panel(page)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await rejoin();
  const rejected = page.waitForResponse(
    (r) => r.url().endsWith(endpoint) && r.request().method() === "PUT",
  );
  await panel(page)
    .getByRole("button", { name: "确认保存简介", exact: true })
    .click();
  expect((await rejected).status()).toBe(409);
  await expect(panel(page).getByRole("alert")).toContainText("入队周期已更新");
  await expect(
    panel(page).getByLabel("公开昵称", { exact: true }),
  ).toBeDisabled();
  expect(await record()).toEqual(before);
  const replay = {
    revision: 1,
    membershipVersion: old.own.membershipVersion,
    profile: {
      ...emptyTeamProfile(),
      displayName: "周期旧公开简介",
      visible: true,
    },
  };
  for (let n = 0; n < 2; n++)
    expect((await page.request.put(endpoint, { data: replay })).status()).toBe(
      409,
    );
  expect((await (await page.request.get(endpoint)).json()).profiles).toEqual(
    [],
  );
  await panel(page)
    .getByRole("button", { name: "重新加载已保存资料", exact: true })
    .click();
  await expect(
    panel(page).getByLabel("在本代表队页面展示我的简介", { exact: true }),
  ).not.toBeChecked();
  await panel(page)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "确认保存简介", exact: true })
    .click();
  await expect(
    panel(page)
      .locator("[role=status]")
      .filter({ hasText: "简介已保存并隐藏" }),
  ).toBeVisible();
  expect((await (await page.request.get(endpoint)).json()).profiles).toEqual(
    [],
  );
  await panel(page)
    .getByLabel("在本代表队页面展示我的简介", { exact: true })
    .check();
  await panel(page)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "确认保存简介", exact: true })
    .click();
  await expect(
    panel(page)
      .locator("[role=status]")
      .filter({ hasText: "简介已保存并选择展示" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get(endpoint)).json()).profiles,
  ).toHaveLength(1);
  expect((await page.request.put(endpoint, { data: replay })).status()).toBe(
    409,
  );
  expect((await record()).revision).toBe(3);
});

test("旧周期异步迟到请求不能把隐藏资料恢复展示或递增版本", async ({ page }) => {
  await saveLoadedProfile(p, f.member, f.first.id, null, {
    ...emptyTeamProfile(),
    displayName: "周期隐藏简介",
    visible: false,
  });
  await open(page);
  const before = await record(),
    endpoint = `/api/team-profiles/${f.first.id}`;
  let release!: () => void, arrived!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  await page.route(`**${endpoint}`, async (route) => {
    if (route.request().method() === "PUT") {
      arrived();
      await held;
    }
    await route.continue();
  });
  await panel(page)
    .getByLabel("在本代表队页面展示我的简介", { exact: true })
    .check();
  await panel(page)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "确认保存简介", exact: true })
    .click();
  await ready;
  await rejoin();
  const response = page.waitForResponse(
    (r) => r.url().endsWith(endpoint) && r.request().method() === "PUT",
  );
  release();
  expect((await response).status()).toBe(409);
  await expect(panel(page).getByRole("alert")).toContainText("入队周期已更新");
  expect(await record()).toEqual(before);
  expect((await (await page.request.get(endpoint)).json()).profiles).toEqual(
    [],
  );
});

test("保存响应迟到后后台读取新周期，不给旧草稿换发凭据或恢复授权", async ({
  page,
}) => {
  await saveLoadedProfile(p, f.member, f.first.id, null, {
    ...emptyTeamProfile(),
    displayName: "迟到响应合成资料",
    visible: false,
  });
  await open(page);
  const endpoint = `/api/team-profiles/${f.first.id}`;
  let release!: () => void, applied!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    applied = resolve;
  });
  await page.route(`**${endpoint}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    applied();
    await held;
    await route.fulfill({ response });
  });
  await panel(page)
    .getByLabel("在本代表队页面展示我的简介", { exact: true })
    .check();
  await panel(page)
    .getByRole("button", { name: "预览简介", exact: true })
    .click();
  await panel(page)
    .getByRole("button", { name: "确认保存简介", exact: true })
    .click();
  await ready;
  expect((await record()).revision).toBe(2);
  await rejoin();
  release();
  await expect(panel(page).getByRole("alert")).toContainText("入队周期已更新");
  await expect(
    panel(page).getByLabel("公开昵称", { exact: true }),
  ).toBeDisabled();
  expect((await (await page.request.get(endpoint)).json()).profiles).toEqual(
    [],
  );
  expect((await record()).revision).toBe(2);
  await page.unroute(`**${endpoint}`);
  await panel(page)
    .getByRole("button", { name: "重新加载已保存资料", exact: true })
    .click();
  await expect(
    panel(page).getByLabel("在本代表队页面展示我的简介", { exact: true }),
  ).not.toBeChecked();
});
