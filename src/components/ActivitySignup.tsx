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
};
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
function ReceiptView({ receipt }: { receipt: Receipt }) {
  return (
    <div>
      <div className={styles.receiptMeta}>
        <p>报名编号 {receipt.id}</p>
        <p>提交于 {formatDate(receipt.createdAt)}</p>
        {receipt.updatedAt !== receipt.createdAt && (
          <p>最近修改 {formatDate(receipt.updatedAt)}</p>
        )}
      </div>
      <dl className={styles.receiptAnswers}>
        {receipt.questions
          .filter((q) => Object.hasOwn(receipt.answers, q.id))
          .map((q) => (
            <div key={q.id}>
              <dt>{q.label}</dt>
              <dd>{formatAnswer(receipt.answers[q.id], q)}</dd>
            </div>
          ))}
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
        aria-label="活动报名"
      >
        {error ? (
          <>
            <h2>报名信息暂时无法加载</h2>
            <p className={styles.error} role="alert">
              {error}
            </p>
            <button
              type="button"
              onClick={() => {
                setError("");
                setRetry(retry + 1);
              }}
            >
              重试
            </button>
          </>
        ) : (
          <div className={styles.loading}>
            <p role="status">正在加载报名信息…</p>
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
            ? "已核对服务器保存的本人回执，当前修改仍保留。"
            : "当前未查到已保存的本人回执。当前修改仍保留，请核对后再提交。",
        );
      } else if (latest.signup) {
        setInfo(latest);
        setEditing(false);
        setSavedMessage("已读取服务器保存的本人回执。");
      } else
        setSavedMessage(
          "当前未查到已保存的本人回执。已填写内容保留，请核对后再提交。",
        );
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`activity-signup ${styles.flow} ${compact ? styles.compact : ""}`}
      aria-busy={busy}
    >
      <header className={styles.header}>
        <div>
          {!compact && <p className={styles.kicker}>{info.title}</p>}
          <h2>
            {info.signup && !editing
              ? "我的报名回执"
              : info.form.title || "活动报名"}
          </h2>
        </div>
        <span className={styles.state} data-open={info.state === "报名开放"}>
          {info.state}
        </span>
      </header>
      {!compact && (
        <div className={styles.utilityBar}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void verifyReceipt()}
          >
            刷新报名状态与本人回执
          </button>
          <Link href="/account">我的事务</Link>
        </div>
      )}
      {/* Compact panels sit beside the V2 event detail, whose server-rendered 活动管理 panel already links here. */}
      {!compact && (info.canManage || info.canViewSignups) && (
        <div className={styles.actions}>
          {info.canManage && (
            <Link href={`/activities/${kind}/${id}/manage`}>管理报名问卷</Link>
          )}
          {info.canViewSignups && (
            <Link href={`/activities/${kind}/${id}/signups`}>
              查看报名与统计
            </Link>
          )}
        </div>
      )}
      {savedMessage && (
        <p className={styles.feedback} role="status">
          {savedMessage}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {info.signup && !editing ? (
        <>
          {!compact && <SubmissionSteps current="receipt" />}
          <div className={styles.receipt}>
            <div className={styles.receiptHead}>
              <h3 aria-live="polite">已报名</h3>
              <span className={styles.receiptStatus} data-success="true">
                已保存本人记录
              </span>
            </div>
            <p>{info.form.completionMessage || "已收到你的报名信息。"}</p>
            <ReceiptView receipt={info.signup} />
          </div>
          {compact ? (
            <Link className="button" href={`/activities/${kind}/${id}/fill`}>
              查看本人回执{info.state === "报名开放" ? "与修改作答" : ""}
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
              修改作答
            </button>
          ) : (
            <p className="muted">{info.state}，暂不能修改作答。</p>
          )}
        </>
      ) : (
        <>
          <div className={styles.taskContext}>
            <div>
              {info.form.intro && <p className="preserve">{info.form.intro}</p>}
              <PublicationImages images={info.images?.filter((image) => !image.questionId)} />
            </div>
            {(info.form.start || info.form.end) && (
              <dl>
                {info.form.start && (
                  <div>
                    <dt>问卷开放</dt>
                    <dd>{formatDate(info.form.start)}</dd>
                  </div>
                )}
                {info.form.end && (
                  <div>
                    <dt>问卷截止</dt>
                    <dd>{formatDate(info.form.end)}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
          {editing && (
            <>
              <div className={styles.editingHeader}>
                <h3>修改作答</h3>
                <p>已带入上次提交的内容。提交成功前，原作答仍然保留。</p>
                {info.signup?.formVersion !== info.version && (
                  <p role="status">
                    问卷已更新，请检查保留的答案并补充新题目。
                  </p>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  取消修改
                </button>
              </div>
              <details className={styles.recovery}>
                <summary>核对结果或重新载入已提交内容</summary>
                <p id={reloadHelp}>
                  “重新加载已提交内容”会放弃当前未提交的修改，并载入最新问卷与已保存回执。仅核对结果请使用上方“刷新报名状态与本人回执”。
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
                        "已重新加载上次提交的内容，可再次进入修改。",
                      );
                      setError("");
                    } catch (cause) {
                      setError((cause as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  重新加载已提交内容
                </button>
              </details>
              {verifiedReceipt && (
                <section
                  className={styles.receipt}
                  aria-label="服务器保存的本人回执"
                >
                  <h4>服务器保存的本人回执</h4>
                  <p>以下内容仅供核对，当前未提交的修改仍保留在下方问卷中。</p>
                  <ReceiptView receipt={verifiedReceipt} />
                </section>
              )}
            </>
          )}
          <p className={styles.notice}>
            答案仅供你本人和有权限的活动管理者查看，用于本次活动组织。报名资料保留
            1 年；如需删除，请按<Link href="/privacy">隐私说明</Link>
            联系人工处理。
          </p>
          {info.form.enabled &&
            info.state === "报名开放" &&
            (!info.loggedIn ? (
              <Link
                className="button"
                href={`/login?returnTo=${encodeURIComponent(`/activities/${kind}/${id}/fill`)}`}
              >
                登录后填写报名
              </Link>
            ) : compact ? (
              <Link className="button" href={`/activities/${kind}/${id}/fill`}>
                填写报名问卷
              </Link>
            ) : (
              <Questionnaire
                key={`${info.version}:${editing ? info.signup?.updatedAt : "new"}`}
                form={info.form}
                images={info.images}
                initialAnswers={editing ? info.signup?.answers : undefined}
                draftKey={editing ? undefined : info.draftKey}
                submitLabel={editing ? "提交修改" : "提交并确认报名"}
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
        eyebrow={readOnly ? "SIGN-UP DESK · 报名与统计" : "SIGN-UP DESK · 编辑问卷"}
        title={info?.title || "活动报名管理"}
        description={readOnly ? "查看本人获准读取的报名资料，整理名单与统计。" : "制作问卷、整理报名，并分享同一个活动填写入口。"}
        back={{ href: "/activities", label: "问卷工作台" }}
        meta={
          info && (
            <>
              <StatusPill tone={info.state === "报名开放" ? "live" : "neutral"}>{info.state}</StatusPill>
              <StatusPill>{kind === "events" ? "站点活动" : "社群活动"}</StatusPill>
              <StatusPill tone={info.canManage ? "action" : "neutral"}>{info.canManage ? "可编辑问卷" : "问卷只读"}</StatusPill>
              <StatusPill tone={info.canViewSignups ? "info" : "neutral"}>{info.canViewSignups ? "可读取报名" : "报名资料未授权"}</StatusPill>
              <StatusPill tone={info.canExportSignups ? "info" : "neutral"}>{info.canExportSignups ? "可导出" : "导出未授权"}</StatusPill>
            </>
          )
        }
      />
      <Wrap width="max" className={`${workStyles.surface} ${workspace.manager} ${managerBody}`}>
      {!info && !message && <p role="status">正在读取问卷与当前权限…</p>}
      {!info && message && (
        <>
          <p className={workspace.error} role="alert">
            {message}
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
            重新加载问卷
          </button>
        </>
      )}
      {info && (
        <>
          <div className={workspace.objectBar}>
            <p className={pageStyles.meta}>同一个填写入口用于报名、修改作答与查看本人回执。</p>
            <div className="signup-tools">
              <Link href={`/activities/${kind}/${id}/fill`}>打开填写页</Link>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/activities/${kind}/${id}/fill`,
                    );
                    setFailed(false);
                    setMessage("填写链接已复制");
                  } catch {
                    setFailed(true);
                    setMessage("无法自动复制，请打开填写页后复制浏览器地址");
                  }
                }}
              >
                复制填写链接
              </button>
            </div>
          </div>
          <nav className={workspace.taskTabs} aria-label="当前问卷任务">
            {!readOnly && info.canManage && (
              <><button
                type="button"
                aria-pressed={view === "edit"}
                onClick={() => setView("edit")}
              >
                编辑问卷
              </button>
              <button type="button" aria-pressed={view === "lottery"} onClick={() => setView("lottery")}>报名抽签</button></>
            )}
            {info.canViewSignups && (
              <>
                <button
                  type="button"
                  aria-pressed={view === "entries"}
                  onClick={() => setView("entries")}
                >
                  报名名单
                </button>
                <button
                  type="button"
                  aria-pressed={view === "stats"}
                  onClick={() => setView("stats")}
                >
                  统计与导出
                </button>
              </>
            )}
          </nav>
          {message && (
            <p
              className={failed ? workspace.error : workspace.feedback}
              role={failed ? "alert" : "status"}
            >
              {message}
            </p>
          )}
          {!readOnly && info.canManage && view === "lottery" && <QuestionnaireLottery kind={kind} id={id} />}
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
                        `${result.message}。报名状态暂时无法核对，请打开下方“核对已保存问卷”重新读取。`,
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
                      保存后按当前开放设置接收报名；历史答卷保留提交时的题目与答案。
                    </p>
                    <button disabled={busy} className="button">
                      {busy ? "正在保存…" : "保存报名问卷"}
                    </button>
                  </div>
                </fieldset>
              </form>
              <details className={workspace.recovery}>
                <summary>核对已保存问卷</summary>
                <p>
                  保存结果不明时可读取当前版本核对。当前编辑保留，只有明确重新载入才替换。
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
                            ? "已读取当前保存版本，与开始编辑时相同。当前编辑保留。"
                            : "已读取到更新后的问卷版本，当前编辑保留。请核对后决定是否重新载入。",
                        );
                      } catch (cause) {
                        setFailed(true);
                        setMessage((cause as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    核对服务器版本
                  </button>
                  {serverVersion && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          busy ||
                          !window.confirm(
                            "重新载入会放弃当前未保存的问卷编辑。继续载入服务器版本？",
                          )
                        )
                          return;
                        setBusy(true);
                        try {
                          setInfo(await signupImageRequest(manageURL));
                          setServerVersion(null);
                          setFailed(false);
                          setMessage("已载入保存的问卷。");
                        } catch (cause) {
                          setFailed(true);
                          setMessage((cause as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      重新载入并替换当前编辑
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
                    <h2>报名名单{total !== null ? `（${total} 人）` : ""}</h2>
                    <p>打开一份报名，查看该次提交的完整题目和答案。</p>
                  </div>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void loadEntries(1)}
                  >
                    查看 / 刷新报名名单
                  </button>
                </header>
                {total === null && (
                  <p className={workspace.scope}>
                    点击“查看 / 刷新报名名单”读取当前活动的授权资料。
                  </p>
                )}
                {entries.map((record) => (
                  <details className={workspace.entry} key={record.id}>
                    <summary>
                      <span>{record.memberName || "报名者"}</span>
                      <span>报名编号 {record.id}</span>
                      {record.lotteryStatus && <span>抽签结果：{record.lotteryStatus}</span>}
                      <time dateTime={record.createdAt}>
                        {formatDate(record.createdAt)}
                      </time>
                    </summary>
                    <ReceiptView receipt={record} />
                  </details>
                ))}
                {total === 0 && (
                  <div className={pageStyles.empty}>
                    <h3>暂无报名</h3>
                    <p>填写入口收到提交后，名单会在这里更新。</p>
                  </div>
                )}
                {pages > 1 && (
                  <nav
                    className={workspace.pagination}
                    aria-label="报名名单分页"
                  >
                    <button
                      disabled={busy || page <= 1}
                      onClick={() => void loadEntries(page - 1)}
                    >
                      上一页
                    </button>
                    <span>
                      第 {page} / {pages} 页
                    </span>
                    <button
                      disabled={busy || page >= pages}
                      onClick={() => void loadEntries(page + 1)}
                    >
                      下一页
                    </button>
                  </nav>
                )}
              </section>
            </>
          )}
          {!info.canViewSignups && (
            <p className={workspace.scope}>
              你可维护报名问卷。读取或导出个人报名需社长单独授权。
            </p>
          )}
        </>
      )}
      </Wrap>
    </div>
  );
}
