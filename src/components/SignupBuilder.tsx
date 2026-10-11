"use client";
import { useRef, useState } from "react";
import { Questionnaire } from "./Questionnaire";
import {
  emptySignup,
  normalizeSignup,
  type SignupForm,
  type Question,
} from "@/lib/signup-schema";
import { questionTypes, hasOptions } from "@/lib/questionnaire-model";
import { QuestionnaireSettings } from "./QuestionnaireSettings";
import { QuestionnaireTools } from "./QuestionnaireTools";
export const signupLabels = questionTypes;
function localDate(value: string) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function SignupBuilder({
  value = emptySignup,
  onChange: onValueChange,
}: {
  value: SignupForm;
  onChange: (value: SignupForm) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<SignupForm | null>(null);
  const [message, setMessage] = useState("");
  const [past, setPast] = useState<SignupForm[]>([]),
    [future, setFuture] = useState<SignupForm[]>([]);
  const onChange = (next: SignupForm) => {
    setPast((list) => [...list.slice(-29), value]);
    setFuture([]);
    onValueChange(next);
  };
  const patch = (data: Partial<SignupForm>) => onChange({ ...value, ...data });
  const question = (index: number, data: Partial<Question>) =>
    patch({
      questions: value.questions.map((q, i) =>
        i === index ? { ...q, ...data } : q,
      ),
    });
  const move = (index: number, direction: number) => {
    const list = [...value.questions],
      other = index + direction;
    [list[index], list[other]] = [list[other], list[index]];
    patch({ questions: list });
  };
  return (
    <section className="signup-builder">
      <h3>报名问卷</h3>
      <div className="signup-tools">
        <button
          type="button"
          disabled={!past.length}
          onClick={() => {
            setFuture((list) => [value, ...list]);
            onValueChange(past.at(-1)!);
            setPast((list) => list.slice(0, -1));
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
          }}
        >
          重做编辑
        </button>
      </div>
      <label className="signup-choice">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        启用填写问卷报名
      </label>
      <p>
        用户提交后立即确认报名。请仅收集本次活动所需的信息；每个账号只保留一份报名记录。
      </p>
      {value.enabled && (
        <>
          <QuestionnaireTools value={value} onChange={onChange} />
          <label>
            问卷标题
            <input
              value={value.title || ""}
              maxLength={120}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="默认使用活动报名"
            />
          </label>
          <label>
            提交成功提示
            <textarea
              value={value.completionMessage || ""}
              maxLength={1000}
              onChange={(e) => patch({ completionMessage: e.target.value })}
              placeholder="已收到你的报名信息"
            />
          </label>
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
            报名说明
            <textarea
              value={value.intro}
              maxLength={1000}
              onChange={(e) => patch({ intro: e.target.value })}
            />
          </label>
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
          <label>
            每页题数
            <select
              value={value.pageSize || 5}
              onChange={(e) => patch({ pageSize: Number(e.target.value) })}
            >
              {[1, 3, 5, 10, 20].map((n) => (
                <option value={n} key={n}>
                  {n === 20 ? "全部题目" : `每页 ${n} 题`}
                </option>
              ))}
            </select>
          </label>
          <p>
            可为后续题目设置显示条件。调整顺序或选项后，请预览检查关联是否有效。
          </p>
          {value.questions.map((q, i) => (
            <fieldset className="signup-question" key={q.id}>
              <legend>第 {i + 1} 题</legend>
              <label>
                题目标题
                <input
                  value={q.label}
                  maxLength={120}
                  required
                  onChange={(e) => question(i, { label: e.target.value })}
                />
              </label>
              <label>
                题型
                <select
                  value={q.type}
                  onChange={(e) =>
                    question(i, {
                      type: e.target.value as Question["type"],
                      min: undefined,
                      max: undefined,
                      step: undefined,
                      format: undefined,
                      minLength: undefined,
                      maxLength: undefined,
                      minChoices: undefined,
                      maxChoices: undefined,
                      exclusiveOption: undefined,
                    })
                  }
                >
                  {Object.entries(signupLabels).map(([key, text]) => (
                    <option key={key} value={key}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
              <label className="signup-choice">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => question(i, { required: e.target.checked })}
                />
                必填
              </label>
              {hasOptions(q.type) && (
                <label>
                  选项（每行一个）
                  <textarea
                    rows={4}
                    value={q.options.join("\n")}
                    onChange={(e) =>
                      question(i, { options: e.target.value.split("\n") })
                    }
                  />
                </label>
              )}
              <QuestionnaireSettings
                q={q}
                previous={value.questions.slice(0, i)}
                onChange={(data) => question(i, data)}
              />
              <details className="questionnaire-settings">
                <summary>填写提示、校验与显示条件</summary>
                <label>
                  填写提示
                  <textarea
                    value={q.help || ""}
                    maxLength={300}
                    onChange={(e) => question(i, { help: e.target.value })}
                  />
                </label>
                {["text", "textarea"].includes(q.type) && (
                  <>
                    <label>
                      输入占位提示
                      <input
                        value={q.placeholder || ""}
                        maxLength={300}
                        onChange={(e) =>
                          question(i, { placeholder: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      填写格式
                      <select
                        value={q.format || "plain"}
                        onChange={(e) =>
                          question(i, {
                            format: e.target.value as Question["format"],
                          })
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
                            placeholder={
                              key === "maxLength"
                                ? String(q.type === "textarea" ? 2000 : 200)
                                : "不限制"
                            }
                            onChange={(e) =>
                              question(i, {
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
                            max={q.options.length || 20}
                            value={q[key] ?? ""}
                            placeholder="不限制"
                            onChange={(e) =>
                              question(i, {
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
                          question(i, {
                            exclusiveOption: e.target.value || undefined,
                          })
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
                    <small>
                      例如“均不参加”，选择此项会清除其他选择，可单独提交。
                    </small>
                  </>
                )}
                <label>
                  显示条件
                  <select
                    value={q.showWhen?.questionId || ""}
                    onChange={(e) =>
                      question(i, {
                        showWhen: e.target.value
                          ? {
                              questionId: e.target.value,
                              option:
                                value.questions.find(
                                  (v) => v.id === e.target.value,
                                )?.options[0] || "",
                            }
                          : undefined,
                      })
                    }
                  >
                    <option value="">始终显示</option>
                    {value.questions
                      .slice(0, i)
                      .filter((v) =>
                        ["single", "multiple", "select"].includes(v.type),
                      )
                      .map((previous) => (
                        <option key={previous.id} value={previous.id}>
                          {previous.label || "未命名题目"}
                        </option>
                      ))}
                  </select>
                </label>
                {q.showWhen && (
                  <label>
                    选中以下选项时显示
                    <select
                      value={q.showWhen.option}
                      onChange={(e) =>
                        question(i, {
                          showWhen: { ...q.showWhen!, option: e.target.value },
                        })
                      }
                    >
                      {value.questions
                        .find((v) => v.id === q.showWhen?.questionId)
                        ?.options.map((option, n) => (
                          <option key={n} value={option}>
                            {option}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </details>
              <div className="signup-tools">
                <button
                  type="button"
                  disabled={value.questions.length >= 100}
                  onClick={() => {
                    const list = [...value.questions];
                    list.splice(i + 1, 0, {
                      ...q,
                      id: crypto.randomUUID(),
                      label: `${q.label.slice(0, 115)}（副本）`,
                      options: [...q.options],
                    });
                    patch({ questions: list });
                  }}
                >
                  复制此题
                </button>
                <button type="button" disabled={!i} onClick={() => move(i, -1)}>
                  上移
                </button>
                <button
                  type="button"
                  disabled={i === value.questions.length - 1}
                  onClick={() => move(i, 1)}
                >
                  下移
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const dependent = value.questions.some(
                      (v) =>
                        v.showWhen?.questionId === q.id ||
                        v.display?.rules.some((r) => r.questionId === q.id),
                    );
                    if (
                      dependent &&
                      !window.confirm(
                        "后续题目关联了本题。删除后，这些题目将改为始终显示，是否继续？",
                      )
                    )
                      return;
                    patch({
                      questions: value.questions
                        .filter((_, n) => n !== i)
                        .map((v) =>
                          v.showWhen?.questionId === q.id ||
                          v.display?.rules.some((r) => r.questionId === q.id)
                            ? { ...v, showWhen: undefined, display: undefined }
                            : v,
                        ),
                    });
                  }}
                >
                  删除此题
                </button>
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            className="button light"
            disabled={value.questions.length >= 100}
            onClick={() =>
              patch({
                questions: [
                  ...value.questions,
                  {
                    id: crypto.randomUUID(),
                    label: "",
                    type: "text",
                    required: true,
                    options: [],
                  },
                ],
              })
            }
          >
            添加题目
          </button>
          <p>最多 100 道题。修改问卷后，已有报名保留提交时的题目和答案。</p>
          <button
            type="button"
            className="button light"
            onClick={() => {
              try {
                setPreview(normalizeSignup(value));
                setMessage("");
                dialog.current?.showModal();
              } catch (error) {
                setMessage((error as Error).message);
              }
            }}
          >
            预览填写效果
          </button>
          <p role="alert">{message}</p>
          <dialog ref={dialog} className="questionnaire-dialog">
            <div className="signup-tools">
              <h2>问卷预览</h2>
              <button type="button" onClick={() => dialog.current?.close()}>
                关闭预览
              </button>
            </div>
            <p>预览答案不会保存或提交。</p>
            <p className="preserve">{preview?.intro}</p>
            {preview && (
              <Questionnaire
                key={JSON.stringify(preview)}
                form={preview}
                preview
              />
            )}
          </dialog>
        </>
      )}
    </section>
  );
}
