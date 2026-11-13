"use client";
import type { Answer, EntryAnswer, Question } from "@/lib/signup-schema";
import { useQuestionText, useT } from "./i18n/LocaleProvider";
export function QuestionnaireGroup({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: Answer | undefined;
  onChange: (value: Answer) => void;
}) {
  const t = useT(),
    text = useQuestionText(),
    label = text.label(q);
  const entries =
    Array.isArray(value) && value.every((row) => typeof row === "object")
      ? (value as EntryAnswer[])
      : [];
  const shown = entries.length
    ? entries
    : Array.from(
        { length: q.required ? q.minEntries || 1 : 1 },
        () => ({}) as EntryAnswer,
      );
  const update = (index: number, id: string, text: string) =>
    onChange(
      shown.map((row, i) => (i === index ? { ...row, [id]: text } : row)),
    );
  return (
    <div className="questionnaire-group">
      <p className="muted">
        {t(
          `填写 ${q.minEntries}–${q.maxEntries} 条完整记录。每条记录中的必填字段均需完成。`,
          `Add ${q.minEntries}–${q.maxEntries} complete entries. Every required field in each entry must be filled in.`,
        )}
        {!q.required && t("此题可整题留空。", " This question may be left empty.")}
      </p>
      {shown.map((row, index) => (
        <fieldset className="questionnaire-group-entry" key={index}>
          <legend>{t(`第 ${index + 1} 条`, `Entry ${index + 1}`)}</legend>
          <div className="questionnaire-group-fields">
            {q.fields!.map((field) => (
              <label key={field.id}>
                <span>
                  {text.fieldLabel(q, field)}
                  {field.required && <span className="required-mark"> *</span>}
                </span>
                {field.type === "select" ? (
                  <select
                    aria-label={t(`${label}第 ${index + 1} 条：${text.fieldLabel(q, field)}`, `${label}, entry ${index + 1}: ${text.fieldLabel(q, field)}`)}
                    value={row[field.id] || ""}
                    onChange={(e) => update(index, field.id, e.target.value)}
                  >
                    <option value="">{t("请选择", "Select")}</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {text.fieldOption(q, field, option)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={t(`${label}第 ${index + 1} 条：${text.fieldLabel(q, field)}`, `${label}, entry ${index + 1}: ${text.fieldLabel(q, field)}`)}
                    type={
                      field.type === "number"
                        ? "number"
                        : field.format === "email"
                          ? "email"
                          : field.format === "phone"
                            ? "tel"
                            : "text"
                    }
                    min={field.min}
                    max={field.max}
                    step={field.step || "any"}
                    minLength={field.minLength}
                    maxLength={field.maxLength || 200}
                    placeholder={text.fieldPlaceholder(q, field)}
                    value={row[field.id] || ""}
                    onChange={(e) => update(index, field.id, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          {shown.length > (q.required ? q.minEntries! : 1) && (
            <button
              type="button"
              onClick={() => onChange(shown.filter((_, i) => i !== index))}
            >
              {t(`移除第 ${index + 1} 条`, `Remove entry ${index + 1}`)}
            </button>
          )}
        </fieldset>
      ))}
      <div className="signup-tools">
        <button
          type="button"
          disabled={shown.length >= q.maxEntries!}
          onClick={() => onChange([...shown, {}])}
        >
          {t("添加一条记录", "Add an entry")}
        </button>
        {!q.required && (
          <button type="button" onClick={() => onChange([])}>
            {t("清空此题", "Clear this question")}
          </button>
        )}
      </div>
    </div>
  );
}
