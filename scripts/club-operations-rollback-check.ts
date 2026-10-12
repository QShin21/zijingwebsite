import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
// Read-only gate for rollback to the 1.0 baseline. Compatible newer builds retain these capabilities.
type RollbackReader = { query(sql: string): Promise<{ rows: Record<string, unknown>[] }> };
const legacyCounts = ["backbone", "new_states", "joins", "promotions", "staff_batches", "staff_applications",
  "reduced_grants", "revoked_grants", "legacy_owner_private_access", "legacy_historical_private_access", "revoked_cards", "member_offices"];
const teamTables = ["team_establishment_applications", "team_recruitments", "team_join_applications", "team_memberships", "team_member_profiles"];
const recommendation = "Use a reviewed rollback build retaining club operations, team lifecycle, membership consent, private signup and honor video isolation capabilities; preserve data, private videos and permanent reservations; do not revert to 1.0 or execute down";
function count(value: unknown) {
  if ((typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) ||
    !Number.isSafeInteger(Number(value)) || Number(value) < 0) throw new Error("Rollback count unavailable");
  return Number(value);
}
async function countFiles(directory: string): Promise<number> {
  const info = await fs.lstat(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!info) return 0;
  if (!info.isDirectory()) throw new Error("Honor storage is not a real directory");
  let total = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) total += await countFiles(path.join(directory, entry.name));
    else if (entry.isFile()) total++;
    else throw new Error("Honor storage contains an unverified link or special file");
  }
  return total;
}
export async function honorStorageCounts(mediaDirectory: string) {
  const honor_private_files = await countFiles(path.join(mediaDirectory, ".team-honor-videos"));
  const honor_video_reservations = await countFiles(path.join(mediaDirectory, ".showcase-videos", ".team-honor-reserved"));
  return { honor_private_files, honor_video_reservations };
}
export async function assessClubRollback(db: RollbackReader, mediaDirectory: string) {
  const result = await db.query(`
    WITH current_events AS (
      SELECT e.id,
        CASE WHEN v.id IS NOT NULL THEN v.version_game_id ELSE e.game_id END game_id,
        CASE WHEN v.id IS NOT NULL THEN v.version_submitted_by_id ELSE e.submitted_by_id END organizer_id
      FROM events e LEFT JOIN LATERAL (
        SELECT id,version_game_id,version_submitted_by_id FROM _events_v
        WHERE parent_id=e.id AND latest IS TRUE ORDER BY updated_at DESC,id DESC LIMIT 1
      ) v ON true
    )
    SELECT
      (SELECT count(*)::int FROM users_roles WHERE value='backbone') backbone,
      (SELECT count(*)::int FROM community_applications WHERE status IN('returned','withdrawn')) new_states,
      (SELECT count(*)::int FROM community_joins) joins,
      (SELECT count(*)::int FROM content_promotions) promotions,
      (SELECT count(*)::int FROM staff_batches) staff_batches,
      (SELECT count(*)::int FROM staff_applications) staff_applications,
      (SELECT count(*)::int FROM users_community_offices WHERE status='revoked') revoked_grants,
      (SELECT count(*)::int FROM current_events e JOIN users_roles r ON r.parent_id=e.organizer_id
       JOIN users u ON u.id=r.parent_id WHERE r.value='communityAdmin' AND coalesce(u.account_status::text,'active')<>'suspended'
       AND (NOT EXISTS(SELECT 1 FROM users_community_offices o WHERE o._parent_id=r.parent_id AND o.status='active' AND o.game_id IS NOT NULL AND coalesce(o.view_signups,false) AND (e.game_id IS NULL OR o.game_id=e.game_id))
         OR NOT EXISTS(SELECT 1 FROM users_community_offices o WHERE o._parent_id=r.parent_id AND o.status='active' AND o.game_id IS NOT NULL AND coalesce(o.view_signups,false) AND coalesce(o.export_signups,false) AND (e.game_id IS NULL OR o.game_id=e.game_id)))) legacy_owner_private_access,
      -- The 1.0 collection also read organizer-owned records after their activity was deleted.
      (SELECT count(*)::int FROM event_signups s JOIN users_roles r ON r.parent_id=s.organizer_id
       JOIN users u ON u.id=r.parent_id WHERE r.value='communityAdmin' AND s.member_id<>r.parent_id
       AND coalesce(u.account_status::text,'active')<>'suspended'
       AND NOT EXISTS(SELECT 1 FROM users_community_offices o
         WHERE o._parent_id=r.parent_id AND o.status='active' AND o.game_id IS NOT NULL AND coalesce(o.view_signups,false)
         AND ((s.activity_type='events' AND EXISTS(SELECT 1 FROM current_events e WHERE e.id=s.activity_i_d AND e.organizer_id=r.parent_id AND (e.game_id IS NULL OR e.game_id=o.game_id)))
           OR (s.activity_type='community-posts' AND EXISTS(SELECT 1 FROM community_posts c WHERE c.id=s.activity_i_d AND c.category='event' AND c.game_id=o.game_id))))) legacy_historical_private_access,
      (SELECT count(*)::int FROM users_community_offices o JOIN users_roles r ON r.parent_id=o._parent_id
       WHERE o.status='active' AND r.value='member') member_offices,
      (SELECT count(*)::int FROM users_community_offices o JOIN users_roles r ON r.parent_id=o._parent_id
       WHERE o.status='active' AND r.value='communityAdmin' AND
       (NOT coalesce(o.publish_content,false) OR NOT coalesce(o.review_showcase,false) OR NOT coalesce(o.view_signups,false) OR NOT coalesce(o.export_signups,false))) reduced_grants,
      (SELECT count(*)::int FROM users_community_offices o JOIN users_roles r ON r.parent_id=o._parent_id
       WHERE o.status='active' AND r.value IN('communityAdmin','vicePresident','president')
       AND EXISTS(SELECT 1 FROM community_applications a WHERE a.applicant_id=o._parent_id AND a.game_id=o.game_id AND a.status='approved' AND a.wechat_qr IS NOT NULL
       AND (NOT coalesce(o.contact_consent,false) OR NOT coalesce(a.contact_consent,false)))) revoked_cards`);
  const counts = Object.fromEntries(legacyCounts.map(name => [name, count(result.rows[0]?.[name])])) as Record<string, number>;
  const table = await db.query("SELECT to_regclass('public.team_honor_records') IS NOT NULL AS present");
  if (typeof table.rows[0]?.present !== "boolean") throw new Error("Honor table availability unknown");
  counts.honor_records = table.rows[0].present
    ? count((await db.query("SELECT count(*)::bigint AS honor_records FROM team_honor_records")).rows[0]?.honor_records)
    : 0;
  for (const name of teamTables) {
    const available = await db.query(`SELECT to_regclass('public.${name}') IS NOT NULL AS present`);
    if (typeof available.rows[0]?.present !== "boolean") throw new Error("Team table availability unknown");
    counts[name] = available.rows[0].present
      ? count((await db.query(`SELECT count(*)::bigint AS records FROM ${name}`)).rows[0]?.records)
      : 0;
  }
  Object.assign(counts, await honorStorageCounts(mediaDirectory));
  const requiresHonorVideoIsolation = counts.honor_records > 0 || counts.honor_private_files > 0 || counts.honor_video_reservations > 0;
  const compatible = Object.values(counts).every(value => value === 0);
  return { compatibleWithBaseline: compatible, counts, checksComplete: true, requiresHonorVideoIsolation,
    requiresTeamCapabilities: teamTables.some(name => counts[name] > 0),
    preservesExpandedSchema: true, recommendation: compatible
      ? "Keep schema and backups; verify the actual previous build before switching"
      : recommendation };
}
async function main() {
  await import("dotenv/config");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await db.connect();
    const report = await assessClubRollback(db, path.resolve(process.env.MEDIA_DIR || "media"));
    console.log(JSON.stringify(report));
    if (!report.compatibleWithBaseline) process.exitCode = 1;
  } catch {
    console.log(JSON.stringify({ compatibleWithBaseline: false, checksComplete: false, preservesExpandedSchema: true,
      error: "Rollback safety checks failed; no rollback approved", recommendation }));
    process.exitCode = 1;
  } finally { await db.end().catch(() => {}); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
