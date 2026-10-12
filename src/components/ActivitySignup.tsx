"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SignupForm, Question, Answers } from "@/lib/signup-schema";
import { QuestionnaireResults } from "./QuestionnaireResults";
import { SignupBuilder } from "./SignupBuilder";
import { formatAnswer } from "@/lib/questionnaire-model";
import { Questionnaire } from "./Questionnaire";
type Receipt = {
  id: number;
  createdAt: string;
  updatedAt: string;
  formVersion: string;
  memberName?: string;
  questions: Question[];
  answers: Answers;
};
type Info = {
  title: string;
  form: SignupForm;
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
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "请求未完成，请重试");
  return value;
}
function ReceiptView({ receipt }: { receipt: Receipt }) {
  return (
    <div>
      <p>
        报名编号：{receipt.id} ·{" "}
        {new Date(receipt.createdAt).toLocaleString("zh-CN")}
      </p>
      {receipt.updatedAt !== receipt.createdAt && (
        <p>最近修改：{new Date(receipt.updatedAt).toLocaleString("zh-CN")}</p>
      )}
      <dl>
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
export function ActivitySignup({ kind, id }: { kind: string; id: number }) {
  const endpoint = `/api/activities/${kind}/${id}/signup`,
    [info, setInfo] = useState<Info | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [savedMessage, setSavedMessage] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    signupRequest(endpoint)
      .then((v) => {
        if (alive) {
          setInfo(v);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [endpoint, retry]);
  if (!info)
    return (
      <section className="panel">
        <p role="status">{error || "正在加载报名信息…"}</p>
        {error && <button onClick={() => setRetry(retry + 1)}>重试</button>}
      </section>
    );
  if (!info.form.enabled && !info.canManage && !info.canViewSignups && !info.signup) return null;
  return (
    <section className="panel activity-signup">
      <h2>{info.form.title || "活动报名"}</h2>
      {info.canManage && (
        <p>
          <Link href={`/activities/${kind}/${id}/manage`}>
            管理报名问卷 ↗
          </Link>
        </p>
      )}
      {!info.canManage && info.canViewSignups && (
        <p><Link href={`/activities/${kind}/${id}/signups`}>查看报名与统计 ↗</Link></p>
      )}
      {info.signup && !editing ? (
        <>
          <h3 aria-live="polite">已报名</h3>
          <p>{info.form.completionMessage || "已收到你的报名信息。"}</p>
          <ReceiptView receipt={info.signup} />
          {info.state === "报名开放" && info.loggedIn ? (
            <button type="button" className="button" onClick={() => {
              setEditing(true);
              setSavedMessage("");
            }}>修改作答</button>
          ) : <p className="muted">{info.state}，暂不能修改作答。</p>}
          <p role="status">{savedMessage}</p>
        </>
      ) : (
        <>
          <p className="preserve">{info.form.intro}</p>
          <p>{info.state}</p>
          {editing && (
            <>
              <h3>修改作答</h3>
              <p>已带入上次提交的内容，请修改后再次核对并提交。提交成功前保留原作答。</p>
              {info.signup?.formVersion !== info.version && <p role="status">问卷已更新，请检查保留的答案并补充新题目。</p>}
              <button type="button" disabled={busy} onClick={() => setEditing(false)}>取消修改</button>
              <button type="button" disabled={busy} onClick={async () => {
                setBusy(true);
                try {
                  setInfo(await signupRequest(endpoint));
                  setEditing(false);
                  setSavedMessage("已重新加载上次提交的内容，可再次进入修改。");
                  setError("");
                } catch (cause) { setError((cause as Error).message); }
                finally { setBusy(false); }
              }}>重新加载已提交内容</button>
              <p role="alert">{error}</p>
            </>
          )}
          <p className="muted">
            提交的答案仅供你本人和有权限的活动管理者查看，用于本次活动组织。
          </p>
          {info.form.enabled &&
            info.state === "报名开放" &&
            (!info.loggedIn ? (
              <Link className="button" href="/login">
                登录后填写报名
              </Link>
            ) : (
              <Questionnaire
                key={`${info.version}:${editing ? info.signup?.updatedAt : "new"}`}
                form={info.form}
                initialAnswers={editing ? info.signup?.answers : undefined}
                draftKey={editing ? undefined : info.draftKey}
                submitLabel={editing ? "提交修改" : "提交并确认报名"}
                busy={busy}
                onSubmit={async (answers) => {
                  setBusy(true);
                  try {
                    const result = await signupRequest(endpoint, editing ? "PATCH" : "POST", {
                      version: info.version,
                      ...(editing ? { revision: info.signup?.updatedAt } : {}),
                      answers,
                    });
                    setInfo({ ...info, signup: result.signup });
                    setEditing(false);
                    setSavedMessage(result.message);
                  } finally {
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
export function SignupManager({ kind, id, readOnly = false }: { kind: string; id: number; readOnly?: boolean }) {
  const endpoint = `/api/activities/${kind}/${id}/signup`,
    [info, setInfo] = useState<Info | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [entries, setEntries] = useState<Receipt[]>([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(0),
    [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    signupRequest(endpoint + (readOnly ? "?mode=view" : "?mode=manage"))
      .then(setInfo)
      .catch((e) => setMessage(e.message));
  }, [endpoint, readOnly]);
  async function loadEntries(n: number) {
    setBusy(true);
    try {
      const r = await signupRequest(endpoint + "?mode=entries&page=" + n);
      setEntries(r.docs);
      setPage(n);
      setPages(r.totalPages);
      setTotal(r.totalDocs);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="signup-management">
      <h1>{info?.title || "活动报名管理"}</h1>
      <p role="status">{message}</p>
      {info && (
        <div className="signup-tools">
          <Link href={`/activities/${kind}/${id}/fill`}>打开填写页</Link>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/activities/${kind}/${id}/fill`,
                );
                setMessage("填写链接已复制");
              } catch {
                setMessage("无法自动复制，请打开填写页后复制浏览器地址");
              }
            }}
          >
            复制填写链接
          </button>
          <Link href="/activities">返回问卷工作台</Link>
        </div>
      )}
      {info && (
        <>
          {!readOnly && info.canManage && <form
            className="member-form panel"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setMessage("");
              try {
                const r = await signupRequest(endpoint, "PUT", {
                  version: info.version,
                  form: info.form,
                });
                setInfo({ ...info, form: r.form, version: r.version });
                setMessage(r.message);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <SignupBuilder
              value={info.form}
              onChange={(form) => setInfo({ ...info, form })}
            />
            <button disabled={busy} className="button">
              {busy ? "正在保存…" : "保存报名问卷"}
            </button>
          </form>}
          {readOnly && <p className="panel">此入口仅查看报名与统计；导出按单独授权开放。</p>}
          {info.canViewSignups && <QuestionnaireResults
            endpoint={endpoint}
            questions={info.form.questions}
            canExport={info.canExportSignups}
          />}
          {info.canViewSignups ? <section className="panel">
            <h2>报名名单{total !== null ? `（${total} 人）` : ""}</h2>
            <button
              className="button light"
              disabled={busy}
              onClick={() => loadEntries(1)}
            >
              查看 / 刷新报名名单
            </button>
            {entries.map((record) => (
              <details key={record.id}>
                <summary>
                  {record.memberName} · 报名编号 {record.id}
                </summary>
                <ReceiptView receipt={record} />
              </details>
            ))}
            {total === 0 && <p>暂无报名。</p>}
            {pages > 1 && (
              <div className="signup-tools">
                <button
                  disabled={busy || page <= 1}
                  onClick={() => loadEntries(page - 1)}
                >
                  上一页
                </button>
                <span>
                  {page} / {pages}
                </span>
                <button
                  disabled={busy || page >= pages}
                  onClick={() => loadEntries(page + 1)}
                >
                  下一页
                </button>
              </div>
            )}
          </section> : <p className="panel">你可维护报名问卷。读取或导出个人报名需社长单独授权。</p>}
        </>
      )}
    </section>
  );
}
