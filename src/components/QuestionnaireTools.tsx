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
import { questionTypeLabel, localizeManageMessage } from "@/lib/i18n/labels-manage";
import { useLocale, useT } from "./i18n/LocaleProvider";
import { Questionnaire } from "./Questionnaire";
import type {
  AILogic,
  GenerationProgress,
} from "@/lib/questionnaire-ai-contract";
import { readGeneration } from "@/lib/questionnaire-ai-client";
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
  const t = useT(),
    locale = useLocale();
  const dialog = useRef<HTMLDialogElement>(null),
    request = useRef<AbortController | null>(null),
    sourceTabs = useRef<HTMLDivElement>(null),
    titleId = useId();
  const [tab, setTab] = useState<"templates" | "import" | "ai">("templates");
  const [candidate, setCandidate] = useState<Candidate | null>(null),
    [tryFill, setTryFill] = useState(false),
    [mode, setMode] = useState<"replace" | "append">("replace");
  // i18n-exempt: "全部" is the internal all-categories filter value
  const [category, setCategory] = useState("全部"),
    [search, setSearch] = useState("");
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const [description, setDescription] = useState(""),
    [audience, setAudience] = useState(""),
    [logic, setLogic] = useState<AILogic>("auto"),
    [refinement, setRefinement] = useState("");
  const [progress, setProgress] = useState<GenerationProgress | null>(null),
    [elapsed, setElapsed] = useState(0);
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
          if (!r.ok) setError(data.error || t("AI 制作暂时不可用", "AI generation is unavailable right now"));
        }
      })
      .catch(() => {
        if (active) setError(t("无法检查 AI 服务，请稍后重试。", "Could not check the AI service. Please try again later."));
      });
    return () => {
      active = false;
    };
  }, [tab]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!pending) return;
    const started = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [pending]);
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
    setRefinement("");
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
  async function generate(improve = false) {
    if (pending) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    setElapsed(0);
    setProgress({
      stage: "generating",
      message: improve ? t("正在完善草稿…", "Refining the draft…") : t("正在准备制作…", "Preparing…"),
    });
    try {
      const res = await fetch("/api/questionnaires/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          description,
          audience,
          logic,
          ...(improve && candidate
            ? { draft: candidate.form, refinement }
            : {}),
        }),
        signal: controller.signal,
      });
      const data = await readGeneration(res, setProgress);
      preview(data.form, t("AI 生成草稿", "AI draft"), "ai");
    } catch (e) {
      setError(
        controller.signal.aborted
          ? t("已取消本次生成，制作需求和已有草稿已保留。", "Generation cancelled. Your request and existing draft are kept.")
          : (e as Error).message,
      );
    } finally {
      setPending(false);
      request.current = null;
    }
  }
  const templates = questionnaireTemplates.filter(
    (tpl) =>
      (category === "全部" || tpl.category === category) &&
      [tpl.title, tpl.description, ...tpl.tags].join(" ").includes(search.trim()),
  );
  const progressText = localizeManageMessage(progress?.message ?? "", locale);
  return (
    <>
      <div className="designer-starts" aria-label={t("选择制作方式", "Choose how to start")}>
        <button type="button" onClick={() => open("templates")}>
          <strong>{t("从模板开始", "Start from a template")}</strong>
          <small>{t("先预览完整题目，再选择应用", "Preview all questions before applying")}</small>
        </button>
        <button type="button" onClick={() => open("ai")}>
          <strong>{t("AI 制作问卷", "Build with AI")}</strong>
          <small>{t("描述需求，生成后检查题目与逻辑", "Describe your needs, then check the questions and logic")}</small>
        </button>
        <button type="button" onClick={() => open("import")}>
          <strong>{t("导入已有问卷", "Import a questionnaire")}</strong>
          <small>{t("导入文本或 JSON，检查后应用", "Import text or JSON, check, then apply")}</small>
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
          {t("导出问卷模板", "Export questionnaire template")}
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
            <h2 id={titleId}>
              {candidate
                ? candidate.label
                : tab === "templates"
                  ? t("模板库", "Template library")
                  : tab === "ai"
                    ? t("AI 制作问卷", "Build with AI")
                    : t("导入问卷", "Import questionnaire")}
            </h2>
          </div>
          <button type="button" onClick={close} aria-label={t("关闭制作窗口", "Close builder")}>
            {t("关闭", "Close")}
          </button>
        </div>
        <div
          ref={sourceTabs}
          className="designer-tabs"
          role="group"
          aria-label={t("内容来源", "Content source")}
        >
          {(
            [
              ["templates", t("模板库", "Templates")],
              ["ai", t("AI 制作", "AI")],
              ["import", t("批量导入", "Bulk import")],
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
              <h3>{candidate.form.title || t("导入的问卷", "Imported questionnaire")}</h3>
              <span>
                {t(
                  `${candidate.form.questions.length} 题 · ${candidate.form.questions.filter((q) => q.display || q.showWhen).length} 个条件显示 · ${candidate.form.questions.reduce((n, q) => n + (q.jumps?.length || 0), 0)} 个跳转`,
                  `${candidate.form.questions.length} questions · ${candidate.form.questions.filter((q) => q.display || q.showWhen).length} conditional · ${candidate.form.questions.reduce((n, q) => n + (q.jumps?.length || 0), 0)} jumps`,
                )}
              </span>
            </div>
            <p className="preserve">
              {candidate.form.intro || t("应用后可在问卷设置中补充说明。", "You can add an introduction in the settings after applying.")}
            </p>
            <div className="signup-tools">
              <button
                type="button"
                aria-pressed={!tryFill}
                onClick={() => setTryFill(false)}
              >
                {t("题目概览", "Question overview")}
              </button>
              <button
                type="button"
                aria-pressed={tryFill}
                onClick={() => setTryFill(true)}
              >
                {t("预览试填", "Try it out")}
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
                      {questionTypeLabel(q.type, locale)}
                      {q.required ? t(" · 必填", " · required") : t(" · 选填", " · optional")}
                      {q.jumps?.length ? t(` · ${q.jumps.length} 个跳转分支`, ` · ${q.jumps.length} jump branches`) : ""}
                    </span>
                    {q.options.length > 0 && (
                      <small>{q.options.join(" / ")}</small>
                    )}
                    {q.rows?.length && (
                      <small>{t("子题：", "Sub-questions: ")}{q.rows.join(" / ")}</small>
                    )}
                    {q.fields && (
                      <small>
                        {t("每条填写：", "Each entry: ")}{q.fields.map((f) => f.label).join(" / ")}
                        {t(`；${q.minEntries}–${q.maxEntries} 条记录`, `; ${q.minEntries}–${q.maxEntries} entries`)}
                      </small>
                    )}
                    {q.display && (
                      <small>
                        {t("显示条件：", "Shown when: ")}
                        {q.display.rules
                          .map(
                            (r) =>
                              // i18n-exempt: inner strings are t() pairs
                              `${candidate.form.questions.find((source) => source.id === r.questionId)?.label} ${r.operator === "equals" ? t("为", "is") : r.operator} ${r.value}`,
                          )
                          .join(q.display.mode === "all" ? t("，且 ", ", and ") : t("，或 ", ", or "))}
                      </small>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {candidate.source === "ai" && (
              <div className="ai-refinement">
                <label>
                  {t("修改要求", "Changes requested")}
                  <textarea
                    aria-label={t("修改要求", "Changes requested")}
                    rows={3}
                    maxLength={2000}
                    value={refinement}
                    disabled={pending}
                    onChange={(e) => setRefinement(e.target.value)}
                    placeholder={t("例如：增加队长联系方式，把游戏位置改为下拉选择，保留个人与团队报名分支。", "e.g. Add the captain's contact, make game position a dropdown, keep the individual and team branches.")}
                  />
                </label>
                <small>
                  {t("AI 将收到制作需求、这份草稿及修改要求，生成后仍需试填与保存。", "The AI receives your request, this draft and the changes. Try it out and save afterwards.")}
                </small>
                <div className="signup-tools">
                  <button
                    type="button"
                    disabled={pending || refinement.trim().length < 5}
                    onClick={() => generate(true)}
                  >
                    {t("按要求完善草稿", "Refine the draft")}
                  </button>
                  {pending && (
                    <button
                      type="button"
                      onClick={() => request.current?.abort()}
                    >
                      {t("取消本次生成", "Cancel generation")}
                    </button>
                  )}
                </div>
                {pending && (
                  <p role="status">
                    {t(`${progressText} 已等待 ${elapsed} 秒。`, `${progressText} Waited ${elapsed}s.`)}
                  </p>
                )}
              </div>
            )}
            <div className="blueprint-apply">
              <fieldset>
                <legend>{t("应用方式", "How to apply")}</legend>
                <label className="signup-choice">
                  <input
                    type="radio"
                    disabled={pending}
                    name={`${titleId}-mode`}
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                  />
                  {t("替换问卷内容（题目、标题、说明及样式）", "Replace the questionnaire (questions, title, intro and style)")}
                </label>
                <label className="signup-choice">
                  <input
                    type="radio"
                    disabled={pending}
                    name={`${titleId}-mode`}
                    checked={mode === "append"}
                    onChange={() => setMode("append")}
                  />
                  {t("追加题目（保留当前内容与设置）", "Append questions (keep current content and settings)")}
                </label>
              </fieldset>
              <p>
                {mode === "replace" && value.questions.length
                  ? t(
                      `当前 ${value.questions.length} 道题将替换为 ${candidate.form.questions.length} 道题。应用后可以撤销。`,
                      `The current ${value.questions.length} questions will be replaced with ${candidate.form.questions.length}. You can undo after applying.`,
                    )
                  : t(
                      `应用后共 ${mode === "append" ? value.questions.length + candidate.form.questions.length : candidate.form.questions.length} 道题。`,
                      `${mode === "append" ? value.questions.length + candidate.form.questions.length : candidate.form.questions.length} questions after applying.`,
                    )}{" "}
                {t("接收状态和报名时间保持当前设置。", "Open status and sign-up times stay as they are.")}
              </p>
              <div className="signup-tools">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setCandidate(null);
                    setTryFill(false);
                    sourceTabs.current
                      ?.querySelector<HTMLButtonElement>(
                        'button[aria-pressed="true"]',
                      )
                      ?.focus();
                  }}
                >
                  {candidate.source === "template"
                    ? t("返回模板列表", "Back to templates")
                    : t("返回制作需求", "Back to request")}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={apply}
                  disabled={pending}
                >
                  {mode === "replace" ? t("替换并进入编辑", "Replace and edit") : t("追加并进入编辑", "Append and edit")}
                </button>
              </div>
            </div>
          </div>
        ) : tab === "templates" ? (
          <>
            <p>{t("选择贴近需求的问卷。查看题目、试填流程，再决定如何应用。", "Pick a questionnaire close to your needs. Review the questions and try it out before deciding how to apply it.")}</p>
            <div className="template-filters">
              <label>
                {t("搜索模板", "Search templates")}
                <input
                  value={search}
                  placeholder={t("搜索名称、场景或题型", "Search name, scenario or question type")}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                {t("场景", "Scenario")}
                <select
                  aria-label={t("场景", "Scenario")}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {[
                    // i18n-exempt: "全部" is the internal all-categories filter value
                    "全部",
                    ...new Set(questionnaireTemplates.map((tpl) => tpl.category)),
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c === "全部" ? t("全部", "All") : c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="template-grid">
              {templates.map((tpl) => (
                <article key={tpl.id} className="template-card">
                  <small>{tpl.category}</small>
                  <h3>{tpl.title}</h3>
                  <p>{tpl.description}</p>
                  <div className="template-tags">
                    {tpl.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <small>
                    {t(
                      `${tpl.form.questions.length} 题 · 约 ${tpl.minutes} 分钟 · `,
                      `${tpl.form.questions.length} questions · about ${tpl.minutes} min · `,
                    )}
                    {tpl.audience}
                  </small>
                  <button
                    type="button"
                    onClick={() =>
                      preview(tpl.form, t(tpl.title + "模板", `${tpl.title} template`), "template")
                    }
                  >
                    {t(`预览「${tpl.title}」`, `Preview “${tpl.title}”`)}
                  </button>
                </article>
              ))}
            </div>
            {!templates.length && (
              <p role="status">{t("没有找到匹配模板，请调整搜索条件。", "No matching templates. Adjust your search.")}</p>
            )}
          </>
        ) : tab === "ai" ? (
          <div className="ai-questionnaire-form">
            <p>
              {t(
                "描述目标、填写对象和需要了解的信息，AI 会整理成题目与选项。生成结果可以先试填，再进入编辑。",
                "Describe the goal, the audience and what you need to learn; the AI turns it into questions and options. Try the result before editing.",
              )}
            </p>
            <span className="ai-model-label">DeepSeek-V4.1-Flash</span>
            <div className="ai-examples" aria-label={t("制作需求示例", "Example requests")}>
              {[
                [
                  t("比赛报名", "Tournament sign-up"),
                  // i18n-exempt: example request content sent to the AI service
                  "制作一份校园团队比赛报名问卷，分个人与团队报名。收集姓名、学号、游戏ID、擅长位置和联系人信息。团队名单包含队长，至少5人、最多6人，每个人的信息都需要完整填写。",
                ],
                [
                  t("活动反馈", "Event feedback"),
                  // i18n-exempt: example request content sent to the AI service
                  "制作一份活动反馈问卷，了解整体满意度、内容安排、组织体验与改进建议。没有参加的人只回答未参加原因，参加者回答评分及开放建议，避免重复问题。",
                ],
                [
                  t("志愿者招募", "Volunteer recruitment"),
                  // i18n-exempt: example request content sent to the AI service
                  "制作一份志愿者意向问卷，收集联系方式、可参与时段、任务偏好及相关经验。有经验者补充经历，无经验者跳过经历题，不编造活动日期。",
                ],
              ].map(([label, example]) => (
                <button
                  key={label}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setDescription(example);
                    setLogic("auto");
                    setError("");
                  }}
                >
                  {t(`使用${label}示例`, `Use the ${label} example`)}
                </button>
              ))}
            </div>
            <label>
              {t("制作需求", "Request")}
              <textarea
                aria-label={t("制作需求", "Request")}
                rows={6}
                value={description}
                minLength={10}
                maxLength={4000}
                disabled={pending}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("例如：为校园交流活动制作反馈问卷，了解内容安排、组织体验和改进建议。希望有评分、矩阵和开放建议题，语言简洁中立。", "e.g. A feedback questionnaire for a campus event covering content, organization and suggestions, with ratings, a matrix and open-ended questions in neutral language.")}
              />
              <small>{t(`${description.length} / 4000 字`, `${description.length} / 4000 characters`)}</small>
            </label>
            <div className="signup-times">
              <label>
                {t("填写对象", "Audience")}
                <input
                  value={audience}
                  maxLength={200}
                  disabled={pending}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder={t("选填，AI 可从制作需求判断", "Optional; the AI can infer it from the request")}
                />
              </label>
            </div>
            <label>
              {t("填写分支", "Branching")}
              <select
                value={logic === "auto" ? "auto" : String(logic)}
                disabled={pending}
                onChange={(e) =>
                  setLogic(
                    e.target.value === "auto"
                      ? "auto"
                      : e.target.value === "true",
                  )
                }
              >
                <option value="auto">{t("按需求自动判断（推荐）", "Decide from the request (recommended)")}</option>
                <option value="true">{t("设计条件显示与跳转", "Design conditions and jumps")}</option>
                <option value="false">{t("全部按顺序作答", "All questions in order")}</option>
              </select>
              <small>
                {t(
                  "分类报名会自动设计分支；多人名单可设置每人的字段和人数上限。题目数量由 AI 根据需求安排。",
                  "Category-based sign-ups get branches automatically; member lists can set per-person fields and size limits. The AI decides the number of questions.",
                )}
              </small>
            </label>
            <p className="muted">
              {t(
                "需求将交给 AI 服务处理，请使用通用描述。每个管理账号每小时最多制作 6 次。",
                "Requests are processed by an AI service, so keep them general. Each manager account can generate up to 6 times per hour.",
              )}
            </p>
            {capability === false && (
              <p role="status">
                {t("AI 制作暂未开通或当前账号无使用权限，可以先使用模板。", "AI generation is not enabled or this account lacks permission. Use a template for now.")}
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
                onClick={() => generate()}
              >
                {pending ? t("正在生成题目与逻辑…", "Generating questions and logic…") : t("生成问卷草稿", "Generate draft")}
              </button>
              {pending && (
                <button type="button" onClick={() => request.current?.abort()}>
                  {t("取消本次生成", "Cancel generation")}
                </button>
              )}
            </div>
            <p role="status">
              {pending
                ? t(
                    `${progressText} 已等待 ${elapsed} 秒。可以取消，现有问卷会保留。`,
                    `${progressText} Waited ${elapsed}s. You can cancel; the current questionnaire is kept.`,
                  )
                : t(
                    "生成后会自动检查题目、人数限制与分支；发现格式问题会在本次制作中尝试修复。请预览各个填写路径后应用。",
                    "The result is checked for questions, size limits and branches, and format issues are repaired automatically. Preview each path before applying.",
                  )}
            </p>
          </div>
        ) : (
          <div className="questionnaire-import-form">
            <p>
              {t(
                "导入后先检查题目和选项，再替换或追加到编辑器。JSON 可还原标题、说明、样式和跳转。",
                "Check questions and options after importing, then replace or append them in the editor. JSON restores the title, intro, style and jumps.",
              )}
            </p>
            <label>
              {t("批量题目文本", "Question text")}
              <textarea
                rows={9}
                value={text}
                maxLength={100000}
                onChange={(e) => setText(e.target.value)}
                placeholder={t(
                  "[单选]参与方式*\n- 参与者\n- 观众\n[多行文本]其他建议",
                  // i18n-exempt: import syntax requires Chinese type names
                  "[单选]Participation*\n- Player\n- Spectator\n[多行文本]Other suggestions",
                )}
              />
            </label>
            {/* i18n-exempt: import syntax requires Chinese type names */}
            <small>{t("[题型]标题 开始一题，* 表示必填；- 选项；> 子题。", "[type]Title starts a question (type names in Chinese, e.g. [单选]); * marks required; - option; > sub-question.")}</small>
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
                    t("文本导入预览", "Text import preview"),
                    "import",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {t("检查并预览文本", "Check and preview text")}
            </button>
            <label>
              {t("导入 JSON 模板", "Import JSON template")}
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 200000) {
                    setError(t("模板文件最多 200 KB", "Template files are limited to 200 KB"));
                    return;
                  }
                  try {
                    preview(
                      normalizeSignup(JSON.parse(await file.text())),
                      t("JSON 导入预览", "JSON import preview"),
                      "import",
                    );
                  } catch (e) {
                    setError(
                      e instanceof SyntaxError
                        ? t("文件不是有效的 JSON，请检查格式。", "The file is not valid JSON. Check the format.")
                        : (e as Error).message,
                    );
                  }
                }}
              />
            </label>
          </div>
        )}
        <p className="questionnaire-error" role="alert">
          {localizeManageMessage(error, locale)}
        </p>
      </dialog>
      {error && !dialog.current?.open && (
        <p className="questionnaire-error" role="alert">
          {localizeManageMessage(error, locale)}
        </p>
      )}
    </>
  );
}
