import { cms } from "@/lib/content";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
export const dynamic = "force-dynamic";
const honorIndexes = [
  { name: "team_honor_records_team_idx", table: "team_honor_records", column: "team_id" },
  { name: "team_honor_records_game_idx", table: "team_honor_records", column: "game_id" },
  { name: "team_honor_records_author_idx", table: "team_honor_records", column: "author_id" },
  { name: "team_honor_records_season_idx", table: "team_honor_records", column: "season_id" },
  { name: "team_honor_records_state_idx", table: "team_honor_records", column: "state" },
  { name: "team_honor_records_reviewed_by_idx", table: "team_honor_records", column: "reviewed_by_id" },
  { name: "team_honor_records_updated_at_idx", table: "team_honor_records", column: "updated_at" },
  { name: "team_honor_records_created_at_idx", table: "team_honor_records", column: "created_at" },
  { name: "payload_locked_documents_rels_team_honor_records_id_idx", table: "payload_locked_documents_rels", column: "team_honor_records_id" },
];
const seatingIndexes = [
  { name: "activity_seatings_event_id_key", table: "activity_seatings", columns: ["event_id"], partial: false },
  { name: "activity_seatings_post_id_key", table: "activity_seatings", columns: ["post_id"], partial: false },
  { name: "activity_seat_claims_pkey", table: "activity_seat_claims", columns: ["seating_id", "seat"], partial: false },
  { name: "activity_seat_blocks_pkey", table: "activity_seat_blocks", columns: ["seating_id", "seat"], partial: false },
  { name: "activity_seat_requests_active_idx", table: "activity_seat_requests", columns: ["seating_id", "member_id"], partial: true },
];
type IndexMetadata = {
  name: string;
  table_name: string;
  columns: string[];
  valid: boolean;
  ready: boolean;
  is_unique: boolean;
  predicate: string | null;
};
export async function GET() {
  try {
    const p = await cms();
    await p.count({ collection: "events", overrideAccess: false, user: null });
    const db = p.db as unknown as PostgresAdapter;
    // Verify required structure without loading any private answers or contact data.
    await db.pool.query("SELECT dedupe_key,form_version FROM event_signups LIMIT 0");
    await db.pool.query("SELECT activity_key,candidates,winners,history,revision,drawn_by FROM event_signup_lotteries LIMIT 0");
    const lotteryMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261113_000500_activity_signup_lotteries"]);
    if (lotteryMigration.rowCount !== 1) throw new Error("Required activity lottery migration unavailable");
    await db.pool.query("SELECT key FROM auth_codes LIMIT 0");
    await db.pool.query("SELECT key FROM auth_rate_limits LIMIT 0");
    await db.pool.query("SELECT department, affiliation FROM users LIMIT 0");
    for (const table of ["events", "announcements", "community_posts"]) {
      await db.pool.query(`SELECT audience FROM ${table} LIMIT 0`);
    }
    await db.pool.query("SELECT version_audience FROM _events_v LIMIT 0");
    await db.pool.query("SELECT version_audience FROM _announcements_v LIMIT 0");
    await db.pool.query("SELECT game_id,view_signups,export_signups FROM users_community_offices LIMIT 0");
    await db.pool.query("SELECT status,confirmed_at FROM community_joins LIMIT 0");
    await db.pool.query("SELECT source_key,approved_version,history FROM content_promotions LIMIT 0");
    const migration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261011_180000_club_operations"]);
    if (!migration.rowCount) throw new Error("Required migration unavailable");
    const promotionMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261012_030000_content_promotions"]);
    if (!promotionMigration.rowCount) throw new Error("Required promotion migration unavailable");
    await db.pool.query("SELECT current_key,signup_form FROM staff_batches LIMIT 0");
    await db.pool.query("SELECT request_key,status FROM staff_applications LIMIT 0");
    const staffMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261012_050000_staff_recruitment"]);
    if (!staffMigration.rowCount) throw new Error("Required staff migration unavailable");
    await db.pool.query("SELECT membership_key,status,joined_at FROM team_memberships LIMIT 0");
    await db.pool.query("SELECT membership_id,membership_joined_at,visible,revision FROM team_member_profiles LIMIT 0");
    const teamMigrations = await db.pool.query("SELECT name FROM payload_migrations WHERE name=ANY($1::text[])", [["20261012_160000_team_core", "20261012_170000_team_member_profiles"]]);
    if (teamMigrations.rowCount !== 2) throw new Error("Required team migrations unavailable");
    await db.pool.query('SELECT team_id,game_id,season_id,author_id,author_name,membership_ref,title,competition,"placing",date,description,images,video_u_r_l,state,revision,submitted_version,submitted_at,approved_version,approved_snapshot,approved_at,reviewed_by_id,review_note,history FROM team_honor_records LIMIT 0');
    await db.pool.query("SELECT team_honor_records_id FROM payload_locked_documents_rels LIMIT 0");
    const honorMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261012_080000_team_honor_records"]);
    if (honorMigration.rowCount !== 1) throw new Error("Required honor migration unavailable");
    await db.pool.query("SELECT post_images,signup_images FROM community_posts LIMIT 0");
    await db.pool.query("SELECT post_images,signup_images FROM events LIMIT 0");
    await db.pool.query("SELECT version_post_images,version_signup_images FROM _events_v LIMIT 0");
    await db.pool.query("SELECT post_images FROM announcements LIMIT 0");
    await db.pool.query("SELECT version_post_images FROM _announcements_v LIMIT 0");
    const imagesMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261110_000000_publication_images"]);
    if (imagesMigration.rowCount !== 1) throw new Error("Required publication images migration unavailable");
    await db.pool.query("SELECT id,event_id,post_id,enabled,opens_at,mode FROM activity_seatings LIMIT 0");
    await db.pool.query("SELECT seating_id,seat,request_id FROM activity_seat_claims LIMIT 0");
    await db.pool.query("SELECT seating_id,seat,blocked_by,created_at FROM activity_seat_blocks LIMIT 0");
    await db.pool.query("SELECT seating_id,request_id,seat,released_by,released_at,revision FROM activity_seat_releases LIMIT 0");
    await db.pool.query("SELECT seating_id,request_id,seat,added_by,added_at,revision FROM activity_seat_additions LIMIT 0");
    await db.pool.query("SELECT seating_id,member_id,status,phone,seats,allocation_mode,requested_count,revision,cancelled_at,revoked_at,revoked_by FROM activity_seat_requests LIMIT 0");
    await db.pool.query("SELECT id,seating_id,member_id,request_id,picture FROM activity_seat_proofs LIMIT 0");
    const seatingMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261112_000000_activity_seating"]);
    if (seatingMigration.rowCount !== 1) throw new Error("Required activity seating migration unavailable");
    const scheduleMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261112_010000_activity_seating_schedule"]);
    if (scheduleMigration.rowCount !== 1) throw new Error("Required seating schedule migration unavailable");
    const blockMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261112_030000_activity_seat_blocks"]);
    if (blockMigration.rowCount !== 1) throw new Error("Required seat blocks migration unavailable");
    const revisionMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261112_040000_activity_seat_revision"]);
    if (revisionMigration.rowCount !== 1) throw new Error("Required seat request revision migration unavailable");
    const cancellationMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261112_050000_activity_seat_cancellation"]);
    if (cancellationMigration.rowCount !== 1) throw new Error("Required seat cancellation migration unavailable");
    const revocationMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261112_060000_activity_seat_revocation"]);
    if (revocationMigration.rowCount !== 1) throw new Error("Required seat revocation migration unavailable");
    const releaseMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261112_070000_activity_seat_release"]);
    if (releaseMigration.rowCount !== 1) throw new Error("Required seat release migration unavailable");
    const additionMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261112_080000_activity_seat_addition"]);
    if (additionMigration.rowCount !== 1) throw new Error("Required seat addition migration unavailable");
    const modesMigration = await db.pool.query("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261112_090000_activity_seat_modes"]);
    if (modesMigration.rowCount !== 1) throw new Error("Required seat modes migration unavailable");
    await db.pool.query("SELECT start_at,end_at,location FROM community_posts LIMIT 0");
    await db.pool.query("SELECT owner_id,expires_at FROM pending_uploads LIMIT 0");
    await db.pool.query("SELECT kind,enabled FROM site_home_sections LIMIT 0");
    const v2Migrations = await db.pool.query("SELECT name FROM payload_migrations WHERE name=ANY($1::text[])", [["20261111_000000_v2_media_schedule", "20261112_000000_v2_home_sections"]]);
    if (v2Migrations.rowCount !== 2) throw new Error("Required V2 migrations unavailable");
    const indexes = await db.pool.query<IndexMetadata>(`
      SELECT idx.relname name, src.relname table_name, i.indisvalid valid,
        i.indisready ready, i.indisunique is_unique, pg_get_expr(i.indpred,i.indrelid) predicate,
        ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(n,ord)
          JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.n
          WHERE k.ord<=i.indnkeyatts ORDER BY k.ord) columns
      FROM pg_index i JOIN pg_class src ON src.oid=i.indrelid
        JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_namespace ns ON ns.oid=src.relnamespace
      WHERE ns.nspname='public' AND idx.relname=ANY($1::text[])
    `, [[...honorIndexes, ...seatingIndexes].map(index => index.name)]);
    if (!honorIndexes.every(required => indexes.rows.some(index =>
      index.name === required.name && index.table_name === required.table &&
      index.valid && index.ready && !index.is_unique && index.predicate === null &&
      Array.isArray(index.columns) && index.columns.length === 1 && index.columns[0] === required.column)))
      throw new Error("Required honor indexes unavailable");
    if (!seatingIndexes.every(required => indexes.rows.some(index =>
      index.name === required.name && index.table_name === required.table && index.valid && index.ready && index.is_unique &&
      JSON.stringify(index.columns) === JSON.stringify(required.columns) && (required.partial
        ? /^\(?status\s*<>\s*'rejected'::text\)?$/.test(index.predicate?.trim() ?? "")
        : index.predicate === null)))) throw new Error("Required seating uniqueness constraints unavailable");
    return Response.json({ status: "ready", schema: "club-operations-1" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
