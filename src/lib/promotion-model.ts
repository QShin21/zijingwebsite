import { createHash } from "node:crypto";
import { APIError } from "payload";

export type PromotionKind = "event" | "notice" | "showcase";
export type PromotionSource = "community-posts" | "community-showcase";
export type PromotionAction = "submit" | "withdraw" | "approve" | "return" | "reject" | "promote" | "demote";
export type PromotionSnapshot = { title: string; body: string; authorName: string; kind: PromotionKind; game: number };
export type PromotionHistory = { action: string; actor: string; actorName: string; at: string; from: string; to: string; reason: string; version: string };
// Enable one validated content slice at a time. The additive schema supports all three.
export const supportedPromotionKinds: PromotionKind[] = ["event"];
export const promotionKindLabels = { event: "活动", notice: "公告", showcase: "风采" };
export const promotionStatusLabels: Record<string, string> = { pending: "待审核", returned: "已退回", rejected: "已拒绝", withdrawn: "已撤回", approved: "已升推", demoted: "已降级", needsReview: "改稿待复审" };
export function promotionSource(value: unknown): PromotionSource {
  if (value !== "community-posts" && value !== "community-showcase") throw new APIError("升推来源无效", 400);
  return value;
}
export function promotionKey(collection: PromotionSource, id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new APIError("内容编号无效", 400);
  return collection + ":" + id;
}
export function promotionVersion(value: Record<string, unknown>) {
  // Bind public content and the original questionnaire; no answers or private identity fields.
  const keys = ["title", "body", "game", "status", "category", "authorName", "signupForm", "images", "videoURL"];
  return createHash("sha256").update(JSON.stringify(Object.fromEntries(keys.map(key => [key, value[key] ?? null])))).digest("hex");
}
