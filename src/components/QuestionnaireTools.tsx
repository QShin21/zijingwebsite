"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  emptySignup,
  normalizeSignup,
  type SignupForm,
} from "@/lib/signup-schema";
import { downloadText, parseQuestionText } from "@/lib/questionnaire-import";
import {
  applyBlueprint,
  questionnaireTemplates,
} from "@/lib/questionnaire-templates";
import { questionTypes } from "@/lib/questionnaire-model";
import { Questionnaire } from "./Questionnaire";
type Candidate = {
  form: SignupForm;
  label: string;
  source: "template" | "import" | "ai";
};
export function QuestionnaireTools({
  value,
  onChange,
}: {
  value: SignupForm;
  onChange: (value: SignupForm) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    request = useRef<AbortController | null>(null),
    titleId = useId();
  const [tab, setTab] = useState<"templates" | "import" | "ai">("templates");
  const [candidate, setCandidate] = useState<Candidate | null>(null),
    [tryFill, setTryFill] = useState(false),
    [mode, setMode] = useState<"replace" | "append">("replace");
  const [category, setCategory] = useState("全部"),
    [search, setSearch] = useState("");
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const [description, setDescription] = useState(""),
    [audience, setAudience] = useState(""),
    [count, setCount] = useState(8),
    [logic, setLogic] = useState(false);
  const [pending, setPending] = useState(false),
    [capability, setCapability] = useState<boolean | null>(null);
  useEffect(() => {
    if (tab !== "ai") return;
    let active = true;
    fetch("/api/questionnaires/generate", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (active) {
          setCapability(r.ok && data.enabled);
          if (!r.ok) setError(data.error || "AI 制作暂时不可用");
        }
      })
      .catch(() => {
        if (active) setError("无法检查 AI 服务，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [tab]);
  useEffect(() => () => request.current?.abort(), []);
  function open(next: typeof tab) {
    setTab(next);
    setError("");
    setCandidate(null);
    setTryFill(false);
    dialog.current?.showModal();
  }
  function close() {
    request.current?.abort();
    dialog.current?.close();
  }
  function preview(
    form: SignupForm,
    label: string,
    source: Candidate["source"],
  ) {
    setCandidate({ form: normalizeSignup(form), label, source });
    setTryFill(false);
    setError("");
    setMode("replace");
  }
  function apply() {
    if (!candidate) return;
    try {
      onChange(applyBlueprint(value, candidate.form, mode));
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function generate() {
    if (pending) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/questionnaires/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, audience, count, logic }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 制作未完成，请重试。");
      preview(data.form, "AI 生成草稿", "ai");
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  const templates = questionnaireTemplates.filter(
    (t) =>
      (category === "全部" || t.category === category) &&
      [t.title, t.description, ...t.tags].join(" ").includes(search.trim()),
  );
  return (
    <>
      <div className="designer-starts" aria-label="选择制作方式">
        <button type="button" onClick={() => open("templates")}>
          <span className="start-icon" aria-hidden="true">
            ▦
          </span>
          <strong>从模板开始</strong>
          <small>8 个场景 · 先预览再应用</small>
        </button>
        <button type="button" onClick={() => open("ai")}>
          <span className="start-icon" aria-hidden="true">
            ✦
          </span>
          <strong>AI 制作问卷</strong>
          <small>描述需求 · 生成可编辑草稿</small>
        </button>
        <button type="button" onClick={() => open("import")}>
          <span className="start-icon" aria-hidden="true">
            ↥
          </span>
          <strong>导入已有问卷</strong>
          <small>文本或 JSON · 检查后应用</small>
        </button>
      </div>
      <div className="designer-export">
        <button
          type="button"
          disabled={!value.questions.length}
          onClick={() => {
            try {
              downloadText(
                "questionnaire-template.json",
                JSON.stringify(normalizeSignup(value), null, 2),
              );
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          导出问卷模板
        </button>
      </div>
      <dialog
        ref={dialog}
        className="questionnaire-starter-dialog"
        aria-labelledby={titleId}
        onClose={() => request.current?.abort()}
      >
        <div className="dialog-top">
          <div>
            <small className="designer-eyebrow">创建问卷内容</small>
            <h2 id={titleId}>
              {candidate
                ? candidate.label
                : tab === "templates"
                  ? "模板库"
                  : tab === "ai"
                    ? "AI 制作问卷"
                    : "导入问卷"}
            </h2>
          </div>
          <button type="button" onClick={close} aria-label="关闭制作窗口">
            关闭
          </button>
        </div>
        <div className="designer-tabs" role="group" aria-label="内容来源">
          {(
            [
              ["templates", "模板库"],
              ["ai", "AI 制作"],
              ["import", "批量导入"],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              disabled={pending}
              aria-pressed={tab === key}
              onClick={() => {
                setTab(key);
                setCandidate(null);
                setError("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {candidate ? (
          <div className="blueprint-preview">
            <div className="blueprint-heading">
              <h3>{candidate.form.title || "导入的问卷"}</h3>
              <span>{candidate.form.questions.length} 题</span>
            </div>
            <p className="preserve">
              {candidate.form.intro || "应用后可在问卷设置中补充说明。"}
            </p>
            <div className="signup-tools">
              <button
                type="button"
                aria-pressed={!tryFill}
                onClick={() => setTryFill(false)}
              >
                题目概览
              </button>
              <button
                type="button"
                aria-pressed={tryFill}
                onClick={() => setTryFill(true)}
              >
                预览试填
              </button>
            </div>
            {tryFill ? (
              <Questionnaire
                key={JSON.stringify(candidate.form)}
                form={candidate.form}
                preview
              />
            ) : (
              <ol className="blueprint-questions">
                {candidate.form.questions.map((q) => (
                  <li key={q.id}>
                    <strong>{q.label}</strong>
                    <span>
                      {questionTypes[q.type]}
                      {q.required ? " · 必填" : " · 选填"}
                      {q.jumps?.length ? ` · ${q.jumps.length} 个跳转分支` : ""}
                    </span>
                    {q.options.length > 0 && (
                      <small>{q.options.join(" / ")}</small>
                    )}
                    {q.rows?.length && (
                      <small>子题：{q.rows.join(" / ")}</small>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div className="blueprint-apply">
              <fieldset>
                <legend>应用方式</legend>
                <label className="signup-choice">
                  <input
                    type="radio"
                    name={`${titleId}-mode`}
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                  />
                  替换问卷内容（题目、标题、说明及样式）
                </label>
                <label className="signup-choice">
                  <input
                    type="radio"
                    name={`${titleId}-mode`}
                    checked={mode === "append"}
                    onChange={() => setMode("append")}
                  />
                  追加题目（保留当前内容与设置）
                </label>
              </fieldset>
              <p>
                {mode === "replace" && value.questions.length
                  ? `当前 ${value.questions.length} 道题将替换为 ${candidate.form.questions.length} 道题。应用后可以撤销。`
                  : `应用后共 ${mode === "append" ? value.questions.length + candidate.form.questions.length : candidate.form.questions.length} 道题。`}{" "}
                接收状态和报名时间保持当前设置。
              </p>
              <div className="signup-tools">
                <button
                  type="button"
                  onClick={() => {
                    setCandidate(null);
                    setTryFill(false);
                  }}
                >
                  返回
                  {candidate.source === "template" ? "模板列表" : "制作需求"}
                </button>
                <button type="button" className="button" onClick={apply}>
                  {mode === "replace" ? "替换并进入编辑" : "追加并进入编辑"}
                </button>
              </div>
            </div>
          </div>
        ) : tab === "templates" ? (
          <>
            <p>选择贴近需求的问卷。查看题目、试填流程，再决定如何应用。</p>
            <div className="template-filters">
              <label>
                搜索模板
                <input
                  value={search}
                  placeholder="搜索名称、场景或题型"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                场景
                <select
                  aria-label="场景"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {[
                    "全部",
                    ...new Set(questionnaireTemplates.map((t) => t.category)),
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="template-grid">
              {templates.map((t) => (
                <article key={t.id} className="template-card">
                  <small>{t.category}</small>
                  <h3>{t.title}</h3>
                  <p>{t.description}</p>
                  <div className="template-tags">
                    {t.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <small>
                    {t.form.questions.length} 题 · 约 {t.minutes} 分钟 ·{" "}
                    {t.audience}
                  </small>
                  <button
                    type="button"
                    onClick={() =>
                      preview(t.form, t.title + "模板", "template")
                    }
                  >
                    预览「{t.title}」
                  </button>
                </article>
              ))}
            </div>
            {!templates.length && (
              <p role="status">没有找到匹配模板，请调整搜索条件。</p>
            )}
          </>
        ) : tab === "ai" ? (
          <div className="ai-questionnaire-form">
            <p>
              描述目标、填写对象和需要了解的信息，AI
              会整理成题目与选项。生成结果可以先试填，再进入编辑。
            </p>
            <span className="ai-model-label">DeepSeek-V4.1-Flash</span>
            <label>
              制作需求
              <textarea
                aria-label="制作需求"
                rows={6}
                value={description}
                minLength={10}
                maxLength={4000}
                disabled={pending}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：为校园交流活动制作反馈问卷，了解内容安排、组织体验和改进建议。希望有评分、矩阵和开放建议题，语言简洁中立。"
              />
              <small>{description.length} / 4000 字</small>
            </label>
            <div className="signup-times">
              <label>
                填写对象
                <input
                  value={audience}
                  maxLength={200}
                  disabled={pending}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="例如：参加活动的成员"
                />
              </label>
              <label>
                作答题数
                <select
                  value={count}
                  disabled={pending}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {[3, 5, 8, 10, 15, 20, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} 道题
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="signup-choice">
              <input
                type="checkbox"
                checked={logic}
                disabled={pending}
                onChange={(e) => setLogic(e.target.checked)}
              />
              按需求设计条件显示与跳转
            </label>
            <p className="muted">
              需求将交给 AI 服务处理，请使用通用描述。每个管理账号每小时最多制作
              6 次。
            </p>
            {capability === false && (
              <p role="status">
                AI 制作暂未开通或当前账号无使用权限，可以先使用模板。
              </p>
            )}
            <div className="signup-tools">
              <button
                type="button"
                className="button"
                disabled={
                  pending ||
                  capability === false ||
                  description.trim().length < 10
                }
                onClick={generate}
              >
                {pending ? "正在生成题目与逻辑…" : "生成问卷草稿"}
              </button>
              {pending && (
                <button type="button" onClick={() => request.current?.abort()}>
                  取消本次生成
                </button>
              )}
            </div>
            <p role="status">
              {pending
                ? "通常需要几十秒。生成期间请保持此窗口打开。"
                : "草稿通过题目与逻辑检查后会显示在这里。"}
            </p>
          </div>
        ) : (
          <div className="questionnaire-import-form">
            <p>
              导入后先检查题目和选项，再替换或追加到编辑器。JSON
              可还原标题、说明、样式和跳转。
            </p>
            <label>
              批量题目文本
              <textarea
                rows={9}
                value={text}
                maxLength={100000}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  "[单选]参与方式*\n- 参与者\n- 观众\n[多行文本]其他建议"
                }
              />
            </label>
            <small>[题型]标题 开始一题，* 表示必填；- 选项；&gt; 子题。</small>
            <button
              type="button"
              disabled={!text.trim()}
              onClick={() => {
                try {
                  preview(
                    {
                      ...emptySignup,
                      enabled: true,
                      questions: parseQuestionText(text),
                    },
                    "文本导入预览",
                    "import",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              检查并预览文本
            </button>
            <label>
              导入 JSON 模板
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 200000) {
                    setError("模板文件最多 200 KB");
                    return;
                  }
                  try {
                    preview(
                      normalizeSignup(JSON.parse(await file.text())),
                      "JSON 导入预览",
                      "import",
                    );
                  } catch (e) {
                    setError(
                      e instanceof SyntaxError
                        ? "文件不是有效的 JSON，请检查格式。"
                        : (e as Error).message,
                    );
                  }
                }}
              />
            </label>
          </div>
        )}
        <p className="questionnaire-error" role="alert">
          {error}
        </p>
      </dialog>
      {error && !dialog.current?.open && (
        <p className="questionnaire-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
