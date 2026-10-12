import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { getPayload, type Payload } from "payload";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import config from "../src/payload.config";
import { serverURL } from "../src/lib/environment";
import type { User } from "../src/payload-types";
import type { OwnTeamProfile, TeamProfilesView } from "../src/lib/team-profiles-model";
import { profileFixture } from "./team-profiles-fixture";

// Only CMS lookup and the wx network transport are replaced. The actual Page,
// profile/http/session modules, JWT, HMAC, ACLs and SQL services all execute.
// profileFixture prepares canonical core rows; it is not a recruitment-flow acceptance test.
const locator = vi.hoisted(() => ({ cms: vi.fn() }));
vi.mock("../src/lib/content", () => ({ cms: locator.cms }));
import { GET, PUT } from "../src/app/(frontend)/api/team-profiles/[teamID]/route";

type Data = Record<string, unknown>;
type Event = { currentTarget: { dataset: { field?: string } }; detail: { value: string | boolean } };
type Login = { token: string; exp: number; user: User };
type NativePage = {
  data: { loading: boolean; busy: boolean; eligible: boolean; locked: boolean; confirmationPending: boolean; error: string; message: string;
    draft: { displayName: string; position: string; biography: string; visible: boolean }; profiles: Data[] };
  setData(value: Data): void; onLoad(value: { team: string }): void; onShow(): Promise<void>; onUnload(): void;
  edit(): void; input(event: Event): void; consent(event: Event): void; preview(): void; save(): Promise<void>; retry(): Promise<void>; reload(): Promise<void>;
};
type WxRequest = { url: string; method: string; header: Record<string, string>; data?: Data;
  success(value: { statusCode: number; data: unknown }): void; fail(): void };
type Modal = { success(value: { confirm: boolean }): void; fail(): void };
type Session = { save(value: Login): void; user(): { id: number } | null };
let p: Payload, fixture: Awaited<ReturnType<typeof profileFixture>>, memberLogin: Login, viewerLogin: Login;
let active: Harness | undefined;
const base = new URL(serverURL).origin, nativeConfig = resolve("miniprogram/src/config.js"), pageFile = resolve("miniprogram/src/pages/team-profiles/index.js");
const event = (field: string, value: string | boolean): Event => ({ currentTarget: { dataset: { field } }, detail: { value } });
const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
const context = (team: number) => ({ params: Promise.resolve({ teamID: String(team) }) });

async function route(method: string, team: number, headers: Record<string, string>, data?: Data) {
  expect(["GET", "PUT"]).toContain(method);
  const request = new Request(base + "/api/team-profiles/" + team, { method, headers, ...(data ? { body: JSON.stringify(data) } : {}) });
  const response = method === "PUT" ? await PUT(request, context(team)) : await GET(request, context(team));
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  return { status: response.status, body: await response.json() as TeamProfilesView & { profile: OwnTeamProfile } };
}
async function read(actor: Login, team = fixture.first.id) {
  const result = await route("GET", team, { Authorization: "JWT " + actor.token }); expect(result.status).toBe(200); return result.body;
}
async function prepareRevisionThree() {
  // Setup uses actual GET-issued credentials and actual PUTs; no fake period or signer.
  for (let revision = 1; revision <= 3; revision++) {
    const view = await read(memberLogin);
    const result = await route("PUT", fixture.first.id, { Authorization: "JWT " + memberLogin.token, Origin: base, "content-type": "application/json" }, {
      revision: view.own.profile?.revision ?? null, membershipVersion: view.own.membershipVersion,
      profile: { displayName: "合成简介基线", position: "合成位置", biography: "合成准备资料" + revision, avatar: null, visible: true },
    });
    expect(result.status).toBe(200); expect(result.body.profile.revision).toBe(revision);
  }
}

function harness(login: Login) {
  let stored: unknown = null, page!: NativePage;
  const requests: { options: WxRequest; settled: boolean }[] = [], patches: Data[] = [], modals: Modal[] = [];
  const fs = { unlink: vi.fn(), readdir(value: { success(data: { files: string[] }): void }) { value.success({ files: [] }); } };
  const wx = { env: { USER_DATA_PATH: "/synthetic-profile-sdk" }, getFileSystemManager: () => fs,
    getStorageSync: () => stored, setStorageSync: (_key: string, value: unknown) => { stored = value; }, removeStorageSync: () => { stored = null; },
    request: vi.fn((options: WxRequest) => {
      // This test transport never opens a website socket, and cannot target production.
      const address = new URL(options.url); expect(address.origin).toBe(base); expect(address.pathname).toMatch(/^\/api\/team-profiles\/[1-9]\d*$/);
      requests.push({ options, settled: false });
    }),
    showModal: vi.fn((value: Modal) => modals.push(value)), setNavigationBarTitle: vi.fn(), stopPullDownRefresh: vi.fn(),
    navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), chooseMedia: vi.fn(), requirePrivacyAuthorize: vi.fn(), openPrivacyContract: vi.fn(),
    uploadFile: vi.fn(), downloadFile: vi.fn(), requestSubscribeMessage: vi.fn(),
  };
  const modules = new Map<string, { exports: unknown }>();
  function load(filename: string): unknown {
    filename = resolve(filename); if (modules.has(filename)) return modules.get(filename)!.exports;
    const module = { exports: {} as unknown }; modules.set(filename, module);
    runInNewContext(readFileSync(filename, "utf8"), { module, wx, getCurrentPages: () => [{}, {}], require: (name: string) => load(resolve(dirname(filename), name + ".js")) });
    // Test-only config object: make the actual SDK Origin agree with the existing route.
    if (filename === nativeConfig) (module.exports as Data).origin = base;
    return module.exports;
  }
  const session = load("miniprogram/src/lib/session.js") as Session; session.save(login);
  runInNewContext(readFileSync(pageFile, "utf8"), { wx, Page: (value: NativePage) => { page = value; },
    require: (name: string) => load(resolve(dirname(pageFile), name + ".js")) });
  page.setData = values => { patches.push(values); Object.assign(page.data, values); };
  const pending = (method: string) => requests.findIndex(value => !value.settled && value.options.method === method);
  const count = (method: string) => requests.filter(value => value.options.method === method).length;
  const deliver = async (index: number) => {
    const entry = requests[index]; expect(entry).toBeDefined(); expect(entry.settled).toBe(false); entry.settled = true;
    const address = new URL(entry.options.url), team = Number(address.pathname.split("/").pop());
    const result = await route(entry.options.method, team, entry.options.header, entry.options.data);
    entry.options.success({ statusCode: result.status, data: result.body }); await flush(); return result;
  };
  const replay = (index: number, body: TeamProfilesView) => {
    const entry = requests[index]; expect(entry.settled).toBe(false); entry.settled = true;
    // The cache is an earlier real HTTP DTO, never a fabricated HMAC or membership response.
    entry.options.success({ statusCode: 200, data: structuredClone(body) });
  };
  const fail = (index: number) => { const entry = requests[index]; expect(entry.settled).toBe(false); entry.settled = true; entry.options.fail(); };
  const dispose = () => { page.onUnload(); for (const entry of requests) if (!entry.settled) { entry.settled = true; entry.options.fail(); } };
  return { page, session, wx, requests, patches, modals, pending, count, deliver, replay, fail, dispose };
}
type Harness = ReturnType<typeof harness>;
function edit(h: Harness, name: string) {
  h.page.edit(); h.page.input(event("displayName", name)); h.page.input(event("biography", "合成用户明确保存的资料"));
  h.page.consent(event("", true)); h.page.preview();
}
async function ready() {
  const h = harness(memberLogin); active = h; h.page.onLoad({ team: String(fixture.first.id) });
  const reading = h.page.onShow(), result = await h.deliver(h.pending("GET")); await reading;
  expect(result.body.own.profile?.revision).toBe(3); expect(h.page.data.eligible).toBe(true); return { h, baseline: result.body };
}
async function acknowledged(h: Harness) {
  edit(h, "合成已确认保存四版"); const saving = h.page.save();
  expect(h.count("PUT")).toBe(1); const put = h.requests[h.pending("PUT")].options;
  expect(put.header.Origin).toBe(base); expect(put.data?.revision).toBe(3);
  const ack = await h.deliver(h.pending("PUT")); expect(ack.status).toBe(200); expect(ack.body.profile.revision).toBe(4);
  expect(h.pending("GET")).toBeGreaterThanOrEqual(0); return { saving, confirmation: h.pending("GET"), ack: ack.body.profile };
}
function privateDataStaysInternal(h: Harness, versions: (string | null)[]) {
  const data = JSON.stringify(h.patches);
  expect(data).not.toMatch(/membershipVersion|PRIVATE_PROFILE_TEST_ANSWER|"membership"|"user"|"revision"/);
  for (const version of versions) if (version) expect(data.includes(version)).toBe(false);
  expect(h.wx.requestSubscribeMessage).not.toHaveBeenCalled(); expect(h.wx.uploadFile).not.toHaveBeenCalled();
  expect(h.wx.chooseMedia).not.toHaveBeenCalled(); expect(h.wx.requirePrivacyAuthorize).not.toHaveBeenCalled();
}

beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  const delegatedQA = db.hostname === "127.0.0.1" && db.port === "55578" && db.pathname === "/miniapp_team_qa_synthetic";
  const integrationQA = db.hostname === "127.0.0.1" && db.port === "55439" &&
    db.pathname === "/zijing_integration_synthetic" && db.username === "zijing";
  const repositoryCI = process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY === "QShin21/zijingwebsite" &&
    db.hostname === "127.0.0.1" && db.port === "5432" && db.pathname === "/zijing" && db.username === "zijing";
  if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false" || !(delegatedQA || integrationQA || repositoryCI)) throw new Error("Explicit disposable profile QA or isolated repository CI database required");
  p = await getPayload({ config, key: "native-profile-confirmation-" + randomBytes(5).toString("hex") }); locator.cms.mockResolvedValue(p);
});
beforeEach(async () => {
  fixture = await profileFixture(p);
  async function login(user: User): Promise<Login> {
    const result = await p.login({ collection: "users", data: { email: user.email, password: fixture.password } });
    if (!result.token || !result.exp) throw new Error("Synthetic profile login required"); return { token: result.token, exp: result.exp, user };
  }
  memberLogin = await login(fixture.member); viewerLogin = await login(fixture.viewer); await prepareRevisionThree();
});
afterEach(async () => {
  active?.dispose(); active = undefined;
  if (!fixture) return;
  const actors = [fixture.admin.id, fixture.member.id, fixture.viewer.id];
  await p.delete({ collection: "audit", overrideAccess: true, where: { or: [{ actor: { in: actors } }, { object: { in: actors.map(id => "users:" + id) } }] } });
  await fixture.cleanup();
});
afterAll(async () => { if (p) await p.destroy(); });

describe("简介成功ACK后的真实Page/HTTP/SQL确认边界", () => {
  it.each(["network", "cache"])("GET真实rev3→PUT ACK4→确认GET %s：不再写，手动GET4后明确保存才写5", async outcome => {
    const { h, baseline } = await ready(), operation = await acknowledged(h);
    if (outcome === "network") h.fail(operation.confirmation); else h.replay(operation.confirmation, baseline);
    await operation.saving;
    expect(h.page.data).toMatchObject({ busy: false, loading: false, confirmationPending: true, draft: { displayName: operation.ack.displayName } });
    expect(h.page.data.error).toBeTruthy(); edit(h, "合成禁止未确认再写"); const blocked = h.page.save();
    expect(h.count("PUT")).toBe(1); expect(h.count("POST")).toBe(0); await blocked;
    expect((await read(memberLogin)).own.profile?.revision).toBe(4);
    const retrying = h.page.retry(), fresh = await h.deliver(h.pending("GET")); await retrying;
    expect(fresh.body.own.profile?.revision).toBe(4); expect(h.page.data.confirmationPending).toBe(false); expect(h.count("PUT")).toBe(1);
    edit(h, "合成用户明确保存五版"); const savingAgain = h.page.save();
    expect(h.count("PUT")).toBe(2); expect(h.requests[h.pending("PUT")].options.data?.revision).toBe(4);
    const secondAck = await h.deliver(h.pending("PUT")); expect(secondAck.body.profile.revision).toBe(5);
    const secondRead = await h.deliver(h.pending("GET")); await savingAgain;
    expect(secondRead.body.own.profile?.revision).toBe(5); expect((await read(memberLogin)).own.profile?.displayName).toBe("合成用户明确保存五版");
    expect(h.page.data).toMatchObject({ confirmationPending: false, locked: false, busy: false });
    privateDataStaysInternal(h, [baseline.own.membershipVersion]);
  });
  it("ACK后真实新周期GET默认隐藏并锁住，明确reload及新同意才使用新HMAC保存", async () => {
    const { h, baseline } = await ready(), operation = await acknowledged(h);
    const joinedAt = new Date(Math.max(Date.now(), Date.parse(fixture.membership.joinedAt) + 1)).toISOString();
    await fixture.changeMembership({ status: "revoked", leftAt: joinedAt, revokedAt: joinedAt });
    await fixture.changeMembership({ status: "active", joinedAt, leftAt: null, revokedAt: null });
    const fresh = await h.deliver(operation.confirmation); await operation.saving;
    expect(fresh.body.own.membershipVersion).not.toBe(baseline.own.membershipVersion); expect(fresh.body.own.profile?.visible).toBe(false);
    expect(h.page.data).toMatchObject({ locked: true, draft: { visible: false } });
    edit(h, "合成不能沿用旧同意"); const blocked = h.page.save(); expect(h.count("PUT")).toBe(1); await blocked;
    const reloading = h.page.reload(); expect(h.modals).toHaveLength(1); h.modals[0].success({ confirm: true }); await flush();
    const reloaded = await h.deliver(h.pending("GET")); await reloading;
    expect(h.page.data).toMatchObject({ locked: false, draft: { visible: false } }); expect(h.count("PUT")).toBe(1);
    edit(h, "合成新周期主动同意"); const saving = h.page.save(), request = h.requests[h.pending("PUT")].options;
    expect(request.data).toMatchObject({ revision: reloaded.body.own.profile!.revision, membershipVersion: fresh.body.own.membershipVersion, profile: { visible: true } });
    const ack = await h.deliver(h.pending("PUT")); expect(ack.status).toBe(200); expect(ack.body.profile.visible).toBe(true);
    await h.deliver(h.pending("GET")); await saving;
    expect((await read(memberLogin)).own.profile?.visible).toBe(true); expect(h.count("PUT")).toBe(2); expect(h.count("POST")).toBe(0);
    privateDataStaysInternal(h, [baseline.own.membershipVersion, fresh.body.own.membershipVersion]);
  });
  it.each(["actor", "route"])("成功ACK后%s变化，旧确认GET不把旧本人草稿或权限写入当前页", async change => {
    const { h, baseline } = await ready(), operation = await acknowledged(h);
    if (change === "actor") h.session.save(viewerLogin);
    else { h.page.onLoad({ team: String(fixture.second.id) }); await h.page.onShow(); }
    const old = await h.deliver(operation.confirmation); expect(old.body.own.profile?.revision).toBe(4);
    const index = h.pending("GET"); expect(index).toBeGreaterThanOrEqual(0);
    const current = await h.deliver(index); await operation.saving;
    expect(current.body.own.eligible).toBe(false); expect(current.body.own.profile).toBeNull();
    expect(h.page.data).toMatchObject({ eligible: false, confirmationPending: false, draft: { displayName: "", visible: false }, message: "" });
    if (change === "actor") expect(h.session.user()?.id).toBe(fixture.viewer.id);
    else expect(h.requests[index].options.url).toBe(base + "/api/team-profiles/" + fixture.second.id);
    edit(h, "合成旧范围禁止再写"); const blocked = h.page.save(); expect(h.count("PUT")).toBe(1); expect(h.count("POST")).toBe(0); await blocked;
    privateDataStaysInternal(h, [baseline.own.membershipVersion]);
  });
});
