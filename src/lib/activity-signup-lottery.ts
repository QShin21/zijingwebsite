import { randomInt, randomUUID } from "node:crypto";
import { APIError, type Payload, type PayloadRequest } from "payload";
import type { EventSignupLottery, User } from "@/payload-types";
import type { Answers, Question } from "./signup-schema";
import { activity } from "./activity-signups";
import { workflowTransaction } from "./workflow-transactions";

type Kind = "events" | "community-posts";
type Lottery = { id: number; candidates: number[]; winners: number[]; revision: string; drawnBy: string; drawnAt: string; history: unknown[] };
type Receipt = { id: number; questions: unknown; answers: unknown };
const key = (kind: Kind, id: number) => `${kind}:${id}`;

function parseLottery(row: EventSignupLottery): Lottery {
  const validIDs = (value: unknown): value is number[] => Array.isArray(value) &&
    value.every(id => Number.isSafeInteger(id) && id > 0) && new Set(value).size === value.length;
  if (!validIDs(row.candidates) || !validIDs(row.winners) || !Array.isArray(row.history))
    throw new Error("Invalid stored activity lottery");
  const candidates = new Set(row.candidates);
  if (row.winners.some(id => !candidates.has(id))) throw new Error("Invalid stored activity lottery");
  return { id: row.id, candidates: row.candidates, winners: row.winners, revision: row.revision,
    drawnBy: row.drawnBy, drawnAt: row.updatedAt, history: row.history };
}

export async function readLottery(p: Payload, kind: Kind, id: number, req?: Partial<PayloadRequest>): Promise<Lottery | null> {
  const found = await p.find({ collection: "event-signup-lotteries", overrideAccess: true, req,
    depth: 0, limit: 1, where: { activityKey: { equals: key(kind, id) } } });
  return found.docs[0] ? parseLottery(found.docs[0]) : null;
}

export function lotteryLabel(lottery: Lottery | null, signupID: number): string | null {
  if (!lottery) return null;
  if (!lottery.candidates.includes(signupID)) return "未参与本次抽签";
  return lottery.winners.includes(signupID) ? "已中签" : "未中签";
}

// Existing mini-program versions already render the question/answer pairs in a receipt.
// Add the result only to the response projection; the saved answers remain untouched.
export function lotteryReceipt<T extends Receipt>(receipt: T, lottery: Lottery | null): T {
  const label = lotteryLabel(lottery, receipt.id);
  if (!label) return receipt;
  if (!Array.isArray(receipt.questions) || !receipt.answers || typeof receipt.answers !== "object" || Array.isArray(receipt.answers))
    throw new Error("Invalid activity signup receipt");
  const questions = receipt.questions as Question[], answers = receipt.answers as Answers;
  let resultID = "__lottery_result__";
  while (Object.hasOwn(answers, resultID) || questions.some(question => question.id === resultID)) resultID += "_";
  const question: Question = { id: resultID, label: "抽签结果", type: "text", required: false, options: [] };
  return { ...receipt, lotteryStatus: label, questions: [question, ...questions], answers: { ...answers, [resultID]: label } };
}

async function countSignups(p: Payload, kind: Kind, id: number, req?: PayloadRequest) {
  const result = await p.count({ collection: "event-signups", overrideAccess: true, req,
    where: { and: [{ activityType: { equals: kind } }, { activityID: { equals: id } }] } });
  return result.totalDocs;
}

function summary(lottery: Lottery | null, total: number) {
  return { total, draw: lottery ? { candidates: lottery.candidates.length, winners: lottery.winners.length,
    drawnAt: lottery.drawnAt, revision: lottery.revision } : null };
}

export async function lotteryWorkbench(p: Payload, kind: Kind, id: number, user: User | null) {
  await activity(p, kind, id, user, true);
  const [lottery, total] = await Promise.all([readLottery(p, kind, id), countSignups(p, kind, id)]);
  return summary(lottery, total);
}

export async function drawLottery(p: Payload, kind: Kind, id: number, user: User | null,
  count: unknown, expectedTotal: unknown, revision: unknown) {
  if (!Number.isSafeInteger(count) || Number(count) < 1 || !Number.isSafeInteger(expectedTotal) || Number(expectedTotal) < 0 ||
      !(revision === null || typeof revision === "string" && revision.length <= 100))
    throw new APIError("请填写有效的中签人数并刷新报名人数", 400);
  return workflowTransaction(p, user, { drawEventSignupLottery: true }, async req => {
    await activity(p, kind, id, req.user as User, true, req);
    const previous = await readLottery(p, kind, id, req);
    if ((previous?.revision ?? null) !== revision) throw new APIError("抽签结果已更新，请刷新后再操作", 409);
    const records = await p.find({ collection: "event-signups", overrideAccess: true, req, depth: 0,
      pagination: false, limit: 0, select: { activityID: true },
      where: { and: [{ activityType: { equals: kind } }, { activityID: { equals: id } }] } });
    const candidates = records.docs.map(row => row.id);
    if (candidates.length !== expectedTotal) throw new APIError("报名人数已变化，请刷新后再抽签", 409);
    if (Number(count) > candidates.length) throw new APIError("中签人数不能超过报名人数", 400);
    const pool = [...candidates];
    for (let i = 0; i < Number(count); i++) {
      const chosen = randomInt(i, pool.length);
      [pool[i], pool[chosen]] = [pool[chosen], pool[i]];
    }
    const winners = pool.slice(0, Number(count));
    const history = previous ? [...previous.history, { candidates: previous.candidates, winners: previous.winners,
      revision: previous.revision, drawnBy: previous.drawnBy, drawnAt: previous.drawnAt }] : [];
    const data = { activityKey: key(kind, id), candidates, winners, history, revision: randomUUID(), drawnBy: String(req.user!.id) };
    const saved = previous
      ? await p.update({ collection: "event-signup-lotteries", id: previous.id, overrideAccess: true, req, data })
      : await p.create({ collection: "event-signup-lotteries", overrideAccess: true, req, data });
    await p.create({ collection: "audit", overrideAccess: true, req, data: { actor: String(req.user!.id),
      action: previous ? "redraw-activity-signups" : "draw-activity-signups", object: key(kind, id), status: "published" } });
    return summary(parseLottery(saved), candidates.length);
  });
}
