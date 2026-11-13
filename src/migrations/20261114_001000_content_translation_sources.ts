import { type MigrateDownArgs, type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

// Allows English caches for more public content (news, albums, fixed pages, community and
// team introductions, visible showcase posts, approved honors). Constraint change only;
// no data is read or rewritten.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE content_translations DROP CONSTRAINT IF EXISTS content_translations_collection_check;
    ALTER TABLE content_translations ADD CONSTRAINT content_translations_collection_check CHECK (collection IN (
      'events', 'announcements', 'community-posts', 'news', 'albums', 'pages', 'games', 'teams', 'community-showcase', 'team-honor-records'));
  `);
}

export async function down({ db }: MigrateDownArgs) {
  // Derived cache rows of the added collections are removed before restoring the old rule.
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    DELETE FROM content_translations WHERE collection NOT IN ('events', 'announcements', 'community-posts');
    ALTER TABLE content_translations DROP CONSTRAINT IF EXISTS content_translations_collection_check;
    ALTER TABLE content_translations ADD CONSTRAINT content_translations_collection_check CHECK (collection IN ('events', 'announcements', 'community-posts'));
  `);
}
