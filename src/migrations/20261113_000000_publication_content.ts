import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TYPE enum_pending_uploads_purpose ADD VALUE IF NOT EXISTS 'publication';
    ALTER TABLE community_posts ADD COLUMN content_mode varchar, ADD COLUMN content_blocks jsonb;
    ALTER TABLE community_posts ALTER COLUMN body DROP NOT NULL;
  `);
}

export async function down() {
  throw new Error("保留活动正文与图片数据；回退应用时保留新增结构。");
}
