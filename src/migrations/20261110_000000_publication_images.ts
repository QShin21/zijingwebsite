import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE community_posts ADD COLUMN post_images jsonb, ADD COLUMN signup_images jsonb;
    ALTER TABLE events ADD COLUMN post_images jsonb, ADD COLUMN signup_images jsonb;
    ALTER TABLE _events_v ADD COLUMN version_post_images jsonb, ADD COLUMN version_signup_images jsonb;
    ALTER TABLE announcements ADD COLUMN post_images jsonb;
    ALTER TABLE _announcements_v ADD COLUMN version_post_images jsonb;
  `);
}

export async function down() {
  throw new Error("Roll back the application and retain the image columns and their data.");
}
