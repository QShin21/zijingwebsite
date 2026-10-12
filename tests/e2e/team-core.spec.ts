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
  origin = { Origin: "http://localhost:3000" };
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
  await expect(page.getByRole("heading", { name: user.name })).toBeVisible();
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
    let card = review.locator("article").filter({
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
    card = review.locator("article").filter({
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
  await expect(page.getByText(/招新开放 · 草稿/)).toBeVisible();
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
  await expect(page.getByText(/招新开放 · 待人工审核/)).toBeVisible();
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
    await expect(page.getByText(/招新开放 · 退回补充/)).toBeVisible();
    await page
      .getByRole("button", { name: "修改并重新提交", exact: true })
      .click();
    await page.getByLabel(/可参加训练的时间/).fill("合成每周三四晚间");
    await page.getByRole("button", { name: "核对并提交", exact: true }).click();
    await page
      .getByRole("button", { name: "提交入队申请", exact: true })
      .click();
    await expect(page.getByText(/招新开放 · 待人工审核/)).toBeVisible();
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
    await review.getByLabel("撤销原因").fill("合成撤销审核");
    await review
      .getByRole("button", { name: "撤销本队成员关系", exact: true })
      .click();
    await expect(review.getByText(/已撤销/)).toBeVisible();
    expect(
      await getActiveTeamMembership(p, {
        teamID: team,
        userID: participant.id,
      }),
    ).toBeNull();
    await page.goto("/teams/recruitment");
    await expect(page.getByText(/关系编号.*已撤销/)).toBeVisible();
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
  await page.getByRole("button", { name: "关闭本轮招新", exact: true }).click();
  await expect(
    page.getByText("已关闭 · 招新已关闭", { exact: true }),
  ).toBeVisible();
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
    await page.goto("/teams/recruitment");
    await page
      .getByRole("button", { name: "办理本人离队", exact: true })
      .click();
    await expect(page.getByText(/关系编号.*已离队/)).toBeVisible();
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
