import { type MigrateUpArgs, type MigrateDownArgs, sql } from "@payloadcms/db-postgres";
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`ALTER TABLE community_messages ADD COLUMN image varchar; ALTER TABLE community_messages ALTER COLUMN body DROP NOT NULL;`);
}
export async function down({ db }: MigrateDownArgs) {
  // Keep body nullable: image-only messages can have an empty body.
  await db.execute(sql`ALTER TABLE community_messages DROP COLUMN image;`);
}
