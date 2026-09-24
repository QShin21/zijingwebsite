import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_site_navigation_path" ADD VALUE '/community';
  ALTER TYPE "public"."enum_site_navigation_path" ADD VALUE '/announcements';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_navigation" ALTER COLUMN "path" SET DATA TYPE text;
  DROP TYPE "public"."enum_site_navigation_path";
  CREATE TYPE "public"."enum_site_navigation_path" AS ENUM('/about', '/events', '/teams', '/honors', '/join', '/news', '/gallery', '/contact');
  ALTER TABLE "site_navigation" ALTER COLUMN "path" SET DATA TYPE "public"."enum_site_navigation_path" USING "path"::"public"."enum_site_navigation_path";`)
}
