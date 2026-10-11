import {
  questionRoute,
  type ConditionGroup,
  type JumpRule,
} from "./questionnaire-flow";
import {
  normalizeQuestionExtras,
  normalizeFormExtras,
  validateAdvancedAnswer,
} from "./questionnaire-model";
export type Question = {
  id: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "single"
    | "multiple"
    | "select"
    | "number"
    | "date"
    | "time"
    | "rating"
    | "nps"
    | "ranking"
    | "matrix"
    | "matrixMultiple"
    | "blanks"
    | "group"
    | "description";
  fields?: EntryField[];
  minEntries?: number;
  maxEntries?: number;
  rows?: string[];
  min?: number;
  max?: number;
  step?: number;
  pageBreak?: boolean;
  randomize?: boolean;
  display?: ConditionGroup;
  jumps?: JumpRule[];
  required: boolean;
  options: string[];
  help?: string;
  placeholder?: string;
  format?: "plain" | "email" | "phone" | "number";
  minLength?: number;
  maxLength?: number;
  minChoices?: number;
  maxChoices?: number;
  exclusiveOption?: string;
  showWhen?: { questionId: string; option: string };
};
export type EntryField = Pick<
  Question,
  | "id"
  | "label"
  | "required"
  | "options"
  | "format"
  | "minLength"
  | "maxLength"
  | "min"
  | "max"
  | "step"
  | "placeholder"
> & { type: "text" | "select" | "number" };
export type EntryAnswer = Record<string, string>;
export type SignupForm = {
  enabled: boolean;
  closed: boolean;
  start: string;
  end: string;
  intro: string;
  questions: Question[];
  pageSize?: number;
  title?: string;
  completionMessage?: string;
  theme?: "purple" | "blue" | "green";
};
export const emptySignup: SignupForm = {
  enabled: false,
  closed: false,
  start: "",
  end: "",
  intro: "",
  questions: [],
};
function fail(message: string): never {
  throw new Error(message);
}
export function normalizeSignup(value: unknown): SignupForm {
  if (value == null) return { ...emptySignup, questions: [] };
  if (typeof value !== "object" || Array.isArray(value))
    fail("报名表格式不正确");
  if (new TextEncoder().encode(JSON.stringify(value)).length > 200000)
    fail("问卷配置最多 200 KB");
  const v = value as Record<string, unknown>;
  const date = (x: unknown) => {
    if (!x) return "";
    if (typeof x !== "string" || !Number.isFinite(Date.parse(x)))
      fail("报名时间无效");
    return new Date(x).toISOString();
  };
  const start = date(v.start),
    end = date(v.end);
  if (start && end && start >= end) fail("报名截止必须晚于开始");
  const intro = String(v.intro || "").trim();
  if (intro.length > 1000) fail("报名说明最多 1000 字");
  if (!Array.isArray(v.questions)) fail("请提供问卷题目列表");
  const ids = new Set<string>();
  const questions = v.questions.map((raw): Question => {
    if (!raw || typeof raw !== "object") fail("题目格式不正确");
    const q = raw as Record<string, unknown>,
      id = String(q.id || ""),
      label = String(q.label || "").trim();
    if (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
      ids.has(id) ||
      Object.hasOwn(Object.prototype, id) ||
      id === "prototype"
    )
      fail("题目标识无效或重复");
    ids.add(id);
    if (!label || label.length > 120) fail("请填写不超过 120 字的题目标题");
    if (
      ![
        "text",
        "textarea",
        "single",
        "multiple",
        "select",
        "number",
        "date",
        "time",
        "rating",
        "nps",
        "ranking",
        "matrix",
        "matrixMultiple",
        "blanks",
        "group",
        "description",
      ].includes(String(q.type))
    )
      fail("题型无效");
    const type = q.type as Question["type"];
    const options =
      [
        "single",
        "multiple",
        "select",
        "ranking",
        "matrix",
        "matrixMultiple",
      ].includes(type) && Array.isArray(q.options)
        ? q.options.map((o) => String(o).trim())
        : [];
    if (
      [
        "single",
        "multiple",
        "select",
        "ranking",
        "matrix",
        "matrixMultiple",
      ].includes(type) &&
      (options.length < 2 ||
        options.length > 50 ||
        options.some((o) => !o || o.length > 120) ||
        new Set(options).size !== options.length)
    )
      fail("选择题需有 2–50 个不同的选项，每项最多 120 字");
    const result: Question = {
      id,
      label,
      type,
      required: q.required === true,
      options,
    };
    for (const key of ["help", "placeholder"] as const) {
      if (q[key] != null && typeof q[key] !== "string")
        fail("填写提示格式无效");
      const text = String(q[key] || "").trim();
      if (text.length > 300) fail("填写提示最多 300 字");
      if (text) result[key] = text;
    }
    const integer = (
      key: "minLength" | "maxLength" | "minChoices" | "maxChoices",
      limit: number,
    ) => {
      if (q[key] == null) return;
      if (
        !Number.isInteger(q[key]) ||
        Number(q[key]) < 1 ||
        Number(q[key]) > limit
      )
        fail(`${label}：限制值应为 1–${limit} 的整数`);
      result[key] = Number(q[key]);
    };
    if (type === "text" || type === "textarea") {
      integer("minLength", type === "textarea" ? 2000 : 200);
      integer("maxLength", type === "textarea" ? 2000 : 200);
      if (
        (result.minLength || 0) >
        (result.maxLength || (type === "textarea" ? 2000 : 200))
      )
        fail(`${label}：最少字数不能超过最多字数`);
      if (
        q.format &&
        !["plain", "email", "phone", "number"].includes(String(q.format))
      )
        fail("文本格式无效");
      if (q.format && q.format !== "plain")
        result.format = q.format as Question["format"];
    }
    if (type === "multiple") {
      integer("minChoices", options.length);
      integer("maxChoices", options.length);
      if ((result.minChoices || 0) > (result.maxChoices || options.length))
        fail(`${label}：最少选择数不能超过最多选择数`);
      if (q.exclusiveOption) {
        if (!options.includes(String(q.exclusiveOption)))
          fail(`${label}：互斥选项必须属于本题`);
        result.exclusiveOption = String(q.exclusiveOption);
      }
    }
    if (q.showWhen != null) {
      const condition = q.showWhen as Record<string, unknown>;
      if (
        !condition ||
        typeof condition !== "object" ||
        typeof condition.questionId !== "string" ||
        typeof condition.option !== "string"
      )
        fail("题目关联格式无效");
      result.showWhen = {
        questionId: condition.questionId,
        option: condition.option,
      };
    }
    normalizeQuestionExtras(q, result);
    return result;
  });
  questions.forEach((q, index) => {
    if (!q.showWhen) return;
    const source = questions
      .slice(0, index)
      .find((previous) => previous.id === q.showWhen!.questionId);
    if (
      !source ||
      !["single", "multiple", "select"].includes(source.type) ||
      !source.options.includes(q.showWhen.option)
    )
      fail(`${q.label}：显示条件必须引用前面的选择题及有效选项`);
  });
  if (
    v.pageSize != null &&
    (!Number.isInteger(v.pageSize) ||
      Number(v.pageSize) < 1 ||
      Number(v.pageSize) > 20)
  )
    fail("每页题数应为 1–20 的整数");
  if (v.enabled === true && !questions.length)
    fail("启用报名时请至少添加一道题");
  return {
    enabled: v.enabled === true,
    closed: v.closed === true,
    start,
    end,
    intro,
    questions,
    ...normalizeFormExtras(v, questions),
    ...(v.pageSize != null ? { pageSize: Number(v.pageSize) } : {}),
  };
}
export function validateAnswers(form: SignupForm, raw: unknown): Answers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    fail("请填写报名信息");
  const source = raw as Record<string, unknown>,
    result: Answers = {};
  if (
    Object.keys(source).some((id) => !form.questions.some((q) => q.id === id))
  )
    fail("报名表已变化，请刷新后重试");
  for (const q of visibleQuestions(form, source)) {
    const value = source[q.id];
    if (q.type === "description") continue;
    if (!["text", "textarea", "single", "multiple"].includes(q.type)) {
      result[q.id] = validateAdvancedAnswer(q, value);
      continue;
    }
    if (q.type === "multiple") {
      if (
        value != null &&
        (!Array.isArray(value) || value.some((v) => typeof v !== "string"))
      )
        fail(q.label + "：请选择有效选项");
      const answer = [...new Set((value || []) as string[])];
      if (
        answer.some((v) => !q.options.includes(v)) ||
        (q.required && !answer.length)
      )
        fail(q.label + "：请选择有效选项");
      if (
        q.exclusiveOption &&
        answer.includes(q.exclusiveOption) &&
        answer.length > 1
      )
        fail(q.label + "：互斥选项不能与其他选项同时选择");
      if (
        answer.length &&
        !(q.exclusiveOption && answer.includes(q.exclusiveOption)) &&
        (answer.length < (q.minChoices || 1) ||
          answer.length > (q.maxChoices || q.options.length))
      )
        fail(
          q.label +
            `：请选择 ${q.minChoices || 1}–${q.maxChoices || q.options.length} 项`,
        );
      result[q.id] = answer;
    } else {
      if (value != null && typeof value !== "string")
        fail(q.label + "：填写格式不正确");
      const answer = String(value || "").trim(),
        max = q.maxLength || (q.type === "textarea" ? 2000 : 200);
      if (
        (q.required && !answer) ||
        answer.length > max ||
        (q.type === "single" && answer && !q.options.includes(answer))
      )
        fail(q.label + "：请检查必填内容、长度或选项");
      if (answer && answer.length < (q.minLength || 0))
        fail(q.label + `：至少填写 ${q.minLength} 字`);
      if (
        answer &&
        q.format === "email" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)
      )
        fail(q.label + "：请输入有效邮箱地址");
      if (answer && q.format === "phone" && !/^1[3-9]\d{9}$/.test(answer))
        fail(q.label + "：请输入 11 位中国大陆手机号");
      if (
        answer &&
        q.format === "number" &&
        (!/^-?\d+(\.\d+)?$/.test(answer) || !Number.isFinite(Number(answer)))
      )
        fail(q.label + "：请输入有效数字");
      result[q.id] = answer;
    }
  }
  if (JSON.stringify(result).length > 100000) fail("报名内容过长");
  return result;
}

export type Answer =
  | string
  | string[]
  | Record<string, string | string[]>
  | EntryAnswer[];
export type Answers = Record<string, Answer>;
// Only preceding, visible answers may activate a branch. Hidden answers never persist.
export function visibleQuestions(
  form: SignupForm,
  answers: Record<string, unknown>,
): Question[] {
  return questionRoute(form, answers).questions;
}

export function answerErrors(
  form: SignupForm,
  answers: Answers,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of visibleQuestions(form, answers)) {
    try {
      validateAnswers(
        {
          ...form,
          questions: [
            { ...q, showWhen: undefined, display: undefined, jumps: undefined },
          ],
        },
        { [q.id]: answers[q.id] },
      );
    } catch (error) {
      errors[q.id] = (error as Error).message;
    }
  }
  return errors;
}
