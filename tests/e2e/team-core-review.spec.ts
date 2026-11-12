import { browserTestOrigin } from "./browser-test-origin";
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { getPayload, type Payload } from "payload";
import { test, expect, type Page } from "@playwright/test";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import {
  submitTeamEstablishment,
  decideTeamEstablishment,
  saveTeamRecruitment,
  saveTeamJoinApplication,
  decideTeamJoinApplication,
  teamRecruitmentInfo,
  defaultTeamForm,
  changeTeamLifecycle,
} from "../../src/lib/team-core";
import {
  getActiveTeamMembership,
  listActiveTeamMemberships,
} from "../../src/lib/team-memberships";
let p: Payload,
  leader: User,
  manager: User,
  applicant: User,
  outsider: User,
  game: number,
  mainTeam: number;
const suffix = randomBytes(5).toString("hex"),
  password = randomBytes(24).toString("hex"),
  origin = { Origin: browserTestOrigin };
const form = {
  ...defaultTeamForm,
  end: new Date(Date.now() + 86400000).toISOString(),
};
const answers = {
  gameID: "合成历史游戏答案",
  position: "合成位置",
  experience: "合成经历",
  availability: "合成训练时间",
  contact: "synthetic@example.invalid",
};
async function createTeam(label: string) {
  const doc = await submitTeamEstablishment(p, manager, {
    gameID: game,
    title: `${label}-${suffix}`,
    reason: "合成复核队伍组织与训练安排，仅供隔离测试。",
  });
  return Number(
    (
      await decideTeamEstablishment(
        p,
        leader,
        doc.id,
        "approved",
        "",
        doc.updatedAt,
      )
    ).team,
  );
}
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
test.beforeAll(async () => {
  if (
    process.env.APP_ENV !== "development" ||
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Synthetic loopback only");
  p = await getPayload({ config, key: "team-core-review-browser" });
  const user = (name: string, roles: User["roles"]) =>
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
  leader = await user("ReviewHigh", ["president"]);
  manager = await user("ReviewManager", ["member"]);
  applicant = await user("ReviewApplicant", ["member"]);
  outsider = await user("ReviewOutsider", ["member"]);
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成独立复核社群",
        slug: `core-review-${suffix}`,
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
        { game, status: "active", handleJoins: true, publishContent: true },
      ],
    },
  });
  mainTeam = await createTeam("合成权限复核队");
  const batch = await saveTeamRecruitment(p, manager, {
    teamID: mainTeam,
    title: "合成权限复核批次",
    status: "open",
    form,
  });
  const info = await teamRecruitmentInfo(p, applicant, batch.id);
  const application = await saveTeamJoinApplication(p, applicant, batch.id, {
    action: "submit",
    version: info.version,
    answers,
  });
  await decideTeamJoinApplication(
    p,
    manager,
    application.id,
    "approved",
    "",
    application.updatedAt,
  );
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
  for (const user of [leader, manager, applicant, outsider])
    if (user)
      await p.delete({
        collection: "users",
        id: user.id,
        overrideAccess: true,
        context: { system: true },
      });
  if (game)
    await p.delete({ collection: "games", id: game, overrideAccess: true });
  await p.destroy();
});
test("既有teams REST归档后低权限恢复拒绝，过期revision和并发请求保持失效，高权限明确恢复", async ({
  page,
  browser,
}) => {
  await login(page, manager);
  const context = await browser.newContext();
  try {
    const high = await context.newPage();
    await login(high, leader);
    const previous = await p.findByID({
      collection: "teams",
      id: mainTeam,
      user: leader,
      overrideAccess: false,
    });
    const batches = (await p.find({ collection: "team-recruitments", user: leader, overrideAccess: false,
      where: { team: { equals: mainTeam } }, depth: 0 })).docs;
    expect(batches).toHaveLength(1); expect(batches[0].status).toBe("open");
    const response = await high.request.patch(`/api/teams/${mainTeam}`, {
      headers: origin,
      data: { archived: true },
    });
    expect(response.status(), await response.text()).toBe(200);
    const archived = (await response.json()).doc;
    expect(archived.teamStatus).toBe("archived");
    expect(archived.archived).toBe(true);
    expect((await p.findByID({ collection: "team-recruitments", id: batches[0].id, user: leader, overrideAccess: false })).status).toBe("closed");
    const attempts = await Promise.all(
      ["active", "resting"].map((status) =>
        page.request.post("/api/team-core", {
          headers: origin,
          data: {
            operation: "lifecycle",
            id: mainTeam,
            revision: archived.updatedAt,
            status,
          },
        }),
      ),
    );
    for (const result of attempts)
      expect(result.status(), await result.text()).toBe(403);
    expect(
      await getActiveTeamMembership(p, {
        teamID: mainTeam,
        userID: applicant.id,
      }),
    ).toBeNull();
    expect(await listActiveTeamMemberships(p, { teamID: mainTeam })).toEqual(
      [],
    );
    const stale = await high.request.post("/api/team-core", {
      headers: origin,
      data: {
        operation: "lifecycle",
        id: mainTeam,
        revision: previous.updatedAt,
        status: "active",
      },
    });
    expect(stale.status()).toBe(409);
    const restore = await high.request.post("/api/team-core", {
      headers: origin,
      data: {
        operation: "lifecycle",
        id: mainTeam,
        revision: archived.updatedAt,
        status: "active",
      },
    });
    expect(restore.status(), await restore.text()).toBe(200);
    expect((await restore.json()).result.archived).toBe(false);
    expect((await p.findByID({ collection: "team-recruitments", id: batches[0].id, user: leader, overrideAccess: false })).status).toBe("closed");
    expect(
      await getActiveTeamMembership(p, {
        teamID: mainTeam,
        userID: applicant.id,
      }),
    ).not.toBeNull();
    const reopen = async () => {
      const current = await p.findByID({ collection: "team-recruitments", id: batches[0].id, user: leader, overrideAccess: false });
      const result = await high.request.post("/api/team-core", { headers: origin, data: { operation: "save-recruitment", teamID: mainTeam,
        id: current.id, revision: current.updatedAt, title: current.title, status: "open", form } });
      expect(result.status(), await result.text()).toBe(200); return (await result.json()).result;
    };
    const opened = await reopen();
    const [archiving, publishing] = await Promise.all([
      high.request.patch(`/api/teams/${mainTeam}`, { headers: origin, data: { archived: true } }),
      high.request.post("/api/team-core", { headers: origin, data: { operation: "save-recruitment", teamID: mainTeam,
        id: opened.id, revision: opened.updatedAt, title: opened.title, status: "open", form } }),
    ]);
    expect(archiving.status(), await archiving.text()).toBe(200); expect([200, 409]).toContain(publishing.status());
    expect((await p.findByID({ collection: "team-recruitments", id: opened.id, user: leader, overrideAccess: false })).status).toBe("closed");
    expect((await high.request.patch(`/api/teams/${mainTeam}`, { headers: origin, data: { archived: false } })).status()).toBe(200);
    const again = await reopen();
    const [teamArchive, batchArchive] = await Promise.all([
      high.request.patch(`/api/teams/${mainTeam}`, { headers: origin, data: { archived: true } }),
      high.request.post("/api/team-core", { headers: origin, data: { operation: "close-recruitment", id: again.id,
        revision: again.updatedAt, status: "archived" } }),
    ]);
    expect(teamArchive.status(), await teamArchive.text()).toBe(200); expect([200, 409]).toContain(batchArchive.status());
    const closed = await p.findByID({ collection: "team-recruitments", id: again.id, user: leader, overrideAccess: false });
    expect(closed.status).toBe(batchArchive.status() === 200 ? "archived" : "closed");
    expect((await high.request.patch(`/api/teams/${mainTeam}`, { headers: origin, data: { archived: false } })).status()).toBe(200);
    expect((await p.findByID({ collection: "team-recruitments", id: again.id, user: leader, overrideAccess: false })).status).toBe(closed.status);
  } finally {
    await context.close();
  }
});
test("超过20条队伍和建队审核时，两套分页独立跨页并互相保留筛选", async ({
  page,
}) => {
  // Real workflow fixtures: 23 published teams and 21 pending proposals in this isolated game.
  for (let index = 0; index < 22; index++)
    await createTeam(`合成分页队${String(index).padStart(2, "0")}`);
  const titles: string[] = [];
  for (let index = 0; index < 21; index++) {
    const title = `合成分页待审${String(index).padStart(2, "0")}-${suffix}`;
    titles.push(title);
    await submitTeamEstablishment(p, manager, {
      gameID: game,
      title,
      reason: "合成分页审核队列的组织与训练计划。",
    });
  }
  await login(page, leader);
  await page.goto(`/teams/manage?game=${game}&page=1&reviewPage=1`);
  const teamLinks = page.getByRole("region", { name: "可管理代表队", exact: true })
    .locator('h3 > a[href^="/teams/manage/"]');
  const firstTeams = await teamLinks.allTextContents();
  expect(firstTeams).toHaveLength(20);
  await expect(
    page.getByRole("heading", { name: titles[0], exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: titles[20], exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "下一页建队申请", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: titles[20], exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: titles[0], exact: true }),
  ).toHaveCount(0);
  expect(await teamLinks.allTextContents()).toEqual(firstTeams);
  expect(new URL(page.url()).searchParams.get("page")).toBe("1");
  await page.getByRole("link", { name: "下一页代表队", exact: true }).click();
  await expect(teamLinks).toHaveCount(3);
  const secondTeams = await teamLinks.allTextContents();
  expect(secondTeams).not.toEqual(firstTeams);
  await expect(
    page.getByRole("heading", { name: titles[20], exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("reviewPage")).toBe("2");
  await page.getByRole("link", { name: "上一页建队申请", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: titles[0], exact: true }),
  ).toBeVisible();
  expect(await teamLinks.allTextContents()).toEqual(secondTeams);
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  expect(new URL(page.url()).searchParams.get("game")).toBe(String(game));
});
for (const mode of ["draft", "team-archived"] as const)
  test(`${mode}后本人网页和API读取旧snapshot且只读，隐藏当前配置及旁人均拒绝`, async ({
    page,
    browser,
    request,
  }) => {
    const team = await createTeam(`合成历史回执${mode}`),
      batch = await saveTeamRecruitment(p, manager, {
        teamID: team,
        title: "合成历史回执批次",
        status: "open",
        form,
      });
    const info = await teamRecruitmentInfo(p, outsider, batch.id);
    const application = await saveTeamJoinApplication(p, outsider, batch.id, {
      action: "draft",
      version: info.version,
      answers: { gameID: "合成旧草稿答案" },
    });
    const marker = `HIDDEN-CURRENT-${mode}-${suffix}`;
    await saveTeamRecruitment(p, manager, {
      teamID: team,
      id: batch.id,
      revision: batch.updatedAt,
      title: marker,
      status: mode === "draft" ? "draft" : "open",
      form: {
        ...form,
        intro: marker,
        questions: [
          ...form.questions,
          { id: "privateNew", label: marker, type: "text", required: true },
        ],
      },
    });
    if (mode === "team-archived") {
      const doc = await p.findByID({
        collection: "teams",
        id: team,
        user: leader,
        overrideAccess: false,
      });
      await changeTeamLifecycle(p, manager, team, "archived", doc.updatedAt);
    }
    await page.setViewportSize({ width: 360, height: 900 });
    await login(page, outsider);
    const endpoint = `/api/team-core?mode=recruitment&id=${batch.id}`,
      response = await page.request.get(endpoint, { headers: origin });
    expect(response.status(), await response.text()).toBe(200);
    const historical = await response.json();
    expect(historical.readOnly).toBe(true);
    expect(historical.state).toBe("历史申请只读");
    expect(historical.form.enabled).toBe(false);
    expect(historical.version).toBe(info.version);
    expect(historical.application.answers).toEqual({
      gameID: "合成旧草稿答案",
    });
    expect(JSON.stringify(historical)).not.toContain(marker);
    expect(historical).not.toHaveProperty("createdBy");
    expect(historical.application).not.toHaveProperty("reviewedBy");
    expect(
      (
        await page.request.get(`/api/team-recruitments/${batch.id}`, {
          headers: origin,
        })
      ).status(),
    ).toBe(404);
    await page.goto("/teams/recruitment");
    const ownReceipt = page.getByRole("region", { name: "我的入队申请", exact: true })
      .getByRole("article").filter({
        has: page.getByRole("heading", { name: application.title, exact: true }),
      }).filter({
        has: page.getByText(`申请编号 ${application.id}`, { exact: true }),
      });
    await expect(ownReceipt).toHaveCount(1);
    const receiptLink = ownReceipt.getByRole("link", { name: "查看回执 / 继续修改", exact: true });
    await expect(receiptLink).toHaveAttribute("href", `/teams/recruitment/${batch.id}`);
    await receiptLink.click();
    await expect(
      page.getByText("合成旧草稿答案", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/历史申请只读/)).toBeVisible();
    await expect(page.getByText(marker, { exact: false })).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /保存草稿|提交入队申请|修改申请|修改并重新提交/,
      }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
    for (const action of ["draft", "submit"])
      expect(
        (
          await page.request.post("/api/team-core", {
            headers: origin,
            data: {
              operation: "save-join",
              id: batch.id,
              action,
              version: historical.version,
              revision: application.updatedAt,
              answers,
            },
          })
        ).status(),
      ).toBe(409);
    const context = await browser.newContext();
    try {
      const stranger = await context.newPage();
      await login(stranger, applicant);
      expect(
        (await stranger.request.get(endpoint, { headers: origin })).status(),
      ).toBe(404);
      expect(
        (await stranger.goto(`/teams/recruitment/${batch.id}`))?.status(),
      ).toBe(404);
    } finally {
      await context.close();
    }
    expect((await request.get(endpoint, { headers: origin })).status()).toBe(
      401,
    );
  });
