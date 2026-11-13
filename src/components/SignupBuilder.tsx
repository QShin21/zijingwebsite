"use client";
import { useId, useRef, useState } from "react";
import { Questionnaire } from "./Questionnaire";
import { PublicationImagesEditor } from "./PublicationImagesEditor";
import type { PublicationImage } from "@/lib/publication-images";
import surface from "./activity-pages/QuestionnaireSurface.module.css";
import {
  emptySignup,
  normalizeSignup,
  type SignupForm,
  type Question,
} from "@/lib/signup-schema";
import { questionTypes } from "@/lib/questionnaire-model";
import { validateFlow } from "@/lib/questionnaire-flow";
import { QuestionnaireTools } from "./QuestionnaireTools";
import {
  newQuestion,
  QuestionnaireQuestionEditor,
} from "./QuestionnaireQuestionEditor";
import { useLocale, useT } from "./i18n/LocaleProvider";
import { localizeManageMessage, questionTypeLabel } from "@/lib/i18n/labels-manage";
export const signupLabels = questionTypes;
function localDate(value: string) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function SignupBuilder({
  value = emptySignup,
  onChange: onValueChange,
  showRegistrationControls = true,
  illustrations,
}: {
  value: SignupForm;
  onChange: (value: SignupForm) => void;
  showRegistrationControls?: boolean;
  illustrations?: {
    images: PublicationImage[];
    onChange: (images: PublicationImage[]) => void;
  };
}) {
  const t = useT(),
    locale = useLocale();
  const prefix = useId(),
    dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<SignupForm | null>(null),
    [message, setMessage] = useState("");
  const [past, setPast] = useState<SignupForm[]>([]),
    [future, setFuture] = useState<SignupForm[]>([]);
  const [tab, setTab] = useState<"questions" | "settings">("questions"),
    [selected, setSelected] = useState(value.questions[0]?.id || "");
  const lastEdit = useRef({ key: "", at: 0 });
  const onChange = (next: SignupForm, key = "") => {
    if (
      !key ||
      key !== lastEdit.current.key ||
      Date.now() - lastEdit.current.at > 800
    )
      setPast((list) => [...list.slice(-29), value]);
    lastEdit.current = { key, at: Date.now() };
    setFuture([]);
    onValueChange(next);
  };
  const patch = (data: Partial<SignupForm>, key = "") =>
    onChange({ ...value, ...data }, key);
  const question = (index: number, data: Partial<Question>) =>
    patch(
      {
        questions: value.questions.map((q, i) =>
          i === index ? { ...q, ...data } : q,
        ),
      },
      `${value.questions[index].id}:${Object.keys(data).join()}`,
    );
  const active = value.questions.some((q) => q.id === selected)
    ? selected
    : value.questions[0]?.id;
  const showEditor = value.enabled || !showRegistrationControls;
  let issue = "";
  if (showEditor && value.questions.length) {
    try {
      normalizeSignup(value);
    } catch (e) {
      issue = (e as Error).message;
    }
  }
  function move(index: number, direction: number) {
    const list = [...value.questions],
      other = index + direction;
    [list[index], list[other]] = [list[other], list[index]];
    try {
      validateFlow(list);
      if (
        list.some(
          (q, i) =>
            q.showWhen &&
            !list.slice(0, i).some((p) => p.id === q.showWhen!.questionId),
        )
      )
        throw new Error(t("移动后显示条件将引用后面的题目，请先修改关联。", "After moving, a display condition would refer to a later question. Update the link first."));
      patch({ questions: list });
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function remove(index: number) {
    const id = value.questions[index].id;
    const dependent = value.questions.some(
      (q) =>
        q.showWhen?.questionId === id ||
        q.display?.rules.some((r) => r.questionId === id) ||
        q.jumps?.some(
          (j) =>
            j.target === id || j.when?.rules.some((r) => r.questionId === id),
        ),
    );
    if (
      dependent &&
      !window.confirm(
        t(
          "其他题目关联了本题。删除会同时移除相关显示条件和跳转分支，可撤销恢复。是否继续？",
          "Other questions refer to this one. Deleting it also removes those display conditions and jump branches (undo is available). Continue?",
        ),
      )
    )
      return;
    patch({
      questions: value.questions
        .filter((_, n) => n !== index)
        .map((q) => {
          const linked =
            q.showWhen?.questionId === id ||
            q.display?.rules.some((r) => r.questionId === id);
          const jumps = q.jumps?.filter((j) =>
            j.target === id
              ? false
              : !j.when?.rules.some((r) => r.questionId === id),
          );
          return {
            ...q,
            ...(linked ? { display: undefined, showWhen: undefined } : {}),
            jumps: jumps?.length ? jumps : undefined,
          };
        }),
    });
  }
  function openPreview() {
    try {
      setPreview(normalizeSignup(value));
      setMessage("");
      dialog.current?.showModal();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section
      className={`${surface.surface} signup-builder questionnaire-designer`}
      aria-label={t("问卷制作", "Questionnaire builder")}
    >
      <div className="designer-heading">
        <div>
          <h2>{t("问卷制作", "Questionnaire builder")}</h2>
          <p>
            {showRegistrationControls
              ? t("先编辑收集内容，再设置接收时间。保存前可随时试填。", "Edit what to collect, then set the sign-up window. Try it out anytime before saving.")
              : t("编辑问卷内容，保存前可随时试填。", "Edit the questionnaire. Try it out anytime before saving.")}
          </p>
        </div>
        <div className="signup-tools">
          <button
            type="button"
            disabled={!past.length}
            onClick={() => {
              setFuture((list) => [value, ...list]);
              onValueChange(past.at(-1)!);
              setPast((list) => list.slice(0, -1));
              lastEdit.current.key = "";
            }}
          >
            {t("撤销编辑", "Undo")}
          </button>
          <button
            type="button"
            disabled={!future.length}
            onClick={() => {
              setPast((list) => [...list, value]);
              onValueChange(future[0]);
              setFuture((list) => list.slice(1));
              lastEdit.current.key = "";
            }}
          >
            {t("重做编辑", "Redo")}
          </button>
          <button
            type="button"
            className="button light"
            disabled={!showEditor || !value.questions.length}
            onClick={openPreview}
          >
            {t("预览填写效果", "Preview")}
          </button>
        </div>
      </div>
      {showRegistrationControls && (
        <div className="designer-enable">
          <label className="signup-choice">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
            {t("启用填写问卷报名", "Enable questionnaire sign-up")}
          </label>
          <span>
            {value.enabled
              ? t(`${value.questions.length} 道题目，修改保存后生效`, `${value.questions.length} questions; changes apply after saving`)
              : t("当前不接收问卷报名，已编辑的题目保留", "Questionnaire sign-up is off; edited questions are kept")}
          </span>
        </div>
      )}
      <details className="designer-source-tools" open={!value.questions.length}>
        <summary>{t("模板、AI 与导入工具", "Templates, AI and import")}</summary>
        <QuestionnaireTools
          value={value}
          onChange={(next) => {
            onChange(next);
            setTab("questions");
            setSelected(next.questions[0]?.id || "");
            setMessage(t("内容已应用到编辑器。请预览后保存问卷。", "Applied to the editor. Preview, then save the questionnaire."));
          }}
        />
      </details>
      {showEditor && (
        <>
          {illustrations && (
            <PublicationImagesEditor
              label={t("问卷配图", "Questionnaire images")}
              questions={value.questions}
              {...illustrations}
            />
          )}
          <div className="designer-tabs" role="group" aria-label={t("问卷编辑视图", "Questionnaire editor views")}>
            <button
              type="button"
              aria-pressed={tab === "questions"}
              onClick={() => setTab("questions")}
            >
              {t("编辑题目", "Questions")} <span>{value.questions.length}</span>
            </button>
            <button
              type="button"
              aria-pressed={tab === "settings"}
              onClick={() => setTab("settings")}
            >
              {t("问卷设置", "Settings")}
            </button>
            <button
              type="button"
              onClick={openPreview}
              disabled={!value.questions.length}
            >
              {t("预览试填", "Try it out")}
            </button>
          </div>
          {tab === "settings" ? (
            <div className="designer-form-settings">
              <section className="designer-settings-section">
                <header>
                  <h3>{t("填写者看到的内容", "What respondents see")}</h3>
                  <p>{t("说明收集目的，并明确提交后的下一步。", "Explain why you collect this and what happens after submitting.")}</p>
                </header>
                <label>
                  {t("问卷标题", "Questionnaire title")}
                  <input
                    value={value.title || ""}
                    maxLength={120}
                    placeholder={t("默认使用活动报名", "Defaults to the activity sign-up title")}
                    onChange={(e) => patch({ title: e.target.value }, "title")}
                  />
                </label>
                <label>
                  {t("报名说明", "Introduction")}
                  <textarea
                    value={value.intro}
                    maxLength={1000}
                    rows={4}
                    onChange={(e) => patch({ intro: e.target.value }, "intro")}
                  />
                </label>
                <label>
                  {t("提交成功提示", "Confirmation message")}
                  <textarea
                    value={value.completionMessage || ""}
                    maxLength={1000}
                    onChange={(e) =>
                      patch(
                        { completionMessage: e.target.value },
                        "completionMessage",
                      )
                    }
                  />
                </label>
                <div className="signup-times">
                  <label>
                    {t("问卷主题", "Theme")}
                    <select
                      value={value.theme || "purple"}
                      onChange={(e) =>
                        patch({ theme: e.target.value as SignupForm["theme"] })
                      }
                    >
                      <option value="purple">{t("紫荆紫", "Zijing purple")}</option>
                      <option value="blue">{t("清爽蓝", "Fresh blue")}</option>
                      <option value="green">{t("自然绿", "Natural green")}</option>
                    </select>
                  </label>
                  <label>
                    {t("每页题数", "Questions per page")}
                    <select
                      value={value.pageSize || 5}
                      onChange={(e) =>
                        patch({ pageSize: Number(e.target.value) })
                      }
                    >
                      {[1, 3, 5, 10, 20].map((n) => (
                        <option key={n} value={n}>
                          {t(`每页 ${n} 题`, `${n} per page`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              {showRegistrationControls && (
                <section className="designer-settings-section">
                  <header>
                    <h3>{t("接收与时间", "Sign-up window")}</h3>
                    <p>{t("开放时间和暂停状态将影响实际报名入口。", "Opening times and the pause setting control the live sign-up entry.")}</p>
                  </header>
                  <div className="signup-times">
                    {(["start", "end"] as const).map((key) => (
                      <label key={key}>
                        {key === "start" ? t("报名开始", "Sign-up opens") : t("报名截止", "Sign-up closes")}
                        <input
                          type="datetime-local"
                          value={localDate(value[key])}
                          onChange={(e) =>
                            patch({
                              [key]: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : "",
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label className="signup-choice">
                    <input
                      type="checkbox"
                      checked={value.closed}
                      onChange={(e) => patch({ closed: e.target.checked })}
                    />
                    {t("暂停接收报名", "Pause sign-ups")}
                  </label>
                  <p className="muted">
                    {t("每个账号保留一份答卷。修改问卷后，已有答卷保留提交时的题目和答案。", "Each account keeps one response. After edits, existing responses keep the questions and answers as submitted.")}
                  </p>
                </section>
              )}
            </div>
          ) : (
            <div className="designer-workspace">
              <nav className="designer-outline" aria-label={t("题目目录", "Question outline")}>
                <h3>{t("题目目录", "Question outline")}</h3>
                {!value.questions.length && (
                  <p>{t("还没有题目。可以选择模板、使用 AI 或添加题型。", "No questions yet. Choose a template, use AI or add a question type.")}</p>
                )}
                <ol>
                  {value.questions.map((q, i) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        aria-current={active === q.id ? "step" : undefined}
                        onClick={() => {
                          setSelected(q.id);
                          requestAnimationFrame(() =>
                            document
                              .getElementById(`${prefix}-${q.id}`)
                              ?.scrollIntoView({
                                block: "nearest",
                                behavior: "instant",
                              }),
                          );
                        }}
                      >
                        <span>{i + 1}</span>
                        <span>
                          {q.label || t("未命名题目", "Untitled question")}
                          <small>
                            {questionTypeLabel(q.type, locale)}
                            {q.jumps?.length ? t(" · 跳转", " · jumps") : ""}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <details
                  className="designer-palette"
                  open={!value.questions.length}
                >
                  <summary>{t("添加题目", "Add question")}</summary>
                  <div>
                    {Object.keys(questionTypes).map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => {
                          const q = newQuestion(type as Question["type"]);
                          patch({ questions: [...value.questions, q] });
                          setSelected(q.id);
                        }}
                      >
                        {questionTypeLabel(type as Question["type"], locale)}
                      </button>
                    ))}
                  </div>
                </details>
              </nav>
              <div className="designer-canvas">
                {value.questions.length === 0 && (
                  <div className="designer-empty">
                    <h3>{t("从一个清晰的问题开始", "Start with one clear question")}</h3>
                    <p>{t("在题型面板中选择题目，或打开模板库查看完整问卷。", "Pick a question type from the panel, or open the template library for a full questionnaire.")}</p>
                  </div>
                )}
                {value.questions.map((q, i) => (
                  <fieldset
                    className={`signup-question designer-question ${q.id === active ? "is-active" : ""}`}
                    key={q.id}
                    id={`${prefix}-${q.id}`}
                  >
                    <legend>{t(`第 ${i + 1} 题`, `Question ${i + 1}`)}</legend>
                    <button
                      type="button"
                      className="designer-question-toggle"
                      aria-expanded={q.id === active}
                      onClick={() => setSelected(q.id)}
                    >
                      <span>{q.label || t("未命名题目", "Untitled question")}</span>
                      <small>
                        {questionTypeLabel(q.type, locale)}
                        {q.required ? t(" · 必填", " · required") : ""}
                        {q.jumps?.length ? t(` · ${q.jumps.length} 个跳转`, ` · ${q.jumps.length} jumps`) : ""}
                      </small>
                    </button>
                    {q.id === active && (
                      <>
                        <QuestionnaireQuestionEditor
                          q={q}
                          previous={value.questions.slice(0, i)}
                          following={value.questions.slice(i + 1)}
                          onChange={(data) => question(i, data)}
                        />
                        <div className="signup-tools">
                          <button
                            type="button"
                            onClick={() => {
                              const copy = structuredClone(q);
                              copy.id = crypto.randomUUID();
                              // i18n-exempt: copied question title is questionnaire content
                              copy.label = `${q.label.slice(0, 115)}（副本）`;
                              copy.jumps = undefined;
                              const questions = [...value.questions];
                              questions.splice(i + 1, 0, copy);
                              patch({ questions });
                              setSelected(copy.id);
                            }}
                          >
                            {t("复制此题", "Duplicate")}
                          </button>
                          <button
                            type="button"
                            disabled={!i}
                            onClick={() => move(i, -1)}
                          >
                            {t("上移", "Move up")}
                          </button>
                          <button
                            type="button"
                            disabled={i === value.questions.length - 1}
                            onClick={() => move(i, 1)}
                          >
                            {t("下移", "Move down")}
                          </button>
                          <button type="button" onClick={() => remove(i)}>
                            {t("删除此题", "Delete question")}
                          </button>
                        </div>
                      </>
                    )}
                  </fieldset>
                ))}
                <button
                  type="button"
                  className="button light"
                  onClick={() => {
                    const q = newQuestion("text");
                    patch({ questions: [...value.questions, q] });
                    setSelected(q.id);
                  }}
                >
                  {t("添加题目", "Add question")}
                </button>
              </div>
            </div>
          )}
          {issue && (
            <p className="designer-validation" role="status">
              {t("待完善：", "To fix: ")}
              {localizeManageMessage(issue, locale)}
            </p>
          )}
          <div className="designer-footer">
            <p>{t(`共 ${value.questions.length} 题。完成检查后，在下方保存问卷。`, `${value.questions.length} questions. After checking, save the questionnaire below.`)}</p>
            <button
              type="button"
              onClick={openPreview}
              disabled={!value.questions.length}
            >
              {t("检查填写流程", "Check the flow")}
            </button>
          </div>
        </>
      )}
      {message && (
        <p className={surface.resultMessage} role="status">
          {localizeManageMessage(message, locale)}
        </p>
      )}
      <dialog
        ref={dialog}
        className="questionnaire-dialog"
        aria-labelledby={`${prefix}-preview-title`}
      >
        <div className="dialog-top">
          <h2 id={`${prefix}-preview-title`}>{preview?.title || t("问卷预览", "Questionnaire preview")}</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            {t("关闭预览", "Close preview")}
          </button>
        </div>
        <p>{t("试填答案不会保存。可以返回修改并检查每个跳转分支。", "Test answers are not saved. Go back to edit and check each jump branch.")}</p>
        <p className="preserve">{preview?.intro}</p>
        {preview && (
          <Questionnaire key={JSON.stringify(preview)} form={preview} images={illustrations?.images} preview />
        )}
      </dialog>
    </section>
  );
}
