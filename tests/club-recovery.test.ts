import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, copyFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { activity, saveSignupForm, submitSignup } from "../src/lib/activity-signups";
import { canPublish, managesGame, communityIDs } from "../src/lib/rules";

let p: Payload, db: pg.Client, leader: User, reader: User, legacy: User, participant: User;
let game: number, otherGame: number, post: number, otherPost: number, event: number, readerEvent: number, outsideEvent: number;
const suffix = randomBytes(6).toString("hex"), ids: number[] = [];
const form = { enabled: true, questions: [{ id: "name", label: "合成称呼", type: "text", required: true }] };
const root = process.cwd(), cli = path.resolve("node_modules/tsx/dist/cli.mjs");
const run = (script: string, env: Partial<NodeJS.ProcessEnv> = {}, cwd = root) => execFileSync(process.execPath,
  [cli, path.join(root, script)], { cwd, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json"), ...env }, encoding: "utf8", timeout: 25000 });
beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback database only");
  p = await getPayload({ config }); db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  const create = async (name: string, roles: User["roles"]) => {
    const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: {
      name: `${name}-${suffix}`, email: `${name}-${suffix}@example.invalid`, password: randomBytes(24).toString("hex"), roles } });
    ids.push(user.id); return user;
  };
  leader = await create("recovery-leader", ["president"]); reader = await create("recovery-reader", ["member"]);
  legacy = await create("recovery-legacy", ["communityAdmin"]); participant = await create("recovery-participant", ["member"]);
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成恢复权限社群", slug: `recovery-${suffix}`, _status: "published" } })).id;
  otherGame = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成跨社群检查", slug: `recovery-other-${suffix}`, _status: "published" } })).id;
  reader = await p.update({ collection: "users", id: reader.id, overrideAccess: false, user: leader, data: { communityOffices: [{ game, status: "active", publishContent: false, reviewShowcase: false, handleJoins: false, viewSignups: true, exportSignups: false }] } });
  legacy = await p.update({ collection: "users", id: legacy.id, overrideAccess: false, user: leader, data: { communityOffices: [{ game, status: "active", publishContent: true, reviewShowcase: true, handleJoins: true, viewSignups: true, exportSignups: true }] } });
  const createPost = (scope: number) => p.create({ collection: "community-posts", overrideAccess: false, user: leader, context: { manageSignupForm: true }, data: { title: "合成只读报名", body: "用于恢复权限边界测试", game: scope, author: leader.id, category: "event", signupForm: form } });
  post = (await createPost(game)).id; otherPost = (await createPost(otherGame)).id;
  event = (await p.create({ collection: "events", overrideAccess: false, user: legacy, context: { manageSignupForm: true }, data: { title: "合成旧组织者活动", slug: `recovery-owned-${suffix}`, signupForm: form } })).id;
  readerEvent = (await p.create({ collection: "events", overrideAccess: false, user: leader, context: { system: true }, data: { title: "合成只读旧活动", slug: `recovery-reader-owned-${suffix}`, submittedBy: reader.id, _status: "draft", signupForm: form } })).id;
  outsideEvent = (await p.create({ collection: "events", overrideAccess: false, user: leader, context: { system: true }, data: { title: "合成外部旧活动", slug: `recovery-outside-owned-${suffix}`, submittedBy: reader.id, game: otherGame, _status: "published", signupForm: form } })).id;
});
afterAll(async () => {
  if (!p) return;
  const games = [game, otherGame].filter(Boolean);
  if (games.length) await p.delete({ collection: "event-signups", overrideAccess: true, where: { game: { in: games } } });
  for (const id of [post, otherPost]) if (id) await p.delete({ collection: "community-posts", id, overrideAccess: true });
  for (const id of [event, readerEvent, outsideEvent]) if (id) await p.delete({ collection: "events", id, overrideAccess: true });
  for (const id of ids) await p.delete({ collection: "users", id, overrideAccess: true, context: { system: true } });
  for (const id of [game, otherGame]) if (id) await p.delete({ collection: "games", id, overrideAccess: true });
  await db?.end(); await p.destroy();
});
describe.sequential("阶段1恢复权限与无DDL快照", () => {
  it("独立读取可看名单，导出/编辑/发布仍逐动作拒绝，跨社群拒绝", async () => {
    const value = await activity(p, "community-posts", post, reader, true, undefined, "view");
    expect(value.canView).toBe(true); expect(value.manager).toBe(false); expect(value.canExport).toBe(false);
    expect(canPublish(reader)).toBe(false); expect(managesGame(reader, game)).toBe(false);
    await expect(p.update({ collection: "users", id: reader.id, user: leader, overrideAccess: false,
      data: { communityOffices: reader.communityOffices!.map(office => ({ ...office, game: otherGame })) } })).rejects.toThrow("任职所属社群不可更换");
    const owned = await activity(p, "events", readerEvent, reader, true, undefined, "view");
    expect(owned.canView).toBe(true); expect(owned.manager).toBe(false);
    await expect(saveSignupForm(p, "events", readerEvent, reader, owned.version, owned.form)).rejects.toThrow();
    await expect(activity(p, "events", event, reader, true, undefined, "view")).rejects.toThrow();
    for (const permission of ["view", "export"] as const) await expect(activity(p, "events", outsideEvent, reader, true, undefined, permission)).rejects.toThrow();
    const outside = await activity(p, "events", outsideEvent, participant);
    const foreignReceipt = await submitSignup(p, "events", outsideEvent, participant, outside.version, { name: "合成跨社群报名者" });
    await expect(p.findByID({ collection: "event-signups", id: foreignReceipt.id, user: reader, overrideAccess: false })).rejects.toThrow();
    expect((await p.findByID({ collection: "event-signups", id: foreignReceipt.id, user: participant, overrideAccess: false })).id).toBe(foreignReceipt.id);
    await expect(activity(p, "community-posts", otherPost, reader, true, undefined, "view")).rejects.toThrow();
    await expect(activity(p, "community-posts", post, reader, true, undefined, "export")).rejects.toThrow();
    await expect(saveSignupForm(p, "community-posts", post, reader, value.version, { ...value.form, title: "禁止编辑" })).rejects.toThrow();
    await expect(p.update({ collection: "community-posts", id: post, user: reader, overrideAccess: false, data: { title: "禁止发布" } })).rejects.toThrow();
    const receipts = await Promise.all([submitSignup(p, "community-posts", post, participant, value.version, { name: "合成报名者" }), submitSignup(p, "community-posts", post, participant, value.version, { name: "合成报名者" })]);
    expect(receipts[0].id).toBe(receipts[1].id);
    expect((await p.findByID({ collection: "event-signups", id: receipts[0].id, overrideAccess: false, user: reader })).id).toBe(receipts[0].id);
    reader = await p.update({ collection: "users", id: reader.id, user: leader, overrideAccess: false, data: { communityOffices: reader.communityOffices!.map(office => ({ ...office, exportSignups: true })) } });
    expect((await activity(p, "community-posts", post, reader, true, undefined, "export")).canExport).toBe(true);
    expect((await activity(p, "community-posts", post, reader, true, undefined, "view")).manager).toBe(false);
  });
  it("移除最后任职保留撤销事实，旧身份/旧投影/重复请求不能复活权限", async () => {
    const stale = legacy;
    legacy = await p.update({ collection: "users", id: legacy.id, user: leader, overrideAccess: false, data: { communityOffices: [] } });
    expect(legacy.roles).toEqual(["communityAdmin"]); expect(legacy.communities).toEqual([]);
    expect(legacy.communityOffices).toHaveLength(1); expect(legacy.communityOffices![0].status).toBe("revoked");
    for (const permission of ["view", "export"] as const) {
      await expect(activity(p, "community-posts", post, stale, true, undefined, permission)).rejects.toThrow();
      await expect(activity(p, "events", event, stale, true, undefined, permission)).rejects.toThrow();
    }
    legacy = await p.update({ collection: "users", id: legacy.id, user: leader, overrideAccess: false, data: { communities: [game] } });
    expect(communityIDs(legacy)).toEqual([]); expect(legacy.communityOffices![0].status).toBe("revoked");
    legacy = await p.update({ collection: "users", id: legacy.id, user: leader, overrideAccess: false, data: { communities: [] } });
    expect(legacy.communityOffices).toHaveLength(1);
    let result: { counts: { revoked_grants: number; legacy_owner_private_access: number }; compatibleWithBaseline: boolean } | undefined;
    try { run("scripts/club-operations-rollback-check.ts"); } catch (error) {
      result = JSON.parse((error as { stdout: string }).stdout.trim());
    }
    expect(result?.compatibleWithBaseline).toBe(false); expect(result?.counts.revoked_grants).toBeGreaterThan(0);
    expect(result?.counts.legacy_owner_private_access).toBeGreaterThan(0);
  });
  it("快照拒绝DB_PUSH=true，正常生成无DDL且不覆盖仓库快照", async () => {
    const schema = `recovery_ddl_${suffix}`, trigger = `recovery_ddl_${suffix}`;
    const cwd = await mkdtemp(path.join(tmpdir(), "zijing-snapshot-"));
    const baseline = "src/migrations/20260927_182940_community_showcase.json";
    const target = "src/migrations/20261011_180000_club_operations.json";
    const sourceSnapshot = await readFile(target, "utf8");
    await mkdir(path.join(cwd, "src/migrations"), { recursive: true }); await copyFile(baseline, path.join(cwd, baseline));
    await db.query(`CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.commands(tag text); CREATE FUNCTION ${schema}.observe() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO ${schema}.commands VALUES(tg_tag); END $$; CREATE EVENT TRIGGER ${trigger} ON ddl_command_end EXECUTE FUNCTION ${schema}.observe()`);
    try {
      const before = JSON.stringify((await db.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows);
      expect(() => run("scripts/club-operations-schema.ts", { DB_PUSH: "true" }, cwd)).toThrow("DB_PUSH=false");
      expect(() => run("scripts/club-operations-schema.ts", { DB_PUSH: "false", PAYLOAD_DROP_DATABASE: "true" }, cwd)).toThrow("PAYLOAD_DROP_DATABASE");
      expect((await db.query(`SELECT count(*)::int n FROM ${schema}.commands`)).rows[0].n).toBe(0);
      run("scripts/club-operations-schema.ts", { DB_PUSH: "false" }, cwd);
      expect(JSON.parse(await readFile(path.join(cwd, target), "utf8")).tables["public.community_joins"]).toBeDefined();
      expect((await db.query(`SELECT count(*)::int n FROM ${schema}.commands`)).rows[0].n).toBe(0);
      expect(JSON.stringify((await db.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows)).toBe(before);
      expect(await readFile(target, "utf8")).toBe(sourceSnapshot);
    } finally {
      await db.query(`DROP EVENT TRIGGER ${trigger}; DROP SCHEMA ${schema} CASCADE`); await rm(cwd, { recursive: true, force: true });
    }
  }, 60000);
});
