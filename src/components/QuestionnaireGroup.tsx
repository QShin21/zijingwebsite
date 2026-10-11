"use client";
import type { Answer, EntryAnswer, Question } from "@/lib/signup-schema";
export function QuestionnaireGroup({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: Answer | undefined;
  onChange: (value: Answer) => void;
}) {
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
        填写 {q.minEntries}–{q.maxEntries}{" "}
        条完整记录。每条记录中的必填字段均需完成。
        {!q.required && "此题可整题留空。"}
      </p>
      {shown.map((row, index) => (
        <fieldset className="questionnaire-group-entry" key={index}>
          <legend>第 {index + 1} 条</legend>
          <div className="questionnaire-group-fields">
            {q.fields!.map((field) => (
              <label key={field.id}>
                <span>
                  {field.label}
                  {field.required && <span className="required-mark"> *</span>}
                </span>
                {field.type === "select" ? (
                  <select
                    aria-label={`${q.label}第 ${index + 1} 条：${field.label}`}
                    value={row[field.id] || ""}
                    onChange={(e) => update(index, field.id, e.target.value)}
                  >
                    <option value="">请选择</option>
                    {field.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={`${q.label}第 ${index + 1} 条：${field.label}`}
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
                    placeholder={field.placeholder}
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
              移除第 {index + 1} 条
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
          添加一条记录
        </button>
        {!q.required && (
          <button type="button" onClick={() => onChange([])}>
            清空此题
          </button>
        )}
      </div>
    </div>
  );
}
