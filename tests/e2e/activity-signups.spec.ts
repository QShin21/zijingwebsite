import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { randomBytes } from "node:crypto";
let p: Payload,
  admin: User,
  member: User,
  game: number,
  post: number,
  event: number;
const suffix = Date.now(),
  password = randomBytes(18).toString("hex");
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development")
    throw new Error("Development only");
  p = await getPayload({ config });
  const user = (name: string, roles: User["roles"]) =>
    p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        name: name + suffix,
        email: randomBytes(8).toString("hex") + "@example.invalid",
        password,
        roles,
      },
    });
  admin = await user("活动发布", ["vicePresident"]);
  member = await user("活动报名", ["member"]);
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "问卷验证游戏",
        slug: "signup-ui-" + suffix,
        _status: "published",
      },
    })
  ).id;
  post = (
    await p.create({
      collection: "community-posts",
      overrideAccess: false,
      user: admin,
      data: {
        title: "问卷验证活动",
        body: "仅本地验收",
        author: admin.id,
        game,
        category: "event",
      },
    })
  ).id;
  event = (
    await p.create({
      collection: "events",
      overrideAccess: false,
      user: admin,
      data: {
        title: "站点问卷活动",
        slug: "signup-ui-" + suffix,
        _status: "published",
      },
    })
  ).id;
});
test.afterAll(async () => {
  if (!p) return;
  for (const u of [admin, member])
    if (u)
      await p.delete({
        collection: "event-signups",
        overrideAccess: true,
        where: { member: { equals: u.id } },
      });
  if (post)
    await p.delete({
      collection: "community-posts",
      id: post,
      overrideAccess: true,
    });
  if (event)
    await p.delete({ collection: "events", id: event, overrideAccess: true });
  if (game)
    await p.delete({ collection: "games", id: game, overrideAccess: true });
  for (const u of [admin, member])
    if (u)
      await p.delete({
        collection: "users",
        id: u.id,
        overrideAccess: true,
        context: { system: true },
      });
});
async function login(page: Page, user: User) {
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(user.name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}
test("publisher builds questionnaire, member submits once, organizer reads private answers", async ({
  page,
  browser,
}) => {
  await login(page, admin);
  await page.goto(`/activities/community-posts/${post}/manage`);
  await page.getByLabel("启用填写问卷报名").check();
  await page.getByLabel("报名说明").fill("请填写参与信息");
  await page.getByRole("button", { name: "添加题目" }).click();
  await page.getByLabel("题目标题").fill("活动称呼");
  await page.getByRole("button", { name: "添加题目" }).click();
  const second = page.getByRole("group", { name: "第 2 题" });
  await second.getByLabel("题目标题").fill("参加场次");
  await second.getByLabel("题型").selectOption("single");
  await second.getByLabel("选项（每行一个）").fill("上午场\n下午场");
  await page.getByRole("button", { name: "保存报名问卷" }).click();
  await expect(page.getByRole("status")).toContainText("报名问卷已保存");
  const other = await browser.newContext();
  const visitor = await other.newPage();
  await login(visitor, member);
  await visitor.goto(`/community/signup-ui-${suffix}/updates/${post}`);
  await visitor.getByLabel("活动称呼", { exact: true }).fill("报名测试");
  await visitor.getByLabel("上午场", { exact: true }).check();
  await visitor.getByRole("button", { name: "提交并确认报名" }).click();
  await expect(
    visitor.getByRole("heading", { name: "已报名", exact: true }),
  ).toBeVisible();
  await visitor.reload();
  await expect(
    visitor.getByRole("heading", { name: "已报名", exact: true }),
  ).toBeVisible();
  await expect(
    visitor.getByRole("button", { name: "提交并确认报名" }),
  ).toHaveCount(0);
  expect(
    (
      await visitor.request.get(
        `/api/activities/community-posts/${post}/signup?mode=entries`,
        { headers: { "Sec-Fetch-Site": "same-origin" } },
      )
    ).status(),
  ).toBe(403);
  await page.getByRole("button", { name: "查看 / 刷新报名名单" }).click();
  await expect(
    page.getByRole("heading", { name: "报名名单（1 人）" }),
  ).toBeVisible();
  await page.locator(".signup-management summary").click();
  await expect(page.locator(".signup-management dd").first()).toHaveText(
    "报名测试",
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `.data/signup-manager-${width}.png` });
  }
  await other.close();
});
test("site event management and API token submission share the same questionnaire", async ({
  page,
}) => {
  await login(page, admin);
  await page.goto(`/activities/events/${event}/manage`);
  await page.getByLabel("启用填写问卷报名").check();
  await page.getByRole("button", { name: "添加题目" }).click();
  await page.getByLabel("题目标题").fill("参加理由");
  await page.getByRole("button", { name: "保存报名问卷" }).click();
  await expect(page.getByRole("status")).toContainText("已保存");
  await page.goto(`/events/signup-ui-${suffix}`);
  await expect(page.getByLabel("参加理由", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "暂无报名渠道" })).toHaveCount(
    0,
  );
  const loginResult = await p.login({
    collection: "users",
    data: { email: member.email, password },
  });
  const auth = { Authorization: `JWT ${loginResult.token}` };
  const endpoint = `/api/activities/events/${event}/signup`;
  const form = await (
    await page.request.get(endpoint, { headers: auth })
  ).json();
  const answer = { [form.form.questions[0].id]: "来自小程序令牌" };
  const [a, b] = await Promise.all([
    page.request.post(endpoint, {
      headers: auth,
      data: { version: form.version, answers: answer },
    }),
    page.request.post(endpoint, {
      headers: auth,
      data: { version: form.version, answers: answer },
    }),
  ]);
  expect(a.status()).toBe(200);
  expect(b.status()).toBe(200);
  expect((await a.json()).signup.id).toBe((await b.json()).signup.id);
  expect(
    (
      await page.request.post("/api/event-signups", {
        headers: auth,
        data: {
          context: { submitEventSignup: true },
          activityType: "events",
          activityID: event,
          member: admin.id,
          answers: answer,
        },
      })
    ).status(),
  ).toBe(403);
});

test("publisher includes questionnaire before publishing and CMS offers editor link", async ({
  page,
}) => {
  await login(page, admin);
  await page.goto(`/admin/collections/events/${event}`);
  await expect(
    page.getByRole("link", { name: "编辑报名问卷、查看报名名单 ↗" }),
  ).toBeVisible();
  await page.goto(`/community/signup-ui-${suffix}/updates`);
  await page.getByText("发布活动与通知", { exact: true }).click();
  const form = page
    .locator("form")
    .filter({ has: page.locator('select[name="kind"]') });
  await form
    .getByLabel("标题", { exact: true })
    .fill("发布时设置报名" + suffix);
  await form.getByLabel("内容", { exact: true }).fill("仅本地验收");
  await form.getByLabel("启用填写问卷报名").check();
  await form.getByRole("button", { name: "添加题目" }).click();
  await form.getByLabel("题目标题").fill("姓名");
  await form.getByRole("button", { name: "发布", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "发布时设置报名" + suffix, exact: true }),
  ).toBeVisible();
  const created = await p.find({
    collection: "community-posts",
    overrideAccess: false,
    user: admin,
    where: { title: { equals: "发布时设置报名" + suffix } },
  });
  try {
    expect(created.docs).toHaveLength(1);
    expect((created.docs[0].signupForm as { enabled: boolean }).enabled).toBe(
      true,
    );
  } finally {
    for (const doc of created.docs)
      await p.delete({
        collection: "community-posts",
        id: doc.id,
        overrideAccess: true,
      });
  }
});

