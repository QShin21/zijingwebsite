import { expect, it } from "vitest";
import { defaultTeamForm, normalizeTeamForm } from "../src/lib/team-core";
import { positiveID } from "../src/lib/team-memberships";

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

it("原问卷结构校验失败保留400语义", () => {
  try {
    normalizeTeamForm({
      ...defaultTeamForm,
      questions: [{ id: "broken", label: "合成无效题", type: "unsupported" }],
    });
    throw new Error("unexpected success");
  } catch (error) {
    expect((error as { status?: number }).status).toBe(400);
  }
});

it("ID只接受PostgreSQL正整数或其HTTP字符串，布尔/数组不能误指向记录1", () => {
  for (const value of [
    true,
    false,
    [1],
    null,
    0,
    -1,
    "1.2",
    "1e2",
    2147483648,
    "2147483648",
  ])
    expect(positiveID(value)).toBeNull();
  expect(positiveID(1)).toBe(1);
  expect(positiveID("1")).toBe(1);
  expect(positiveID({ id: 1 })).toBe(1);
});
