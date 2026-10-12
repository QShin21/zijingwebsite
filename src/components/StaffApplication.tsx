"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Questionnaire } from "./Questionnaire";
import type { Answers, Question, SignupForm } from "@/lib/signup-schema";
import { formatAnswer } from "@/lib/questionnaire-model";
import { staffStatusLabels, staffDeadlinePolicy, staffPrivacy } from "@/lib/staff-recruitment-model";

type Receipt = { id: number; status: string; updatedAt: string; formVersion: string; questions: Question[]; answers: Answers; feedback?: string | null };
type Info = { form: SignupForm | null; version: string; state: string; loggedIn: boolean; draftKey?: string; application: Receipt | null };
export function StaffApplication({ batch }: { batch: number }) {
  const [info, setInfo] = useState<Info | null>(null), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const endpoint = "/api/staff/batches/" + batch + "/application";
  async function load() {
    const response = await fetch(endpoint, { cache: "no-store" }), data = await response.json();
    if (!response.ok) throw new Error(data.error); setInfo(data);
  }
  useEffect(() => { let live = true; fetch(endpoint, { cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (live) setInfo(data); }).catch(error => { if (live) setMessage(error.message); }); return () => { live = false; }; }, [endpoint]);
  const saved = info?.application, open = info?.state === "申请开放", final = saved && ["accepted", "rejected"].includes(saved.status);
  const change = async (method: string, body: unknown) => {
    const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setInfo(previous => previous ? { ...previous, application: data.application } : previous);
  };
  return <section className="panel"><h2>骨干申请与本人回执</h2><p>{staffPrivacy}</p><p>{staffDeadlinePolicy}</p><p role="status">{info?.state || "正在加载申请表…"}</p>{message && <p role="status">{message}</p>}
    {saved && <><h3>{staffStatusLabels[saved.status]} · 申请编号 {saved.id}</h3>{saved.feedback && <p>处理反馈：{saved.feedback}</p>}
      <dl className="account-details">{saved.questions.filter(question => question.type !== "description").map(question => <div key={question.id}><dt>{question.label}</dt><dd>{formatAnswer(saved.answers[question.id], question) || "未填写"}</dd></div>)}</dl>
      {open && !final && !editing && <button className="button light" disabled={busy} onClick={() => setEditing(true)}>{saved.status === "withdrawn" ? "重新提交申请" : "修改申请"}</button>}
      {open && !final && saved.status !== "withdrawn" && <button className="button light" disabled={busy} onClick={async () => {
        setBusy(true); try { await change("POST", { action: "withdraw", revision: saved.updatedAt }); setEditing(false); setMessage("申请已撤回，开放期间可重提同一记录。"); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
      }}>撤回申请</button>}
      <button className="button light" disabled={busy} onClick={async () => { try { await load(); setEditing(false); setMessage("本人回执已刷新。"); } catch (error) { setMessage((error as Error).message); } }}>刷新回执</button>
    </>}
    {editing && <button type="button" onClick={() => setEditing(false)} disabled={busy}>取消修改</button>}
    {info?.form && open && (!saved || editing) && (!info.loggedIn ? <Link href="/login">登录后提交骨干申请</Link> : <Questionnaire key={info.version + ":" + (editing ? saved?.updatedAt : "new")}
      form={info.form} initialAnswers={editing ? saved?.answers : undefined} draftKey={editing ? undefined : info.draftKey} busy={busy} submitLabel={editing ? "保存申请并提交" : "提交骨干申请"}
      onSubmit={async answers => {
        setBusy(true); setMessage("");
        try { await change(saved?.status === "withdrawn" ? "POST" : editing ? "PATCH" : "POST", { version: info.version, revision: saved?.updatedAt, answers }); setEditing(false); setMessage("骨干申请已提交，请查看本人回执。"); }
        catch (error) { setMessage((error as Error).message); throw error; } finally { setBusy(false); }
      }} />)}
  </section>;
}
