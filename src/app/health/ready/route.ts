import { cms } from "@/lib/content";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const p = await cms();
    await p.count({ collection: "events", overrideAccess: false, user: null });
    const db = p.db as unknown as PostgresAdapter;
    // Verify required structure without loading any private answers or contact data.
    await db.pool.query("SELECT dedupe_key,form_version FROM event_signups LIMIT 0");
    await db.pool.query("SELECT key FROM auth_codes LIMIT 0");
    await db.pool.query("SELECT key FROM auth_rate_limits LIMIT 0");
    await db.pool.query("SELECT department FROM users LIMIT 0");
    await db.pool.query("SELECT game_id,view_signups,export_signups FROM users_community_offices LIMIT 0");
    await db.pool.query("SELECT status,confirmed_at FROM community_joins LIMIT 0");
    const migration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261011_180000_club_operations"]);
    if (!migration.rowCount) throw new Error("Required migration unavailable");
    return Response.json({ status: "ready", schema: "club-operations-1" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
