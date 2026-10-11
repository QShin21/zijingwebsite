"use client";
import type { Question } from "@/lib/signup-schema";
import {
  conditionLabels,
  endTarget,
  type ConditionGroup,
} from "@/lib/questionnaire-flow";
import { questionTypes } from "@/lib/questionnaire-model";

export function ConditionEditor({
  value,
  sources,
  onChange,
}: {
  value: ConditionGroup;
  sources: Question[];
  onChange: (value: ConditionGroup | undefined) => void;
}) {
  const eligible = sources.filter(
    (q) =>
      !["description", "matrix", "matrixMultiple", "blanks"].includes(q.type),
  );
  return (
    <div className="condition-editor">
      <label>
        条件关系
        <select
          value={value.mode}
          onChange={(e) =>
            onChange({ ...value, mode: e.target.value as "all" | "any" })
          }
        >
          <option value="all">全部满足（且）</option>
          <option value="any">任一满足（或）</option>
        </select>
      </label>
      {value.rules.map((rule, i) => {
        const source = eligible.find((q) => q.id === rule.questionId);
        const patch = (change: Partial<typeof rule>) =>
          onChange({
            ...value,
            rules: value.rules.map((r, n) =>
              n === i ? { ...r, ...change } : r,
            ),
          });
        const numeric =
          source && ["number", "rating", "nps"].includes(source.type);
        return (
          <div className="condition-row" key={i}>
            <label>
              条件题目
              <select
                value={rule.questionId}
                onChange={(e) =>
                  patch({
                    questionId: e.target.value,
                    operator: "answered",
                    value: "",
                  })
                }
              >
                {eligible.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label || "未命名题目"}
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
                    value: "",
                  })
                }
              >
                {Object.entries(conditionLabels)
                  .filter(
                    ([key]) =>
                      numeric || !["gt", "gte", "lt", "lte"].includes(key),
                  )
                  .map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            {!["answered", "notAnswered"].includes(rule.operator) && (
              <label>
                条件值
                {source?.options.length ? (
                  <select
                    value={rule.value}
                    onChange={(e) => patch({ value: e.target.value })}
                  >
                    <option value="">请选择选项</option>
                    {source.options.map((option, n) => (
                      <option key={n} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={rule.value}
                    maxLength={200}
                    inputMode={numeric ? "decimal" : "text"}
                    onChange={(e) => patch({ value: e.target.value })}
                  />
                )}
              </label>
            )}
            <button
              type="button"
              aria-label={`删除条件 ${i + 1}`}
              onClick={() => {
                const rules = value.rules.filter((_, n) => n !== i);
                onChange(rules.length ? { ...value, rules } : undefined);
              }}
            >
              删除条件
            </button>
          </div>
        );
      })}
      <button
        type="button"
        disabled={!eligible.length || value.rules.length >= 10}
        onClick={() =>
          onChange({
            ...value,
            rules: [
              ...value.rules,
              { questionId: eligible[0].id, operator: "answered", value: "" },
            ],
          })
        }
      >
        添加条件
      </button>
    </div>
  );
}
export function QuestionnaireLogic({
  q,
  previous,
  following,
  onChange,
}: {
  q: Question;
  previous: Question[];
  following: Question[];
  onChange: (value: Partial<Question>) => void;
}) {
  const sources = [...previous, q].filter(
    (p) =>
      !["description", "matrix", "matrixMultiple", "blanks"].includes(p.type),
  );
  const display =
    q.display ||
    (q.showWhen
      ? {
          mode: "all" as const,
          rules: [
            {
              questionId: q.showWhen.questionId,
              operator: "equals" as const,
              value: q.showWhen.option,
            },
          ],
        }
      : undefined);
  return (
    <div className="question-logic">
      <details className="questionnaire-settings">
        <summary>
          显示条件
          {display ? ` · ${display.rules.length} 个条件` : " · 始终显示"}
        </summary>
        <p>引用前置题决定本题是否显示。前置题被隐藏或跳过时，条件不成立。</p>
        {display && (
          <ConditionEditor
            value={display}
            sources={previous}
            onChange={(v) => onChange({ display: v, showWhen: undefined })}
          />
        )}
        {!display && (
          <button
            type="button"
            disabled={
              !previous.some(
                (p) =>
                  ![
                    "description",
                    "matrix",
                    "matrixMultiple",
                    "blanks",
                  ].includes(p.type),
              )
            }
            onClick={() =>
              onChange({
                showWhen: undefined,
                display: {
                  mode: "all",
                  rules: [
                    {
                      questionId: previous.find(
                        (p) =>
                          ![
                            "description",
                            "matrix",
                            "matrixMultiple",
                            "blanks",
                          ].includes(p.type),
                      )!.id,
                      operator: "answered",
                      value: "",
                    },
                  ],
                },
              })
            }
          >
            设置显示条件
          </button>
        )}
      </details>
      <details className="questionnaire-settings">
        <summary>
          条件跳转
          {q.jumps?.length ? ` · ${q.jumps.length} 个分支` : " · 顺序填写"}
        </summary>
        <p>
          完成本题后按从上到下的顺序判断，执行第一条匹配的分支。可跳到后续题或提前结束；未匹配时继续下一题。
        </p>
        {q.jumps?.map((jump, i) => {
          const patch = (change: Partial<typeof jump>) =>
            onChange({
              jumps: q.jumps!.map((j, n) =>
                i === n ? { ...j, ...change } : j,
              ),
            });
          return (
            <fieldset className="jump-rule" key={i}>
              <legend>
                分支 {i + 1}
                {!jump.when ? " · 默认分支" : ""}
              </legend>
              {jump.when && (
                <ConditionEditor
                  value={jump.when}
                  sources={sources}
                  onChange={(when) => {
                    if (when) patch({ when });
                    else
                      onChange({
                        jumps: q.jumps!.filter((_, n) => n !== i).length
                          ? q.jumps!.filter((_, n) => n !== i)
                          : undefined,
                      });
                  }}
                />
              )}
              {!jump.when && <p>其他分支均未匹配时执行此跳转。</p>}
              <label>
                跳转到
                <select
                  value={jump.target}
                  onChange={(e) => patch({ target: e.target.value })}
                >
                  <option value={endTarget}>结束问卷并核对提交</option>
                  {following.map((next, n) => (
                    <option key={next.id} value={next.id}>
                      第 {previous.length + n + 2} 题 ·{" "}
                      {next.label || questionTypes[next.type]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="signup-tools">
                {jump.when && (
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      const jumps = [...q.jumps!];
                      [jumps[i - 1], jumps[i]] = [jumps[i], jumps[i - 1]];
                      onChange({ jumps });
                    }}
                  >
                    提高分支优先级
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const jumps = q.jumps!.filter((_, n) => n !== i);
                    onChange({ jumps: jumps.length ? jumps : undefined });
                  }}
                >
                  删除分支
                </button>
              </div>
            </fieldset>
          );
        })}
        <div className="signup-tools">
          <button
            type="button"
            disabled={!sources.length || (q.jumps?.length || 0) >= 10}
            onClick={() => {
              const jumps = [...(q.jumps || [])];
              const index = jumps.findIndex((j) => !j.when);
              jumps.splice(index < 0 ? jumps.length : index, 0, {
                when: {
                  mode: "all",
                  rules: [
                    {
                      questionId: sources.at(-1)!.id,
                      operator: "answered",
                      value: "",
                    },
                  ],
                },
                target: following[0]?.id || endTarget,
              });
              onChange({ jumps });
            }}
          >
            添加条件分支
          </button>
          <button
            type="button"
            disabled={
              (q.jumps?.length || 0) >= 10 ||
              Boolean(q.jumps?.some((j) => !j.when))
            }
            onClick={() =>
              onChange({
                jumps: [
                  ...(q.jumps || []),
                  { target: following[0]?.id || endTarget },
                ],
              })
            }
          >
            添加默认分支
          </button>
        </div>
        <small>
          有跳转的题目会独立结束当前填写页；提前结束仍需核对并提交。
        </small>
      </details>
    </div>
  );
}
