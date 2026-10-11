import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import {
  emptySignup,
  type SignupForm,
  type Question,
} from "../../src/lib/signup-schema";
import { readFile } from "node:fs/promises";
let p: Payload,
  admin: User,
  member: User,
  game: number,
  post: number,
  event: number;
const extraEvents: number[] = [];
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
  for (const id of extraEvents)
    await p.delete({ collection: "events", id, overrideAccess: true });
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
  await page.context().setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
}
test("publisher builds questionnaire, member submits once, organizer reads private answers", async ({
  page,
  browser,
}) => {
  await login(page, admin);
  await page.goto(`/activities/community-posts/${post}/manage`);
  await page.getByLabel("启用填写问卷报名").check();
  await page.getByRole("button", { name: "2 · 问卷设置" }).click();
  await page.getByLabel("报名说明").fill("请填写参与信息");
  await page.getByRole("button", { name: /1 · 编辑题目/ }).click();
  await page.getByRole("button", { name: "添加题目" }).click();
  await page.getByLabel("题目标题").fill("活动称呼");
  await page.getByRole("button", { name: "添加题目" }).click();
  const second = page.getByRole("group", { name: "第 2 题" });
  await second.getByLabel("题目标题").fill("参加场次");
  await second.getByLabel("题型").selectOption("single");
  await second.getByLabel("选项（每行一个）").fill("上午场\n下午场");
  await page.getByRole("button", { name: "保存报名问卷" }).click();
  await expect(
    page.locator(".signup-management > p[role=status]"),
  ).toContainText("报名问卷已保存");
  const other = await browser.newContext();
  const visitor = await other.newPage();
  await login(visitor, member);
  await visitor.goto(`/community/signup-ui-${suffix}/updates/${post}`);
  await visitor.getByLabel("活动称呼", { exact: true }).fill("报名测试");
  await visitor.getByLabel("上午场", { exact: true }).check();
  await visitor.getByRole("button", { name: "核对并提交" }).click();
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
  await page.locator(".signup-management > section summary").click();
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
  await expect(
    page.locator(".signup-management > p[role=status]"),
  ).toContainText("已保存");
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

test("conditional questionnaire previews, validates, preserves steps and retries without losing answers", async ({
  page,
}) => {
  await login(page, admin);
  await page.context().setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
  const endpoint = `/api/activities/community-posts/${post}/signup`;
  const initial = await (
    await page.request.get(endpoint + "?mode=manage")
  ).json();
  const form = {
    ...initial.form,
    enabled: true,
    pageSize: 1,
    questions: [
      {
        id: "mode",
        label: "参与方式",
        type: "single",
        required: true,
        options: ["参赛", "观赛"],
      },
      {
        id: "mail",
        label: "联系邮箱",
        type: "text",
        required: true,
        options: [],
        format: "email",
        help: "用于活动通知",
        showWhen: { questionId: "mode", option: "参赛" },
      },
      {
        id: "slots",
        label: "可用时段",
        type: "multiple",
        required: true,
        options: ["上午", "下午", "晚上", "均不参加"],
        minChoices: 2,
        maxChoices: 2,
        exclusiveOption: "均不参加",
      },
    ],
  };
  expect(
    (
      await page.request.put(endpoint, {
        data: { version: initial.version, form },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/activities/community-posts/${post}/manage`);
  const third = page.getByRole("group", { name: "第 3 题", exact: true });
  await third.locator(".designer-question-toggle").click();
  await third.getByRole("button", { name: "复制此题" }).click();
  await expect(
    page
      .getByRole("group", { name: "第 4 题", exact: true })
      .getByLabel("题目标题"),
  ).toHaveValue("可用时段（副本）");
  await page
    .getByRole("group", { name: "第 4 题", exact: true })
    .getByRole("button", { name: "删除此题" })
    .click();
  const second = page.getByRole("group", { name: "第 2 题", exact: true });
  await second.locator(".designer-question-toggle").click();
  await second.getByText("填写提示与校验", { exact: true }).click();
  await second.getByLabel("最多字数", { exact: true }).fill("100");
  await page.getByRole("button", { name: "保存报名问卷" }).click();
  await expect(
    page.locator(".signup-management > p[role=status]"),
  ).toContainText("已保存");
  expect(
    (await (await page.request.get(endpoint + "?mode=manage")).json()).form
      .questions[1].maxLength,
  ).toBe(100);
  await page.getByRole("button", { name: "预览填写效果" }).click();
  const preview = page.getByRole("dialog");
  await expect(
    preview.getByRole("heading", { name: "问卷预览" }),
  ).toBeVisible();
  await preview.getByLabel("观赛", { exact: true }).check();
  await preview.getByRole("button", { name: "下一步" }).click();
  await preview.getByLabel("均不参加", { exact: true }).check();
  await preview.getByRole("button", { name: "核对并提交" }).click();
  await preview.getByRole("button", { name: "验证预览答案" }).click();
  await expect(preview).toContainText("预览验证通过，未提交报名。");
  expect((await (await page.request.get(endpoint)).json()).signup).toBeNull();
  await page.keyboard.press("Escape");
  await expect(preview).not.toBeVisible();
  await page.goto(`/community/signup-ui-${suffix}/updates/${post}`);
  const signup = page.locator(".activity-signup");
  await signup.getByRole("button", { name: "下一步" }).click();
  await expect(signup.locator(".questionnaire-error")).toContainText(
    "参与方式",
  );
  await expect(signup.locator("fieldset").first()).toBeFocused();
  await signup.getByLabel("参赛", { exact: true }).check();
  await signup.getByRole("button", { name: "下一步" }).click();
  await signup.getByLabel("联系邮箱", { exact: true }).fill("bad-email");
  await signup.getByRole("button", { name: "下一步" }).click();
  await expect(signup.locator(".questionnaire-error")).toContainText(
    "有效邮箱",
  );
  await signup
    .getByLabel("联系邮箱", { exact: true })
    .fill("test@example.invalid");
  await signup.getByRole("button", { name: "上一步" }).click();
  await signup.getByLabel("观赛", { exact: true }).check();
  await signup.getByRole("button", { name: "下一步" }).click();
  await expect(signup.getByLabel("联系邮箱", { exact: true })).toHaveCount(0);
  await signup.getByLabel("上午", { exact: true }).check();
  await signup.getByRole("button", { name: "核对并提交" }).click();
  await expect(signup.locator(".questionnaire-error")).toContainText("2–2");
  await signup.getByLabel("均不参加", { exact: true }).check();
  await expect(signup.getByLabel("上午", { exact: true })).not.toBeChecked();
  await signup.getByLabel("下午", { exact: true }).check();
  await expect(
    signup.getByLabel("均不参加", { exact: true }),
  ).not.toBeChecked();
  await signup.getByLabel("上午", { exact: true }).check();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `.data/questionnaire-${width}.png`,
      fullPage: true,
    });
  }
  expect(
    (await new AxeBuilder({ page }).include(".activity-signup").analyze())
      .violations,
  ).toEqual([]);
  await signup.getByRole("button", { name: "核对并提交" }).click();
  await expect(signup.locator(".questionnaire-review")).not.toContainText(
    "联系邮箱",
  );
  await page.route("**" + endpoint, async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "临时不可用，请重试" }),
      });
    else await route.continue();
  });
  await signup.getByRole("button", { name: "提交并确认报名" }).click();
  await expect(signup.getByRole("alert")).toContainText("临时不可用");
  await expect(signup.locator(".questionnaire-review")).toContainText(
    "下午、上午",
  );
  await page.unroute("**" + endpoint);
  await signup.getByRole("button", { name: "提交并确认报名" }).click();
  await expect(
    signup.getByRole("heading", { name: "已报名", exact: true }),
  ).toBeVisible();
  const saved = (await (await page.request.get(endpoint)).json()).signup;
  expect(saved.answers).toEqual({ mode: "观赛", slots: ["下午", "上午"] });
  expect(saved.questions.map((q: { id: string }) => q.id)).toEqual([
    "mode",
    "slots",
  ]);
});

test("advanced types, account-scoped drafts, statistics, exports and permissions work together", async ({
  page,
  browser,
}) => {
  await login(page, admin);
  await page.context().setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
  const endpoint = `/api/activities/events/${event}/signup`;
  const make = (
    id: string,
    label: string,
    type: Question["type"],
    extras: Partial<Question> = {},
  ): Question => ({ id, label, type, required: true, options: [], ...extras });
  const form = {
    ...emptySignup,
    enabled: true,
    title: "综合问卷验收",
    pageSize: 20,
    theme: "blue",
    questions: [
      make("select", "参与组别", "select", { options: ["A组", "B组"] }),
      make("number", "参与次数", "number", { min: 0, max: 10, step: 1 }),
      make("date", "方便日期", "date"),
      make("time", "方便时间", "time"),
      make("rating", "整体评分", "rating"),
      make("nps", "推荐意愿", "nps"),
      make("ranking", "活动优先级", "ranking", { options: ["交流", "比赛"] }),
      make("matrix", "组织评价", "matrix", {
        rows: ["安排", "通知"],
        options: ["满意", "一般"],
      }),
      make("multi", "时段安排", "matrixMultiple", {
        rows: ["周末"],
        options: ["上午", "下午"],
      }),
      make("blanks", "补充信息", "blanks", { rows: ["建议", "备注"] }),
    ],
  };
  const info = await (await page.request.get(endpoint + "?mode=manage")).json();
  const save = await page.request.put(endpoint, {
    data: { version: info.version, form },
  });
  expect(save.ok()).toBeTruthy();
  const version = (await save.json()).version;
  expect(
    (
      await page.request.post(endpoint, {
        data: { version, answers: { select: "伪造" } },
      })
    ).status(),
  ).toBe(400);
  const token = await p.login({
    collection: "users",
    data: { email: member.email, password },
  });
  const legacy = await page.request.get(endpoint, {
    headers: { Authorization: `JWT ${token.token}` },
  });
  expect(legacy.status()).toBe(409);
  await page.goto(`/activities/events/${event}/fill`);
  const signup = page.locator(".activity-signup");
  await signup.getByLabel("在此浏览器保存草稿", { exact: false }).check();
  await signup.getByLabel("参与组别", { exact: true }).selectOption("A组");
  await signup.getByLabel("参与次数", { exact: true }).fill("3");
  await expect(signup.getByRole("status")).toContainText("草稿已保存");
  // Wait for the actual persisted latest input, not a previous save notification.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries(localStorage).some(
          ([key, value]) =>
            key.startsWith("questionnaire:") && value.includes('"number":"3"'),
        ),
      ),
    )
    .toBe(true);
  await page.reload();
  await signup.getByRole("button", { name: "恢复未提交的草稿" }).click();
  await expect(signup.getByLabel("参与次数", { exact: true })).toHaveValue("3");
  await signup.getByLabel("方便日期", { exact: true }).fill("2026-10-15");
  await signup.getByLabel("方便时间", { exact: true }).fill("18:30");
  await signup
    .getByRole("group", { name: /整体评分/ })
    .getByLabel("5", { exact: true })
    .check();
  await signup
    .getByRole("group", { name: /推荐意愿/ })
    .getByLabel("10", { exact: true })
    .check();
  await signup.getByLabel("第 1 名", { exact: true }).selectOption("比赛");
  await signup.getByLabel("第 2 名", { exact: true }).selectOption("交流");
  const matrix = signup.getByRole("group", { name: /组织评价/ });
  await matrix
    .getByRole("group", { name: "安排", exact: true })
    .getByLabel("满意", { exact: true })
    .check();
  await matrix
    .getByRole("group", { name: "通知", exact: true })
    .getByLabel("一般", { exact: true })
    .check();
  await signup
    .getByRole("group", { name: "周末", exact: true })
    .getByLabel("上午", { exact: true })
    .check();
  await signup.getByLabel("补充信息：建议", { exact: true }).fill("=1+1");
  await signup.getByLabel("补充信息：备注", { exact: true }).fill("仅本地验收");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  expect(
    (await new AxeBuilder({ page }).include(".activity-signup").analyze())
      .violations,
  ).toEqual([]);
  await signup.getByRole("button", { name: "核对并提交" }).click();
  await expect(signup.locator(".questionnaire-review")).toContainText(
    "安排：满意",
  );
  await signup.getByRole("button", { name: "提交并确认报名" }).click();
  await expect(
    signup.getByRole("heading", { name: "已报名", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("questionnaire:"),
        ).length,
    ),
  ).toBe(0);
  await page.goto(`/activities/events/${event}/manage`);
  const results = page.locator(".questionnaire-results");
  await results.getByLabel("填写者姓名", { exact: true }).fill(admin.name);
  await results.getByRole("button", { name: "查看统计图表" }).click();
  await expect(results.getByRole("status")).toContainText("1 份答卷");
  await expect(results).toContainText("NPS 100");
  await expect(results).toContainText("平均值 3");
  const csv = await page.request.get(
    endpoint + "?mode=export&name=" + encodeURIComponent(admin.name),
  );
  expect(csv.status()).toBe(200);
  expect(csv.headers()["cache-control"]).toContain("no-store");
  expect(await csv.text()).toContain("安排：满意");
  const context = await browser.newContext(),
    visitor = await context.newPage();
  await login(visitor, member);
  await context.setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
  for (const mode of ["stats", "export"])
    expect(
      (await visitor.request.get(endpoint + "?mode=" + mode)).status(),
    ).toBe(403);
  await context.close();
  await page.goto("/activities");
  await expect(page.getByRole("heading", { name: "问卷工作台" })).toBeVisible();
});

test("editor templates, text import, undo redo and exported JSON preserve editable settings", async ({
  page,
}) => {
  await login(page, admin);
  await page.context().setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
  const endpoint = `/api/activities/events/${event}/signup`;
  const info = await (await page.request.get(endpoint + "?mode=manage")).json();
  expect(
    (
      await page.request.put(endpoint, {
        data: { version: info.version, form: emptySignup },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/activities/events/${event}/manage`);
  await page.getByLabel("启用填写问卷报名").check();
  await page.getByRole("button", { name: "从模板开始" }).click();
  const starter = page.getByRole("dialog");
  await starter.getByRole("button", { name: "预览「满意度反馈」" }).click();
  await expect(starter.locator(".blueprint-questions > li")).toHaveCount(7);
  await starter.getByRole("button", { name: "替换并进入编辑" }).click();
  await expect(page.locator(".designer-question")).toHaveCount(7);
  await page.getByRole("button", { name: "导入已有问卷" }).click();
  await starter
    .getByLabel("批量题目文本", { exact: true })
    .fill("[日期]可用日期*");
  await starter.getByRole("button", { name: "检查并预览文本" }).click();
  await starter.getByLabel("追加题目", { exact: false }).check();
  await starter.getByRole("button", { name: "追加并进入编辑" }).click();
  await expect(page.locator(".designer-question")).toHaveCount(8);
  await page.getByRole("button", { name: "撤销编辑" }).click();
  await expect(page.locator(".designer-question")).toHaveCount(7);
  await page.getByRole("button", { name: "重做编辑" }).click();
  await expect(page.locator(".designer-question")).toHaveCount(8);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出问卷模板" }).click();
  const file = await download;
  const content = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(content.questions.map((q: Question) => q.type)).toEqual([
    "rating",
    "matrix",
    "nps",
    "multiple",
    "textarea",
    "single",
    "textarea",
    "date",
  ]);
  expect(new Set(content.questions.map((q: Question) => q.id)).size).toBe(8);
  await page.getByRole("button", { name: "保存报名问卷" }).click();
  await expect(
    page.locator(".signup-management > p[role=status]"),
  ).toContainText("已保存");
  expect(
    (await (await page.request.get(endpoint + "?mode=manage")).json()).form
      .questions,
  ).toEqual(content.questions);
});
async function questionnaireEvent(form: SignupForm = emptySignup) {
  const doc = await p.create({
    collection: "events",
    user: admin,
    overrideAccess: false,
    context: { manageSignupForm: true },
    data: {
      title: "问卷工作流本地验证",
      slug: "studio-" + randomBytes(8).toString("hex"),
      _status: "published",
      signupForm: form,
    },
  });
  extraEvents.push(doc.id);
  return doc.id;
}

test("complex branches recompute on back navigation and persist only the actual path", async ({
  page,
  browser,
}) => {
  const make = (
    id: string,
    label: string,
    type: Question["type"],
    extras: Partial<Question> = {},
  ): Question => ({ id, label, type, required: true, options: [], ...extras });
  const form: SignupForm = {
    ...emptySignup,
    enabled: true,
    pageSize: 5,
    questions: [
      make("interest", "是否参与", "single", {
        options: ["愿意", "暂不参加"],
        jumps: [
          {
            when: {
              mode: "all",
              rules: [
                {
                  questionId: "interest",
                  operator: "equals",
                  value: "暂不参加",
                },
              ],
            },
            target: "$end",
          },
        ],
      }),
      make("hours", "可参与小时数", "number", {
        min: 0,
        max: 24,
        step: 0.5,
        jumps: [
          {
            when: {
              mode: "all",
              rules: [
                { questionId: "interest", operator: "equals", value: "愿意" },
                { questionId: "hours", operator: "lt", value: "1" },
              ],
            },
            target: "short",
          },
        ],
      }),
      make("full", "完整活动需求", "text", { jumps: [{ target: "notes" }] }),
      make("short", "短时活动需求", "text"),
      make("notes", "补充说明", "text", { required: false }),
    ],
  };
  const id = await questionnaireEvent(form),
    endpoint = `/api/activities/events/${id}/signup`;
  await login(page, admin);
  await page.goto(`/activities/events/${id}/fill`);
  const signup = page.locator(".activity-signup");
  await signup.getByLabel("愿意", { exact: true }).check();
  await signup.getByRole("button", { name: "下一步" }).click();
  await signup.getByLabel("可参与小时数", { exact: true }).fill("3");
  await signup.getByRole("button", { name: "下一步" }).click();
  await signup
    .getByLabel("完整活动需求", { exact: true })
    .fill("应清除的旧分支答案");
  await signup.getByRole("button", { name: "上一步" }).click();
  await signup.getByLabel("可参与小时数", { exact: true }).fill("0.5");
  await expect(signup.locator(".questionnaire-branch-notice")).toContainText(
    "短时活动需求",
  );
  await signup.getByRole("button", { name: "下一步" }).click();
  await expect(signup.getByLabel("完整活动需求", { exact: true })).toHaveCount(
    0,
  );
  await signup.getByLabel("短时活动需求", { exact: true }).fill("短时交流");
  await signup.getByRole("button", { name: "上一步" }).click();
  await signup.getByLabel("可参与小时数", { exact: true }).fill("2");
  await signup.getByRole("button", { name: "下一步" }).click();
  await expect(signup.getByLabel("完整活动需求", { exact: true })).toHaveValue(
    "",
  );
  await signup.getByRole("button", { name: "上一步" }).click();
  await signup.getByLabel("可参与小时数", { exact: true }).fill("0.5");
  await signup.getByRole("button", { name: "下一步" }).click();
  await signup.getByLabel("短时活动需求", { exact: true }).fill("短时交流");
  await signup.getByRole("button", { name: "核对并提交" }).click();
  await expect(signup.locator(".questionnaire-review")).not.toContainText(
    "完整活动需求",
  );
  await signup.getByRole("button", { name: "提交并确认报名" }).click();
  await expect(
    signup.getByRole("heading", { name: "已报名", exact: true }),
  ).toBeVisible();
  const saved = (await (await page.request.get(endpoint)).json()).signup;
  expect(saved.answers).toEqual({
    interest: "愿意",
    hours: "0.5",
    short: "短时交流",
    notes: "",
  });
  expect(saved.questions.map((q: Question) => q.id)).toEqual([
    "interest",
    "hours",
    "short",
    "notes",
  ]);
  const context = await browser.newContext(),
    other = await context.newPage();
  await login(other, member);
  await other.goto(`/activities/events/${id}/fill`);
  const otherForm = other.locator(".activity-signup");
  await otherForm.getByLabel("暂不参加", { exact: true }).check();
  await expect(otherForm.locator(".questionnaire-branch-notice")).toContainText(
    "提前结束",
  );
  await otherForm.getByRole("button", { name: "核对并提交" }).click();
  await expect(otherForm.locator(".questionnaire-review")).not.toContainText(
    "可参与小时数",
  );
  await otherForm.getByRole("button", { name: "提交并确认报名" }).click();
  await expect(
    otherForm.getByRole("heading", { name: "已报名", exact: true }),
  ).toBeVisible();
  expect(
    (await (await other.request.get(endpoint)).json()).signup.answers,
  ).toEqual({ interest: "暂不参加" });
  await context.close();
});

test("template library previews real branches and designer manages logic safely", async ({
  page,
}) => {
  const id = await questionnaireEvent();
  await login(page, admin);
  await page.goto(`/activities/events/${id}/manage`);
  await page.getByRole("button", { name: "从模板开始" }).click();
  const starter = page.getByRole("dialog");
  await starter.getByLabel("搜索模板").fill("不存在的模板");
  await expect(starter).toContainText("没有找到匹配模板");
  await starter.getByLabel("搜索模板").fill("");
  await starter
    .getByRole("combobox", { name: "场景", exact: true })
    .selectOption("报名与组织");
  await expect(starter.locator(".template-card")).toHaveCount(3);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include(".questionnaire-starter-dialog")
        .analyze()
    ).violations,
  ).toEqual([]);
  await starter.getByRole("button", { name: "预览「活动报名」" }).click();
  await starter.getByRole("button", { name: "预览试填", exact: true }).click();
  await starter.getByLabel("如何称呼你？", { exact: true }).fill("预览称呼");
  await starter.getByLabel("暂不参加", { exact: true }).check();
  await starter.getByRole("button", { name: "核对并提交" }).click();
  await expect(starter.locator(".questionnaire-review")).not.toContainText(
    "方便参加的时段",
  );
  await starter.getByRole("button", { name: "替换并进入编辑" }).click();
  await expect(page.locator(".designer-question")).toHaveCount(6);
  await page.getByRole("button", { name: "2 · 问卷设置" }).click();
  await expect(page.getByLabel("问卷标题", { exact: true })).toHaveValue(
    "活动报名",
  );
  await page.getByLabel("报名说明").fill("仅本地模板流程验收");
  await page.getByRole("button", { name: /1 · 编辑题目/ }).click();
  const second = page.getByRole("group", { name: "第 2 题", exact: true });
  await second.locator(".designer-question-toggle").click();
  await second.getByText(/条件跳转 · 2 个分支/).click();
  await expect(second.locator(".jump-rule")).toHaveCount(2);
  await second.getByRole("button", { name: "下移", exact: true }).click();
  await page
    .locator(".designer-question.is-active")
    .getByRole("button", { name: "下移", exact: true })
    .click();
  await expect(page.locator(".signup-builder > p[role=status]")).toContainText(
    "跳转目标",
  );
  await page
    .locator(".designer-question.is-active")
    .getByRole("button", { name: "上移", exact: true })
    .click();
  await page.getByRole("button", { name: "2 · 问卷设置" }).click();
  await page.getByRole("button", { name: /1 · 编辑题目/ }).click();
  const fourth = page.getByRole("group", { name: "第 4 题", exact: true });
  await fourth.locator(".designer-question-toggle").click();
  page.once("dialog", (d) => d.accept());
  await fourth.getByRole("button", { name: "删除此题" }).click();
  await expect(page.locator(".designer-question")).toHaveCount(5);
  await page.getByRole("button", { name: "撤销编辑" }).click();
  await expect(page.locator(".designer-question")).toHaveCount(6);
  await page.getByRole("button", { name: "保存报名问卷" }).click();
  await expect(
    page.locator(".signup-management > p[role=status]"),
  ).toContainText("已保存");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `.data/questionnaire-studio-${width}.png`,
      fullPage: true,
    });
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include(".questionnaire-designer")
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("AI creation preserves current content on failure and previews editable generated drafts", async ({
  page,
}) => {
  const id = await questionnaireEvent();
  await login(page, admin);
  await page.goto(`/activities/events/${id}/manage`);
  const generated = JSON.parse(
    await readFile("tests/fixtures/questionnaire-ai-draft.json", "utf8"),
  );
  let attempts = 0;
  await page.route("**/api/questionnaires/generate", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: true, model: "DeepSeek-V4.1-Flash" }),
      });
      return;
    }
    const data = route.request().postDataJSON();
    expect(data.description).toContain("意向");
    expect(data).not.toHaveProperty("apiKey");
    await route.fulfill({
      status: ++attempts === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        attempts === 1
          ? { error: "AI 服务暂时不可用，请稍后重试。" }
          : { form: generated, model: "DeepSeek-V4.1-Flash" },
      ),
    });
  });
  await page.getByRole("button", { name: "AI 制作问卷" }).click();
  const starter = page.getByRole("dialog");
  await starter
    .getByLabel("制作需求", { exact: true })
    .fill("制作一份活动意向问卷，暂不参加时提前结束。");
  await starter.getByLabel("作答题数").selectOption("5");
  await starter.getByLabel("按需求设计条件显示与跳转").check();
  await starter.getByRole("button", { name: "生成问卷草稿" }).click();
  await expect(starter.getByRole("alert")).toContainText("暂时不可用");
  await expect(page.locator(".designer-question")).toHaveCount(0);
  await starter.getByRole("button", { name: "生成问卷草稿" }).click();
  await expect(starter.locator(".blueprint-questions > li")).toHaveCount(5);
  await starter.getByRole("button", { name: "替换并进入编辑" }).click();
  await expect(page.locator(".designer-question")).toHaveCount(5);
  await page.getByLabel("题目标题", { exact: true }).fill("修改后的意向问题");
  await page.getByRole("button", { name: "保存报名问卷" }).click();
  await expect(
    page.locator(".signup-management > p[role=status]"),
  ).toContainText("已保存");
  const saved = await (
    await page.request.get(`/api/activities/events/${id}/signup?mode=manage`)
  ).json();
  expect(saved.form.questions[0].label).toBe("修改后的意向问题");
  expect(saved.form.questions.some((q: Question) => q.jumps?.length)).toBe(
    true,
  );
});

test("AI endpoint enforces manager authorization and serves a real generated draft", async ({
  page,
  browser,
}) => {
  const context = await browser.newContext(),
    anonymous = await context.newPage();
  expect(
    (await anonymous.request.get("/api/questionnaires/generate")).status(),
  ).toBe(401);
  await context.setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
  await login(anonymous, member);
  expect(
    (await anonymous.request.get("/api/questionnaires/generate")).status(),
  ).toBe(403);
  await context.close();
  await login(page, admin);
  await page.context().setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
  const rejected = await page.request.post("/api/questionnaires/generate", {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  });
  expect([401, 403]).toContain(rejected.status());
  if (process.env.QUESTIONNAIRE_AI_LIVE_TEST !== "1") return;
  const response = await page.request.post("/api/questionnaires/generate", {
    headers: {
      Origin: new URL(process.env.SERVER_URL || "http://localhost:3000").origin,
    },
    data: {
      description: "请制作通用活动反馈问卷，了解整体满意度和改进建议。",
      audience: "参与者",
      count: 3,
      logic: false,
    },
    timeout: 90000,
  });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.model).toBe("DeepSeek-V4.1-Flash");
  expect(result.form.questions).toHaveLength(3);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(result).not.toHaveProperty("apiKey");
});
