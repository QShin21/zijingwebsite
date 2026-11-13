"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { cms } from "@/lib/content";
import { changeStaffApplication, saveStaffBatch } from "@/lib/staff-recruitment";
import { workflowFeedback } from "@/components/activity-pages/action-feedback";
import { getT } from "@/lib/i18n/server";
import { localizeMessage } from "@/lib/i18n/messages";

export async function saveStaffBatchAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const value = (key: string) => String(form.get(key) ?? "").trim(), { t, locale } = await getT();
  try {
    const saved = await saveStaffBatch(p, user, Number(value("id")) || null, value("revision"),
      { title: value("title"), description: value("description"), state: value("state"), startAt: value("startAt"), endAt: value("endAt"), signupForm: JSON.parse(value("signupForm")) });
    revalidatePath("/"); revalidatePath("/join/staff"); revalidatePath("/staff/manage");
    return { ok: true, id: saved.id, revision: saved.updatedAt, message: t("批次已保存：", "Batch saved: ") + (value("state") === "open" ? t("已发布，所有社群共用同一入口。", "published; all communities share one entry.") : value("state") === "closed" ? t("已关闭，申请保留只读。", "closed; applications stay read-only.") : t("草稿未公开。", "draft, not public.")) };
  } catch (error) { return { ok: false, message: localizeMessage(workflowFeedback(error), locale) }; }
}
export async function reviewStaffApplicationAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const value = (key: string) => String(form.get(key) ?? "").trim(), batch = Number(value("batch")), { t, locale } = await getT();
  try {
    const saved = await changeStaffApplication(p, user, batch, "review", { id: Number(value("id")), revision: value("revision"), status: value("status"), feedback: value("feedback"), reviewNotes: value("reviewNotes") });
    revalidatePath("/staff/manage");
    return { ok: true, revision: saved.updatedAt, message: t("申请处理结果已保存。普通成员录用后自动获得骨干身份。", "Decision saved. Regular members become staff once accepted.") };
  } catch (error) { return { ok: false, message: localizeMessage(workflowFeedback(error), locale) }; }
}
