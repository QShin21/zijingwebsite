"use client";
import type { Question } from "@/lib/signup-schema";
import { hasOptions, hasRows } from "@/lib/questionnaire-model";
export function QuestionnaireSettings({
  q,
  previous,
  onChange,
}: {
  q: Question;
  previous: Question[];
  onChange: (value: Partial<Question>) => void;
}) {
  const sources = previous.filter(
    (v) =>
      !["description", "matrix", "matrixMultiple", "blanks"].includes(v.type),
  );
  return (
    <div className="questionnaire-settings">
      {hasRows(q.type) && (
        <label>
          子题（每行一个）
          <textarea
            value={(q.rows || []).join("\n")}
            onChange={(e) => onChange({ rows: e.target.value.split("\n") })}
          />
        </label>
      )}
      {["number", "rating"].includes(q.type) && (
        <div className="signup-times">
          {(["min", "max", "step"] as const)
            .filter((key) => key !== "step" || q.type === "number")
            .map((key) => (
              <label key={key}>
                {{ min: "最小值", max: "最大值", step: "步长" }[key]}
                <input
                  type="number"
                  step="any"
                  value={q[key] ?? ""}
                  onChange={(e) =>
                    onChange({
                      [key]: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </label>
            ))}
        </div>
      )}
      <label className="signup-choice">
        <input
          type="checkbox"
          checked={Boolean(q.pageBreak)}
          onChange={(e) => onChange({ pageBreak: e.target.checked })}
        />
        从新的一页开始
      </label>
      {hasOptions(q.type) && q.type !== "ranking" && (
        <label className="signup-choice">
          <input
            type="checkbox"
            checked={Boolean(q.randomize)}
            onChange={(e) => onChange({ randomize: e.target.checked })}
          />
          随机排列选项
        </label>
      )}
      <details>
        <summary>复合显示条件</summary>
        <p>仅引用前面的题目；未作答不满足“不等于”，前置题隐藏时条件不成立。</p>
        {q.display && (
          <>
            <label>
              条件关系
              <select
                value={q.display.mode}
                onChange={(e) =>
                  onChange({
                    display: {
                      ...q.display!,
                      mode: e.target.value as "all" | "any",
                    },
                  })
                }
              >
                <option value="all">全部满足（且）</option>
                <option value="any">任一满足（或）</option>
              </select>
            </label>
            {q.display.rules.map((rule, i) => {
              const patch = (value: Partial<typeof rule>) =>
                onChange({
                  display: {
                    ...q.display!,
                    rules: q.display!.rules.map((r, n) =>
                      n === i ? { ...r, ...value } : r,
                    ),
                  },
                });
              return (
                <div className="questionnaire-rule" key={i}>
                  <label>
                    条件题目
                    <select
                      value={rule.questionId}
                      onChange={(e) =>
                        patch({ questionId: e.target.value, value: "" })
                      }
                    >
                      {sources.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label || "未命名题目"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    判断方式
                    <select
                      value={rule.operator}
                      onChange={(e) =>
                        patch({
                          operator: e.target.value as typeof rule.operator,
                        })
                      }
                    >
                      <option value="equals">等于／包含</option>
                      <option value="notEquals">不等于／不包含</option>
                      <option value="answered">已作答</option>
                      <option value="notAnswered">未作答</option>
                    </select>
                  </label>
                  {["equals", "notEquals"].includes(rule.operator) && (
                    <label>
                      条件值
                      <input
                        value={rule.value}
                        maxLength={200}
                        onChange={(e) => patch({ value: e.target.value })}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const rules = q.display!.rules.filter((_, n) => n !== i);
                      onChange({
                        display: rules.length
                          ? { ...q.display!, rules }
                          : undefined,
                      });
                    }}
                  >
                    删除规则
                  </button>
                </div>
              );
            })}
          </>
        )}
        <button
          type="button"
          disabled={!sources.length || (q.display?.rules.length || 0) >= 10}
          onClick={() =>
            onChange({
              showWhen: undefined,
              display: {
                mode: q.display?.mode || "all",
                rules: [
                  ...(q.display?.rules || []),
                  {
                    questionId: sources[0].id,
                    operator: "answered",
                    value: "",
                  },
                ],
              },
            })
          }
        >
          添加条件规则
        </button>
      </details>
    </div>
  );
}
