export type Question = {
  id: string;
  label: string;
  type: "text" | "textarea" | "single" | "multiple";
  required: boolean;
  options: string[];
};
export type SignupForm = {
  enabled: boolean;
  closed: boolean;
  start: string;
  end: string;
  intro: string;
  questions: Question[];
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
  if (!Array.isArray(v.questions) || v.questions.length > 20)
    fail("报名表最多 20 道题");
  const ids = new Set<string>();
  const questions = v.questions.map((raw): Question => {
    if (!raw || typeof raw !== "object") fail("题目格式不正确");
    const q = raw as Record<string, unknown>,
      id = String(q.id || ""),
      label = String(q.label || "").trim();
    if (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
      ids.has(id) ||
      ["__proto__", "constructor", "prototype"].includes(id)
    )
      fail("题目标识无效或重复");
    ids.add(id);
    if (!label || label.length > 120) fail("请填写不超过 120 字的题目标题");
    if (!["text", "textarea", "single", "multiple"].includes(String(q.type)))
      fail("题型无效");
    const type = q.type as Question["type"];
    const options =
      ["single", "multiple"].includes(type) && Array.isArray(q.options)
        ? q.options.map((o) => String(o).trim())
        : [];
    if (
      ["single", "multiple"].includes(type) &&
      (options.length < 2 ||
        options.length > 20 ||
        options.some((o) => !o || o.length > 120) ||
        new Set(options).size !== options.length)
    )
      fail("选择题需有 2–20 个不同的选项，每项最多 120 字");
    return { id, label, type, required: q.required === true, options };
  });
  if (v.enabled === true && !questions.length)
    fail("启用报名时请至少添加一道题");
  return {
    enabled: v.enabled === true,
    closed: v.closed === true,
    start,
    end,
    intro,
    questions,
  };
}
export function validateAnswers(
  form: SignupForm,
  raw: unknown,
): Record<string, string | string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    fail("请填写报名信息");
  const source = raw as Record<string, unknown>,
    result: Record<string, string | string[]> = {};
  if (
    Object.keys(source).some((id) => !form.questions.some((q) => q.id === id))
  )
    fail("报名表已变化，请刷新后重试");
  for (const q of form.questions) {
    const value = source[q.id];
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
      result[q.id] = answer;
    } else {
      if (value != null && typeof value !== "string")
        fail(q.label + "：填写格式不正确");
      const answer = String(value || "").trim(),
        max = q.type === "textarea" ? 2000 : 200;
      if (
        (q.required && !answer) ||
        answer.length > max ||
        (q.type === "single" && answer && !q.options.includes(answer))
      )
        fail(q.label + "：请检查必填内容、长度或选项");
      result[q.id] = answer;
    }
  }
  if (JSON.stringify(result).length > 20000) fail("报名内容过长");
  return result;
}
