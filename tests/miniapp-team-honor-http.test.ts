import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { getPayload, type Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import config from "../src/payload.config";
import type { TeamMembership, User } from "../src/payload-types";
import { serverURL } from "../src/lib/environment";
import { defaultTeamForm } from "../src/lib/team-core";
import { miniappTeamHonorReads } from "../src/lib/miniapp-team-honor";
import { discardHonorVideo, honorVideoPath } from "../src/lib/team-honor-videos";

// The CMS locator is the only mock. Authentication, ACLs, writes, media and SQL stay real.
const locator = vi.hoisted(() => ({ cms: vi.fn() }));
vi.mock("../src/lib/content", () => ({ cms: locator.cms }));
import { GET as listGET, POST as createPOST } from "../src/app/(frontend)/api/team-honors/route";
import { GET as recordGET, POST as recordPOST, PATCH as recordPATCH } from "../src/app/(frontend)/api/team-honors/[id]/route";
import { GET as archiveGET } from "../src/app/(frontend)/api/team-honor-archives/[team]/route";
import { GET as videoGET, HEAD as videoHEAD } from "../src/app/(frontend)/api/team-honor-evidence/[id]/video/route";
import { GET as storageGET, HEAD as storageHEAD } from "../src/app/(frontend)/api/private-team-honor-videos/[filename]/route";
import { GET as coreGET, POST as corePOST } from "../src/app/(frontend)/api/team-core/route";

type Actions = { edit: boolean; save: boolean; submit: boolean; withdraw: boolean; hide: boolean; reviewActions: string[] };
type RecordDTO = { id: number; revision: number; state: string; team: number; game: number; title: string; reviewNote: string | null;
  images: { source: string; caption: string }[]; videoHref: string | null; submittedVersion: string | null; canReview: boolean; actions?: Actions };
type Body = { record: RecordDTO; docs: RecordDTO[]; teams: { id: number; game: number }[]; actions: { create: boolean; review: boolean }; error?: string };
type CoreRow = { id: number; updatedAt: string; team?: number; status?: string };
let p: Payload, leader: User, reviewer: User, player: User, outsider: User, otherReviewer: User;
let game: number, otherGame: number, team: number, batch: number, playerApplication: number, playerMembership: number;
let picture: string, ordinal = 0;
const suffix = randomBytes(6).toString("hex"), password = randomBytes(24).toString("hex");
const tokens = new Map<number, string>(), users: number[] = [], records: number[] = [], videos: string[] = [];
const base = new URL(serverURL).origin, path = "/api/team-honors";
const emptyActions: Actions = { edit: false, save: false, submit: false, withdraw: false, hide: false, reviewActions: [] };
const office = () => [{ game, status: "active" as const, publishContent: true, reviewShowcase: true, handleJoins: true }];
const credential = (actor: User | null): Record<string, string> => actor ? { authorization: "JWT " + tokens.get(actor.id) } : {};
const input = () => ({ team, title: "合成小程序荣誉" + (++ordinal), competition: "合成赛事", placing: "合成奖项", date: "2026-10-01",
  description: "仅用于隔离接口验收的合成成果说明", images: [{ source: picture, caption: "合成静态证据" }] });
const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
async function responseJSON(response: Response) {
  const body = await response.json() as Body;
  if (response.status === 201 && body.record?.id) records.push(body.record.id);
  return { response, body };
}
async function call(actor: User | null, data?: object, id?: number, method: "POST" | "PATCH" = "POST", extra: Record<string, string> = {}, query = "") {
  const headers = new Headers(extra);
  if (actor && !headers.has("authorization") && !headers.has("cookie")) headers.set("authorization", "JWT " + tokens.get(actor.id));
  if (data) headers.set("content-type", "application/json");
  const request = new Request(base + path + (id ? "/" + id : "") + query, { method: data ? method : "GET", headers,
    ...(data ? { body: JSON.stringify(data) } : {}) });
  const response = id ? data ? method === "PATCH" ? await recordPATCH(request, ctx(id)) : await recordPOST(request, ctx(id)) : await recordGET(request, ctx(id))
    : data ? await createPOST(request) : await listGET(request);
  return responseJSON(response);
}
async function core(actor: User, data: object) {
  const response = await corePOST(new Request(base + "/api/team-core", { method: "POST", headers: { ...credential(actor), "content-type": "application/json" }, body: JSON.stringify(data) }));
  const body = await response.json(); expect(response.status, JSON.stringify(body)).toBe(200);
  return body.result as CoreRow;
}
async function join(actor: User) {
  const metadata = await coreGET(new Request(base + "/api/team-core?mode=recruitment&id=" + batch, { headers: credential(actor) }));
  expect(metadata.status).toBe(200); const info = await metadata.json();
  const application = await core(actor, { operation: "save-join", id: batch, action: "submit", version: info.version,
    answers: { gameID: "合成游戏ID", position: "合成位置", experience: "合成经验", availability: "合成训练时间", contact: "synthetic@example.invalid" } });
  const approved = await core(reviewer, { operation: "decide-join", id: application.id, revision: application.updatedAt, decision: "approved", note: "" });
  expect(approved.status).toBe("approved"); return application.id;
}
async function newRecord(actor = player, action = "submit") {
  const saved = await call(actor, { action, input: input() }); expect(saved.response.status).toBe(201); return saved.body.record;
}
async function stored(id: number) { return p.findByID({ collection: "team-honor-records", id, user: player, overrideAccess: false, depth: 0 }); }
async function video(actor: User | null, id: number, query: string, head = false, range?: string) {
  const request = new Request(base + "/api/team-honor-evidence/" + id + "/video?" + query,
    { method: head ? "HEAD" : "GET", headers: { ...credential(actor), ...(range ? { range } : {}) } });
  return head ? videoHEAD(request, ctx(id)) : videoGET(request, ctx(id));
}
const clip = () => { const bytes = Buffer.alloc(64); bytes.writeUInt32BE(24, 0); bytes.write("ftyp", 4); bytes.write("isom", 8); bytes.write("mp41", 16); bytes.write("moov", 24); bytes.write("mdat", 32); return bytes; };
async function videoRecord() {
  const data = input(), form = new FormData();
  for (const [key, value] of Object.entries(data)) if (key !== "images") form.set(key, String(value));
  form.set("action", "submit"); form.set("video", new File([clip()], "synthetic-native.mp4", { type: "video/mp4" }));
  const saved = await responseJSON(await createPOST(new Request(base + path, { method: "POST", headers: credential(player), body: form })));
  expect(saved.response.status).toBe(201);
  const internal = await stored(saved.body.record.id); expect(internal.videoURL).toMatch(/^\/api\/private-team-honor-videos\/[0-9a-f-]+\.mp4$/);
  videos.push(internal.videoURL!); return { record: saved.body.record, internal };
}

beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false" || db.hostname !== "127.0.0.1" || db.port !== "55578" || db.pathname !== "/miniapp_team_qa")
    throw new Error("Only the delegated disposable loopback miniapp_team_qa database is allowed");
  p = await getPayload({ config, key: "miniapp-honor-http-" + suffix }); locator.cms.mockResolvedValue(p);
  async function actor(label: string, roles: User["roles"]) {
    const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true },
      data: { name: label + suffix, email: label + suffix + "@example.invalid", password, roles } });
    users.push(user.id); const login = await p.login({ collection: "users", data: { email: user.email, password } });
    if (!login.token) throw new Error("Synthetic route login required"); tokens.set(user.id, login.token); return user;
  }
  leader = await actor("native-honor-leader", ["president"]); reviewer = await actor("native-honor-reviewer", ["member"]);
  player = await actor("native-honor-player", ["member"]); outsider = await actor("native-honor-outsider", ["backbone"]);
  otherReviewer = await actor("native-honor-other", ["member"]);
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true },
    data: { title: "合成原生荣誉社群", slug: "native-honor-" + suffix, _status: "published" } })).id;
  otherGame = (await p.create({ collection: "games", overrideAccess: true, context: { system: true },
    data: { title: "合成其他荣誉社群", slug: "native-honor-other-" + suffix, _status: "published" } })).id;
  reviewer = await p.update({ collection: "users", id: reviewer.id, user: leader, overrideAccess: false, data: { communityOffices: office() } });
  await p.update({ collection: "users", id: otherReviewer.id, user: leader, overrideAccess: false,
    data: { communityOffices: [{ game: otherGame, status: "active", reviewShowcase: true }] } });
  // A real website HTTP establishment → approval → recruitment → application → admission chain.
  const proposal = await core(reviewer, { operation: "establish", gameID: game, title: "合成原生荣誉代表队" + suffix, reason: "合成固定训练与人工选拔计划" });
  const approved = await core(leader, { operation: "decide-establishment", id: proposal.id, revision: proposal.updatedAt, decision: "approved", note: "" }); team = Number(approved.team);
  batch = (await core(reviewer, { operation: "save-recruitment", teamID: team, title: "合成荣誉资格招新", status: "open",
    form: { ...defaultTeamForm, end: new Date(Date.now() + 86400000).toISOString() } })).id;
  playerApplication = await join(player); await join(reviewer);
  playerMembership = (await p.find({ collection: "team-memberships", user: player, overrideAccess: false, depth: 0, limit: 1,
    where: { and: [{ member: { equals: player.id } }, { team: { equals: team } }] } })).docs[0].id;
  picture = "data:image/png;base64," + (await sharp({ create: { width: 24, height: 24, channels: 3, background: "purple" } }).png().toBuffer()).toString("base64");
}, 90000);
afterAll(async () => {
  if (!p) return;
  if (records.length) await p.delete({ collection: "team-honor-records", overrideAccess: true, where: { id: { in: records } } });
  for (const url of videos) await discardHonorVideo(url);
  if (game) for (const collection of ["team-memberships", "team-join-applications", "team-recruitments", "teams", "team-establishment-applications"] as const)
    await p.delete({ collection, overrideAccess: true, where: { game: { equals: game } } });
  await p.delete({ collection: "audit", overrideAccess: true, where: { actor: { in: users } } });
  for (const id of users) await p.delete({ collection: "users", id, overrideAccess: true, context: { system: true } });
  for (const id of [game, otherGame]) if (id) await p.delete({ collection: "games", id, overrideAccess: true });
  await p.destroy();
});

describe("真实原生荣誉GET能力与原JSON写接口", () => {
  it("真实申请录取产生投稿资格，GET补动作且原201写DTO仍不携动作/私有身份", async () => {
    const saved = await call(player, { action: "save", input: { team, title: "合成部分草稿" } }); expect(saved.response.status).toBe(201);
    expect(saved.body.record).not.toHaveProperty("actions"); expect(saved.body.record.state).toBe("draft");
    const own = await call(player, undefined, saved.body.record.id);
    expect(own.response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(own.body.record.actions).toEqual({ edit: true, save: true, submit: true, withdraw: false, hide: false, reviewActions: [] });
    for (const key of ["author", "membershipRef", "approvedSnapshot", "history", "videoURL", "reviewedBy"]) expect(own.body.record).not.toHaveProperty(key);
    const user = await p.findByID({ collection: "users", id: player.id, overrideAccess: true, depth: 0 });
    expect(user.roles).toEqual(["member"]); expect(user.communityOffices || []).toEqual([]);
  });
  it("team/game显式scope同时过滤创建队伍与审核入口，不能借另一社群能力", async () => {
    const mine = await call(player, undefined, undefined, "POST", {}, "?team=" + team + "&game=" + game);
    expect(mine.body.teams.map(row => row.id)).toEqual([team]); expect(mine.body.actions).toEqual({ create: true, review: false });
    const managed = await call(reviewer, undefined, undefined, "POST", {}, "?team=" + team + "&game=" + game + "&view=review");
    expect(managed.body.actions).toEqual({ create: true, review: true });
    for (const query of ["?game=" + otherGame, "?team=" + team + "&game=" + otherGame, "?team=2147483647"] ) {
      const scoped = await call(reviewer, undefined, undefined, "POST", {}, query);
      expect(scoped.body.teams).toEqual([]); expect(scoped.body.actions).toEqual({ create: false, review: false });
    }
  });
  it("PATCH退回重提、POST撤回保持同编号/数值revision，反馈与当前服务器动作一致", async () => {
    let record = await newRecord(); expect(typeof record.revision).toBe("number");
    expect((await call(player, undefined, record.id)).body.record.actions?.withdraw).toBe(true);
    expect((await call(reviewer, undefined, record.id)).body.record.actions?.reviewActions).toEqual(["approve", "return", "reject"]);
    expect((await call(reviewer, { action: "return", revision: record.revision }, record.id)).response.status).toBe(400);
    record = (await call(reviewer, { action: "return", revision: record.revision, note: "合成补证说明" }, record.id)).body.record;
    expect(record.state).toBe("returned"); expect(record.reviewNote).toBe("合成补证说明"); expect(record).not.toHaveProperty("actions");
    const returned = (await call(player, undefined, record.id)).body.record; expect(returned.actions).toMatchObject({ edit: true, submit: true, withdraw: false });
    const submitted = await call(player, { action: "submit", revision: record.revision, input: { description: "合成修改重提" } }, record.id, "PATCH");
    expect(submitted.response.status).toBe(200); expect(submitted.body.record.id).toBe(record.id); expect(submitted.body.record.revision).toBe(record.revision + 1);
    record = (await call(player, { action: "withdraw", revision: submitted.body.record.revision }, record.id)).body.record;
    expect(record.state).toBe("withdrawn"); expect((await call(player, undefined, record.id)).body.record.actions?.withdraw).toBe(false);
  });
  it("自审和跨社群/普通骨干被真实ACL阻断，合法队员不获得全局审核按钮", async () => {
    const self = await newRecord(reviewer);
    expect((await call(reviewer, undefined, self.id)).body.record.actions?.reviewActions).toEqual([]);
    expect((await call(reviewer, { action: "approve", revision: self.revision, submittedVersion: self.submittedVersion }, self.id)).response.status).toBe(403);
    for (const actor of [outsider, otherReviewer]) {
      expect((await call(actor, undefined, self.id)).response.status).toBe(404);
      const queue = await call(actor, undefined, undefined, "POST", {}, "?view=review&game=" + game);
      expect(queue.body.docs).toEqual([]); expect(queue.body.actions.review).toBe(false);
    }
  });
  it("批准要求精确revision/submittedVersion，重复操作409；匿名档案只有当前批准投影", async () => {
    let record = await newRecord();
    for (const body of [{ action: "approve", revision: record.revision + 1, submittedVersion: record.submittedVersion },
      { action: "approve", revision: record.revision, submittedVersion: "fake-version" }]) expect((await call(reviewer, body, record.id)).response.status).toBe(409);
    const command = { action: "approve", revision: record.revision, submittedVersion: record.submittedVersion };
    const approval = await call(reviewer, command, record.id); expect(approval.response.status).toBe(200); record = approval.body.record;
    expect((await call(reviewer, command, record.id)).response.status).toBe(409);
    const reviewed = (await call(reviewer, undefined, record.id)).body.record; expect(reviewed.actions).toEqual({ ...emptyActions, hide: true });
    const archive = await archiveGET(new Request(base + "/api/team-honor-archives/" + team), { params: Promise.resolve({ team: String(team) }) });
    expect(archive.status).toBe(200); expect(archive.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await archive.json(); expect(body.team.id).toBe(team); expect(body.records.some((row: { key: string }) => row.key === "team-honor-records:" + record.id)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/membershipRef|submittedVersion|reviewNote|approvedSnapshot|videoURL|"author":|"history":/);
  });
  it("DTO动作使用fresh账号；旧JWT撤任失去材料，原审核能力恢复需新GET", async () => {
    const record = await newRecord(), cachedReviewer = reviewer;
    await p.update({ collection: "users", id: reviewer.id, user: leader, overrideAccess: false, data: { communityOffices: [] } });
    try {
      const hints = await miniappTeamHonorReads(p, cachedReviewer, { game }); expect(hints.actions.review).toBe(false);
      const raw = await stored(record.id); expect(await hints.recordActions(raw)).toMatchObject({ reviewActions: [], hide: false });
      expect((await call(reviewer, undefined, record.id)).response.status).toBe(404);
      expect((await call(reviewer, { action: "approve", revision: record.revision, submittedVersion: record.submittedVersion }, record.id)).response.status).toBe(404);
    } finally { reviewer = await p.update({ collection: "users", id: reviewer.id, user: leader, overrideAccess: false, data: { communityOffices: office() } }); }
    expect((await call(reviewer, undefined, record.id)).body.record.actions?.reviewActions).toEqual(["approve", "return", "reject"]);
  });
  it("离队后本人历史仍可读但作者动作全关，授权审核保留退回/拒绝并不能批准", async () => {
    const record = await newRecord(), membership = await p.findByID({ collection: "team-memberships", id: playerMembership, user: player, overrideAccess: false, depth: 0 });
    await core(player, { operation: "leave", id: membership.id, revision: membership.updatedAt, note: "合成离队" });
    try {
      const own = await call(player, undefined, record.id); expect(own.response.status).toBe(200); expect(own.body.record.actions).toEqual(emptyActions);
      expect((await call(player)).body.actions.create).toBe(false);
      expect((await call(reviewer, undefined, record.id)).body.record.actions?.reviewActions).toEqual(["return", "reject"]);
      expect((await call(player, { action: "withdraw", revision: record.revision }, record.id)).response.status).toBe(403);
      expect((await call(reviewer, { action: "approve", revision: record.revision, submittedVersion: record.submittedVersion }, record.id)).response.status).toBe(403);
      expect((await call(reviewer, { action: "return", revision: record.revision, note: "合成离队后补核" }, record.id)).response.status).toBe(200);
    } finally { await p.update({ collection: "team-memberships", id: playerMembership, user: leader, overrideAccess: true,
      context: { system: true, teamCoreWrite: true }, data: { status: "active", leftAt: null, revokedAt: null } }); }
  });
  it("归档队伍不扩展资格政策：禁作者修改/批准，原授权review仍可退回", async () => {
    const record = await newRecord(), current = await p.findByID({ collection: "teams", id: team, user: leader, overrideAccess: false, depth: 0 });
    const archived = await core(leader, { operation: "lifecycle", id: team, status: "archived", revision: current.updatedAt });
    try {
      expect((await call(player, undefined, record.id)).body.record.actions).toEqual(emptyActions);
      const review = await call(reviewer, undefined, record.id); expect(review.body.record.actions?.reviewActions).toEqual(["return", "reject"]);
      expect((await call(reviewer, { action: "return", revision: record.revision, note: "合成归档后核对" }, record.id)).response.status).toBe(200);
    } finally { await core(leader, { operation: "lifecycle", id: team, status: "active", revision: archived.updatedAt }); }
  });
});

describe("真实媒体、原写入白名单与stream边界", () => {
  it("无Origin JWT可写，cookie写需同源；错误JWT不得借环境cookie获得身份", async () => {
    const cookie = "payload-token=" + tokens.get(player.id);
    for (const origin of [undefined, "null", "https://attacker.example.invalid"]) {
      const denied = await call(null, { action: "save", input: input() }, undefined, "POST", { cookie, ...(origin ? { origin } : {}) }); expect(denied.response.status).toBe(403);
    }
    expect((await call(null, { action: "save", input: input() }, undefined, "POST", { cookie, origin: base })).response.status).toBe(201);
    expect((await call(null, { action: "save", input: input() }, undefined, "POST", { cookie, authorization: "JWT invalid.signature.token" })).response.status).toBe(401);
    expect((await call(null, undefined, undefined, "POST", { cookie, authorization: "JWT invalid.signature.token" })).response.status).toBe(401);
    expect((await call(null)).response.status).toBe(401);
  });
  it("伪造身份/context/状态/原视频与任意外链不能写，正文错误不泄露内部资料", async () => {
    for (const data of [{ action: "save", input: input(), author: leader.id }, { action: "save", input: input(), context: { system: true } },
      { action: "save", input: { ...input(), game: otherGame } }, { action: "save", input: { ...input(), videoURL: "/api/private-team-honor-videos/12345678-1234-1234-1234-123456789012.mp4" } },
      { action: "save", input: { ...input(), images: [{ source: "https://example.invalid/proof.png", caption: "外链" }] } }]) {
      const denied = await call(player, data); expect(denied.response.status).toBe(400); expect(denied.body).not.toHaveProperty("record");
      expect(denied.response.headers.get("Cache-Control")).toBe("private, no-store"); expect(denied.body.error).not.toMatch(/SQL|stack|password/i);
    }
    const unsupported = await createPOST(new Request(base + path, { method: "POST", headers: { ...credential(player), "content-type": "text/plain" }, body: "synthetic" }));
    expect(unsupported.status).toBe(415);
  });
  it.each([{ type: "application/json", limit: 17 }, { type: "multipart/form-data; boundary=synthetic", limit: 14 }])("$type无Content-Length的真实分块正文超限即413并取消流", async ({ type, limit }) => {
    let remaining = limit * 1024 * 1024 + 1; const cancelled = vi.fn(), chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { const length = Math.min(remaining, chunk.length); controller.enqueue(chunk.subarray(0, length)); remaining -= length; }, cancel: cancelled }, { highWaterMark: 0 });
    const init = { method: "POST", headers: { ...credential(player), "content-type": type }, body: stream, duplex: "half" };
    const request = new Request(base + path, init); expect(request.headers.has("content-length")).toBe(false);
    const denied = await createPOST(request); expect(denied.status).toBe(413); expect(cancelled).toHaveBeenCalledTimes(1);
    expect(await denied.json()).not.toHaveProperty("record");
  });
  it("multipart私有MP4仅通过当前revision或批准version读取，真实HEAD/Range与原始存储404", async () => {
    const { record, internal } = await videoRecord(); expect(record.videoHref).toBe("/api/team-honor-evidence/" + record.id + "/video?revision=" + record.revision);
    expect(record).not.toHaveProperty("videoURL"); expect((await call(reviewer, undefined, record.id)).body.record.actions?.reviewActions).toEqual(["approve", "return", "reject"]);
    for (const actor of [null, outsider, otherReviewer]) expect((await video(actor, record.id, "revision=" + record.revision)).status).toBe(404);
    expect((await video(player, record.id, "revision=" + (record.revision + 1))).status).toBe(404);
    const partial = await video(reviewer, record.id, "revision=" + record.revision, false, "bytes=0-7"); expect(partial.status).toBe(206);
    expect(partial.headers.get("Content-Range")).toBe("bytes 0-7/64"); expect(Buffer.from(await partial.arrayBuffer())).toEqual(clip().subarray(0, 8));
    const head = await video(player, record.id, "revision=" + record.revision, true); expect(head.status).toBe(200); expect(head.headers.get("Content-Length")).toBe("64"); expect((await head.arrayBuffer()).byteLength).toBe(0);
    expect((await video(player, record.id, "revision=" + record.revision, false, "bytes=999-1000")).status).toBe(416);
    const raw = new Request(base + internal.videoURL); expect((Reflect.apply(storageGET, undefined, [raw]) as Response).status).toBe(404); expect((Reflect.apply(storageHEAD, undefined, [raw]) as Response).status).toBe(404);
    expect((await video(null, record.id, "version=" + record.submittedVersion)).status).toBe(404);
    const approved = await call(reviewer, { action: "approve", revision: record.revision, submittedVersion: record.submittedVersion }, record.id); expect(approved.response.status).toBe(200);
    const publicVideo = await video(null, record.id, "version=" + record.submittedVersion); expect(publicVideo.status).toBe(200); expect(publicVideo.headers.get("Cache-Control")).toBe("private, no-store"); expect(Buffer.from(await publicVideo.arrayBuffer())).toEqual(clip());
    expect((await video(null, record.id, "version=" + "0".repeat(64))).status).toBe(404);
  });
  it("视频字节替换后approve动作消失而return/reject保留，原approve与私人读取都409", async () => {
    const { record, internal } = await videoRecord(); const changed = clip(); changed[63] = 1;
    await writeFile(honorVideoPath(internal.videoURL!), changed);
    expect((await call(reviewer, undefined, record.id)).body.record.actions?.reviewActions).toEqual(["return", "reject"]);
    expect((await call(reviewer, { action: "approve", revision: record.revision, submittedVersion: record.submittedVersion }, record.id)).response.status).toBe(409);
    expect((await video(player, record.id, "revision=" + record.revision)).status).toBe(409);
    expect((await call(reviewer, { action: "return", revision: record.revision, note: "合成证据已变化" }, record.id)).response.status).toBe(200);
  });
  it("即使teamID相同且再次有有效队伍，原membershipRef不同也不能恢复旧记录作者/批准动作", async () => {
    const record = await newRecord(), previous = await p.findByID({ collection: "team-memberships", id: playerMembership, user: player, overrideAccess: false, depth: 0 });
    // Only this test's synthetic authority row is replaced; no second membership collection or fake getter.
    await p.delete({ collection: "team-memberships", id: playerMembership, overrideAccess: true });
    const replacement: TeamMembership = await p.create({ collection: "team-memberships", user: leader, overrideAccess: true, context: { system: true, teamCoreWrite: true },
      data: { title: "合成新的成员关系", team, game, member: player.id, membershipKey: team + ":" + player.id, status: "active",
        joinedAt: previous.joinedAt, sourceApplication: playerApplication, grantedBy: reviewer.id } }); playerMembership = replacement.id;
    expect(replacement.id).not.toBe(previous.id); expect((await call(player)).body.teams.map(row => row.id)).toEqual([team]);
    expect((await call(player, undefined, record.id)).body.record.actions).toEqual(emptyActions);
    expect((await call(reviewer, undefined, record.id)).body.record.actions?.reviewActions).toEqual(["return", "reject"]);
    expect((await call(player, { action: "save", revision: record.revision, input: { description: "合成不能覆盖原关系" } }, record.id)).response.status).toBe(409);
    expect((await call(reviewer, { action: "approve", revision: record.revision, submittedVersion: record.submittedVersion }, record.id)).response.status).toBe(409);
  });
});
