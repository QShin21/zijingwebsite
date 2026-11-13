import { type MigrateDownArgs, type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

// Additive cache/queue for English renderings of published activities, notices and
// questionnaires. Not a Payload collection: no REST/GraphQL/admin surface reads it.
// Rows only hold a work marker (generation) and English keyed by hashes of Chinese text;
// the worker always re-reads the committed published document, so no draft or source
// snapshot is stored here.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TABLE IF NOT EXISTS content_translations (
      id serial PRIMARY KEY,
      collection varchar(40) NOT NULL,
      doc_id integer NOT NULL,
      locale varchar(8) NOT NULL DEFAULT 'en',
      generation integer NOT NULL DEFAULT 1,
      status varchar(16) NOT NULL DEFAULT 'pending',
      source_hash varchar(64),
      translations jsonb NOT NULL DEFAULT '{}'::jsonb,
      attempts integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz(3) NOT NULL DEFAULT now(),
      lease_token varchar(64),
      lease_until timestamptz(3),
      error_code varchar(32),
      created_at timestamptz(3) NOT NULL DEFAULT now(),
      updated_at timestamptz(3) NOT NULL DEFAULT now(),
      CONSTRAINT content_translations_status_check CHECK (status IN ('pending', 'processing', 'done', 'failed', 'obsolete')),
      CONSTRAINT content_translations_collection_check CHECK (collection IN ('events', 'announcements', 'community-posts')),
      CONSTRAINT content_translations_doc_locale_key UNIQUE (collection, doc_id, locale)
    );
    CREATE INDEX IF NOT EXISTS content_translations_queue_idx ON content_translations (locale, status, next_attempt_at);
  `);
}

export async function down({ db }: MigrateDownArgs) {
  // Only derived, regenerable data lives here; source content is untouched.
  await db.execute(sql`DROP TABLE IF EXISTS content_translations;`);
}
