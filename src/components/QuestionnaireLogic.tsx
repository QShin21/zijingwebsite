"use client";
import type { Question } from "@/lib/signup-schema";
import {
  conditionLabels,
  endTarget,
  type ConditionGroup,
} from "@/lib/questionnaire-flow";
import { useLocale, useT } from "./i18n/LocaleProvider";
import { conditionLabel, questionTypeLabel } from "@/lib/i18n/labels-manage";

export function ConditionEditor({
  value,
  sources,
  onChange,
}: {
  value: ConditionGroup;
  sources: Question[];
  onChange: (value: ConditionGroup | undefined) => void;
}) {
  const t = useT(),
    locale = useLocale();
  const eligible = sources.filter(
    (q) =>
      !["description", "matrix", "matrixMultiple", "blanks", "group"].includes(
        q.type,
      ),
  );
  return (
    <div className="condition-editor">
      <label>
        {t("条件关系", "Condition logic")}
        <select
          value={value.mode}
          onChange={(e) =>
            onChange({ ...value, mode: e.target.value as "all" | "any" })
          }
        >
          <option value="all">{t("全部满足（且）", "Match all (AND)")}</option>
          <option value="any">{t("任一满足（或）", "Match any (OR)")}</option>
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
              {t("条件题目", "Question")}
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
                    {q.label || t("未命名题目", "Untitled question")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("判断方式", "Operator")}
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
                  .map(([key]) => (
                    <option value={key} key={key}>
                      {conditionLabel(key as keyof typeof conditionLabels, locale)}
                    </option>
                  ))}
              </select>
            </label>
            {!["answered", "notAnswered"].includes(rule.operator) && (
              <label>
                {t("条件值", "Value")}
                {source?.options.length ? (
                  <select
                    value={rule.value}
                    onChange={(e) => patch({ value: e.target.value })}
                  >
                    <option value="">{t("请选择选项", "Select an option")}</option>
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
              aria-label={t(`删除条件 ${i + 1}`, `Delete condition ${i + 1}`)}
              onClick={() => {
                const rules = value.rules.filter((_, n) => n !== i);
                onChange(rules.length ? { ...value, rules } : undefined);
              }}
            >
              {t("删除条件", "Delete condition")}
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
        {t("添加条件", "Add condition")}
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
  const t = useT(),
    locale = useLocale();
  const sources = [...previous, q].filter(
    (p) =>
      !["description", "matrix", "matrixMultiple", "blanks", "group"].includes(
        p.type,
      ),
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
          {t("显示条件", "Display condition")}
          {display
            ? t(` · ${display.rules.length} 个条件`, ` · ${display.rules.length} condition${display.rules.length === 1 ? "" : "s"}`)
            : t(" · 始终显示", " · always shown")}
        </summary>
        <p>{t("引用前置题决定本题是否显示。前置题被隐藏或跳过时，条件不成立。", "Earlier answers decide whether this question is shown. If the earlier question is hidden or skipped, the condition is not met.")}</p>
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
                    "group",
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
                            "group",
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
            {t("设置显示条件", "Set display condition")}
          </button>
        )}
      </details>
      <details className="questionnaire-settings">
        <summary>
          {t("条件跳转", "Conditional jumps")}
          {q.jumps?.length
            ? t(` · ${q.jumps.length} 个分支`, ` · ${q.jumps.length} branch${q.jumps.length === 1 ? "" : "es"}`)
            : t(" · 顺序填写", " · in order")}
        </summary>
        <p>
          {t("完成本题后按从上到下的顺序判断，执行第一条匹配的分支。可跳到后续题或提前结束；未匹配时继续下一题。", "After this question, branches are checked top to bottom and the first match runs. A branch can jump ahead or end early; with no match, the next question follows.")}
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
                {t(`分支 ${i + 1}`, `Branch ${i + 1}`)}
                {!jump.when ? t(" · 默认分支", " · default branch") : ""}
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
              {!jump.when && <p>{t("其他分支均未匹配时执行此跳转。", "Runs when no other branch matches.")}</p>}
              <label>
                {t("跳转到", "Jump to")}
                <select
                  value={jump.target}
                  onChange={(e) => patch({ target: e.target.value })}
                >
                  <option value={endTarget}>{t("结束问卷并核对提交", "End and review before submitting")}</option>
                  {following.map((next, n) => (
                    <option key={next.id} value={next.id}>
                      {t(`第 ${previous.length + n + 2} 题 · `, `Q${previous.length + n + 2} · `)}
                      {next.label || questionTypeLabel(next.type, locale)}
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
                    {t("提高分支优先级", "Move branch up")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const jumps = q.jumps!.filter((_, n) => n !== i);
                    onChange({ jumps: jumps.length ? jumps : undefined });
                  }}
                >
                  {t("删除分支", "Delete branch")}
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
            {t("添加条件分支", "Add conditional branch")}
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
            {t("添加默认分支", "Add default branch")}
          </button>
        </div>
        <small>
          {t("有跳转的题目会独立结束当前填写页；提前结束仍需核对并提交。", "A question with jumps ends the current page; ending early still requires review and submission.")}
        </small>
      </details>
    </div>
  );
}
