import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TABLE community_icons (
      id serial PRIMARY KEY,
      game_id integer NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
      source varchar NOT NULL,
      image varchar NOT NULL,
      crop jsonb NOT NULL,
      credit varchar,
      updated_by_id integer REFERENCES users(id) ON DELETE SET NULL,
      updated_at timestamptz(3) NOT NULL DEFAULT now(),
      created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX community_icons_game_idx ON community_icons(game_id);
    CREATE INDEX community_icons_updated_by_idx ON community_icons(updated_by_id);
    CREATE INDEX community_icons_updated_at_idx ON community_icons(updated_at);
    CREATE INDEX community_icons_created_at_idx ON community_icons(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN community_icons_id integer REFERENCES community_icons(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_community_icons_id_idx ON payload_locked_documents_rels(community_icons_id);
  `);
}
export async function down() {
  throw new Error("回退应用时保留社群图标与原图数据。");
}
