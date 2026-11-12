
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createLocalReq, getPayload, logoutOperation, type Payload } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import config from "../src/payload.config";
import { serverURL } from "@/lib/environment";
import { beijingInputTime } from "@/lib/rules";
import { seatAPI, seatKeys, type SeatingKind, type SeatingState } from "@/lib/activity-seating-model";
import type { User } from "@/payload-types";
import * as route from "@/app/(frontend)/api/activities/[kind]/[id]/seating/route";
import { POST as uploadProof } from "@/app/(frontend)/api/activities/[kind]/[id]/seating/proofs/route";
import * as proofRoute from "@/app/(frontend)/api/activities/[kind]/[id]/seating/proofs/[proof]/route";

const locator = vi.hoisted(() => ({ cms: vi.fn() }));
vi.mock("../src/lib/content", () => ({ cms: locator.cms }));

type Actor = { user: User; token: string };
type Activity = { kind: SeatingKind; id: number };
let p: Payload;
let president: Actor, reviewer: Actor, otherReviewer: Actor, first: Actor, second: Actor;
let event: Activity, post: Activity;
let mainScope: number;
let picture: Uint8Array<ArrayBuffer>;
const users: number[] = [], games: number[] = [], activities: Activity[] = [];
const suffix = randomBytes(5).toString("hex");
const origin = new URL(serverURL).origin;

async function game(name: string) {
  const value = await p.create({
    collection: "games", overrideAccess: true, context: { system: true },
    data: { title: name, slug: `seats-${name}-${suffix}`, _status: "published" },
  });
  games.push(value.id);
  return value.id;
}

async function actor(name: string, roles: User["roles"], scope?: number) {
  const email = `seats-${name}-${suffix}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const user = await p.create({
    collection: "users", overrideAccess: true, context: { system: true },
    data: { email, password, name: name + "-" + suffix, roles, communityOffices: scope ? [{ game: scope, status: "active" }] : undefined },
  });
  users.push(user.id);
  const login = await p.login({ collection: "users", data: { email, password } });
  if (!login.token) throw new Error("Synthetic account could not log in");
  return { user, token: login.token };
}

function request(activity: Activity, method: string, who?: Actor, data?: unknown, suffix = "", browserOrigin?: string) {
  const headers = new Headers();
  if (who) headers.set(browserOrigin === undefined ? "Authorization" : "Cookie",
    browserOrigin === undefined ? `JWT ${who.token}` : `payload-token=${who.token}`);
  if (browserOrigin !== undefined) headers.set("Origin", browserOrigin);
  if (data && !(data instanceof FormData)) headers.set("Content-Type", "application/json");
  return new Request(origin + seatAPI(activity.kind, activity.id) + suffix, {
    method, headers, body: data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data),
  });
}
function context(activity: Activity) {
  return { params: Promise.resolve({ kind: activity.kind, id: String(activity.id) }) };
}
function proofContext(activity: Activity, proof: string) {
  return { params: context(activity).params.then(params => ({ ...params, proof })) };
}
async function map(activity: Activity, who?: Actor): Promise<SeatingState> {
  const response = await route.GET(request(activity, "GET", who), context(activity));
  expect(response.status).toBe(200);
  return response.json();
}
async function put(activity: Activity, who: Actor, enabled: boolean, browserOrigin?: string) {
  return route.PUT(request(activity, "PUT", who, { enabled }, "", browserOrigin), context(activity));
}
async function upload(activity: Activity, who: Actor, valid = true) {
  const form = new FormData();
  form.set("file", new File([valid ? picture : "not an image"], "proof.png", { type: "image/png" }));
  return uploadProof(request(activity, "POST", who, form, "/proofs"), context(activity));
}
async function added(activity: Activity, who: Actor) {
  const result = await upload(activity, who);
  expect(result.status).toBe(201);
  return (await result.json()).id as string;
}
async function submit(activity: Activity, who: Actor, seats: string[], proofs: string[], phone = "13800138000") {
  return route.POST(request(activity, "POST", who, { seats, proofs, phone }), context(activity));
}
async function decide(activity: Activity, who: Actor, id: number, status: string) {
  return route.POST(request(activity, "POST", who, { action: "review", id, status }), context(activity));
}
async function edit(activity: Activity, who: Actor, data: unknown) {
  return route.PATCH(request(activity, "PATCH", who, data), context(activity));
}
async function cancel(activity: Activity, who: Actor, id: number, revision: number) {
  return route.DELETE(request(activity, "DELETE", who, { id, revision }), context(activity));
}
async function block(activity: Activity, who: Actor | undefined, seats: string[], blocked: boolean, browserOrigin?: string) {
  return route.POST(request(activity, "POST", who, { action: "block", seats, blocked }, "", browserOrigin), context(activity));
}
async function image(activity: Activity, proof: string, who?: Actor) {
  return proofRoute.GET(request(activity, "GET", who, undefined, "/proofs/" + proof), proofContext(activity, proof));
}
async function review(activity: Activity, who: Actor) {
  return route.GET(request(activity, "GET", who, undefined, "?mode=review"), context(activity));
}

beforeAll(async () => {
  const database = new URL(process.env.DATABASE_URL!);
  if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false" ||
      !["localhost", "127.0.0.1"].includes(database.hostname) ||
      !["/zijing_v2_backend_synthetic", "/zijing_rebuild_contracts_synthetic"].includes(database.pathname))
    throw new Error("Activity seating checks require an isolated loopback database");
  p = await getPayload({ config, key: "activity-seating-" + suffix });
  locator.cms.mockResolvedValue(p);
  president = await actor("president", ["president"]);
  const scope = await game("home"), other = await game("other");
  mainScope = scope;
  reviewer = await actor("reviewer", ["member"], scope);
  otherReviewer = await actor("other-reviewer", ["member"], other);
  first = await actor("first", ["member"]);
  second = await actor("second", ["member"]);
  const seeded = await p.create({
    collection: "events", user: president.user, overrideAccess: false,
    data: { title: "合成影院选座活动", slug: "seats-" + suffix, game: scope, _status: "published" },
  });
  event = { kind: "events", id: seeded.id };
  activities.push(event);
  const local = await p.create({
    collection: "community-posts", overrideAccess: true,
    user: president.user, data: { title: "合成社群选座活动", game: scope, author: president.user.id, category: "event", body: "合成材料" },
  });
  post = { kind: "community-posts", id: local.id };
  activities.push(post);
  picture = new Uint8Array(await sharp({
    create: { width: 48, height: 32, channels: 3, background: "#865f6a" },
  }).png().toBuffer());
});

afterAll(async () => {
  if (!p) return;
  for (const activity of activities) await p.delete({ collection: activity.kind, id: activity.id, overrideAccess: true });
  for (const id of users) await p.delete({ collection: "users", id, overrideAccess: true, context: { system: true } });
  for (const id of games) await p.delete({ collection: "games", id, overrideAccess: true });
  await p.destroy();
});

it("有权人员按活动启用 381 个座位，普通成员和外社群任职不可管理", async () => {
  const disabled = await map(event);
  expect(disabled).toMatchObject({ enabled: false, open: false, occupancy: {}, mine: null, drafts: [] });
  expect(disabled.rows.map(row => row.count)).toEqual([27, 31, 35, 37, 37, 37, 37, 26, 26, 24, 31, 33]);
  expect(new Set(seatKeys).size).toBe(381);
  expect((await put(event, first, true)).status).toBe(403);
  expect((await put(event, otherReviewer, true)).status).toBe(403);
  expect((await put(event, reviewer, true, "https://elsewhere.invalid")).status).toBe(403);
  expect((await put(event, reviewer, true, origin)).status).toBe(200);
  expect((await map(event)).open).toBe(true);
  expect((await map(post, first)).enabled).toBe(false);
  expect((await put(post, president, true)).status).toBe(200);
  expect((await map(post, first)).open).toBe(true);
});

it("校验凭证与座位上限，并发重叠选座只保留完整的一份申请", async () => {
  expect((await put(event, reviewer, true)).status).toBe(200);
  expect((await upload(event, first, false)).status).toBe(400);
  const firstProof = await added(event, first);
  const secondProof = await added(event, second);
  expect((await image(event, firstProof, reviewer)).status).toBe(404);
  expect((await image(event, firstProof, second)).status).toBe(404);
  expect((await image(event, firstProof, first)).headers.get("content-type")).toBe("image/webp");
  expect((await submit(event, first, ["1-1"], [secondProof])).status).toBe(409);
  expect((await submit(event, first, seatKeys.slice(0, 11), [firstProof])).status).toBe(400);
  expect((await submit(event, first, ["1-1"], [firstProof], "invalid")).status).toBe(400);
  expect((await map(event)).occupancy).toEqual({});

  const attempts = await Promise.all([
    submit(event, first, ["1-1", "1-2"], [firstProof]),
    submit(event, second, ["1-2", "1-3"], [secondProof]),
  ]);
  expect(attempts.map(response => response.status).sort()).toEqual([200, 409]);
  const winner = attempts[0].ok ? first : second, loser = winner === first ? second : first;
  const winningProof = winner === first ? firstProof : secondProof;
  const losingProof = winner === first ? secondProof : firstProof;
  const saved = await attempts.find(response => response.ok)!.json();
  const occupied = await map(event);
  expect(Object.keys(occupied.occupancy).sort()).toEqual([...saved.mine.seats].sort());
  expect(Object.values(occupied.occupancy)).toEqual(["pending", "pending"]);
  expect(occupied.mine).toBeNull();
  expect(occupied.drafts).toEqual([]);
  expect(JSON.stringify(occupied)).not.toContain("13800138000");
  expect((await map(event, loser)).drafts).toEqual([losingProof]);
  const replay = await submit(event, winner, saved.mine.seats, [winningProof]);
  expect(await replay.json()).toMatchObject(saved);
  expect((await review(event, otherReviewer)).status).toBe(403);
  expect((await decide(event, otherReviewer, saved.mine.id, "confirmed")).status).toBe(403);
  const visible = await review(event, reviewer);
  expect(visible.headers.get("cache-control")).toContain("no-store");
  expect(await visible.json()).toMatchObject({ docs: [{ id: saved.mine.id, phone: "13800138000", proofs: [winningProof] }] });
  expect((await image(event, winningProof)).status).toBe(401);
  expect((await image(event, winningProof, reviewer)).status).toBe(200);
  expect((await image(post, winningProof, reviewer)).status).toBe(404);
  expect((await decide(event, reviewer, saved.mine.id, "rejected")).status).toBe(200);
  expect((await map(event)).occupancy).toEqual({});
  expect((await map(event, winner)).mine?.status).toBe("rejected");

  const replacement = await added(event, winner);
  const resubmitted = await submit(event, winner, saved.mine.seats, [replacement]);
  expect(resubmitted.status).toBe(200);
  const current = (await resubmitted.json()).mine.id;
  const decisions = await Promise.all([
    decide(event, reviewer, current, "confirmed"),
    decide(event, president, current, "rejected"),
  ]);
  expect(decisions.map(response => response.status).sort()).toEqual([200, 409]);
  const own = await map(event, winner);
  if (own.mine?.status === "confirmed") {
    expect(Object.values(own.occupancy)).toEqual(["confirmed", "confirmed"]);
  } else expect(own.occupancy).toEqual({});
  expect((await put(event, reviewer, false)).status).toBe(200);
  expect((await map(event, winner)).mine).toEqual(own.mine);
  expect((await map(event, winner)).open).toBe(false);
});

it("社群活动接受 10 张凭证与 10 个座位，启停独立于站点活动", async () => {
  expect((await put(post, reviewer, true)).status).toBe(200);
  const proofs: string[] = [];
  for (let index = 0; index < 10; index++) proofs.push(await added(post, first));
  expect((await upload(post, first)).status).toBe(409);
  const removed = proofs.pop()!;
  const deletion = await proofRoute.DELETE(request(post, "DELETE", first, undefined, "/proofs/" + removed), proofContext(post, removed));
  expect(deletion.status).toBe(200);
  proofs.push(await added(post, first));
  const saved = await submit(post, first, seatKeys.slice(0, 10), proofs);
  expect(saved.status).toBe(200);
  const { mine } = await saved.json();
  expect((await decide(post, reviewer, mine.id, "confirmed")).status).toBe(200);
  expect((await map(post, first)).mine?.status).toBe("confirmed");
  expect(Object.values((await map(post, first)).occupancy)).toEqual(Array(10).fill("confirmed"));
  expect((await upload(post, first)).status).toBe(409);
});

async function extraActivity(label: string, kind: SeatingKind = 'events'): Promise<Activity> {
  const doc = kind === 'events' ? await p.create({ collection: kind, user: president.user, overrideAccess: false,
    data: { title: '合成选座边界-' + label, slug: 'seat-check-' + label + '-' + suffix, game: mainScope, _status: 'published' } })
    : await p.create({ collection: kind, user: president.user, overrideAccess: true,
      data: { title: '合成社群选座-' + label, game: mainScope, author: president.user.id, category: 'event', body: '合成边界资料' } });
  const activity = { kind, id: doc.id };
  activities.push(activity);
  expect((await put(activity, president, true)).status).toBe(200);
  return activity;
}

it('new 社群登录、父社群可见性及结束时间约束覆盖座位图、上传和提交', async () => {
  const activity = await extraActivity('visibility', 'community-posts');
  expect((await route.GET(request(activity, 'GET'), context(activity))).status).toBe(401);
  const proof = await added(activity, second);
  await p.db.drizzle.execute(sql`UPDATE community_posts SET end_at = now() - interval '1 hour' WHERE id = ${activity.id}`);
  expect((await map(activity, second)).open).toBe(false);
  expect((await upload(activity, second)).status).toBe(409);
  expect((await submit(activity, second, ['1-1'], [proof])).status).toBe(409);
  await p.db.drizzle.execute(sql`UPDATE community_posts SET end_at = NULL WHERE id = ${activity.id}`);
  await p.db.drizzle.execute(sql`UPDATE games SET _status = 'draft' WHERE id = ${mainScope}`);
  try {
    expect((await route.GET(request(activity, 'GET', second), context(activity))).status).toBe(404);
    expect((await upload(activity, second)).status).toBe(404);
    expect((await submit(activity, second, ['1-1'], [proof])).status).toBe(404);
  } finally { await p.db.drizzle.execute(sql`UPDATE games SET _status = 'published' WHERE id = ${mainScope}`); }
  await p.db.drizzle.execute(sql`UPDATE games SET demo = true WHERE id = ${mainScope}`);
  vi.stubEnv('APP_ENV', 'production');
  try {
    expect((await route.GET(request(activity, 'GET', second), context(activity))).status).toBe(404);
  } finally {
    vi.unstubAllEnvs();
    await p.db.drizzle.execute(sql`UPDATE games SET demo = false WHERE id = ${mainScope}`);
  }
  expect((await map(activity, second)).occupancy).toEqual({});
  expect((await map(activity, second)).drafts).toContain(proof);
});

it('保留 main 的独立任职审核合同，但撤任立即失去手机号与凭证访问', async () => {
  const activity = await extraActivity('office');
  const scoped = await actor('limited-' + suffix, ['member'], mainScope);
  await p.update({ collection: 'users', id: scoped.user.id, overrideAccess: true, context: { system: true }, data: {
    communityOffices: [{ game: mainScope, status: 'active', publishContent: false, reviewShowcase: false,
      handleJoins: false, viewSignups: false, exportSignups: false, contactConsent: false }],
  } });
  expect((await put(activity, scoped, true)).status).toBe(200);
  const proof = await added(activity, first);
  const submitted = await submit(activity, first, ['2-1'], [proof]);
  const saved = (await submitted.json()).mine;
  expect((await review(activity, scoped)).status).toBe(200);
  expect((await image(activity, proof, scoped)).status).toBe(200);
  await p.update({ collection: 'users', id: scoped.user.id, overrideAccess: true, context: { system: true },
    data: { communityOffices: [{ game: mainScope, status: 'revoked' }] } });
  expect((await review(activity, scoped)).status).toBe(403);
  expect((await image(activity, proof, scoped)).status).toBe(404);
  expect((await decide(activity, scoped, saved.id, 'confirmed')).status).toBe(403);
  expect((await map(activity, first)).mine?.status).toBe('pending');
  expect((await put(activity, president, false)).status).toBe(200);
  expect((await decide(activity, president, saved.id, 'confirmed')).status).toBe(200);
  expect((await map(activity, first)).mine?.status).toBe('confirmed');
});

it('显式 Authorization 不回退 Cookie 身份，封禁和注销后不再读取私有凭证', async () => {
  const activity = await extraActivity('auth');
  for (const authorization of ['JWT invalid', 'jwt invalid', 'Bearer invalid', 'JWT malformed token']) {
    const req = request(activity, 'GET', undefined, undefined, '?mode=review');
    req.headers.set('Authorization', authorization); req.headers.set('Cookie', 'payload-token=' + president.token);
    expect((await route.GET(req, context(activity))).status).toBe(401);
  }
  const mixed = request(activity, 'GET', first, undefined, '?mode=review');
  mixed.headers.set('Cookie', 'payload-token=' + president.token);
  expect((await route.GET(mixed, context(activity))).status).toBe(403);
  const owner = await actor('auth-owner-' + suffix, ['member']);
  const proof = await added(activity, owner);
  const own = await image(activity, proof, owner);
  expect(own.status).toBe(200); expect(own.headers.get('cache-control')).toContain('no-store');
  expect(own.headers.get('vary')).toBe('Cookie, Authorization');
  await p.update({ collection: 'users', id: owner.user.id, overrideAccess: true, context: { system: true }, data: { accountStatus: 'suspended' } });
  expect((await image(activity, proof, owner)).status).toBe(401);
  expect((await submit(activity, owner, ['3-1'], [proof])).status).toBe(401);
  await p.update({ collection: 'users', id: owner.user.id, overrideAccess: true, context: { system: true }, data: { accountStatus: 'active' } });
  const auth = await p.auth({ headers: new Headers({ authorization: 'JWT ' + owner.token }) });
  expect(auth.user).toBeTruthy();
  const req = await createLocalReq({ user: auth.user! }, p);
  await logoutOperation({ collection: p.collections.users, req, allSessions: false });
  expect((await image(activity, proof, owner)).status).toBe(401);
});

it('并发上传不超过十张，同一账号并发提交仅生成一份完整申请', async () => {
  const activity = await extraActivity('parallel');
  const owner = await actor('parallel-' + suffix, ['member']);
  const uploads = await Promise.all(Array.from({ length: 11 }, () => upload(activity, owner)));
  expect(uploads.filter(response => response.status === 201)).toHaveLength(10);
  expect(uploads.filter(response => response.status === 409)).toHaveLength(1);
  const proofs = (await map(activity, owner)).drafts;
  expect(proofs).toHaveLength(10);
  const results = await Promise.all([
    submit(activity, owner, ['4-1'], [proofs[0]]), submit(activity, owner, ['4-2'], [proofs[1]]),
  ]);
  expect(results.map(response => response.status)).toEqual([200, 200]);
  const receipts = await Promise.all(results.map(response => response.json()));
  expect(receipts[0]).toEqual(receipts[1]);
  expect(Object.keys((await map(activity)).occupancy)).toHaveLength(1);
  const counts = await p.db.drizzle.execute(sql`SELECT count(*)::int n FROM activity_seat_requests r JOIN activity_seatings s ON s.id = r.seating_id WHERE s.event_id = ${activity.id}`);
  expect(counts.rows[0].n).toBe(1);
});

// Keep an uncommitted mutation on a separate connection. The tested request reads
// the previous committed state, waits on FOR SHARE, then must honor the change.
async function requestAcrossMutation(mutation: string, values: unknown[], table: string, work: () => Promise<Response>) {
  const pool = (p.db as unknown as PostgresAdapter).pool;
  const client = await pool.connect();
  let pending: Promise<Response> | undefined;
  try {
    await client.query('BEGIN'); await client.query(mutation, values);
    pending = work();
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const waits = await pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE $1", [`SELECT id FROM ${table} WHERE id = $1 FOR SHARE%`]);
      if (waits.rows[0].n) { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(waiting).toBe(true);
    await client.query('COMMIT');
    return await pending;
  } finally {
    await client.query('ROLLBACK'); client.release();
    if (pending) await pending;
  }
}

it('等待活动锁期间结束活动，提交复查后拒绝且不吞凭证', async () => {
  const activity = await extraActivity('queued-end');
  const proof = await added(activity, second);
  const result = await requestAcrossMutation("UPDATE events SET lifecycle = 'ended' WHERE id = $1", [activity.id], 'events',
    () => submit(activity, second, ['5-1'], [proof]));
  expect(result.status).toBe(409);
  expect((await map(activity, second)).occupancy).toEqual({});
  expect((await map(activity, second)).drafts).toContain(proof);
});

it('等待账号锁期间停用账号，上传在锁后复核身份且不保存图片', async () => {
  const activity = await extraActivity('queued-suspend');
  const owner = await actor('queued-' + suffix, ['member']);
  const result = await requestAcrossMutation("UPDATE users SET account_status = 'suspended' WHERE id = $1", [owner.user.id], 'users',
    () => upload(activity, owner));
  expect(result.status).toBe(401);
  const rows = await p.db.drizzle.execute(sql`SELECT count(*)::int n FROM activity_seat_proofs WHERE member_id = ${owner.user.id}`);
  expect(rows.rows[0].n).toBe(0);
});

it('未知JSON字段、无效座位与过期凭证不能产生部分申请', async () => {
  const activity = await extraActivity('validation');
  const proof = await added(activity, first);
  const spoof = await route.POST(request(activity, 'POST', first, { seats: ['6-1'], proofs: [proof], phone: '13800138000', member: second.user.id }), context(activity));
  expect(spoof.status).toBe(400);
  expect((await submit(activity, first, ['1-1', '1-1'], [proof])).status).toBe(400);
  expect((await submit(activity, first, ['999-1'], [proof])).status).toBe(400);
  await p.db.drizzle.execute(sql`UPDATE activity_seat_proofs SET created_at = now() - interval '2 days' WHERE id = ${proof}::uuid`);
  expect((await submit(activity, first, ['6-1'], [proof])).status).toBe(409);
  expect((await image(activity, proof, first)).status).toBe(404);
  expect((await map(activity)).occupancy).toEqual({});
});


it('等待座位行锁自然跨过截止时间也必须拒绝，保留未消费凭证', async () => {
  const activity = await extraActivity('natural-deadline');
  const proof = await added(activity, first);
  const pool = (p.db as unknown as PostgresAdapter).pool;
  const client = await pool.connect();
  let pending: Promise<Response> | undefined;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM activity_seatings WHERE event_id = $1 FOR UPDATE', [activity.id]);
    const result = await pool.query("UPDATE events SET end_at = now() + interval '2 seconds' WHERE id = $1 RETURNING end_at", [activity.id]);
    const end = result.rows[0].end_at.getTime();
    pending = submit(activity, first, ['7-1'], [proof]);
    let waiting = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const waits = await pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'SELECT id, enabled, opens_at FROM activity_seatings WHERE%FOR UPDATE'");
      if (waits.rows[0].n) { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(waiting).toBe(true);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, end - Date.now() + 50)));
    await client.query('COMMIT');
    expect((await pending).status).toBe(409);
    expect((await map(activity, first)).drafts).toContain(proof);
    expect((await map(activity)).occupancy).toEqual({});
  } finally {
    await client.query('ROLLBACK'); client.release();
    if (pending) await pending;
  }
});

it("按北京时间到点开放，开放前禁止上传和提交，停用后清除定时", async () => {
  const seeded = await p.create({
    collection: "events", user: president.user, overrideAccess: false,
    data: { title: "合成定时选座活动", slug: "timed-seats-" + suffix, _status: "published" },
  });
  const activity: Activity = { kind: "events", id: seeded.id };
  activities.push(activity);
  const time = beijingInputTime(new Date(Date.now() + 5 * 60_000).toISOString());
  const expected = new Date(time + ":00+08:00");
  const schedule = (actor: Actor, opensAt: string) => route.PUT(
    request(activity, "PUT", actor, { enabled: true, opensAt }), context(activity),
  );
  expect((await schedule(first, time)).status).toBe(403);
  expect((await schedule(president, "2027-02-31T18:00")).status).toBe(400);
  expect((await schedule(president, "2000-01-01T18:00")).status).toBe(400);
  const saved = await schedule(president, time);
  expect(saved.status).toBe(200);
  expect(await saved.json()).toMatchObject({ enabled: true, scheduled: true, open: false, opensAt: expected.toISOString() });
  expect(await map(activity, first)).toMatchObject({ scheduled: true, open: false, opensAt: expected.toISOString() });
  expect((await upload(activity, first)).status).toBe(409);
  expect((await submit(activity, first, ["1-1"], ["88714164-37a2-4afa-a69f-3bbfc336d3d1"])).status).toBe(409);

  const clock = vi.spyOn(Date, "now").mockReturnValue(expected.getTime());
  try {
    expect(await map(activity, first)).toMatchObject({ scheduled: false, open: true });
    const proof = await added(activity, first);
    expect((await submit(activity, first, ["1-1"], [proof])).status).toBe(200);
  } finally {
    clock.mockRestore();
  }
  expect((await put(activity, president, false)).status).toBe(200);
  expect(await map(activity, first)).toMatchObject({ enabled: false, open: false, opensAt: null, mine: { status: "pending" } });
  expect((await put(activity, president, true)).status).toBe(200);
  expect(await map(activity, first)).toMatchObject({ enabled: true, open: true, opensAt: null });
});

it("按活动预设和批量解锁未开放座位，兼容旧版座位图并保护已有申请", async () => {
  const seeded = await p.create({ collection: "events", user: president.user, overrideAccess: false,
    data: { title: "合成锁座活动", slug: "seat-block-" + suffix, game: mainScope, _status: "published" } });
  const activity: Activity = { kind: "events", id: seeded.id };
  activities.push(activity);
  const seats = seatKeys.slice(0, 25);
  expect((await block(activity, undefined, seats, true)).status).toBe(403);
  expect((await block(activity, first, seats, true)).status).toBe(403);
  expect((await block(activity, otherReviewer, seats, true)).status).toBe(403);
  expect((await block(activity, reviewer, seats, true, "https://elsewhere.invalid")).status).toBe(403);
  expect((await block(activity, reviewer, ["1-1", "1-1"], true)).status).toBe(400);
  expect((await block(activity, reviewer, ["999-1"], true)).status).toBe(400);
  expect((await block(activity, reviewer, seats, true)).status).toBe(200);
  expect(await map(activity, reviewer)).toMatchObject({ enabled: false, blockedSeats: expect.arrayContaining(seats) });
  expect((await map(activity, first)).blockedSeats).toEqual([]);
  expect((await map(event, reviewer)).blockedSeats).toEqual([]);
  expect((await put(activity, reviewer, true)).status).toBe(200);
  const open = await map(activity, first);
  expect(open.blockedSeats).toHaveLength(25);
  expect(seats.every(seat => open.occupancy[seat] === "confirmed")).toBe(true);
  const proof = await added(activity, first);
  expect((await submit(activity, first, [seats[0]], [proof])).status).toBe(409);
  expect((await map(activity, first)).drafts).toContain(proof);
  expect((await block(activity, reviewer, seats.slice(0, 2), false)).status).toBe(200);
  const submitted = await submit(activity, first, [seats[0]], [proof]);
  expect(submitted.status).toBe(200);
  const mine = (await submitted.json()).mine;
  expect((await block(activity, reviewer, [seats[0], seats[1]], true)).status).toBe(409);
  const afterConflict = await map(activity, first);
  expect(afterConflict.occupancy[seats[0]]).toBe("pending");
  expect(afterConflict.occupancy[seats[1]]).toBeUndefined();
  expect((await block(activity, reviewer, [seats[0]], false)).status).toBe(200);
  expect((await map(activity, first)).mine?.id).toBe(mine.id);
  expect((await decide(activity, reviewer, mine.id, "confirmed")).status).toBe(200);
  expect((await put(activity, reviewer, false)).status).toBe(200);
  expect((await map(activity, reviewer)).occupancy[seats[0]]).toBe("confirmed");
  expect((await put(activity, reviewer, true)).status).toBe(200);
  expect((await map(activity, first)).blockedSeats).toHaveLength(23);
});

it("社群活动锁座与成员选座并发时，同一座位只保留一种占用", async () => {
  const activity = await extraActivity("block-race", "community-posts");
  const proof = await added(activity, second);
  const [locked, submitted] = await Promise.all([
    block(activity, reviewer, ["12-1"], true), submit(activity, second, ["12-1"], [proof]),
  ]);
  expect([locked.status, submitted.status].sort()).toEqual([200, 409]);
  const state = await map(activity, second);
  if (locked.status === 200) {
    expect(state.blockedSeats).toContain("12-1");
    expect(state.mine).toBeNull();
    expect(state.drafts).toContain(proof);
    expect((await block(activity, reviewer, ["12-1"], false)).status).toBe(200);
    expect((await submit(activity, second, ["12-1"], [proof])).status).toBe(200);
  } else {
    expect(state.blockedSeats).not.toContain("12-1");
    expect(state.mine?.status).toBe("pending");
    expect((await block(activity, reviewer, ["12-1"], true)).status).toBe(409);
  }
  expect((await map(activity, second)).occupancy["12-1"]).toBe("pending");
});

it("待审核申请人修改座位、手机号和凭证，冲突不释放原座位", async () => {
  const activity = await extraActivity("member-edit");
  const original = await added(activity, first);
  const submitted = await submit(activity, first, ["1-1", "1-2"], [original]);
  const mine = (await submitted.json()).mine;
  const state = await map(activity, first);
  expect(state.mineDetails).toMatchObject({ phone: "13800138000", proofs: [original], canEdit: true });
  expect((await map(activity, second)).mineDetails).toBeNull();
  const replacement = await added(activity, first);
  const body = { id: mine.id, revision: mine.revision, seats: ["1-2", "1-3"], phone: "13900139000", proofs: [replacement] };
  expect((await edit(activity, second, body)).status).toBe(404);
  expect((await block(activity, reviewer, ["1-3"], true)).status).toBe(200);
  expect((await edit(activity, first, body)).status).toBe(409);
  expect((await map(activity, first)).mine?.seats).toEqual(["1-1", "1-2"]);
  expect((await image(activity, original, first)).status).toBe(200);
  expect((await block(activity, reviewer, ["1-3"], false)).status).toBe(200);
  expect((await put(activity, reviewer, false)).status).toBe(200);
  const changed = await route.POST(request(activity, "POST", first, { action: "edit", ...body }), context(activity));
  expect(changed.status).toBe(200);
  expect((await changed.json()).mine).toMatchObject({ id: mine.id, status: "pending", revision: 1, seats: ["1-2", "1-3"] });
  const saved = await map(activity, first);
  expect(saved.mineDetails).toMatchObject({ phone: "13900139000", proofs: [replacement] });
  expect(saved.occupancy["1-1"]).toBeUndefined();
  expect(saved.occupancy["1-2"]).toBe("pending");
  expect(saved.occupancy["1-3"]).toBe("pending");
  expect((await image(activity, original, first)).status).toBe(404);
  expect((await image(activity, replacement, first)).status).toBe(200);
  expect((await edit(activity, first, body)).status).toBe(409);
  const oldReview = await route.POST(request(activity, "POST", reviewer, { action: "review", id: mine.id, status: "confirmed", revision: 0 }), context(activity));
  expect(oldReview.status).toBe(409);
  expect((await decide(activity, reviewer, mine.id, "confirmed")).status).toBe(409);
  const freshReview = await route.POST(request(activity, "POST", reviewer, { action: "review", id: mine.id, status: "confirmed", revision: 1 }), context(activity));
  expect(freshReview.status).toBe(200);
  expect((await edit(activity, first, { ...body, revision: 1 })).status).toBe(409);
});

it("审核与修改并发时，审核不能通过尚未核对的新内容", async () => {
  const activity = await extraActivity("edit-review-race", "community-posts");
  const proof = await added(activity, second);
  const initial = await submit(activity, second, ["2-1"], [proof]);
  const mine = (await initial.json()).mine;
  const [updated, reviewed] = await Promise.all([
    edit(activity, second, { id: mine.id, revision: 0, seats: ["2-2"], phone: "13800138000", proofs: [proof] }),
    route.POST(request(activity, "POST", reviewer, { action: "review", id: mine.id, status: "confirmed", revision: 0 }), context(activity)),
  ]);
  expect([updated.status, reviewed.status].sort()).toEqual([200, 409]);
  const state = await map(activity, second);
  if (updated.status === 200) expect(state.mine).toMatchObject({ status: "pending", revision: 1, seats: ["2-2"] });
  else expect(state.mine).toMatchObject({ status: "confirmed", revision: 0, seats: ["2-1"] });
});

it("申请人可完全取消待审核申请并释放全部座位，之后可重新申请", async () => {
  const activity = await extraActivity("cancel");
  const proof = await added(activity, first);
  const response = await submit(activity, first, ["3-1", "3-2"], [proof]);
  const mine = (await response.json()).mine;
  expect((await cancel(activity, second, mine.id, 0)).status).toBe(404);
  expect((await cancel(activity, first, mine.id, 1)).status).toBe(409);
  expect((await map(activity, first)).occupancy["3-1"]).toBe("pending");
  const cancelled = await cancel(activity, first, mine.id, 0);
  expect(cancelled.status).toBe(200);
  expect((await cancelled.json()).mine).toMatchObject({ status: "cancelled", revision: 1 });
  const state = await map(activity, first);
  expect(state.mine?.status).toBe("cancelled");
  expect(state.occupancy["3-1"]).toBeUndefined();
  expect(state.occupancy["3-2"]).toBeUndefined();
  expect((await image(activity, proof, first)).status).toBe(200);
  const history = await route.GET(request(activity, "GET", reviewer, undefined, "?mode=review&status=cancelled"), context(activity));
  expect((await history.json()).docs).toMatchObject([{ id: mine.id, status: "cancelled" }]);
  expect((await decide(activity, reviewer, mine.id, "confirmed")).status).toBe(409);
  const newProof = await added(activity, first);
  expect((await submit(activity, first, ["3-1"], [newProof])).status).toBe(200);
});

it("取消与审核同时进行时，只能有一个成功", async () => {
  const activity = await extraActivity("cancel-review-race", "community-posts");
  const proof = await added(activity, second);
  const initial = await submit(activity, second, ["4-1"], [proof]);
  const mine = (await initial.json()).mine;
  const [cancelled, reviewed] = await Promise.all([
    cancel(activity, second, mine.id, 0),
    route.POST(request(activity, "POST", reviewer, { action: "review", id: mine.id, status: "confirmed", revision: 0 }), context(activity)),
  ]);
  expect([cancelled.status, reviewed.status].sort()).toEqual([200, 409]);
  const state = await map(activity, second);
  if (cancelled.status === 200) {
    expect(state.mine?.status).toBe("cancelled");
    expect(state.occupancy["4-1"]).toBeUndefined();
  } else {
    expect(state.mine?.status).toBe("confirmed");
    expect(state.occupancy["4-1"]).toBe("confirmed");
  }
});
