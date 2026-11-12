import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE activity_seat_requests ADD COLUMN cancelled_at timestamptz;
    ALTER TABLE activity_seat_requests ADD CONSTRAINT activity_seat_requests_cancelled_status_check
      CHECK (cancelled_at IS NULL OR status = 'rejected');
  `);
}

export async function down() {
  throw new Error("Roll back the application and retain seat cancellation history.");
}
