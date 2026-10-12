import "dotenv/config";
import { beforeAll, afterAll, afterEach, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { activity, submitSignup } from "../src/lib/activity-signups";
import { communityIDs } from "../src/lib/rules";

let p: Payload, leader: User;
const suffix = randomBytes(6).toString("hex"), users: number[] = [], games: number[] = [], events: number[] = [];
const form = { enabled: true, questions: [{ id: "name", label: "合成称呼", type: "text", required: true }] };
let counter = 0;
async function user(roles: User["roles"]) {
  const name = `authority-${suffix}-${++counter}`;
  const row = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name, email: `${name}@example.invalid`, password: randomBytes(24).toString("hex"), roles } });
  users.push(row.id); return row;
}
async function game() {
  const row = await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成授权边界", slug: `authority-game-${suffix}-${++counter}`, _status: "published" } });
  games.push(row.id); return row.id;
}
async function event(owner: User, scope: number | null) {
  const row = await p.create({ collection: "events", overrideAccess: false, user: leader, context: { system: true }, data: { title: "合成范围变更活动", slug: `authority-event-${suffix}-${++counter}`, submittedBy: owner.id, game: scope, _status: "published", signupForm: form } });
  events.push(row.id); return row.id;
}
async function grant(actor: User, scope: number, full = false) {
  return p.update({ collection: "users", id: actor.id, user: leader, overrideAccess: false, data: { communityOffices: [{ game: scope, status: "active", publishContent: full, reviewShowcase: full, handleJoins: full, viewSignups: true, exportSignups: true, contactConsent: false }] } });
}
function gate() {
  const run = spawnSync(process.execPath, [path.resolve("node_modules/tsx/dist/cli.mjs"), path.resolve("scripts/club-operations-rollback-check.ts")], { env: process.env, encoding: "utf8", timeout: 20000 });
  if (run.error) throw run.error;
  expect([0, 1]).toContain(run.status);
  return JSON.parse(run.stdout.trim()) as { compatibleWithBaseline: boolean; counts: Record<string, number> };
}
beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Isolated synthetic loopback only");
  p = await getPayload({ config });
  leader = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: `authority-leader-${suffix}`, email: `authority-leader-${suffix}@example.invalid`, password: randomBytes(24).toString("hex"), roles: ["president"] } });
});
afterEach(async () => {
  // Remove only this case's synthetic fixtures, after preserved-data assertions.
  if (users.length) await p.delete({ collection: "event-signups", overrideAccess: true, where: { member: { in: users } } });
  if (events.length) await p.delete({ collection: "events", overrideAccess: true, where: { id: { in: events } } });
  for (const id of users) await p.delete({ collection: "users", id, overrideAccess: true, context: { system: true } });
  if (games.length) await p.delete({ collection: "games", overrideAccess: true, where: { id: { in: games } } });
  users.length = 0; games.length = 0; events.length = 0;
});
afterAll(async () => { if (p) { if (leader) await p.delete({ collection: "users", id: leader.id, overrideAccess: true, context: { system: true } }); await p.destroy(); } });

it("删除唯一游戏后 active 孤儿任职不能成为回滚私人权限的有效授权", async () => {
  let owner = await user(["communityAdmin"]); const member = await user(["member"]), scope = await game();
  owner = await grant(owner, scope, true); const id = await event(owner, scope);
  const value = await activity(p, "events", id, member);
  const receipt = await submitSignup(p, "events", id, member, value.version, { name: "保留的合成答案" });
  expect(gate().compatibleWithBaseline).toBe(true);
  await p.delete({ collection: "games", id: scope, overrideAccess: true });
  owner = await p.findByID({ collection: "users", id: owner.id, overrideAccess: true, depth: 0 });
  expect(owner.communityOffices![0].status).toBe("active"); expect(owner.communityOffices![0].game).toBeNull();
  expect(communityIDs(owner, "viewSignups")).toEqual([]);
  for (const permission of ["view", "export"] as const) await expect(activity(p, "events", id, owner, true, undefined, permission)).rejects.toThrow();
  expect((await p.findByID({ collection: "event-signups", id: receipt.id, user: member, overrideAccess: false })).answers).toEqual({ name: "保留的合成答案" });
  const blocked = gate();
  expect(blocked.counts.legacy_owner_private_access).toBeGreaterThan(0);
  expect(blocked.compatibleWithBaseline).toBe(false);
});

it("删除活动保留他人答卷时，旧 organizer 读取面仍阻止危险回滚", async () => {
  const owner = await user(["communityAdmin"]), member = await user(["member"]), id = await event(owner, null);
  const value = await activity(p, "events", id, member);
  const receipt = await submitSignup(p, "events", id, member, value.version, { name: "历史合成答案" });
  await p.delete({ collection: "events", id, overrideAccess: true });
  const retained = await p.findByID({ collection: "event-signups", id: receipt.id, overrideAccess: true, depth: 0 });
  expect(retained.organizer).toBe(owner.id); expect(retained.answers).toEqual({ name: "历史合成答案" });
  expect(owner.communityOffices ?? []).toEqual([]);
  await expect(p.findByID({ collection: "event-signups", id: receipt.id, user: owner, overrideAccess: false })).rejects.toThrow();
  expect((await p.findByID({ collection: "event-signups", id: receipt.id, user: member, overrideAccess: false })).id).toBe(receipt.id);
  const blocked = gate();
  expect(blocked.counts.legacy_owner_private_access).toBe(0);
  expect(blocked.counts.legacy_historical_private_access).toBeGreaterThan(0);
  expect(blocked.compatibleWithBaseline).toBe(false);
});

it.each([["A", true], ["NULL", false]] as const)("活动 %s→B 后，列表/单条/导出以当前范围为准，本人数据仍可读", async (_label, linked) => {
  let owner = await user(["member"]); const member = await user(["member"]), backbone = await user(["backbone"]);
  const a = await game(), b = await game(); owner = await grant(owner, a);
  const id = await event(owner, linked ? a : null), value = await activity(p, "events", id, member);
  const foreign = await submitSignup(p, "events", id, member, value.version, { name: "他人的合成答案" });
  const own = await submitSignup(p, "events", id, owner, value.version, { name: "本人的合成答案" });
  expect((await p.findByID({ collection: "event-signups", id: foreign.id, user: owner, overrideAccess: false })).id).toBe(foreign.id);
  await p.update({ collection: "events", id, user: leader, overrideAccess: false, data: { game: b } });
  // Keep the historical attribution rather than rewriting or deleting the answers.
  expect((await p.findByID({ collection: "event-signups", id: foreign.id, overrideAccess: true, depth: 0 })).game ?? null).toBe(linked ? a : null);
  for (const permission of ["view", "export"] as const) await expect(activity(p, "events", id, owner, true, undefined, permission)).rejects.toThrow();
  const list = await p.find({ collection: "event-signups", user: owner, overrideAccess: false, where: { and: [{ activityType: { equals: "events" } }, { activityID: { equals: id } }] } });
  expect(list.docs.map(row => row.id)).toEqual([own.id]);
  await expect(p.findByID({ collection: "event-signups", id: foreign.id, user: owner, overrideAccess: false })).rejects.toThrow();
  await expect(p.findByID({ collection: "event-signups", id: foreign.id, user: backbone, overrideAccess: false })).rejects.toThrow();
  expect((await p.findByID({ collection: "event-signups", id: foreign.id, user: member, overrideAccess: false })).answers).toEqual({ name: "他人的合成答案" });
  expect((await p.findByID({ collection: "event-signups", id: own.id, user: owner, overrideAccess: false })).answers).toEqual({ name: "本人的合成答案" });
  owner = await p.update({ collection: "users", id: owner.id, user: leader, overrideAccess: false, data: { communityOffices: [...owner.communityOffices!, { game: b, status: "active", publishContent: false, reviewShowcase: false, handleJoins: false, viewSignups: true, exportSignups: false }] } });
  expect((await p.findByID({ collection: "event-signups", id: foreign.id, user: owner, overrideAccess: false })).id).toBe(foreign.id);
  expect((await activity(p, "events", id, owner, true, undefined, "view")).canView).toBe(true);
  await expect(activity(p, "events", id, owner, true, undefined, "export")).rejects.toThrow();
  const restored = await p.find({ collection: "event-signups", user: owner, overrideAccess: false, where: { and: [{ activityType: { equals: "events" } }, { activityID: { equals: id } }] } });
  expect(new Set(restored.docs.map(row => row.id))).toEqual(new Set([own.id, foreign.id]));
});
