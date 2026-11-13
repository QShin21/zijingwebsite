import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { Payload } from "payload";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
import type { User } from "../src/payload-types";

// Isolated synthetic PostgreSQL only (see docs/PERSONAL_ARCHIVES_20261114.md). Never a shared or production database.
const db = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = process.env.APP_ENV === "development" && process.env.ARCHIVE_TEST === "isolated" && db !== null &&
  db.hostname === "127.0.0.1" && db.port === "55471" && ["/archive_test", "/archive_migrate"].includes(db.pathname);

const stamp = randomBytes(4).toString("hex");
const password = `synthetic-${randomBytes(12).toString("hex")}`;
const origin = "http://localhost:3000";
type Account = { user: User; token: string; email: string };
let p: Payload, a: Account, b: Account, suspended: Account;
let v2Request: typeof import("../src/lib/v2/http").v2Request;
let service: typeof import("../src/lib/v2");
const apps: { a: string[]; b: string[] } = { a: [], b: [] };
const clubEvents: number[] = [];
let communityEvent = 0, bOnlyEvent = 0;
const sql = (text: string, values: unknown[] = []) => (p.db as unknown as PostgresAdapter).pool.query(text, values);

async function account(name: string): Promise<Account> {
  const email = `archive-${name}-${stamp}@example.invalid`;
  const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { name: `合成${name}-${stamp}`, email, password, roles: ["member"] } as never });
  const token = (await p.login({ collection: "users", data: { email, password } })).token!;
  return { user: user as User, token, email };
}
function post(body: unknown, auth: { token?: string; cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth.token) headers.Authorization = `JWT ${auth.token}`;
  if (auth.cookie) headers.Cookie = `payload-token=${auth.cookie}`;
  if (auth.origin) headers.Origin = auth.origin;
  return v2Request(p, new Request(`${origin}/api/v2/me/archive`, { method: "POST", headers, body: JSON.stringify(body) }), ["me", "archive"]);
}
const archive = (who: Account, target: string, archived: boolean) => post({ target, archived }, { token: who.token, origin });
const rows = async (who: Account) => (await sql("SELECT target FROM personal_archives WHERE user_id=$1 ORDER BY target", [who.user.id])).rows.map(row => row.target);
const viewer = (who: Account) => ({ ...who.user, collection: "users" }) as User;
// Business state that archiving must never change.
async function businessSnapshot() {
  const tables = ["staff_applications", "team_join_applications", "team_establishment_applications", "community_applications"];
  const result: Record<string, unknown> = {};
  for (const table of tables) result[table] = (await sql(`SELECT id, status, updated_at FROM ${table} ORDER BY id`)).rows;
  result.signups = (await sql("SELECT id, member_id, answers, updated_at FROM event_signups ORDER BY id")).rows;
  return result;
}

beforeAll(async () => {
  if (!isolated) return;
  const { getPayload } = await import("payload");
  const { default: config } = await import("../src/payload.config");
  p = await getPayload({ config });
  ({ v2Request } = await import("../src/lib/v2/http"));
  service = await import("../src/lib/v2");
  [a, b, suspended] = [await account("a"), await account("b"), await account("s")];
  const game = (await sql(`INSERT INTO games (title, slug, _status) VALUES ($1, $2, 'published') RETURNING id`, [`合成项目${stamp}`, `archive-game-${stamp}`])).rows[0].id;
  const team = (await sql(`INSERT INTO teams (title, slug, _status, game_id) VALUES ($1, $2, 'published', $3) RETURNING id`, [`合成队${stamp}`, `archive-team-${stamp}`, game])).rows[0].id;
  const batch = (await sql(`INSERT INTO staff_batches (title, state, signup_form) VALUES ($1, 'open', '{}'::jsonb) RETURNING id`, [`合成骨干批次${stamp}`])).rows[0].id;
  // One application per recruitment and applicant is a database constraint.
  const recruitment = async () => (await sql(`INSERT INTO team_recruitments (title, team_id, game_id, status, signup_form, created_by_id) VALUES ($1, $2, $3, 'closed', '{}'::jsonb, $4) RETURNING id`,
    [`合成招新${stamp}`, team, game, a.user.id])).rows[0].id;
  let minute = 0;
  const at = () => new Date(Date.UTC(2026, 10, 1, 0, minute++)).toISOString();
  async function seedApplications(who: Account, staff: string[], joins: string[], establish: string[], community: string[]) {
    const keys: string[] = [];
    for (const status of staff) keys.push(`staff:${(await sql(`INSERT INTO staff_applications (batch_id, applicant_id, request_key, member_name, batch_title, department, status, form_version, questions, answers, updated_at)
      VALUES ($1, $2, $3, '合成', '合成骨干批次', 'execution', $4, 'v1', '[]'::jsonb, '{"note":"keep"}'::jsonb, $5) RETURNING id`, [batch, who.user.id, `staff-${randomBytes(6).toString("hex")}`, status, at()])).rows[0].id}`);
    for (const status of joins) keys.push(`teamJoin:${(await sql(`INSERT INTO team_join_applications (title, team_id, game_id, recruitment_id, applicant_id, request_key, status, form_version, form_snapshot, answers, updated_at)
      VALUES ('合成入队', $1, $2, $3, $4, $5, $6, 'v1', '{}'::jsonb, '{"note":"keep"}'::jsonb, $7) RETURNING id`, [team, game, await recruitment(), who.user.id, `join-${randomBytes(6).toString("hex")}`, status, at()])).rows[0].id}`);
    for (const status of establish) keys.push(`teamEstablishment:${(await sql(`INSERT INTO team_establishment_applications (title, game_id, applicant_id, reason, request_key, status, updated_at)
      VALUES ('合成建队', $1, $2, '合成理由', $3, $4, $5) RETURNING id`, [game, who.user.id, `est-${randomBytes(6).toString("hex")}`, status, at()])).rows[0].id}`);
    for (const status of community) keys.push(`communityOfficer:${(await sql(`INSERT INTO community_applications (applicant_id, proposed_game, reason, status, updated_at)
      VALUES ($1, '合成社群', '合成理由', $2, $3) RETURNING id`, [who.user.id, status, at()])).rows[0].id}`);
    return keys;
  }
  // A: 10 applications across all four sources (one returned, one draft → todo).
  apps.a = await seedApplications(a, ["submitted", "returned", "accepted"], ["draft", "pending", "approved"], ["pending", "approved"], ["pending", "withdrawn"]);
  apps.b = await seedApplications(b, ["submitted"], ["pending"], ["pending"], ["pending"]);
  const day = 86400000, now = Date.now();
  for (let i = 0; i < 7; i++) clubEvents.push((await sql(`INSERT INTO events (title, slug, _status, start_at, end_at, audience) VALUES ($1, $2, 'published', $3, $4, 'campus') RETURNING id`,
    [`合成活动${i}`, `archive-event-${i}-${stamp}`, new Date(now + (i + 1) * day).toISOString(), new Date(now + (i + 1) * day + 3600000).toISOString()])).rows[0].id);
  bOnlyEvent = (await sql(`INSERT INTO events (title, slug, _status, start_at, end_at, audience) VALUES ($1, $2, 'published', $3, $4, 'campus') RETURNING id`,
    ["合成B活动", `archive-event-b-${stamp}`, new Date(now + day).toISOString(), new Date(now + day + 3600000).toISOString()])).rows[0].id;
  communityEvent = (await sql(`INSERT INTO community_posts (title, body, game_id, author_id, author_name, status, category, start_at, end_at, audience) VALUES ('合成社群活动', '合成', $1, $2, '合成', 'visible', 'event', $3, $4, 'campus') RETURNING id`,
    [game, b.user.id, new Date(now + 10 * day).toISOString(), new Date(now + 10 * day + 3600000).toISOString()])).rows[0].id;
  const signup = (who: Account, type: string, id: number) => sql(`INSERT INTO event_signups (activity_type, activity_i_d, dedupe_key, member_id, member_name, event_title, form_version, questions, answers)
    VALUES ($1, $2, $3, $4, '合成', '合成报名', 'v1', '[]'::jsonb, '{"answer":"keep"}'::jsonb)`, [type, id, `${type}:${id}:${who.user.id}`, who.user.id]);
  for (const id of clubEvents) await signup(a, "events", id);
  await signup(a, "community-posts", communityEvent);
  await signup(b, "events", bOnlyEvent);
  await signup(b, "events", clubEvents[0]);
  await sql("UPDATE users SET account_status='suspended' WHERE id=$1", [suspended.user.id]);
}, 120000);
afterAll(async () => { if (p) await p.destroy(); });

describe.skipIf(!isolated)("个人归档：隔离合成 PostgreSQL 与真实请求处理", () => {
  it("拒绝匿名、停用账号、跨源 Cookie、多余字段与非法目标", async () => {
    expect((await post({ target: apps.a[0], archived: true }, { origin })).status).toBe(401);
    expect((await post({ target: apps.a[0], archived: true }, { token: suspended.token, origin })).status).toBe(403);
    // Cookie credentials require same-origin proof; JWT does not carry ambient cookies.
    expect((await post({ target: apps.a[0], archived: true }, { cookie: a.token })).status).toBe(403);
    expect((await post({ target: apps.a[0], archived: true }, { cookie: a.token, origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ target: apps.a[0], archived: true, extra: 1 }, { token: a.token, origin })).status).toBe(400);
    expect((await post({ target: apps.a[0], archived: "true" }, { token: a.token, origin })).status).toBe(400);
    expect((await post({ target: apps.a[0] }, { token: a.token, origin })).status).toBe(400);
    for (const target of ["foo:1", "staff:0", "staff:abc", "staff:99999999999", "signup:1", "staff:1 ", ["staff:1"], 5, null])
      expect((await post({ target, archived: true }, { token: a.token, origin })).status).toBe(400);
    expect((await archive(a, "staff:2147483000", true)).status).toBe(404);
    expect(await rows(a)).toEqual([]);
  });

  it("不能归档他人申请或本人未报名的活动，也不影响他人", async () => {
    for (const target of apps.b) expect((await archive(a, target, true)).status).toBe(404);
    expect((await archive(a, `club:${bOnlyEvent}`, true)).status).toBe(404);
    expect(await rows(a)).toEqual([]);
    // Restoring someone else's target only deletes the caller's own rows: B keeps its preference.
    expect((await archive(b, apps.b[0], true)).status).toBe(200);
    expect((await archive(a, apps.b[0], false)).status).toBe(200);
    expect(await rows(b)).toEqual([apps.b[0]]);
    expect((await archive(b, apps.b[0], false)).status).toBe(200);
  });

  it("Cookie 同源与 JWT 均可设置；重复与并发归档幂等，恢复同样幂等", async () => {
    const target = apps.a[0];
    expect(await (await post({ target, archived: true }, { cookie: a.token, origin })).json()).toEqual({ target, archived: true });
    expect((await archive(a, target, true)).status).toBe(200);
    const parallel = await Promise.all(Array.from({ length: 8 }, () => archive(a, target, true)));
    expect(parallel.map(response => response.status)).toEqual(Array(8).fill(200));
    expect(await rows(a)).toEqual([target]);
    const restore = await Promise.all(Array.from({ length: 4 }, () => archive(a, target, false)));
    expect(restore.map(response => response.status)).toEqual(Array(4).fill(200));
    expect(await rows(a)).toEqual([]);
  });

  it("四类申请主栏目在 8 条截断前过滤，全部申请分页保留并可恢复；待办与业务状态不变", async () => {
    const before = await businessSnapshot();
    const first = await service.getMe(p, viewer(a));
    expect(first.applications).toHaveLength(8);
    expect(first.counts).toMatchObject({ applications: 10, archivedApplications: 0 });
    const todoKeys = first.todo.map(item => item.key).sort();
    // Archive exactly the 8 visible items; the other 2 must surface, which proves filtering precedes truncation.
    for (const item of first.applications) expect((await archive(a, item.key, true)).status).toBe(200);
    const kinds = new Set(first.applications.map(item => item.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    const second = await service.getMe(p, viewer(a));
    const hidden = new Set(first.applications.map(item => item.key));
    expect(second.applications.map(item => item.key).sort()).toEqual(apps.a.filter(key => !hidden.has(key)).sort());
    expect(second.applications.every(item => !item.archived)).toBe(true);
    expect(second.counts).toMatchObject({ applications: 10, archivedApplications: 8 });
    expect(second.todo.map(item => item.key).sort()).toEqual(todoKeys);
    // Full list: every record across pages, archived ones flagged.
    const seen: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await service.getMyApplications(p, viewer(a), { page, limit: 4 });
      expect(result).toMatchObject({ page, totalDocs: 10, totalPages: 3, hasNextPage: page < 3 });
      for (const item of result.docs) { seen.push(item.key); expect(item.archived).toBe(hidden.has(item.key)); }
    }
    expect(seen.sort()).toEqual([...apps.a].sort());
    // Restore one: it returns to the overview.
    const restored = first.applications[0].key;
    expect((await archive(a, restored, false)).status).toBe(200);
    const third = await service.getMe(p, viewer(a));
    expect(third.applications.map(item => item.key)).toContain(restored);
    expect(third.counts.archivedApplications).toBe(7);
    // B's overview is untouched by A's preferences.
    const other = await service.getMe(p, viewer(b));
    expect(other.applications.map(item => item.key).sort()).toEqual([...apps.b].sort());
    expect(await businessSnapshot()).toEqual(before);
  });

  it("我的赛程在 5 条截断前过滤，社团与社群活动均可归档并在全部报名恢复，报名不被取消", async () => {
    const before = await businessSnapshot();
    const first = await service.getMe(p, viewer(a));
    expect(first.upcoming).toHaveLength(5);
    expect(first.counts.archivedUpcoming).toBe(0);
    for (const card of first.upcoming) expect((await archive(a, card.key, true)).status).toBe(200);
    expect((await archive(a, `community:${communityEvent}`, true)).status).toBe(200);
    const second = await service.getMe(p, viewer(a));
    const hidden = new Set([...first.upcoming.map(card => card.key), `community:${communityEvent}`]);
    expect(second.upcoming.length).toBeGreaterThan(0);
    expect(second.upcoming.every(card => !hidden.has(card.key))).toBe(true);
    expect(second.counts.archivedUpcoming).toBe(hidden.size);
    expect(second.counts.signups).toBe(8);
    const receipts = await service.getMySignups(p, viewer(a), { page: 1, limit: 50 });
    expect(receipts.totalDocs).toBe(8);
    for (const receipt of receipts.docs) expect(receipt.archived).toBe(hidden.has(receipt.archiveTarget!));
    const paged = [await service.getMySignups(p, viewer(a), { page: 1, limit: 5 }), await service.getMySignups(p, viewer(a), { page: 2, limit: 5 })];
    expect(paged.flatMap(page => page.docs.map(doc => doc.key)).sort()).toEqual(receipts.docs.map(doc => doc.key).sort());
    // Restore from the full list.
    const target = first.upcoming[0].key;
    expect((await archive(a, target, false)).status).toBe(200);
    expect((await service.getMe(p, viewer(a))).upcoming.map(card => card.key)).toContain(target);
    // B signed up for clubEvents[0] too, and still sees it.
    expect((await service.getMe(p, viewer(b))).upcoming.map(card => card.key)).toContain(`club:${clubEvents[0]}`);
    // Public calendar is unaffected by personal archives.
    const calendar = await service.getCalendar(p, viewer(a), { scope: "mine", range: "upcoming", limit: 50 });
    expect(calendar.totalDocs).toBe(8);
    expect(await businessSnapshot()).toEqual(before);
  });

  it("迁移只新增偏好表；回滚只删除偏好表", async () => {
    const { up, down } = await import("../src/migrations/20261113_000800_personal_archives");
    await p.db.drizzle.transaction(async tx => {
      const { sql: tag } = await import("@payloadcms/db-postgres");
      const schema = tag.identifier(`archive_drill_${stamp}`);
      await tx.execute(tag`CREATE SCHEMA ${schema}`);
      await tx.execute(tag`SET LOCAL search_path TO ${schema}`);
      await tx.execute(tag`CREATE TABLE users(id integer PRIMARY KEY); CREATE TABLE staff_applications(id integer PRIMARY KEY, status text); INSERT INTO users VALUES (1); INSERT INTO staff_applications VALUES (5, 'submitted')`);
      await up({ db: tx } as never);
      await tx.execute(tag`INSERT INTO personal_archives (user_id, target) VALUES (1, 'staff:5')`);
      await expect(tx.execute(tag`SAVEPOINT bad; INSERT INTO personal_archives (user_id, target) VALUES (1, 'other:5')`)).rejects.toThrow();
      await tx.execute(tag`ROLLBACK TO SAVEPOINT bad`);
      await down({ db: tx } as never);
      expect((await tx.execute(tag`SELECT to_regclass('personal_archives') AS name`)).rows[0]).toEqual({ name: null });
      expect((await tx.execute(tag`SELECT status FROM staff_applications WHERE id = 5`)).rows[0]).toEqual({ status: "submitted" });
      await tx.execute(tag`DROP SCHEMA ${schema} CASCADE`);
    });
  });
});
