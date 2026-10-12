import "dotenv/config";
import { randomBytes } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { saveStaffBatch } from "../../src/lib/staff-recruitment";
import { defaultStaffForm } from "../../src/lib/staff-recruitment-model";
import { defaultTeamForm } from "../../src/lib/team-core";
import { getActiveTeamMembership } from "../../src/lib/team-memberships";
import { emptyTeamProfile } from "../../src/lib/team-profiles-model";

let p: Payload, high: User, manager: User, member: User, outsider: User, game: number, staffBatch: number, qaEvent: number, qaPost: number;
const actors: User[] = [], suffix = randomBytes(5).toString("hex"), password = randomBytes(24).toString("hex");
const origin = { Origin: "http://localhost:3000" };
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback only");
  p = await getPayload({ config, key: "club-integration-browser" });
  const actor = async (label: string, roles: User["roles"]) => {
    const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: label + "-" + suffix, email: label + "-" + suffix + "@example.invalid", password, roles } });
    actors.push(user); return user;
  };
  high = await actor("IntegrationHigh", ["president"]); manager = await actor("IntegrationManager", ["member"]);
  member = await actor("IntegrationMember", ["member"]); outsider = await actor("IntegrationOutsider", ["member"]);
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成跨模块社群", slug: "integration-" + suffix, _status: "published", demo: true } })).id;
  manager = await p.update({ collection: "users", id: manager.id, user: high, overrideAccess: false, data: { communityOffices: [{ game, status: "active", handleJoins: true, publishContent: true }] } });
  staffBatch = (await saveStaffBatch(p, high, null, "", { title: "合成独立骨干批次-" + suffix, state: "open", signupForm: defaultStaffForm, endAt: new Date(Date.now() + 86400000).toISOString() })).id;
  const signupForm = { enabled: true, questions: [{ id: "name", label: "合成预览称呼", type: "text", required: true }] };
  qaEvent = (await p.create({ collection: "events", overrideAccess: true, context: { system: true }, data: { title: "合成站点预览活动", slug: "integration-preview-" + suffix, game, _status: "published", demo: true, signupForm } })).id;
  qaPost = (await p.create({ collection: "community-posts", overrideAccess: false, user: manager, context: { manageSignupForm: true }, data: { title: "合成社群预览活动", body: "合成预览验收，无真实通知。", game, author: manager.id, category: "event", signupForm } })).id;
});
test.afterAll(async () => {
  if (!p) return;
  const memberships = game ? (await p.find({ collection: "team-memberships", overrideAccess: true, depth: 0, pagination: false, where: { game: { equals: game } } })).docs : [];
  if (memberships.length) await p.delete({ collection: "team-member-profiles", overrideAccess: true, where: { membership: { in: memberships.map(row => row.id) } } });
  if (game) for (const collection of ["team-memberships", "team-join-applications", "team-recruitments", "team-establishment-applications", "teams"] as const) await p.delete({ collection, overrideAccess: true, where: { game: { equals: game } } });
  if (staffBatch) { await p.delete({ collection: "staff-applications", overrideAccess: true, where: { batch: { equals: staffBatch } } }); await p.delete({ collection: "staff-batches", id: staffBatch, overrideAccess: true }); }
  if (game) for (const collection of ["event-signups", "events", "community-posts"] as const) await p.delete({ collection, overrideAccess: true, where: { game: { equals: game } } });
  await p.delete({ collection: "audit", overrideAccess: true, where: { or: [{ actor: { in: actors.map(actor => String(actor.id)) } }, { object: { in: actors.map(actor => "users:" + actor.id) } }] } });
  for (const actor of actors) await p.delete({ collection: "users", id: actor.id, overrideAccess: true, context: { system: true } });
  if (game) await p.delete({ collection: "games", id: game, overrideAccess: true });
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
      const starter = scope.locator("dialog.questionnaire-starter-dialog"); await starter.getByRole("button", { name: /^预览「/ }).first().click();
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
    for (const [label, escape] of [["预览填写效果", false], ["3 · 预览试填", true]] as const) {
      const trigger = builder.getByRole("button", { name: label, exact: true }); await trigger.click(); const dialog = builder.locator("dialog.questionnaire-dialog");
      await centered(dialog); if (escape) await page.keyboard.press("Escape"); else await dialog.getByRole("button", { name: "关闭预览", exact: true }).click();
      await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
    }
    const importTrigger = builder.getByRole("button", { name: /导入已有问卷/ }); await importTrigger.click();
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

test("骨干录用独立于入队；真实成立/招新/录取授本人简介，撤权及同ID重录不能复活旧展示授权", async ({ page, browser }) => {
  test.setTimeout(240000);
  const highContext = await browser.newContext(), managerContext = await browser.newContext(), otherContext = await browser.newContext();
  try {
    const leader = await highContext.newPage(), reviewer = await managerContext.newPage(), other = await otherContext.newPage();
    await login(page, member); await login(leader, high); await login(reviewer, manager); await login(other, outsider);
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
    const old = await (await page.request.get(profileURL)).json(), replay = { revision: old.own.profile.revision, membershipVersion: old.own.membershipVersion, profile: { ...emptyTeamProfile(), displayName: "合成跨模块队员", visible: true } };
    const relation = await p.findByID({ collection: "team-memberships", id: membership!.id, overrideAccess: true, depth: 0 });
    await operation(reviewer, { operation: "revoke", id: relation.id, revision: relation.updatedAt, note: "合成跨模块撤销" });
    expect((await (await other.request.get(profileURL)).json()).profiles).toEqual([]);
    expect((await page.request.put(profileURL, { headers: origin, data: replay })).status()).toBe(403);
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
    expect((await (await other.request.get(profileURL)).json()).profiles).toEqual([]);
    expect((await other.request.get("/api/team-core?mode=recruitment&id=" + recruitment.id, { headers: origin })).status()).toBe(404);
    await page.goto("/account"); await page.getByRole("link", { name: /我的代表队与入队申请/ }).click(); await expect(page).toHaveURL(/\/teams\/recruitment$/);
    await expect(page.getByRole("navigation", { name: "参与方式", exact: true }).getByRole("link", { name: "骨干招新", exact: true })).toHaveAttribute("href", "/join/staff");
  } finally { await Promise.all([highContext.close(), managerContext.close(), otherContext.close()]); }
});
