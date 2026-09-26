import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "community_applications"
    ADD COLUMN "real_name" varchar,
    ADD COLUMN "phone" varchar,
    ADD COLUMN "wechat_qr" varchar;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "community_applications"
    DROP COLUMN "wechat_qr", DROP COLUMN "phone", DROP COLUMN "real_name";`);
}
