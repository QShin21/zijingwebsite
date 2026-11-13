import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE activity_seatings ADD COLUMN layout jsonb;
    ALTER TABLE activity_seatings ADD COLUMN layout_revision integer NOT NULL DEFAULT 0;
    CREATE INDEX activity_seat_requests_member_history_idx ON activity_seat_requests (member_id, seating_id, id DESC);
  `);
}

export async function down() {
  throw new Error("Retain custom seating layouts; use a forward fix or a verified data recovery plan.");
}
