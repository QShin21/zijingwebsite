import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TABLE event_signup_lotteries (
      id serial PRIMARY KEY,
      activity_key varchar NOT NULL UNIQUE,
      candidates jsonb NOT NULL,
      winners jsonb NOT NULL,
      history jsonb NOT NULL,
      revision varchar NOT NULL,
      drawn_by varchar NOT NULL,
      updated_at timestamptz(3) NOT NULL DEFAULT now(),
      created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE INDEX event_signup_lotteries_updated_at_idx ON event_signup_lotteries(updated_at);
    CREATE INDEX event_signup_lotteries_created_at_idx ON event_signup_lotteries(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN event_signup_lotteries_id integer REFERENCES event_signup_lotteries(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_event_signup_lotteries_id_idx ON payload_locked_documents_rels(event_signup_lotteries_id);
  `);
}

export async function down() {
  throw new Error("保留抽签结果；回退应用时保留该数据表。");
}
