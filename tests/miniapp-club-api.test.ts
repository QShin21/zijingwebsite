import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "payload";
import { defaultStaffForm, staffDeadlinePolicy, staffPrivacy } from "../src/lib/staff-recruitment-model";
import { normalizeSignup } from "../src/lib/signup-schema";
const mocked = vi.hoisted(() => ({ cms: vi.fn(), batches: vi.fn(), batch: vi.fn(), ownStaff: vi.fn(), reviewStaff: vi.fn(),
  promoted: vi.fn(), edit: vi.fn(), decide: vi.fn(), card: vi.fn(), join: vi.fn() }));
vi.mock("../src/lib/content", () => ({ cms: mocked.cms }));
vi.mock("../src/lib/staff-recruitment", () => ({ currentStaffBatches: mocked.batches, publicStaffBatch: mocked.batch,
  ownStaffApplication: mocked.ownStaff, readStaffApplications: mocked.reviewStaff }));
vi.mock("../src/lib/content-promotions", () => ({ promotedContent: mocked.promoted }));
vi.mock("../src/lib/community-operations", () => ({ editCommunityApplication: mocked.edit, decideCommunityApplication: mocked.decide,
  updateCommunityCard: mocked.card, changeCommunityJoin: mocked.join }));
vi.mock("../src/lib/activity-signups", () => ({ formVersion: () => "current-form-version" }));
vi.mock("../src/app/(frontend)/account/actions", () => ({ beginRegistrationAction: vi.fn(), registerAction: vi.fn() }));
vi.mock("../src/lib/verification", () => ({ schoolEmail: vi.fn(), validPassword: vi.fn(), issueCode: vi.fn(), consumeCode: vi.fn() }));
import { GET, POST } from "../src/app/(frontend)/api/miniapp/[...path]/route";

const member = { id: 7, name: "合成成员", roles: ["member"], accountStatus: "active", collection: "users", communityOffices: [] };
const president = { ...member, roles: ["president"] };
const timestamp = "2026-10-12T01:00:00.000Z";
const application = { id: 15, applicant: member.id, game: 11, proposedGame: "合成社群", realName: "合成姓名", phone: "13900000000",
  reason: "合成社群运营申请说明", contactConsent: false, status: "pending", updatedAt: timestamp, createdAt: timestamp,
  wechatQr: "data:image/png;base64,cHJpdmF0ZQ==", requestKey: "private-key", reviewNote: null };
const join = { id: 21, member: member.id, game: 11, contact: 9, memberName: member.name, status: "requested", updatedAt: timestamp,
  createdAt: timestamp, dedupeKey: "private-join-key", note: null };
const batch = { id: 6, title: "合成骨干招新", state: "open", endAt: "2099-01-01T00:00:00.000Z", signupForm: defaultStaffForm,
  currentKey: "staff", updatedAt: timestamp };
const staffApplication = { id: 31, batch: batch.id, applicant: member.id, memberName: member.name, batchTitle: batch.title,
  department: "execution", status: "submitted", formVersion: "current-form-version", questions: defaultStaffForm.questions,
  answers: { department: "执行部", name: "合成成员" }, feedback: "合成本人反馈", reviewNotes: "私有内部备注", history: [{ secret: true }],
  requestKey: "private-staff-key", updatedAt: timestamp, createdAt: timestamp };
let p: Record<string, ReturnType<typeof vi.fn>>;
let fresh: typeof member;
const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });
const get = (path: string, query = "") => GET(new Request("https://home.thuzijing.top/api/miniapp/" + path + query,
  { headers: { authorization: "JWT synthetic-token" } }), context(path));
const post = (path: string, data: unknown, headers: Record<string, string> = {}) => POST(new Request("https://home.thuzijing.top/api/miniapp/" + path,
  { method: "POST", headers: { "Content-Type": "application/json", authorization: "JWT synthetic-token", ...headers }, body: JSON.stringify(data) }), context(path));
const paged = (docs: unknown[], page = 1) => ({ docs, page, totalPages: 3, totalDocs: 42, hasNextPage: true });
beforeEach(() => {
  vi.resetAllMocks(); fresh = { ...member };
  p = { auth: vi.fn().mockResolvedValue({ user: president }), findByID: vi.fn().mockImplementation(async ({ collection }) => collection === "users" ? fresh : { id: 11, _status: "published" }),
    find: vi.fn().mockResolvedValue(paged([])), create: vi.fn().mockResolvedValue(application), update: vi.fn() };
  mocked.cms.mockResolvedValue(p); mocked.batches.mockResolvedValue([batch]); mocked.batch.mockResolvedValue(batch);
  mocked.ownStaff.mockResolvedValue(staffApplication); mocked.reviewStaff.mockResolvedValue({ batch, result: paged([staffApplication]) });
  mocked.promoted.mockImplementation(async (_p, kind) => [{ sourceKey: "community-posts:51", snapshot: { title: "已审批合成" + kind } }]);
  mocked.edit.mockResolvedValue(application); mocked.decide.mockResolvedValue(application); mocked.card.mockResolvedValue(application); mocked.join.mockResolvedValue(join);
});
afterEach(() => vi.clearAllMocks());

describe("小程序公开社团投影与当前权限", () => {
  it("匿名主页重用已审批升推与当前骨干入口，不读取原始申请", async () => {
    const response = await get("club"), data = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(data.staffBatches).toEqual([{ id: batch.id, title: batch.title, endAt: batch.endAt, state: "申请开放" }]);
    expect(Object.keys(data.promotions)).toEqual(["event", "notice", "showcase"]);
    for (const kind of ["event", "notice", "showcase"]) expect(mocked.promoted).toHaveBeenCalledWith(p, kind);
    expect(data.staffBatches[0]).not.toHaveProperty("signupForm"); expect(data.staffBatches[0]).not.toHaveProperty("currentKey");
    expect(p.auth).not.toHaveBeenCalled(); expect(p.find).not.toHaveBeenCalled();
  });
  it("历史批次保持匿名访问与字段最小化，由staffWindow确定截止状态", async () => {
    p.find.mockResolvedValue(paged([{ ...batch, endAt: "2020-01-01T00:00:00Z" }], 2));
    const response = await get("staff", "?page=2.9"), data = await response.json();
    expect(data.docs[0].state).toBe("申请已截止"); expect(data.docs[0]).not.toHaveProperty("signupForm");
    expect(data).toMatchObject({ page: 2, totalPages: 3, totalDocs: 42, hasNextPage: true });
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "staff-batches", user: null, overrideAccess: false, depth: 0, limit: 12, page: 2 }));
    expect(p.auth).not.toHaveBeenCalled();
  });
  it("旧会话管理角色不能代替当前权限，普通成员工作台无私人审核能力", async () => {
    const response = await get("workbench");
    expect(await response.json()).toEqual({ reviewCommunity: false, reviewStaff: false });
    expect(p.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: "users", id: member.id, overrideAccess: true, depth: 0,
      select: expect.objectContaining({ roles: true, accountStatus: true, communityOffices: true }) }));
    fresh = president;
    expect(await (await get("workbench")).json()).toEqual({ reviewCommunity: true, reviewStaff: true });
  });
  it("未登录与已撤销账号在读取和提交前停止，伪造请求身份不会生效", async () => {
    p.auth.mockResolvedValueOnce({ user: null }); expect((await get("workbench")).status).toBe(401);
    fresh = { ...member, accountStatus: "suspended" };
    expect((await get("community/applications")).status).toBe(403);
    expect((await post("community/applications", { action: "submit", user: president, actor: president, context: { system: true } })).status).toBe(403);
    expect(p.find).not.toHaveBeenCalled(); expect(p.create).not.toHaveBeenCalled();
  });
});

describe("建群与管理员申请兼容层", () => {
  it("本人列表带分页与必要字段，关系展开不会泄露邮箱或大二维码", async () => {
    p.find.mockResolvedValue(paged([{ ...application, applicant: { id: member.id, email: "private@example.invalid" }, status: "returned", reviewNote: "请补充" }], 2));
    const response = await get("community/applications", "?page=2"), data = await response.json();
    expect(data).toMatchObject({ page: 2, hasNextPage: true, totalPages: 3, totalDocs: 42 });
    expect(data.docs[0]).toMatchObject({ applicant: member.id, reviewNote: "请补充", contactConsent: false,
      actions: { edit: true, withdraw: false, card: false, review: false } });
    expect(JSON.stringify(data)).not.toMatch(/wechatQr|private-key|private@example/);
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ overrideAccess: false, user: fresh, depth: 0, page: 2,
      where: { applicant: { equals: member.id } }, select: expect.objectContaining({ contactConsent: true, updatedAt: true }) }));
    expect(p.find.mock.calls[0][0].select).not.toHaveProperty("wechatQr");
  });
  it("审核队列使用当前服务端权限，已撤权会话先拒绝；通过时仅查pending", async () => {
    const denied = await get("community/applications", "?mode=review");
    expect(denied.status).toBe(403); expect(p.find).not.toHaveBeenCalled();
    fresh = president; p.find.mockResolvedValue(paged([{ ...application, applicant: 8 }]));
    const allowed = await get("community/applications", "?mode=review");
    expect((await allowed.json()).docs[0].actions).toEqual({ edit: false, withdraw: false, card: false, review: true });
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ user: fresh, overrideAccess: false, where: { status: { equals: "pending" } } }));
  });
  it("初次提交强制本人和pending，仅白名单进入create，保持hook权限校验", async () => {
    const data = { action: "submit", game: 11, realName: application.realName, phone: application.phone, proposedGame: application.proposedGame,
      reason: application.reason, wechatQr: application.wechatQr, contactConsent: true, applicant: 99, actor: president, user: president,
      status: "approved", roles: ["president"], requestKey: "forged", context: { system: true, applicationResolved: true } };
    expect((await post("community/applications", data)).status).toBe(200);
    expect(p.create).toHaveBeenCalledWith({ collection: "community-applications", user: fresh, overrideAccess: false,
      data: { game: 11, realName: application.realName, phone: application.phone, proposedGame: application.proposedGame,
        reason: application.reason, wechatQr: application.wechatQr, contactConsent: true, applicant: member.id, status: "pending" } });
  });
  it("重提与撤回直接使用旧服务，修订值原样传递，撤回忽略其他资料", async () => {
    const revision = "opaque-server-revision";
    await post("community/applications", { action: "edit", id: application.id, revision, game: 11, realName: application.realName,
      phone: application.phone, proposedGame: application.proposedGame, reason: application.reason, context: { system: true }, status: "approved" });
    expect(mocked.edit).toHaveBeenLastCalledWith(p, fresh, application.id, revision, {
      game: 11, realName: application.realName, phone: application.phone, proposedGame: application.proposedGame,
      reason: application.reason, contactConsent: false, applicant: member.id, status: "pending" });
    await post("community/applications", { action: "withdraw", id: application.id, revision, reason: "ignore", applicant: 99, context: { system: true } });
    expect(mocked.edit).toHaveBeenLastCalledWith(p, fresh, application.id, revision, { status: "withdrawn" });
    expect(p.update).not.toHaveBeenCalled();
  });
  it("名片和审批仅传递已有服务字段，冲突状态与安全错误响应保持", async () => {
    await post("community/applications", { action: "card", id: application.id, revision: timestamp, contactConsent: false, reason: "ignore", status: "approved" });
    expect(mocked.card).toHaveBeenCalledWith(p, fresh, application.id, timestamp, { contactConsent: false });
    mocked.decide.mockRejectedValueOnce(new APIError("申请已更新，请刷新后核对", 409));
    const response = await post("community/applications", { action: "review", id: application.id, revision: timestamp,
      decision: "returned", reviewNote: "补充运营安排", user: president, context: { system: true } });
    expect(mocked.decide).toHaveBeenCalledWith(p, fresh, application.id, "returned", "补充运营安排", timestamp);
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: "申请已更新，请刷新后核对" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    mocked.edit.mockRejectedValueOnce(new Error("SQL secret@example.invalid"));
    const failed = await post("community/applications", { action: "withdraw", id: application.id, revision: timestamp });
    expect(failed.status).toBe(500); expect(await failed.text()).not.toContain("secret@example.invalid");
  });
  it("仅申请路由接收2MB图片base64，超3MiB或伪装Content-Length停止；auth仍32KiB", async () => {
    const qr = "data:image/png;base64," + Buffer.alloc(2 * 1024 * 1024, 1).toString("base64");
    expect((await post("community/applications", { action: "submit", wechatQr: qr })).status).toBe(200);
    p.create.mockClear(); mocked.cms.mockClear();
    expect((await post("community/applications", { action: "submit", reason: "x".repeat(3 * 1024 * 1024) }, { "content-length": "1" })).status).toBe(400);
    expect((await post("auth/login", { payload: "x".repeat(40_000) })).status).toBe(400);
    expect((await post("community/11/join", { action: "request", payload: "x".repeat(40_000) })).status).toBe(400);
    expect(mocked.cms).not.toHaveBeenCalled(); expect(p.create).not.toHaveBeenCalled();
  });
});

describe("人工进群与管理队列", () => {
  it("本人进度使用本人where与已发布社群，不推断点击二维码已进群", async () => {
    p.find.mockResolvedValue(paged([join]));
    const response = await get("community/11/join"), data = await response.json();
    expect(data).toMatchObject({ record: { id: join.id, status: "requested", updatedAt: timestamp },
      actions: { request: false, reportFriend: true, withdraw: true }, canHandle: false });
    expect(data.record).not.toHaveProperty("dedupeKey");
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ user: fresh, overrideAccess: false,
      where: { and: [{ game: { equals: 11 } }, { member: { equals: member.id } }] } }));
    expect(p.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: "games", user: null, overrideAccess: false, draft: false }));
    p.findByID.mockImplementation(async ({ collection }) => collection === "users" ? fresh : { id: 11, _status: "draft" });
    p.find.mockClear(); expect((await get("community/11/join")).status).toBe(404); expect(p.find).not.toHaveBeenCalled();
  });
  it("管理权限被撤回或来自其他社群时返回403，授权队列只含待人工处理记录", async () => {
    fresh = { ...member, communityOffices: [{ game: 12, status: "active", handleJoins: true }] } as typeof member;
    expect((await get("community/11/join", "?mode=manage")).status).toBe(403); expect(p.find).not.toHaveBeenCalled();
    fresh = { ...member, communityOffices: [{ game: 11, status: "active", handleJoins: true }] } as typeof member;
    p.find.mockResolvedValue(paged([{ ...join, member: 8 }, { ...join, id: 22, member: 9, status: "awaitingInvite" }], 2));
    const data = await (await get("community/11/join", "?mode=manage&page=2")).json();
    expect(data).toMatchObject({ canHandle: true, page: 2 });
    expect(data.docs[0].actions).toEqual({ confirmFriend: true, confirmJoined: false });
    expect(data.docs[1].actions).toEqual({ confirmFriend: false, confirmJoined: true });
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ overrideAccess: false, user: fresh,
      where: { and: [{ game: { equals: 11 } }, { status: { in: ["requested", "friendReported", "awaitingInvite"] } }] } }));
  });
  it("所有写入都委托changeCommunityJoin；修订、id、contact透传并忽略actor/context", async () => {
    for (const action of ["request", "reportFriend", "withdraw", "confirmFriend", "confirmJoined"]) {
      const response = await post("community/11/join", { action, id: join.id, contact: 9, revision: timestamp, note: "合成人工备注",
        actor: president, user: president, member: 99, game: 12, status: "joined", context: { communityJoinWrite: true, system: true } });
      expect(response.status).toBe(200);
      expect(mocked.join).toHaveBeenLastCalledWith(p, fresh, 11, action, { id: join.id, contact: 9, revision: timestamp, note: "合成人工备注" });
    }
    mocked.join.mockRejectedValueOnce(new APIError("无权处理此社群进群", 403));
    expect((await post("community/11/join", { action: "confirmJoined", id: join.id, revision: timestamp })).status).toBe(403);
    expect(p.create).not.toHaveBeenCalled(); expect(p.update).not.toHaveBeenCalled();
    mocked.join.mockClear(); expect((await post("community/11/join", { action: "autoJoin", context: { system: true } })).status).toBe(400);
    expect(mocked.join).not.toHaveBeenCalled();
  });
});

describe("单份骨干申请与现有问卷兼容", () => {
  it("撤下批次仅返回原回执与原version，残缺跳转快照不重建为表单", async () => {
    const archived = { ...staffApplication, formVersion: "saved-historical-version", questions: [
      { ...defaultStaffForm.questions[7], jumps: [{ when: { mode: "all", rules: [{ questionId: "works", operator: "equals", value: "合成" }] }, target: "omitted_target" }] },
    ] };
    mocked.batch.mockRejectedValueOnce(new APIError("记录不存在", 404));
    mocked.ownStaff.mockResolvedValueOnce(archived);
    const response = await get("staff/6"), data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toMatchObject({ title: archived.batchTitle, form: null, version: archived.formVersion,
      state: "批次已撤下，仅可查看回执", application: { id: archived.id, questions: archived.questions },
      actions: { submit: false, edit: false, withdraw: false, review: false } });
    expect(data.draftKey).toBeUndefined(); expect(data.description).toBeUndefined();
    expect(JSON.stringify(data)).not.toMatch(/reviewNotes|history|private-staff-key/);
    mocked.batch.mockRejectedValueOnce(new APIError("记录不存在", 404)); mocked.ownStaff.mockResolvedValueOnce(null);
    expect((await get("staff/6")).status).toBe(404);
  });
  it("详情使用既有form/version/窗口，本人回执不暴露内部备注、history或requestKey", async () => {
    const data = await (await get("staff/6")).json();
    expect(mocked.ownStaff).toHaveBeenCalledWith(p, fresh, batch.id); expect(mocked.batch).toHaveBeenCalledWith(p, batch.id);
    expect(data).toMatchObject({ version: "current-form-version", state: "申请开放", loggedIn: true,
      actions: { submit: false, edit: true, withdraw: true, review: false }, privacy: staffPrivacy, deadlinePolicy: staffDeadlinePolicy });
    expect(data.form).toEqual(defaultStaffForm); expect(data.application.answers).toEqual(staffApplication.answers);
    expect(JSON.stringify(data)).not.toMatch(/reviewNotes|history|private-staff-key|私有内部备注/);
    p.auth.mockResolvedValueOnce({ user: null }); expect((await get("staff/6")).status).toBe(401);
  });
  it("截止与最终结果锁定本人写提示，开放时可重提同一已撤回申请", async () => {
    mocked.batch.mockResolvedValueOnce({ ...batch, state: "closed" });
    expect((await (await get("staff/6")).json()).actions).toEqual({ submit: false, edit: false, withdraw: false, review: false });
    mocked.ownStaff.mockResolvedValueOnce({ ...staffApplication, status: "accepted" });
    expect((await (await get("staff/6")).json()).actions).toEqual({ submit: false, edit: false, withdraw: false, review: false });
    mocked.ownStaff.mockResolvedValueOnce({ ...staffApplication, status: "withdrawn" });
    expect((await (await get("staff/6")).json()).actions).toEqual({ submit: true, edit: true, withdraw: false, review: false });
  });
  it("全部16题型及5–6人组队、显示条件和复杂跳转穿过桥接，未缩减或转换问卷", async () => {
    const extras = [
      { type: "text" }, { type: "textarea" }, { type: "single", options: ["A", "B"] }, { type: "multiple", options: ["A", "B"] },
      { type: "select", options: ["A", "B"] }, { type: "number" }, { type: "date" }, { type: "time" }, { type: "rating" }, { type: "nps" },
      { type: "ranking", options: ["A", "B"] }, { type: "matrix", rows: ["行1"], options: ["A", "B"] },
      { type: "matrixMultiple", rows: ["行1"], options: ["A", "B"] }, { type: "blanks", rows: ["子题"] },
      { type: "group", minEntries: 5, maxEntries: 6, fields: [{ id: "name", label: "姓名", type: "text", required: true, options: [] }] }, { type: "description" },
    ].map((question, i) => ({ id: "extra" + i, label: "合成题目" + i, required: false, options: [], ...question }));
    const form = normalizeSignup({ ...defaultStaffForm, questions: [...defaultStaffForm.questions, ...extras,
      { id: "branch", label: "合成复杂分支", type: "text", display: { mode: "all", rules: [{ questionId: "department", operator: "equals", value: "执行部" }] },
        jumps: [{ when: { mode: "any", rules: [{ questionId: "branch", operator: "equals", value: "结束" }] }, target: "$end" }] }] });
    mocked.batch.mockResolvedValueOnce({ ...batch, signupForm: form });
    const data = await (await get("staff/6")).json();
    expect(data.form).toEqual(form); expect(new Set(data.form.questions.map((question: { type: string }) => question.type)).size).toBe(16);
    expect(data.form.questions.find((question: { type: string }) => question.type === "group")).toMatchObject({ minEntries: 5, maxEntries: 6 });
  });
  it("审核分页经过已有授权/审计服务，并只返回服务支持的决定提示", async () => {
    fresh = president;
    mocked.reviewStaff.mockResolvedValueOnce({ batch, result: paged([staffApplication, { ...staffApplication, id: 32, status: "withdrawn" }], 2) });
    const data = await (await get("staff/6", "?mode=review&page=2&department=execution&status=submitted")).json();
    expect(data).toMatchObject({ page: 2, totalPages: 3, totalDocs: 42 });
    expect(data.docs[0].actions.reviewStatuses).toEqual(["reviewing", "returned", "accepted", "rejected"]);
    expect(data.docs[1].actions.reviewStatuses).toEqual([]);
    expect(mocked.reviewStaff).toHaveBeenCalledWith(p, fresh, batch.id, expect.any(URLSearchParams));
    const query = mocked.reviewStaff.mock.calls[0][3] as URLSearchParams;
    expect(query.get("department")).toBe("execution"); expect(query.get("status")).toBe("submitted");
    mocked.reviewStaff.mockRejectedValueOnce(new APIError("无权读取或导出骨干候选资料", 403));
    expect((await get("staff/6", "?mode=review")).status).toBe(403);
    expect(mocked.ownStaff).not.toHaveBeenCalled();
  });
  it.each(["accepted", "rejected"])("%s终态仅提供原结果和明确退回，不能直接切换结果或进入选拔", async status => {
    fresh = president;
    mocked.reviewStaff.mockResolvedValueOnce({ batch, result: paged([{ ...staffApplication, status }]) });
    const data = await (await get("staff/6", "?mode=review")).json();
    expect(data.docs[0].actions.reviewStatuses).toEqual(["returned", status]);
  });
});
