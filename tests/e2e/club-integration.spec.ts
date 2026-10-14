import { browserTestOrigin } from "./browser-test-origin";
import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { saveStaffBatch } from "../../src/lib/staff-recruitment";
import { defaultStaffForm } from "../../src/lib/staff-recruitment-model";
import { defaultTeamForm } from "../../src/lib/team-core";
import { getActiveTeamMembership } from "../../src/lib/team-memberships";
import { emptyTeamProfile } from "../../src/lib/team-profiles-model";

let p: Payload, high: User, manager: User, member: User, outsider: User, crossReviewer: User, game: number, otherGame: number, staffBatch: number, qaEvent: number, qaPost: number;
const actors: User[] = [], suffix = randomBytes(5).toString("hex"), password = randomBytes(24).toString("hex");
const origin = { Origin: browserTestOrigin };
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback only");
  p = await getPayload({ config, key: "club-integration-browser" });
  const actor = async (label: string, roles: User["roles"]) => {
    const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: label + "-" + suffix, email: label + "-" + suffix + "@example.invalid", password, roles } });
    actors.push(user); return user;
  };
  high = await actor("IntegrationHigh", ["president"]); manager = await actor("IntegrationManager", ["member"]);
  member = await actor("IntegrationMember", ["member"]); outsider = await actor("IntegrationOutsider", ["backbone"]); crossReviewer = await actor("IntegrationCrossReviewer", ["member"]);
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成跨模块社群", slug: "integration-" + suffix, _status: "published", demo: true } })).id;
  manager = await p.update({ collection: "users", id: manager.id, user: high, overrideAccess: false, data: { communityOffices: [{ game, status: "active", handleJoins: true, publishContent: true, reviewShowcase: true }] } });
  otherGame = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成跨社群审核范围", slug: "integration-other-" + suffix, _status: "published", demo: true } })).id;
  crossReviewer = await p.update({ collection: "users", id: crossReviewer.id, user: high, overrideAccess: false, data: { communityOffices: [{ game: otherGame, status: "active", reviewShowcase: true }] } });
  staffBatch = (await saveStaffBatch(p, high, null, "", { title: "合成独立骨干批次-" + suffix, state: "open", signupForm: defaultStaffForm, endAt: new Date(Date.now() + 86400000).toISOString() })).id;
  const signupForm = { enabled: true, questions: [{ id: "name", label: "合成预览称呼", type: "text", required: true }] };
  qaEvent = (await p.create({ collection: "events", overrideAccess: true, context: { system: true }, data: { title: "合成站点预览活动", slug: "integration-preview-" + suffix, game, _status: "published", demo: true, signupForm } })).id;
  qaPost = (await p.create({ collection: "community-posts", overrideAccess: false, user: manager, context: { manageSignupForm: true }, data: { title: "合成社群预览活动", body: "合成预览验收，无真实通知。", game, author: manager.id, category: "event", signupForm } })).id;
});

test.afterAll(async () => {
  if (!p) return;
  if (game) await p.delete({ collection: "team-honor-records", overrideAccess: true, where: { game: { equals: game } } });
  const memberships = game ? (await p.find({ collection: "team-memberships", overrideAccess: true, depth: 0, pagination: false, where: { game: { equals: game } } })).docs : [];
  if (memberships.length) await p.delete({ collection: "team-member-profiles", overrideAccess: true, where: { membership: { in: memberships.map(row => row.id) } } });
  if (game) for (const collection of ["team-memberships", "team-join-applications", "team-recruitments", "team-establishment-applications", "teams"] as const) await p.delete({ collection, overrideAccess: true, where: { game: { equals: game } } });
  if (staffBatch) { await p.delete({ collection: "staff-applications", overrideAccess: true, where: { batch: { equals: staffBatch } } }); await p.delete({ collection: "staff-batches", id: staffBatch, overrideAccess: true }); }
  if (game) for (const collection of ["event-signups", "events", "community-posts"] as const) await p.delete({ collection, overrideAccess: true, where: { game: { equals: game } } });
  await p.delete({ collection: "audit", overrideAccess: true, where: { or: [{ actor: { in: actors.map(actor => String(actor.id)) } }, { object: { in: actors.map(actor => "users:" + actor.id) } }] } });
  for (const actor of actors) await p.delete({ collection: "users", id: actor.id, overrideAccess: true, context: { system: true } });
  if (game) await p.delete({ collection: "games", id: game, overrideAccess: true });
  if (otherGame) await p.delete({ collection: "games", id: otherGame, overrideAccess: true });
  await p.destroy();
});

test("五类问卷入口双轴居中，短屏/滚动/关闭与Escape返回焦点，预览不产生报名", async ({ page }) => {
  test.setTimeout(240000); await login(page, high);
  const cases = [
    { path: `/activities/events/${qaEvent}/manage`, kind: "activity" },
    { path: `/activities/community-posts/${qaPost}/manage`, kind: "activity" },
    { path: `/community/integration-${suffix}/updates`, kind: "composer" },
    { path: "/staff/manage", kind: "create" },
    { path: "/staff/manage", kind: "staff" },
  ];
  for (const item of cases) for (const viewport of [{ width: 390, height: 480 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport); await page.goto(item.path);
    let scope = page.locator("main");
    if (item.kind === "composer") {
      scope = page.locator("details").filter({ has: page.getByText("发布活动与通知", { exact: true }) });
      await scope.locator(":scope > summary").click(); await scope.getByLabel("启用填写问卷报名", { exact: true }).check();
      await scope.getByRole("button", { name: /从模板开始/ }).click();
      const starter = scope.locator("dialog.questionnaire-starter-dialog"); await starter.getByRole("button", { name: "预览「活动报名」", exact: true }).click();
      await starter.getByRole("button", { name: "替换并进入编辑", exact: true }).click();
    } else if (item.kind === "create" || item.kind === "staff") {
      scope = page.locator("details").filter({ has: page.getByText(item.kind === "create" ? "创建骨干招新批次" : "配置批次：合成独立骨干批次-" + suffix, { exact: true }) });
      await scope.locator(":scope > summary").click();
    }
    const builder = scope.locator("section.signup-builder"); await expect(builder).toHaveCount(1);
    const centered = async (dialog: ReturnType<Page["locator"]>) => {
      await expect(dialog).toBeVisible(); const box = await dialog.boundingBox(); expect(box).not.toBeNull();
      expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(3);
      expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(3);
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      await dialog.evaluate(node => { node.scrollTop = 200; }); const scrolled = await dialog.boundingBox(); expect(scrolled!.x).toBe(box!.x); expect(scrolled!.y).toBe(box!.y);
    };
    for (const [label, escape] of [["预览填写效果", false], ["预览试填", true]] as const) {
      const trigger = builder.getByRole("button", { name: label, exact: true }); await trigger.click(); const dialog = builder.locator("dialog.questionnaire-dialog");
      await centered(dialog); if (escape) await page.keyboard.press("Escape"); else await dialog.getByRole("button", { name: "关闭预览", exact: true }).click();
      await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
    }
    const sourceTools = builder.locator("details.designer-source-tools");
    if ((await sourceTools.getAttribute("open")) === null)
      await sourceTools.locator(":scope > summary").click();
    const importTrigger = sourceTools.getByRole("button", { name: "导入已有问卷 导入文本或 JSON，检查后应用", exact: true }); await importTrigger.click();
    const importDialog = builder.locator("dialog.questionnaire-starter-dialog"); await centered(importDialog); await page.keyboard.press("Escape"); await expect(importTrigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
  for (const width of [360, 500, 768]) { await page.setViewportSize({ width, height: 900 }); await page.goto(`/activities/events/${qaEvent}/manage`);
    await page.getByRole("button", { name: "预览填写效果", exact: true }).click(); const box = await page.locator("dialog.questionnaire-dialog").boundingBox(); expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(3); await page.keyboard.press("Escape"); }
  expect((await p.count({ collection: "event-signups", overrideAccess: true, where: { game: { equals: game } } })).totalDocs).toBe(0);
});
async function login(page: Page, user: User) {
  const response = await page.request.post("/api/users/login", { headers: origin, data: { email: user.email, password } });
  expect(response.status(), await response.text()).toBe(200);
  await page.context().setExtraHTTPHeaders({ "Sec-Fetch-Site": "same-origin" });
}
async function operation(page: Page, data: Record<string, unknown>) {
  const response = await page.request.post("/api/team-core", { headers: origin, data });
  expect(response.status(), await response.text()).toBe(200); return (await response.json()).result;
}

test("骨干录用独立于入队；成立/招新/录取→简介opt-in→荣誉复审→撤权与同ID重录保持门禁", async ({ page, browser, request }) => {
  test.setTimeout(240000);
  const highContext = await browser.newContext(), managerContext = await browser.newContext(), otherContext = await browser.newContext(), crossContext = await browser.newContext();
  try {
    const leader = await highContext.newPage(), reviewer = await managerContext.newPage(), other = await otherContext.newPage(), cross = await crossContext.newPage();
    await login(page, member); await login(leader, high); await login(reviewer, manager); await login(other, outsider); await login(cross, crossReviewer);
    const staffURL = "/api/staff/batches/" + staffBatch + "/application";
    const staffInfo = await (await page.request.get(staffURL, { headers: origin })).json();
    const submitted = await page.request.post(staffURL, { headers: origin, data: { version: staffInfo.version, answers: { department: "执行部", name: "合成申请人", school: "合成院系年级", motivation: "合成参与动机", experience: "合成兴趣", time: "合成每周时段", contact: "integration@example.invalid" } } });
    expect(submitted.status()).toBe(200); const staff = (await submitted.json()).application;
    const accepted = await leader.request.post(staffURL, { headers: origin, data: { action: "review", id: staff.id, revision: staff.updatedAt, status: "accepted", feedback: "合成骨干录用反馈" } });
    expect(accepted.status()).toBe(200); const finalStaff = (await accepted.json()).application;
    const nativeStaff = await (await page.request.get("/api/miniapp/staff/" + staffBatch, { headers: origin })).json();
    expect(nativeStaff.application).toMatchObject({ id: finalStaff.id, status: "accepted", updatedAt: finalStaff.updatedAt });
    expect(nativeStaff.actions).toMatchObject({ submit: false, edit: false, withdraw: false });
    expect((await reviewer.request.get("/api/miniapp/staff/" + staffBatch + "?mode=review", { headers: origin })).status()).toBe(403);
    expect((await p.count({ collection: "team-memberships", overrideAccess: true, where: { member: { equals: member.id } } })).totalDocs).toBe(0);
    expect((await p.findByID({ collection: "users", id: member.id, overrideAccess: true })).roles).toEqual(["member"]);

    const application = await operation(reviewer, { operation: "establish", gameID: game, title: "合成跨模块代表队-" + suffix, reason: "合成选拔与训练安排，仅用于隔离验收。" });
    const establishment = await operation(leader, { operation: "decide-establishment", id: application.id, revision: application.updatedAt, decision: "approved", note: "" });
    const teamID = typeof establishment.team === "object" ? establishment.team.id : establishment.team;
    const profileURL = "/api/team-profiles/" + teamID;
    expect((await (await page.request.get(profileURL)).json()).own.eligible).toBe(false);
    const form = { ...defaultTeamForm, end: new Date(Date.now() + 86400000).toISOString() };
    const recruitment = await operation(reviewer, { operation: "save-recruitment", teamID, title: "合成跨模块队员招新", status: "open", form });
    const join = async (batchID: number) => {
      const info = await (await page.request.get("/api/team-core?mode=recruitment&id=" + batchID, { headers: origin })).json();
      const row = await operation(page, { operation: "save-join", id: batchID, action: "submit", version: info.version, answers: { gameID: "合成游戏昵称", position: "合成位置", experience: "合成经历", availability: "合成训练时间", contact: "team-integration@example.invalid" } });
      await operation(reviewer, { operation: "decide-join", id: row.id, revision: row.updatedAt, decision: "approved", note: "" });
      return row;
    };
    const ownJoin = await join(recruitment.id);
    const membership = await getActiveTeamMembership(p, { teamID, userID: member.id }); expect(membership).not.toBeNull();
    const nativeRecruitmentURL = "/api/miniapp/team/recruitment/" + recruitment.id;
    const nativeRecruitment = await page.request.get(nativeRecruitmentURL, { headers: origin });
    expect(nativeRecruitment.status()).toBe(200); expect(nativeRecruitment.headers()["cache-control"]).toContain("no-store");
    expect(await nativeRecruitment.json()).toMatchObject({ application: { id: ownJoin.id, status: "approved" }, actions: { draft: false, submit: false, edit: false } });
    expect((await page.request.get("/api/miniapp/team/" + teamID + "/workbench", { headers: origin })).status()).toBe(403);
    const nativeLogin = await p.login({ collection: "users", data: { email: member.email!, password } });
    expect(nativeLogin.token).toBeTruthy();
    const nativeCredential = { Authorization: "JWT " + nativeLogin.token };
    const nativeHub = await request.get("/api/miniapp/team", { headers: nativeCredential }); expect(nativeHub.status()).toBe(200);
    const nativeMemberships = (await nativeHub.json()).memberships.docs;
    expect(nativeMemberships).toEqual(expect.arrayContaining([expect.objectContaining({ teamID, status: "active" })]));
    expect(nativeMemberships.some((row: object) => "memberID" in row)).toBe(false);
    const qualified = await (await page.request.get(profileURL)).json(); expect(qualified.own.eligible).toBe(true); expect(qualified.own.profile).toBeNull();
    const team = await p.findByID({ collection: "teams", id: teamID, overrideAccess: true, depth: 0 });
    await page.goto("/teams/" + team.slug);
    const panel = page.locator("#team-members"); await panel.getByRole("button", { name: "编辑我的队内简介", exact: true }).click();
    await expect(panel.getByLabel("公开昵称", { exact: true })).toBeFocused();
    await panel.getByLabel("公开昵称", { exact: true }).fill("合成跨模块队员");
    await panel.getByLabel("在本代表队页面展示我的简介", { exact: true }).check();
    await panel.getByRole("button", { name: "预览简介", exact: true }).click();
    await panel.getByRole("button", { name: "确认保存简介", exact: true }).click();
    await expect(panel.getByRole("status").filter({ hasText: "简介已保存并选择展示" })).toBeVisible();
    const visible = await (await other.request.get(profileURL)).json(); expect(visible.profiles).toHaveLength(1);
    expect(Object.keys(visible.profiles[0]).sort()).toEqual(["id", "displayName", "position", "biography", "avatar"].sort());
    expect(JSON.stringify(visible)).not.toMatch(/team-integration@example|合成游戏昵称|applicant|membershipID|memberName|reviewNote/);
    await expect(page.getByRole("link", { name: "本队工作台", exact: true })).toHaveCount(0);
    const image = "data:image/png;base64," + (await sharp({ create: { width: 20, height: 20, channels: 3, background: "purple" } }).png().toBuffer()).toString("base64");
    const honorInput = { team: teamID, title: "合成跨模块历史荣誉", competition: "合成跨模块赛事", placing: "合成奖项", date: "2026-10-01", description: "合成隔离证明", images: [{ source: image, caption: "合成证据" }] };
    const honor = async (actor: Page, action: string, row?: { id: number; revision: number; submittedVersion: string }, input?: object, expected = row ? 200 : 201) => {
      const response = await actor.request.post("/api/team-honors" + (row ? "/" + row.id : ""), { headers: origin, data: { action, ...(row ? { revision: row.revision, submittedVersion: row.submittedVersion } : {}), ...(input ? { input } : {}) } });
      expect(response.status(), await response.text()).toBe(expected); return (await response.json()).record;
    };
    let history = await honor(page, "submit", undefined, honorInput);
    expect((await request.get("/api/team-honors/" + history.id)).status()).toBe(401);
    for (const actor of [other, cross]) {
      expect((await actor.request.get("/api/team-honors/" + history.id)).status()).toBe(404);
      await honor(actor, "approve", history, undefined, 404);
    }
    const nativeHonor = await request.get("/api/team-honors/" + history.id, { headers: nativeCredential }); expect(nativeHonor.status()).toBe(200);
    expect((await nativeHonor.json()).record.actions).toMatchObject({ edit: true, withdraw: true, reviewActions: [] });
    const nativeMine = await request.get(`/api/team-honors?view=mine&team=${teamID}&game=${game}`, { headers: nativeCredential }); expect(nativeMine.status()).toBe(200);
    expect((await nativeMine.json()).teams.map((row: { id: number }) => row.id)).toEqual([teamID]);
    expect((await reviewer.request.get("/api/team-honors/" + history.id)).status()).toBe(200);
    expect((await leader.request.get("/api/team-honors/" + history.id)).status()).toBe(200);
    await honor(page, "approve", history, undefined, 403);
    history = await honor(leader, "approve", history);
    const archiveURL = "/api/team-honor-archives/" + teamID, archivePage = "/community/integration-" + suffix + "/showcase/team-honors/" + teamID;
    expect((await request.get(archiveURL)).status()).toBe(200);
    let edited = await honor(page, "submit", undefined, { ...honorInput, title: "合成跨模块复审荣誉" });
    edited = await honor(reviewer, "approve", edited); const previous = { ...edited };
    edited = await honor(page, "submit", edited, { description: "合成批准后改稿，须重新审核" });
    expect(await (await request.get(archiveURL)).text()).not.toContain("合成跨模块复审荣誉");
    await honor(reviewer, "approve", previous, undefined, 409);
    await reviewer.goto("/teams/honors/" + edited.id + "?view=review&team=" + teamID + "&game=" + game);
    await reviewer.getByRole("button", { name: "批准荣誉", exact: true }).click();
    await expect(reviewer.locator(`[data-honor-record="${edited.id}"]`).getByRole("status")).toContainText("荣誉已批准");
    const reviewBack = new URL((await reviewer.getByRole("navigation", { name: "面包屑", exact: true }).getByRole("link", { name: "审核本社群荣誉", exact: true }).getAttribute("href"))!, browserTestOrigin).searchParams;
    expect(Object.fromEntries(reviewBack)).toEqual({ view: "review", team: String(teamID), game: String(game) });
    edited = (await (await page.request.get("/api/team-honors/" + edited.id)).json()).record;
    expect((await (await request.get(archiveURL)).json()).records).toHaveLength(2);
    await page.goto(archivePage); await expect(page.locator("[data-public-honor]")).toHaveCount(2);
    await page.goto("/community/integration-" + suffix + "/showcase"); await expect(page.locator('[data-team-honor-archive="' + teamID + '"]')).toHaveCount(1);
    edited = await honor(page, "submit", edited, { description: "合成离队前待审改稿" });
    const old = await (await page.request.get(profileURL)).json(), replay = { revision: old.own.profile.revision, membershipVersion: old.own.membershipVersion, profile: { ...emptyTeamProfile(), displayName: "合成跨模块队员", visible: true } };
    const relation = await p.findByID({ collection: "team-memberships", id: membership!.id, overrideAccess: true, depth: 0 });
    await operation(reviewer, { operation: "revoke", id: relation.id, revision: relation.updatedAt, note: "合成跨模块撤销" });
    expect((await (await other.request.get(profileURL)).json()).profiles).toEqual([]);
    expect((await page.request.put(profileURL, { headers: origin, data: replay })).status()).toBe(403);
    await honor(page, "save", edited, { description: "合成撤权后擅改" }, 403);
    await honor(page, "submit", undefined, honorInput, 403);
    await honor(reviewer, "approve", edited, undefined, 403);
    const revokedNativeHonor = await request.get("/api/team-honors/" + edited.id, { headers: nativeCredential }); expect(revokedNativeHonor.status()).toBe(200);
    expect((await revokedNativeHonor.json()).record.actions).toMatchObject({ edit: false, save: false, submit: false, withdraw: false, hide: false, reviewActions: [] });
    const afterExit = await (await request.get(archiveURL)).json(); expect(afterExit.records).toHaveLength(1); expect(afterExit.records[0].title).toBe("合成跨模块历史荣誉");
    await operation(reviewer, { operation: "close-recruitment", id: recruitment.id, revision: recruitment.updatedAt, status: "closed" });
    const second = await operation(reviewer, { operation: "save-recruitment", teamID, title: "合成再次录取新批次", status: "open", form });
    await join(second.id);
    const rejoined = await getActiveTeamMembership(p, { teamID, userID: member.id }); expect(rejoined!.id).toBe(membership!.id); expect(rejoined!.joinedAt).not.toBe(membership!.joinedAt);
    const renewed = await (await page.request.get(profileURL)).json(); expect(renewed.own.profile.visible).toBe(false); expect(renewed.profiles).toEqual([]); expect(renewed.own.membershipVersion).not.toBe(old.own.membershipVersion);
    expect((await page.request.put(profileURL, { headers: origin, data: replay })).status()).toBe(409);
    expect((await p.findByID({ collection: "users", id: member.id, overrideAccess: true })).roles).toEqual(["member"]);

    const archive = await leader.request.patch("/api/teams/" + teamID, { headers: origin, data: { archived: true } }); expect(archive.status()).toBe(200);
    const historical = await (await page.request.get("/api/team-core?mode=recruitment&id=" + recruitment.id, { headers: origin })).json();
    expect(historical).toMatchObject({ readOnly: true, state: "历史申请只读", application: { id: ownJoin.id } });
    const nativeHistorical = await request.get(nativeRecruitmentURL, { headers: nativeCredential }); expect(nativeHistorical.status()).toBe(200);
    expect(await nativeHistorical.json()).toMatchObject({ readOnly: true, application: { id: ownJoin.id }, actions: { draft: false, submit: false, edit: false } });
    expect((await other.request.get(nativeRecruitmentURL, { headers: origin })).status()).toBe(404);
    expect((await request.get(nativeRecruitmentURL)).status()).toBe(401);
    expect((await (await other.request.get(profileURL)).json()).profiles).toEqual([]);
    expect((await request.get(archiveURL)).status()).toBe(404);
    expect((await other.request.get("/api/team-core?mode=recruitment&id=" + recruitment.id, { headers: origin })).status()).toBe(404);
    await page.goto("/account");
    await page
      .getByRole("region", { name: "我的代表队", exact: true })
      .getByRole("link", { name: "成员记录与入队申请", exact: true })
      .click();
    await expect(page).toHaveURL(/\/teams\/recruitment$/);
    await expect(page.locator("main").getByRole("link", { name: "了解骨干招新", exact: true })).toHaveAttribute("href", "/join/staff");
  } finally { await Promise.all([highContext.close(), managerContext.close(), otherContext.close(), crossContext.close()]); }
});

test("荣誉本人分页保留队伍和社群；断网与丢响应保留附件，并先核对已写入结果", async ({ page, browser }) => {
  test.setTimeout(180000);
  const highContext = await browser.newContext(), managerContext = await browser.newContext();
  try {
    const leader = await highContext.newPage(), reviewer = await managerContext.newPage();
    await login(page, member); await login(leader, high); await login(reviewer, manager);
    const proposal = await operation(reviewer, { operation: "establish", gameID: game, title: "合成荣誉分页恢复队伍-" + suffix, reason: "合成分页与网络恢复验收" });
    const decision = await operation(leader, { operation: "decide-establishment", id: proposal.id, revision: proposal.updatedAt, decision: "approved", note: "" });
    const teamID = typeof decision.team === "object" ? decision.team.id : decision.team;
    const batch = await operation(reviewer, { operation: "save-recruitment", teamID, title: "合成恢复测试招新", status: "open", form: { ...defaultTeamForm, end: new Date(Date.now() + 86400000).toISOString() } });
    const info = await (await page.request.get("/api/team-core?mode=recruitment&id=" + batch.id, { headers: origin })).json();
    const application = await operation(page, { operation: "save-join", id: batch.id, action: "submit", version: info.version, answers: { gameID: "合成恢复玩家", position: "合成位置", experience: "合成经历", availability: "合成时段", contact: "synthetic-recovery@example.invalid" } });
    await operation(reviewer, { operation: "decide-join", id: application.id, revision: application.updatedAt, decision: "approved", note: "" });
    for (let index = 0; index < 9; index++) {
      const response = await page.request.post("/api/team-honors", { headers: origin, data: { action: "save", input: { team: teamID, title: "合成分页记录 " + index } } }); expect(response.status()).toBe(201);
    }
    const scope = `view=mine&team=${teamID}&game=${game}`, url = "/teams/honors?" + scope;
    await page.goto(url); await expect(page.locator("[data-honor-record]")).toHaveCount(8);
    const next = page.getByRole("navigation", { name: "内容分页", exact: true }).getByRole("link", { name: "下一页 →", exact: true });
    const nextQuery = new URL((await next.getAttribute("href"))!, browserTestOrigin).searchParams;
    expect(Object.fromEntries(nextQuery)).toEqual({ page: "2", view: "mine", team: String(teamID), game: String(game) });
    await next.click(); await expect(page.locator("[data-honor-record]")).toHaveCount(1);
    await page.locator("[data-honor-record] h3 a").click();
    const back = page.getByRole("navigation", { name: "面包屑", exact: true }).getByRole("link", { name: "我的荣誉记录", exact: true });
    expect(Object.fromEntries(new URL((await back.getAttribute("href"))!, browserTestOrigin).searchParams)).toEqual({ page: "2", view: "mine", team: String(teamID), game: String(game) });
    await back.click(); await expect(page.locator("[data-honor-record]")).toHaveCount(1);
    await page.goto(url.replace("game=" + game, "game=" + otherGame));
    await expect(page.locator("[data-honor-record]")).toHaveCount(0); await expect(page.locator("[data-honor-editor]")).toHaveCount(0);
    await page.goto(url);
    const editor = page.locator("[data-honor-editor]"), title = "合成发送前断网-" + suffix;
    await editor.getByLabel("荣誉标题", { exact: true }).fill(title);
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "purple" } }).png().toBuffer();
    await editor.getByLabel("添加证据图片（每份 2 MB，最多 6 份）", { exact: true }).setInputFiles({ name: "synthetic-recovery.png", mimeType: "image/png", buffer: png });
    await editor.getByLabel(/新证据 1 说明/).fill("合成断网附件保留");
    let intercepted = 0;
    const abortBefore = async (route: import("@playwright/test").Route) => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) { intercepted++; await route.abort("failed"); } else await route.continue();
    };
    await page.route("**/teams/honors**", abortBefore); await editor.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(editor.getByRole("alert")).toContainText("提交结果尚未确认"); expect(intercepted).toBe(1);
    await expect(editor.getByLabel("荣誉标题", { exact: true })).toHaveValue(title); await expect(editor.getByLabel(/新证据 1 说明/)).toHaveValue("合成断网附件保留");
    await expect(editor.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
    expect((await (await page.request.get("/api/team-honors?" + scope)).json()).totalDocs).toBe(9);
    await page.unroute("**/teams/honors**", abortBefore);
    await editor.getByLabel("已核对本人记录，确认本次未保存", { exact: true }).check();
    await editor.getByRole("button", { name: "保存草稿", exact: true }).click(); await expect(page.locator("main").getByRole("status").filter({ hasText: /^草稿已保存/ })).toContainText("草稿已保存");
    const savedID = Number(new URL(page.url()).pathname.split("/").pop());
    const saved = await p.findByID({ collection: "team-honor-records", id: savedID, overrideAccess: true, depth: 0 });
    expect(saved.images).toHaveLength(1); expect(saved.images).toMatchObject([{ caption: "合成断网附件保留" }]);
    // A member can belong to two active teams. An uncertain result must keep
    // the submitted team's lookup even when the editor later selects the other.
    const secondProposal = await operation(reviewer, { operation: "establish", gameID: game, title: "合成恢复队伍B-" + suffix, reason: "合成双队伍恢复范围验收" });
    const secondDecision = await operation(leader, { operation: "decide-establishment", id: secondProposal.id, revision: secondProposal.updatedAt, decision: "approved", note: "" });
    const secondTeam = typeof secondDecision.team === "object" ? secondDecision.team.id : secondDecision.team;
    const secondBatch = await operation(reviewer, { operation: "save-recruitment", teamID: secondTeam, title: "合成第二队招新", status: "open", form: { ...defaultTeamForm, end: new Date(Date.now() + 86400000).toISOString() } });
    const secondInfo = await (await page.request.get("/api/team-core?mode=recruitment&id=" + secondBatch.id, { headers: origin })).json();
    const secondApplication = await operation(page, { operation: "save-join", id: secondBatch.id, action: "submit", version: secondInfo.version, answers: { gameID: "合成第二队玩家", position: "合成位置", experience: "合成经历", availability: "合成时段", contact: "synthetic-recovery@example.invalid" } });
    await operation(reviewer, { operation: "decide-join", id: secondApplication.id, revision: secondApplication.updatedAt, decision: "approved", note: "" });
    await page.goto("/teams/honors?view=mine&game=" + game); const uncertainTitle = "合成已写入但丢响应-" + suffix;
    await editor.getByRole("combobox", { name: "所属有效代表队", exact: true }).selectOption(String(teamID));
    await editor.getByLabel("荣誉标题", { exact: true }).fill(uncertainTitle);
    await editor.getByLabel("添加证据图片（每份 2 MB，最多 6 份）", { exact: true }).setInputFiles({ name: "synthetic-uncertain.png", mimeType: "image/png", buffer: png });
    await editor.getByLabel(/新证据 1 说明/).fill("合成丢响应附件保留");
    const loseResponse = async (route: import("@playwright/test").Route) => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) { await route.fetch({ maxRedirects: 0 }); await route.abort("failed"); } else await route.continue();
    };
    await page.route("**/teams/honors**", loseResponse); await editor.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(editor.getByRole("alert")).toContainText("提交结果尚未确认"); await expect(editor.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
    await expect(editor.getByLabel("荣誉标题", { exact: true })).toHaveValue(uncertainTitle); await expect(editor.getByLabel(/新证据 1 说明/)).toHaveValue("合成丢响应附件保留");
    await page.unroute("**/teams/honors**", loseResponse);
    await editor.getByRole("combobox", { name: "所属有效代表队", exact: true }).selectOption(String(secondTeam));
    expect(new URL((await editor.getByRole("link", { name: "查看本人荣誉记录", exact: true }).getAttribute("href"))!, browserTestOrigin).searchParams.get("team")).toBe(String(teamID));
    const checkPagePromise = page.context().waitForEvent("page"); await editor.getByRole("link", { name: "查看本人荣誉记录", exact: true }).click();
    const checkPage = await checkPagePromise; await expect(checkPage.getByRole("link", { name: uncertainTitle, exact: true })).toBeVisible();
    expect((await (await page.request.get("/api/team-honors?" + scope)).json()).totalDocs).toBe(11); await checkPage.close();
    await expect(editor.getByRole("button", { name: "保存草稿", exact: true })).toBeDisabled();
  } finally { await Promise.all([highContext.close(), managerContext.close()]); }
});
