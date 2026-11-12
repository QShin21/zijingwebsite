
import { randomUUID } from "node:crypto";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
import { APIError, type Payload } from "payload";
import type { User } from "@/payload-types";
import {
  seatKeys, seatLimit, seatPhonePattern, seatProofBytes, seatProofID, seatProofLimit, seatRows,
  type SeatDecision, type SeatRequest, type SeatReview, type SeatStatus, type SeatingKind, type SeatingState,
  type SeatAssignment, type SeatingAvailability, type SeatingWorkbench,
} from "./activity-seating-model";
import { beijingInputTime, canParticipate, canPublish, communityIDs, relationID } from "./rules";
import { normalizeImageBytes } from "./showcase-images";
import { refreshViewer } from "./v2/identity";
import { databaseCode } from "./workflow-transactions";

type SeatActivity = {
  kind: SeatingKind;
  id: number;
  title: string;
  game: unknown;
  public: boolean;
  open: boolean;
  endAt: number | null;
};

type SeatDatabase = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

type SeatScope = { id: number; enabled: boolean; opens_at: Date | null };
type ActiveStatus = "pending" | "confirmed";
type RequestRow = {
  id: number;
  seats: string[];
  status: SeatStatus;
  revision: number;
  cancelled_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  reviewed_at: Date | null;
};
type ReviewRow = RequestRow & { member_name: string; phone: string; proofs: string[];
  released_seats: { seat: string; releasedAt: string }[]; added_seats: { seat: string; addedAt: string }[] };
const rowFields = "id, seats, status, revision, cancelled_at, revoked_at, created_at, reviewed_at";
const reviewFields = `r.id, r.seats, r.status, r.revision, r.cancelled_at, r.revoked_at, r.created_at, r.reviewed_at, r.member_name, r.phone,
  ARRAY(SELECT id FROM activity_seat_proofs WHERE seating_id = r.seating_id AND request_id = r.id ORDER BY created_at, id) AS proofs,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('seat', s.seat, 'releasedAt', s.released_at) ORDER BY s.id)
    FROM activity_seat_releases s WHERE s.seating_id = r.seating_id AND s.request_id = r.id), '[]'::jsonb) AS released_seats,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('seat', a.seat, 'addedAt', a.added_at) ORDER BY a.id)
    FROM activity_seat_additions a WHERE a.seating_id = r.seating_id AND a.request_id = r.id), '[]'::jsonb) AS added_seats`;
const validSeats = new Set(seatKeys);
const pool = (p: Payload) => (p.db as unknown as PostgresAdapter).pool;

export function canReviewActivitySeats(user: User | null, game: unknown) {
  return canPublish(user) || communityIDs(user).includes(String(relationID(game)));
}

export async function seatActivity(
  p: Payload, kind: SeatingKind, id: number, viewer: User | null = null,
): Promise<SeatActivity> {
  viewer = await refreshViewer(p, viewer);
  if (kind === "community-posts" && !viewer) throw new APIError("请先登录可用账号", 401);
  const access = { id, user: viewer, overrideAccess: false as const, depth: 0, disableErrors: true as const };
  if (kind === "events") {
    const event = await p.findByID({
      collection: kind, ...access, draft: false,
      select: { title: true, game: true, _status: true, demo: true, lifecycle: true, archived: true, endAt: true },
    });
    if (!event) throw new APIError("活动未公开或已移除", 404);
    const visible = event._status === "published" && !(process.env.APP_ENV === "production" && event.demo);
    return {
      kind, id, title: event.title, game: event.game, public: visible, endAt: event.endAt ? Date.parse(event.endAt) : null,
      open: visible && !event.archived &&
        !["cancelled", "postponed", "ended"].includes(event.lifecycle || "") &&
        (!event.endAt || Date.parse(event.endAt) > Date.now()),
    };
  }
  const post = await p.findByID({
    collection: kind, ...access,
    select: { title: true, game: true, category: true, status: true, endAt: true },
  });
  if (!post || post.category !== "event") throw new APIError("活动未公开或已移除", 404);
  const gameID = relationID(post.game);
  const game = typeof gameID === "number" ? await p.findByID({
    collection: "games", id: gameID, user: null, overrideAccess: false, draft: false, depth: 0,
    disableErrors: true, select: { _status: true, demo: true },
  }) : null;
  const visible = post.status === "visible" && game?._status === "published" &&
    !(process.env.APP_ENV === "production" && game.demo);
  return { kind, id, title: post.title, game: post.game, public: visible, endAt: post.endAt ? Date.parse(post.endAt) : null,
    open: visible && (!post.endAt || Date.parse(post.endAt) > Date.now()) };

}

async function requireMember(p: Payload, user: User | null) {
  user = await refreshViewer(p, user);
  if (!user || !canParticipate(user)) throw new APIError("请先登录可用账号", 401);
  return user;
}

async function requireReviewer(p: Payload, activity: SeatActivity, user: User | null) {
  const actor = await requireMember(p, user);
  if (!canReviewActivitySeats(actor, activity.game)) throw new APIError("无权审核此活动的选座申请", 403);
  return actor;
}

function requirePublic(activity: SeatActivity) {
  if (!activity.public) throw new APIError("活动未公开或已移除", 404);
}

const scopeColumn = (activity: SeatActivity) => activity.kind === "events" ? "event_id" : "post_id";

async function scope(p: Payload, activity: SeatActivity, client?: SeatDatabase) {
  const result = await ((client ?? pool(p)) as SeatDatabase).query<SeatScope>(
    `SELECT id, enabled, opens_at FROM activity_seatings WHERE ${scopeColumn(activity)} = $1${client ? " FOR UPDATE" : ""}`,
    [activity.id],
  );
  return result.rows[0];
}

async function transaction<T>(p: Payload, work: (client: SeatDatabase) => Promise<T>) {
  const client = await pool(p).connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (["23505", "40001", "40P01", "55P03"].some(code => databaseCode(error, code)))
      throw new APIError("选座信息已变化或正在处理，请刷新后重试", 409);
    throw error;
  } finally {
    client.release();
  }
}

// Use the transaction's own connection for fresh authorization. Calling Payload's
// unrelated pool connection here would deadlock when concurrent requests fill it.
async function lockedActivity(p: Payload, activity: SeatActivity, user: User | null, client: SeatDatabase) {
  void p;
  if (!user) throw new APIError("请先登录可用账号", 401);
  await client.query("SELECT id FROM users WHERE id = $1 FOR SHARE", [user.id]);
  const users = await client.query<{ id: number; name: string; accountStatus: User["accountStatus"]; roles: User["roles"]; communityOffices: User["communityOffices"] }>(`
    SELECT u.id, u.name, u.account_status AS "accountStatus",
      COALESCE((SELECT jsonb_agg(value ORDER BY "order") FROM users_roles WHERE parent_id = u.id), '[]') AS roles,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('game', game_id, 'status', status))
        FROM users_community_offices WHERE _parent_id = u.id), '[]') AS "communityOffices"
    FROM users u WHERE u.id = $1`, [user.id]);
  const actor = users.rows[0] as User | undefined;
  if (!actor || !canParticipate(actor)) throw new APIError("请先登录可用账号", 401);
  const table = activity.kind === "events" ? "events" : "community_posts";
  await client.query(`SELECT id FROM ${table} WHERE id = $1 FOR SHARE`, [activity.id]);
  const fields = activity.kind === "events" ? "_status, demo, archived, lifecycle" : "status, category";
  const records = await client.query<{ title: string; game_id: number | null; _status?: string; demo?: boolean; archived?: boolean; lifecycle?: string; status?: string; category?: string; end_at: Date | null }>(
    `SELECT title, game_id, end_at, ${fields} FROM ${table} WHERE id = $1`, [activity.id]);
  const record = records.rows[0];
  if (!record || activity.kind === "community-posts" && record.category !== "event")
    throw new APIError("活动未公开或已移除", 404);
  let publicGame = true;
  if (record.game_id) {
    await client.query("SELECT id FROM games WHERE id = $1 FOR SHARE", [record.game_id]);
    const games = await client.query<{ _status: string; demo: boolean }>("SELECT _status, demo FROM games WHERE id = $1", [record.game_id]);
    publicGame = games.rows[0]?._status === "published" && !(process.env.APP_ENV === "production" && games.rows[0].demo);
  } else if (activity.kind === "community-posts") publicGame = false;
  // Standalone club events retain their existing public event contract. Community
  // events additionally inherit the V2 parent-community visibility boundary.
  const visible = activity.kind === "events"
    ? record._status === "published" && !(process.env.APP_ENV === "production" && record.demo)
    : record.status === "visible" && publicGame;
  const current: SeatActivity = { ...activity, title: record.title, game: record.game_id, public: visible, endAt: record.end_at?.getTime() ?? null,
    open: visible && !record.archived && !["cancelled", "postponed", "ended"].includes(record.lifecycle || "") &&
      (!record.end_at || record.end_at.getTime() > Date.now()) };
  return { activity: current, actor };
}

function assertLockedReviewer(activity: SeatActivity, actor: User) {
  if (!canReviewActivitySeats(actor, activity.game)) throw new APIError("无权审核此活动的选座申请", 403);
}

function requestDTO(row: RequestRow): SeatRequest {
  return {
    id: row.id, seats: row.seats, status: row.cancelled_at ? "cancelled" : row.revoked_at ? "revoked" : row.status, revision: row.revision,
    createdAt: row.created_at.toISOString(), reviewedAt: row.reviewed_at?.toISOString() ?? null,
  };
}

function reviewDTO(row: ReviewRow): SeatReview {
  return { ...requestDTO(row), memberName: row.member_name, phone: row.phone, proofs: row.proofs,
    releasedSeats: row.released_seats, addedSeats: row.added_seats };
}

async function activeRequest(client: SeatDatabase, seatingID: number, memberID: number) {
  const result = await client.query<RequestRow>(
    `SELECT ${rowFields} FROM activity_seat_requests
     WHERE seating_id = $1 AND member_id = $2 AND status <> 'rejected'`,
    [seatingID, memberID],
  );
  return result.rows[0];
}

function availability(activity: SeatActivity, setting?: Pick<SeatScope, "enabled" | "opens_at">): SeatingAvailability {
  const serverTime = Date.now();
  const enabled = setting?.enabled === true;
  const openingTime = setting?.opens_at?.getTime() ?? null;
  const beforeEnd = activity.endAt === null || serverTime < activity.endAt;
  const validOpening = openingTime === null || activity.endAt === null || openingTime < activity.endAt;
  const available = enabled && activity.open && beforeEnd && validOpening;
  const scheduled = available && openingTime !== null && openingTime > serverTime;
  return { enabled, open: available && !scheduled, scheduled, opensAt: setting?.opens_at?.toISOString() ?? null, serverTime };
}

function openingDate(activity: SeatActivity, value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(value))
    throw new APIError("请选择北京时间的开放日期和时间", 400);
  const date = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(date.getTime()) || beijingInputTime(date.toISOString()) !== value)
    throw new APIError("请选择有效的开放日期和时间", 400);
  if (date.getTime() <= Date.now()) throw new APIError("定时开放时间须晚于当前时间", 400);
  if (!activity.open || (activity.endAt !== null && date.getTime() >= activity.endAt))
    throw new APIError("请选择活动结束前的开放时间", 400);
  return date;
}

async function openScope(p: Payload, activity: SeatActivity, client: SeatDatabase) {
  const setting = await scope(p, activity, client);
  if (!setting || !availability(activity, setting).open) throw new APIError("当前活动暂未开放选座", 409);
  return setting;
}

export async function seatingState(p: Payload, activity: SeatActivity, user: User | null): Promise<SeatingState> {
  user = await refreshViewer(p, user);
  activity = await seatActivity(p, activity.kind, activity.id, user);
  requirePublic(activity);
  const setting = await scope(p, activity);
  const loggedIn = Boolean(user && canParticipate(user));
  const state: SeatingState = {
    ...availability(activity, setting), loggedIn,
    canReview: canReviewActivitySeats(user, activity.game), title: activity.title, rows: seatRows,
    seatLimit, proofLimit: seatProofLimit, proofBytes: seatProofBytes, occupancy: {}, blockedSeats: [], mine: null, mineDetails: null, drafts: [],
  };
  if (!setting) return state;
  const [mine, drafts] = await Promise.all([
    loggedIn ? pool(p).query<RequestRow & { phone: string }>(
      `SELECT ${rowFields}, phone FROM activity_seat_requests
       WHERE seating_id = $1 AND member_id = $2 ORDER BY id DESC LIMIT 1`,
      [setting.id, user!.id],
    ) : null,
    loggedIn ? pool(p).query<{ id: string }>(
      `SELECT id FROM activity_seat_proofs WHERE seating_id = $1 AND member_id = $2
       AND request_id IS NULL AND created_at >= now() - interval '1 day' ORDER BY created_at, id`,
      [setting.id, user!.id],
    ) : null,
  ]);
  const own = mine?.rows[0];
  const pending = own?.status === "pending";
  const [claims, blocks, proofs] = await Promise.all([
    setting.enabled || state.canReview || pending ? pool(p).query<{ seat: string; status: ActiveStatus }>(
      `SELECT c.seat, r.status FROM activity_seat_claims c
       JOIN activity_seat_requests r ON r.id = c.request_id WHERE c.seating_id = $1`,
      [setting.id],
    ) : null,
    setting.enabled || state.canReview || pending ? pool(p).query<{ seat: string }>(
      `SELECT seat FROM activity_seat_blocks WHERE seating_id = $1 ORDER BY seat`, [setting.id],
    ) : null,
    pending ? pool(p).query<{ id: string }>(`SELECT id FROM activity_seat_proofs
      WHERE seating_id = $1 AND member_id = $2 AND request_id = $3 ORDER BY created_at, id`,
      [setting.id, user!.id, own.id]) : null,
  ]);
  state.occupancy = Object.fromEntries(claims?.rows.map(({ seat, status }) => [seat, status]) || []);
  state.blockedSeats = blocks?.rows.map(({ seat }) => seat) || [];
  // Older released clients already treat confirmed seats as unavailable.
  for (const seat of state.blockedSeats) state.occupancy[seat] = "confirmed";
  if (own) state.mine = requestDTO(own);
  if (pending) state.mineDetails = { phone: own.phone, proofs: proofs?.rows.map(({ id }) => id) || [],
    canEdit: activity.open && (activity.endAt === null || activity.endAt > Date.now()) };
  state.drafts = drafts?.rows.map(({ id }) => id) || [];
  return state;
}

export async function seatingAssignment(p: Payload, activity: SeatActivity, user: User | null, requestID: string | null): Promise<SeatAssignment> {
  user = await requireMember(p, user);
  activity = await seatActivity(p, activity.kind, activity.id, user);
  await requireReviewer(p, activity, user);
  if (!requestID || !/^[1-9]\d*$/.test(requestID) || Number(requestID) > 2147483647)
    throw new APIError("申请信息无效，请刷新后重试", 400);
  const setting = await scope(p, activity);
  if (!setting) throw new APIError("选座申请不存在", 404);
  const found = await pool(p).query<RequestRow>(`SELECT ${rowFields} FROM activity_seat_requests
    WHERE seating_id = $1 AND id = $2`, [setting.id, Number(requestID)]);
  const request = found.rows[0];
  if (!request) throw new APIError("选座申请不存在", 404);
  if (request.status !== "pending" && request.status !== "confirmed") throw new APIError("该申请状态已变化，请刷新", 409);
  const [claims, blocks] = await Promise.all([
    pool(p).query<{ seat: string; status: ActiveStatus }>(`SELECT c.seat, r.status FROM activity_seat_claims c
      JOIN activity_seat_requests r ON r.id = c.request_id WHERE c.seating_id = $1`, [setting.id]),
    pool(p).query<{ seat: string }>("SELECT seat FROM activity_seat_blocks WHERE seating_id = $1 ORDER BY seat", [setting.id]),
  ]);
  const occupancy: SeatAssignment["occupancy"] = Object.fromEntries(claims.rows.map(({ seat, status }) => [seat, status]));
  const blockedSeats = blocks.rows.map(({ seat }) => seat);
  for (const seat of blockedSeats) occupancy[seat] = "confirmed";
  return { title: activity.title, request: requestDTO(request), rows: seatRows, seatLimit, occupancy, blockedSeats };
}

export async function seatingReviewMap(p: Payload, activity: SeatActivity, user: User | null): Promise<SeatingState> {
  user = await requireMember(p, user);
  activity = await seatActivity(p, activity.kind, activity.id, user);
  await requireReviewer(p, activity, user);
  const setting = await scope(p, activity);
  const result: SeatingState = {
    ...availability(activity, setting), loggedIn: true, canReview: true, title: activity.title, rows: seatRows,
    seatLimit, proofLimit: seatProofLimit, proofBytes: seatProofBytes, occupancy: {}, blockedSeats: [],
    mine: null, mineDetails: null, drafts: [],
  };
  if (!setting) return result;
  const [claims, blocks] = await Promise.all([
    pool(p).query<{ seat: string; status: ActiveStatus }>(`SELECT c.seat, r.status FROM activity_seat_claims c
      JOIN activity_seat_requests r ON r.id = c.request_id WHERE c.seating_id = $1`, [setting.id]),
    pool(p).query<{ seat: string }>("SELECT seat FROM activity_seat_blocks WHERE seating_id = $1 ORDER BY seat", [setting.id]),
  ]);
  result.occupancy = Object.fromEntries(claims.rows.map(({ seat, status }) => [seat, status]));
  result.blockedSeats = blocks.rows.map(({ seat }) => seat);
  for (const seat of result.blockedSeats) result.occupancy[seat] = "confirmed";
  return result;
}

export async function seatingReviewForSeat(p: Payload, activity: SeatActivity, user: User | null, seat: string | null) {
  user = await requireMember(p, user);
  activity = await seatActivity(p, activity.kind, activity.id, user);
  await requireReviewer(p, activity, user);
  if (!seat || !validSeats.has(seat)) throw new APIError("座位信息无效，请刷新后重试", 400);
  const setting = await scope(p, activity);
  if (!setting) return { seat, request: null };
  const result = await pool(p).query<ReviewRow>(`SELECT ${reviewFields}
    FROM activity_seat_claims c JOIN activity_seat_requests r ON r.id = c.request_id AND r.seating_id = c.seating_id
    WHERE c.seating_id = $1 AND c.seat = $2 AND r.status IN ('pending', 'confirmed')`, [setting.id, seat]);
  return { seat, request: result.rows[0] ? reviewDTO(result.rows[0]) : null };
}

export async function setSeating(p: Payload, activity: SeatActivity, user: User | null, enabled: unknown, opening?: unknown) {
  await requireReviewer(p, activity, user);
  if (typeof enabled !== "boolean") throw new APIError("请指定选座启用状态", 400);
  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, user, client);
    assertLockedReviewer(current.activity, current.actor);
    if (enabled) requirePublic(current.activity);
    const opensAt = enabled ? openingDate(current.activity, opening) : null;
    const column = scopeColumn(current.activity);
    await client.query(
      `INSERT INTO activity_seatings (${column}, enabled, opens_at) VALUES ($1, $2, $3)
       ON CONFLICT (${column}) DO UPDATE SET enabled = EXCLUDED.enabled, opens_at = EXCLUDED.opens_at`,
      [current.activity.id, enabled, opensAt],
    );
    return availability(current.activity, { enabled, opens_at: opensAt });
  });
}

export async function setSeatBlocks(
  p: Payload, activity: SeatActivity, user: User | null, seats: unknown, blocked: unknown,
) {
  await requireReviewer(p, activity, user);
  if (typeof blocked !== "boolean" || !Array.isArray(seats) || !seats.length || seats.length > seatKeys.length ||
      seats.some(seat => typeof seat !== "string" || !validSeats.has(seat)) || new Set(seats).size !== seats.length)
    throw new APIError("请选择不同的有效座位和锁定状态", 400);
  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, user, client);
    assertLockedReviewer(current.activity, current.actor);
    requirePublic(current.activity);
    const column = scopeColumn(current.activity);
    await client.query(`INSERT INTO activity_seatings (${column}, enabled) VALUES ($1, false)
      ON CONFLICT (${column}) DO NOTHING`, [current.activity.id]);
    const setting = await scope(p, current.activity, client);
    if (!setting) throw new APIError("选座设置读取失败，请重试", 409);
    if (blocked) {
      const occupied = await client.query(
        "SELECT 1 FROM activity_seat_claims WHERE seating_id = $1 AND seat = ANY($2::text[]) LIMIT 1",
        [setting.id, seats],
      );
      if (occupied.rowCount) throw new APIError("部分座位已有申请，请刷新座位图后重新选择", 409);
      await client.query(`INSERT INTO activity_seat_blocks (seating_id, seat, blocked_by)
        SELECT $1, seat, $3 FROM unnest($2::text[]) AS seat ON CONFLICT DO NOTHING`, [setting.id, seats, current.actor.id]);
    } else {
      await client.query("DELETE FROM activity_seat_blocks WHERE seating_id = $1 AND seat = ANY($2::text[])", [setting.id, seats]);
    }
    return { blocked, seats };
  });
}

function submission(data: Record<string, unknown>) {
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
  return { seats: seats as string[], phone, proofs: proofs as string[] };
}

export async function submitSeats(
  p: Payload, activity: SeatActivity, user: User | null, data: Record<string, unknown>,
) {
  const actor = await requireMember(p, user);
  requirePublic(activity);
  const { seats, phone, proofs } = submission(data);

  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, actor, client);
    requirePublic(current.activity);
    const setting = await openScope(p, current.activity, client);
    const existing = await activeRequest(client, setting.id, actor.id);
    if (existing) return requestDTO(existing);
    const busy = await client.query(
      `SELECT 1 FROM activity_seat_claims WHERE seating_id = $1 AND seat = ANY($2::text[])
       UNION ALL SELECT 1 FROM activity_seat_blocks WHERE seating_id = $1 AND seat = ANY($2::text[]) LIMIT 1`,
      [setting.id, seats],
    );
    if (busy.rowCount) throw new APIError("部分座位已被选走或暂未开放，请刷新座位图后重新选择", 409);
    const result = await client.query<RequestRow>(
      `INSERT INTO activity_seat_requests (seating_id, member_id, member_name, phone, seats, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING ${rowFields}`,
      [setting.id, actor.id, current.actor.name, phone, seats],
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

export async function editPendingSeats(p: Payload, activity: SeatActivity, user: User | null, data: Record<string, unknown>) {
  const actor = await requireMember(p, user);
  requirePublic(activity);
  const { seats, phone, proofs } = submission(data);
  const { id, revision } = data;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 2147483647 ||
      typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647)
    throw new APIError("申请信息无效，请刷新后重试", 400);
  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, actor, client);
    requirePublic(current.activity);
    const setting = await scope(p, current.activity, client);
    if (!setting) throw new APIError("选座申请不存在", 404);
    if (!current.activity.open || (current.activity.endAt !== null && current.activity.endAt <= Date.now()))
      throw new APIError("活动已结束或暂停，不能修改申请", 409);
    const result = await client.query<RequestRow>(`SELECT ${rowFields} FROM activity_seat_requests
      WHERE seating_id = $1 AND id = $2 AND member_id = $3`, [setting.id, id, actor.id]);
    const own = result.rows[0];
    if (!own) throw new APIError("选座申请不存在", 404);
    if (own.status !== "pending") throw new APIError("申请已审核，请刷新查看结果", 409);
    if (own.revision !== revision) throw new APIError("申请内容已变化，请刷新后重新修改", 409);
    const busy = await client.query(`SELECT 1 FROM activity_seat_claims
      WHERE seating_id = $1 AND seat = ANY($2::text[]) AND request_id <> $3
      UNION ALL SELECT 1 FROM activity_seat_blocks WHERE seating_id = $1 AND seat = ANY($2::text[]) LIMIT 1`,
      [setting.id, seats, id]);
    if (busy.rowCount) throw new APIError("部分座位已被选走或暂未开放，请刷新后重新选择", 409);
    const availableProofs = await client.query(`SELECT id FROM activity_seat_proofs
      WHERE seating_id = $1 AND member_id = $2 AND id = ANY($3::uuid[])
        AND (request_id = $4 OR (request_id IS NULL AND created_at >= now() - interval '1 day'))`,
      [setting.id, actor.id, proofs, id]);
    if (availableProofs.rowCount !== proofs.length) throw new APIError("部分凭证已失效，请刷新后重新上传", 409);
    await client.query("DELETE FROM activity_seat_claims WHERE seating_id = $1 AND request_id = $2", [setting.id, id]);
    await client.query(`INSERT INTO activity_seat_claims (seating_id, seat, request_id)
      SELECT $1, seat, $2 FROM unnest($3::text[]) AS seat`, [setting.id, id, seats]);
    await client.query(`DELETE FROM activity_seat_proofs WHERE seating_id = $1 AND member_id = $2
      AND request_id = $3 AND NOT (id = ANY($4::uuid[]))`, [setting.id, actor.id, id, proofs]);
    await client.query(`UPDATE activity_seat_proofs SET request_id = $4 WHERE seating_id = $1 AND member_id = $2
      AND id = ANY($3::uuid[]) AND request_id IS NULL`, [setting.id, actor.id, proofs, id]);
    const updated = await client.query<RequestRow>(`UPDATE activity_seat_requests
      SET seats = $3, phone = $4, revision = revision + 1 WHERE seating_id = $1 AND id = $2 RETURNING ${rowFields}`,
      [setting.id, id, seats, phone]);
    return requestDTO(updated.rows[0]);
  });
}

export async function cancelPendingSeats(p: Payload, activity: SeatActivity, user: User | null, id: unknown, revision: unknown) {
  const actor = await requireMember(p, user);
  requirePublic(activity);
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 2147483647 ||
      typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647)
    throw new APIError("申请信息无效，请刷新后重试", 400);
  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, actor, client);
    requirePublic(current.activity);
    const setting = await scope(p, current.activity, client);
    if (!setting) throw new APIError("选座申请不存在", 404);
    const found = await client.query<RequestRow>(`SELECT ${rowFields} FROM activity_seat_requests
      WHERE seating_id = $1 AND id = $2 AND member_id = $3`, [setting.id, id, actor.id]);
    const own = found.rows[0];
    if (!own) throw new APIError("选座申请不存在", 404);
    if (own.status !== "pending") throw new APIError("申请已处理，请刷新查看结果", 409);
    if (own.revision !== revision) throw new APIError("申请内容已变化，请刷新后重试", 409);
    const result = await client.query<RequestRow>(`UPDATE activity_seat_requests
      SET status = 'rejected', cancelled_at = now(), revision = revision + 1
      WHERE seating_id = $1 AND id = $2 RETURNING ${rowFields}`, [setting.id, id]);
    await client.query("DELETE FROM activity_seat_claims WHERE seating_id = $1 AND request_id = $2", [setting.id, id]);
    await client.query("DELETE FROM activity_seat_proofs WHERE seating_id = $1 AND member_id = $2 AND request_id IS NULL", [setting.id, actor.id]);
    return requestDTO(result.rows[0]);
  });
}

export async function revokeConfirmedSeats(p: Payload, activity: SeatActivity, user: User | null, id: unknown, revision: unknown) {
  const reviewer = await requireReviewer(p, activity, user);
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 2147483647 ||
      typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647)
    throw new APIError("申请信息无效，请刷新后重试", 400);
  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, reviewer, client);
    assertLockedReviewer(current.activity, current.actor);
    const setting = await scope(p, current.activity, client);
    if (!setting) throw new APIError("选座申请不存在", 404);
    const found = await client.query<RequestRow>(`SELECT ${rowFields} FROM activity_seat_requests
      WHERE seating_id = $1 AND id = $2`, [setting.id, id]);
    const request = found.rows[0];
    if (!request) throw new APIError("选座申请不存在", 404);
    if (request.status !== "confirmed") throw new APIError("该申请状态已变化，请刷新", 409);
    if (request.revision !== revision) throw new APIError("申请内容已变化，请刷新后重试", 409);
    const result = await client.query<RequestRow>(`UPDATE activity_seat_requests
      SET status = 'rejected', revoked_at = now(), revoked_by = $3, revision = revision + 1
      WHERE seating_id = $1 AND id = $2 RETURNING ${rowFields}`, [setting.id, id, current.actor.id]);
    await client.query("DELETE FROM activity_seat_claims WHERE seating_id = $1 AND request_id = $2", [setting.id, id]);
    return requestDTO(result.rows[0]);
  });
}

export async function revokeConfirmedSeat(p: Payload, activity: SeatActivity, user: User | null, id: unknown, revision: unknown, seat: unknown) {
  const reviewer = await requireReviewer(p, activity, user);
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 2147483647 ||
      typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647 ||
      typeof seat !== "string" || !validSeats.has(seat))
    throw new APIError("申请或座位信息无效，请刷新后重试", 400);
  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, reviewer, client);
    assertLockedReviewer(current.activity, current.actor);
    const setting = await scope(p, current.activity, client);
    if (!setting) throw new APIError("选座申请不存在", 404);
    const found = await client.query<RequestRow>(`SELECT ${rowFields} FROM activity_seat_requests
      WHERE seating_id = $1 AND id = $2`, [setting.id, id]);
    const request = found.rows[0];
    if (!request) throw new APIError("选座申请不存在", 404);
    if (request.status !== "confirmed" || !request.seats.includes(seat))
      throw new APIError("该座位状态已变化，请刷新", 409);
    if (request.revision !== revision) throw new APIError("申请内容已变化，请刷新后重试", 409);
    const claim = await client.query(`DELETE FROM activity_seat_claims
      WHERE seating_id = $1 AND request_id = $2 AND seat = $3`, [setting.id, id, seat]);
    if (claim.rowCount !== 1) throw new APIError("该座位状态已变化，请刷新", 409);
    const last = request.seats.length === 1;
    const result = last
      ? await client.query<RequestRow>(`UPDATE activity_seat_requests
          SET status = 'rejected', revoked_at = now(), revoked_by = $3, revision = revision + 1
          WHERE seating_id = $1 AND id = $2 RETURNING ${rowFields}`, [setting.id, id, current.actor.id])
      : await client.query<RequestRow>(`UPDATE activity_seat_requests
          SET seats = array_remove(seats, $3::text), revision = revision + 1
          WHERE seating_id = $1 AND id = $2 RETURNING ${rowFields}`, [setting.id, id, seat]);
    const updated = result.rows[0];
    await client.query(`INSERT INTO activity_seat_releases (seating_id, request_id, seat, released_by, revision)
      VALUES ($1, $2, $3, $4, $5)`, [setting.id, id, seat, current.actor.id, updated.revision]);
    return { request: requestDTO(updated), releasedSeat: seat, fullyRevoked: last };
  });
}

export async function addSeats(p: Payload, activity: SeatActivity, user: User | null, id: unknown, revision: unknown, status: unknown, seats: unknown) {
  const reviewer = await requireReviewer(p, activity, user);
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 2147483647 ||
      typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647 ||
      (status !== "pending" && status !== "confirmed") || !Array.isArray(seats) || !seats.length || seats.length > seatLimit ||
      seats.some(seat => typeof seat !== "string" || !validSeats.has(seat)) || new Set(seats).size !== seats.length)
    throw new APIError("请选择有效申请及不同的有效座位", 400);
  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, reviewer, client);
    assertLockedReviewer(current.activity, current.actor);
    const setting = await scope(p, current.activity, client);
    if (!setting) throw new APIError("选座申请不存在", 404);
    const found = await client.query<RequestRow>(`SELECT ${rowFields} FROM activity_seat_requests
      WHERE seating_id = $1 AND id = $2`, [setting.id, id]);
    const request = found.rows[0];
    if (!request) throw new APIError("选座申请不存在", 404);
    if (request.status !== status || request.revision !== revision)
      throw new APIError("申请状态或内容已变化，请刷新后重新选择", 409);
    if (request.seats.length + seats.length > seatLimit)
      throw new APIError(`每份申请最多保留 ${seatLimit} 个座位`, 400);
    const busy = await client.query(`SELECT 1 FROM activity_seat_claims WHERE seating_id = $1 AND seat = ANY($2::text[])
      UNION ALL SELECT 1 FROM activity_seat_blocks WHERE seating_id = $1 AND seat = ANY($2::text[]) LIMIT 1`, [setting.id, seats]);
    if (busy.rowCount) throw new APIError("部分座位已被选走或暂未开放，请刷新后重新选择", 409);
    const updated = await client.query<RequestRow>(`UPDATE activity_seat_requests
      SET seats = array_cat(seats, $3::text[]), revision = revision + 1
      WHERE seating_id = $1 AND id = $2 RETURNING ${rowFields}`, [setting.id, id, seats]);
    await client.query(`INSERT INTO activity_seat_claims (seating_id, seat, request_id)
      SELECT $1, seat, $2 FROM unnest($3::text[]) AS seat`, [setting.id, id, seats]);
    await client.query(`INSERT INTO activity_seat_additions (seating_id, request_id, seat, added_by, revision)
      SELECT $1, $2, seat, $4, $5 FROM unnest($3::text[]) AS seat`, [setting.id, id, seats, current.actor.id, updated.rows[0].revision]);
    return requestDTO(updated.rows[0]);
  });
}

export async function changeSeats(p: Payload, activity: SeatActivity, user: User | null, id: unknown, revision: unknown, status: unknown, seats: unknown) {
  const reviewer = await requireReviewer(p, activity, user);
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 2147483647 ||
      typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647 ||
      (status !== "pending" && status !== "confirmed") || !Array.isArray(seats) || !seats.length || seats.length > seatLimit ||
      seats.some(seat => typeof seat !== "string" || !validSeats.has(seat)) || new Set(seats).size !== seats.length)
    throw new APIError("请选择有效申请及不同的有效座位", 400);
  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, reviewer, client);
    assertLockedReviewer(current.activity, current.actor);
    const setting = await scope(p, current.activity, client);
    if (!setting) throw new APIError("选座申请不存在", 404);
    const found = await client.query<RequestRow>(`SELECT ${rowFields} FROM activity_seat_requests
      WHERE seating_id = $1 AND id = $2`, [setting.id, id]);
    const request = found.rows[0];
    if (!request) throw new APIError("选座申请不存在", 404);
    if (request.status !== status || request.revision !== revision)
      throw new APIError("申请状态或内容已变化，请刷新后重新选择", 409);
    if (seats.length !== request.seats.length)
      throw new APIError("更换座位时请保持原有座位数量", 400);
    const oldSeats = new Set(request.seats), newSeats = new Set(seats);
    const removed = request.seats.filter(seat => !newSeats.has(seat));
    const added = seats.filter(seat => !oldSeats.has(seat));
    if (!removed.length) return requestDTO(request);
    const busy = await client.query(`SELECT 1 FROM activity_seat_claims
      WHERE seating_id = $1 AND seat = ANY($2::text[]) AND request_id <> $3
      UNION ALL SELECT 1 FROM activity_seat_blocks WHERE seating_id = $1 AND seat = ANY($2::text[]) LIMIT 1`,
      [setting.id, seats, id]);
    if (busy.rowCount) throw new APIError("部分座位已被选走或暂未开放，请刷新后重新选择", 409);
    const deleted = await client.query(`DELETE FROM activity_seat_claims
      WHERE seating_id = $1 AND request_id = $2 AND seat = ANY($3::text[])`, [setting.id, id, removed]);
    if (deleted.rowCount !== removed.length) throw new APIError("座位状态已变化，请刷新后重新选择", 409);
    await client.query(`INSERT INTO activity_seat_claims (seating_id, seat, request_id)
      SELECT $1, seat, $2 FROM unnest($3::text[]) AS seat`, [setting.id, id, added]);
    const updated = await client.query<RequestRow>(`UPDATE activity_seat_requests
      SET seats = $3, revision = revision + 1 WHERE seating_id = $1 AND id = $2 RETURNING ${rowFields}`,
      [setting.id, id, seats]);
    await client.query(`INSERT INTO activity_seat_releases (seating_id, request_id, seat, released_by, revision)
      SELECT $1, $2, seat, $4, $5 FROM unnest($3::text[]) AS seat`, [setting.id, id, removed, current.actor.id, updated.rows[0].revision]);
    await client.query(`INSERT INTO activity_seat_additions (seating_id, request_id, seat, added_by, revision)
      SELECT $1, $2, seat, $4, $5 FROM unnest($3::text[]) AS seat`, [setting.id, id, added, current.actor.id, updated.rows[0].revision]);
    return requestDTO(updated.rows[0]);
  });
}

export async function seatingWorkbench(
  p: Payload, activity: SeatActivity, user: User | null, status: SeatStatus, page: number,
): Promise<SeatingWorkbench> {
  user = await requireMember(p, user);
  activity = await seatActivity(p, activity.kind, activity.id, user);
  await requireReviewer(p, activity, user);
  const setting = await scope(p, activity);
  const view: SeatingWorkbench = { title: activity.title, ...availability(activity, setting), docs: [], page, hasNextPage: false };
  if (!setting) return view;
  const limit = 20;
  const { rows } = await pool(p).query<ReviewRow>(
    `SELECT ${reviewFields}
     FROM activity_seat_requests r
     WHERE r.seating_id = $1 AND r.status = $2 AND (r.cancelled_at IS NOT NULL) = $5
       AND (r.revoked_at IS NOT NULL) = $6 ORDER BY r.id DESC LIMIT $3 OFFSET $4`,
    [setting.id, status === "cancelled" || status === "revoked" ? "rejected" : status,
      limit + 1, (page - 1) * limit, status === "cancelled", status === "revoked"],
  );
  view.docs = rows.slice(0, limit).map(reviewDTO);
  view.hasNextPage = rows.length > limit;
  return view;
}

export async function decideSeats(
  p: Payload, activity: SeatActivity, user: User | null, id: unknown, status: unknown, revision?: unknown,
) {
  const reviewer = await requireReviewer(p, activity, user);
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647 ||
      (status !== "confirmed" && status !== "rejected") ||
      (revision !== undefined && (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)))
    throw new APIError("选座审核操作无效", 400);
  const decision: SeatDecision = status;
  return transaction(p, async client => {
    const currentActivity = await lockedActivity(p, activity, reviewer, client);
    assertLockedReviewer(currentActivity.activity, currentActivity.actor);
    const setting = await scope(p, currentActivity.activity, client);
    if (!setting) throw new APIError("选座申请不存在", 404);
    const current = await client.query<{ status: SeatStatus; revision: number; cancelled_at: Date | null; revoked_at: Date | null }>(
      "SELECT status, revision, cancelled_at, revoked_at FROM activity_seat_requests WHERE seating_id = $1 AND id = $2",
      [setting.id, id],
    );
    if (!current.rows[0]) throw new APIError("选座申请不存在", 404);
    if (current.rows[0].cancelled_at) throw new APIError("申请人已取消申请，请刷新", 409);
    if (current.rows[0].revoked_at) throw new APIError("申请已撤销，请刷新", 409);
    if ((revision ?? 0) !== current.rows[0].revision) throw new APIError("申请已被修改，请刷新并重新核对", 409);
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
  const actor = await requireMember(p, user);
  requirePublic(activity);
  if (!activity.open || (activity.endAt !== null && activity.endAt <= Date.now()))
    throw new APIError("当前活动暂未开放选座", 409);
  if (!file.size || file.size > seatProofBytes) throw new APIError("单张凭证图片最多 8 MB", 400);
  const picture = await normalizeImageBytes(Buffer.from(await file.arrayBuffer())).catch(() => {
    throw new APIError("请上传有效的静态 JPEG、PNG 或 WebP 图片", 400);
  });
  if (picture.length > 2 * 1024 * 1024) throw new APIError("图片内容过大，请压缩后重新上传", 400);
  const id = randomUUID();
  return transaction(p, async client => {
    const current = await lockedActivity(p, activity, actor, client);
    requirePublic(current.activity);
    const setting = await scope(p, current.activity, client);
    if (!setting || !current.activity.open || (current.activity.endAt !== null && current.activity.endAt <= Date.now()))
      throw new APIError("当前活动暂无法修改选座", 409);
    const active = await activeRequest(client, setting.id, actor.id);
    if (active?.status === "confirmed")
      throw new APIError("已有待审核或已确认的选座申请", 409);
    if (!active && !availability(current.activity, setting).open)
      throw new APIError("当前活动暂未开放选座", 409);
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
  const actor = await requireMember(p, user);
  activity = await seatActivity(p, activity.kind, activity.id, actor);
  if (!seatProofID.test(id)) throw new APIError("凭证不存在", 404);
  if (remove) return transaction(p, async client => {
    const current = await lockedActivity(p, activity, actor, client);
    const setting = await scope(p, current.activity, client);
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
