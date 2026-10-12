import { expect, it } from "vitest";
import { defaultTeamForm, normalizeTeamForm } from "../src/lib/team-core";

it("默认必填核心题可达，核心题不能隐藏或被提前结束跳过", () => {
  expect(normalizeTeamForm(defaultTeamForm).questions).toHaveLength(5);
  expect(() =>
    normalizeTeamForm({
      ...defaultTeamForm,
      questions: defaultTeamForm.questions.slice(1),
    }),
  ).toThrow();
  const filter = {
    id: "filter",
    label: "合成分支",
    type: "single",
    required: true,
    options: ["A", "B"],
    jumps: [{ target: "$end" }],
  };
  expect(() =>
    normalizeTeamForm({
      ...defaultTeamForm,
      questions: [filter, ...defaultTeamForm.questions],
    }),
  ).toThrow("跳转不能跳过");
  expect(() =>
    normalizeTeamForm({
      ...defaultTeamForm,
      questions: [
        {
          ...filter,
          jumps: [
            {
              target: "availability",
              when: {
                mode: "all",
                rules: [
                  { questionId: "filter", operator: "equals", value: "A" },
                ],
              },
            },
          ],
        },
        ...defaultTeamForm.questions,
      ],
    }),
  ).toThrow("跳转不能跳过");
  expect(() =>
    normalizeTeamForm({
      ...defaultTeamForm,
      questions: [
        { ...defaultTeamForm.questions[0], jumps: [{ target: "$end" }] },
        ...defaultTeamForm.questions.slice(1),
      ],
    }),
  ).toThrow("跳转不能跳过");
});
it("核心资料之后的扩展题保留合法条件分支", () => {
  const form = normalizeTeamForm({
    ...defaultTeamForm,
    questions: [
      ...defaultTeamForm.questions,
      {
        id: "extension",
        label: "合成扩展选择",
        type: "single",
        required: true,
        options: ["A", "B"],
        jumps: [
          {
            target: "$end",
            when: {
              mode: "all",
              rules: [
                { questionId: "extension", operator: "equals", value: "A" },
              ],
            },
          },
        ],
      },
      { id: "notes", label: "其他选拔说明", type: "textarea" },
    ],
  });
  expect(form.questions[5].jumps?.[0].target).toBe("$end");
});
