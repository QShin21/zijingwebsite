
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import sharp from "sharp";
import { getPayload, type Payload } from "payload";
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
    data: { email, password, name, roles, communityOffices: scope ? [{ game: scope, status: "active" }] : undefined },
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
async function image(activity: Activity, proof: string, who?: Actor) {
  return proofRoute.GET(request(activity, "GET", who, undefined, "/proofs/" + proof), proofContext(activity, proof));
}
async function review(activity: Activity, who: Actor) {
  return route.GET(request(activity, "GET", who, undefined, "?mode=review"), context(activity));
}

beforeAll(async () => {
  if (process.env.APP_ENV !== "development" ||
      !["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Activity seating checks require an isolated loopback database");
  p = await getPayload({ config, key: "activity-seating-" + suffix });
  locator.cms.mockResolvedValue(p);
  president = await actor("president", ["president"]);
  const scope = await game("home"), other = await game("other");
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
  expect((await map(post)).enabled).toBe(false);
  expect((await put(post, president, true)).status).toBe(200);
  expect((await map(post)).open).toBe(true);
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
  expect(Object.values((await map(post)).occupancy)).toEqual(Array(10).fill("confirmed"));
  expect((await upload(post, first)).status).toBe(409);
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
