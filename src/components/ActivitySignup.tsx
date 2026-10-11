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
  if (!info.form.enabled && !info.canManage && !info.signup) return null;
  return (
    <section className="panel activity-signup">
      <h2>{info.form.title || "活动报名"}</h2>
      {info.canManage && (
        <p>
          <Link href={`/activities/${kind}/${id}/manage`}>
            编辑报名问卷 / 查看报名名单 ↗
          </Link>
        </p>
      )}
      {info.signup ? (
        <>
          <h3 aria-live="polite">已报名</h3>
          <p>{info.form.completionMessage || "已收到你的报名信息。"}</p>
          <ReceiptView receipt={info.signup} />
        </>
      ) : (
        <>
          <p className="preserve">{info.form.intro}</p>
          <p>{info.state}</p>
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
                key={info.version}
                form={info.form}
                draftKey={info.draftKey}
                busy={busy}
                onSubmit={async (answers) => {
                  setBusy(true);
                  try {
                    const result = await signupRequest(endpoint, "POST", {
                      version: info.version,
                      answers,
                    });
                    setInfo({ ...info, signup: result.signup });
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
export function SignupManager({ kind, id }: { kind: string; id: number }) {
  const endpoint = `/api/activities/${kind}/${id}/signup`,
    [info, setInfo] = useState<Info | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [entries, setEntries] = useState<Receipt[]>([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(0),
    [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    signupRequest(endpoint + "?mode=manage")
      .then(setInfo)
      .catch((e) => setMessage(e.message));
  }, [endpoint]);
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
          <form
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
          </form>
          <QuestionnaireResults
            endpoint={endpoint}
            questions={info.form.questions}
          />
          <section className="panel">
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
          </section>
        </>
      )}
    </section>
  );
}
