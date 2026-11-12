
import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE activity_seatings ADD COLUMN opens_at timestamptz;
  `);
}

export async function down() {
  throw new Error("Keep scheduled opening times when rolling back application code.");
}
