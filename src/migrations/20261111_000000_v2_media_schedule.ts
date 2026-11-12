import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

// Additive only: existing posts, images, identities and permissions stay intact.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE community_posts ADD COLUMN start_at timestamptz(3), ADD COLUMN end_at timestamptz(3), ADD COLUMN location varchar;
    CREATE TYPE enum_pending_uploads_purpose AS ENUM ('showcase');
    CREATE TABLE pending_uploads (
      id serial PRIMARY KEY,
      owner_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      purpose enum_pending_uploads_purpose NOT NULL,
      data varchar NOT NULL,
      width numeric NOT NULL,
      height numeric NOT NULL,
      expires_at timestamptz(3) NOT NULL,
      consumed_at timestamptz(3),
      updated_at timestamptz(3) NOT NULL DEFAULT now(),
      created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE INDEX pending_uploads_owner_idx ON pending_uploads(owner_id);
    CREATE INDEX pending_uploads_expires_at_idx ON pending_uploads(expires_at);
    CREATE INDEX pending_uploads_updated_at_idx ON pending_uploads(updated_at);
    CREATE INDEX pending_uploads_created_at_idx ON pending_uploads(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN pending_uploads_id integer REFERENCES pending_uploads(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_pending_uploads_id_idx ON payload_locked_documents_rels(pending_uploads_id);
  `);
}

export async function down() {
  throw new Error("保留社群日程和临时图片数据；回滚应用代码时保留 additive 结构。");
}
