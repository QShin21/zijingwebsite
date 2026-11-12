// Backend-only contracts for the server hints consumed by miniapp-staff-flows,
// content-flows and signup-lifecycle. Legacy clients only simulated these DTOs.
// Actual HTTP dispatch/projection/current-role rules run; persistence services are synthetic.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APIError } from "payload";
import { defaultStaffForm, staffDeadlinePolicy, staffPrivacy } from "../src/lib/staff-recruitment-model";
import { normalizeSignup } from "../src/lib/signup-schema";
const mocked = vi.hoisted(() => ({ cms: vi.fn(), batches: vi.fn(), batch: vi.fn(), ownStaff: vi.fn(), reviewStaff: vi.fn(),
  promoted: vi.fn(), changeStaff: vi.fn(), edit: vi.fn(), decide: vi.fn(), card: vi.fn(), join: vi.fn() }));
vi.mock("../src/lib/content", () => ({ cms: mocked.cms }));
vi.mock("../src/lib/staff-recruitment", () => ({ currentStaffBatches: mocked.batches, publicStaffBatch: mocked.batch,
  ownStaffApplication: mocked.ownStaff, readStaffApplications: mocked.reviewStaff, changeStaffApplication: mocked.changeStaff }));
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


import { POST as staffPOST, PATCH as staffPATCH } from "../src/app/(frontend)/api/staff/batches/[id]/application/route";

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

const staffContext = { params: Promise.resolve({ id: String(batch.id) }) };
const staffWrite = (body: Record<string, unknown>, patch = false) => (patch ? staffPATCH : staffPOST)(new Request('http://localhost:3000/api/staff/batches/' + batch.id + '/application', {
  method: patch ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json', authorization: 'JWT synthetic-token' }, body: JSON.stringify(body),
}), staffContext);
describe('V2保留：骨干POST修改、重提及冲突状态', () => {
  it.each([false, true])('POST edit / 旧PATCH均只委托已有edit服务：PATCH=%s', async patch => {
    mocked.changeStaff.mockResolvedValue(staffApplication);
    const response = await staffWrite({ action: 'edit', version: 'current-form-version', revision: timestamp,
      answers: { department: '执行部', name: '合成新稿' }, actor: president, context: { system: true }, batch: 99 }, patch);
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocked.changeStaff).toHaveBeenCalledWith(p, president, batch.id, 'edit', {
      id: undefined, revision: timestamp, version: 'current-form-version', answers: { department: '执行部', name: '合成新稿' }, status: undefined, feedback: undefined, reviewNotes: undefined,
    });
    expect(await response.json()).toEqual({ application: staffApplication });
  });
  it.each([false, true])('首次/withdrawn重提保留POST submit与旧修订，不误用edit：已有=%s', async existing => {
    mocked.changeStaff.mockResolvedValue({ ...staffApplication, status: 'submitted' });
    const response = await staffWrite({ version: 'current-form-version', ...(existing ? { revision: timestamp } : {}), answers: staffApplication.answers });
    expect(response.status).toBe(200); expect(mocked.changeStaff).toHaveBeenCalledWith(p, president, batch.id, 'submit', expect.objectContaining({ revision: existing ? timestamp : undefined, answers: staffApplication.answers }));
  });
  it.each([401, 403, 409])('真实服务返回%s时HTTP保留状态，不fallback/重试/改写记录', async status => {
    mocked.changeStaff.mockRejectedValue(new APIError('合成申请操作拒绝', status));
    const response = await staffWrite({ action: 'edit', revision: timestamp, version: 'current-form-version', answers: staffApplication.answers });
    expect(response.status).toBe(status); expect(await response.json()).toEqual({ error: '合成申请操作拒绝' });
    expect(mocked.changeStaff).toHaveBeenCalledTimes(1); expect(p.update).not.toHaveBeenCalled(); expect(p.create).not.toHaveBeenCalled();
  });
});
