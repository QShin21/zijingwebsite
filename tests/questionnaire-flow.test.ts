import { expect, it } from "vitest";
import {
  emptySignup,
  normalizeSignup,
  validateAnswers,
  answerErrors,
  type Question,
} from "../src/lib/signup-schema";
import { endTarget, questionRoute } from "../src/lib/questionnaire-flow";
import {
  questionnaireTemplates,
  applyBlueprint,
} from "../src/lib/questionnaire-templates";
import { questionPages } from "../src/lib/questionnaire-model";
const q = (id: string, extra: Partial<Question> = {}): Question => ({
  id,
  label: id,
  type: "text",
  required: true,
  options: [],
  ...extra,
});
const form = (questions: Question[]) =>
  normalizeSignup({ ...emptySignup, enabled: true, questions });
const equals = (questionId: string, value: string) => ({
  mode: "all" as const,
  rules: [{ questionId, operator: "equals" as const, value }],
});
it("uses the first matching branch, validates the source and discards skipped answers", () => {
  const f = form([
    q("a", {
      type: "single",
      options: ["A", "B"],
      jumps: [
        { when: equals("a", "A"), target: "c" },
        { when: equals("a", "A"), target: endTarget },
      ],
    }),
    q("b"),
    q("c"),
  ]);
  expect(questionRoute(f, { a: "A" }).questions.map((q) => q.id)).toEqual([
    "a",
    "c",
  ]);
  expect(validateAnswers(f, { a: "A", b: "forged", c: "ok" })).toEqual({
    a: "A",
    c: "ok",
  });
  expect(() => validateAnswers(f, { a: "B", c: "ok" })).toThrow("b");
  expect(() => validateAnswers(f, { a: "FORGED", b: "x", c: "x" })).toThrow();
});
it("early ending does not bypass required answers before or on the source", () => {
  const f = form([
    q("before"),
    q("gate", {
      type: "single",
      options: ["stop", "continue"],
      jumps: [{ when: equals("gate", "stop"), target: endTarget }],
    }),
    q("after"),
  ]);
  expect(
    validateAnswers(f, { before: "ok", gate: "stop", after: "forged" }),
  ).toEqual({ before: "ok", gate: "stop" });
  expect(() => validateAnswers(f, { gate: "stop" })).toThrow("before");
  expect(() => validateAnswers(f, { before: "ok", gate: "continue" })).toThrow(
    "after",
  );
  const unconditional = form([
    q("a", { jumps: [{ target: endTarget }] }),
    q("b"),
  ]);
  expect(answerErrors(unconditional, {})).toHaveProperty("a");
});
it("combines numeric comparison and choices, with fallback and an any group", () => {
  const f = form([
    q("a", { type: "multiple", options: ["A", "B"] }),
    q("n", {
      type: "number",
      jumps: [
        {
          when: {
            mode: "all",
            rules: [
              { questionId: "a", operator: "equals", value: "A" },
              { questionId: "n", operator: "gte", value: "2" },
            ],
          },
          target: "c",
        },
        { target: endTarget },
      ],
    }),
    q("b"),
    q("c"),
  ]);
  expect(
    questionRoute(f, { a: ["A"], n: "2" }).questions.map((q) => q.id),
  ).toEqual(["a", "n", "c"]);
  expect(
    questionRoute(f, { a: ["B"], n: "8" }).questions.map((q) => q.id),
  ).toEqual(["a", "n"]);
  const any = form([
    q("a", {
      type: "number",
      jumps: [
        {
          when: {
            mode: "any",
            rules: [
              { questionId: "a", operator: "lt", value: "0" },
              { questionId: "a", operator: "gt", value: "10" },
            ],
          },
          target: endTarget,
        },
      ],
    }),
    q("b"),
  ]);
  expect(questionRoute(any, { a: "-1" }).questions.length).toBe(1);
  expect(questionRoute(any, { a: "5" }).questions.length).toBe(2);
});
it("hidden or skipped sources cannot trigger branches or display conditions", () => {
  const f = form([
    q("a", {
      type: "single",
      options: ["A", "B"],
      jumps: [{ when: equals("a", "A"), target: "c" }],
    }),
    q("b", { jumps: [{ target: endTarget }] }),
    q("c", { required: false }),
    q("d", { display: equals("b", "forged") }),
  ]);
  expect(
    questionRoute(f, { a: "A", b: "forged" }).questions.map((q) => q.id),
  ).toEqual(["a", "c"]);
});
it.each([
  "self",
  "backwards",
  "missing",
  "future-condition",
  "default-first",
  "text-comparison",
])("rejects invalid flow: %s", (variant) => {
  const jumps =
    variant === "default-first"
      ? [{ target: "b" }, { when: equals("a", "A"), target: endTarget }]
      : [
          {
            when:
              variant === "future-condition"
                ? equals("b", "x")
                : variant === "text-comparison"
                  ? {
                      mode: "all" as const,
                      rules: [
                        {
                          questionId: "a",
                          operator: "gt" as const,
                          value: "1",
                        },
                      ],
                    }
                  : equals("a", "A"),
            target:
              variant === "self" || variant === "backwards"
                ? "a"
                : variant === "missing"
                  ? "missing"
                  : "b",
          },
        ];
  expect(() =>
    form([q("a", { type: "single", options: ["A", "B"], jumps }), q("b")]),
  ).toThrow();
});
it("ends pages at jump sources so skipped required questions are never co-presented", () => {
  const f = form([
    q("a"),
    q("b", { jumps: [{ target: "d" }] }),
    q("c"),
    q("d"),
  ]);
  expect(questionPages(f.questions, 5).map((p) => p.map((q) => q.id))).toEqual([
    ["a", "b"],
    ["c", "d"],
  ]);
});
it("every template is valid; applying remaps all references and preserves operational settings", () => {
  let id = 0;
  for (const template of questionnaireTemplates) {
    const current = {
      ...form([q("existing")]),
      title: "existing title",
      closed: true,
      start: "2026-10-01T00:00:00.000Z",
      end: "2026-11-01T00:00:00.000Z",
    };
    const replacement = applyBlueprint(
      current,
      template.form,
      "replace",
      () => "new_" + ++id,
    );
    expect(replacement.title).toBe(template.form.title);
    expect(replacement.closed).toBe(true);
    expect(replacement.start).toBe(current.start);
    expect(replacement.end).toBe(current.end);
    expect(replacement.questions.every((q) => q.id.startsWith("new_"))).toBe(
      true,
    );
    expect(() => normalizeSignup(replacement)).not.toThrow();
    const append = applyBlueprint(
      current,
      template.form,
      "append",
      () => "new_" + ++id,
    );
    expect(append.title).toBe("existing title");
    expect(append.questions[0].id).toBe("existing");
    expect(() => normalizeSignup(append)).not.toThrow();
  }
});
it("JSON roundtrip preserves compound jump semantics and does not mutate the template", () => {
  const blueprint = questionnaireTemplates.find(
    (t) => t.id === "screening",
  )!.form;
  const before = JSON.stringify(blueprint);
  let id = 0;
  const f = applyBlueprint(
    emptySignup,
    JSON.parse(before),
    "replace",
    () => "q_" + ++id,
  );
  expect(
    questionRoute(f, {
      [f.questions[0].id]: "愿意",
      [f.questions[1].id]: "0.5",
    }).questions.map((q) => q.label),
  ).toEqual([
    "你是否愿意参加此次活动？",
    "本次最多可以参与几小时？",
    "你希望参与的短时环节",
    "其他说明",
  ]);
  expect(JSON.stringify(blueprint)).toBe(before);
});
