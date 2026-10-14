"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Questionnaire } from "./Questionnaire";
import type { Answers, Question, SignupForm } from "@/lib/signup-schema";
import { formatAnswer } from "@/lib/questionnaire-model";
import {
  staffStatusLabels,
  staffDeadlinePolicy,
} from "@/lib/staff-recruitment-model";
import { formatDate } from "@/lib/rules";
import styles from "./activity-pages/ApplicationFlow.module.css";
import { SubmissionSteps } from "./activity-pages/SubmissionSteps";
import { activityRequest } from "./activity-pages/client-request";
type Receipt = {
  id: number;
  status: string;
  updatedAt: string;
  formVersion: string;
  questions: Question[];
  answers: Answers;
  feedback?: string | null;
};
type Info = {
  form: SignupForm | null;
  version: string;
  state: string;
  loggedIn: boolean;
  draftKey?: string;
  application: Receipt | null;
};
function StaffReceipt({ receipt }: { receipt: Receipt }) {
  return (
    <>
      <div className={styles.receiptMeta}>
        <p>申请编号 {receipt.id}</p>
        <p>最近更新 {formatDate(receipt.updatedAt)}</p>
      </div>
      <dl className="account-details">
        {receipt.questions
          .filter((question) => question.type !== "description")
          .map((question) => (
            <div key={question.id}>
              <dt>{question.label}</dt>
              <dd>
                {formatAnswer(receipt.answers[question.id], question) ||
                  "未填写"}
              </dd>
            </div>
          ))}
      </dl>
    </>
  );
}
export function StaffApplication({ batch }: { batch: number }) {
  const [info, setInfo] = useState<Info | null>(null),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const [loadError, setLoadError] = useState(""),
    [retry, setRetry] = useState(0),
    [verifiedReceipt, setVerifiedReceipt] = useState<Receipt | null>(null);
  const writeLock = useRef(false),
    reloadHelp = useId();
  const endpoint = "/api/staff/batches/" + batch + "/application";
  useEffect(() => {
    let live = true;
    activityRequest(endpoint)
      .then((data) => {
        if (live) {
          setInfo(data);
          setLoadError("");
        }
      })
      .catch((cause) => {
        if (live) setLoadError(cause.message);
      });
    return () => {
      live = false;
    };
  }, [endpoint, retry]);
  const saved = info?.application,
    open = info?.state === "申请开放",
    final = saved && ["accepted", "rejected"].includes(saved.status);
  async function change(method: string, body: unknown) {
    const data = await activityRequest(endpoint, method, body);
    setInfo((previous) =>
      previous ? { ...previous, application: data.application } : previous,
    );
  }
  async function verifyReceipt() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const latest = await activityRequest(endpoint);
      if (editing) {
        setVerifiedReceipt(latest.application);
        setMessage(
          latest.application
            ? "已读取服务器保存的本人回执。当前修改与原提交版本保留，可在下方对照。"
            : "当前未查到本人回执，已填写的修改保留。请核对后再提交。",
        );
      } else if (latest.application) {
        setInfo(latest);
        setEditing(false);
        setMessage("已读取服务器保存的本人回执。");
      } else
        setMessage("当前未查到本人申请回执。已填写内容保留，请核对后再提交。");
    } catch (cause) {
      setFailed(true);
      setMessage((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="staff-application"
      className={styles.flow}
      aria-busy={busy || (!info && !loadError)}
    >
      <header className={styles.header}>
        <div>
          <h2>
            {saved && !editing
              ? "我的骨干申请"
              : editing
                ? "补充申请资料"
                : "提交骨干申请"}
          </h2>
        </div>
        {info && (
          <span className={styles.state} data-open={open} role="status">
            {info.state}
          </span>
        )}
      </header>
      {!info && !loadError && (
        <div className={styles.loading}>
          <p role="status">正在加载申请表…</p>
          <div className={styles.loadingLine} aria-hidden="true" />
          <div className={styles.loadingLine} aria-hidden="true" />
        </div>
      )}
      {loadError && (
        <>
          <p className={styles.error} role="alert">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoadError("");
              setRetry(retry + 1);
            }}
          >
            重新加载申请表
          </button>
        </>
      )}
      {info && (
        <div className={styles.utilityBar}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void verifyReceipt()}
          >
            {busy ? "正在处理…" : saved ? "刷新回执" : "刷新本人回执"}
          </button>
          <Link href="/join/staff#my-staff-receipts">全部本人回执</Link>
        </div>
      )}
      {message && (
        <p
          className={failed ? styles.error : styles.feedback}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {saved && !editing && (
        <>
          <SubmissionSteps current="receipt" />
          <section className={styles.receipt}>
            <div className={styles.receiptHead}>
              <h3>{staffStatusLabels[saved.status] || saved.status}</h3>
              <span
                className={styles.receiptStatus}
                data-success={saved.status === "accepted"}
                data-attention={saved.status === "returned"}
              >
                申请编号 {saved.id}
              </span>
            </div>
            {saved.feedback && (
              <div className={styles.notice}>
                <h4>处理反馈</h4>
                <p className="preserve">{saved.feedback}</p>
              </div>
            )}
            <p>
              {saved.status === "submitted" || saved.status === "reviewing"
                ? "申请已交给招新负责人，请等待处理并留意本人回执。"
                : saved.status === "returned"
                  ? "请按照反馈补充资料，在批次开放期间重新提交。"
                  : saved.status === "accepted"
                    ? "录用结果已记录，后续安排请留意招新负责人通知。账号角色任命另行处理。"
                    : saved.status === "withdrawn"
                      ? "申请已撤回，批次开放期间可以重新提交同一份记录。"
                      : "本次选拔结果已记录，可查看以下本人提交资料。"}
            </p>
            <StaffReceipt receipt={saved} />
          </section>
          <div className={styles.actions}>
            {open && !final && (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => {
                  setEditing(true);
                  setVerifiedReceipt(null);
                  setMessage("");
                }}
              >
                {saved.status === "withdrawn" ? "重新提交申请" : "修改申请"}
              </button>
            )}
            {open && !final && saved.status !== "withdrawn" && (
              <button
                type="button"
                className="button light"
                disabled={busy}
                onClick={async () => {
                  if (busy || writeLock.current) return;
                  writeLock.current = true;
                  setBusy(true);
                  setFailed(false);
                  try {
                    await change("POST", {
                      action: "withdraw",
                      revision: saved.updatedAt,
                    });
                    setEditing(false);
                    setMessage("申请已撤回，开放期间可重提同一记录。");
                  } catch (cause) {
                    setFailed(true);
                    setMessage((cause as Error).message);
                  } finally {
                    writeLock.current = false;
                    setBusy(false);
                  }
                }}
              >
                撤回申请
              </button>
            )}
          </div>
        </>
      )}
      {editing && (
        <>
          <div className={styles.editingHeader}>
            <h3>修改已提交资料</h3>
            <p>提交成功前保留原申请；取消修改会返回本人回执。</p>
            {saved?.formVersion !== info?.version && (
              <p role="status">申请表已更新，请检查保留的资料并补充新题目。</p>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              取消修改
            </button>
          </div>
          <details className={styles.recovery}>
            <summary>核对结果或重新载入申请</summary>
            <p id={reloadHelp}>
              “刷新回执”只核对服务器记录，保留当前修改。重新载入会放弃未提交的修改，载入最新问卷和本人回执。
            </p>
            <button
              type="button"
              disabled={busy}
              aria-describedby={reloadHelp}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  setInfo(await activityRequest(endpoint));
                  setEditing(false);
                  setVerifiedReceipt(null);
                  setFailed(false);
                  setMessage("已重新载入本人回执，可再次进入修改。");
                } catch (cause) {
                  setFailed(true);
                  setMessage((cause as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              重新载入并放弃当前修改
            </button>
          </details>
          {verifiedReceipt && (
            <section
              className={styles.receipt}
              aria-label="服务器保存的本人申请"
            >
              <h3>服务器保存的本人申请</h3>
              <p>
                {staffStatusLabels[verifiedReceipt.status]}
                。下方申请表仍保留当前未提交的修改。
              </p>
              <StaffReceipt receipt={verifiedReceipt} />
            </section>
          )}
        </>
      )}
      <details className={styles.notice}>
        <summary>申请规则与资料使用说明</summary>
        <p>{staffDeadlinePolicy}</p>
        <p>
          资料用于本批次执行部／宣传部选拔及联系，仅本人和社长／副社长可查看。录用不自动授予账号角色。
        </p>
        <p>
          报名资料保留 1 年，删除申请由社长叶佳鑫人工处理。联系微信
          yejx2003，详见<Link href="/privacy">隐私说明</Link>。
        </p>
      </details>
      {info?.form &&
        open &&
        (!saved || editing) &&
        (!info.loggedIn ? (
          <Link
            className="button"
            href={`/login?returnTo=${encodeURIComponent(`/join/staff/batches/${batch}`)}`}
          >
            登录后提交骨干申请
          </Link>
        ) : (
          <Questionnaire
            key={info.version + ":" + (editing ? saved?.updatedAt : "new")}
            form={info.form}
            initialAnswers={editing ? saved?.answers : undefined}
            draftKey={editing ? undefined : info.draftKey}
            busy={busy}
            submitLabel={editing ? "保存申请并提交" : "提交骨干申请"}
            onSubmit={async (answers) => {
              if (busy || writeLock.current) return;
              writeLock.current = true;
              setBusy(true);
              setMessage("");
              setFailed(false);
              try {
                await change(
                  saved?.status === "withdrawn"
                    ? "POST"
                    : editing
                      ? "PATCH"
                      : "POST",
                  {
                    version: info.version,
                    revision: saved?.updatedAt,
                    answers,
                  },
                );
                setEditing(false);
                setMessage("骨干申请已提交，请查看本人回执。");
              } catch (cause) {
                setFailed(true);
                setMessage((cause as Error).message);
                throw cause;
              } finally {
                writeLock.current = false;
                setBusy(false);
              }
            }}
          />
        ))}
    </section>
  );
}
