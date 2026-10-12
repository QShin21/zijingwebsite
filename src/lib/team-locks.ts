import { APIError, type PayloadRequest } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";

export async function teamTransactionDatabase(req: PayloadRequest) {
  const adapter = req.payload.db as unknown as PostgresAdapter, id = await req.transactionID;
  const session = id == null ? null : adapter.sessions[String(id)];
  if (!session) throw new APIError("无法安全保存队伍状态，请刷新重试", 503);
  return session.db;
}

// Publishing and archiving use the same team→batch lock order, including CMS/REST.
export async function lockTeamLifecycle(req: PayloadRequest, id: number, exclusive = false) {
  const db = await teamTransactionDatabase(req);
  await db.execute(exclusive ? sql`SELECT id FROM teams WHERE id=${id} FOR UPDATE` : sql`SELECT id FROM teams WHERE id=${id} FOR SHARE`);
}
