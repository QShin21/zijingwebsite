import { expect, it } from "vitest";
import {
  emptySignup,
  normalizeSignup,
  validateAnswers,
  visibleQuestions,
  type EntryAnswer,
  type Question,
} from "../src/lib/signup-schema";
import { formatAnswer, sanitizeDraft } from "../src/lib/questionnaire-model";
import {
  responseCSV,
  summarizeResponses,
} from "../src/lib/questionnaire-results";
const group: Question = {
  id: "team",
  label: "成员名单",
  type: "group",
  required: true,
  options: [],
  minEntries: 5,
  maxEntries: 6,
  fields: [
    { id: "name", label: "姓名", type: "text", required: true, options: [] },
    { id: "student", label: "学号", type: "text", required: true, options: [] },
    { id: "game", label: "游戏ID", type: "text", required: true, options: [] },
    {
      id: "position",
      label: "擅长位置",
      type: "select",
      required: true,
      options: ["上单", "打野", "中单", "下路", "辅助"],
    },
  ],
  display: {
    mode: "all",
    rules: [{ questionId: "mode", operator: "equals", value: "团队报名" }],
  },
};
const form = normalizeSignup({
  ...emptySignup,
  enabled: true,
  questions: [
    {
      id: "mode",
      label: "报名方式",
      type: "single",
      required: true,
      options: ["个人报名", "团队报名"],
    },
    group,
  ],
});
const members = (n: number): EntryAnswer[] =>
  Array.from({ length: n }, (_, i) => ({
    name: "演示成员" + (i + 1),
    student: "0000" + (i + 1),
    game: "演示ID" + (i + 1),
    position: "辅助",
  }));
it("enforces 5–6 complete members, rejecting 4, 7, empty optional additions and forged fields", () => {
  for (const count of [5, 6])
    expect(
      validateAnswers(form, { mode: "团队报名", team: members(count) }).team,
    ).toHaveLength(count);
  for (const team of [
    members(4),
    members(7),
    [...members(5), {}],
    members(5).map((v, i) => (i ? v : { ...v, student: "" })),
    members(5).map((v, i) => (i ? v : { ...v, position: "无效选项" })),
    members(5).map((v, i) => (i ? v : { ...v, extra: "伪造字段" })),
    ["bad"],
  ])
    expect(() => validateAnswers(form, { mode: "团队报名", team })).toThrow();
});
it("filters the roster from personal registration, including forged hidden answers", () => {
  expect(
    visibleQuestions(form, { mode: "个人报名", team: members(7) }).map(
      (q) => q.id,
    ),
  ).toEqual(["mode"]);
  expect(validateAnswers(form, { mode: "个人报名", team: members(7) })).toEqual(
    { mode: "个人报名" },
  );
});
it("validates each field even when the information group itself is optional", () => {
  const optional = normalizeSignup({
    ...emptySignup,
    enabled: true,
    questions: [{ ...group, display: undefined, required: false }],
  });
  expect(validateAnswers(optional, {})).toEqual({ team: [] });
  expect(() =>
    validateAnswers(optional, { team: [{ name: "演示成员" }] }),
  ).toThrow();
});
it("rejects invalid bounds, nested groups, duplicate ids and group-sourced logic", () => {
  for (const patch of [
    { minEntries: 7 },
    { maxEntries: 21 },
    { fields: [{ ...group.fields![0], type: "group", fields: group.fields }] },
    { fields: [group.fields![0], group.fields![0]] },
  ])
    expect(() =>
      normalizeSignup({
        ...form,
        questions: [form.questions[0], { ...group, ...patch }],
      }),
    ).toThrow();
  expect(() =>
    normalizeSignup({
      ...form,
      questions: [
        ...form.questions,
        {
          id: "later",
          label: "后续",
          type: "text",
          options: [],
          required: false,
          display: {
            mode: "all",
            rules: [{ questionId: "team", operator: "answered", value: "" }],
          },
        },
      ],
    }),
  ).toThrow();
});
it("restores bounded group drafts, renders all fields and exports complete member records safely", () => {
  const saved = sanitizeDraft(form, { team: [...members(7), null, "bad"] });
  expect(saved.team).toHaveLength(6);
  const answers = validateAnswers(form, { mode: "团队报名", team: members(5) });
  const record = {
    id: 1,
    createdAt: "2026-10-11T00:00:00Z",
    formVersion: "demo",
    questions: form.questions,
    answers,
  };
  expect(formatAnswer(answers.team, form.questions[1])).toContain(
    "第 5 条：姓名：演示成员5",
  );
  const csv = responseCSV([record]);
  expect(csv).toContain("学号：00005");
  expect(csv).not.toContain("[object Object]");
  const summary = summarizeResponses([record])[0].questions.find(
    (q) => q.id === "team",
  );
  expect(summary?.answered).toBe(1);
  expect(summary?.counts).toEqual([
    { label: "5 条记录", count: 1, percent: 100 },
  ]);
});
