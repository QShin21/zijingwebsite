import { type MigrateDownArgs, type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

// Personal display preference: one row hides one own record from the "我的" overview.
// Additive only; it never touches applications, signups, answers or review states.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TABLE personal_archives (
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target text NOT NULL CHECK (target ~ '^(staff|teamJoin|teamEstablishment|communityOfficer|club|community):[1-9][0-9]{0,9}$'),
      archived_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, target)
    );
  `);
}

export async function down({ db }: MigrateDownArgs) {
  // Dropping only removes display preferences; every business record is untouched.
  await db.execute(sql`DROP TABLE IF EXISTS personal_archives;`);
}
