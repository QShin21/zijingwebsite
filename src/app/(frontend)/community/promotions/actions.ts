"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { cms } from "@/lib/content";
import { changePromotion } from "@/lib/content-promotions";
import { workflowFeedback } from "@/components/activity-pages/action-feedback";
import type { PromotionAction } from "@/lib/promotion-model";

export async function promotionAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const value = (key: string) => String(form.get(key) ?? "").trim();
  try {
    const action = value("action") as PromotionAction;
    await changePromotion(p, user, value("sourceCollection"), Number(value("sourceID")), action,
      { revision: value("revision"), sourceVersion: value("sourceVersion"), reason: value("reason") });
    const results: Record<PromotionAction, string> = { submit: "申请已提交，等待审核。", withdraw: "申请已撤回。", approve: "审核通过，已升推。", return: "已退回修改。", reject: "已拒绝升推。", promote: "已主动升推。", demote: "已降为社群展示。" };
    revalidatePath("/"); revalidatePath("/community/promotions");
    const message = "升推结果已保存：" + results[action];
    const requested = new URLSearchParams(value("returnQuery")), query = new URLSearchParams();
    if (requested.get("view") === "review") query.set("view", "review");
    const source = requested.get("source"), id = requested.get("id"), page = requested.get("page");
    if (source === "community-posts" || source === "community-showcase") query.set("source", source);
    if (id && /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0) query.set("id", id);
    if (page && /^\d+$/.test(page) && Number(page) > 0 && Number(page) <= 10000) query.set("page", page);
    query.set("message", message);
    return { ok: true, message, successHref: "/community/promotions?" + query.toString() };
  } catch (error) { return { ok: false, message: workflowFeedback(error) }; }
}
