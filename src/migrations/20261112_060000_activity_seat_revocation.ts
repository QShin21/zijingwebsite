import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE activity_seat_requests ADD COLUMN revoked_at timestamptz;
    ALTER TABLE activity_seat_requests ADD COLUMN revoked_by integer REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE activity_seat_requests ADD CONSTRAINT activity_seat_requests_revoked_status_check
      CHECK (revoked_at IS NULL OR (status = 'rejected' AND cancelled_at IS NULL));
    ALTER TABLE activity_seat_requests ADD CONSTRAINT activity_seat_requests_revoked_actor_check
      CHECK (revoked_by IS NULL OR revoked_at IS NOT NULL);
  `);
}

export async function down() {
  throw new Error("Roll back the application and retain seat revocation history.");
}
