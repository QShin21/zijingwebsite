import { expect, it } from "vitest";
import {
  emptySignup,
  normalizeSignup,
  validateAnswers,
  visibleQuestions,
  type Question,
} from "../src/lib/signup-schema";
import {
  formatAnswer,
  questionPages,
  randomizedOptions,
  sanitizeDraft,
} from "../src/lib/questionnaire-model";
import {
  parseQuestionText,
  templateForm,
} from "../src/lib/questionnaire-import";
import {
  csvCell,
  responseCSV,
  summarizeResponses,
} from "../src/lib/questionnaire-results";
const q = (
  type: Question["type"],
  extra: Partial<Question> = {},
): Question => ({
  id: "q",
  label: "测试题",
  type,
  required: true,
  options: [],
  ...extra,
});
const form = (questions: Question[]) =>
  normalizeSignup({ ...emptySignup, enabled: true, questions });
it.each([
  ["select", { options: ["A", "B"] }, "B", "C"],
  ["number", { min: -1, max: 2, step: 0.5 }, "1.5", "1.2"],
  ["date", {}, "2024-02-29", "2025-02-29"],
  ["time", {}, "23:59", "24:00"],
  ["rating", {}, "5", "0"],
  ["nps", {}, "0", "11"],
  ["ranking", { options: ["A", "B"] }, ["B", "A"], ["A", "A"]],
  [
    "matrix",
    { options: ["A", "B"], rows: ["row1", "row2"] },
    { row1: "A", row2: "B" },
    { row1: "A" },
  ],
  [
    "matrixMultiple",
    { options: ["A", "B"], rows: ["row1"] },
    { row1: ["A", "B"] },
    { row1: ["C"] },
  ],
  ["blanks", { rows: ["row1"] }, { row1: "hello" }, { row1: [] }],
] as const)(
  "validates %s and rejects forged answers",
  (type, extra, good, bad) => {
    const value = form([q(type, JSON.parse(JSON.stringify(extra)))]);
    expect(validateAnswers(value, { q: good })).toEqual({ q: good });
    expect(() => validateAnswers(value, { q: bad })).toThrow();
  },
);
it.each([
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
] as const)("optional %s permits an empty answer", (type) => {
  const value = form([
    q(type, { required: false, options: ["A", "B"], rows: ["row"] }),
  ]);
  expect(() => validateAnswers(value, {})).not.toThrow();
});
it("preserves version inputs of older forms", () => {
  const old = { ...emptySignup, enabled: true, questions: [q("text")] };
  expect(normalizeSignup(old)).toEqual(old);
});
it("validates compound conditions, empty notEquals and hidden parent semantics", () => {
  const value = form([
    q("single", { id: "a", options: ["A", "B"] }),
    q("text", { id: "b", required: false }),
    q("text", {
      id: "c",
      display: {
        mode: "all",
        rules: [
          { questionId: "a", operator: "equals", value: "A" },
          { questionId: "b", operator: "notEquals", value: "x" },
        ],
      },
    }),
  ]);
  expect(visibleQuestions(value, { a: "A" }).map((v) => v.id)).toEqual([
    "a",
    "b",
  ]);
  expect(visibleQuestions(value, { a: "A", b: "y" }).map((v) => v.id)).toEqual([
    "a",
    "b",
    "c",
  ]);
  expect(validateAnswers(value, { a: "B", b: "y", c: "forged" })).toEqual({
    a: "B",
    b: "y",
  });
  expect(() =>
    form([
      q("text", {
        display: {
          mode: "any",
          rules: [{ questionId: "q", operator: "answered", value: "" }],
        },
      }),
    ]),
  ).toThrow();
});
it("splits manual pages without counting description blocks as questions", () => {
  const pages = questionPages(
    [
      q("description", { id: "intro" }),
      q("text", { id: "a" }),
      q("text", { id: "b", pageBreak: true }),
      q("text", { id: "c" }),
    ],
    2,
  );
  expect(pages.map((page) => page.map((v) => v.id))).toEqual([
    ["intro", "a"],
    ["b", "c"],
  ]);
});
it("imports templates and rejects malformed text or impossible constraints", () => {
  for (const name of ["signup", "feedback", "preference"])
    expect(
      normalizeSignup(templateForm(name)).questions.length,
    ).toBeGreaterThan(1);
  expect(parseQuestionText("[单选]称呼*\n- A\n- B")[0].required).toBe(true);
  expect(() => parseQuestionText("[不存在]标题")).toThrow();
  expect(() =>
    form([q("matrix", { rows: ["x", "x"], options: ["A", "B"] })]),
  ).toThrow();
  expect(() => form([q("rating", { min: 5, max: 1 })])).toThrow();
  expect(() => form([q("number", { step: 0 })])).toThrow();
});
it("ignores malicious or stale draft shapes", () => {
  const value = form([
    q("text"),
    q("matrix", { id: "m", rows: ["r"], options: ["A", "B"] }),
  ]);
  expect(
    sanitizeDraft(value, {
      q: { x: 42 },
      m: { r: "A", extra: "x" },
      unknown: "x",
    }),
  ).toEqual({ m: { r: "A" } });
});
it("randomization is stable for a seed and does not mutate canonical options", () => {
  const options = ["A", "B", "C", "D"];
  expect(randomizedOptions(options, "seed")).toEqual(
    randomizedOptions(options, "seed"),
  );
  expect(randomizedOptions(options, "seed").sort()).toEqual(options);
});
it("separates statistics by snapshot version and computes NPS accurately", () => {
  const questions = [q("nps")],
    records = [10, 9, 8, 6].map((n, i) => ({
      id: i,
      createdAt: "2026-10-11",
      formVersion: "v1",
      questions,
      answers: { q: String(n) },
    }));
  const groups = summarizeResponses([
    ...records,
    { ...records[0], formVersion: "v2" },
  ]);
  expect(groups).toHaveLength(2);
  expect(groups[0].questions[0]).toMatchObject({
    answered: 4,
    average: 8.25,
    nps: 25,
  });
});
it("exports safe CSV with formulas, quotes and row answers preserved as text", () => {
  expect(csvCell("  =1+1")).toBe('"\'  =1+1"');
  expect(csvCell('a"b')).toBe('"a""b"');
  const csv = responseCSV([
    {
      id: 1,
      createdAt: "2026",
      memberName: "@name",
      questions: [q("blanks", { rows: ["row"] })],
      answers: { q: { row: "a,b\nc" } },
    },
  ]);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(csv).toContain("'@name");
  expect(csv).toContain('"Q1. 测试题 / row"');
  expect(csv).toContain('"a,b\nc"');
  expect(formatAnswer({ row: ["A", "B"] })).toBe("row：A、B");
});

it("rejects inherited object keys as IDs or matrix rows", () => {
  for (const key of ["toString", "hasOwnProperty", "__proto__"]) {
    expect(() => form([q("text", { id: key })])).toThrow();
    expect(() => form([q("blanks", { rows: [key] })])).toThrow();
  }
});
