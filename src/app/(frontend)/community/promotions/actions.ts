"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cms } from "@/lib/content";
import { changePromotion } from "@/lib/content-promotions";
import { applicationError } from "@/lib/application-error";
import type { PromotionAction } from "@/lib/promotion-model";

export async function promotionAction(form: FormData) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const value = (key: string) => String(form.get(key) ?? "").trim();
  let message = "升推结果已保存。";
  try {
    await changePromotion(p, user, value("sourceCollection"), Number(value("sourceID")), value("action") as PromotionAction,
      { revision: value("revision"), sourceVersion: value("sourceVersion"), reason: value("reason") });
  } catch (error) { message = applicationError(error); }
  revalidatePath("/");
  revalidatePath("/community/promotions");
  redirect("/community/promotions?message=" + encodeURIComponent(message));
}
