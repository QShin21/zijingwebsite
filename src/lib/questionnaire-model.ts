import {
  normalizeCondition,
  validateFlow,
  matchesCondition,
} from "./questionnaire-flow";
import {
  normalizeSignup,
  validateAnswers,
  type Answer,
  type EntryAnswer,
  type EntryField,
  type Question,
  type SignupForm,
} from "./signup-schema";
export const questionTypes: Record<Question["type"], string> = {
  text: "单行文本",
  textarea: "多行文本",
  single: "单选",
  multiple: "多选",
  select: "下拉选择",
  number: "数字",
  date: "日期",
  time: "时间",
  rating: "评分量表",
  nps: "NPS 推荐度",
  ranking: "排序",
  matrix: "矩阵单选",
  matrixMultiple: "矩阵多选",
  blanks: "多项填空",
  group: "可增减信息组",
  description: "段落说明",
};
export const hasOptions = (type: string) =>
  [
    "single",
    "multiple",
    "select",
    "ranking",
    "matrix",
    "matrixMultiple",
  ].includes(type);
export const hasRows = (type: string) =>
  ["matrix", "matrixMultiple", "blanks"].includes(type);
function fail(message: string): never {
  throw new Error(message);
}
export function normalizeQuestionExtras(
  raw: Record<string, unknown>,
  q: Question,
) {
  if (raw.pageBreak === true) q.pageBreak = true;
  if (raw.randomize === true && hasOptions(q.type) && q.type !== "ranking")
    q.randomize = true;
  if (q.type === "description") q.required = false;
  if (q.type === "group") {
    if (
      !Array.isArray(raw.fields) ||
      !raw.fields.length ||
      raw.fields.length > 10
    )
      fail(q.label + "：信息组需要 1–10 个字段");
    const fields = (raw.fields as Record<string, unknown>[]).map((field) => {
      if (!field || !["text", "select", "number"].includes(String(field.type)))
        fail(q.label + "：字段仅支持文本、下拉选择和数字");
      if (field.display || field.showWhen || field.jumps)
        fail(q.label + "：组内字段不支持分支，请在信息组题目上设置");
      return Object.fromEntries(
        [
          "id",
          "label",
          "type",
          "required",
          "options",
          "format",
          "minLength",
          "maxLength",
          "min",
          "max",
          "step",
          "placeholder",
        ]
          .filter((key) => field[key] != null)
          .map((key) => [key, field[key]]),
      );
    });
    q.fields = normalizeSignup({ enabled: true, questions: fields })
      .questions as EntryField[];
    for (const key of ["minEntries", "maxEntries"] as const) {
      const value = raw[key] ?? (key === "minEntries" ? 1 : 10);
      if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 20)
        fail(q.label + "：记录条数应为 1–20 的整数");
      q[key] = Number(value);
    }
    if (q.minEntries! > q.maxEntries!)
      fail(q.label + "：最少条数不能超过最多条数");
  }
  if (hasRows(q.type)) {
    if (
      !Array.isArray(raw.rows) ||
      !raw.rows.length ||
      raw.rows.length > 20 ||
      raw.rows.some(
        (v) => typeof v !== "string" || !v.trim() || v.trim().length > 120,
      )
    )
      fail(q.label + "：请配置 1–20 个子题，每项最多 120 字");
    q.rows = (raw.rows as string[]).map((v) => v.trim());
    if (
      new Set(q.rows).size !== q.rows.length ||
      q.rows.some(
        (v) => Object.hasOwn(Object.prototype, v) || v === "prototype",
      )
    )
      fail(q.label + "：子题名称重复或无效");
  }
  if (["number", "rating", "nps"].includes(q.type)) {
    for (const key of ["min", "max", "step"] as const) {
      if (raw[key] != null) {
        if (
          typeof raw[key] !== "number" ||
          !Number.isFinite(raw[key]) ||
          Math.abs(raw[key] as number) > 1e9
        )
          fail(q.label + "：数值限制无效");
        q[key] = raw[key] as number;
      }
    }
    if (q.type === "nps") {
      q.min = 0;
      q.max = 10;
      q.step = 1;
    }
    if (q.type === "rating") {
      q.min ??= 1;
      q.max ??= 5;
      q.step = 1;
      if (
        !Number.isInteger(q.min) ||
        !Number.isInteger(q.max) ||
        q.min < 0 ||
        q.max > 10
      )
        fail(q.label + "：评分范围应为 0–10 内的整数");
    }
    if (q.min != null && q.max != null && q.min >= q.max)
      fail(q.label + "：最大值应大于最小值");
    if (q.step != null && q.step <= 0) fail(q.label + "：步长应大于零");
  }
  if (raw.display != null) q.display = normalizeCondition(raw.display);
  if (raw.jumps != null) {
    if (!Array.isArray(raw.jumps) || !raw.jumps.length || raw.jumps.length > 10)
      fail(q.label + "：跳转应包含 1–10 条分支");
    q.jumps = raw.jumps.map((raw) => {
      if (!raw || typeof raw !== "object" || typeof raw.target !== "string")
        fail(q.label + "：跳转规则无效");
      return {
        ...(raw.when != null ? { when: normalizeCondition(raw.when) } : {}),
        target: raw.target,
      };
    });
  }
}
export function normalizeFormExtras(
  raw: Record<string, unknown>,
  questions: Question[],
): Partial<SignupForm> {
  const result: Partial<SignupForm> = {};
  for (const key of ["title", "completionMessage"] as const) {
    if (raw[key] != null && typeof raw[key] !== "string")
      fail("问卷文案格式无效");
    const text = String(raw[key] || "").trim();
    if (text.length > (key === "title" ? 120 : 1000)) fail("问卷文案过长");
    if (text) result[key] = text;
  }
  if (raw.theme != null) {
    if (!["purple", "blue", "green"].includes(String(raw.theme)))
      fail("主题无效");
    result.theme = raw.theme as SignupForm["theme"];
  }
  validateFlow(questions);
  if (raw.enabled === true && !questions.some((q) => q.type !== "description"))
    fail("问卷至少需要一道作答题");
  return result;
}
export function matchesDisplay(
  q: Question,
  answers: Record<string, unknown>,
  visible: Set<string>,
): boolean {
  return matchesCondition(q.display, answers, visible);
}
export function validateAdvancedAnswer(q: Question, raw: unknown): Answer {
  const failAnswer = (hint: string): never => fail(q.label + "：" + hint);
  if (q.type === "group") {
    if (
      raw != null &&
      (!Array.isArray(raw) ||
        raw.some(
          (row) => !row || typeof row !== "object" || Array.isArray(row),
        ))
    )
      failAnswer("信息组填写格式无效");
    const entries = (raw || []) as Record<string, unknown>[];
    if (
      entries.some((row) =>
        Object.keys(row).some(
          (id) => !q.fields!.some((field) => field.id === id),
        ),
      )
    )
      failAnswer("字段已变化，请刷新后填写");
    if (entries.length > q.maxEntries!)
      failAnswer(`最多填写 ${q.maxEntries} 条记录`);
    const nonempty = entries.some((row) =>
      Object.values(row).some((value) => value !== "" && value != null),
    );
    if (!q.required && !nonempty) return [];
    if (entries.length < q.minEntries!)
      failAnswer(`至少填写 ${q.minEntries} 条记录`);
    return entries.map((row, index) => {
      try {
        const result = validateAnswers(
          {
            enabled: true,
            closed: false,
            start: "",
            end: "",
            intro: "",
            questions: q.fields!,
          },
          row,
        );
        if (
          !Object.values(result).some(
            (value) => typeof value === "string" && value.trim(),
          )
        )
          throw new Error("请填写此条记录，或移除多余的空记录");
        return result as EntryAnswer;
      } catch (error) {
        return failAnswer(`第 ${index + 1} 条：${(error as Error).message}`);
      }
    });
  }
  if (hasRows(q.type)) {
    if (raw != null && (typeof raw !== "object" || Array.isArray(raw)))
      failAnswer("子题填写格式无效");
    const input = (raw || {}) as Record<string, unknown>,
      result: Record<string, string | string[]> = {};
    if (Object.keys(input).some((key) => !q.rows!.includes(key)))
      failAnswer("子题已变化，请刷新");
    for (const row of q.rows!) {
      const value = input[row];
      if (q.type === "matrixMultiple") {
        if (
          value != null &&
          (!Array.isArray(value) ||
            value.some((v) => typeof v !== "string" || !q.options.includes(v)))
        )
          failAnswer(row + "选项无效");
        const answer = [...new Set((value || []) as string[])];
        if (q.required && !answer.length) failAnswer("请完成“" + row + "”");
        result[row] = answer;
      } else {
        if (value != null && typeof value !== "string")
          failAnswer(row + "格式无效");
        const answer = String(value || "").trim();
        if (
          (q.required && !answer) ||
          answer.length > 200 ||
          (q.type === "matrix" && answer && !q.options.includes(answer))
        )
          failAnswer("请检查“" + row + "”");
        result[row] = answer;
      }
    }
    return result;
  }
  if (q.type === "ranking") {
    if (
      raw != null &&
      (!Array.isArray(raw) || raw.some((v) => typeof v !== "string"))
    )
      failAnswer("请完成排序");
    const answer = (raw || []) as string[];
    if (!q.required && !answer.length) return [];
    if (
      answer.length !== q.options.length ||
      new Set(answer).size !== answer.length ||
      answer.some((v) => !q.options.includes(v))
    )
      failAnswer("请为所有选项选择不同名次");
    return answer;
  }
  if (raw != null && typeof raw !== "string") failAnswer("填写格式无效");
  const answer = String(raw || "").trim();
  if (!answer) {
    if (q.required) failAnswer("请填写此题");
    return "";
  }
  if (answer.length > 200) failAnswer("答案过长");
  if (q.type === "select" && !q.options.includes(answer))
    failAnswer("请选择有效选项");
  if (["number", "rating", "nps"].includes(q.type)) {
    const n = Number(answer);
    if (
      !/^-?\d+(\.\d+)?$/.test(answer) ||
      !Number.isFinite(n) ||
      (q.min != null && n < q.min) ||
      (q.max != null && n > q.max)
    )
      failAnswer(
        `请填写范围内的数字（${q.min ?? "不限"} 至 ${q.max ?? "不限"}）`,
      );
    if (
      q.step != null &&
      Math.abs(
        (n - (q.min || 0)) / q.step - Math.round((n - (q.min || 0)) / q.step),
      ) > 1e-7
    )
      failAnswer("数值不符合步长");
  }
  if (
    q.type === "date" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(answer) ||
      !Number.isFinite(Date.parse(answer)) ||
      new Date(answer).toISOString().slice(0, 10) !== answer)
  )
    failAnswer("请输入有效日期");
  if (q.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(answer))
    failAnswer("请输入有效时间");
  return answer;
}
export function formatAnswer(
  answer: Answer | undefined,
  question?: Question,
): string {
  if (answer == null || answer === "") return "未填写";
  if (Array.isArray(answer))
    return (
      answer
        .map((row, index) =>
          typeof row === "string"
            ? row
            : `第 ${index + 1} 条：` +
              Object.entries(row)
                .map(
                  ([key, value]) =>
                    `${question?.fields?.find((field) => field.id === key)?.label || key}：${value || "未填写"}`,
                )
                .join("；"),
        )
        .join(answer.some((v) => typeof v === "object") ? "\n" : "、") ||
      "未填写"
    );
  if (typeof answer === "object")
    return Object.entries(answer)
      .map(
        ([row, value]) =>
          `${row}：${Array.isArray(value) ? value.join("、") || "未填写" : value || "未填写"}`,
      )
      .join("\n");
  return answer;
}
export function questionPages(
  questions: Question[],
  size: number,
): Question[][] {
  const pages: Question[][] = [];
  let afterJump = false;
  for (const q of questions) {
    if (
      afterJump ||
      !pages.length ||
      (q.pageBreak && pages.at(-1)!.length) ||
      pages.at(-1)!.filter((v) => v.type !== "description").length >= size
    )
      pages.push([]);
    pages.at(-1)!.push(q);
    afterJump = Boolean(q.jumps?.length);
  }
  return pages.length ? pages : [[]];
}

// Restore only bounded, well-shaped values belonging to the current form.
export function sanitizeDraft(form: SignupForm, raw: Record<string, unknown>) {
  const result: Record<string, Answer> = {};
  for (const q of form.questions) {
    const value = raw[q.id];
    if (q.type === "group") {
      if (Array.isArray(value))
        result[q.id] = value
          .slice(0, q.maxEntries || 20)
          .filter(
            (row) => row && typeof row === "object" && !Array.isArray(row),
          )
          .map((row) =>
            Object.fromEntries(
              (q.fields || []).map((field) => [
                field.id,
                typeof row[field.id] === "string"
                  ? row[field.id].slice(0, field.maxLength || 200)
                  : "",
              ]),
            ),
          );
    } else if (hasRows(q.type)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const rows: Record<string, string | string[]> = {};
        for (const row of q.rows || []) {
          const v = (value as Record<string, unknown>)[row];
          if (typeof v === "string") rows[row] = v.slice(0, 200);
          else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
            rows[row] = v.slice(0, 50).map((x) => x.slice(0, 120));
        }
        result[q.id] = rows;
      }
    } else if (typeof value === "string")
      result[q.id] = value.slice(0, q.type === "textarea" ? 2000 : 200);
    else if (
      ["multiple", "ranking"].includes(q.type) &&
      Array.isArray(value) &&
      value.every((x) => typeof x === "string")
    )
      result[q.id] = value.slice(0, 50).map((x) => x.slice(0, 120));
  }
  return result;
}
export function randomizedOptions(options: string[], seed: string): string[] {
  const hash = (value: string) => {
    let n = 2166136261;
    for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  };
  return [...options].sort((a, b) => hash(seed + a) - hash(seed + b));
}
