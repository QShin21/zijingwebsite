import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE pending_uploads ALTER COLUMN owner_id DROP NOT NULL;
    ALTER TABLE pending_uploads DROP CONSTRAINT pending_uploads_owner_id_fkey;
    ALTER TABLE pending_uploads ADD CONSTRAINT pending_uploads_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
  `);
}

export async function down() {
  throw new Error("保留已发布图片和账号删除后的引用数据。");
}
