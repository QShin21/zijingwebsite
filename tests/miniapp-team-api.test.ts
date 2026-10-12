import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "payload";
import type { TeamRecruitment } from "../src/payload-types";
import { defaultTeamForm, normalizeTeamForm, teamRecruitmentState } from "../src/lib/team-core";
import { positiveID } from "../src/lib/team-memberships";
const mocked = vi.hoisted(() => ({ cms: vi.fn(), info: vi.fn() }));
vi.mock("../src/lib/content", () => ({ cms: mocked.cms }));
vi.mock("../src/lib/team-core", async original => ({ ...await original<typeof import("../src/lib/team-core")>(), teamRecruitmentInfo: mocked.info }));
vi.mock("../src/app/(frontend)/account/actions", () => ({ beginRegistrationAction: vi.fn(), registerAction: vi.fn() }));
vi.mock("../src/lib/verification", () => ({ schoolEmail: vi.fn(), validPassword: vi.fn(), issueCode: vi.fn(), consumeCode: vi.fn() }));
import { GET, POST } from "../src/app/(frontend)/api/miniapp/[...path]/route";

const stamp = "2026-10-12T08:00:00.000Z";
const member = { id: 7, name: "合成队员", roles: ["member"], accountStatus: "active", email: "self@example.invalid", collection: "users",
  communityOffices: [] as { game: number; status: string; handleJoins?: boolean; publishContent?: boolean }[], createdAt: stamp, updatedAt: stamp };
const manager = { ...member, communityOffices: [{ game: 11, status: "active", handleJoins: true }] };
const president = { ...member, roles: ["president"] };
const form = normalizeTeamForm({ ...defaultTeamForm, end: "2099-01-01T00:00:00Z" });
const answers = { gameID: "合成游戏昵称", position: "合成方向", experience: "合成经历", availability: "合成时间", contact: "self-contact@example.invalid" };
const baseTeam = { id: 41, title: "合成代表队", game: 11, teamStatus: "active", establishmentApplication: 15, _status: "published", archived: false, updatedAt: stamp };
const baseRecruitment = { id: 21, title: "合成招新批次", team: 41, game: 11, status: "open" as TeamRecruitment["status"], signupForm: form, updatedAt: stamp, createdAt: stamp, createdBy: 8 };
const baseApplication = { id: 31, title: "合成入队申请", team: 41, game: 11, recruitment: 21, applicant: 7, status: "pending", formVersion: "form-v1",
  formSnapshot: form, answers, requestKey: "private-application-key", reviewNote: "合成本人反馈", createdAt: stamp, updatedAt: stamp };
const baseMembership = { id: 61, title: "合成本人关系", team: 41, game: 11, member: 7, status: "revoked", joinedAt: stamp, leftAt: null, revokedAt: stamp,
  updatedAt: stamp, membershipKey: "private-membership-key", sourceApplication: 31, grantedBy: 8, revocationReason: "private-note" };
const baseEstablishment = { id: 15, title: "合成建队申请", game: 11, applicant: 7, reason: "合成组织与训练计划", status: "approved", team: 41,
  requestKey: "private-establishment-key", reviewNote: null, createdAt: stamp, updatedAt: stamp };
let fresh: typeof member;
let p: Record<string, ReturnType<typeof vi.fn>>;
let games: Record<string, unknown>[], teams: typeof baseTeam[], recruitments: typeof baseRecruitment[], applications: typeof baseApplication[], memberships: typeof baseMembership[], establishments: typeof baseEstablishment[];
const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });
const get = (path: string, query = "") => GET(new Request("https://home.thuzijing.top/api/miniapp/" + path + query,
  { headers: { authorization: "JWT synthetic-old-president" } }), context(path));
type Where = Record<string, unknown>;
function matches(row: Record<string, unknown>, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([field, condition]) => {
    if (field === "and") return (condition as Where[]).every(part => matches(row, part));
    const value = positiveID(row[field]) ?? row[field], op = condition as Record<string, unknown>;
    return !("equals" in op && value !== op.equals || "not_equals" in op && value === op.not_equals || "in" in op && !(op.in as unknown[]).includes(value));
  });
}
beforeEach(() => {
  vi.clearAllMocks(); fresh = { ...member, communityOffices: [] };
  games = [{ id: 11, title: "合成社群", _status: "published", archived: false }, { id: 12, title: "其他社群", _status: "published", archived: false }];
  teams = [{ ...baseTeam }]; recruitments = [{ ...baseRecruitment }]; applications = [{ ...baseApplication }]; memberships = [{ ...baseMembership }]; establishments = [{ ...baseEstablishment }];
  p = { auth: vi.fn().mockResolvedValue({ user: president }), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findByID: vi.fn().mockImplementation(async ({ collection, id }) => {
      if (collection === "users") return id === fresh.id ? fresh : { ...member, id, accountStatus: "active" };
      const records = collection === "teams" ? teams : collection === "games" ? games : collection === "team-recruitments" ? recruitments : establishments;
      const row = records.find(row => row.id === id); if (!row) throw new APIError("合成记录不存在", 404); return row;
    }),
    find: vi.fn().mockImplementation(async ({ collection, where, page = 1, limit = 20 }) => {
      const records = collection === "games" ? games : collection === "teams" ? teams : collection === "team-recruitments" ? recruitments
        : collection === "team-join-applications" ? applications : collection === "team-memberships" ? memberships : establishments;
      const rows = records.filter(row => matches(row, where));
      return { docs: rows.slice(0, limit), page, totalPages: 5, totalDocs: rows.length, hasNextPage: true };
    }) };
  mocked.cms.mockResolvedValue(p);
  mocked.info.mockReset().mockImplementation(async (_p, actor, id) => {
    const doc = recruitments.find(row => row.id === id); if (!doc) throw new APIError("批次不存在", 404);
    const currentForm = normalizeTeamForm(doc.signupForm);
    return { doc, form: currentForm, version: "form-v1", state: teamRecruitmentState(doc, currentForm),
      own: applications.find(row => row.recruitment === id && positiveID(row.applicant) === actor.id) ?? null, readOnly: false };
  });
});
afterEach(() => vi.clearAllMocks());

describe("代表队只读桥接的当前身份与私有边界", () => {
  it("匿名和已停用账号均不能查询，HTTP角色/上下文不授权", async () => {
    p.auth.mockResolvedValueOnce({ user: null }); expect((await get("team")).status).toBe(401);
    expect(p.find).not.toHaveBeenCalled(); fresh.accountStatus = "suspended";
    expect((await get("team", "?actor=president&context[system]=true")).status).toBe(403);
    expect(p.find).not.toHaveBeenCalled(); expect(mocked.info).not.toHaveBeenCalled();
  });
  it("旧会话角色被刷新，非本社群管理员不能取得成员名单或审核答案", async () => {
    expect((await get("team/41/workbench")).status).toBe(403); expect(p.find).not.toHaveBeenCalled();
    fresh = { ...manager, communityOffices: [{ game: 12, status: "active", handleJoins: true }] };
    expect((await get("team/41/workbench")).status).toBe(403);
    fresh = { ...manager, communityOffices: [{ game: 11, status: "revoked", handleJoins: true }] };
    expect((await get("team/41/workbench")).status).toBe(403);
    fresh = { ...manager, communityOffices: [{ game: 11, status: "active", publishContent: true }] };
    expect((await get("team/41/workbench")).status).toBe(403);
    expect(p.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: "users", id: member.id, overrideAccess: true,
      select: expect.objectContaining({ roles: true, accountStatus: true, communityOffices: true }) }));
  });
  it("hub本人申请与membership同时使用明确owner条件和ACL，剔除他人私密数据及唯一键", async () => {
    applications.push({ ...baseApplication, id: 32, applicant: 8, answers: { ...answers, contact: "other-private@example.invalid" } });
    memberships.push({ ...baseMembership, id: 62, member: 8, title: "其他人私有名单", membershipKey: "other-private-key" });
    const response = await get("team", "?page=2&ownPage=3&membersPage=4&teamsPage=5"), data = await response.json();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(data.ownApplications.docs).toHaveLength(1); expect(data.memberships.docs).toHaveLength(1); expect(data.managedTeams.docs).toEqual([]);
    expect(data.actions).toEqual({ establish: false, reviewEstablishments: false });
    expect(data).toMatchObject({ recruitments: { page: 2 }, ownApplications: { page: 3 }, memberships: { page: 4 }, managedTeams: { page: 5 } });
    expect(JSON.stringify(data)).not.toMatch(/private-application-key|private-membership-key|other-private|其他人私有名单|self-contact/);
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "team-join-applications", user: expect.objectContaining({ roles: ["member"] }),
      overrideAccess: false, depth: 0, where: { applicant: { equals: member.id } }, page: 3 }));
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "team-memberships", overrideAccess: false, depth: 0,
      where: { member: { equals: member.id } }, page: 4 }));
  });
  it("只新增GET且不代理writes，未知POST和原写路径均保持独立", async () => {
    const response = await POST(new Request("https://home.thuzijing.top/api/miniapp/team", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "decide-join", decision: "approved", user: president, context: { teamCoreWrite: true } }) }), context("team"));
    expect(response.status).toBe(404); expect(mocked.cms).not.toHaveBeenCalled();
    expect(p.create).not.toHaveBeenCalled(); expect(p.update).not.toHaveBeenCalled();
  });
});

describe("本人申请动作与历史成员回执", () => {
  it("详情重用core info与receipt，保留原答案版本并只查询本人成员关系", async () => {
    const response = await get("team/recruitment/21"), data = await response.json();
    expect(data).toMatchObject({ title: baseRecruitment.title, teamID: 41, recruitmentID: 21, state: "招新开放", version: "form-v1",
      actions: { draft: true, submit: true, edit: true, withdraw: true, review: false, workbench: false } });
    expect(data.form).toEqual(form); expect(data.application.formSnapshot).toEqual(form); expect(data.application.answers).toEqual(answers);
    expect(data.application).not.toHaveProperty("requestKey"); expect(data.membership.actions.leave).toBe(false);
    expect(mocked.info).toHaveBeenCalledWith(p, expect.objectContaining({ id: member.id, roles: ["member"] }), 21);
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "team-memberships", overrideAccess: false,
      where: { and: [{ member: { equals: member.id } }, { team: { equals: 41 } }] } }));
    expect(p.find.mock.calls.filter(([args]) => args.collection === "team-memberships").every(([args]) => args.overrideAccess === false)).toBe(true);
  });
  it("截止关闭保留撤回，归档隐藏后的本人历史禁写且leave仍保留", async () => {
    recruitments[0] = { ...baseRecruitment, signupForm: normalizeTeamForm({ ...form, end: "2020-01-01T00:00:00Z" }) };
    memberships[0] = { ...baseMembership, status: "active" };
    let data = await (await get("team/recruitment/21")).json();
    expect(data.state).toBe("招新已截止"); expect(data.actions).toMatchObject({ draft: false, submit: false, edit: false, withdraw: true });
    expect(data.membership.actions.leave).toBe(true);
    recruitments[0] = { ...baseRecruitment, status: "archived" }; teams[0] = { ...baseTeam, teamStatus: "archived", archived: true };
    mocked.info.mockResolvedValue({ doc: { id: 21, title: baseApplication.title, team: 41, game: 11 },
      form: { ...form, enabled: false, closed: true }, version: baseApplication.formVersion, state: "历史申请只读", own: applications[0], readOnly: true });
    data = await (await get("team")).json();
    expect(data.ownApplications.docs[0].actions).toEqual({ view: true, edit: false, withdraw: false });
    expect(data.memberships.docs[0].actions.leave).toBe(true);
    expect(data.recruitments.docs[0].state).toBe("队伍未开放招新");
  });
  it("已录取/拒绝、在队或跨批次未完成申请禁用保存提示，撤回重提仍依窗口", async () => {
    applications[0] = { ...baseApplication, status: "approved" };
    expect((await (await get("team/recruitment/21")).json()).actions).toMatchObject({ draft: false, submit: false, edit: false, withdraw: false });
    applications[0] = { ...baseApplication, status: "rejected" };
    expect((await (await get("team/recruitment/21")).json()).actions.submit).toBe(false);
    applications[0] = { ...baseApplication, status: "withdrawn" };
    expect((await (await get("team/recruitment/21")).json()).actions).toMatchObject({ draft: true, submit: true, edit: true, withdraw: false });
    memberships[0].status = "active";
    expect((await (await get("team/recruitment/21")).json()).actions.submit).toBe(false);
    memberships[0].status = "revoked"; applications.push({ ...baseApplication, id: 35, recruitment: 22, status: "returned" });
    expect((await (await get("team/recruitment/21")).json()).actions.submit).toBe(false);
  });
  it("core info返回拒绝时不绕ACL读取当前批次，本人hub历史不猜测撤回能力", async () => {
    mocked.info.mockRejectedValue(new APIError("该批次当前不可读取", 404));
    expect((await get("team/recruitment/21")).status).toBe(404);
    const data = await (await get("team")).json();
    expect(data.ownApplications.docs[0].actions).toEqual({ view: true, edit: false, withdraw: false });
    expect(p.findByID.mock.calls.some(([args]) => args.collection === "team-recruitments" && args.overrideAccess === true)).toBe(false);
  });
  it.each(["draft", "pending", "returned"])("hidden历史%s只投影本人快照，服务器readOnly优先遮蔽全部申请/审核动作", async status => {
    fresh = manager; memberships[0].status = "active"; applications[0].status = status;
    const snapshot = normalizeTeamForm({ ...form, title: "合成旧版表单", end: "2020-01-01T00:00:00Z" });
    applications[0].formSnapshot = snapshot;
    recruitments[0].signupForm = normalizeTeamForm({ ...form, title: "hidden-current-private-form", questions: [...form.questions,
      { id: "hidden-current", label: "hidden-current-private-question", type: "text", required: false, options: [] }] });
    mocked.info.mockResolvedValue({ doc: { id: 21, title: baseApplication.title, team: 41, game: 11 },
      form: { ...snapshot, enabled: false, closed: true }, version: baseApplication.formVersion, state: "历史申请只读", own: applications[0], readOnly: true });
    const response = await get("team/recruitment/21"), data = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(data).toMatchObject({ title: baseApplication.title, readOnly: true, readonly: true, version: baseApplication.formVersion,
      state: "历史申请只读", form: { enabled: false, closed: true }, application: { id: 31, status, formSnapshot: snapshot }, membership: { actions: { leave: true } } });
    expect(data.actions).toEqual({ draft: false, submit: false, edit: false, withdraw: false, review: false, workbench: false });
    expect(data.historyNote).toContain("本人原提交的表单快照"); expect(JSON.stringify(data)).not.toMatch(/hidden-current|private-application-key|private-membership-key/);
    expect(p.find.mock.calls.map(([args]) => args.collection)).toEqual(["team-memberships"]);
    expect(p.findByID.mock.calls.every(([args]) => args.collection === "users")).toBe(true);
  });
  it("readOnly标记优先于可能陈旧的开放state，不计算当前权限或跨批次保存能力", async () => {
    fresh = president;
    mocked.info.mockResolvedValue({ doc: { id: 21, title: baseApplication.title, team: 41, game: 11 },
      form: { ...form, enabled: false, closed: true }, version: baseApplication.formVersion, state: "招新开放", own: applications[0], readOnly: true });
    const data = await (await get("team/recruitment/21")).json();
    expect(Object.values(data.actions)).toEqual([false, false, false, false, false, false]);
    expect(p.find.mock.calls.some(([args]) => args.collection === "team-join-applications")).toBe(false);
    expect(p.findByID.mock.calls.some(([args]) => args.collection === "teams")).toBe(false);
  });
  it("历史详情readOnly动作同样用于hub，本人的returned回执不会恢复撤回", async () => {
    applications[0].status = "returned"; recruitments[0].status = "draft";
    mocked.info.mockResolvedValue({ doc: { id: 21, title: baseApplication.title, team: 41, game: 11 },
      form: { ...form, enabled: false, closed: true }, version: baseApplication.formVersion, state: "历史申请只读", own: applications[0], readOnly: true });
    const data = await (await get("team")).json();
    expect(data.recruitments.docs).toEqual([]); expect(data.ownApplications.docs[0]).toMatchObject({ id: 31, status: "returned", actions: { view: true, edit: false, withdraw: false } });
    expect(p.findByID.mock.calls.some(([args]) => args.collection === "team-recruitments" && args.overrideAccess !== false)).toBe(false);
  });
  it("16类表单、5–6人结构与核心题后复杂分支原样穿过metadata", async () => {
    const extras = [
      { type: "text" }, { type: "textarea" }, { type: "single", options: ["A", "B"] }, { type: "multiple", options: ["A", "B"] }, { type: "select", options: ["A", "B"] },
      { type: "number" }, { type: "date" }, { type: "time" }, { type: "rating" }, { type: "nps" }, { type: "ranking", options: ["A", "B"] },
      { type: "matrix", rows: ["行"], options: ["A", "B"] }, { type: "matrixMultiple", rows: ["行"], options: ["A", "B"] }, { type: "blanks", rows: ["子题"] },
      { type: "group", minEntries: 5, maxEntries: 6, fields: [{ id: "name", label: "姓名", type: "text", required: true, options: [] }] }, { type: "description" },
    ].map((q, i) => ({ id: "extra" + i, label: "合成扩展题" + i, required: false, options: [], ...q }));
    const currentForm = normalizeTeamForm({ ...form, questions: [...form.questions, ...extras,
      { id: "branch", label: "合成分支", type: "text", display: { mode: "any", rules: [{ questionId: "position", operator: "equals", value: "合成方向" }] },
        jumps: [{ when: { mode: "all", rules: [{ questionId: "branch", operator: "equals", value: "结束" }] }, target: "$end" }] }] });
    recruitments[0] = { ...baseRecruitment, signupForm: currentForm };
    const data = await (await get("team/recruitment/21")).json();
    expect(data.form).toEqual(currentForm); expect(new Set(data.form.questions.map((q: { type: string }) => q.type)).size).toBe(16);
    expect(data.application.formSnapshot).toEqual(form);
  });
});

describe("建队与队伍工作台逐条服务器动作", () => {
  it("建队本人列表采用owner+ACL，当前publishContent可申请但无成员管理资格", async () => {
    fresh = { ...manager, communityOffices: [{ game: 11, status: "active", publishContent: true }] };
    establishments[0] = { ...baseEstablishment, status: "returned" }; establishments.push({ ...baseEstablishment, id: 16, applicant: 8, reason: "other-private-establishment" });
    const data = await (await get("team/establishments", "?mode=own&page=3")).json();
    expect(data.page).toBe(3); expect(data.docs).toHaveLength(1); expect(data.proposalGames.map((game: { id: number }) => game.id)).toEqual([11]);
    expect(data.docs[0].actions).toEqual({ edit: true, withdraw: true, reviewDecisions: [] });
    expect(JSON.stringify(data)).not.toMatch(/private-establishment-key|other-private/);
    expect((await get("team/establishments", "?mode=review")).status).toBe(403);
    expect((await get("team/41/workbench")).status).toBe(403);
    fresh = { ...member }; const revoked = await (await get("team/establishments")).json();
    expect(revoked.docs[0].actions).toMatchObject({ edit: false, withdraw: true });
  });
  it("建队审核只查pending；已撤销申请者任职只能退回或拒绝", async () => {
    fresh = president; establishments[0] = { ...baseEstablishment, applicant: 8, status: "pending" };
    const data = await (await get("team/establishments", "?mode=review&page=2")).json();
    expect(data.docs[0].actions.reviewDecisions).toEqual(["returned", "rejected"]);
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "team-establishment-applications", overrideAccess: false,
      where: { status: { equals: "pending" } }, page: 2 }));
  });
  it("管理私有提交与成员按三个独立page读取，draft始终不进入审核队列", async () => {
    fresh = manager;
    applications.push({ ...baseApplication, id: 32, applicant: 8, status: "draft", answers: { ...answers, contact: "other-draft-secret" } });
    memberships[0].status = "active";
    const response = await get("team/41/workbench", "?page=2&membersPage=3&batchesPage=4"), data = await response.json();
    expect(response.status).toBe(200); expect(data).toMatchObject({ applications: { page: 2 }, members: { page: 3 }, recruitments: { page: 4 } });
    expect(data.applications.docs).toHaveLength(1); expect(JSON.stringify(data)).not.toMatch(/other-draft-secret|private-application-key|private-membership-key|private-note/);
    expect(data.applications.docs[0].actions.reviewDecisions).toEqual(["approved", "returned", "rejected"]);
    expect(data.members.docs[0]).toMatchObject({ id: 61, memberID: member.id, actions: { revoke: true, leave: true } });
    expect(data.actions).toEqual({ createRecruitment: true, lifecycleStatuses: ["resting", "archived"] });
    expect(data.recruitments.docs[0].actions).toMatchObject({ edit: true, close: true, archive: true });
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "team-join-applications", overrideAccess: false, depth: 0,
      where: { and: [{ team: { equals: 41 } }, { status: { equals: "pending" } }, { status: { not_equals: "draft" } }] } }));
    expect((await get("team/41/workbench", "?status=draft")).status).toBe(400);
  });
  it("截止/关闭批次仍可审核原提交；归档和停用申请者禁用批准，普通管理员不能恢复归档队伍", async () => {
    fresh = manager; recruitments[0].status = "closed";
    expect((await (await get("team/41/workbench")).json()).applications.docs[0].actions.reviewDecisions).toContain("approved");
    applications[0].applicant = 8;
    const findByID = p.findByID.getMockImplementation()! as (options: { collection: string; id: number }) => Promise<unknown>;
    p.findByID.mockImplementation(async options => options.collection === "users" && options.id === 8
      ? { ...member, id: 8, accountStatus: "suspended" } : findByID(options));
    expect((await (await get("team/41/workbench")).json()).applications.docs[0].actions.reviewDecisions).toEqual(["returned", "rejected"]);
    p.findByID.mockImplementation(findByID); applications[0].applicant = member.id;
    recruitments[0].status = "archived";
    expect((await (await get("team/41/workbench")).json()).applications.docs[0].actions.reviewDecisions).toEqual(["returned", "rejected"]);
    teams[0] = { ...baseTeam, teamStatus: "archived", archived: true };
    const data = await (await get("team/41/workbench")).json();
    expect(data.actions).toEqual({ createRecruitment: false, lifecycleStatuses: [] });
    fresh = president;
    expect((await (await get("team/41/workbench")).json()).actions.lifecycleStatuses).toEqual(["active", "resting"]);
  });
  it("当前在任管理队伍列表重用canManageTeam，与可建队社群区分", async () => {
    fresh = manager; teams.push({ ...baseTeam, id: 42, game: 12 });
    const data = await (await get("team")).json();
    expect(data.managedTeams.docs.map((team: { id: number }) => team.id)).toEqual([41]);
    expect(data.proposalGames.map((game: { id: number }) => game.id)).toEqual([11]);
    expect(data.managedTeams.docs[0].actions.workbench).toBe(true);
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "teams", user: null, overrideAccess: false, draft: false,
      where: { game: { in: [11] } } }));
  });
  it.each([{ teamStatus: "archived", archived: false }, { teamStatus: "active", archived: true }])("双归档信号 $teamStatus/$archived 都禁止普通管理员恢复，内部字段不扩展DTO", async flags => {
    fresh = manager; teams[0] = { ...baseTeam, ...flags };
    const data = await (await get("team/41/workbench")).json();
    expect(data.actions).toEqual({ createRecruitment: false, lifecycleStatuses: [] }); expect(data.team).not.toHaveProperty("archived");
    expect(p.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: "teams", overrideAccess: false, select: expect.objectContaining({ archived: true }) }));
  });
});
