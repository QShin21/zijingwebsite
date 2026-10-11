import { APIError, createLocalReq, type Payload, type PayloadRequest } from "payload";
import type { User } from "../payload-types";
import { canParticipate } from "./rules";

export function databaseCode(error: unknown, code: string) {
  let cause = error;
  for (let i = 0; i < 8 && cause && typeof cause === "object"; i++) {
    if ("code" in cause && cause.code === code) return true;
    cause = "cause" in cause ? cause.cause : null;
  }
  return false;
}
export function uniqueFieldError(error: unknown, field: string) {
  if (!error || typeof error !== "object" || !("data" in error) || !error.data || typeof error.data !== "object" || !("errors" in error.data) || !Array.isArray(error.data.errors)) return false;
  return error.data.errors.some((item: unknown) => item && typeof item === "object" && "path" in item && item.path === field && "message" in item && typeof item.message === "string" && /unique|唯一/i.test(item.message));
}

// Re-read the actor inside the transaction. Callers never supply context from HTTP.
export async function workflowTransaction<T>(p: Payload, actor: User | null, context: Record<string, unknown>, work: (req: PayloadRequest) => Promise<T>) {
  if (!canParticipate(actor)) throw new APIError("请先登录可用账号", 401);
  const transactionID = await p.db.beginTransaction({ isolationLevel: "serializable" });
  if (transactionID == null) throw new APIError("暂时无法保存，请稍后重试", 503);
  const req = await createLocalReq({ context }, p);
  req.transactionID = transactionID;
  try {
    const user = await p.findByID({ collection: "users", id: actor!.id, req, overrideAccess: true, depth: 0 });
    if (!canParticipate(user)) throw new APIError("账号已停用，请联系负责人", 403);
    req.user = { ...user, collection: "users" };
    const result = await work(req);
    await p.db.commitTransaction(transactionID);
    return result;
  } catch (error) {
    await p.db.rollbackTransaction(transactionID);
    if (databaseCode(error, "40001") || databaseCode(error, "40P01")) throw new APIError("记录已更新，请刷新后重试", 409);
    if (databaseCode(error, "23505")) throw new APIError("已有同一申请，请在我的申请中继续处理", 409);
    throw error;
  }
}
