import { expect, it } from "vitest";
import {
  answerErrors,
  emptySignup,
  normalizeSignup,
  validateAnswers,
  visibleQuestions,
  type Question,
} from "../src/lib/signup-schema";
const choice: Question = {
  id: "kind",
  label: "参与方式",
  type: "single",
  required: true,
  options: ["参赛", "观赛"],
};
const branch: Question = {
  id: "contact",
  label: "邮箱",
  type: "text",
  required: true,
  options: [],
  format: "email",
  showWhen: { questionId: "kind", option: "参赛" },
};
const form = (questions: Question[]) =>
  normalizeSignup({ ...emptySignup, enabled: true, questions });
it("keeps old form normalization and version input unchanged", () => {
  const legacy = { ...emptySignup, enabled: true, questions: [choice] };
  expect(normalizeSignup(legacy)).toEqual(legacy);
});
it("normalizes advanced settings idempotently", () => {
  const value = form([
    choice,
    { ...branch, help: " 联系方式 ", minLength: 3, maxLength: 80 },
  ]);
  expect(normalizeSignup(value)).toEqual(value);
});
it("validates visible required branches and discards forged hidden answers", () => {
  const value = form([choice, branch]);
  expect(
    validateAnswers(value, { kind: "观赛", contact: ["malformed"] }),
  ).toEqual({ kind: "观赛" });
  expect(() => validateAnswers(value, { kind: "参赛" })).toThrow("邮箱");
  expect(answerErrors(value, { kind: "参赛", contact: "bad" })).toEqual({
    contact: "邮箱：请输入有效邮箱地址",
  });
});
it("does not activate nested branches through hidden parent answers", () => {
  const parent = {
    ...choice,
    id: "parent",
    showWhen: { questionId: "kind", option: "参赛" },
  };
  const value = form([
    choice,
    parent,
    { ...branch, showWhen: { questionId: "parent", option: "参赛" } },
  ]);
  expect(
    visibleQuestions(value, { kind: "观赛", parent: "参赛" }).map((q) => q.id),
  ).toEqual(["kind"]);
});
it.each([
  { questionId: "later", option: "参赛" },
  { questionId: "contact", option: "参赛" },
  { questionId: "kind", option: "无效" },
])(
  "rejects missing, forward, self and invalid option references: %j",
  (showWhen) => {
    expect(() => form([choice, { ...branch, showWhen }])).toThrow("显示条件");
  },
);
it("rejects references to text questions", () => {
  expect(() => form([{ ...choice, type: "text" }, branch])).toThrow("显示条件");
});
it.each([
  ["email", "a@example.com", "a@bad"],
  ["phone", "13800138000", "123"],
  ["number", "-1.5", "Infinity"],
  ["number", "0", "1e2"],
])("checks %s on the server", (format, good, bad) => {
  const value = form([
    { ...branch, showWhen: undefined, format: format as Question["format"] },
  ]);
  expect(validateAnswers(value, { contact: good })).toEqual({ contact: good });
  expect(() => validateAnswers(value, { contact: bad })).toThrow();
});
it("enforces length while allowing empty optional responses", () => {
  const value = form([
    {
      ...branch,
      showWhen: undefined,
      format: "plain",
      required: false,
      minLength: 3,
      maxLength: 5,
    },
  ]);
  expect(validateAnswers(value, { contact: "" })).toEqual({ contact: "" });
  expect(() => validateAnswers(value, { contact: "ab" })).toThrow();
  expect(() => validateAnswers(value, { contact: "abcdef" })).toThrow();
});
it("enforces deduplicated multi-select counts and exclusive choice", () => {
  const value = form([
    {
      ...choice,
      type: "multiple",
      options: ["A", "B", "C", "无"],
      minChoices: 2,
      maxChoices: 2,
      exclusiveOption: "无",
    },
  ]);
  expect(validateAnswers(value, { kind: ["A", "B", "A"] })).toEqual({
    kind: ["A", "B"],
  });
  expect(validateAnswers(value, { kind: ["无"] })).toEqual({ kind: ["无"] });
  for (const answer of [[], ["A"], ["A", "B", "C"], ["无", "A"], ["伪造"]])
    expect(() => validateAnswers(value, { kind: answer })).toThrow();
});
it.each([
  { minLength: -1 },
  { minLength: 6, maxLength: 5 },
  { maxLength: 201 },
  { minLength: 1.5 },
])("rejects invalid text constraints %j", (limits) => {
  expect(() => form([{ ...branch, showWhen: undefined, ...limits }])).toThrow();
});
it.each([
  { minChoices: 3 },
  { minChoices: 2, maxChoices: 1 },
  { exclusiveOption: "missing" },
])("rejects impossible choice constraints %j", (limits) => {
  expect(() => form([{ ...choice, type: "multiple", ...limits }])).toThrow();
});
it("rejects invalid pagination and unknown answer IDs", () => {
  expect(() => normalizeSignup({ ...form([choice]), pageSize: 0 })).toThrow();
  expect(() =>
    validateAnswers(form([choice]), { kind: "观赛", unknown: "x" }),
  ).toThrow("已变化");
});
