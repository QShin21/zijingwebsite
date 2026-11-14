import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { getPayload, type Payload } from "payload";
import { sql, type MigrateUpArgs } from "@payloadcms/db-postgres";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { quizAction, quizEvent, listQuizEvents, closeQuizPool } from "../src/lib/quiz-prizes";
import { up as quizMigration } from "../src/migrations/20261114_001200_quiz_prizes";
import { GET, POST } from "../src/app/(frontend)/api/quiz/route";

vi.mock("../src/lib/content", async () => {
  const { getPayload } = await import("payload");
  const { default: config } = await import("../src/payload.config");
  return { cms: () => getPayload({ config }) };
});
const stamp = randomBytes(4).toString("hex"), password = `Synthetic-${randomBytes(12).toString("hex")}`;
let p: Payload, admin: User, members: User[], tokens: string[], adminToken: string;
const qs = [{ prompt: "合成题目一", options: ["甲", "乙"] }, { prompt: "合成题目二", options: ["是", "否"] }];

async function user(index: number, roles: User["roles"]) {
  const email = `quiz-${index}-${stamp}@example.invalid`;
  const value = await p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { name: `合成用户${index}-${stamp}`, email, password, roles, affiliation: "tsinghua" } });
  const token = (await p.login({ collection: "users", data: { email, password } })).token!;
  return { value, token };
}
async function createEvent(quantity = 1, threshold = 2) {
  const { id } = await quizAction(admin, { action: "create-event", title: "合成竞猜", description: "合成数据" }) as { id: number };
  await quizAction(admin, { action: "add-prize", eventId: id, name: "合成奖品", quantity });
  const round = await quizAction(admin, { action: "save-round", eventId: id, title: "第一轮", threshold, questions: qs }) as { id: number };
  await quizAction(admin, { action: "update-event", eventId: id, title: "合成竞猜", description: "合成数据", status: "published" });
  await quizAction(admin, { action: "open-round", eventId: id, roundId: round.id });
  return { id, round: round.id };
}
const action = (actor: User, id: number, round: number, kind: string, extra: Record<string, unknown> = {}) =>
  quizAction(actor, { action: kind, eventId: id, roundId: round, ...extra });
async function settle(id: number, round: number) {
  await action(admin, id, round, "close-round");
  await action(admin, id, round, "settle-round", { answers: [0, 1] });
}
const request = (token?: string, body?: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/quiz", {
  method: body === undefined ? "GET" : "POST", headers: { ...(token ? { authorization: `JWT ${token}` } : {}), origin, "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (process.env.QUIZ_TEST !== "isolated" || url.hostname !== "127.0.0.1" || url.pathname !== "/quiz_synthetic") throw new Error("Synthetic quiz database required");
  p = await getPayload({ config });
  const chief = await user(0, ["vicePresident"]); admin = chief.value; adminToken = chief.token;
  const created = await Promise.all([1, 2, 3, 4, 5].map(index => user(index, ["member"])));
  members = created.map(item => item.value); tokens = created.map(item => item.token);
}, 180000);
afterAll(async () => { await closeQuizPool(); if (p) await p.destroy(); });

describe("竞猜与共享奖池：隔离 PostgreSQL", () => {
  it("增量迁移只增加独立表，并保留已有业务记录", async () => {
    await p.db.drizzle.transaction(async tx => {
      const schema = sql.identifier(`quiz_migration_${stamp}`);
      await tx.execute(sql`CREATE SCHEMA ${schema}`); await tx.execute(sql`SET LOCAL search_path TO ${schema}`);
      await tx.execute(sql`CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE legacy(id int PRIMARY KEY, value text); INSERT INTO legacy VALUES (1, 'preserved')`);
      await quizMigration({ db: tx } as unknown as MigrateUpArgs);
      expect((await tx.execute(sql`SELECT value FROM legacy WHERE id=1`)).rows[0]).toEqual({ value: "preserved" });
      expect((await tx.execute(sql`SELECT count(*)::int AS n FROM quiz_events`)).rows[0]).toEqual({ n: 0 });
    });
  });
  it("权限、草稿可见性、同源保护和停用角色均由服务端控制", async () => {
    const draft = await quizAction(admin, { action: "create-event", title: "私有草稿", description: "" }) as { id: number };
    expect((await listQuizEvents(members[0])).events.some(row => row.id === draft.id)).toBe(false);
    await expect(quizEvent(members[0], draft.id)).rejects.toMatchObject({ status: 404 });
    await expect(quizAction(members[0], { action: "add-prize", eventId: draft.id, name: "x", quantity: 1 })).rejects.toMatchObject({ status: 403 });
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request(tokens[0], { action: "add-prize", eventId: draft.id, name: "x", quantity: 1 }))).status).toBe(403);
    expect((await POST(request(undefined, { action: "create-event" }, "https://example.invalid"))).status).toBe(403);
    const response = await GET(request(adminToken)); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("截止前隐藏答案、只接受完整作答一次，开放后锁定题目", async () => {
    const { id, round } = await createEvent();
    const visible = await quizEvent(members[0], id);
    expect(visible.rounds[0].correctAnswers).toBeNull();
    expect(visible.rounds[0].entry).toBeNull();
    expect(JSON.stringify(visible)).not.toContain("correct_answers");
    await expect(action(members[0], id, round, "submit", { answers: [0, null] })).rejects.toMatchObject({ status: 400 });
    await action(members[0], id, round, "submit", { answers: [0, 1] });
    await expect(action(members[0], id, round, "submit", { answers: [1, 0] })).rejects.toMatchObject({ status: 409 });
    await expect(quizAction(admin, { action: "save-round", eventId: id, roundId: round, title: "变更", threshold: 1, questions: qs })).rejects.toMatchObject({ status: 409 });
    await expect(action(admin, id, round, "settle-round", { answers: [0, 1] })).rejects.toMatchObject({ status: 409 });
    expect((await quizEvent(members[1], id)).rounds[0].entry).toBeNull();
  });
  it("按正确题数取得资格，结果仅显示本人记录", async () => {
    const { id, round } = await createEvent();
    await action(members[0], id, round, "submit", { answers: [0, 1] });
    await action(members[1], id, round, "submit", { answers: [0, 0] });
    await settle(id, round);
    const first = await quizEvent(members[0], id), second = await quizEvent(members[1], id);
    expect(first.rounds[0].entry).toMatchObject({ score: 2, eligible: true, prize: null });
    expect(second.rounds[0].entry).toMatchObject({ score: 1, eligible: false });
    expect(first.winners).toEqual([]); expect(second.winners).toEqual([]);
    await expect(action(members[1], id, round, "draw")).rejects.toMatchObject({ status: 403 });
    await expect(action(admin, id, round, "settle-round", { answers: [1, 0] })).rejects.toMatchObject({ status: 409 });
  });
  it("同一用户并发重试只扣一件，奖品不足时资格保留", async () => {
    const { id, round } = await createEvent();
    await action(members[0], id, round, "submit", { answers: [0, 1] });
    await action(members[1], id, round, "submit", { answers: [0, 1] });
    await settle(id, round);
    const pair = await Promise.all([action(members[0], id, round, "draw"), action(members[0], id, round, "draw")]);
    expect(pair).toEqual(expect.arrayContaining([{ prize: "合成奖品", alreadyDrawn: false }, { prize: "合成奖品", alreadyDrawn: true }]));
    await expect(action(members[1], id, round, "draw")).rejects.toMatchObject({ status: 409 });
    let detail = await quizEvent(admin, id); expect(detail.prizes[0].remaining).toBe(0); expect(detail.winners).toHaveLength(1);
    await quizAction(admin, { action: "edit-prize", eventId: id, prizeId: detail.prizes[0].id, name: "合成奖品", quantity: 2 });
    await action(members[1], id, round, "draw"); detail = await quizEvent(admin, id);
    expect(detail.prizes[0].remaining).toBe(0); expect(detail.winners).toHaveLength(2);
    await expect(quizAction(admin, { action: "edit-prize", eventId: id, prizeId: detail.prizes[0].id, name: "改名", quantity: 2 })).rejects.toMatchObject({ status: 409 });
  });
  it("多人并发争夺最后一件奖品时仅一人成功", async () => {
    const { id, round } = await createEvent();
    await Promise.all(members.map(member => action(member, id, round, "submit", { answers: [0, 1] })));
    await settle(id, round);
    const results = await Promise.allSettled(members.map(member => action(member, id, round, "draw")));
    expect(results.filter(item => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(item => item.status === "rejected")).toHaveLength(4);
    const detail = await quizEvent(admin, id); expect(detail.prizes[0].remaining).toBe(0); expect(detail.winners).toHaveLength(1);
  });
  it("多轮共用库存，各轮资格独立", async () => {
    const { id, round } = await createEvent(2, 1);
    await action(members[0], id, round, "submit", { answers: [0, 0] }); await settle(id, round); await action(members[0], id, round, "draw");
    const second = await quizAction(admin, { action: "save-round", eventId: id, title: "第二轮", threshold: 2, questions: qs }) as { id: number };
    await action(admin, id, second.id, "open-round"); await action(members[0], id, second.id, "submit", { answers: [0, 1] });
    await settle(id, second.id); await action(members[0], id, second.id, "draw");
    const result = await quizEvent(admin, id); expect(result.prizes[0].remaining).toBe(0); expect(result.winners).toHaveLength(2);
  });
  it("截止时间到达后拒绝作答并允许公布答案", async () => {
    const { id, round } = await createEvent();
    await p.db.drizzle.execute(sql`UPDATE quiz_rounds SET closes_at=now()-interval '1 minute' WHERE id=${round}`);
    await expect(action(members[0], id, round, "submit", { answers: [0, 1] })).rejects.toMatchObject({ status: 409 });
    expect((await quizEvent(admin, id)).rounds[0].status).toBe("closed");
    await action(admin, id, round, "settle-round", { answers: [0, 1] });
    expect((await quizEvent(admin, id)).rounds[0].status).toBe("settled");
  });
  it.runIf(Boolean(process.env.QUIZ_BROWSER_ORIGIN))("真实浏览器完成答题、公布结果与抽奖（移动宽度）", async () => {
    const { chromium } = await import("@playwright/test");
    const { id, round } = await createEvent();
    const browser = await chromium.launch({ headless: true });
    const origin = process.env.QUIZ_BROWSER_ORIGIN!;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: "payload-token", value: tokens[0], url: origin }]);
    const page = await context.newPage();
    page.on("dialog", dialog => void dialog.accept());
    try {
      await page.goto(`${origin}/quiz?event=${id}`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "第一轮" }).waitFor();
      const fields = page.locator("fieldset");
      await fields.nth(0).getByText("甲", { exact: true }).click();
      await fields.nth(1).getByText("否", { exact: true }).click();
      await page.getByRole("button", { name: "提交竞猜" }).click();
      await page.getByText("已提交，等待公布答案。", { exact: false }).waitFor();
      await settle(id, round);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "抽取奖品" }).click();
      await page.getByText("抽奖结果：合成奖品").waitFor();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
          elements: Array.from(document.querySelectorAll<HTMLElement>("body *"))
            .map(element => ({ tag: element.tagName, className: String(element.className), right: Math.round(element.getBoundingClientRect().right) }))
            .filter(element => element.right > document.documentElement.clientWidth + 1).slice(0, 12) }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.viewport);
        expect(overflow.elements).toEqual([]);
      }
    } finally { await context.close(); await browser.close(); }
  }, 60000);
});
