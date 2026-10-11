"use client";
import type { Question } from "@/lib/signup-schema";
import { hasOptions, hasRows, questionTypes } from "@/lib/questionnaire-model";
import { QuestionnaireSettings } from "./QuestionnaireSettings";
import { QuestionnaireLogic } from "./QuestionnaireLogic";
export function newQuestion(type: Question["type"]): Question {
  return {
    id: crypto.randomUUID(),
    label: type === "description" ? "补充说明" : "新题目",
    type,
    required: type !== "description",
    options: hasOptions(type) ? ["选项一", "选项二"] : [],
    ...(hasRows(type) ? { rows: ["项目一", "项目二"] } : {}),
  };
}
export function QuestionnaireQuestionEditor({
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
  return (
    <div className="question-editor-fields">
      <label>
        题目标题
        <input
          value={q.label}
          maxLength={120}
          required
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>
      <div className="signup-times">
        <label>
          题型
          <select
            value={q.type}
            onChange={(e) => {
              const type = e.target.value as Question["type"];
              onChange({
                type,
                options: hasOptions(type)
                  ? q.options.length >= 2
                    ? q.options
                    : ["选项一", "选项二"]
                  : [],
                rows: hasRows(type)
                  ? q.rows?.length
                    ? q.rows
                    : ["项目一", "项目二"]
                  : undefined,
                required: type === "description" ? false : q.required,
                min: undefined,
                max: undefined,
                step: undefined,
                format: undefined,
                minLength: undefined,
                maxLength: undefined,
                minChoices: undefined,
                maxChoices: undefined,
                exclusiveOption: undefined,
              });
            }}
          >
            {Object.entries(questionTypes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {q.type !== "description" && (
          <label className="signup-choice">
            <input
              type="checkbox"
              checked={q.required}
              onChange={(e) => onChange({ required: e.target.checked })}
            />
            必填
          </label>
        )}
      </div>
      {hasOptions(q.type) && (
        <label>
          选项（每行一个）
          <textarea
            rows={Math.min(7, Math.max(3, q.options.length))}
            value={q.options.join("\n")}
            onChange={(e) => onChange({ options: e.target.value.split("\n") })}
          />
          <small>2–50 个选项。每行最多 120 字，避免重复。</small>
        </label>
      )}
      <QuestionnaireSettings q={q} onChange={onChange} />
      <details className="questionnaire-settings">
        <summary>填写提示与校验</summary>
        <label>
          {q.type === "description" ? "说明正文" : "填写提示"}
          <textarea
            value={q.help || ""}
            maxLength={300}
            onChange={(e) => onChange({ help: e.target.value })}
          />
        </label>
        {["text", "textarea"].includes(q.type) && (
          <>
            <label>
              输入占位提示
              <input
                value={q.placeholder || ""}
                maxLength={300}
                onChange={(e) => onChange({ placeholder: e.target.value })}
              />
            </label>
            <label>
              填写格式
              <select
                value={q.format || "plain"}
                onChange={(e) =>
                  onChange({ format: e.target.value as Question["format"] })
                }
              >
                <option value="plain">普通文本</option>
                <option value="email">邮箱地址</option>
                <option value="phone">中国大陆手机号</option>
                <option value="number">数字</option>
              </select>
            </label>
            <div className="signup-times">
              {(["minLength", "maxLength"] as const).map((key) => (
                <label key={key}>
                  {key === "minLength" ? "最少字数" : "最多字数"}
                  <input
                    type="number"
                    min={1}
                    max={q.type === "textarea" ? 2000 : 200}
                    value={q[key] ?? ""}
                    placeholder="不限制"
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
          </>
        )}
        {q.type === "multiple" && (
          <>
            <div className="signup-times">
              {(["minChoices", "maxChoices"] as const).map((key) => (
                <label key={key}>
                  {key === "minChoices" ? "最少选择数" : "最多选择数"}
                  <input
                    type="number"
                    min={1}
                    max={q.options.length}
                    value={q[key] ?? ""}
                    placeholder="不限制"
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
            <label>
              互斥选项
              <select
                value={q.exclusiveOption || ""}
                onChange={(e) =>
                  onChange({ exclusiveOption: e.target.value || undefined })
                }
              >
                <option value="">不设置</option>
                {q.options.filter(Boolean).map((option, n) => (
                  <option key={n} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </details>
      <QuestionnaireLogic
        q={q}
        previous={previous}
        following={following}
        onChange={onChange}
      />
    </div>
  );
}
