"use client";
import type { Answer, Question } from "@/lib/signup-schema";
import { hasRows } from "@/lib/questionnaire-model";
import { QuestionnaireGroup } from "./QuestionnaireGroup";
import { useQuestionText, useT } from "./i18n/LocaleProvider";
export function QuestionnaireAdvanced({
  q,
  value,
  onChange,
  name,
}: {
  q: Question;
  value: Answer | undefined;
  onChange: (value: Answer) => void;
  name: string;
}) {
  const t = useT(),
    text = useQuestionText(),
    label = text.label(q);
  if (q.type === "group")
    return <QuestionnaireGroup q={q} value={value} onChange={onChange} />;
  if (q.type === "select")
    return (
      <select
        aria-label={label}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t("请选择", "Select")}</option>
        {q.options.map((v) => (
          <option key={v} value={v}>
            {text.option(q, v)}
          </option>
        ))}
      </select>
    );
  if (["number", "date", "time"].includes(q.type))
    return (
      <input
        aria-label={label}
        type={q.type}
        min={q.min}
        max={q.max}
        step={q.step || "any"}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  if (["rating", "nps"].includes(q.type))
    return (
      <div className="questionnaire-scale">
        <small>
          {q.type === "nps"
            ? t("0 = 完全不会推荐，10 = 非常愿意推荐", "0 = not at all likely to recommend, 10 = extremely likely")
            : t(`${q.min} = 最低，${q.max} = 最高`, `${q.min} = lowest, ${q.max} = highest`)}
        </small>
        <div>
          {Array.from(
            { length: (q.max || 5) - (q.min || 0) + 1 },
            (_, i) => i + (q.min || 0),
          ).map((n) => (
            <label key={n}>
              <input
                type="radio"
                name={name}
                checked={value === String(n)}
                onChange={() => onChange(String(n))}
              />
              {n}
            </label>
          ))}
        </div>
        {!q.required && (
          <button type="button" onClick={() => onChange("")}>
            {t("清除此题选择", "Clear selection")}
          </button>
        )}
      </div>
    );
  if (q.type === "ranking") {
    const ranked = Array.isArray(value)
      ? value.filter((v) => typeof v === "string")
      : [];
    return (
      <div className="questionnaire-ranking">
        <p>{t("按偏好从高到低选择，第一项为最高优先级。", "Rank from most to least preferred; the first is the top priority.")}</p>
        {q.options.map((_, i) => (
          <label key={i}>
            {t(`第 ${i + 1} 名`, `Rank ${i + 1}`)}
            <select
              aria-label={t(`第 ${i + 1} 名`, `Rank ${i + 1}`)}
              value={ranked[i] || ""}
              onChange={(e) => {
                const next = Array.from(
                  { length: q.options.length },
                  (_, n) => ranked[n] || "",
                );
                next[i] = e.target.value;
                onChange(next);
              }}
            >
              <option value="">{t("请选择", "Select")}</option>
              {q.options.map((option) => (
                <option
                  value={option}
                  key={option}
                  disabled={ranked.includes(option) && ranked[i] !== option}
                >
                  {text.option(q, option)}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="button" onClick={() => onChange([])}>
          {t("清空排序", "Clear ranking")}
        </button>
      </div>
    );
  }
  if (hasRows(q.type)) {
    const rows =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return (
      <div className="questionnaire-matrix">
        {q.rows!.map((row, i) => (
          <fieldset key={row}>
            <legend>{text.row(q, row)}</legend>
            {q.type === "blanks" ? (
              <input
                aria-label={`${label}${t("：", ": ")}${text.row(q, row)}`}
                maxLength={200}
                value={
                  typeof rows[row] === "string" ? (rows[row] as string) : ""
                }
                onChange={(e) => onChange({ ...rows, [row]: e.target.value })}
              />
            ) : (
              q.options.map((option) => (
                <label
                  className="signup-choice questionnaire-option"
                  key={option}
                >
                  <input
                    type={q.type === "matrix" ? "radio" : "checkbox"}
                    name={`${name}-${i}`}
                    checked={
                      q.type === "matrix"
                        ? rows[row] === option
                        : Array.isArray(rows[row]) &&
                          (rows[row] as string[]).includes(option)
                    }
                    onChange={(e) => {
                      const previous = Array.isArray(rows[row])
                        ? (rows[row] as string[])
                        : [];
                      onChange({
                        ...rows,
                        [row]:
                          q.type === "matrix"
                            ? option
                            : e.target.checked
                              ? [...previous, option]
                              : previous.filter((v) => v !== option),
                      });
                    }}
                  />
                  {text.option(q, option)}
                </label>
              ))
            )}
          </fieldset>
        ))}
      </div>
    );
  }
  return null;
}
