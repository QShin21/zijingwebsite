"use client";
import type { Question } from "@/lib/signup-schema";
import { hasOptions, hasRows, questionTypes } from "@/lib/questionnaire-model";
import { questionTypeLabel } from "@/lib/i18n/labels-manage";
import { useLocale, useT } from "./i18n/LocaleProvider";
import { QuestionnaireSettings } from "./QuestionnaireSettings";
import { QuestionnaireLogic } from "./QuestionnaireLogic";
import {
  defaultGroupFields,
  QuestionnaireGroupEditor,
} from "./QuestionnaireGroupEditor";
export function newQuestion(type: Question["type"]): Question {
  return {
    id: crypto.randomUUID(),
    // i18n-exempt: default questionnaire content inserted into the form (published content)
    label: type === "description" ? "补充说明" : "新题目",
    type,
    required: type !== "description",
    // i18n-exempt: default questionnaire content inserted into the form (published content)
    options: hasOptions(type) ? ["选项一", "选项二"] : [],
    // i18n-exempt: default questionnaire content inserted into the form (published content)
    ...(hasRows(type) ? { rows: ["项目一", "项目二"] } : {}),
    ...(type === "group"
      ? { fields: defaultGroupFields(), minEntries: 1, maxEntries: 10 }
      : {}),
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
  const t = useT(),
    locale = useLocale();
  return (
    <div className="question-editor-fields">
      <label>
        {t("题目标题", "Question title")}
        <input
          value={q.label}
          maxLength={120}
          required
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>
      <div className="signup-times">
        <label>
          {t("题型", "Type")}
          <select
            value={q.type}
            onChange={(e) => {
              const type = e.target.value as Question["type"];
              onChange({
                type,
                options: hasOptions(type)
                  ? q.options.length >= 2
                    ? q.options
                    // i18n-exempt: default questionnaire content inserted into the form (published content)
                    : ["选项一", "选项二"]
                  : [],
                rows: hasRows(type)
                  ? q.rows?.length
                    ? q.rows
                    // i18n-exempt: default questionnaire content inserted into the form (published content)
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
                fields:
                  type === "group"
                    ? q.fields || defaultGroupFields()
                    : undefined,
                minEntries: type === "group" ? q.minEntries || 1 : undefined,
                maxEntries: type === "group" ? q.maxEntries || 10 : undefined,
              });
            }}
          >
            {Object.keys(questionTypes).map((key) => (
              <option key={key} value={key}>
                {questionTypeLabel(key as Question["type"], locale)}
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
            {t("必填", "Required")}
          </label>
        )}
      </div>
      {hasOptions(q.type) && (
        <label>
          {t("选项（每行一个）", "Options (one per line)")}
          <textarea
            rows={Math.min(7, Math.max(3, q.options.length))}
            value={q.options.join("\n")}
            onChange={(e) => onChange({ options: e.target.value.split("\n") })}
          />
          <small>{t("2–50 个选项。每行最多 120 字，避免重复。", "2–50 options, up to 120 characters each, no duplicates.")}</small>
        </label>
      )}
      <QuestionnaireSettings q={q} onChange={onChange} />
      {q.type === "group" && (
        <QuestionnaireGroupEditor q={q} onChange={onChange} />
      )}
      <details className="questionnaire-settings">
        <summary>{t("填写提示与校验", "Hints and validation")}</summary>
        <label>
          {q.type === "description" ? t("说明正文", "Description text") : t("填写提示", "Hint")}
          <textarea
            value={q.help || ""}
            maxLength={300}
            onChange={(e) => onChange({ help: e.target.value })}
          />
        </label>
        {["text", "textarea"].includes(q.type) && (
          <>
            <label>
              {t("输入占位提示", "Placeholder")}
              <input
                value={q.placeholder || ""}
                maxLength={300}
                onChange={(e) => onChange({ placeholder: e.target.value })}
              />
            </label>
            <label>
              {t("填写格式", "Format")}
              <select
                value={q.format || "plain"}
                onChange={(e) =>
                  onChange({ format: e.target.value as Question["format"] })
                }
              >
                <option value="plain">{t("普通文本", "Plain text")}</option>
                <option value="email">{t("邮箱地址", "Email address")}</option>
                <option value="phone">{t("中国大陆手机号", "Mainland China mobile")}</option>
                <option value="number">{t("数字", "Number")}</option>
              </select>
            </label>
            <div className="signup-times">
              {(["minLength", "maxLength"] as const).map((key) => (
                <label key={key}>
                  {key === "minLength" ? t("最少字数", "Min. characters") : t("最多字数", "Max. characters")}
                  <input
                    type="number"
                    min={1}
                    max={q.type === "textarea" ? 2000 : 200}
                    value={q[key] ?? ""}
                    placeholder={t("不限制", "No limit")}
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
                  {key === "minChoices" ? t("最少选择数", "Min. choices") : t("最多选择数", "Max. choices")}
                  <input
                    type="number"
                    min={1}
                    max={q.options.length}
                    value={q[key] ?? ""}
                    placeholder={t("不限制", "No limit")}
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
              {t("互斥选项", "Exclusive option")}
              <select
                value={q.exclusiveOption || ""}
                onChange={(e) =>
                  onChange({ exclusiveOption: e.target.value || undefined })
                }
              >
                <option value="">{t("不设置", "None")}</option>
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
