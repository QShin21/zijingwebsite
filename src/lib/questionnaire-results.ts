import type { Payload, PayloadRequest, Where } from "payload";
import { APIError } from "payload";
import type { User } from "@/payload-types";
import type { Answers, Question } from "./signup-schema";
import { formatAnswer } from "./questionnaire-model";
export { csvCell, responseCSV } from "./questionnaire-export";
export type ResponseRecord = {
  id: number;
  createdAt: string;
  updatedAt?: string;
  memberName?: string;
  memberEmail?: string;
  lotteryStatus?: string;
  formVersion?: string;
  questions: Question[];
  answers: Answers;
};
export type QuestionSummary = {
  id: string;
  label: string;
  type: string;
  shown: number;
  answered: number;
  counts: { label: string; count: number; percent: number }[];
  average?: number;
  nps?: number;
};
export function summarizeResponses(records: ResponseRecord[]) {
  const versions = new Map<string, ResponseRecord[]>();
  for (const r of records) {
    const version = r.formVersion || "legacy";
    versions.set(version, [...(versions.get(version) || []), r]);
  }
  return [...versions].map(([version, docs]) => {
    const definitions = new Map<string, Question>();
    docs.forEach((r) => r.questions.forEach((q) => definitions.set(q.id, q)));
    const questions: QuestionSummary[] = [...definitions.values()]
      .filter((q) => q.type !== "description")
      .map((q) => {
        const applicable = docs.filter((r) => Object.hasOwn(r.answers, q.id));
        const values = applicable.map((r) => r.answers[q.id]);
        const filled = values.filter((v) =>
          typeof v === "string"
            ? v.trim()
            : Array.isArray(v)
              ? v.length
              : Object.values(v).some((x) => (Array.isArray(x) ? x.length : x)),
        );
        const counts = new Map<string, number>();
        const add = (label: string, n = 1) =>
          counts.set(label, (counts.get(label) || 0) + n);
        if (
          ["single", "multiple", "select", "rating", "nps", "ranking"].includes(
            q.type,
          )
        ) {
          if (q.type !== "ranking")
            q.options.forEach((option) => counts.set(option, 0));
          filled.forEach((v) => {
            if (Array.isArray(v))
              v.filter((x) => typeof x === "string").forEach((x, i) =>
                add(q.type === "ranking" ? `${i + 1} 名：${x}` : x),
              );
            else if (typeof v === "string") add(v);
          });
        }
        if (q.type === "group")
          filled.forEach((v) => {
            if (Array.isArray(v)) add(`${v.length} 条记录`);
          });
        if (["matrix", "matrixMultiple"].includes(q.type))
          filled.forEach((v) => {
            if (typeof v === "object" && !Array.isArray(v))
              Object.entries(v).forEach(([row, answer]) =>
                (Array.isArray(answer) ? answer : [answer])
                  .filter(Boolean)
                  .forEach((option) => add(`${row}：${option}`)),
              );
          });
        const result: QuestionSummary = {
          id: q.id,
          label: q.label,
          type: q.type,
          shown: applicable.length,
          answered: filled.length,
          counts: [...counts].map(([label, count]) => ({
            label,
            count,
            percent: filled.length
              ? Math.round((count / filled.length) * 1000) / 10
              : 0,
          })),
        };
        if (["number", "rating", "nps"].includes(q.type)) {
          const numbers = filled.map(Number).filter(Number.isFinite);
          if (numbers.length)
            result.average =
              Math.round(
                (numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100,
              ) / 100;
          if (q.type === "nps" && numbers.length)
            result.nps = Math.round(
              ((numbers.filter((n) => n >= 9).length -
                numbers.filter((n) => n <= 6).length) /
                numbers.length) *
                100,
            );
        }
        return result;
      });
    return { version, total: docs.length, questions };
  });
}
// Called only after activity(..., edit=true) has authorized this exact activity.
export async function queryResponses(
  p: Payload,
  kind: string,
  id: number,
  user: User | null,
  query: URLSearchParams,
  includeEmail = false,
) {
  const clauses: Where[] = [
    { activityType: { equals: kind } },
    { activityID: { equals: id } },
  ];
  const name = (query.get("name") || "").trim();
  if (name.length > 100) throw new APIError("搜索内容过长", 400);
  if (name) clauses.push({ memberName: { contains: name } });
  for (const key of ["from", "to"] as const) {
    const date = query.get(key);
    if (!date) continue;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw new APIError("筛选日期无效", 400);
    clauses.push({
      createdAt: {
        [key === "from" ? "greater_than_equal" : "less_than_equal"]:
          date + (key === "from" ? "T00:00:00+08:00" : "T23:59:59.999+08:00"),
      },
    });
  }
  if (
    query.get("from") &&
    query.get("to") &&
    query.get("from")! > query.get("to")!
  )
    throw new APIError("开始日期不能晚于结束日期", 400);
  const records: (ResponseRecord & { member?: number | { id: number } | null })[] = [];
  let bytes = 0;
  for (let page = 1; ; page++) {
    const result = await p.find({
      collection: "event-signups",
      overrideAccess: false,
      user,
      depth: 0,
      page,
      limit: 200,
      sort: "id",
      where: { and: clauses },
      select: {
        memberName: true,
        ...(includeEmail ? { member: true } : {}),
        answers: true,
        questions: true,
        formVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (result.totalDocs > 10000)
      throw new APIError(
        "本次结果超过 10000 份，请缩小日期或姓名范围后导出",
        400,
      );
    bytes += new TextEncoder().encode(JSON.stringify(result.docs)).length;
    if (bytes > 16 * 1024 * 1024)
      throw new APIError("筛选结果超过 16 MB，请缩小日期或姓名范围", 400);
    records.push(...(result.docs as unknown as typeof records));
    if (!result.hasNextPage) break;
  }
  const question = query.get("question"),
    answer = (query.get("answer") || "").trim();
  if (answer.length > 200) throw new APIError("答案筛选内容过长", 400);
  const filtered = question && answer
    ? records.filter(
        (r) =>
          Object.hasOwn(r.answers, question) &&
          formatAnswer(
            r.answers[question],
            r.questions.find((q) => q.id === question),
          ).includes(answer),
      )
    : records;
  if (!includeEmail) return filtered;
  const emails = await accountEmails(p, filtered.map((record) => record.member));
  return filtered.map(({ member, ...record }) => ({
    ...record,
    memberEmail: emails.get(accountID(member)) || "",
  }));
}

function accountID(value: unknown) {
  const raw = value && typeof value === "object" && "id" in value ? value.id : value;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

// Call only after the exact activity or staff batch has authorized an export.
// Fetch the email field for the selected respondents without exposing user profiles.
export async function accountEmails(p: Payload, members: unknown[], req?: PayloadRequest) {
  const ids = [...new Set(members.map(accountID).filter(Boolean))];
  const emails = new Map<number, string>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200);
    const result = await p.find({
      collection: "users",
      overrideAccess: true,
      ...(req ? { req } : {}),
      depth: 0,
      limit: batch.length,
      pagination: false,
      where: { id: { in: batch } },
      select: { email: true },
    });
    for (const user of result.docs) emails.set(user.id, user.email || "");
  }
  return emails;
}
