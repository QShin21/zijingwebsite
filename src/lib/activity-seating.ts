
import { randomUUID } from "node:crypto";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
import { APIError, type Payload } from "payload";
import type { User } from "@/payload-types";
import {
  seatKeys, seatLimit, seatPhonePattern, seatProofBytes, seatProofID, seatProofLimit, seatRows,
  type SeatDecision, type SeatRequest, type SeatStatus, type SeatingKind, type SeatingState,
  type SeatingWorkbench,
} from "./activity-seating-model";
import { canParticipate, canPublish, communityIDs, relationID } from "./rules";
import { normalizeImageBytes } from "./showcase-images";

type SeatActivity = {
  kind: SeatingKind;
  id: number;
  title: string;
  game: unknown;
  public: boolean;
  open: boolean;
};

type SeatDatabase = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

type SeatScope = { id: number; enabled: boolean };
type ActiveStatus = Exclude<SeatStatus, "rejected">;
type RequestRow = {
  id: number;
  seats: string[];
  status: SeatStatus;
  created_at: Date;
  reviewed_at: Date | null;
};
type ReviewRow = RequestRow & { member_name: string; phone: string; proofs: string[] };
const rowFields = "id, seats, status, created_at, reviewed_at";
const validSeats = new Set(seatKeys);
const pool = (p: Payload) => (p.db as unknown as PostgresAdapter).pool;

export function canReviewActivitySeats(user: User | null, game: unknown) {
  return canPublish(user) || communityIDs(user).includes(String(relationID(game)));
}

export async function seatActivity(
  p: Payload, kind: SeatingKind, id: number, viewer: User | null = null,
): Promise<SeatActivity> {
  const access = { id, user: viewer, overrideAccess: false as const, depth: 0, disableErrors: true as const };
  if (kind === "events") {
    const event = await p.findByID({
      collection: kind, ...access, draft: false,
      select: { title: true, game: true, _status: true, demo: true, lifecycle: true, archived: true, endAt: true },
    });
    if (!event) throw new APIError("活动未公开或已移除", 404);
    const visible = event._status === "published" && !(process.env.APP_ENV === "production" && event.demo);
    return {
      kind, id, title: event.title, game: event.game, public: visible,
      open: visible && !event.archived &&
        !["cancelled", "postponed", "ended"].includes(event.lifecycle || "") &&
        (!event.endAt || Date.parse(event.endAt) > Date.now()),
    };
  }
  const post = await p.findByID({
    collection: kind, ...access,
    select: { title: true, game: true, category: true, status: true },
  });
  if (!post || post.category !== "event") throw new APIError("活动未公开或已移除", 404);
  const visible = post.status === "visible";
  return { kind, id, title: post.title, game: post.game, public: visible, open: visible };
}

function requireMember(user: User | null) {
  if (!user || !canParticipate(user)) throw new APIError("请先登录可用账号", 401);
  return user;
}

function requireReviewer(activity: SeatActivity, user: User | null) {
  const actor = requireMember(user);
  if (!canReviewActivitySeats(actor, activity.game)) throw new APIError("无权审核此活动的选座申请", 403);
  return actor;
}

function requirePublic(activity: SeatActivity) {
  if (!activity.public) throw new APIError("活动未公开或已移除", 404);
}

const scopeColumn = (activity: SeatActivity) => activity.kind === "events" ? "event_id" : "post_id";

async function scope(p: Payload, activity: SeatActivity, client?: SeatDatabase) {
  const result = await ((client ?? pool(p)) as SeatDatabase).query<SeatScope>(
    `SELECT id, enabled FROM activity_seatings WHERE ${scopeColumn(activity)} = $1${client ? " FOR UPDATE" : ""}`,
    [activity.id],
  );
  return result.rows[0];
}

async function transaction<T>(p: Payload, work: (client: SeatDatabase) => Promise<T>) {
  const client = await pool(p).connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function requestDTO(row: RequestRow): SeatRequest {
  return {
    id: row.id, seats: row.seats, status: row.status,
    createdAt: row.created_at.toISOString(), reviewedAt: row.reviewed_at?.toISOString() ?? null,
  };
}

async function activeRequest(client: SeatDatabase, seatingID: number, memberID: number) {
  const result = await client.query<RequestRow>(
    `SELECT ${rowFields} FROM activity_seat_requests
     WHERE seating_id = $1 AND member_id = $2 AND status <> 'rejected'`,
    [seatingID, memberID],
  );
  return result.rows[0];
}

async function openScope(p: Payload, activity: SeatActivity, client: SeatDatabase) {
  const setting = await scope(p, activity, client);
  if (!activity.open || !setting?.enabled) throw new APIError("当前活动暂未开放选座", 409);
  return setting;
}

export async function seatingState(p: Payload, activity: SeatActivity, user: User | null): Promise<SeatingState> {
  requirePublic(activity);
  const setting = await scope(p, activity);
  const loggedIn = Boolean(user && canParticipate(user));
  const state: SeatingState = {
    enabled: Boolean(setting?.enabled), open: Boolean(setting?.enabled && activity.open), loggedIn,
    canReview: canReviewActivitySeats(user, activity.game), title: activity.title, rows: seatRows,
    seatLimit, proofLimit: seatProofLimit, proofBytes: seatProofBytes, occupancy: {}, mine: null, drafts: [],
  };
  if (!setting) return state;
  const [claims, mine, drafts] = await Promise.all([
    setting.enabled ? pool(p).query<{ seat: string; status: ActiveStatus }>(
      `SELECT c.seat, r.status FROM activity_seat_claims c
       JOIN activity_seat_requests r ON r.id = c.request_id WHERE c.seating_id = $1`,
      [setting.id],
    ) : null,
    loggedIn ? pool(p).query<RequestRow>(
      `SELECT ${rowFields} FROM activity_seat_requests
       WHERE seating_id = $1 AND member_id = $2 ORDER BY id DESC LIMIT 1`,
      [setting.id, user!.id],
    ) : null,
    loggedIn && setting.enabled ? pool(p).query<{ id: string }>(
      `SELECT id FROM activity_seat_proofs WHERE seating_id = $1 AND member_id = $2
       AND request_id IS NULL AND created_at >= now() - interval '1 day' ORDER BY created_at, id`,
      [setting.id, user!.id],
    ) : null,
  ]);
  state.occupancy = Object.fromEntries(claims?.rows.map(({ seat, status }) => [seat, status]) || []);
  if (mine?.rows[0]) state.mine = requestDTO(mine.rows[0]);
  state.drafts = drafts?.rows.map(({ id }) => id) || [];
  return state;
}

export async function setSeating(p: Payload, activity: SeatActivity, user: User | null, enabled: unknown) {
  requireReviewer(activity, user);
  if (typeof enabled !== "boolean") throw new APIError("请指定选座启用状态", 400);
  if (enabled) requirePublic(activity);
  const column = scopeColumn(activity);
  await pool(p).query(
    `INSERT INTO activity_seatings (${column}, enabled) VALUES ($1, $2)
     ON CONFLICT (${column}) DO UPDATE SET enabled = EXCLUDED.enabled`,
    [activity.id, enabled],
  );
  return { enabled };
}

export async function submitSeats(
  p: Payload, activity: SeatActivity, user: User | null, data: Record<string, unknown>,
) {
  const actor = requireMember(user);
  requirePublic(activity);
  const seats = data.seats;
  if (!Array.isArray(seats) || !seats.length || seats.length > seatLimit ||
      seats.some(seat => typeof seat !== "string" || !validSeats.has(seat)) ||
      new Set(seats).size !== seats.length)
    throw new APIError(`请选择 1 至 ${seatLimit} 个不同的有效座位`, 400);
  const phone = typeof data.phone === "string" ? data.phone.trim().replace(/[\s-]/g, "") : "";
  if (!seatPhonePattern.test(phone)) throw new APIError("请输入有效的手机号", 400);
  const proofs = data.proofs;
  if (!Array.isArray(proofs) || !proofs.length || proofs.length > seatProofLimit ||
      proofs.some(id => typeof id !== "string" || !seatProofID.test(id)) ||
      new Set(proofs).size !== proofs.length)
    throw new APIError(`请上传 1 至 ${seatProofLimit} 张活动参与凭证`, 400);

  return transaction(p, async client => {
    const setting = await openScope(p, activity, client);
    const existing = await activeRequest(client, setting.id, actor.id);
    if (existing) return requestDTO(existing);
    const busy = await client.query(
      "SELECT 1 FROM activity_seat_claims WHERE seating_id = $1 AND seat = ANY($2::text[]) LIMIT 1",
      [setting.id, seats],
    );
    if (busy.rowCount) throw new APIError("部分座位刚被选走，请刷新座位图后重新选择", 409);
    const result = await client.query<RequestRow>(
      `INSERT INTO activity_seat_requests (seating_id, member_id, member_name, phone, seats, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING ${rowFields}`,
      [setting.id, actor.id, actor.name, phone, seats],
    );
    const saved = result.rows[0];
    const attached = await client.query(
      `UPDATE activity_seat_proofs SET request_id = $4 WHERE seating_id = $1 AND member_id = $2
       AND request_id IS NULL AND id = ANY($3::uuid[]) AND created_at >= now() - interval '1 day'`,
      [setting.id, actor.id, proofs, saved.id],
    );
    if (attached.rowCount !== proofs.length) throw new APIError("部分凭证已失效，请重新上传", 409);
    await client.query(
      `INSERT INTO activity_seat_claims (seating_id, seat, request_id)
       SELECT $1, seat, $2 FROM unnest($3::text[]) AS seat`,
      [setting.id, saved.id, seats],
    );
    await client.query(
      "DELETE FROM activity_seat_proofs WHERE seating_id = $1 AND member_id = $2 AND request_id IS NULL",
      [setting.id, actor.id],
    );
    return requestDTO(saved);
  });
}

export async function seatingWorkbench(
  p: Payload, activity: SeatActivity, user: User | null, status: SeatStatus, page: number,
): Promise<SeatingWorkbench> {
  requireReviewer(activity, user);
  const setting = await scope(p, activity);
  const view: SeatingWorkbench = { title: activity.title, enabled: Boolean(setting?.enabled), docs: [], page, hasNextPage: false };
  if (!setting) return view;
  const limit = 20;
  const { rows } = await pool(p).query<ReviewRow>(
    `SELECT r.id, r.seats, r.status, r.created_at, r.reviewed_at, r.member_name, r.phone,
       ARRAY(SELECT id FROM activity_seat_proofs
             WHERE seating_id = r.seating_id AND request_id = r.id ORDER BY created_at, id) AS proofs
     FROM activity_seat_requests r
     WHERE r.seating_id = $1 AND r.status = $2 ORDER BY r.id DESC LIMIT $3 OFFSET $4`,
    [setting.id, status, limit + 1, (page - 1) * limit],
  );
  view.docs = rows.slice(0, limit).map(row => ({
    ...requestDTO(row), memberName: row.member_name, phone: row.phone, proofs: row.proofs,
  }));
  view.hasNextPage = rows.length > limit;
  return view;
}

export async function decideSeats(
  p: Payload, activity: SeatActivity, user: User | null, id: unknown, status: unknown,
) {
  const reviewer = requireReviewer(activity, user);
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647 ||
      (status !== "confirmed" && status !== "rejected"))
    throw new APIError("选座审核操作无效", 400);
  const decision: SeatDecision = status;
  return transaction(p, async client => {
    const setting = await scope(p, activity, client);
    if (!setting) throw new APIError("选座申请不存在", 404);
    const current = await client.query<{ status: SeatStatus }>(
      "SELECT status FROM activity_seat_requests WHERE seating_id = $1 AND id = $2",
      [setting.id, id],
    );
    if (!current.rows[0]) throw new APIError("选座申请不存在", 404);
    if (current.rows[0].status === decision) return { status: decision };
    if (current.rows[0].status !== "pending") throw new APIError("该选座申请已经处理，请刷新", 409);
    await client.query(
      `UPDATE activity_seat_requests SET status = $3, reviewed_at = now(), reviewer_id = $4
       WHERE seating_id = $1 AND id = $2`,
      [setting.id, id, decision, reviewer.id],
    );
    if (decision === "rejected") await client.query(
      "DELETE FROM activity_seat_claims WHERE seating_id = $1 AND request_id = $2",
      [setting.id, id],
    );
    return { status: decision };
  });
}

export async function uploadSeatProof(p: Payload, activity: SeatActivity, user: User | null, file: File) {
  const actor = requireMember(user);
  requirePublic(activity);
  if (!activity.open || !(await scope(p, activity))?.enabled)
    throw new APIError("当前活动暂未开放选座", 409);
  if (!file.size || file.size > seatProofBytes) throw new APIError("单张凭证图片最多 8 MB", 400);
  const picture = await normalizeImageBytes(Buffer.from(await file.arrayBuffer())).catch(() => {
    throw new APIError("请上传有效的静态 JPEG、PNG 或 WebP 图片", 400);
  });
  if (picture.length > 2 * 1024 * 1024) throw new APIError("图片内容过大，请压缩后重新上传", 400);
  const id = randomUUID();
  return transaction(p, async client => {
    const setting = await openScope(p, activity, client);
    if (await activeRequest(client, setting.id, actor.id))
      throw new APIError("已有待审核或已确认的选座申请", 409);
    await client.query(
      `DELETE FROM activity_seat_proofs WHERE seating_id = $1 AND request_id IS NULL
       AND created_at < now() - interval '1 day'`,
      [setting.id],
    );
    const staged = await client.query(
      "SELECT 1 FROM activity_seat_proofs WHERE seating_id = $1 AND member_id = $2 AND request_id IS NULL",
      [setting.id, actor.id],
    );
    if ((staged.rowCount ?? 0) >= seatProofLimit)
      throw new APIError(`最多上传 ${seatProofLimit} 张活动参与凭证`, 409);
    await client.query(
      "INSERT INTO activity_seat_proofs (id, seating_id, member_id, picture) VALUES ($1, $2, $3, $4)",
      [id, setting.id, actor.id, picture],
    );
    return { id };
  });
}

export async function seatProof(
  p: Payload, activity: SeatActivity, user: User | null, id: string, remove = false,
) {
  const actor = requireMember(user);
  if (!seatProofID.test(id)) throw new APIError("凭证不存在", 404);
  if (remove) return transaction(p, async client => {
    const setting = await scope(p, activity, client);
    if (setting) await client.query(
      `DELETE FROM activity_seat_proofs WHERE seating_id = $1 AND id = $2
       AND member_id = $3 AND request_id IS NULL`,
      [setting.id, id, actor.id],
    );
    return null;
  });
  const setting = await scope(p, activity);
  if (!setting) throw new APIError("凭证不存在", 404);
  const { rows } = await pool(p).query<{ picture: Buffer }>(
    `SELECT picture FROM activity_seat_proofs WHERE seating_id = $1 AND id = $2
     AND ((member_id = $3 AND (request_id IS NOT NULL OR created_at >= now() - interval '1 day'))
       OR ($4::boolean AND request_id IS NOT NULL))`,
    [setting.id, id, actor.id, canReviewActivitySeats(actor, activity.game)],
  );
  if (!rows[0]) throw new APIError("凭证不存在", 404);
  return rows[0].picture;
}
