import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
import { getPayload, type Payload } from "payload";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import config from "../src/payload.config";
import type { StaffBatch, User } from "../src/payload-types";
import { normalizeSignup } from "../src/lib/signup-schema";
import { saveSignupForm } from "../src/lib/activity-signups";
import { defaultStaffForm, staffForm } from "../src/lib/staff-recruitment-model";
import { saveStaffBatch } from "../src/lib/staff-recruitment";

// Requests cross a real loopback HTTP socket before reaching the actual exported
// route handlers. Only CMS location is mocked; JWT, ACL, services and SQL are real.
// This adapter does not claim to exercise Next's proxy or WeChat's SDK.
const locator = vi.hoisted(() => ({ cms: vi.fn() }));
vi.mock("../src/lib/content", () => ({ cms: locator.cms }));
import * as activityRoutes from "../src/app/(frontend)/api/activities/[kind]/[id]/signup/route";
import * as staffRoutes from "../src/app/(frontend)/api/staff/batches/[id]/application/route";

type Flow = "events" | "community-posts" | "staff";
type Receipt = { id: number; updatedAt: string; formVersion: string; answers: Record<string, unknown> };
type Body = { signup?: Receipt; application?: Receipt; version: string; state?: string; error?: string };
let p: Payload, server: Server | undefined, origin: string;
let president: User, reviewer: User, member: User, outsider: User;
let game: number, event: number, post: number, batch: StaffBatch;
const users: User[] = [], tokens = new Map<number, string>(), clientEnds: Promise<void>[] = [];
const suffix = randomBytes(6).toString("hex"), password = "Synthetic-Post-Edit-Only-482!";
const squad = Array.from({ length: 5 }, (_, index) => ({ player: "合成队员" + (index + 1), gameID: "synthetic-" + (index + 1) }));
const group = { id: "squad", label: "合成五至六人队伍", type: "group", required: true, minEntries: 5, maxEntries: 6,
  fields: [{ id: "player", label: "合成称呼", type: "text", required: true }, { id: "gameID", label: "合成游戏ID", type: "text", required: true }] };
const activityForm = normalizeSignup({ enabled: true, questions: [
  { id: "note", label: "合成报名说明", type: "textarea", required: true }, group,
] });
const staffSignup = staffForm({ ...defaultStaffForm, questions: [...defaultStaffForm.questions, group] });
const answers = (flow: Flow, marker = "合成原始作答", six = false) => ({
  ...(flow === "staff" ? { department: "执行部", name: "合成候选人", school: "合成院系", motivation: marker,
    experience: "合成兴趣", time: "合成时段", contact: "synthetic@example.invalid", works: "" } : { note: marker }),
  squad: six ? [...squad, { player: "合成队员6", gameID: "synthetic-6" }] : squad,
});
const path = (flow: Flow) => flow === "staff" ? "/api/staff/batches/" + batch.id + "/application"
  : "/api/activities/" + flow + "/" + (flow === "events" ? event : post) + "/signup";
async function http(flow: Flow, actor: User | null, method = "GET", data?: Record<string, unknown>, query = "") {
  const response = await fetch(origin + path(flow) + query, { method, headers: {
    "content-type": "application/json", "x-questionnaire-version": "3",
    ...(actor ? { authorization: "JWT " + tokens.get(actor.id) } : {}),
  }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, headers: response.headers, body: await response.json() as Body };
}
function receipt(flow: Flow, result: Awaited<ReturnType<typeof http>>) {
  expect(result.status).toBe(200);
  const saved = flow === "staff" ? result.body.application : result.body.signup;
  if (!saved) throw new Error("Synthetic HTTP receipt missing");
  return saved;
}
async function submit(flow: Flow) {
  const metadata = await http(flow, member);
  expect(metadata.status).toBe(200);
  return { version: metadata.body.version, saved: receipt(flow, await http(flow, member, "POST", {
    version: metadata.body.version, answers: answers(flow),
  })) };
}
async function stored(flow: Flow, id: number) {
  return p.findByID({ collection: flow === "staff" ? "staff-applications" : "event-signups", id, overrideAccess: true, depth: 0 });
}
async function dispatch(incoming: IncomingMessage, outgoing: ServerResponse) {
  const method = incoming.method || "GET", pathname = new URL(incoming.url || "/", origin).pathname;
  const activity = /^\/api\/activities\/(events|community-posts)\/([1-9]\d*)\/signup$/.exec(pathname);
  const staff = /^\/api\/staff\/batches\/([1-9]\d*)\/application$/.exec(pathname);
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const parts: Buffer[] = [];
  for await (const part of incoming) parts.push(Buffer.isBuffer(part) ? part : Buffer.from(part));
  const request = new Request(origin + (incoming.url || "/"), { method, headers,
    ...(!["GET", "HEAD"].includes(method) ? { body: Buffer.concat(parts) } : {}) });
  let response: Response;
  if (activity) {
    const handler = ({ GET: activityRoutes.GET, POST: activityRoutes.POST, PATCH: activityRoutes.PATCH, PUT: activityRoutes.PUT })[method];
    response = handler ? await handler(request, { params: Promise.resolve({ kind: activity[1], id: activity[2] }) }) : new Response(null, { status: 405 });
  } else if (staff) {
    const handler = ({ GET: staffRoutes.GET, POST: staffRoutes.POST, PATCH: staffRoutes.PATCH })[method];
    response = handler ? await handler(request, { params: Promise.resolve({ id: staff[1] }) }) : new Response(null, { status: 405 });
  } else response = new Response(null, { status: 404 });
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  const delegatedQA = db.hostname === "127.0.0.1" && db.port === process.env.MINIAPP_POST_EDIT_DB_PORT &&
    /^\d+$/.test(db.port) && db.pathname === "/miniapp_post_edit_qa_synthetic" && db.username === "miniapp_synthetic";
  const repositoryCI = process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY === "QShin21/zijingwebsite" &&
    db.hostname === "127.0.0.1" && db.port === "5432" && db.pathname === "/zijing" && db.username === "zijing";
  if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false" || !(delegatedQA || repositoryCI))
    throw new Error("Only the delegated disposable database or this repository's isolated CI database is allowed");
  const base = await config;
  p = await getPayload({ key: "miniapp-post-edit-" + suffix, disableOnInit: true, config: {
    ...base, typescript: { ...base.typescript, autoGenerate: false },
    db: { ...base.db, init: args => {
      const adapter = base.db.init(args) as PostgresAdapter;
      // Own this pool and await actual socket closure; never terminate another fixture's connections.
      adapter.pool = new adapter.pg.Pool(adapter.poolOptions);
      adapter.pool.on("connect", client => clientEnds.push(new Promise(resolve => client.once("end", resolve))));
      return adapter;
    } },
  } }); locator.cms.mockResolvedValue(p);
  async function actor(label: string, roles: User["roles"]) {
    const value = await p.create({ collection: "users", overrideAccess: true, context: { system: true },
      data: { name: label + suffix, email: label + suffix + "@example.invalid", password, roles } });
    users.push(value);
    const login = await p.login({ collection: "users", data: { email: value.email, password } });
    if (!login.token) throw new Error("Synthetic JWT login required");
    tokens.set(value.id, login.token); return value;
  }
  president = await actor("post-edit-president", ["president"]); reviewer = await actor("post-edit-reviewer", ["vicePresident"]);
  member = await actor("post-edit-member", ["member"]); outsider = await actor("post-edit-outsider", ["member"]);
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true },
    data: { title: "合成POST编辑社群", slug: "post-edit-" + suffix, _status: "published" } })).id;
  server = createServer((incoming, outgoing) => { void dispatch(incoming, outgoing).catch(() => {
    outgoing.writeHead(500, { "Content-Type": "application/json" }); outgoing.end(JSON.stringify({ error: "Synthetic HTTP adapter failed" }));
  }); });
  await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(0, "127.0.0.1", resolve); });
  origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
}, 60000);
beforeEach(async () => {
  member = await p.update({ collection: "users", id: member.id, user: president, overrideAccess: false, data: { accountStatus: "active" } });
  reviewer = await p.update({ collection: "users", id: reviewer.id, user: president, overrideAccess: false, data: { roles: ["vicePresident"] } });
  event = (await p.create({ collection: "events", user: president, overrideAccess: false, context: { manageSignupForm: true },
    data: { title: "合成POST编辑活动", slug: "post-edit-event-" + randomBytes(5).toString("hex"), _status: "published", signupForm: activityForm } })).id;
  post = (await p.create({ collection: "community-posts", user: president, overrideAccess: false, context: { manageSignupForm: true },
    data: { title: "合成POST编辑社区活动", body: "合成活动说明", game, author: president.id, category: "event", signupForm: activityForm } })).id;
  batch = await saveStaffBatch(p, president, null, "", { title: "合成POST编辑骨干批次", state: "open", signupForm: staffSignup,
    endAt: new Date(Date.now() + 86400000).toISOString() });
});
afterEach(async () => {
  if (!p) return;
  await p.delete({ collection: "event-signups", overrideAccess: true, where: { member: { in: users.map(user => user.id) } } });
  if (batch) {
    await p.delete({ collection: "staff-applications", overrideAccess: true, where: { batch: { equals: batch.id } } });
    await p.delete({ collection: "staff-batches", id: batch.id, overrideAccess: true });
  }
  if (event) await p.delete({ collection: "events", id: event, overrideAccess: true });
  if (post) await p.delete({ collection: "community-posts", id: post, overrideAccess: true });
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  if (!p) return;
  await p.delete({ collection: "audit", overrideAccess: true, where: { or: [
    { actor: { in: users.map(user => String(user.id)) } },
    { object: { in: [...users.map(user => "users:" + user.id), "games:" + game] } },
  ] } });
  for (const user of users) await p.delete({ collection: "users", id: user.id, overrideAccess: true, context: { system: true } });
  if (game) await p.delete({ collection: "games", id: game, overrideAccess: true });
  const adapter = p.db as typeof p.db & { sessions: Record<string, unknown>; pool: { end(): Promise<void> } };
  for (const id of Object.keys(adapter.sessions)) await adapter.rollbackTransaction(id);
  await adapter.pool.end(); await Promise.all(clientEnds); await p.destroy();
});

describe.each<Flow>(["events", "community-posts", "staff"])("%s 的真实HTTP POST edit与原PATCH", flow => {
  it("普通POST并发提交与重试保留一份原记录，不把未声明edit的答案当改稿", async () => {
    const metadata = await http(flow, member);
    const input = { version: metadata.body.version, answers: answers(flow) };
    const first = await Promise.all([http(flow, member, "POST", input), http(flow, member, "POST", input)]);
    expect(first.some(result => result.status === 200)).toBe(true);
    expect(first.every(result => [200, 409].includes(result.status))).toBe(true);
    const original = receipt(flow, first.find(result => result.status === 200)!);
    const repeated = receipt(flow, await http(flow, member, "POST", { ...input, method: "PATCH", answers: answers(flow, "未声明edit的合成重试") }));
    expect(repeated).toMatchObject({ id: original.id, updatedAt: original.updatedAt, answers: original.answers });
    const rows = await p.find({ collection: flow === "staff" ? "staff-applications" : "event-signups", overrideAccess: true, depth: 0,
      where: flow === "staff" ? { and: [{ batch: { equals: batch.id } }, { applicant: { equals: member.id } }] }
        : { and: [{ activityType: { equals: flow } }, { activityID: { equals: flow === "events" ? event : post } }, { member: { equals: member.id } }] } });
    expect(rows.totalDocs).toBe(1);
  });
  it("本人POST edit沿用原编号及六人答案；旧revision/version拒绝不改，原PATCH继续成功", async () => {
    const { version, saved } = await submit(flow), changed = answers(flow, "合成POST修改", true);
    const editedResponse = await http(flow, member, "POST", { action: "edit", version, revision: saved.updatedAt, answers: changed });
    const edited = receipt(flow, editedResponse);
    expect(edited.id).toBe(saved.id); expect(edited.updatedAt).not.toBe(saved.updatedAt); expect(edited.answers).toEqual(changed);
    expect(editedResponse.headers.get("cache-control")).toBe("private, no-store");
    expect((await http(flow, member, "POST", { action: "edit", version, revision: saved.updatedAt, answers: answers(flow, "合成旧修订") })).status).toBe(409);
    expect((await http(flow, member, "POST", { action: "edit", version: "synthetic-stale-form", revision: edited.updatedAt, answers: answers(flow) })).status).toBe(409);
    expect(await stored(flow, saved.id)).toMatchObject({ answers: changed, updatedAt: edited.updatedAt });
    const patched = receipt(flow, await http(flow, member, "PATCH", { version, revision: edited.updatedAt, answers: answers(flow, "合成原PATCH修改") }));
    expect(patched.id).toBe(saved.id); expect(patched.answers).toEqual(answers(flow, "合成原PATCH修改"));
  });
  it("GET action=edit始终只读，不能从查询参数变成写入", async () => {
    const { saved } = await submit(flow), before = await stored(flow, saved.id);
    const result = await http(flow, member, "GET", undefined, "?action=edit&revision=" + encodeURIComponent(saved.updatedAt) + "&answers=synthetic-forged");
    expect(result.status).toBe(200); expect(await stored(flow, saved.id)).toEqual(before);
  });
  it("跨申请人伪造id/actor/context仍不能修改他人原记录", async () => {
    const { version, saved } = await submit(flow), before = await stored(flow, saved.id);
    const result = await http(flow, outsider, "POST", { action: "edit", id: saved.id, member: member.id, applicant: member.id,
      actor: { id: member.id, roles: ["president"] }, context: { system: true, updateEventSignup: true, staffApplicationWrite: true },
      version, revision: saved.updatedAt, answers: answers(flow, "合成跨人伪造") });
    expect(result.status).toBe(404); expect(result.body).not.toHaveProperty("signup"); expect(result.body).not.toHaveProperty("application");
    expect(await stored(flow, saved.id)).toEqual(before);
  });
  it("停用账号后旧JWT失去POST edit能力，原答案和revision均不变", async () => {
    const { version, saved } = await submit(flow), before = await stored(flow, saved.id);
    await p.update({ collection: "users", id: member.id, user: president, overrideAccess: false, data: { accountStatus: "suspended" } });
    expect((await http(flow, member, "POST", { action: "edit", version, revision: saved.updatedAt, answers: answers(flow, "合成停用后修改") })).status).toBe(401);
    expect(await stored(flow, saved.id)).toEqual(before);
  });
  it("服务端真实截止窗口拒绝POST edit，不能以新表单version绕过截止", async () => {
    const { version, saved } = await submit(flow), before = await stored(flow, saved.id);
    const end = new Date(Date.now() - 60000).toISOString();
    if (flow === "staff") await saveStaffBatch(p, president, batch.id, batch.updatedAt, { title: batch.title, state: "open",
      endAt: batch.endAt, signupForm: { ...staffSignup, end } });
    else await saveSignupForm(p, flow, flow === "events" ? event : post, president, version, { ...activityForm, end });
    const current = await http(flow, member);
    expect(current.body.state).toContain("截止");
    expect((await http(flow, member, "POST", { action: "edit", version: current.body.version, revision: saved.updatedAt, answers: answers(flow, "合成截止后修改") })).status).toBe(409);
    expect(await stored(flow, saved.id)).toEqual(before);
  });
});
it("骨干审核任职撤销后旧JWT不能review；申请人仍只编辑自己的记录", async () => {
  const { version, saved } = await submit("staff"), before = await stored("staff", saved.id);
  await p.update({ collection: "users", id: reviewer.id, user: president, overrideAccess: false, data: { roles: ["member"] } });
  const denied = await http("staff", reviewer, "POST", { action: "review", id: saved.id, revision: saved.updatedAt, status: "accepted" });
  expect(denied.status).toBe(403); expect(await stored("staff", saved.id)).toEqual(before);
  const own = receipt("staff", await http("staff", member, "POST", { action: "edit", version, revision: saved.updatedAt, answers: answers("staff", "合成仍可本人改稿") }));
  expect(own.id).toBe(saved.id);
});
