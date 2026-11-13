"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { SignupForm, Question, Answers } from "@/lib/signup-schema";
import { QuestionnaireResults } from "./QuestionnaireResults";
import { QuestionnaireLottery } from "./QuestionnaireLottery";
import { SignupBuilder } from "./SignupBuilder";
import { formatAnswer } from "@/lib/questionnaire-model";
import { formatDate } from "@/lib/rules";
import { Questionnaire } from "./Questionnaire";
import { PublicationImages } from "./PublicationImages";
import { publicationImageInput } from "@/lib/publication-images";
import type { PublicationImage } from "@/lib/publication-images";
import styles from "./activity-pages/ApplicationFlow.module.css";
import { SubmissionSteps } from "./activity-pages/SubmissionSteps";
import { activityRequest } from "./activity-pages/client-request";
import pageStyles from "./activity-pages/ActivityPages.module.css";
import workStyles from "./activity-pages/QuestionnaireSurface.module.css";
import workspace from "./activity-pages/Workspace.module.css";
import { PageHero, StatusPill, Wrap } from "./v2/ui";
import { QuestionTextProvider, useLocale, useQuestionText, useT } from "./i18n/LocaleProvider";
import { formatDateTime } from "@/lib/i18n/locale";
import { localizeMessage } from "@/lib/i18n/messages";
import type { FormDisplay } from "@/lib/questionnaire-display";
import layout from "./v2/layout.module.css";

/** V2 body spacing for the manager/signups workspace below its stage hero. */
const managerBody = layout.pageBody;
type Receipt = {
  id: number;
  createdAt: string;
  updatedAt: string;
  formVersion: string;
  memberName?: string;
  lotteryStatus?: string;
  questions: Question[];
  answers: Answers;
};
type Info = {
  title: string;
  form: SignupForm;
  images?: PublicationImage[];
  imageRevision?: string;
  version: string;
  state: string;
  canManage: boolean;
  canViewSignups: boolean;
  canExportSignups: boolean;
  loggedIn: boolean;
  draftKey?: string;
  signup: Receipt | null;
  /** English labels for the published form (English mode only); `form` stays canonical. */
  display?: FormDisplay;
};
/** Dates in the reader's language; Chinese keeps the original formatter. */
function useWhen() {
  const locale = useLocale();
  return (value?: string | null) => (locale === "en" ? formatDateTime(value, "en") || "TBA" : formatDate(value));
}
export async function signupRequest(
  url: string,
  method = "GET",
  data?: unknown,
) {
  return activityRequest(url, method, data);
}
function signupImageRequest(url: string, method = "GET", data?: unknown) {
  return activityRequest(url, method, data, { "X-Questionnaire-Images": "1" });
}
function ReceiptView({ receipt, current = [] }: { receipt: Receipt; current?: Question[] }) {
  const t = useT(),
    when = useWhen(),
    text = useQuestionText();
  // Receipts keep the questions as submitted. English labels apply only where the
  // submitted question still matches the published one; otherwise the original shows.
  const published = (q: Question) => {
    const match = current.find((item) => item.id === q.id);
    return match && match.label === q.label && match.type === q.type ? match : null;
  };
  return (
    <div>
      <div className={styles.receiptMeta}>
        <p>{t(`报名编号 ${receipt.id}`, `Sign-up no. ${receipt.id}`)}</p>
        <p>{t(`提交于 ${formatDate(receipt.createdAt)}`, `Submitted ${when(receipt.createdAt)}`)}</p>
        {receipt.updatedAt !== receipt.createdAt && (
          <p>{t(`最近修改 ${formatDate(receipt.updatedAt)}`, `Last edited ${when(receipt.updatedAt)}`)}</p>
        )}
      </div>
      <dl className={styles.receiptAnswers}>
        {receipt.questions
          .filter((q) => Object.hasOwn(receipt.answers, q.id))
          .map((q) => {
            const match = text.locale === "en" ? published(q) : null;
            return (
              <div key={q.id}>
                <dt>{match ? text.label(match) : q.label}</dt>
                <dd>{match ? text.answer(receipt.answers[q.id], match) : formatAnswer(receipt.answers[q.id], q)}</dd>
              </div>
            );
          })}
      </dl>
    </div>
  );
}
export function ActivitySignup({
  kind,
  id,
  compact = false,
}: {
  kind: string;
  id: number;
  compact?: boolean;
}) {
  const endpoint = `/api/activities/${kind}/${id}/signup`,
    [info, setInfo] = useState<Info | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [verifiedReceipt, setVerifiedReceipt] = useState<Receipt | null>(null),
    [savedMessage, setSavedMessage] = useState(""),
    [retry, setRetry] = useState(0);
  const reloadHelp = useId(),
    writeLock = useRef(false);
  const t = useT(),
    locale = useLocale(),
    when = useWhen(),
    say = (value: string) => localizeMessage(value, locale);
  useEffect(() => {
    let alive = true;
    signupImageRequest(endpoint)
      .then((value) => {
        if (alive) {
          setInfo(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (alive) setError(cause.message);
      });
    return () => {
      alive = false;
    };
  }, [endpoint, retry]);
  if (!info)
    return (
      <section
        className={`${styles.flow} ${compact ? styles.compact : ""}`}
        aria-busy={!error}
        aria-label={t("活动报名", "Activity sign-up")}
      >
        {error ? (
          <>
            <h2>{t("报名信息暂时无法加载", "Sign-up information could not be loaded")}</h2>
            <p className={styles.error} role="alert">
              {say(error)}
            </p>
            <button
              type="button"
              onClick={() => {
                setError("");
                setRetry(retry + 1);
              }}
            >
              {t("重试", "Retry")}
            </button>
          </>
        ) : (
          <div className={styles.loading}>
            <p role="status">{t("正在加载报名信息…", "Loading sign-up information…")}</p>
            <div className={styles.loadingLine} aria-hidden="true" />
            <div className={styles.loadingLine} aria-hidden="true" />
          </div>
        )}
      </section>
    );
  if (
    !info.form.enabled &&
    !info.canManage &&
    !info.canViewSignups &&
    !info.signup
  )
    return null;
  async function verifyReceipt() {
    if (busy) return;
    setBusy(true);
    try {
      const latest = await signupImageRequest(endpoint);
      if (editing) {
        // A GET for verification never advances the revision of local, unsaved answers.
        setVerifiedReceipt(latest.signup);
        setSavedMessage(
          latest.signup
            ? t("已核对服务器保存的本人回执，当前修改仍保留。", "Checked your saved receipt on the server. Your current edits are kept.")
            : t("当前未查到已保存的本人回执。当前修改仍保留，请核对后再提交。", "No saved receipt was found. Your current edits are kept; check them before submitting."),
        );
      } else if (latest.signup) {
        setInfo(latest);
        setEditing(false);
        setSavedMessage(t("已读取服务器保存的本人回执。", "Loaded your saved receipt from the server."));
      } else
        setSavedMessage(
          t("当前未查到已保存的本人回执。已填写内容保留，请核对后再提交。", "No saved receipt was found. Your answers are kept; check them before submitting."),
        );
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const display = locale === "en" ? info.display : undefined;
  const formTitle = display?.title || info.form.title,
    formIntro = display?.intro || info.form.intro,
    formDone = display?.completionMessage || info.form.completionMessage;
  return (
    <QuestionTextProvider display={display}>
    <section
      className={`activity-signup ${styles.flow} ${compact ? styles.compact : ""}`}
      aria-busy={busy}
    >
      <header className={styles.header}>
        <div>
          {!compact && <p className={styles.kicker}>{info.title}</p>}
          <h2>
            {info.signup && !editing
              ? t("我的报名回执", "My sign-up receipt")
              : formTitle || t("活动报名", "Activity sign-up")}
          </h2>
        </div>
        <span className={styles.state} data-open={info.state === "报名开放"}>
          {say(info.state)}
        </span>
      </header>
      {!compact && (
        <div className={styles.utilityBar}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void verifyReceipt()}
          >
            {t("刷新报名状态与本人回执", "Refresh status and my receipt")}
          </button>
          <Link href="/account">{t("我的事务", "My tasks")}</Link>
        </div>
      )}
      {/* Compact panels sit beside the V2 event detail, whose server-rendered 活动管理 panel already links here. */}
      {!compact && (info.canManage || info.canViewSignups) && (
        <div className={styles.actions}>
          {info.canManage && (
            <Link href={`/activities/${kind}/${id}/manage`}>{t("管理报名问卷", "Manage questionnaire")}</Link>
          )}
          {info.canViewSignups && (
            <Link href={`/activities/${kind}/${id}/signups`}>
              {t("查看报名与统计", "Sign-ups and statistics")}
            </Link>
          )}
        </div>
      )}
      {savedMessage && (
        <p className={styles.feedback} role="status">
          {say(savedMessage)}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {say(error)}
        </p>
      )}
      {info.signup && !editing ? (
        <>
          {!compact && <SubmissionSteps current="receipt" />}
          <div className={styles.receipt}>
            <div className={styles.receiptHead}>
              <h3 aria-live="polite">{t("已报名", "Signed up")}</h3>
              <span className={styles.receiptStatus} data-success="true">
                {t("已保存本人记录", "Your record is saved")}
              </span>
            </div>
            <p>{formDone || t("已收到你的报名信息。", "We have received your sign-up.")}</p>
            <ReceiptView receipt={info.signup} current={info.form.questions} />
          </div>
          {compact ? (
            <Link className="button" href={`/activities/${kind}/${id}/fill`}>
              {t(`查看本人回执${info.state === "报名开放" ? "与修改作答" : ""}`, info.state === "报名开放" ? "View or edit my answers" : "View my receipt")}
            </Link>
          ) : info.state === "报名开放" && info.loggedIn ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                setEditing(true);
                setVerifiedReceipt(null);
                setSavedMessage("");
              }}
            >
              {t("修改作答", "Edit answers")}
            </button>
          ) : (
            <p className="muted">{t(`${info.state}，暂不能修改作答。`, `${say(info.state)}. Answers cannot be edited now.`)}</p>
          )}
        </>
      ) : (
        <>
          <div className={styles.taskContext}>
            <div>
              {formIntro && <p className="preserve">{formIntro}</p>}
              <PublicationImages images={info.images?.filter((image) => !image.questionId)} />
            </div>
            {(info.form.start || info.form.end) && (
              <dl>
                {info.form.start && (
                  <div>
                    <dt>{t("问卷开放", "Opens")}</dt>
                    <dd>{when(info.form.start)}</dd>
                  </div>
                )}
                {info.form.end && (
                  <div>
                    <dt>{t("问卷截止", "Closes")}</dt>
                    <dd>{when(info.form.end)}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
          {editing && (
            <>
              <div className={styles.editingHeader}>
                <h3>{t("修改作答", "Edit answers")}</h3>
                <p>{t("已带入上次提交的内容。提交成功前，原作答仍然保留。", "Your last submission is filled in. The original answers stay until the edit is submitted.")}</p>
                {info.signup?.formVersion !== info.version && (
                  <p role="status">
                    {t("问卷已更新，请检查保留的答案并补充新题目。", "The questionnaire has changed. Check your kept answers and complete new questions.")}
                  </p>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  {t("取消修改", "Cancel edit")}
                </button>
              </div>
              <details className={styles.recovery}>
                <summary>{t("核对结果或重新载入已提交内容", "Check the result or reload your submission")}</summary>
                <p id={reloadHelp}>
                  {t(
                    "“重新加载已提交内容”会放弃当前未提交的修改，并载入最新问卷与已保存回执。仅核对结果请使用上方“刷新报名状态与本人回执”。",
                    "“Reload submission” discards unsubmitted edits and loads the latest questionnaire and your saved receipt. To only check the result, use “Refresh status and my receipt” above.",
                  )}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  aria-describedby={reloadHelp}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      setInfo(await signupImageRequest(endpoint));
                      setEditing(false);
                      setSavedMessage(
                        t("已重新加载上次提交的内容，可再次进入修改。", "Reloaded your last submission. You can edit it again."),
                      );
                      setError("");
                    } catch (cause) {
                      setError((cause as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("重新加载已提交内容", "Reload submission")}
                </button>
              </details>
              {verifiedReceipt && (
                <section
                  className={styles.receipt}
                  aria-label={t("服务器保存的本人回执", "Your receipt saved on the server")}
                >
                  <h4>{t("服务器保存的本人回执", "Your receipt saved on the server")}</h4>
                  <p>{t("以下内容仅供核对，当前未提交的修改仍保留在下方问卷中。", "For checking only; your unsubmitted edits remain in the questionnaire below.")}</p>
                  <ReceiptView receipt={verifiedReceipt} current={info.form.questions} />
                </section>
              )}
            </>
          )}
          {locale === "en" ? (
            <p className={styles.notice}>
              Your answers are visible only to you and authorized activity organizers, and are used to run this activity.
              Sign-up data is kept for 1 year; to request deletion, follow the <Link href="/privacy">privacy notice</Link>.
            </p>
          ) : (
            <p className={styles.notice}>
              答案仅供你本人和有权限的活动管理者查看，用于本次活动组织。报名资料保留
              1 年；如需删除，请按<Link href="/privacy">隐私说明</Link>
              联系人工处理。
            </p>
          )}
          {info.form.enabled &&
            info.state === "报名开放" &&
            (!info.loggedIn ? (
              <Link
                className="button"
                href={`/login?returnTo=${encodeURIComponent(`/activities/${kind}/${id}/fill`)}`}
              >
                {t("登录后填写报名", "Sign in to fill in")}
              </Link>
            ) : compact ? (
              <Link className="button" href={`/activities/${kind}/${id}/fill`}>
                {t("填写报名问卷", "Fill in the questionnaire")}
              </Link>
            ) : (
              <Questionnaire
                key={`${info.version}:${editing ? info.signup?.updatedAt : "new"}`}
                form={info.form}
                images={info.images}
                initialAnswers={editing ? info.signup?.answers : undefined}
                draftKey={editing ? undefined : info.draftKey}
                submitLabel={editing ? t("提交修改", "Submit changes") : t("提交并确认报名", "Submit and confirm")}
                busy={busy}
                onSubmit={async (answers) => {
                  if (writeLock.current || busy) return;
                  writeLock.current = true;
                  setBusy(true);
                  try {
                    const result = await signupRequest(
                      endpoint,
                      editing ? "PATCH" : "POST",
                      {
                        version: info.version,
                        ...(editing
                          ? { revision: info.signup?.updatedAt }
                          : {}),
                        answers,
                      },
                    );
                    setInfo({ ...info, signup: result.signup });
                    setEditing(false);
                    setSavedMessage(result.message);
                  } finally {
                    writeLock.current = false;
                    setBusy(false);
                  }
                }}
              />
            ))}
        </>
      )}
    </section>
    </QuestionTextProvider>
  );
}
export function SignupManager({
  kind,
  id,
  readOnly = false,
}: {
  kind: string;
  id: number;
  readOnly?: boolean;
}) {
  const endpoint = `/api/activities/${kind}/${id}/signup`,
    manageURL = `${endpoint}?mode=manage`,
    [info, setInfo] = useState<Info | null>(null),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [entries, setEntries] = useState<Receipt[]>([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(0),
    [total, setTotal] = useState<number | null>(null);
  const [view, setView] = useState<"edit" | "entries" | "stats" | "lottery">(
    readOnly ? "entries" : "edit",
  );
  const [serverVersion, setServerVersion] = useState<string | null>(null),
    writeLock = useRef(false);
  const t = useT(),
    locale = useLocale(),
    when = useWhen(),
    say = (value: string) => localizeMessage(value, locale);
  useEffect(() => {
    let live = true;
    signupImageRequest(readOnly ? `${endpoint}?mode=view` : manageURL)
      .then((value) => {
        if (live) setInfo(value);
      })
      .catch((cause) => {
        if (live) {
          setFailed(true);
          setMessage(cause.message);
        }
      });
    return () => {
      live = false;
    };
  }, [endpoint, manageURL, readOnly]);
  async function loadEntries(n: number) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const result = await signupRequest(endpoint + "?mode=entries&page=" + n);
      setMessage("");
      setEntries(result.docs);
      setPage(n);
      setPages(result.totalPages);
      setTotal(result.totalDocs);
    } catch (cause) {
      setFailed(true);
      setMessage((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div aria-busy={busy}>
      <PageHero
        tone="stage"
        eyebrow={readOnly ? t("SIGN-UP DESK · 报名与统计", "SIGN-UP DESK · RESPONSES") : t("SIGN-UP DESK · 编辑问卷", "SIGN-UP DESK · EDIT")}
        title={info?.title || t("活动报名管理", "Sign-up management")}
        description={readOnly ? t("查看本人获准读取的报名资料，整理名单与统计。", "View the sign-up data you are authorized to read, with lists and statistics.") : t("制作问卷、整理报名，并分享同一个活动填写入口。", "Build the questionnaire, manage sign-ups and share one fill-in link.")}
        back={{ href: "/activities", label: t("问卷工作台", "Questionnaire workbench") }}
        meta={
          info && (
            <>
              <StatusPill tone={info.state === "报名开放" ? "live" : "neutral"}>{say(info.state)}</StatusPill>
              <StatusPill>{kind === "events" ? t("站点活动", "Club activity") : t("社群活动", "Community activity")}</StatusPill>
              <StatusPill tone={info.canManage ? "action" : "neutral"}>{info.canManage ? t("可编辑问卷", "Can edit") : t("问卷只读", "Read-only")}</StatusPill>
              <StatusPill tone={info.canViewSignups ? "info" : "neutral"}>{info.canViewSignups ? t("可读取报名", "Can read sign-ups") : t("报名资料未授权", "No sign-up access")}</StatusPill>
              <StatusPill tone={info.canExportSignups ? "info" : "neutral"}>{info.canExportSignups ? t("可导出", "Can export") : t("导出未授权", "No export access")}</StatusPill>
            </>
          )
        }
      />
      <Wrap width="max" className={`${workStyles.surface} ${workspace.manager} ${managerBody}`}>
      {!info && !message && <p role="status">{t("正在读取问卷与当前权限…", "Loading the questionnaire and your permissions…")}</p>}
      {!info && message && (
        <>
          <p className={workspace.error} role="alert">
            {say(message)}
          </p>
          <button
            type="button"
            onClick={() => {
              setMessage("");
              signupImageRequest(
                readOnly ? `${endpoint}?mode=view` : manageURL,
              )
                .then(setInfo)
                .catch((cause) => {
                  setFailed(true);
                  setMessage(cause.message);
                });
            }}
          >
            {t("重新加载问卷", "Reload questionnaire")}
          </button>
        </>
      )}
      {info && (
        <>
          <div className={workspace.objectBar}>
            <p className={pageStyles.meta}>{t("同一个填写入口用于报名、修改作答与查看本人回执。", "One link is used to sign up, edit answers and view receipts.")}</p>
            <div className="signup-tools">
              <Link href={`/activities/${kind}/${id}/fill`}>{t("打开填写页", "Open fill-in page")}</Link>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/activities/${kind}/${id}/fill`,
                    );
                    setFailed(false);
                    setMessage(t("填写链接已复制", "Link copied"));
                  } catch {
                    setFailed(true);
                    setMessage(t("无法自动复制，请打开填写页后复制浏览器地址", "Could not copy automatically. Open the fill-in page and copy its address."));
                  }
                }}
              >
                {t("复制填写链接", "Copy link")}
              </button>
            </div>
          </div>
          <nav className={workspace.taskTabs} aria-label={t("当前问卷任务", "Questionnaire tasks")}>
            {!readOnly && info.canManage && (
              <><button
                type="button"
                aria-pressed={view === "edit"}
                onClick={() => setView("edit")}
              >
                {t("编辑问卷", "Edit questionnaire")}
              </button>
              <button type="button" aria-pressed={view === "lottery"} onClick={() => setView("lottery")}>{t("报名抽签", "Lottery")}</button></>
            )}
            {info.canViewSignups && (
              <>
                <button
                  type="button"
                  aria-pressed={view === "entries"}
                  onClick={() => setView("entries")}
                >
                  {t("报名名单", "Sign-up list")}
                </button>
                <button
                  type="button"
                  aria-pressed={view === "stats"}
                  onClick={() => setView("stats")}
                >
                  {t("统计与导出", "Statistics & export")}
                </button>
              </>
            )}
          </nav>
          {message && (
            <p
              className={failed ? workspace.error : workspace.feedback}
              role={failed ? "alert" : "status"}
            >
              {say(message)}
            </p>
          )}
          {!readOnly && info.canManage && view === "lottery" && <QuestionnaireLottery kind={kind} id={id} canExport={info.canExportSignups} />}
          {!readOnly && info.canManage && (
            <div hidden={view !== "edit"}>
              <form
                className={workspace.editorForm}
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (writeLock.current || busy) return;
                  writeLock.current = true;
                  setBusy(true);
                  setMessage("");
                  setFailed(false);
                  try {
                    const save = info.imageRevision ? signupImageRequest : signupRequest;
                    const result = await save(
                      endpoint,
                      "PUT",
                      {
                        version: info.version,
                        form: info.form,
                        ...(info.imageRevision
                          ? { images: publicationImageInput(info.images ?? []), imageRevision: info.imageRevision }
                          : {}),
                      },
                    );
                    setInfo({
                      ...info,
                      form: result.form,
                      version: result.version,
                      images: result.images,
                      imageRevision: result.imageRevision,
                      // i18n-exempt: state value, rendered through localizeMessage
                      state: "报名状态待核对",
                    });
                    setServerVersion(null);
                    setMessage(result.message);
                    // The write receipt confirms the saved form and revision only.
                    // Read the current window without replacing that form or CAS revision.
                    try {
                      const latest = await signupImageRequest(manageURL);
                      setInfo((current) =>
                        current ? { ...current, state: latest.state } : current,
                      );
                      if (latest.version !== result.version || latest.imageRevision !== result.imageRevision)
                        setServerVersion(latest.imageRevision ?? latest.version);
                    } catch {
                      setMessage(
                        t(`${result.message}。报名状态暂时无法核对，请打开下方“核对已保存问卷”重新读取。`, `${say(result.message)} The sign-up status could not be checked; open “Check saved questionnaire” below to reload it.`),
                      );
                    }
                  } catch (cause) {
                    setFailed(true);
                    setMessage((cause as Error).message);
                  } finally {
                    writeLock.current = false;
                    setBusy(false);
                  }
                }}
              >
                <fieldset className={workspace.actionFields} disabled={busy}>
                  <SignupBuilder
                    value={info.form}
                    illustrations={info.imageRevision ? {
                      images: info.images ?? [],
                      onChange: (images) => setInfo((current) => current ? { ...current, images } : current),
                    } : undefined}
                    onChange={(form) => setInfo({ ...info, form })}
                  />
                  <div className={workspace.saveBar}>
                    <p>
                      {t("保存后按当前开放设置接收报名；历史答卷保留提交时的题目与答案。", "After saving, sign-ups follow the current schedule; earlier responses keep the questions and answers as submitted.")}
                    </p>
                    <button disabled={busy} className="button">
                      {busy ? t("正在保存…", "Saving…") : t("保存报名问卷", "Save questionnaire")}
                    </button>
                  </div>
                </fieldset>
              </form>
              <details className={workspace.recovery}>
                <summary>{t("核对已保存问卷", "Check saved questionnaire")}</summary>
                <p>
                  {t("保存结果不明时可读取当前版本核对。当前编辑保留，只有明确重新载入才替换。", "If the save result is unclear, read the current version to check. Your edits stay unless you explicitly reload.")}
                </p>
                <div className="signup-tools">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      try {
                        const latest = await signupImageRequest(manageURL);
                        setInfo((current) =>
                          current ? { ...current, state: latest.state } : current,
                        );
                        setServerVersion(latest.imageRevision ?? latest.version);
                        setFailed(false);
                        setMessage(
                          latest.version === info.version && latest.imageRevision === info.imageRevision
                            ? t("已读取当前保存版本，与开始编辑时相同。当前编辑保留。", "The saved version matches the one you started from. Your edits are kept.")
                            : t("已读取到更新后的问卷版本，当前编辑保留。请核对后决定是否重新载入。", "A newer saved version exists. Your edits are kept; decide whether to reload."),
                        );
                      } catch (cause) {
                        setFailed(true);
                        setMessage((cause as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("核对服务器版本", "Check server version")}
                  </button>
                  {serverVersion && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          busy ||
                          !window.confirm(
                            t("重新载入会放弃当前未保存的问卷编辑。继续载入服务器版本？", "Reloading discards unsaved questionnaire edits. Load the server version?"),
                          )
                        )
                          return;
                        setBusy(true);
                        try {
                          setInfo(await signupImageRequest(manageURL));
                          setServerVersion(null);
                          setFailed(false);
                          setMessage(t("已载入保存的问卷。", "Loaded the saved questionnaire."));
                        } catch (cause) {
                          setFailed(true);
                          setMessage((cause as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t("重新载入并替换当前编辑", "Reload and replace edits")}
                    </button>
                  )}
                </div>
              </details>
            </div>
          )}
          {info.canViewSignups && (
            <>
              <div hidden={view !== "stats"}>
                <QuestionnaireResults
                  endpoint={endpoint}
                  questions={info.form.questions}
                  canExport={info.canExportSignups}
                />
              </div>
              <section
                hidden={view !== "entries"}
                className={workspace.entries}
              >
                <header className={workspace.sectionHeader}>
                  <div>
                    <h2>{t(`报名名单${total !== null ? `（${total} 人）` : ""}`, `Sign-up list${total !== null ? ` (${total})` : ""}`)}</h2>
                    <p>{t("打开一份报名，查看该次提交的完整题目和答案。", "Open a sign-up to see the full questions and answers of that submission.")}</p>
                  </div>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void loadEntries(1)}
                  >
                    {t("查看 / 刷新报名名单", "View / refresh list")}
                  </button>
                </header>
                {total === null && (
                  <p className={workspace.scope}>
                    {t("点击“查看 / 刷新报名名单”读取当前活动的授权资料。", "Click “View / refresh list” to load the authorized data for this activity.")}
                  </p>
                )}
                {entries.map((record) => (
                  <details className={workspace.entry} key={record.id}>
                    <summary>
                      <span>{record.memberName || t("报名者", "Applicant")}</span>
                      <span>{t(`报名编号 ${record.id}`, `Sign-up no. ${record.id}`)}</span>
                      {record.lotteryStatus && <span>{t(`抽签结果：${record.lotteryStatus}`, `Draw result: ${say(record.lotteryStatus)}`)}</span>}
                      <time dateTime={record.createdAt}>
                        {when(record.createdAt)}
                      </time>
                    </summary>
                    <ReceiptView receipt={record} />
                  </details>
                ))}
                {total === 0 && (
                  <div className={pageStyles.empty}>
                    <h3>{t("暂无报名", "No sign-ups yet")}</h3>
                    <p>{t("填写入口收到提交后，名单会在这里更新。", "The list updates here once submissions arrive.")}</p>
                  </div>
                )}
                {pages > 1 && (
                  <nav
                    className={workspace.pagination}
                    aria-label={t("报名名单分页", "Sign-up list pages")}
                  >
                    <button
                      disabled={busy || page <= 1}
                      onClick={() => void loadEntries(page - 1)}
                    >
                      {t("上一页", "Previous")}
                    </button>
                    <span>
                      {t(`第 ${page} / ${pages} 页`, `Page ${page} of ${pages}`)}
                    </span>
                    <button
                      disabled={busy || page >= pages}
                      onClick={() => void loadEntries(page + 1)}
                    >
                      {t("下一页", "Next")}
                    </button>
                  </nav>
                )}
              </section>
            </>
          )}
          {!info.canViewSignups && (
            <p className={workspace.scope}>
              {t("你可维护报名问卷。读取或导出个人报名需社长单独授权。", "You can maintain the questionnaire. Reading or exporting personal sign-ups needs separate authorization from the president.")}
            </p>
          )}
        </>
      )}
      </Wrap>
    </div>
  );
}
