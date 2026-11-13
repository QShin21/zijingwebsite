import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { getPayload, type Payload } from "payload";
import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { activity, ownSignup, submitSignup } from "../src/lib/activity-signups";
import { drawLottery, lotteryReceipt, readLottery } from "../src/lib/activity-signup-lottery";
import { up as migrateLottery } from "../src/migrations/20261113_000500_activity_signup_lotteries";
import { GET as readSignup, POST as writeSignup } from "../src/app/(frontend)/api/activities/[kind]/[id]/signup/route";
import { GET as readWorkbench, POST as writeLottery } from "../src/app/(frontend)/api/activities/[kind]/[id]/lottery/route";
import { readCSV } from "./csv";

vi.mock("../src/lib/content", async () => {
  const { getPayload } = await import("payload");
  const { default: config } = await import("../src/payload.config");
  return { cms: () => getPayload({ config }) };
});

const require = createRequire(import.meta.url);
const miniQuestionnaire = require("../miniprogram/src/lib/questionnaire.js") as {
  receipt: (value: unknown) => { rows: { label: string; answer: string }[] };
  initialAnswers: (form: unknown, answers: unknown) => unknown;
};
const stamp = randomBytes(5).toString("hex");
const password = `synthetic-${randomBytes(12).toString("hex")}`;
const form = { enabled: true, questions: [
  { id: "name", label: "合成称呼", type: "text", required: true },
  { id: "__lottery_result__", label: "原始题目", type: "text", required: true },
] };
let p: Payload, president: User, users: User[], tokens: string[], presidentToken: string, event: number, version: string;
const context = () => ({ params: Promise.resolve({ kind: "events", id: String(event) }) });
const url = (path: string) => `http://localhost:3000/api/activities/events/${event}/${path}`;
const request = (path: string, token: string, body?: unknown) => new Request(url(path), {
  method: body === undefined ? "GET" : "POST",
  headers: { Authorization: `JWT ${token}`, Origin: "http://localhost:3000", "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
async function createUser(index: number, roles: User["roles"]) {
  const email = `lottery-${index}-${stamp}@example.invalid`;
  const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { name: `合成用户${index}-${stamp}`, email, password, roles } });
  const token = (await p.login({ collection: "users", data: { email, password } })).token!;
  return { user, token };
}

beforeAll(async () => {
  const db = new URL(process.env.DATABASE_URL!);
  if (process.env.APP_ENV !== "development" || process.env.LOTTERY_TEST !== "isolated" ||
      db.hostname !== "127.0.0.1" || db.port !== "55463" || !["/lottery_local", "/lottery_migrate"].includes(db.pathname))
    throw new Error("Lottery tests require their isolated synthetic database");
  p = await getPayload({ config });
  const admin = await createUser(0, ["vicePresident"]);
  president = admin.user; presidentToken = admin.token;
  const created = await Promise.all([1, 2, 3, 4].map(index => createUser(index, ["member"])));
  users = created.map(item => item.user); tokens = created.map(item => item.token);
  event = (await p.create({ collection: "events", overrideAccess: false, user: president,
    context: { manageSignupForm: true }, data: { title: "合成抽签活动", slug: `lottery-${stamp}`,
      _status: "published", signupForm: form } })).id;
  version = (await activity(p, "events", event, users[0])).version;
  for (let i = 0; i < 3; i++) await submitSignup(p, "events", event, users[i], version,
    { name: `合成答案${i}`, __lottery_result__: `保留原题${i}` });
});
afterAll(async () => { if (p) await p.destroy(); });

describe("活动报名抽签：隔离 PostgreSQL 与真实请求处理", () => {
  it("增量迁移保留原报名数据", async () => {
    await p.db.drizzle.transaction(async tx => {
      const schema = sql.identifier(`lottery_migration_${stamp}`);
      await tx.execute(sql`CREATE SCHEMA ${schema}`);
      await tx.execute(sql`SET LOCAL search_path TO ${schema}`);
      await tx.execute(sql`CREATE TABLE event_signups(id integer PRIMARY KEY, answers jsonb); CREATE TABLE payload_locked_documents_rels(id integer PRIMARY KEY); INSERT INTO event_signups VALUES(1, '{"name":"kept"}'::jsonb)`);
      await migrateLottery({ db: tx } as unknown as MigrateUpArgs);
      expect((await tx.execute(sql`SELECT answers FROM event_signups WHERE id = 1`)).rows[0]).toEqual({ answers: { name: "kept" } });
      expect((await tx.execute(sql`SELECT COUNT(*)::integer AS count FROM event_signup_lotteries`)).rows[0]).toEqual({ count: 0 });
    });
  });

  it("只允许活动管理员抽签，抽签前回执保持原样", async () => {
    const own = await ownSignup(p, "events", event, users[0]);
    expect(lotteryReceipt(own!, null)).toEqual(own);
    expect((await readWorkbench(request("lottery", tokens[0]), context())).status).toBe(403);
    expect((await writeLottery(request("lottery", tokens[0], { count: 1, expectedTotal: 3, revision: null }), context())).status).toBe(403);
    expect((await readSignup(request("signup?mode=entries", tokens[0]), context())).status).toBe(403);
    expect((await readSignup(request("signup?mode=export&lottery=1", tokens[0]), context())).status).toBe(403);
    expect((await readSignup(request("signup?mode=export&lottery=1", presidentToken), context())).status).toBe(400);
    expect(readCSV(await (await readSignup(request("signup?mode=export", presidentToken), context())).text()).headers).not.toContain("抽签结果");
    expect((await writeLottery(request("lottery", presidentToken, { count: 4, expectedTotal: 3, revision: null }), context())).status).toBe(400);
    expect(await readLottery(p, "events", event)).toBeNull();
  });

  it("公布准确人数，网页和既有小程序各显示本人结果，原始作答不变", async () => {
    const drawn = await writeLottery(request("lottery", presidentToken, { count: 1, expectedTotal: 3, revision: null }), context());
    expect(drawn.status).toBe(200);
    const result = await drawn.json();
    expect(result).toMatchObject({ total: 3, draw: { candidates: 3, winners: 1 } });
    const labels: string[] = [];
    for (let i = 0; i < 3; i++) {
      const response = await readSignup(request("signup", tokens[i]), context());
      expect(response.status).toBe(200);
      const data = await response.json(), stored = await ownSignup(p, "events", event, users[i]);
      expect(data.signup.id).toBe(stored!.id);
      expect(data).not.toHaveProperty("candidates"); expect(data).not.toHaveProperty("winners");
      const rows = miniQuestionnaire.receipt(data.signup).rows;
      const status = rows.find(row => row.label === "抽签结果");
      expect(status?.answer).toMatch(/^(已中签|未中签)$/);
      labels.push(status!.answer);
      expect(rows.find(row => row.label === "原始题目")?.answer).toBe(`保留原题${i}`);
      expect(stored!.answers).toEqual({ name: `合成答案${i}`, __lottery_result__: `保留原题${i}` });
      expect(miniQuestionnaire.initialAnswers(data.form, data.signup.answers)).toEqual(stored!.answers);
    }
    expect(labels.filter(label => label === "已中签")).toHaveLength(1);
    const entries = await readSignup(request("signup?mode=entries", presidentToken), context());
    expect((await entries.json()).docs.filter((row: { lotteryStatus: string }) => row.lotteryStatus === "已中签")).toHaveLength(1);
    const lotteryExport = await readSignup(request("signup?mode=export&lottery=1", presidentToken), context());
    expect(lotteryExport.status).toBe(200);
    expect(lotteryExport.headers.get("cache-control")).toContain("no-store");
    expect(lotteryExport.headers.get("content-disposition")).toContain(encodeURIComponent("抽签结果"));
    const exported = readCSV(await lotteryExport.text());
    expect(exported.records).toHaveLength(3);
    expect(exported.records.filter(row => row["抽签结果"] === "已中签")).toHaveLength(1);
    expect(exported.records.filter(row => row["抽签结果"] === "未中签")).toHaveLength(2);
    expect(exported.records[0]["Q2. 原始题目"]).toBe("保留原题0");
  });

  it("修改作答保留中签状态；抽签后报名标明未参与，过期操作被拒绝", async () => {
    const before = await (await readSignup(request("signup", tokens[0]), context())).json();
    const changed = await writeSignup(request("signup", tokens[0], { action: "edit", version,
      revision: before.signup.updatedAt, answers: { name: "合成修改", __lottery_result__: "原题仍在" } }), context());
    expect(changed.status).toBe(200);
    const updated = await changed.json();
    expect(updated.signup.lotteryStatus).toBe(before.signup.lotteryStatus);
    const saved = await ownSignup(p, "events", event, users[0]);
    expect(saved!.answers).toEqual({ name: "合成修改", __lottery_result__: "原题仍在" });
    await submitSignup(p, "events", event, users[3], version, { name: "后续报名", __lottery_result__: "保留" });
    const late = await (await readSignup(request("signup", tokens[3]), context())).json();
    expect(late.signup.lotteryStatus).toBe("未参与本次抽签");
    for (const layout of ["responses", "members", "long"]) {
      const response = await readSignup(request(`signup?mode=export&layout=${layout}`, presidentToken), context());
      expect(response.status).toBe(200);
      const result = readCSV(await response.text());
      expect(result.headers).toContain("抽签结果");
      if (layout !== "members") expect(result.records.filter(row => row["抽签结果"] === "未参与本次抽签").length).toBeGreaterThan(0);
    }
    const filtered = await readSignup(request(`signup?mode=export&name=${encodeURIComponent(users[3].name)}`, presidentToken), context());
    const filteredRows = readCSV(await filtered.text()).records;
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0]["抽签结果"]).toBe("未参与本次抽签");
    const workbench = await (await readWorkbench(request("lottery", presidentToken), context())).json();
    expect(workbench.total).toBe(4);
    const stale = await writeLottery(request("lottery", presidentToken, { count: 1, expectedTotal: 3, revision: workbench.draw.revision }), context());
    expect(stale.status).toBe(409);
  });

  it("同一版本并发重抽只允许一个结果生效，历史记录保留", async () => {
    const previous = await readLottery(p, "events", event);
    const actions = await Promise.allSettled([
      drawLottery(p, "events", event, president, 2, 4, previous!.revision),
      drawLottery(p, "events", event, president, 2, 4, previous!.revision),
    ]);
    expect(actions.filter(action => action.status === "fulfilled")).toHaveLength(1);
    expect(actions.filter(action => action.status === "rejected")).toHaveLength(1);
    const current = await readLottery(p, "events", event);
    expect(current?.winners).toHaveLength(2);
    expect(current?.candidates).toHaveLength(4);
    expect(current?.history).toHaveLength(1);
    expect(current?.history[0]).toMatchObject({ revision: previous!.revision, candidates: previous!.candidates, winners: previous!.winners });
    const exported = readCSV(await (await readSignup(request("signup?mode=export&lottery=1", presidentToken), context())).text());
    expect(exported.records.filter(row => row["抽签结果"] === "已中签")).toHaveLength(2);
    expect(exported.records.filter(row => row["抽签结果"] === "未参与本次抽签")).toHaveLength(0);
  });

  it("社群活动管理者可抽签，未获名单权限时仍不能读取其他人的报名", async () => {
    const game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true },
      data: { title: "合成抽签社群", slug: `lottery-game-${stamp}`, _status: "published" } })).id;
    const editor = await createUser(5, ["member"]);
    const manager = await p.update({ collection: "users", id: editor.user.id, overrideAccess: true, context: { system: true },
      data: { communityOffices: [{ game, status: "active", publishContent: true, viewSignups: false, exportSignups: false }] } });
    const post = await p.create({ collection: "community-posts", overrideAccess: false, user: manager,
      context: { manageSignupForm: true }, data: { title: "合成社群抽签", body: "合成活动说明", author: manager.id, game, category: "event", signupForm: form } });
    const info = await activity(p, "community-posts", post.id, users[1]);
    await submitSignup(p, "community-posts", post.id, users[1], info.version, { name: "社群合成报名", __lottery_result__: "原题" });
    const ctx = { params: Promise.resolve({ kind: "community-posts", id: String(post.id) }) };
    const req = (path: string, token: string, body?: unknown) => new Request(`http://localhost:3000/api/activities/community-posts/${post.id}/${path}`, {
      method: body === undefined ? "GET" : "POST", headers: { Authorization: `JWT ${token}`, Origin: "http://localhost:3000", "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const workbench = await readWorkbench(req("lottery", editor.token), ctx);
    expect(workbench.status).toBe(200);
    expect(await workbench.json()).toEqual({ total: 1, draw: null });
    expect((await readSignup(req("signup?mode=entries", editor.token), ctx)).status).toBe(403);
    expect((await readSignup(req("signup?mode=export&lottery=1", editor.token), ctx)).status).toBe(403);
    expect((await writeLottery(req("lottery", editor.token, { count: 1, expectedTotal: 1, revision: null }), ctx)).status).toBe(200);
    const own = await (await readSignup(req("signup", tokens[1]), ctx)).json();
    expect(own.signup.lotteryStatus).toBe("已中签");
    expect(own.signup.answers.name).toBe("社群合成报名");
    expect((await readSignup(req("signup?mode=export&lottery=1", editor.token), ctx)).status).toBe(403);
  });
});
