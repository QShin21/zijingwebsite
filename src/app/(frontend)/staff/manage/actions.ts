"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cms } from "@/lib/content";
import { changeStaffApplication, saveStaffBatch } from "@/lib/staff-recruitment";
import { applicationError } from "@/lib/application-error";

export async function saveStaffBatchAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const value = (key: string) => String(form.get(key) ?? "").trim();
  let message: string;
  try {
    await saveStaffBatch(p, user, Number(value("id")) || null, value("revision"),
      { title: value("title"), description: value("description"), state: value("state"), startAt: value("startAt"), endAt: value("endAt"), signupForm: JSON.parse(value("signupForm")) });
    message = "批次已保存：" + (value("state") === "open" ? "已发布，所有社群共用同一入口。" : value("state") === "closed" ? "已关闭，申请保留只读。" : "草稿未公开。");
  } catch (error) { message = applicationError(error); }
  revalidatePath("/"); revalidatePath("/join/staff"); revalidatePath("/staff/manage");
  redirect("/staff/manage?message=" + encodeURIComponent(message));
}
export async function reviewStaffApplicationAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const value = (key: string) => String(form.get(key) ?? "").trim(), batch = Number(value("batch"));
  let message: string;
  try {
    await changeStaffApplication(p, user, batch, "review", { id: Number(value("id")), revision: value("revision"), status: value("status"), feedback: value("feedback"), reviewNotes: value("reviewNotes") });
    message = "申请处理结果已保存。录用状态未授予平台角色。";
  } catch (error) { message = applicationError(error); }
  revalidatePath("/staff/manage");
  redirect("/staff/manage?batch=" + batch + "&message=" + encodeURIComponent(message));
}
