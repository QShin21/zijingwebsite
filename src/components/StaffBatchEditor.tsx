"use client";
import { useState } from "react";
import type { StaffBatch } from "@/payload-types";
import { SignupBuilder } from "./SignupBuilder";
import { SubmitButton } from "./SubmitButton";
import { defaultStaffForm, staffForm } from "@/lib/staff-recruitment-model";
import { saveStaffBatchAction } from "@/app/(frontend)/staff/manage/actions";

const localDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function StaffBatchEditor({ batch }: { batch?: StaffBatch }) {
  const [form, setForm] = useState(() => batch ? staffForm(batch.signupForm) : defaultStaffForm);
  const [start, setStart] = useState(localDate(batch?.startAt)), [end, setEnd] = useState(localDate(batch?.endAt));
  return <details className="panel"><summary>{batch ? "配置批次：" + batch.title : "创建骨干招新批次"}</summary>
    <form action={saveStaffBatchAction} className="member-form">
      <input type="hidden" name="id" value={batch?.id ?? ""} /><input type="hidden" name="revision" value={batch?.updatedAt ?? ""} />
      <label>批次标题<input name="title" required maxLength={120} defaultValue={batch?.title ?? ""} /></label>
      <label>批次说明<textarea name="description" maxLength={5000} rows={4} defaultValue={batch?.description ?? ""} /></label>
      <label>开始时间<input type="datetime-local" value={start} onChange={event => setStart(event.target.value)} /></label>
      <label>截止时间<input type="datetime-local" value={end} onChange={event => setEnd(event.target.value)} /></label>
      <input type="hidden" name="startAt" value={start ? new Date(start).toISOString() : ""} /><input type="hidden" name="endAt" value={end ? new Date(end).toISOString() : ""} />
      <p>同一时间只发布一个当前批次。截止与关闭后申请只读；已录用/未录用结果需明确退回后才允许补充。</p>
      <SignupBuilder value={form} onChange={setForm} /><input type="hidden" name="signupForm" value={JSON.stringify(form)} />
      <p>保留必要资料与执行/宣传选择。不要求身份证、住址或健康信息。</p>
      <div className="reaction-bar"><SubmitButton name="state" value="draft" className="button light">保存草稿</SubmitButton>
        <SubmitButton name="state" value="open">发布骨干招新</SubmitButton><SubmitButton name="state" value="closed" className="button light" disabled={!batch}>关闭批次</SubmitButton></div>
    </form>
  </details>;
}
