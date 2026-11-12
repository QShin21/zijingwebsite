import { APIError, type CollectionBeforeChangeHook, type Payload } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import type { User } from "../../payload-types";
import { managesGame } from "../rules";
import { workflowTransaction } from "../workflow-transactions";

/** datetime-local values are Beijing wall-clock times, never the server timezone. */
export function beijingScheduleTime(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new APIError("请填写有效的北京时间", 400);
  const date = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 16) !== value)
    throw new APIError("请填写有效的北京时间", 400);
  return date.toISOString();
}

export function communitySchedule(input: { startAt?: unknown; endAt?: unknown; location?: unknown }, category: unknown) {
  const date = (value: unknown) => {
    if (value == null || value === "") return null;
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
      throw new APIError("活动时间无效", 400);
    return new Date(value).toISOString();
  };
  const startAt = date(input.startAt), endAt = date(input.endAt);
  if (input.location != null && typeof input.location !== "string") throw new APIError("活动地点无效", 400);
  const location = typeof input.location === "string" ? input.location.trim() || null : null;
  if (location && location.length > 120) throw new APIError("活动地点最多 120 字", 400);
  if (category !== "event" && (startAt || endAt || location))
    throw new APIError("仅社群活动可填写时间和地点", 400);
  if (startAt && endAt && endAt <= startAt) throw new APIError("结束时间必须晚于开始时间", 400);
  return { startAt, endAt, location };
}

export const validateCommunitySchedule: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const merged = { ...originalDoc, ...data };
  const schedule = communitySchedule(merged, merged.category);
  // Legacy rows remain nullable. Do not invent dates for existing posts.
  return { ...data, ...schedule };
};

export async function updateCommunityPostSchedule(
  p: Payload,
  viewer: User | null,
  input: { id: number; revision: string; startAt?: unknown; endAt?: unknown; location?: unknown },
) {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) throw new APIError("内容不可访问", 404);
  const schedule = communitySchedule({
    startAt: beijingScheduleTime(input.startAt), endAt: beijingScheduleTime(input.endAt), location: input.location,
  }, "event");
  return workflowTransaction(p, viewer, {}, async req => {
    const db = p.db as unknown as PostgresAdapter, transactionID = await req.transactionID;
    const session = transactionID != null ? db.sessions[String(transactionID)] : null;
    if (!session) throw new APIError("暂时无法安全保存，请稍后重试", 503);
    await session.db.execute(sql`SELECT id FROM community_posts WHERE id=${input.id} FOR UPDATE`);
    const post = await p.findByID({
      collection: "community-posts", id: input.id, req, overrideAccess: false, depth: 0,
      select: { game: true, category: true, updatedAt: true },
    }).catch(() => null);
    if (!post || !managesGame(req.user, post.game)) throw new APIError("内容不可访问", 404);
    if (post.category !== "event") throw new APIError("仅社群活动可修改日程", 400);
    if (!input.revision || post.updatedAt !== input.revision) throw new APIError("内容已更新，请刷新后核对日程", 409);
    return p.update({ collection: "community-posts", id: post.id, req, overrideAccess: false, data: schedule });
  });
}
