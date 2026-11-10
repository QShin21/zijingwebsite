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
    limit?: number;
  };
}) {
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
        throw new Error("移动后显示条件将引用后面的题目，请先修改关联。");
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
        "其他题目关联了本题。删除会同时移除相关显示条件和跳转分支，可撤销恢复。是否继续？",
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
      aria-label="问卷制作"
    >
      <div className="designer-heading">
        <div>
          <h2>问卷制作</h2>
          <p>
            {showRegistrationControls
              ? "先编辑收集内容，再设置接收时间。保存前可随时试填。"
              : "编辑问卷内容，保存前可随时试填。"}
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
            撤销编辑
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
            重做编辑
          </button>
          <button
            type="button"
            className="button light"
            disabled={!showEditor || !value.questions.length}
            onClick={openPreview}
          >
            预览填写效果
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
            启用填写问卷报名
          </label>
          <span>
            {value.enabled
              ? `${value.questions.length} 道题目，修改保存后生效`
              : "当前不接收问卷报名，已编辑的题目保留"}
          </span>
        </div>
      )}
      <details className="designer-source-tools" open={!value.questions.length}>
        <summary>模板、AI 与导入工具</summary>
        <QuestionnaireTools
          value={value}
          onChange={(next) => {
            onChange(next);
            setTab("questions");
            setSelected(next.questions[0]?.id || "");
            setMessage("内容已应用到编辑器。请预览后保存问卷。");
          }}
        />
      </details>
      {showEditor && (
        <>
          {illustrations && (
            <PublicationImagesEditor
              label="问卷配图"
              questions={value.questions}
              {...illustrations}
            />
          )}
          <div className="designer-tabs" role="group" aria-label="问卷编辑视图">
            <button
              type="button"
              aria-pressed={tab === "questions"}
              onClick={() => setTab("questions")}
            >
              编辑题目 <span>{value.questions.length}</span>
            </button>
            <button
              type="button"
              aria-pressed={tab === "settings"}
              onClick={() => setTab("settings")}
            >
              问卷设置
            </button>
            <button
              type="button"
              onClick={openPreview}
              disabled={!value.questions.length}
            >
              预览试填
            </button>
          </div>
          {tab === "settings" ? (
            <div className="designer-form-settings">
              <section className="designer-settings-section">
                <header>
                  <h3>填写者看到的内容</h3>
                  <p>说明收集目的，并明确提交后的下一步。</p>
                </header>
                <label>
                  问卷标题
                  <input
                    value={value.title || ""}
                    maxLength={120}
                    placeholder="默认使用活动报名"
                    onChange={(e) => patch({ title: e.target.value }, "title")}
                  />
                </label>
                <label>
                  报名说明
                  <textarea
                    value={value.intro}
                    maxLength={1000}
                    rows={4}
                    onChange={(e) => patch({ intro: e.target.value }, "intro")}
                  />
                </label>
                <label>
                  提交成功提示
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
                    问卷主题
                    <select
                      value={value.theme || "purple"}
                      onChange={(e) =>
                        patch({ theme: e.target.value as SignupForm["theme"] })
                      }
                    >
                      <option value="purple">紫荆紫</option>
                      <option value="blue">清爽蓝</option>
                      <option value="green">自然绿</option>
                    </select>
                  </label>
                  <label>
                    每页题数
                    <select
                      value={value.pageSize || 5}
                      onChange={(e) =>
                        patch({ pageSize: Number(e.target.value) })
                      }
                    >
                      {[1, 3, 5, 10, 20].map((n) => (
                        <option key={n} value={n}>
                          每页 {n} 题
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              {showRegistrationControls && (
                <section className="designer-settings-section">
                  <header>
                    <h3>接收与时间</h3>
                    <p>开放时间和暂停状态将影响实际报名入口。</p>
                  </header>
                  <div className="signup-times">
                    {(["start", "end"] as const).map((key) => (
                      <label key={key}>
                        {key === "start" ? "报名开始" : "报名截止"}
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
                    暂停接收报名
                  </label>
                  <p className="muted">
                    每个账号保留一份答卷。修改问卷后，已有答卷保留提交时的题目和答案。
                  </p>
                </section>
              )}
            </div>
          ) : (
            <div className="designer-workspace">
              <nav className="designer-outline" aria-label="题目目录">
                <h3>题目目录</h3>
                {!value.questions.length && (
                  <p>还没有题目。可以选择模板、使用 AI 或添加题型。</p>
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
                          {q.label || "未命名题目"}
                          <small>
                            {questionTypes[q.type]}
                            {q.jumps?.length ? " · 跳转" : ""}
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
                  <summary>添加题目</summary>
                  <div>
                    {Object.entries(questionTypes).map(([type, label]) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => {
                          const q = newQuestion(type as Question["type"]);
                          patch({ questions: [...value.questions, q] });
                          setSelected(q.id);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </details>
              </nav>
              <div className="designer-canvas">
                {value.questions.length === 0 && (
                  <div className="designer-empty">
                    <h3>从一个清晰的问题开始</h3>
                    <p>在题型面板中选择题目，或打开模板库查看完整问卷。</p>
                  </div>
                )}
                {value.questions.map((q, i) => (
                  <fieldset
                    className={`signup-question designer-question ${q.id === active ? "is-active" : ""}`}
                    key={q.id}
                    id={`${prefix}-${q.id}`}
                  >
                    <legend>第 {i + 1} 题</legend>
                    <button
                      type="button"
                      className="designer-question-toggle"
                      aria-expanded={q.id === active}
                      onClick={() => setSelected(q.id)}
                    >
                      <span>{q.label || "未命名题目"}</span>
                      <small>
                        {questionTypes[q.type]}
                        {q.required ? " · 必填" : ""}
                        {q.jumps?.length ? ` · ${q.jumps.length} 个跳转` : ""}
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
                              copy.label = `${q.label.slice(0, 115)}（副本）`;
                              copy.jumps = undefined;
                              const questions = [...value.questions];
                              questions.splice(i + 1, 0, copy);
                              patch({ questions });
                              setSelected(copy.id);
                            }}
                          >
                            复制此题
                          </button>
                          <button
                            type="button"
                            disabled={!i}
                            onClick={() => move(i, -1)}
                          >
                            上移
                          </button>
                          <button
                            type="button"
                            disabled={i === value.questions.length - 1}
                            onClick={() => move(i, 1)}
                          >
                            下移
                          </button>
                          <button type="button" onClick={() => remove(i)}>
                            删除此题
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
                  添加题目
                </button>
              </div>
            </div>
          )}
          {issue && (
            <p className="designer-validation" role="status">
              待完善：{issue}
            </p>
          )}
          <div className="designer-footer">
            <p>共 {value.questions.length} 题。完成检查后，在下方保存问卷。</p>
            <button
              type="button"
              onClick={openPreview}
              disabled={!value.questions.length}
            >
              检查填写流程
            </button>
          </div>
        </>
      )}
      {message && (
        <p className={surface.resultMessage} role="status">
          {message}
        </p>
      )}
      <dialog
        ref={dialog}
        className="questionnaire-dialog"
        aria-labelledby={`${prefix}-preview-title`}
      >
        <div className="dialog-top">
          <h2 id={`${prefix}-preview-title`}>{preview?.title || "问卷预览"}</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            关闭预览
          </button>
        </div>
        <p>试填答案不会保存。可以返回修改并检查每个跳转分支。</p>
        <p className="preserve">{preview?.intro}</p>
        {preview && (
          <Questionnaire key={JSON.stringify(preview)} form={preview} images={illustrations?.images} preview />
        )}
      </dialog>
    </section>
  );
}
