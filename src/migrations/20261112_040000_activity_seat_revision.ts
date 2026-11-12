import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE activity_seat_requests ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);
  `);
}

export async function down() {
  throw new Error("Roll back the application and retain seat request revisions.");
}
