import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TYPE enum_users_affiliation AS ENUM ('tsinghua', 'peer', 'external');
    ALTER TABLE users ADD COLUMN affiliation enum_users_affiliation NOT NULL DEFAULT 'tsinghua';

    CREATE TYPE enum_events_audience AS ENUM ('campus', 'peer', 'public');
    CREATE TYPE enum__events_v_version_audience AS ENUM ('campus', 'peer', 'public');
    CREATE TYPE enum_announcements_audience AS ENUM ('campus', 'peer', 'public');
    CREATE TYPE enum__announcements_v_version_audience AS ENUM ('campus', 'peer', 'public');
    CREATE TYPE enum_community_posts_audience AS ENUM ('campus', 'peer', 'public');

    ALTER TABLE events ADD COLUMN audience enum_events_audience NOT NULL DEFAULT 'campus';
    ALTER TABLE _events_v ADD COLUMN version_audience enum__events_v_version_audience DEFAULT 'campus';
    ALTER TABLE announcements ADD COLUMN audience enum_announcements_audience NOT NULL DEFAULT 'campus';
    ALTER TABLE _announcements_v ADD COLUMN version_audience enum__announcements_v_version_audience DEFAULT 'campus';
    ALTER TABLE community_posts ADD COLUMN audience enum_community_posts_audience NOT NULL DEFAULT 'campus';
  `);
}

export async function down() {
  throw new Error("保留账号身份与发布范围，应用回退需先核对访问控制兼容性。");
}
