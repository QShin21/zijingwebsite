"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  answerErrors,
  validateAnswers,
  visibleQuestions,
  type Answers,
  type Answer,
  type SignupForm,
} from "@/lib/signup-schema";

import {
  formatAnswer,
  questionPages,
  sanitizeDraft,
  randomizedOptions,
} from "@/lib/questionnaire-model";
import { questionRoute, endTarget } from "@/lib/questionnaire-flow";
import { QuestionnaireAdvanced } from "./QuestionnaireAdvanced";
import { PublicationImages } from "./PublicationImages";
import type { PublicationImage } from "@/lib/publication-images";
import surface from "./activity-pages/QuestionnaireSurface.module.css";
import { SubmissionSteps } from "./activity-pages/SubmissionSteps";
import { useQuestionText, useT } from "./i18n/LocaleProvider";
import { localizeMessage } from "@/lib/i18n/messages";

export function Questionnaire({
  form,
  images = [],
  onSubmit,
  onSaveDraft,
  busy = false,
  preview = false,
  draftKey,
  initialAnswers,
  submitLabel,
}: {
  form: SignupForm;
  images?: PublicationImage[];
  onSubmit?: (answers: Answers) => Promise<void>;
  onSaveDraft?: (answers: Answers) => Promise<void>;
  draftKey?: string;
  busy?: boolean;
  preview?: boolean;
  initialAnswers?: Answers;
  submitLabel?: string;
}) {
  const t = useT(),
    text = useQuestionText();
  // Validation messages start with the original label; show them in the reader's language.
  const problem = (q: { label: string }, message: string | undefined) =>
    message ? localizeMessage(message.startsWith(q.label + "：") ? message.slice(q.label.length + 1) : message, text.locale) : "";
  const prefix = useId(),
    root = useRef<HTMLDivElement>(null),
    submitLock = useRef(false);
  const [seed] = useState(() => String(Math.random()));
  const [answers, setAnswers] = useState<Answers>(() => {
    const clean = sanitizeDraft(form, initialAnswers || {});
    const ids = new Set(visibleQuestions(form, clean).map((q) => q.id));
    return Object.fromEntries(
      Object.entries(clean).filter(([id]) => ids.has(id)),
    );
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0),
    [review, setReview] = useState(false);
  const [messageKind, setMessageKind] = useState<"error" | "status">("status");
  const [message, setMessage] = useState(""),
    [sending, setSending] = useState(false);
  const route = questionRoute(form, answers);
  const visible = route.questions,
    size = form.pageSize || 5;
  const grouped = questionPages(visible, size),
    pages = grouped.length,
    current = Math.min(step, pages - 1);
  const questions = grouped[current];
  const allErrors = answerErrors(form, answers);
  const answerable = visible.filter((q) => q.type !== "description");
  const completed = answerable.filter((q) => {
    const answer = answers[q.id];
    return (
      !allErrors[q.id] &&
      (Array.isArray(answer)
        ? answer.length > 0
        : typeof answer === "object"
          ? Object.values(answer).some((v) =>
              Array.isArray(v) ? v.length : v.trim(),
            )
          : Boolean(answer?.trim()))
    );
  }).length;
  const [remember, setRemember] = useState(false),
    [savedDraft, setSavedDraft] = useState<Answers | null>(null),
    [draftMessage, setDraftMessage] = useState("");
  useEffect(() => {
    if (!draftKey || preview) return;
    try {
      const text = localStorage.getItem(draftKey);
      if (!text || text.length > 120000) return;
      const draft = JSON.parse(text);
      if (
        !Number.isFinite(draft.at) ||
        draft.at > Date.now() + 60000 ||
        Date.now() - draft.at > 7 * 86400000
      ) {
        localStorage.removeItem(draftKey);
        return;
      }
      if (
        draft.answers &&
        typeof draft.answers === "object" &&
        !Array.isArray(draft.answers)
      )
        setSavedDraft(sanitizeDraft(form, draft.answers));
    } catch {
      /* Unavailable storage must not prevent filling. */
    }
  }, [draftKey, preview]);
  useEffect(() => {
    if (!draftKey || !remember || preview) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ at: Date.now(), answers }),
        );
        setDraftMessage(t("草稿已保存在此浏览器，有效期 7 天。", "Draft saved in this browser for 7 days."));
      } catch {
        setDraftMessage(t("浏览器无法保存草稿，请保持此页面打开。", "This browser cannot save drafts. Keep this page open."));
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [answers, draftKey, remember, preview]);
  const locked = busy || sending;
  function focusHeading() {
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>(".questionnaire-step")?.focus(),
    );
  }
  function update(id: string, value: Answer) {
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
    setStep(grouped.findIndex((page) => page.some((q) => q.id === first.id)));
    requestAnimationFrame(() =>
      document.getElementById(`${prefix}-${first.id}`)?.focus(),
    );
    return false;
  }
  async function submit() {
    if (submitLock.current || locked || !check(true)) return;
    if (preview) {
      setMessageKind("status");
      setMessage(t("预览验证通过，未提交报名。", "Preview check passed. Nothing was submitted."));
      return;
    }
    submitLock.current = true;
    setSending(true);
    setMessage("");
    try {
      await onSubmit?.(validateAnswers(form, answers));
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* Storage can be disabled by the browser. */
        }
      }
    } catch (e) {
      setMessageKind("error");
      setMessage(localizeMessage((e as Error).message, text.locale));
    } finally {
      submitLock.current = false;
      setSending(false);
    }
  }
  return (
    <div
      className={`${surface.surface} ${surface.answerLayout} questionnaire member-form questionnaire-theme-${form.theme || "purple"}`}
      ref={root}
      aria-busy={locked}
    >
      <aside className={surface.answerRail} aria-label={t("填写进度与草稿", "Progress and draft")}>
        <SubmissionSteps current={review ? "review" : "fill"} />
        <div className="questionnaire-progress">
          <strong>{review ? t("等待你确认提交", "Ready for your confirmation") : t("填写进度", "Progress")}</strong>
          <span>
            {t(`已填写 ${completed} / ${answerable.length} 题`, `${completed} of ${answerable.length} answered`)}
          </span>
          <progress
            aria-label={t("填写进度", "Progress")}
            value={completed}
            max={Math.max(1, answerable.length)}
          />
          <small>{t("带 * 为必填。题目随答案显示，返回上一步会保留内容。", "* marks required questions. Questions appear based on your answers; going back keeps what you entered.")}</small>
        </div>
        {draftKey && !preview && (
          <div className="questionnaire-draft">
            <label className="signup-choice">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  setRemember(e.target.checked);
                  if (!e.target.checked) {
                    try {
                      localStorage.removeItem(draftKey);
                    } catch {
                      /* Storage can be disabled by the browser. */
                    }
                    setSavedDraft(null);
                    setDraftMessage(t("已关闭并清除此浏览器草稿", "Browser draft turned off and cleared"));
                  }
                }}
              />
              {t("在此浏览器保存草稿（公用设备请勿开启）", "Save a draft in this browser (not on shared devices)")}
            </label>
            {savedDraft && (
              <button
                type="button"
                onClick={() => {
                  const ids = new Set(
                    visibleQuestions(form, savedDraft).map((q) => q.id),
                  );
                  setAnswers(
                    Object.fromEntries(
                      Object.entries(savedDraft).filter(([id]) => ids.has(id)),
                    ),
                  );
                  setSavedDraft(null);
                  setRemember(true);
                  setStep(0);
                  setReview(false);
                }}
              >
                {t("恢复未提交的草稿", "Restore unsubmitted draft")}
              </button>
            )}
            <small role="status">{draftMessage}</small>
          </div>
        )}
      </aside>
      <div className={surface.answerMain}>
        {preview && <PublicationImages images={images.filter((image) => !image.questionId)} />}
        <h3 className="questionnaire-step" tabIndex={-1}>
          {review
            ? t("核对填写内容", "Review your answers")
            : pages === 1
              ? t("填写信息", "Your answers")
              : t(`填写信息 · 第 ${current + 1} / ${pages} 页`, `Your answers · page ${current + 1} of ${pages}`)}
        </h3>
        {Object.keys(errors).length > 0 && (
          <div
            className={surface.errorSummary}
            role="alert"
            aria-label={t("请核对以下题目", "Please check these questions")}
          >
            <p>{t(`有 ${Object.keys(errors).length} 题需要核对，已填写内容保留。`, `${Object.keys(errors).length} question(s) need attention. Your answers are kept.`)}</p>
            <ul>
              {visible
                .filter((q) => errors[q.id])
                .map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setReview(false);
                        setStep(
                          grouped.findIndex((page) =>
                            page.some((item) => item.id === q.id),
                          ),
                        );
                        requestAnimationFrame(() =>
                          document.getElementById(`${prefix}-${q.id}`)?.focus(),
                        );
                      }}
                    >
                      {text.label(q)}{t("：", ": ")}{problem(q, errors[q.id])}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
        {review ? (
          <>
            <p>{t("请核对每项内容。点击下方确认按钮后才会提交。", "Check each answer. Nothing is submitted until you confirm below.")}</p>
            <dl className="questionnaire-review">
              {answerable.map((q) => (
                <div key={q.id}>
                  <dt>{text.label(q)}</dt>
                  <dd>{text.locale === "en" ? text.answer(answers[q.id], q) : formatAnswer(answers[q.id], q) || "未填写"}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          questions.map((original) => {
            const q = original.randomize
              ? {
                  ...original,
                  options: randomizedOptions(
                    original.options,
                    seed + original.id,
                  ),
                }
              : original;
            const value = answers[q.id],
              fieldId = `${prefix}-${q.id}`;
            const hint = [
              text.help(q),
              q.minLength ? t(`至少 ${q.minLength} 字`, `At least ${q.minLength} characters`) : "",
              q.type === "multiple"
                ? t(
                    `可选 ${q.minChoices || 1}–${q.maxChoices || q.options.length} 项${q.required ? "" : "，可留空"}${q.exclusiveOption ? `；“${q.exclusiveOption}”单独选择` : ""}`,
                    `Choose ${q.minChoices || 1}–${q.maxChoices || q.options.length}${q.required ? "" : " (optional)"}${q.exclusiveOption ? `; “${text.option(q, q.exclusiveOption)}” must be chosen alone` : ""}`,
                  )
                : "",
              q.format === "phone"
                ? t("11 位中国大陆手机号", "11-digit mainland China mobile number")
                : q.format === "email"
                  ? t("请填写完整邮箱地址", "Enter a full email address")
                  : q.format === "number"
                    ? t("填写数字，可含小数或负号", "Enter a number (decimals and minus allowed)")
                    : "",
            ]
              .filter(Boolean)
              .join(" · ");
            const illustrations = images.filter((image) => image.questionId === q.id);
            if (q.type === "description")
              return (
                <section className="questionnaire-description" key={q.id}>
                  <h4>{text.label(q)}</h4>
                  <p className="preserve">{text.help(q)}</p>
                  <PublicationImages images={illustrations} />
                </section>
              );
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
                  {visible.findIndex((v) => v.id === q.id) + 1}. {text.label(q)}
                  {q.required ? " *" : t("（选填）", " (optional)")}
                </legend>
                <p id={`${fieldId}-hint`} className="muted">
                  {hint}
                </p>
                <PublicationImages images={illustrations} />
                <QuestionnaireAdvanced
                  q={q}
                  value={value}
                  name={fieldId}
                  onChange={(answer) => update(q.id, answer)}
                />
                {["text", "textarea"].includes(q.type) && (
                  <>
                    {q.type === "textarea" ? (
                      <textarea
                        aria-label={text.label(q)}
                        aria-invalid={Boolean(errors[q.id])}
                        aria-describedby={`${fieldId}-hint ${fieldId}-error`}
                        value={typeof value === "string" ? value : ""}
                        placeholder={text.placeholder(q)}
                        maxLength={q.maxLength || 2000}
                        rows={4}
                        onChange={(e) => update(q.id, e.target.value)}
                      />
                    ) : (
                      <input
                        aria-label={text.label(q)}
                        aria-invalid={Boolean(errors[q.id])}
                        aria-describedby={`${fieldId}-hint ${fieldId}-error`}
                        value={typeof value === "string" ? value : ""}
                        placeholder={text.placeholder(q)}
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
                      {q.maxLength || (q.type === "textarea" ? 2000 : 200)}{t(" 字", "")}
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
                            ? Array.isArray(value) &&
                              value.some((v) => v === option)
                            : value === option
                        }
                        onChange={(e) => {
                          if (q.type === "single") update(q.id, option);
                          else {
                            const previous = Array.isArray(value)
                              ? value.filter((v) => typeof v === "string")
                              : [];
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
                      {text.option(q, option)}
                    </label>
                  ))}
                {q.type === "single" && !q.required && (
                  <button type="button" onClick={() => update(q.id, "")}>
                    {t("清除此题选择", "Clear selection")}
                  </button>
                )}
                <p
                  id={`${fieldId}-error`}
                  className="questionnaire-error"
                  role={errors[q.id] ? "alert" : undefined}
                >
                  {problem(q, errors[q.id])}
                </p>
              </fieldset>
            );
          })
        )}
        {!review &&
          route.jumps.some((j) => questions.some((q) => q.id === j.from)) && (
            <p className="questionnaire-branch-notice" role="status">
              {route.jumps
                .filter((j) => questions.some((q) => q.id === j.from))
                .map((j) =>
                  j.target === endTarget
                    ? t("当前答案将提前结束问卷，下一步核对并提交。", "This answer ends the questionnaire early; next you review and submit.")
                    : (() => {
                        const target = form.questions.find((q) => q.id === j.target);
                        return t(
                          `当前答案将进入“${target?.label || "后续题目"}”，跳过中间 ${j.skipped} 题。`,
                          `This answer continues at “${target ? text.label(target) : "a later question"}”, skipping ${j.skipped} question(s).`,
                        );
                      })(),
                )
                .join(" ")}
            </p>
          )}
        <div className={surface.answerFooter}>
          {message && (
            <p
              className={
                messageKind === "error"
                  ? surface.errorSummary
                  : surface.resultMessage
              }
              role={messageKind === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          )}
          <div className="signup-tools">
            {onSaveDraft && !preview && (
              <button
                type="button"
                disabled={locked}
                onClick={async () => {
                  if (submitLock.current || locked) return;
                  submitLock.current = true;
                  setSending(true);
                  setMessage("");
                  try {
                    await onSaveDraft(answers);
                    setMessageKind("status");
                    setMessage(t("草稿已保存，尚未提交人工审核。", "Draft saved. It has not been submitted for review."));
                  } catch (error) {
                    setMessageKind("error");
                    setMessage(localizeMessage((error as Error).message, text.locale));
                  } finally {
                    submitLock.current = false;
                    setSending(false);
                  }
                }}
              >
                {t("保存草稿", "Save draft")}
              </button>
            )}
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
                {review ? t("返回修改", "Back to edit") : t("上一步", "Previous")}
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
                {current < pages - 1 ? t("下一步", "Next") : t("核对并提交", "Review and submit")}
              </button>
            )}
            {review && (
              <button
                type="button"
                className="button"
                disabled={locked}
                onClick={() => void submit()}
              >
                {locked ? t("正在提交…", "Submitting…") : preview ? t("验证预览答案", "Check preview answers") : submitLabel ?? t("提交并确认报名", "Submit and confirm")}
              </button>
            )}
          </div>
          {locked && (
            <p className={surface.saving} role="status">
              {t("正在保存，请保持页面打开…", "Saving. Keep this page open…")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
