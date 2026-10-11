import type { Question, SignupForm } from "./signup-schema";

export type ConditionRule = {
  questionId: string;
  operator:
    | "equals"
    | "notEquals"
    | "answered"
    | "notAnswered"
    | "gt"
    | "gte"
    | "lt"
    | "lte";
  value: string;
};
export type ConditionGroup = { mode: "all" | "any"; rules: ConditionRule[] };
export type JumpRule = { when?: ConditionGroup; target: string };
export const endTarget = "$end";
export const conditionLabels: Record<ConditionRule["operator"], string> = {
  equals: "等于／包含",
  notEquals: "不等于／不包含",
  answered: "已作答",
  notAnswered: "未作答",
  gt: "大于",
  gte: "大于等于",
  lt: "小于",
  lte: "小于等于",
};

export function normalizeCondition(raw: unknown): ConditionGroup {
  const d = raw as ConditionGroup;
  if (
    !d ||
    !["all", "any"].includes(d.mode) ||
    !Array.isArray(d.rules) ||
    !d.rules.length ||
    d.rules.length > 10
  )
    throw new Error("条件应包含 1–10 条规则，并选择全部或任一满足");
  return {
    mode: d.mode,
    rules: d.rules.map((r) => {
      if (
        !r ||
        typeof r.questionId !== "string" ||
        !Object.hasOwn(conditionLabels, r.operator) ||
        typeof r.value !== "string" ||
        r.value.length > 200
      )
        throw new Error("条件规则无效");
      return { questionId: r.questionId, operator: r.operator, value: r.value };
    }),
  };
}
function validateGroup(
  group: ConditionGroup,
  sources: Question[],
  title: string,
) {
  for (const r of group.rules) {
    const source = sources.find((q) => q.id === r.questionId);
    if (
      !source ||
      ["description", "matrix", "matrixMultiple", "blanks"].includes(
        source.type,
      )
    )
      throw new Error(title + "：条件只能引用当前范围内的非矩阵作答题");
    if (["gt", "gte", "lt", "lte"].includes(r.operator)) {
      if (
        !["number", "rating", "nps"].includes(source.type) ||
        !/^-?\d+(\.\d+)?$/.test(r.value) ||
        !Number.isFinite(Number(r.value))
      )
        throw new Error(title + "：数值比较应引用数字或评分题并填写有效数字");
    } else if (
      ["equals", "notEquals"].includes(r.operator) &&
      (!r.value ||
        (["single", "multiple", "select", "ranking"].includes(source.type) &&
          !source.options.includes(r.value)))
    )
      throw new Error(title + "：条件选项或值无效");
  }
}
export function validateFlow(questions: Question[]) {
  questions.forEach((q, i) => {
    if (q.display) validateGroup(q.display, questions.slice(0, i), q.label);
    q.jumps?.forEach((jump, j) => {
      if (jump.when)
        validateGroup(jump.when, questions.slice(0, i + 1), q.label);
      else if (j !== q.jumps!.length - 1)
        throw new Error(q.label + "：无条件跳转应放在最后");
      if (
        jump.target !== endTarget &&
        !questions.slice(i + 1).some((next) => next.id === jump.target)
      )
        throw new Error(q.label + "：跳转目标应为后续题目或结束问卷");
    });
  });
}
export function matchesCondition(
  group: ConditionGroup | undefined,
  answers: Record<string, unknown>,
  visible: Set<string>,
): boolean {
  if (!group) return true;
  const results = group.rules.map((r) => {
    if (!visible.has(r.questionId)) return false;
    const answer = answers[r.questionId];
    const filled = Array.isArray(answer)
      ? answer.length > 0
      : typeof answer === "string" && answer.trim().length > 0;
    if (r.operator === "answered") return filled;
    if (r.operator === "notAnswered") return !filled;
    if (["gt", "gte", "lt", "lte"].includes(r.operator)) {
      if (
        !filled ||
        typeof answer !== "string" ||
        !/^-?\d+(\.\d+)?$/.test(answer.trim())
      )
        return false;
      const a = Number(answer),
        b = Number(r.value);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return r.operator === "gt"
        ? a > b
        : r.operator === "gte"
          ? a >= b
          : r.operator === "lt"
            ? a < b
            : a <= b;
    }
    const equal = Array.isArray(answer)
      ? answer.includes(r.value)
      : typeof answer === "string" && answer.trim() === r.value;
    return r.operator === "equals" ? equal : filled && !equal;
  });
  return group.mode === "all" ? results.every(Boolean) : results.some(Boolean);
}
export function questionRoute(
  form: SignupForm,
  answers: Record<string, unknown>,
) {
  const questions: Question[] = [],
    visible = new Set<string>();
  const jumps: { from: string; target: string; skipped: number }[] = [];
  for (let i = 0; i < form.questions.length; i++) {
    const q = form.questions[i],
      condition = q.showWhen;
    if (
      condition &&
      !matchesCondition(
        {
          mode: "all",
          rules: [
            {
              questionId: condition.questionId,
              operator: "equals",
              value: condition.option,
            },
          ],
        },
        answers,
        visible,
      )
    )
      continue;
    if (!matchesCondition(q.display, answers, visible)) continue;
    questions.push(q);
    visible.add(q.id);
    const jump = q.jumps?.find((rule) =>
      matchesCondition(rule.when, answers, visible),
    );
    if (!jump) continue;
    if (jump.target === endTarget) {
      jumps.push({
        from: q.id,
        target: endTarget,
        skipped: form.questions.length - i - 1,
      });
      break;
    }
    const next = form.questions.findIndex((p) => p.id === jump.target);
    // Invalid drafts must never loop or accidentally skip validation.
    if (next <= i) continue;
    jumps.push({ from: q.id, target: jump.target, skipped: next - i - 1 });
    i = next - 1;
  }
  return { questions, jumps };
}
