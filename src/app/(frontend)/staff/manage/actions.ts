"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { cms } from "@/lib/content";
import { changeStaffApplication, saveStaffBatch } from "@/lib/staff-recruitment";
import { workflowFeedback } from "@/components/activity-pages/action-feedback";

export async function saveStaffBatchAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const value = (key: string) => String(form.get(key) ?? "").trim();
  try {
    const saved = await saveStaffBatch(p, user, Number(value("id")) || null, value("revision"),
      { title: value("title"), description: value("description"), state: value("state"), startAt: value("startAt"), endAt: value("endAt"), signupForm: JSON.parse(value("signupForm")) });
    revalidatePath("/"); revalidatePath("/join/staff"); revalidatePath("/staff/manage");
    return { ok: true, id: saved.id, revision: saved.updatedAt, message: "批次已保存：" + (value("state") === "open" ? "已发布，所有社群共用同一入口。" : value("state") === "closed" ? "已关闭，申请保留只读。" : "草稿未公开。") };
  } catch (error) { return { ok: false, message: workflowFeedback(error) }; }
}
export async function reviewStaffApplicationAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const value = (key: string) => String(form.get(key) ?? "").trim(), batch = Number(value("batch"));
  try {
    const saved = await changeStaffApplication(p, user, batch, "review", { id: Number(value("id")), revision: value("revision"), status: value("status"), feedback: value("feedback"), reviewNotes: value("reviewNotes") });
    revalidatePath("/staff/manage");
    return { ok: true, revision: saved.updatedAt, message: "申请处理结果已保存。录用状态未授予平台角色。" };
  } catch (error) { return { ok: false, message: workflowFeedback(error) }; }
}
