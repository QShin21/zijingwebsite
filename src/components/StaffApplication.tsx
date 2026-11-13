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
import { useLocale, useT } from "./i18n/LocaleProvider";
import { formatDateTime as formatLocaleDate } from "@/lib/i18n/locale";
import { accountLabel, keyedLabel, staffStatusLabelsEn } from "@/lib/i18n/labels-account";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";
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
  const t = useT(),
    locale = useLocale();
  return (
    <>
      <div className={styles.receiptMeta}>
        <p>{t(`申请编号 ${receipt.id}`, `Application #${receipt.id}`)}</p>
        <p>{locale === "en" ? `Updated ${formatLocaleDate(receipt.updatedAt, locale)}` : `最近更新 ${formatDate(receipt.updatedAt)}`}</p>
      </div>
      <dl className="account-details">
        {receipt.questions
          .filter((question) => question.type !== "description")
          .map((question) => (
            <div key={question.id}>
              <dt>{question.label}</dt>
              <dd>
                {formatAnswer(receipt.answers[question.id], question) ||
                  t("未填写", "Not answered")}
              </dd>
            </div>
          ))}
      </dl>
    </>
  );
}
export function StaffApplication({ batch }: { batch: number }) {
  const t = useT(),
    locale = useLocale();
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
        if (live) setLoadError(localizeAccountMessage(cause.message, locale));
      });
    return () => {
      live = false;
    };
  }, [endpoint, retry, locale]);
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
            ? t("已读取服务器保存的本人回执。当前修改与原提交版本保留，可在下方对照。", "Loaded your saved receipt. Your current edits and the submitted version are both kept for comparison below.")
            : t("当前未查到本人回执，已填写的修改保留。请核对后再提交。", "No receipt found. Your edits are kept; check them before submitting."),
        );
      } else if (latest.application) {
        setInfo(latest);
        setEditing(false);
        setMessage(t("已读取服务器保存的本人回执。", "Loaded your saved receipt."));
      } else
        setMessage(t("当前未查到本人申请回执。已填写内容保留，请核对后再提交。", "No application receipt found. Your answers are kept; check them before submitting."));
    } catch (cause) {
      setFailed(true);
      setMessage(localizeAccountMessage((cause as Error).message, locale));
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
              ? t("我的骨干申请", "My staff application")
              : editing
                ? t("补充申请资料", "Update application")
                : t("提交骨干申请", "Submit staff application")}
          </h2>
        </div>
        {info && (
          <span className={styles.state} data-open={open} role="status">
            {accountLabel(info.state, locale)}
          </span>
        )}
      </header>
      {!info && !loadError && (
        <div className={styles.loading}>
          <p role="status">{t("正在加载申请表…", "Loading the form…")}</p>
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
            {t("重新加载申请表", "Reload the form")}
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
            {busy ? t("正在处理…", "Working…") : saved ? t("刷新回执", "Refresh receipt") : t("刷新本人回执", "Refresh my receipt")}
          </button>
          <Link href="/join/staff#my-staff-receipts">{t("全部本人回执", "All my receipts")}</Link>
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
              <h3>{keyedLabel(locale, saved.status, staffStatusLabelsEn, staffStatusLabels[saved.status] || saved.status)}</h3>
              <span
                className={styles.receiptStatus}
                data-success={saved.status === "accepted"}
                data-attention={saved.status === "returned"}
              >
                {t(`申请编号 ${saved.id}`, `Application #${saved.id}`)}
              </span>
            </div>
            {saved.feedback && (
              <div className={styles.notice}>
                <h4>{t("处理反馈", "Feedback")}</h4>
                <p className="preserve">{saved.feedback}</p>
              </div>
            )}
            <p>
              {saved.status === "submitted" || saved.status === "reviewing"
                ? t("申请已交给招新负责人，请等待处理并留意本人回执。", "Your application is with the recruiters. Watch your receipt for updates.")
                : saved.status === "returned"
                  ? t("请按照反馈补充资料，在批次开放期间重新提交。", "Update your answers per the feedback and resubmit while the batch is open.")
                  : saved.status === "accepted"
                    ? t("录用结果已记录，后续安排请留意招新负责人通知。账号角色任命另行处理。", "You have been accepted. Watch for notices from the recruiters; account roles are assigned separately.")
                    : saved.status === "withdrawn"
                      ? t("申请已撤回，批次开放期间可以重新提交同一份记录。", "Application withdrawn. You can resubmit the same record while the batch is open.")
                      : t("本次选拔结果已记录，可查看以下本人提交资料。", "The result has been recorded. Your submitted answers are below.")}
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
                {saved.status === "withdrawn" ? t("重新提交申请", "Resubmit application") : t("修改申请", "Edit application")}
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
                    setMessage(t("申请已撤回，开放期间可重提同一记录。", "Application withdrawn. You can resubmit it while the batch is open."));
                  } catch (cause) {
                    setFailed(true);
                    setMessage(localizeAccountMessage((cause as Error).message, locale));
                  } finally {
                    writeLock.current = false;
                    setBusy(false);
                  }
                }}
              >
                {t("撤回申请", "Withdraw application")}
              </button>
            )}
          </div>
        </>
      )}
      {editing && (
        <>
          <div className={styles.editingHeader}>
            <h3>{t("修改已提交资料", "Edit submitted answers")}</h3>
            <p>{t("提交成功前保留原申请；取消修改会返回本人回执。", "Your original application stays until the edit is submitted. Cancelling returns to your receipt.")}</p>
            {saved?.formVersion !== info?.version && (
              <p role="status">{t("申请表已更新，请检查保留的资料并补充新题目。", "The form has been updated. Check your kept answers and fill in new questions.")}</p>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              {t("取消修改", "Cancel editing")}
            </button>
          </div>
          <details className={styles.recovery}>
            <summary>{t("核对结果或重新载入申请", "Check the result or reload")}</summary>
            <p id={reloadHelp}>
              {t("“刷新回执”只核对服务器记录，保留当前修改。重新载入会放弃未提交的修改，载入最新问卷和本人回执。", "“Refresh receipt” only checks the server record and keeps your edits. Reloading discards unsubmitted edits and loads the latest form and receipt.")}
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
                  setMessage(t("已重新载入本人回执，可再次进入修改。", "Receipt reloaded. You can edit again."));
                } catch (cause) {
                  setFailed(true);
                  setMessage(localizeAccountMessage((cause as Error).message, locale));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("重新载入并放弃当前修改", "Reload and discard edits")}
            </button>
          </details>
          {verifiedReceipt && (
            <section
              className={styles.receipt}
              aria-label={t("服务器保存的本人申请", "Your saved application")}
            >
              <h3>{t("服务器保存的本人申请", "Your saved application")}</h3>
              <p>
                {keyedLabel(locale, verifiedReceipt.status, staffStatusLabelsEn, staffStatusLabels[verifiedReceipt.status])}
                {t("。下方申请表仍保留当前未提交的修改。", ". The form below still keeps your unsubmitted edits.")}
              </p>
              <StaffReceipt receipt={verifiedReceipt} />
            </section>
          )}
        </>
      )}
      <details className={styles.notice}>
        <summary>{t("申请规则与资料使用说明", "Rules and data use")}</summary>
        <p>{locale === "en" ? "While open you can edit, withdraw and resubmit; after the deadline or closing you can only view the receipt. Accepted/not accepted results lock your edits; the leadership may return an application for more info, which still requires the batch to be open." : staffDeadlinePolicy}</p>
        <p>
          {t("资料用于本批次执行部／宣传部选拔及联系，仅本人和社长／副社长可查看。录用不自动授予账号角色。", "Your data is used only for this batch's Operations/Publicity selection and contact, visible only to you and the President/Vice Presidents. Acceptance does not grant an account role automatically.")}
        </p>
        <p>
          {t("报名资料保留 1 年，删除申请由社长叶佳鑫人工处理。联系微信 yejx2003，详见", "Data is kept for 1 year. Deletion requests are handled by President Ye Jiaxin (WeChat yejx2003). See ")}<Link href="/privacy">{t("隐私说明", "Privacy")}</Link>{t("。", ".")}
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
            {t("登录后提交骨干申请", "Sign in to apply as staff")}
          </Link>
        ) : (
          <Questionnaire
            key={info.version + ":" + (editing ? saved?.updatedAt : "new")}
            form={info.form}
            initialAnswers={editing ? saved?.answers : undefined}
            draftKey={editing ? undefined : info.draftKey}
            busy={busy}
            submitLabel={editing ? t("保存申请并提交", "Save and submit") : t("提交骨干申请", "Submit staff application")}
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
                setMessage(t("骨干申请已提交，请查看本人回执。", "Staff application submitted. Check your receipt."));
              } catch (cause) {
                setFailed(true);
                setMessage(localizeAccountMessage((cause as Error).message, locale));
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
