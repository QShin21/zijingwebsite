import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`LOCK TABLE "users" IN ACCESS EXCLUSIVE MODE`);
  const { rows } = await db.execute<{ id: number; name: string }>(
    sql`SELECT "id", "name" FROM "users"`,
  );
  const keys = new Set<string>();
  // Keep this historical rule self-contained; match the application's JS lowercase operation.
  for (const { name } of rows) {
    if (
      typeof name !== "string" ||
      name !== name.trim() ||
      name.length < 2 ||
      name.length > 40 ||
      /[@\p{Cc}]/u.test(name)
    ) {
      throw new Error(
        "Nickname migration stopped: resolve invalid existing nicknames before retrying.",
      );
    }
    const key = name.toLowerCase();
    if (keys.has(key)) {
      throw new Error(
        "Nickname migration stopped: resolve case-insensitive duplicate nicknames before retrying.",
      );
    }
    keys.add(key);
  }
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN "name_key" varchar`);
  for (const { id, name } of rows) {
    await db.execute(
      sql`UPDATE "users" SET "name_key" = ${name.toLowerCase()} WHERE "id" = ${id}`,
    );
  }
  await db.execute(sql`
  ALTER TABLE "users" ALTER COLUMN "name_key" SET NOT NULL;
  CREATE UNIQUE INDEX "users_name_key_idx" ON "users" USING btree ("name_key");
  DROP INDEX "users_account_idx";
  ALTER TABLE "users" DROP COLUMN "account";`);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    "Restore the pre-migration database backup with the previous application version to roll back nickname_login.",
  );
}
