import { type MigrateDownArgs, type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

// Allows English caches for verified legacy honors, recruitment batch notices and the
// public home texts of the site settings global. Constraint change only.
const previous = sql`'events', 'announcements', 'community-posts', 'news', 'albums', 'pages', 'games', 'teams', 'community-showcase', 'team-honor-records'`;
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE content_translations DROP CONSTRAINT IF EXISTS content_translations_collection_check;
    ALTER TABLE content_translations ADD CONSTRAINT content_translations_collection_check CHECK (collection IN (${previous},
      'honors', 'staff-batches', 'team-recruitments', 'site'));
  `);
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    DELETE FROM content_translations WHERE collection IN ('honors', 'staff-batches', 'team-recruitments', 'site');
    ALTER TABLE content_translations DROP CONSTRAINT IF EXISTS content_translations_collection_check;
    ALTER TABLE content_translations ADD CONSTRAINT content_translations_collection_check CHECK (collection IN (${previous}));
  `);
}
