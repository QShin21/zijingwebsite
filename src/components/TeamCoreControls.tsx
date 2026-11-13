"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import styles from "./team-pages/TeamPages.module.css";
import { Questionnaire } from "./Questionnaire";
import { SignupBuilder } from "./SignupBuilder";
import {
  normalizeSignup,
  type Answers,
  type SignupForm,
} from "@/lib/signup-schema";
import { sanitizeDraft, formatAnswer } from "@/lib/questionnaire-model";
import { beijingInputTime } from "@/lib/rules";
import { localizeMessage } from "@/lib/i18n/messages";
import { publicLabel } from "@/lib/i18n/labels-public";
import { useLocale, useT } from "./i18n/LocaleProvider";

// English for the client-side messages raised outside a render (Chinese stays the contract).
const clientMessagesEn: Record<string, string> = {
  "连接中断，操作结果尚未确认。已填内容保留，请先核对最新记录。":
    "The connection dropped and the result is unconfirmed. Your input is kept; check the latest record first.",
  "操作未完成，请重试": "The action was not completed. Please try again.",
  "请先核对上一项操作的结果。": "Check the result of the previous action first.",
  "操作未完成，已填内容保留。": "The action was not completed. Your input is kept.",
};

class UnconfirmedTeamRequest extends Error {
  constructor() {
    // i18n-exempt: Error message; English rendered via clientMessagesEn
    super("连接中断，操作结果尚未确认。已填内容保留，请先核对最新记录。");
  }
}

export async function teamRequest(data: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch("/api/team-core", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(data),
    });
  } catch {
    throw new UnconfirmedTeamRequest();
  }
  if (response.status >= 500) throw new UnconfirmedTeamRequest();
  const result = await response.json().catch(() => {
    throw new UnconfirmedTeamRequest();
  });
  if (!result || typeof result !== "object") throw new UnconfirmedTeamRequest();
  // i18n-exempt: Error message; English rendered via clientMessagesEn
  if (!response.ok) throw new Error(result.error || "操作未完成，请重试");
  if (!Object.hasOwn(result, "result")) throw new UnconfirmedTeamRequest();
  return result;
}

const subscribeToHydration = () => () => {};
function useTeamAction() {
  const ready = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [confirmedMissing, setConfirmedMissing] = useState(false);
  const blocked = !ready || busy || (unconfirmed && !confirmedMissing);

  function fail(message: string) {
    setFailed(true);
    setMessage(message);
  }
  async function run(data: Record<string, unknown>, success: string) {
    if (!ready || pending.current || (unconfirmed && !confirmedMissing))
      return {
        ok: false as const,
        // i18n-exempt: Error message; English rendered via clientMessagesEn
        error: new Error("请先核对上一项操作的结果。"),
      };
    pending.current = true;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const result = await teamRequest(data);
      setUnconfirmed(false);
      setConfirmedMissing(false);
      setMessage(success);
      return { ok: true as const, result };
    } catch (cause) {
      const error =
        cause instanceof Error
          ? cause
          : // i18n-exempt: Error message; English rendered via clientMessagesEn
            new Error("操作未完成，已填内容保留。");
      fail(error.message);
      setUnconfirmed(cause instanceof UnconfirmedTeamRequest);
      setConfirmedMissing(false);
      return { ok: false as const, error };
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return {
    ready,
    busy,
    blocked,
    message,
    failed,
    unconfirmed,
    confirmedMissing,
    setConfirmedMissing,
    fail,
    run,
  };
}

function TeamActionFeedback({
  action,
  reviewHref,
}: {
  action: ReturnType<typeof useTeamAction>;
  reviewHref: string;
}) {
  const t = useT(),
    locale = useLocale();
  const message =
    locale === "en" && clientMessagesEn[action.message]
      ? clientMessagesEn[action.message]
      : localizeMessage(action.message, locale);
  return (
    <div className={`team-core-feedback ${styles.feedback}`}>
      <p role={action.failed ? "alert" : "status"}>{message}</p>
      {action.unconfirmed && (
        <>
          <a href={reviewHref} target="_blank" rel="noopener noreferrer">
            {t("打开最新记录核对", "Open the latest record to check")}
          </a>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={action.confirmedMissing}
              onChange={(event) =>
                action.setConfirmedMissing(event.currentTarget.checked)
              }
            />
            {t("已核对最新记录，确认本次未保存", "I checked the latest record and confirm this was not saved")}
          </label>
        </>
      )}
    </div>
  );
}
export function TeamCoreOperation({
  operation,
  id,
  revision,
  label,
  status,
  noteRequired = false,
}: {
  operation: string;
  id: number;
  revision: string;
  label: string;
  status?: string;
  noteRequired?: boolean;
}) {
  const t = useT();
  const router = useRouter(),
    action = useTeamAction();
  return (
    <form
      method="post"
      className="member-form team-core-operation"
      aria-busy={action.busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (action.blocked) return;
        const values = new FormData(e.currentTarget);
        const result = await action.run(
          {
            operation,
            id,
            revision,
            status,
            note: values.get("note"),
          },
          t("已保存。", "Saved."),
        );
        if (result.ok) router.refresh();
      }}
    >
      {noteRequired && (
        <label>
          {operation === "revoke" ? t("撤销原因", "Reason for revoking") : t("处理说明", "Note")}
          <textarea name="note" required maxLength={1000} rows={2} />
        </label>
      )}
      <button className="button light" disabled={action.blocked}>
        {action.busy ? t("正在保存…", "Saving…") : label}
      </button>
      <TeamActionFeedback
        action={action}
        reviewHref={
          operation === "withdraw-establishment"
            ? "/teams/apply"
            : operation === "lifecycle"
              ? `/teams/manage/${id}`
              : operation === "close-recruitment"
                ? `/teams/recruitment/${id}`
                : operation === "revoke"
                  ? "/teams/manage"
                  : "/teams/recruitment"
        }
      />
    </form>
  );
}
export function TeamCoreDecision({
  kind,
  id,
  revision,
}: {
  kind: "establishment" | "join";
  id: number;
  revision: string;
}) {
  const t = useT();
  const router = useRouter(),
    action = useTeamAction();
  const note = useRef<HTMLTextAreaElement>(null);
  return (
    <form
      method="post"
      className="member-form"
      aria-busy={action.busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (action.blocked) return;
        const native = e.nativeEvent as SubmitEvent,
          button = native.submitter as HTMLButtonElement | null;
        const decision = button?.value,
          form = new FormData(e.currentTarget);
        if (!decision) return;
        if (decision !== "approved" && !String(form.get("note") || "").trim()) {
          action.fail(t("请填写审核意见，说明需要补充的内容或未通过原因。", "Enter a review note explaining what to add or why it was not approved."));
          note.current?.focus();
          return;
        }
        const result = await action.run(
          {
            operation: `decide-${kind}`,
            id,
            revision,
            decision,
            note: form.get("note"),
          },
          t("审核结果已保存。", "Review saved."),
        );
        if (result.ok) router.refresh();
      }}
    >
      <label>
        {t("审核意见（退回 / 未通过时必填）", "Review note (required to return or decline)")}
        <textarea ref={note} name="note" maxLength={1000} rows={3} />
      </label>
      <div className="signup-tools">
        <button
          className="button"
          name="decision"
          value="approved"
          disabled={action.blocked}
        >
          {kind === "join" ? t("批准入队", "Approve joining") : t("批准建队", "Approve team")}
        </button>
        <button
          className="button light"
          name="decision"
          value="returned"
          disabled={action.blocked}
        >
          {t("退回补充", "Return for changes")}
        </button>
        <button
          className="button light"
          name="decision"
          value="rejected"
          disabled={action.blocked}
        >
          {t("未通过", "Decline")}
        </button>
      </div>
      <TeamActionFeedback action={action} reviewHref="/teams/manage" />
    </form>
  );
}
export function TeamCoreEstablishmentForm({
  games,
  initial,
}: {
  games: { id: number; title: string }[];
  initial?: {
    id: number;
    gameID: number;
    title: string;
    reason: string;
    revision: string;
  };
}) {
  const t = useT();
  const router = useRouter(),
    action = useTeamAction(),
    [saved, setSaved] = useState(false);
  if (!games.length)
    return (
      <p>
        {t("你目前没有可申请建队的社群任职。可先", "You have no community role that can apply for a team. You can first ")}
        <Link href="/community/apply">{t("申请参与社群管理", "apply to help run a community")}</Link>
        {t("。", ".")}
      </p>
    );
  if (saved)
    return (
      <div className={styles.note} role="status">
        <h2>{t("建队申请已提交", "Team application submitted")}</h2>
        <p>{t("请在下方查看状态与处理意见，等待有建队审批权限的负责人审核。", "See the status and review notes below while a lead with approval rights reviews it.")}</p>
        <Link href="/teams/manage">{t("返回代表队工作台", "Back to team workspace")}</Link>
      </div>
    );
  return (
    <form
      method="post"
      className="member-form"
      aria-busy={action.busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (action.blocked) return;
        const values = new FormData(e.currentTarget);
        const result = await action.run(
          {
            operation: "establish",
            id: initial?.id,
            revision: initial?.revision,
            gameID: initial?.gameID ?? values.get("gameID"),
            title: values.get("title"),
            reason: values.get("reason"),
          },
          t("建队申请已提交。", "Team application submitted."),
        );
        if (result.ok) {
          setSaved(true);
          router.refresh();
        }
      }}
    >
      <h2>{initial ? t("修改并重新提交建队申请", "Edit and resubmit team application") : t("申请建立代表队", "Apply to found a team")}</h2>
      <div className={styles.formSection}>
        <h3>{t("队伍归属与名称", "Community and name")}</h3>
        <label>
          {t("游戏社群", "Game community")}
          <select
            name="gameID"
            defaultValue={initial?.gameID ?? games[0].id}
            disabled={Boolean(initial)}
          >
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("拟用队名", "Proposed team name")}
          <input
            name="title"
            required
            minLength={2}
            maxLength={80}
            defaultValue={initial?.title}
          />
        </label>
      </div>
      <div className={styles.formSection}>
        <h3>{t("组织与训练安排", "Organization and training")}</h3>
        <label>
          {t("组织与训练计划", "Organization and training plan")}
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={3000}
            rows={6}
            defaultValue={initial?.reason}
          />
        </label>
        <p>
          {t("描述组织安排和训练计划即可。批准建队不授予新的管理角色，也不宣称未经核实的学校官方资格。", "Describe how the team is organized and trains. Approval grants no new admin role and implies no unverified official university status.")}
        </p>
      </div>
      <div className={styles.commit}>
        <button className="button" disabled={action.blocked}>
          {action.busy ? t("正在提交…", "Submitting…") : t("提交建队申请", "Submit team application")}
        </button>
      </div>
      <TeamActionFeedback action={action} reviewHref="/teams/apply" />
    </form>
  );
}
export function TeamCoreRecruitmentEditor({
  teamID,
  defaultForm,
  initial,
}: {
  teamID: number;
  defaultForm: SignupForm;
  initial?: {
    id: number;
    title: string;
    status: string;
    revision: string;
    form: SignupForm;
  };
}) {
  const t = useT();
  const router = useRouter();
  const initialForm = initial?.form ?? defaultForm;
  const [form, setForm] = useState(() => ({
    ...initialForm,
    start: "",
    end: "",
  }));
  const [schedule, setSchedule] = useState({
    start: initialForm.start,
    end: initialForm.end,
  });
  // i18n-exempt: default batch title saved as content
  const [title, setTitle] = useState(initial?.title ?? "代表队新一轮招新");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const action = useTeamAction();
  const publishing = status === "open";
  return (
    <section
      id="team-recruitment-editor"
      className={`team-core-editor ${styles.editor}`}
      aria-busy={action.busy}
    >
      <header className={styles.editorHeader}>
        <h2>{initial ? t("编辑招新批次", "Edit recruitment batch") : t("建立招新批次", "Create recruitment batch")}</h2>
        <p>{t("依次准备批次名称、选拔问卷与开放安排，确认后保存。", "Set the batch name, tryout questionnaire and schedule, then save.")}</p>
      </header>
      <div className={styles.formSection}>
        <h3>{t("批次信息", "Batch details")}</h3>
        <label className="member-form">
          {t("批次名称", "Batch name")}
          <input
            form="team-recruitment-publish"
            value={title}
            disabled={!action.ready}
            required
            minLength={2}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <p>
          {t("核心资料为游戏 ID、位置、经历、训练时间和一种联系方式。可修改提示和加入选拔题，每位申请人均须填写核心题。", "Core details are game ID, position, experience, training availability and one contact method. You can edit hints and add tryout questions; every applicant must answer the core questions.")}
        </p>
      </div>
      <div className={styles.formSection}>
        <h3>{t("选拔问卷", "Tryout questionnaire")}</h3>
        <SignupBuilder
          value={form}
          onChange={setForm}
          showRegistrationControls={false}
        />
      </div>
      <form
        id="team-recruitment-publish"
        method="post"
        className={`member-form ${styles.commit}`}
        onSubmit={async (event) => {
          event.preventDefault();
          if (action.blocked) return;
          const result = await action.run(
            {
              operation: "save-recruitment",
              teamID,
              id: initial?.id,
              revision: initial?.revision,
              title,
              status,
              form: {
                ...form,
                ...schedule,
                ...(publishing ? { enabled: true, closed: false } : {}),
              },
            },
            publishing ? t("招新批次已发布。", "Recruitment batch published.") : t("批次已保存。", "Batch saved."),
          );
          if (result.ok) {
            router.push(`/teams/manage/${teamID}#team-recruitments`);
            router.refresh();
          }
        }}
      >
        <h3>{t("确认开放安排", "Confirm schedule")}</h3>
        <label>
          {t("批次状态", "Batch status")}
          <select
            value={status}
            disabled={!action.ready}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="draft">{t("草稿", "Draft")}</option>
            <option value="open">{t("开放招新", "Open recruitment")}</option>
            <option value="closed">{t("关闭招新", "Close recruitment")}</option>
            <option value="archived">{t("归档", "Archive")}</option>
          </select>
        </label>
        <p id="team-recruitment-schedule-help">
          {t("时间按北京时间填写。发布时须填写未来的截止时间。开始时间留空时，发布后立即接收申请。", "Times are Beijing time. Publishing requires a future deadline. With no start time, applications open on publishing.")}
        </p>
        <div className="signup-times">
          {(["start", "end"] as const).map((key) => (
            <label key={key}>
              {key === "start" ? t("报名开始时间（选填）", "Sign-up opens (optional)") : t("报名截止时间", "Sign-up deadline")}
              <input
                type="datetime-local"
                value={beijingInputTime(schedule[key])}
                disabled={!action.ready}
                required={publishing && key === "end"}
                aria-describedby="team-recruitment-schedule-help"
                onChange={(event) => {
                  const time = Date.parse(
                    `${event.currentTarget.value}+08:00`,
                  );
                  const value = Number.isFinite(time)
                    ? new Date(time).toISOString()
                    : "";
                  setSchedule((current) => ({ ...current, [key]: value }));
                }}
              />
            </label>
          ))}
        </div>
        {publishing && <p>{t("发布会启用选拔问卷，在报名时间内接收申请。", "Publishing enables the tryout questionnaire and accepts applications during the sign-up window.")}</p>}
        <button type="submit" className="button" disabled={action.blocked}>
          {action.busy ? t("正在提交…", "Submitting…") : publishing ? t("发布招新", "Publish recruitment") : t("保存招新批次", "Save recruitment batch")}
        </button>
        <TeamActionFeedback
          action={action}
          reviewHref={`/teams/manage/${teamID}`}
        />
      </form>
    </section>
  );
}
export type TeamCoreReceipt = {
  id: number;
  status: string;
  updatedAt: string;
  formVersion: string;
  formSnapshot: unknown;
  answers: unknown;
  reviewNote: string | null;
};
export function TeamCoreAnswers({
  form,
  answers,
}: {
  form: SignupForm;
  answers: Answers;
}) {
  const t = useT();
  return (
    <dl className={styles.answers}>
      {form.questions
        .filter((q) => Object.hasOwn(answers, q.id))
        .map((q) => (
          <div key={q.id}>
            <dt>{q.label}</dt>
            <dd>{formatAnswer(answers[q.id], q) || t("未填写", "Not answered")}</dd>
          </div>
        ))}
    </dl>
  );
}
export function TeamCoreApplicant({
  id,
  form,
  version,
  state,
  readOnly = false,
  initial,
}: {
  id: number;
  form: SignupForm;
  version: string;
  state: string;
  readOnly?: boolean;
  initial: TeamCoreReceipt | null;
}) {
  const t = useT(),
    locale = useLocale();
  const [receipt, setReceipt] = useState(initial),
    [editing, setEditing] = useState(!initial || initial.status === "draft"),
    mutation = useTeamAction();
  const editable =
    !readOnly &&
    state === "招新开放" &&
    (!receipt ||
      ["draft", "pending", "returned", "withdrawn"].includes(receipt.status));
  const labels: Record<string, string> = {
    draft: t("草稿（尚未提交）", "Draft (not submitted)"),
    pending: t("待人工审核", "Pending review"),
    returned: t("退回补充", "Returned for changes"),
    rejected: t("未通过", "Not approved"),
    withdrawn: t("已撤回", "Withdrawn"),
    approved: t("已录取入队", "Accepted to the team"),
  };
  async function save(answers: Answers, action: "draft" | "submit") {
    const result = await mutation.run(
      {
        operation: "save-join",
        id,
        version,
        revision: receipt?.updatedAt,
        action,
        answers,
      },
      action === "draft"
        ? t("草稿已保存，尚未提交审核。", "Draft saved; not yet submitted for review.")
        : t("申请已提交，请等待本社群管理员人工审核。", "Application submitted. Please wait for community admins to review it."),
    );
    if (!result.ok) throw result.error;
    setReceipt(result.result.result);
    if (action === "submit") setEditing(false);
  }
  const nextStep = readOnly
    ? t("该批次或队伍已不再开放，此处保留本人的历史表单与答案。", "This batch or team is no longer open. Your past form and answers are kept here.")
    : receipt?.status === "approved"
      ? t("你已通过入队选拔。前往我的成员记录，填写简介或投稿队伍荣誉。", "You passed the tryout. Go to your member records to fill in your profile or submit team honors.")
      : receipt?.status === "pending"
        ? t("申请已提交，等待本社群管理员审核。处理意见会保留在这份回执中。", "Application submitted and awaiting admin review. Review notes will stay on this receipt.")
        : receipt?.status === "returned"
          ? t("请阅读处理意见，补充申请后重新提交。", "Read the review note, update your application and resubmit.")
          : receipt?.status === "rejected"
            ? t("本次申请未通过，请查看处理意见。", "This application was not approved. See the review note.")
            : t("填写游戏经历与训练安排，可先保存草稿，核对后再提交。", "Describe your game experience and availability. You can save a draft and submit after checking.");
  return (
    <section className={styles.receipt} aria-busy={mutation.busy}>
      <header className={styles.receiptHeader}>
        <div>
          <h2>{t("我的入队申请", "My team application")}</h2>
          <p className={styles.muted}>
            {publicLabel(state, locale)}
            {receipt ? t(`；申请编号 ${receipt.id}`, `; application #${receipt.id}`) : ""}
          </p>
        </div>
        <span className={styles.status} data-state={receipt?.status}>
          {receipt ? labels[receipt.status] : t("尚未申请", "Not applied")}
        </span>
      </header>
      <div className={styles.note}>
        <p>{nextStep}</p>
      </div>
      {receipt?.reviewNote && (
        <div className={styles.note}>
          <h3>{t("处理意见", "Review note")}</h3>
          <p className="preserve">{receipt.reviewNote}</p>
        </div>
      )}
      {receipt && !readOnly && receipt.formVersion !== version && (
        <p role="status">
          {t("申请表已更新。原提交答案和版本仍保留，修改重提时请核对新题目。", "The form has been updated. Your original answers and version are kept; check the new questions when resubmitting.")}
        </p>
      )}
      <div className={styles.receiptBody}>
        <div className={styles.receiptMain}>
          {receipt && (!editing || !editable) && (
            <section aria-label={t("已保存申请内容", "Saved application")}>
              <h3>{t("已保存的申请内容", "Saved application")}</h3>
              <TeamCoreAnswers
                form={normalizeSignup(receipt.formSnapshot)}
                answers={receipt.answers as Answers}
              />
            </section>
          )}
          {editable &&
            (editing ? (
              <Questionnaire
                key={version}
                form={form}
                initialAnswers={sanitizeDraft(
                  form,
                  (receipt?.answers ?? {}) as Answers,
                )}
                busy={!mutation.ready || mutation.busy}
                onSaveDraft={(answers) => save(answers, "draft")}
                onSubmit={(answers) => save(answers, "submit")}
                submitLabel={t("提交入队申请", "Submit team application")}
              />
            ) : (
              <div className={styles.actions}>
                <button className="button" onClick={() => setEditing(true)}>
                  {receipt?.status === "withdrawn" ||
                  receipt?.status === "returned"
                    ? t("修改并重新提交", "Edit and resubmit")
                    : t("修改申请", "Edit application")}
                </button>
              </div>
            ))}
          <TeamActionFeedback
            action={mutation}
            reviewHref={`/teams/recruitment/${id}`}
          />
          <div className={styles.actions}>
            {receipt &&
              !readOnly &&
              ["draft", "pending", "returned"].includes(receipt.status) && (
                <button
                  className="button light"
                  disabled={mutation.blocked}
                  onClick={async () => {
                    if (mutation.blocked) return;
                    const result = await mutation.run(
                      {
                        operation: "withdraw-join",
                        id: receipt.id,
                        revision: receipt.updatedAt,
                      },
                      t("申请已撤回。开放期可修改重提。", "Application withdrawn. You can edit and resubmit while recruitment is open."),
                    );
                    if (result.ok) {
                      setReceipt(result.result.result);
                      setEditing(false);
                    }
                  }}
                >
                  {t("撤回入队申请", "Withdraw application")}
                </button>
              )}
            <Link href="/teams/recruitment">{t("返回招新与我的记录", "Back to recruitment and my records")}</Link>
          </div>
          {!editable && (
            <p className={styles.muted}>
              {readOnly
                ? t("历史回执无法继续填写或提交。", "Past receipts can no longer be edited or submitted.")
                : receipt?.status === "approved"
                  ? t("请在我的代表队记录查看成员状态或办理离队。", "See your membership status or leave the team in your team records.")
                  : t("目前不能修改或重提申请，待审核申请仍可撤回。", "The application cannot be edited or resubmitted now; a pending one can still be withdrawn.")}
            </p>
          )}
        </div>
        <div className={styles.receiptAside}>
          <h3>{t("录取后的下一步", "After you are accepted")}</h3>
          <p>{t("录取后建立本队成员关系，可以填写队内简介、投稿队伍荣誉。", "Once accepted you become a team member and can fill in your team profile and submit honors.")}</p>
          <p>
            {t("可留空选填资料或移除头像，再选择是否公开整份简介。社群与平台管理任职由独立流程处理。", "Optional fields and the avatar can be left empty; then choose whether to publish the profile. Community and platform staff roles are handled separately.")}
          </p>
          <Link href="/teams/recruitment#my-team-memberships">
            {t("查看我的成员记录", "View my member records")}
          </Link>
        </div>
      </div>
    </section>
  );
}
