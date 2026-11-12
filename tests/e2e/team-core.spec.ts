import { browserTestOrigin } from "./browser-test-origin";
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import {
  submitTeamEstablishment,
  decideTeamEstablishment,
  saveTeamRecruitment,
  closeTeamRecruitment,
  defaultTeamForm,
} from "../../src/lib/team-core";
import { getActiveTeamMembership } from "../../src/lib/team-memberships";
let p: Payload,
  leader: User,
  manager: User,
  participant: User,
  stranger: User,
  foreign: User;
let game: number, otherGame: number, team: number, batch: number;
const suffix = randomBytes(5).toString("hex"),
  password = randomBytes(24).toString("hex"),
  origin = { Origin: browserTestOrigin };
test.beforeAll(async () => {
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Synthetic loopback only");
  p = await getPayload({ config, key: "team-core-e2e" });
  const create = (name: string, roles: User["roles"]) =>
    p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        name: `${name}-${suffix}`,
        email: `${name}-${suffix}@example.invalid`,
        password,
        roles,
      },
    });
  leader = await create("TeamPresident", ["president"]);
  manager = await create("TeamManager", ["member"]);
  participant = await create("TeamApplicant", ["member"]);
  stranger = await create("TeamStranger", ["backbone"]);
  foreign = await create("TeamForeign", ["member"]);
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成队伍测试社群",
        slug: `team-core-${suffix}`,
        _status: "published",
      },
    })
  ).id;
  otherGame = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成其他社群",
        slug: `team-foreign-${suffix}`,
        _status: "published",
      },
    })
  ).id;
  manager = await p.update({
    collection: "users",
    id: manager.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: [
        { game, status: "active", publishContent: true, handleJoins: true },
      ],
    },
  });
  foreign = await p.update({
    collection: "users",
    id: foreign.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: [
        {
          game: otherGame,
          status: "active",
          publishContent: true,
          handleJoins: true,
        },
      ],
    },
  });
  const application = await submitTeamEstablishment(p, manager, {
    gameID: game,
    title: "合成浏览器核心队",
    reason: "合成组织计划，负责选拔并安排训练。",
  });
  const approved = await decideTeamEstablishment(
    p,
    leader,
    application.id,
    "approved",
    "",
    application.updatedAt,
  );
  team = Number(approved.team);
  batch = (
    await saveTeamRecruitment(p, manager, {
      teamID: team,
      title: "合成浏览器招新批次",
      status: "open",
      form: {
        ...defaultTeamForm,
        end: new Date(Date.now() + 86400000).toISOString(),
      },
    })
  ).id;
});
test.afterAll(async () => {
  if (!p) return;
  for (const collection of [
    "team-memberships",
    "team-join-applications",
    "team-recruitments",
    "team-establishment-applications",
    "teams",
  ] as const)
    await p.delete({
      collection,
      overrideAccess: true,
      where: { game: { equals: game } },
    });
  for (const actor of [leader, manager, participant, stranger, foreign])
    if (actor)
      await p.delete({
        collection: "users",
        id: actor.id,
        overrideAccess: true,
        context: { system: true },
      });
  for (const id of [game, otherGame])
    if (id) await p.delete({ collection: "games", id, overrideAccess: true });
  await p.destroy();
});
async function login(page: Page, user: User) {
  const response = await page.request.post("/api/users/login", {
    headers: origin,
    data: { email: user.email, password },
  });
  expect(response.status(), await response.text()).toBe(200);
  await page.goto("/account");
  // V2 "我的": the h1 is the signed-in nickname; account facts live in the "账号" aside.
  await expect(
    page.getByRole("heading", { name: user.name, level: 1, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "账号", exact: true })
      .getByText(user.name, { exact: true }),
  ).toBeVisible();
}
test("建队网页退回、修改重提与高权限批准可进入招新工作台", async ({
  page,
  browser,
}) => {
  await login(page, manager);
  await page.goto("/teams/apply");
  await page.getByLabel("拟用队名").fill(`合成网页建队-${suffix}`);
  await page
    .getByLabel("组织与训练计划")
    .fill("合成网页训练计划，固定时间选拔与组织训练。");
  await page.getByRole("button", { name: "提交建队申请" }).click();
  await expect(
    page.getByRole("heading", { name: "建队申请已提交" }),
  ).toBeVisible();
  const context = await browser.newContext();
  try {
    const review = await context.newPage();
    await login(review, leader);
    await review.goto("/teams/manage");
    const reviewQueue = review.getByRole("region", { name: "待审核建队申请", exact: true });
    let card = reviewQueue.getByRole("article").filter({
      has: review.getByRole("heading", {
        name: `合成网页建队-${suffix}`,
        exact: true,
      }),
    });
    await card
      .getByLabel("审核意见（退回 / 未通过时必填）")
      .fill("补充训练时间");
    await card.getByRole("button", { name: "退回补充" }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    const own = page.locator("article").filter({
      has: page.getByRole("heading", {
        name: `合成网页建队-${suffix}`,
        exact: true,
      }),
    });
    await expect(own.getByText("退回补充", { exact: true })).toBeVisible();
    await own.getByRole("link", { name: "修改并重新提交" }).click();
    await expect(
      page.getByRole("heading", {
        name: "修改并重新提交建队申请",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByLabel("组织与训练计划")
      .fill("补充的合成训练计划，每周三固定晚间训练并定期选拔。");
    await page.getByRole("button", { name: "提交建队申请" }).click();
    await expect(
      page.getByRole("heading", { name: "建队申请已提交" }),
    ).toBeVisible();
    await review.reload();
    card = reviewQueue.getByRole("article").filter({
      has: review.getByRole("heading", {
        name: `合成网页建队-${suffix}`,
        exact: true,
      }),
    });
    await card.getByRole("button", { name: "批准建队" }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(own.getByText("已批准", { exact: true })).toBeVisible();
    await own.getByRole("link", { name: "进入代表队工作台" }).click();
    await expect(
      page.getByRole("link", { name: "建立新招新批次" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
test("工作台保存草稿后可按北京时间发布，申请人可提交问卷", async ({
  browser,
}) => {
  const establishment = await submitTeamEstablishment(p, manager, {
    gameID: game,
    title: "合成网页发布队",
    reason: "合成组织计划，负责选拔并安排训练。",
  });
  const approved = await decideTeamEstablishment(
    p,
    leader,
    establishment.id,
    "approved",
    "",
    establishment.updatedAt,
  );
  const teamID = Number(approved.team);
  const context = await browser.newContext({ timezoneId: "UTC" });
  const applicantContext = await browser.newContext();
  try {
    const page = await context.newPage();
    const applicant = await applicantContext.newPage();
    await login(page, manager);
    await login(applicant, participant);
    await page.goto(`/teams/manage/${teamID}`);
    await page.getByRole("link", { name: "建立新招新批次" }).click();

    const title = "合成网页正式招新";
    const editor = page.locator("#team-recruitment-editor");
    const cutoff = editor.getByLabel("报名截止时间", { exact: true });
    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });
    await editor.getByLabel("批次名称").fill(title);
    await expect(cutoff).toHaveValue("");
    await editor.getByRole("button", { name: "保存招新批次" }).click();
    await expect(card.getByText("草稿", { exact: true })).toBeVisible();
    const href = await card
      .getByRole("link", { name: "查看申请入口" })
      .getAttribute("href");
    expect(href).toMatch(/^\/teams\/recruitment\/\d+$/);
    const batchID = Number(href!.split("/").at(-1));
    await applicant.goto("/teams/recruitment");
    await expect(
      applicant.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);

    const draft = await p.findByID({
      collection: "team-recruitments",
      id: batchID,
      user: manager,
      overrideAccess: false,
      depth: 0,
    });
    await saveTeamRecruitment(p, manager, {
      teamID,
      id: batchID,
      revision: draft.updatedAt,
      title,
      status: "draft",
      form: { ...defaultTeamForm, enabled: false, closed: true },
    });
    await page.reload();
    await card.getByRole("link", { name: "编辑表单与窗口" }).click();
    await editor.getByLabel("批次状态").selectOption("open");
    const publish = editor.getByRole("button", { name: "发布招新", exact: true });
    await publish.click();
    await expect(cutoff).toBeFocused();

    await cutoff.fill("2020-01-01T12:00");
    await publish.click();
    await expect(editor.getByRole("alert")).toHaveText(
      "报名截止时间须晚于当前时间",
    );
    await expect(editor.getByLabel("批次名称")).toHaveValue(title);

    const deadline = new Date(Date.now() + 86400000);
    deadline.setUTCSeconds(0, 0);
    const beijingDeadline = new Date(deadline.getTime() + 8 * 3600000)
      .toISOString()
      .slice(0, 16);
    await cutoff.fill(beijingDeadline);
    await publish.click();
    await expect(card.getByText("招新开放", { exact: true })).toBeVisible();

    await applicant.reload();
    await applicant.getByRole("link", { name: title, exact: true }).click();
    await applicant.getByLabel(/游戏 ID \/ 游戏昵称/).fill("合成发布验证ID");
    await applicant.getByLabel(/擅长位置/).fill("合成位置");
    await applicant.getByLabel(/游戏、比赛经历/).fill("合成赛事经历");
    await applicant.getByLabel(/可参加训练的时间/).fill("合成周三晚上");
    await applicant.getByLabel(/一种联系方式/).fill("synthetic@example.invalid");
    await applicant.getByRole("button", { name: "核对并提交", exact: true }).click();
    await applicant.getByRole("button", { name: "提交入队申请", exact: true }).click();
    await expect(applicant.getByText("待人工审核", { exact: true })).toBeVisible();
    const response = await applicant.request.get(
      `/api/team-core?mode=recruitment&id=${batchID}`,
      { headers: origin },
    );
    expect(response.status()).toBe(200);
    expect((await response.json()).form).toMatchObject({
      enabled: true,
      closed: false,
      end: deadline.toISOString(),
    });

    await card.getByRole("link", { name: "编辑表单与窗口" }).click();
    await expect(cutoff).toHaveValue(beijingDeadline);
  } finally {
    await applicantContext.close();
    await context.close();
  }
});

test("本人草稿、提交、退回重提、人工录取、撤销与真实REST权限", async ({
  page,
  browser,
  request,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await login(page, participant);
  await page.goto(`/teams/recruitment/${batch}`);
  await page.getByLabel(/游戏 ID \/ 游戏昵称/).fill("合成浏览器游戏ID");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  const receiptHeader = page.locator("section").filter({
    has: page.getByRole("heading", { name: "我的入队申请", exact: true, level: 2 }),
  }).locator(":scope > header");
  await expect(receiptHeader.getByText(/^招新开放；申请编号 \d+$/)).toBeVisible();
  await expect(receiptHeader.getByText("草稿（尚未提交）", { exact: true })).toBeVisible();
  const draft = (
    await p.find({
      collection: "team-join-applications",
      user: participant,
      overrideAccess: false,
      where: { recruitment: { equals: batch } },
    })
  ).docs[0];
  await expect(
    p.findByID({
      collection: "team-join-applications",
      id: draft.id,
      user: manager,
      overrideAccess: false,
    }),
  ).rejects.toThrow();
  await page.getByLabel(/擅长位置/).fill("合成位置");
  await page.getByLabel(/游戏、比赛经历/).fill("合成赛事经历");
  await page.getByLabel(/可参加训练的时间/).fill("合成周三晚上");
  await page.getByLabel(/一种联系方式/).fill("synthetic@example.invalid");
  await page.getByRole("button", { name: "核对并提交", exact: true }).click();
  await page.getByRole("button", { name: "提交入队申请", exact: true }).click();
  await expect(receiptHeader.getByText(/^招新开放；申请编号 \d+$/)).toBeVisible();
  await expect(receiptHeader.getByText("待人工审核", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  const context = await browser.newContext(),
    outsider = await browser.newContext();
  try {
    const review = await context.newPage();
    await login(review, manager);
    await review.goto(`/teams/manage/${team}`);
    const card = review.locator("article").filter({
      has: review.getByRole("heading", {
        name: `合成浏览器招新批次 · ${participant.name}`,
        exact: true,
      }),
    });
    await card
      .getByLabel("审核意见（退回 / 未通过时必填）")
      .fill("请补充投入时间");
    await card.getByRole("button", { name: "退回补充" }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(receiptHeader.getByText(/^招新开放；申请编号 \d+$/)).toBeVisible();
    await expect(receiptHeader.getByText("退回补充", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "修改并重新提交", exact: true })
      .click();
    await page.getByLabel(/可参加训练的时间/).fill("合成每周三四晚间");
    await page.getByRole("button", { name: "核对并提交", exact: true }).click();
    await page
      .getByRole("button", { name: "提交入队申请", exact: true })
      .click();
    await expect(receiptHeader.getByText(/^招新开放；申请编号 \d+$/)).toBeVisible();
    await expect(receiptHeader.getByText("待人工审核", { exact: true })).toBeVisible();
    await review.reload();
    await card.getByRole("button", { name: "批准入队" }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(/已录取入队/)).toBeVisible();
    expect(
      (
        await p.findByID({
          collection: "users",
          id: participant.id,
          overrideAccess: true,
        })
      ).roles,
    ).toEqual(["member"]);
    const membership = await getActiveTeamMembership(p, {
      teamID: team,
      userID: participant.id,
    });
    expect(membership).not.toBeNull();
    const outside = await outsider.newPage();
    await login(outside, stranger);
    expect(
      (
        await outside.request.get(`/api/team-join-applications/${draft.id}`, {
          headers: origin,
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await outside.request.post("/api/team-core", {
          headers: origin,
          data: {
            operation: "decide-join",
            id: draft.id,
            decision: "approved",
            context: { system: true, teamCoreWrite: true },
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await outside.request.patch(`/api/team-memberships/${membership!.id}`, {
          headers: origin,
          data: {
            status: "active",
            context: { system: true, teamCoreWrite: true },
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.get(`/api/team-core?mode=recruitment&id=${batch}`, {
          headers: origin,
        })
      ).status(),
    ).toBe(401);
    await outsider.clearCookies();
    await login(outside, foreign);
    expect(
      (
        await outside.request.get(
          `/api/team-core?mode=applications&team=${team}`,
          { headers: origin },
        )
      ).status(),
    ).toBe(403);
    const memberRecord = review.getByRole("region", { name: "成员记录", exact: true })
      .getByRole("article").filter({
        has: review.getByRole("definition").filter({ hasText: new RegExp(`^${membership!.id}$`) }),
      });
    await memberRecord.locator("summary").filter({ hasText: /^管理成员关系$/ }).click();
    await memberRecord.getByLabel("撤销原因").fill("合成撤销审核");
    await memberRecord
      .getByRole("button", { name: "撤销本队成员关系", exact: true })
      .click();
    await expect(memberRecord.getByText("已撤销", { exact: true })).toBeVisible();
    expect(
      await getActiveTeamMembership(p, {
        teamID: team,
        userID: participant.id,
      }),
    ).toBeNull();
    await page.goto("/teams/recruitment");
    const ownMemberRecord = page.getByRole("region", { name: "我的代表队成员记录", exact: true })
      .getByRole("article").filter({
        has: page.getByText(`成员关系编号 ${membership!.id}`, { exact: true }),
      });
    await expect(ownMemberRecord.getByText("已撤销", { exact: true })).toBeVisible();
    await p.update({
      collection: "users",
      id: manager.id,
      user: leader,
      overrideAccess: false,
      data: { communityOffices: [] },
    });
    expect(
      (
        await review.request.get(
          `/api/team-core?mode=applications&team=${team}`,
          { headers: origin },
        )
      ).status(),
    ).toBe(403);
    expect((await review.goto(`/teams/manage/${team}`))?.status()).toBe(404);
    manager = await p.update({
      collection: "users",
      id: manager.id,
      user: leader,
      overrideAccess: false,
      data: {
        communityOffices: manager.communityOffices!.map((office) => ({
          ...office,
          status: "active",
        })),
      },
    });
  } finally {
    await context.close();
    await outsider.close();
  }
});
test("招新关闭、跨站拒绝和表单工作台四个视口", async ({ page, browser }) => {
  await login(page, manager);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/teams/manage/${team}?edit=${batch}`);
    await expect(
      page.getByRole("heading", { name: "编辑招新批次" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page
      .getByRole("button", { name: "预览填写效果", exact: true })
      .click();
    const dialog = page.locator("dialog.questionnaire-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "关闭预览", exact: true }).click();
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto(`/teams/manage/${team}`);
  const recruitmentCard = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "合成浏览器招新批次",
      exact: true,
    }),
  });
  await recruitmentCard.locator("summary").filter({ hasText: /^结束或归档本批次$/ }).click();
  await recruitmentCard
    .getByRole("button", { name: "关闭本轮招新", exact: true })
    .click();
  await expect(
    recruitmentCard.getByText("已关闭", { exact: true }),
  ).toBeVisible();
  await expect(recruitmentCard.getByText(/^招新已关闭；更新于/)).toBeVisible();
  const teamRecord = await p.findByID({
    collection: "teams",
    id: team,
    user: null,
    overrideAccess: false,
  });
  const archived = await page.request.post("/api/team-core", {
    headers: origin,
    data: {
      operation: "lifecycle",
      id: team,
      revision: teamRecord.updatedAt,
      status: "archived",
    },
  });
  expect(archived.status(), await archived.text()).toBe(200);
  const archivedTeam = (await archived.json()).result;
  await page.goto(`/teams/${teamRecord.slug}`);
  await expect(
    page.locator("main").getByText("历史归档", { exact: true }),
  ).toBeVisible();
  const unauthorizedRestore = await page.request.post("/api/team-core", {
    headers: origin,
    data: {
      operation: "lifecycle",
      id: team,
      revision: archivedTeam.updatedAt,
      status: "active",
    },
  });
  expect(unauthorizedRestore.status()).toBe(403);
  const highContext = await browser.newContext();
  try {
    const high = await highContext.newPage();
    await login(high, leader);
    const restored = await high.request.post("/api/team-core", {
      headers: origin,
      data: {
        operation: "lifecycle",
        id: team,
        revision: archivedTeam.updatedAt,
        status: "active",
      },
    });
    expect(restored.status(), await restored.text()).toBe(200);
    expect((await restored.json()).result.archived).toBe(false);
  } finally {
    await highContext.close();
  }
  const context = await browser.newContext();
  try {
    const applicant = await context.newPage();
    await login(applicant, stranger);
    const response = await applicant.request.get(
      `/api/team-core?mode=recruitment&id=${batch}`,
      { headers: origin },
    );
    const info = await response.json();
    expect(info.state).toBe("招新已关闭");
    expect(
      (
        await applicant.request.post("/api/team-core", {
          headers: origin,
          data: {
            operation: "save-join",
            id: batch,
            action: "submit",
            version: info.version,
            answers: {},
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await applicant.request.post("/api/team-core", {
          headers: { Origin: "https://example.invalid" },
          data: { operation: "leave", id: 1 },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await context.close();
  }
});

test("真实API表单版本冲突保留草稿，新批次录取后本人网页离队", async ({
  page,
  browser,
}) => {
  await login(page, participant);
  // This scenario can run alone or in a fresh worker after an earlier failure.
  // Close only its original synthetic batch through the revision-checked workflow.
  const initialBatch = await p.findByID({
    collection: "team-recruitments",
    id: batch,
    user: manager,
    overrideAccess: false,
    depth: 0,
  });
  if (initialBatch.status === "open") {
    const closed = await closeTeamRecruitment(
      p,
      manager,
      initialBatch.id,
      "closed",
      initialBatch.updatedAt,
    );
    expect(closed.status).toBe("closed");
  }
  let recruitment = await saveTeamRecruitment(p, manager, {
    teamID: team,
    title: "合成离队与版本批次",
    status: "open",
    form: {
      ...defaultTeamForm,
      end: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  const infoResponse = await page.request.get(
    `/api/team-core?mode=recruitment&id=${recruitment.id}`,
    { headers: origin },
  );
  expect(infoResponse.status(), await infoResponse.text()).toBe(200);
  const info = await infoResponse.json();
  const draftResponse = await page.request.post("/api/team-core", {
    headers: origin,
    data: {
      operation: "save-join",
      id: recruitment.id,
      action: "draft",
      version: info.version,
      answers: { gameID: "合成保留原稿" },
    },
  });
  expect(draftResponse.status(), await draftResponse.text()).toBe(200);
  const draft = (await draftResponse.json()).result;
  const context = await browser.newContext();
  try {
    const review = await context.newPage();
    await login(review, manager);
    const updatedForm = {
      ...info.form,
      questions: [
        ...info.form.questions,
        {
          id: "extension",
          label: "合成补充选拔说明",
          type: "text",
          required: true,
        },
      ],
    };
    const saved = await review.request.post("/api/team-core", {
      headers: origin,
      data: {
        operation: "save-recruitment",
        teamID: team,
        id: recruitment.id,
        revision: recruitment.updatedAt,
        title: recruitment.title,
        status: "open",
        form: updatedForm,
      },
    });
    expect(saved.status(), await saved.text()).toBe(200);
    recruitment = (await saved.json()).result;
    const oldWrite = await page.request.post("/api/team-core", {
      headers: origin,
      data: {
        operation: "save-join",
        id: recruitment.id,
        action: "submit",
        version: info.version,
        revision: draft.updatedAt,
        answers: {},
      },
    });
    expect(oldWrite.status()).toBe(409);
    const currentResponse = await page.request.get(
      `/api/team-core?mode=recruitment&id=${recruitment.id}`,
      { headers: origin },
    );
    const current = await currentResponse.json();
    expect(current.application.answers).toEqual({ gameID: "合成保留原稿" });
    const incomplete = await page.request.post("/api/team-core", {
      headers: origin,
      data: {
        operation: "save-join",
        id: recruitment.id,
        action: "submit",
        version: current.version,
        revision: draft.updatedAt,
        answers: {},
      },
    });
    expect(incomplete.status()).toBe(400);
    const submitted = await page.request.post("/api/team-core", {
      headers: origin,
      data: {
        operation: "save-join",
        id: recruitment.id,
        action: "submit",
        version: current.version,
        revision: draft.updatedAt,
        answers: {
          gameID: "合成保留原稿",
          position: "合成位置",
          experience: "合成经历",
          availability: "合成训练时间",
          contact: "synthetic@example.invalid",
          extension: "合成扩展回答",
        },
      },
    });
    expect(submitted.status(), await submitted.text()).toBe(200);
    const application = (await submitted.json()).result;
    const approved = await review.request.post("/api/team-core", {
      headers: origin,
      data: {
        operation: "decide-join",
        id: application.id,
        revision: application.updatedAt,
        decision: "approved",
        note: "",
      },
    });
    expect(approved.status(), await approved.text()).toBe(200);
    const membership = await getActiveTeamMembership(p, {
      teamID: team,
      userID: participant.id,
    });
    expect(membership).not.toBeNull();
    await page.goto("/teams/recruitment");
    const memberRecord = page.getByRole("region", { name: "我的代表队成员记录", exact: true })
      .getByRole("article").filter({
        has: page.getByText(`成员关系编号 ${membership!.id}`, { exact: true }),
      });
    await memberRecord.locator("summary").filter({ hasText: /^办理离队$/ }).click();
    await memberRecord
      .getByRole("button", { name: "办理本人离队", exact: true })
      .click();
    await expect(memberRecord.getByText("已离队", { exact: true })).toBeVisible();
    expect(
      await getActiveTeamMembership(p, {
        teamID: team,
        userID: participant.id,
      }),
    ).toBeNull();
  } finally {
    await context.close();
  }
});
