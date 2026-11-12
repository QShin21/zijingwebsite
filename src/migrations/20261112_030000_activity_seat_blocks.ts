import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TABLE activity_seat_blocks (
      seating_id integer NOT NULL REFERENCES activity_seatings(id) ON DELETE CASCADE,
      seat text NOT NULL,
      blocked_by integer REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (seating_id, seat)
    );
  `);
}

export async function down() {
  throw new Error("Roll back the application and retain activity seat blocks.");
}
