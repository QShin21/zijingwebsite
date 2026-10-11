"use client";
import { useId, useRef, useState } from "react";
import {
  answerErrors,
  validateAnswers,
  visibleQuestions,
  type Answers,
  type SignupForm,
} from "@/lib/signup-schema";

export function Questionnaire({
  form,
  onSubmit,
  busy = false,
  preview = false,
}: {
  form: SignupForm;
  onSubmit?: (answers: Answers) => Promise<void>;
  busy?: boolean;
  preview?: boolean;
}) {
  const prefix = useId(),
    root = useRef<HTMLDivElement>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0),
    [review, setReview] = useState(false);
  const [message, setMessage] = useState(""),
    [sending, setSending] = useState(false);
  const visible = visibleQuestions(form, answers),
    size = form.pageSize || 5;
  const pages = Math.max(1, Math.ceil(visible.length / size)),
    current = Math.min(step, pages - 1);
  const questions = visible.slice(current * size, (current + 1) * size);
  const allErrors = answerErrors(form, answers);
  const completed = visible.filter((q) => {
    const answer = answers[q.id];
    return (
      !allErrors[q.id] &&
      (Array.isArray(answer) ? answer.length > 0 : Boolean(answer?.trim()))
    );
  }).length;
  const locked = busy || sending;
  function focusHeading() {
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>(".questionnaire-step")?.focus(),
    );
  }
  function update(id: string, value: string | string[]) {
    const next = { ...answers, [id]: value };
    const ids = new Set(visibleQuestions(form, next).map((q) => q.id));
    setAnswers(
      Object.fromEntries(Object.entries(next).filter(([key]) => ids.has(key))),
    );
    setErrors({});
    setMessage("");
  }
  function check(all: boolean) {
    const scope = all ? visible : questions;
    const relevant = Object.fromEntries(
      scope.filter((q) => allErrors[q.id]).map((q) => [q.id, allErrors[q.id]]),
    );
    setErrors(relevant);
    const first = scope.find((q) => relevant[q.id]);
    if (!first) return true;
    setReview(false);
    setStep(Math.floor(visible.indexOf(first) / size));
    requestAnimationFrame(() =>
      document.getElementById(`${prefix}-${first.id}`)?.focus(),
    );
    return false;
  }
  async function submit() {
    if (locked || !check(true)) return;
    if (preview) {
      setMessage("预览验证通过，未提交报名。");
      return;
    }
    setSending(true);
    setMessage("");
    try {
      await onSubmit?.(validateAnswers(form, answers));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="questionnaire member-form" ref={root} aria-busy={locked}>
      <div className="questionnaire-progress">
        <span>
          已填写 {completed} / {visible.length} 题
        </span>
        <progress
          aria-label="填写进度"
          value={completed}
          max={Math.max(1, visible.length)}
        />
        <small>
          带 * 为必填；根据答案显示相关题目。返回上一步会保留已填内容。
        </small>
      </div>
      <h3 className="questionnaire-step" tabIndex={-1}>
        {review ? "核对报名信息" : `第 ${current + 1} / ${pages} 页`}
      </h3>
      {review ? (
        <>
          <p>请核对以下内容，确认提交后即完成报名。</p>
          <dl className="questionnaire-review">
            {visible.map((q) => (
              <div key={q.id}>
                <dt>{q.label}</dt>
                <dd>
                  {Array.isArray(answers[q.id])
                    ? (answers[q.id] as string[]).join("、") || "未填写"
                    : answers[q.id] || "未填写"}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        questions.map((q, index) => {
          const value = answers[q.id],
            fieldId = `${prefix}-${q.id}`;
          const hint = [
            q.help,
            q.minLength ? `至少 ${q.minLength} 字` : "",
            q.type === "multiple"
              ? `可选 ${q.minChoices || 1}–${q.maxChoices || q.options.length} 项${q.required ? "" : "，可留空"}${q.exclusiveOption ? `；“${q.exclusiveOption}”单独选择` : ""}`
              : "",
            q.format === "phone"
              ? "11 位中国大陆手机号"
              : q.format === "email"
                ? "请填写完整邮箱地址"
                : q.format === "number"
                  ? "填写数字，可含小数或负号"
                  : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <fieldset
              key={q.id}
              id={fieldId}
              tabIndex={-1}
              className={`signup-question ${errors[q.id] ? "questionnaire-invalid" : ""}`}
              disabled={locked}
              aria-describedby={`${fieldId}-hint${errors[q.id] ? ` ${fieldId}-error` : ""}`}
            >
              <legend>
                {current * size + index + 1}. {q.label}
                {q.required ? " *" : "（选填）"}
              </legend>
              <p id={`${fieldId}-hint`} className="muted">
                {hint}
              </p>
              {["text", "textarea"].includes(q.type) && (
                <>
                  {q.type === "textarea" ? (
                    <textarea
                      aria-label={q.label}
                      aria-invalid={Boolean(errors[q.id])}
                      aria-describedby={`${fieldId}-hint ${fieldId}-error`}
                      value={typeof value === "string" ? value : ""}
                      placeholder={q.placeholder}
                      maxLength={q.maxLength || 2000}
                      rows={4}
                      onChange={(e) => update(q.id, e.target.value)}
                    />
                  ) : (
                    <input
                      aria-label={q.label}
                      aria-invalid={Boolean(errors[q.id])}
                      aria-describedby={`${fieldId}-hint ${fieldId}-error`}
                      value={typeof value === "string" ? value : ""}
                      placeholder={q.placeholder}
                      maxLength={q.maxLength || 200}
                      inputMode={
                        q.format === "email"
                          ? "email"
                          : q.format === "phone"
                            ? "tel"
                            : q.format === "number"
                              ? "decimal"
                              : "text"
                      }
                      onChange={(e) => update(q.id, e.target.value)}
                    />
                  )}
                  <small className="questionnaire-counter">
                    {typeof value === "string" ? value.length : 0} /{" "}
                    {q.maxLength || (q.type === "textarea" ? 2000 : 200)} 字
                  </small>
                </>
              )}
              {["single", "multiple"].includes(q.type) &&
                q.options.map((option) => (
                  <label
                    className="signup-choice questionnaire-option"
                    key={option}
                  >
                    <input
                      type={q.type === "single" ? "radio" : "checkbox"}
                      name={fieldId}
                      checked={
                        q.type === "multiple"
                          ? Array.isArray(value) && value.includes(option)
                          : value === option
                      }
                      onChange={(e) => {
                        if (q.type === "single") update(q.id, option);
                        else {
                          const previous = Array.isArray(value) ? value : [];
                          update(
                            q.id,
                            e.target.checked
                              ? option === q.exclusiveOption
                                ? [option]
                                : [
                                    ...previous.filter(
                                      (v) => v !== q.exclusiveOption,
                                    ),
                                    option,
                                  ]
                              : previous.filter((v) => v !== option),
                          );
                        }
                      }}
                    />
                    {option}
                  </label>
                ))}
              {q.type === "single" && !q.required && (
                <button type="button" onClick={() => update(q.id, "")}>
                  清除此题选择
                </button>
              )}
              <p
                id={`${fieldId}-error`}
                className="questionnaire-error"
                role={errors[q.id] ? "alert" : undefined}
              >
                {errors[q.id]}
              </p>
            </fieldset>
          );
        })
      )}
      <p role="alert">{message}</p>
      <div className="signup-tools">
        {(review || current > 0) && (
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              if (review) setReview(false);
              else setStep(current - 1);
              focusHeading();
            }}
          >
            {review ? "返回修改" : "上一步"}
          </button>
        )}
        {!review && (
          <button
            type="button"
            className="button"
            disabled={locked}
            onClick={() => {
              if (!check(current === pages - 1)) return;
              if (current < pages - 1) setStep(current + 1);
              else setReview(true);
              focusHeading();
            }}
          >
            {current < pages - 1 ? "下一步" : "核对并提交"}
          </button>
        )}
        {review && (
          <button
            type="button"
            className="button"
            disabled={locked}
            onClick={() => void submit()}
          >
            {locked ? "正在提交…" : preview ? "验证预览答案" : "提交并确认报名"}
          </button>
        )}
      </div>
    </div>
  );
}
