import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    ALTER TYPE enum_users_roles ADD VALUE IF NOT EXISTS 'honoraryBackbone';
    CREATE UNIQUE INDEX IF NOT EXISTS users_single_president_idx ON users_roles (value) WHERE value = 'president';
  `);
}

export async function down() {
  throw new Error("保留退休成员身份及其历史记录。");
}
