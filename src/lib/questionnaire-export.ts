import { APIError } from "payload";
import type { Answer, EntryField, Question } from "./signup-schema";
import type { ResponseRecord } from "./questionnaire-results";
import { formatAnswer } from "./questionnaire-model";

export type ResponseExportLayout = "responses" | "members" | "long";
type Cell = string | number;
type Definition = {
  key: string;
  question: Question;
  options: string[];
  rows: string[];
  fields: EntryField[];
  entries: number;
  heading: string;
};
type Column = {
  definition: Definition;
  heading: string;
  read: (answer: Answer | undefined, question: Question) => Cell;
};
const identity = (q: Pick<Question, "id" | "label" | "type">) =>
  JSON.stringify([q.id, q.label, q.type]);
const unique = (a: string[], b: string[]) => [...new Set([...a, ...b])];
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const scalar = (value: unknown, numeric = false): Cell => {
  if (value == null || value === "") return "";
  if (numeric && Number.isFinite(Number(value))) return Number(value);
  return typeof value === "string" || typeof value === "number" ? value : "";
};

export function responseExportLayout(
  value: string | null,
): ResponseExportLayout {
  if (!value) return "responses";
  if (["responses", "members", "long"].includes(value))
    return value as ResponseExportLayout;
  throw new APIError("导出格式无效，请选择答卷表、成员明细或按题明细", 400);
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (
    typeof value !== "number" &&
    (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
  )
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
function csv(rows: Iterable<Cell[]>) {
  const lines: string[] = [];
  let bytes = 3;
  for (const row of rows) {
    const line = row.map(csvCell).join(",");
    bytes += Buffer.byteLength(line, "utf8") + 2;
    if (bytes > 32 * 1024 * 1024)
      throw new APIError(
        "导出文件超过 32 MB，请缩小筛选范围或改用按题明细",
        400,
      );
    lines.push(line);
  }
  return "\uFEFF" + lines.join("\r\n");
}
function beijingTime(value: string | undefined) {
  if (!value) return "";
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time + 8 * 3600000).toISOString().slice(0, 19).replace("T", " ")
    : value;
}
const metadataHeaders = [
  "报名编号",
  "填写者",
  "首次提交时间（北京时间）",
  "最后修改时间（北京时间）",
  "问卷版本",
];
const metadata = (r: ResponseRecord): Cell[] => [
  r.id,
  r.memberName || "",
  beijingTime(r.createdAt),
  beijingTime(r.updatedAt || r.createdAt),
  r.formVersion || "",
];

// Merge by identity, retaining deleted questions, options and fields from snapshots.
// A changed question title/type becomes a separate column family to retain its meaning.
function definitions(records: ResponseRecord[], current: Question[]) {
  const result = new Map<string, Definition>();
  const add = (q: Question, answer?: Answer) => {
    if (q.type === "description") return;
    const key = identity(q);
    let d = result.get(key);
    if (!d) {
      d = {
        key,
        question: q,
        options: [],
        rows: [],
        fields: [],
        entries: 0,
        heading: `Q${result.size + 1}. ${q.label}`,
      };
      result.set(key, d);
    }
    d.options = unique(d.options, q.options || []);
    d.rows = unique(d.rows, q.rows || []);
    for (const field of q.fields || [])
      if (!d.fields.some((f) => identity(f) === identity(field)))
        d.fields.push(field);
    if (q.type === "group")
      d.entries = Math.max(
        d.entries,
        q.maxEntries || 1,
        Array.isArray(answer) ? answer.length : 0,
      );
  };
  current.forEach((q) => add(q));
  records.forEach((r) => r.questions.forEach((q) => add(q, r.answers[q.id])));
  return [...result.values()];
}
function fieldValue(entry: unknown, field: EntryField, question: Question) {
  return object(entry) &&
    question.fields?.some((f) => identity(f) === identity(field))
    ? scalar(entry[field.id], field.type === "number")
    : "";
}
function fieldHeading(d: Definition, field: EntryField, index: number) {
  return d.fields.filter((f) => f.label === field.label).length > 1
    ? `${field.label} [${index + 1}]`
    : field.label;
}
function columns(defs: Definition[]): Column[] {
  return defs.flatMap((d) => {
    const q = d.question;
    const column = (suffix: string, read: Column["read"]): Column => ({
      definition: d,
      heading: d.heading + (suffix ? ` / ${suffix}` : ""),
      read,
    });
    if (q.type === "group")
      return [
        column("记录数", (a) => (Array.isArray(a) ? a.length : "")),
        ...Array.from({ length: d.entries }, (_, index) =>
          d.fields.map((field, fi) =>
            column(
              `第${index + 1}条 / ${fieldHeading(d, field, fi)}`,
              (a, own) =>
                fieldValue(Array.isArray(a) ? a[index] : undefined, field, own),
            ),
          ),
        ).flat(),
      ];
    if (q.type === "multiple")
      return d.options.map((option) =>
        column(option, (a, own) =>
          Array.isArray(a) && own.options.includes(option)
            ? Number(a.some((value) => value === option))
            : "",
        ),
      );
    if (q.type === "ranking")
      return d.options.map((option) =>
        column(`${option}（名次）`, (a) =>
          Array.isArray(a) && a.some((value) => value === option)
            ? a.findIndex((value) => value === option) + 1
            : "",
        ),
      );
    if (q.type === "matrixMultiple")
      return d.rows.flatMap((row) =>
        d.options.map((option) =>
          column(`${row} / ${option}`, (a, own) =>
            object(a) && Array.isArray(a[row]) && own.options.includes(option)
              ? Number(a[row].includes(option))
              : "",
          ),
        ),
      );
    if (q.type === "matrix" || q.type === "blanks")
      return d.rows.map((row) =>
        column(row, (a) => (object(a) ? scalar(a[row]) : "")),
      );
    return [
      column("", (a) =>
        scalar(a, ["number", "rating", "nps"].includes(q.type)),
      ),
    ];
  });
}
function reader(record: ResponseRecord) {
  const own = new Map(record.questions.map((q) => [identity(q), q]));
  return (column: Column): Cell => {
    const question = own.get(column.definition.key);
    return question && Object.hasOwn(record.answers, question.id)
      ? column.read(record.answers[question.id], question)
      : "";
  };
}
function* responseRows(records: ResponseRecord[], defs: Definition[]) {
  const cols = columns(defs);
  yield uniqueHeaders([...metadataHeaders, ...cols.map((c) => c.heading)]);
  for (const record of records)
    yield [...metadata(record), ...cols.map(reader(record))];
}
function* memberRows(records: ResponseRecord[], defs: Definition[]) {
  const context = columns(defs.filter((d) => d.question.type !== "group"));
  const groups = defs.filter((d) => d.question.type === "group");
  const shared = new Map<
    string,
    { heading: string; sources: Map<string, EntryField> }
  >();
  for (const d of groups)
    d.fields.forEach((field, index) => {
      const ambiguous =
        d.fields.filter((f) => f.label === field.label && f.type === field.type)
          .length > 1;
      const key = ambiguous
        ? JSON.stringify([d.key, identity(field)])
        : JSON.stringify([field.label, field.type]);
      if (!shared.has(key))
        shared.set(key, {
          heading: ambiguous
            ? `${d.heading} / ${fieldHeading(d, field, index)}`
            : field.label,
          sources: new Map(),
        });
      shared.get(key)!.sources.set(d.key, field);
    });
  const fields = [...shared.values()];
  yield uniqueHeaders([
    ...metadataHeaders,
    ...context.map((c) => c.heading),
    "信息组题目",
    "组内序号",
    ...fields.map((f) => f.heading),
  ]);
  for (const record of records) {
    const prefix = [...metadata(record), ...context.map(reader(record))];
    for (const q of record.questions.filter((q) => q.type === "group")) {
      const entries = record.answers[q.id];
      if (!Array.isArray(entries)) continue;
      for (const [index, entry] of entries.entries())
        yield [
          ...prefix,
          q.label,
          index + 1,
          ...fields.map((f) => {
            const field = f.sources.get(identity(q));
            return field ? fieldValue(entry, field, q) : "";
          }),
        ];
    }
  }
}
function uniqueHeaders(headers: string[]) {
  const used = new Set<string>();
  return headers.map((heading) => {
    let result = heading,
      suffix = 2;
    while (used.has(result)) result = `${heading} [${suffix++}]`;
    used.add(result);
    return result;
  });
}
function* longRows(records: ResponseRecord[]) {
  yield [...metadataHeaders, "题目标识", "题目", "题型", "答案"];
  for (const r of records)
    for (const q of r.questions)
      if (q.type !== "description" && Object.hasOwn(r.answers, q.id))
        yield [
          ...metadata(r),
          q.id,
          q.label,
          q.type,
          formatAnswer(r.answers[q.id], q),
        ];
}
export function responseCSV(
  records: ResponseRecord[],
  currentQuestions: Question[] = [],
  layout: ResponseExportLayout = "responses",
) {
  if (layout === "long") return csv(longRows(records));
  const defs = definitions(records, currentQuestions);
  return csv(
    layout === "members"
      ? memberRows(records, defs)
      : responseRows(records, defs),
  );
}
export function responseExportFilename(
  title: string,
  layout: ResponseExportLayout,
  now = new Date(),
) {
  const name =
    [
      ...title
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/\p{Cc}/gu, "_")
        .trim(),
    ]
      .slice(0, 60)
      .join("") || "问卷";
  const label = { responses: "答卷表", members: "成员明细", long: "按题明细" }[
    layout
  ];
  const timestamp = beijingTime(now.toISOString()).replaceAll(/[- :]/g, "");
  return `${name}-${label}-${timestamp}.csv`;
}
