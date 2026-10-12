"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Questionnaire } from "./Questionnaire";
import { SignupBuilder } from "./SignupBuilder";
import {
  normalizeSignup,
  type Answers,
  type SignupForm,
} from "@/lib/signup-schema";
import { sanitizeDraft, formatAnswer } from "@/lib/questionnaire-model";

export async function teamRequest(data: Record<string, unknown>) {
  const response = await fetch("/api/team-core", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "操作未完成，请重试");
  return result;
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
  const router = useRouter(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="member-form team-core-operation"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const values = new FormData(e.currentTarget);
        setBusy(true);
        setMessage("");
        try {
          await teamRequest({
            operation,
            id,
            revision,
            status,
            note: values.get("note"),
          });
          setMessage("已保存。");
          router.refresh();
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {noteRequired && (
        <label>
          {operation === "revoke" ? "撤销原因" : "处理说明"}
          <textarea name="note" required maxLength={1000} rows={2} />
        </label>
      )}
      <button className="button light" disabled={busy}>
        {busy ? "正在保存…" : label}
      </button>
      <p role="status">{message}</p>
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
  const router = useRouter(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="member-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const native = e.nativeEvent as SubmitEvent,
          button = native.submitter as HTMLButtonElement | null;
        const decision = button?.value,
          form = new FormData(e.currentTarget);
        if (!decision) return;
        setBusy(true);
        setMessage("");
        try {
          await teamRequest({
            operation: `decide-${kind}`,
            id,
            revision,
            decision,
            note: form.get("note"),
          });
          setMessage("审核结果已保存。");
          router.refresh();
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        审核意见（退回 / 未通过时必填）
        <textarea name="note" maxLength={1000} rows={3} />
      </label>
      <div className="signup-tools">
        <button
          className="button"
          name="decision"
          value="approved"
          disabled={busy}
        >
          批准{kind === "join" ? "入队" : "建队"}
        </button>
        <button
          className="button light"
          name="decision"
          value="returned"
          disabled={busy}
        >
          退回补充
        </button>
        <button
          className="button light"
          name="decision"
          value="rejected"
          disabled={busy}
        >
          未通过
        </button>
      </div>
      <p role="status">{message}</p>
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
  const router = useRouter(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  if (!games.length)
    return (
      <p>
        你目前没有可申请建队的社群任职。可先
        <Link href="/community/apply">申请参与社群管理</Link>。
      </p>
    );
  if (saved)
    return (
      <div role="status">
        <h2>建队申请已提交</h2>
        <p>请在下方查看状态与处理意见，等待高权限管理人员审核。</p>
        <Link href="/teams/manage">返回代表队工作台</Link>
      </div>
    );
  return (
    <form
      className="member-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const values = new FormData(e.currentTarget);
        setBusy(true);
        setMessage("");
        try {
          await teamRequest({
            operation: "establish",
            id: initial?.id,
            revision: initial?.revision,
            gameID: initial?.gameID ?? values.get("gameID"),
            title: values.get("title"),
            reason: values.get("reason"),
          });
          setSaved(true);
          router.refresh();
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{initial ? "修改并重新提交建队申请" : "申请建立代表队"}</h2>
      <label>
        游戏社群
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
        拟用队名
        <input
          name="title"
          required
          minLength={2}
          maxLength={80}
          defaultValue={initial?.title}
        />
      </label>
      <label>
        组织与训练计划
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
        描述组织安排和训练计划即可。批准建队不授予新的管理角色，也不宣称未经核实的学校官方资格。
      </p>
      <button className="button" disabled={busy}>
        {busy ? "正在提交…" : "提交建队申请"}
      </button>
      <p role="status">{message}</p>
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
  const router = useRouter(),
    [form, setForm] = useState(initial?.form ?? defaultForm),
    [title, setTitle] = useState(initial?.title ?? "代表队新一轮招新"),
    [status, setStatus] = useState(initial?.status ?? "draft"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="team-core-editor">
      <h2>{initial ? "编辑招新批次" : "建立招新批次"}</h2>
      <label className="member-form">
        批次名称
        <input
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <p>
        核心资料为游戏
        ID、位置、经历、训练时间和一种联系方式。可修改提示和加入选拔题；核心题须可达。开放时须设置未来截止时间。
      </p>
      <SignupBuilder value={form} onChange={setForm} />
      <div className="member-form">
        <label>
          批次状态
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">草稿</option>
            <option value="open">开放招新</option>
            <option value="closed">关闭招新</option>
            <option value="archived">归档</option>
          </select>
        </label>
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              await teamRequest({
                operation: "save-recruitment",
                teamID,
                id: initial?.id,
                revision: initial?.revision,
                title,
                status,
                form,
              });
              setMessage("批次已保存。");
              router.push(`/teams/manage/${teamID}`);
              router.refresh();
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "正在保存…" : "保存招新批次"}
        </button>
        <p role="status">{message}</p>
      </div>
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
  return (
    <dl className="team-core-answers">
      {form.questions
        .filter((q) => Object.hasOwn(answers, q.id))
        .map((q) => (
          <div key={q.id}>
            <dt>{q.label}</dt>
            <dd>{formatAnswer(answers[q.id], q) || "未填写"}</dd>
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
  initial,
}: {
  id: number;
  form: SignupForm;
  version: string;
  state: string;
  initial: TeamCoreReceipt | null;
}) {
  const [receipt, setReceipt] = useState(initial),
    [editing, setEditing] = useState(!initial || initial.status === "draft"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const editable =
    state === "招新开放" &&
    (!receipt ||
      ["draft", "pending", "returned", "withdrawn"].includes(receipt.status));
  const labels: Record<string, string> = {
    draft: "草稿（尚未提交）",
    pending: "待人工审核",
    returned: "退回补充",
    rejected: "未通过",
    withdrawn: "已撤回",
    approved: "已录取入队",
  };
  async function save(answers: Answers, action: "draft" | "submit") {
    setBusy(true);
    setMessage("");
    try {
      const result = await teamRequest({
        operation: "save-join",
        id,
        version,
        revision: receipt?.updatedAt,
        action,
        answers,
      });
      setReceipt(result.result);
      if (action === "submit") setEditing(false);
      setMessage(
        action === "draft"
          ? "草稿已保存，尚未提交审核。"
          : "申请已提交，请等待本社群管理员人工审核。",
      );
    } catch (error) {
      setMessage((error as Error).message);
      throw error;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>我的入队申请</h2>
      <p>
        {state} · {receipt ? labels[receipt.status] : "尚未申请"}
      </p>
      <p>
        批准入队只产生代表队成员关系。普通入社、骨干招新和代表队招新分别处理；公开简介另行取得授权。
      </p>
      {receipt?.reviewNote && (
        <p className="preserve">处理意见：{receipt.reviewNote}</p>
      )}
      {receipt && receipt.formVersion !== version && (
        <p role="status">
          申请表已更新。原提交答案和版本仍保留，修改重提时请核对新题目。
        </p>
      )}
      {receipt && !editing && (
        <>
          <p>申请编号：{receipt.id}</p>
          <TeamCoreAnswers
            form={normalizeSignup(receipt.formSnapshot)}
            answers={receipt.answers as Answers}
          />
        </>
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
            busy={busy}
            onSaveDraft={(answers) => save(answers, "draft")}
            onSubmit={(answers) => save(answers, "submit")}
            submitLabel="提交入队申请"
          />
        ) : (
          <button className="button" onClick={() => setEditing(true)}>
            {receipt?.status === "withdrawn" || receipt?.status === "returned"
              ? "修改并重新提交"
              : "修改申请"}
          </button>
        ))}
      {receipt && ["draft", "pending", "returned"].includes(receipt.status) && (
        <button
          className="button light"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              const result = await teamRequest({
                operation: "withdraw-join",
                id: receipt.id,
                revision: receipt.updatedAt,
              });
              setReceipt(result.result);
              setEditing(false);
              setMessage("申请已撤回。开放期可修改重提。");
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          撤回入队申请
        </button>
      )}
      {!editable && (
        <p>
          {receipt?.status === "approved"
            ? "请在我的代表队记录查看成员状态或办理离队。"
            : "目前不能修改或重提申请，待审核申请仍可撤回。"}
        </p>
      )}
      <p role="status">{message}</p>
      <Link href="/teams/recruitment">返回招新与我的记录</Link>
    </section>
  );
}
