import { sql, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";

// Add one reference/decision table. Existing content, game attribution and answers are untouched.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    CREATE TYPE enum_content_promotions_source_collection AS ENUM ('community-posts','community-showcase');
    CREATE TYPE enum_content_promotions_kind AS ENUM ('event','notice','showcase');
    CREATE TYPE enum_content_promotions_status AS ENUM ('pending','returned','rejected','withdrawn','approved','demoted','needsReview');
    CREATE TABLE content_promotions (
      id serial PRIMARY KEY, source_collection enum_content_promotions_source_collection NOT NULL,
      source_i_d numeric NOT NULL, source_key varchar NOT NULL,
      game_id integer CONSTRAINT content_promotions_game_id_games_id_fk REFERENCES games(id) ON DELETE SET NULL,
      kind enum_content_promotions_kind NOT NULL, status enum_content_promotions_status NOT NULL,
      requested_by_id integer CONSTRAINT content_promotions_requested_by_id_users_id_fk REFERENCES users(id) ON DELETE SET NULL,
      reason varchar, requested_version varchar, requested_snapshot jsonb,
      approved_version varchar, approved_snapshot jsonb,
      approved_by_id integer CONSTRAINT content_promotions_approved_by_id_users_id_fk REFERENCES users(id) ON DELETE SET NULL, approved_at timestamptz(3),
      review_note varchar, history jsonb,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX content_promotions_source_key_idx ON content_promotions(source_key);
    CREATE INDEX content_promotions_game_idx ON content_promotions(game_id);
    CREATE INDEX content_promotions_requested_by_idx ON content_promotions(requested_by_id);
    CREATE INDEX content_promotions_approved_by_idx ON content_promotions(approved_by_id);
    CREATE INDEX content_promotions_updated_at_idx ON content_promotions(updated_at);
    CREATE INDEX content_promotions_created_at_idx ON content_promotions(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN content_promotions_id integer CONSTRAINT payload_locked_documents_rels_content_promotions_fk REFERENCES content_promotions(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_content_promotions_id_idx ON payload_locked_documents_rels(content_promotions_id);
  `);
}
export async function down({ db }: MigrateDownArgs) {
  void db;
  throw new Error("Preserve promotion decisions and approved versions; use a compatible application rollback without dropping data.");
}
