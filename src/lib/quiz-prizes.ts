import { randomInt } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { APIError } from "payload";
import type { User } from "@/payload-types";
import { canPublish } from "./rules";

type Question = { prompt: string; options: string[] };
type EventRow = { id: number; title: string; description: string; status: string };
type PrizeRow = { id: number; event_id: number; name: string; quantity: number; remaining: number };
type RoundRow = { id: number; event_id: number; title: string; threshold: number; questions: Question[];
  correct_answers: number[] | null; closes_at: Date | null; status: string; settled_at: Date | null };
type EntryRow = { id: number; round_id: number; user_id: number; answers: number[]; prize_id: number | null;
  prize_name?: string | null; score: number | null; submitted_at: Date; drawn_at: Date | null };

let pool: Pool | null = null;
function db() { pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }); return pool; }
export async function closeQuizPool() { const current = pool; pool = null; await current?.end(); }

const fail = (message: string, status = 400): never => { throw new APIError(message, status); };
function positiveID(value: unknown): number {
  const number = typeof value === "string" && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || Number(number) < 1 || Number(number) > 2147483647) fail("编号无效");
  return Number(number);
}
function integer(value: unknown, min: number, max: number, label: string): number {
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || Number(number) < min || Number(number) > max) fail(`${label}无效`);
  return Number(number);
}
function text(value: unknown, max: number, label: string, optional = false): string {
  if (typeof value !== "string") fail(`${label}无效`);
  const result = (value as string).trim();
  if ((!result && !optional) || result.length > max) fail(`${label}长度无效`);
  return result;
}
function questions(value: unknown): Question[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) fail("每轮请设置 1 至 30 道题目");
  return (value as unknown[]).map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) fail("题目格式无效");
    const row = item as Record<string, unknown>;
    if (!Array.isArray(row.options) || row.options.length < 2 || row.options.length > 8) fail("每题请设置 2 至 8 个选项");
    return { prompt: text(row.prompt, 300, "题目"), options: (row.options as unknown[]).map(option => text(option, 160, "选项")) };
  });
}
function answers(value: unknown, items: Question[]): number[] {
  if (!Array.isArray(value) || value.length !== items.length) fail("请完成每一道题");
  return items.map((q, i) => integer((value as unknown[])[i], 0, q.options.length - 1, "选项"));
}
export function quizScore(selected: number[], correct: number[]): number {
  return correct.reduce((sum, answer, index) => sum + (selected[index] === answer ? 1 : 0), 0);
}
function deadline(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 50 || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) fail("截止时间无效");
  const result = new Date(value as string);
  if (!Number.isFinite(result.getTime())) fail("截止时间无效");
  return result;
}
function isClosed(row: RoundRow) { return row.status !== "open" || Boolean(row.closes_at && new Date(row.closes_at).getTime() <= Date.now()); }
function admin(user: User) { if (!canPublish(user)) fail("只有社团管理员可以管理竞猜", 403); }
async function lockedEvent(client: PoolClient, id: number): Promise<EventRow> {
  const result = await client.query<EventRow>("SELECT id,title,description,status FROM quiz_events WHERE id=$1 FOR UPDATE", [id]);
  return result.rows[0] ?? fail("竞猜活动不存在", 404);
}
async function roundFor(client: PoolClient, eventID: number, roundID: unknown): Promise<RoundRow> {
  const result = await client.query<RoundRow>("SELECT * FROM quiz_rounds WHERE id=$1 AND event_id=$2", [positiveID(roundID), eventID]);
  return result.rows[0] ?? fail("竞猜轮次不存在", 404);
}
async function transact<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try { await client.query("BEGIN"); const result = await fn(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function listQuizEvents(user: User) {
  const isAdmin = canPublish(user);
  const result = await db().query<EventRow>(
    "SELECT id,title,description,status FROM quiz_events WHERE status <> 'draft' OR $1 ORDER BY id DESC LIMIT 200", [isAdmin]);
  return { admin: isAdmin, events: result.rows };
}

export async function quizEvent(user: User, input: unknown) {
  const id = positiveID(input), isAdmin = canPublish(user);
  const event = (await db().query<EventRow>("SELECT id,title,description,status FROM quiz_events WHERE id=$1", [id])).rows[0];
  if (!event || (event.status === "draft" && !isAdmin)) fail("竞猜活动不存在", 404);
  const [prizes, rounds, entries, records, counts] = await Promise.all([
    db().query<PrizeRow>("SELECT * FROM quiz_prizes WHERE event_id=$1 ORDER BY id", [id]),
    db().query<RoundRow>("SELECT * FROM quiz_rounds WHERE event_id=$1 AND (status <> 'draft' OR $2) ORDER BY id", [id, isAdmin]),
    db().query<EntryRow>(`SELECT e.*,p.name AS prize_name FROM quiz_entries e JOIN quiz_rounds r ON r.id=e.round_id
      LEFT JOIN quiz_prizes p ON p.id=e.prize_id WHERE r.event_id=$1 AND e.user_id=$2`, [id, user.id]),
    isAdmin ? db().query<{ round_id: number; user_id: number | null; name: string; prize: string; drawn_at: Date }>(
      `SELECT e.round_id,e.user_id,COALESCE(u.name,'已注销账号') AS name,p.name AS prize,e.drawn_at FROM quiz_entries e
       JOIN quiz_rounds r ON r.id=e.round_id LEFT JOIN users u ON u.id=e.user_id JOIN quiz_prizes p ON p.id=e.prize_id
       WHERE r.event_id=$1 ORDER BY e.drawn_at DESC LIMIT 2000`, [id]) : Promise.resolve({ rows: [] }),
    isAdmin ? db().query<{ round_id: number; count: number }>(`SELECT e.round_id,count(*)::int AS count FROM quiz_entries e
      JOIN quiz_rounds r ON r.id=e.round_id WHERE r.event_id=$1 GROUP BY e.round_id`, [id]) : Promise.resolve({ rows: [] }),
  ]);
  const byRound = new Map(entries.rows.map(entry => [entry.round_id, entry]));
  const countsByRound = new Map(counts.rows.map(row => [row.round_id, row.count]));
  return {
    admin: isAdmin, event, prizes: prizes.rows.map(p => ({ id: p.id, name: p.name, quantity: p.quantity, remaining: p.remaining })),
    rounds: rounds.rows.map(row => {
      const entry = byRound.get(row.id);
      const settled = row.status === "settled" && Array.isArray(row.correct_answers);
      const score = entry && settled ? quizScore(entry.answers, row.correct_answers!) : null;
      return { id: row.id, title: row.title, threshold: row.threshold, questions: row.questions,
        status: row.status === "open" && isClosed(row) ? "closed" : row.status,
        closesAt: row.closes_at, settledAt: row.settled_at, submissionCount: isAdmin ? countsByRound.get(row.id) ?? 0 : undefined,
        correctAnswers: settled ? row.correct_answers : null,
        entry: entry ? { answers: entry.answers, submittedAt: entry.submitted_at, score,
          eligible: score !== null && score >= row.threshold, prize: entry.prize_name ?? null, drawnAt: entry.drawn_at } : null };
    }),
    winners: records.rows,
  };
}

export async function quizAction(user: User, data: Record<string, unknown>) {
  const action = text(data.action, 40, "操作");
  if (action === "create-event") {
    admin(user);
    const title = text(data.title, 120, "活动名称"), description = text(data.description ?? "", 2000, "活动说明", true);
    const created = await db().query<{ id: number }>("INSERT INTO quiz_events(title,description,created_by) VALUES($1,$2,$3) RETURNING id", [title, description, user.id]);
    return { id: created.rows[0].id };
  }
  const eventID = positiveID(data.eventId);
  return transact(async client => {
    // All writes for one event share this lock. Submission, closing, settlement,
    // inventory updates and draws therefore observe one consistent order.
    const event = await lockedEvent(client, eventID);
    if (action === "submit" || action === "draw") {
      if (event.status !== "published") fail("活动当前未开放", 409);
      const round = await roundFor(client, eventID, data.roundId);
      const existing = (await client.query<EntryRow>(`SELECT e.*, p.name AS prize_name FROM quiz_entries e
        LEFT JOIN quiz_prizes p ON p.id=e.prize_id WHERE e.round_id=$1 AND e.user_id=$2`, [round.id, user.id])).rows[0];
      if (action === "submit") {
        if (isClosed(round)) fail("本轮竞猜已截止", 409);
        if (existing) fail("本轮已提交，请查看作答记录", 409);
        const selected = answers(data.answers, round.questions);
        await client.query("INSERT INTO quiz_entries(round_id,user_id,answers) VALUES($1,$2,$3::jsonb)", [round.id, user.id, JSON.stringify(selected)]);
        return { submitted: true };
      }
      if (!existing || round.status !== "settled" || !round.correct_answers) fail("公布结果且达到门槛后可抽奖", 409);
      if (existing.prize_id) return { prize: existing.prize_name, alreadyDrawn: true };
      const score = quizScore(existing.answers, round.correct_answers!);
      if (score < round.threshold) fail("本轮答对题数未达到抽奖门槛", 403);
      const prizes = (await client.query<PrizeRow>("SELECT * FROM quiz_prizes WHERE event_id=$1 AND remaining>0 ORDER BY id", [eventID])).rows;
      const total = prizes.reduce((sum, prize) => sum + prize.remaining, 0);
      if (!total) fail("奖池暂时已抽完，请联系管理员", 409);
      let selected = randomInt(total), prize = prizes[0];
      for (const candidate of prizes) { if (selected < candidate.remaining) { prize = candidate; break; } selected -= candidate.remaining; }
      await client.query("UPDATE quiz_prizes SET remaining=remaining-1 WHERE id=$1 AND remaining>0", [prize.id]);
      await client.query("UPDATE quiz_entries SET prize_id=$1,score=$2,drawn_at=now() WHERE id=$3", [prize.id, score, existing.id]);
      return { prize: prize.name, alreadyDrawn: false };
    }
    admin(user);
    if (action === "update-event") {
      const title = text(data.title, 120, "活动名称"), description = text(data.description ?? "", 2000, "活动说明", true);
      const status = text(data.status, 20, "活动状态");
      if (!["draft", "published", "archived"].includes(status) || (event.status !== "draft" && status === "draft")) fail("活动状态无效");
      await client.query("UPDATE quiz_events SET title=$2,description=$3,status=$4,updated_at=now() WHERE id=$1", [eventID, title, description, status]);
      return { saved: true };
    }
    if (action === "add-prize") {
      const name = text(data.name, 120, "奖品名称"), quantity = integer(data.quantity, 1, 100000, "奖品数量");
      const count = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM quiz_prizes WHERE event_id=$1", [eventID]);
      if (count.rows[0].n >= 100) fail("每个活动最多设置 100 种奖品");
      await client.query("INSERT INTO quiz_prizes(event_id,name,quantity,remaining) VALUES($1,$2,$3,$3)", [eventID, name, quantity]);
      return { saved: true };
    }
    if (action === "edit-prize") {
      const id = positiveID(data.prizeId), name = text(data.name, 120, "奖品名称"), quantity = integer(data.quantity, 1, 100000, "奖品数量");
      const prize = (await client.query<PrizeRow>("SELECT * FROM quiz_prizes WHERE id=$1 AND event_id=$2", [id, eventID])).rows[0];
      if (!prize) fail("奖品不存在", 404);
      const awarded = prize.quantity - prize.remaining;
      if (quantity < awarded) fail("奖品数量不能少于已抽出数量", 409);
      if (awarded && name !== prize.name) fail("已有中奖记录的奖品请保留名称", 409);
      await client.query("UPDATE quiz_prizes SET name=$2,quantity=$3,remaining=$3::integer-$4::integer WHERE id=$1", [id, name, quantity, awarded]);
      return { saved: true };
    }
    if (action === "save-round") {
      const title = text(data.title, 120, "轮次名称"), items = questions(data.questions), threshold = integer(data.threshold, 1, items.length, "答对门槛"), closesAt = deadline(data.closesAt);
      if (data.roundId) {
        const row = await roundFor(client, eventID, data.roundId);
        if (row.status !== "draft") fail("开放后的题目和门槛已锁定", 409);
        await client.query("UPDATE quiz_rounds SET title=$2,questions=$3::jsonb,threshold=$4,closes_at=$5 WHERE id=$1", [row.id, title, JSON.stringify(items), threshold, closesAt]);
        return { id: row.id };
      }
      const count = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM quiz_rounds WHERE event_id=$1", [eventID]);
      if (count.rows[0].n >= 200) fail("每个活动最多设置 200 轮");
      const created = await client.query<{ id: number }>("INSERT INTO quiz_rounds(event_id,title,questions,threshold,closes_at) VALUES($1,$2,$3::jsonb,$4,$5) RETURNING id", [eventID, title, JSON.stringify(items), threshold, closesAt]);
      return { id: created.rows[0].id };
    }
    if (["open-round", "close-round", "settle-round"].includes(action)) {
      const row = await roundFor(client, eventID, data.roundId);
      if (action === "open-round") {
        if (event.status === "archived") fail("活动已结束，请先在活动管理中重新开放", 409);
        if (row.status !== "draft") fail("轮次状态已变化，请刷新后重试", 409);
        if (row.closes_at && new Date(row.closes_at).getTime() <= Date.now()) fail("截止时间需要晚于当前时间", 400);
        const count = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM quiz_prizes WHERE event_id=$1", [eventID]);
        if (!count.rows[0].n) fail("请先设置共享奖池", 400);
        // The first open operation publishes its draft event in the same transaction.
        if (event.status === "draft") await client.query("UPDATE quiz_events SET status='published',updated_at=now() WHERE id=$1", [eventID]);
        await client.query("UPDATE quiz_rounds SET status='open' WHERE id=$1", [row.id]);
      } else if (action === "close-round") {
        if (row.status !== "open") fail("本轮状态已变化，请刷新", 409);
        await client.query("UPDATE quiz_rounds SET status='closed' WHERE id=$1", [row.id]);
      } else {
        if (row.status !== "closed" && !(row.status === "open" && isClosed(row))) fail("请先截止本轮，再公布答案", 409);
        const correct = answers(data.answers, row.questions);
        await client.query("UPDATE quiz_rounds SET status='settled',correct_answers=$2::jsonb,settled_at=now() WHERE id=$1", [row.id, JSON.stringify(correct)]);
      }
      return { saved: true };
    }
    return fail("操作不存在", 404);
  });
}
