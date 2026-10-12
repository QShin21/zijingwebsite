import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";

// Requires the authoritative core membership migration first. Additive only;
// no account, legacy roster, application, media or membership data is copied.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    CREATE TABLE team_member_profiles (
      id serial PRIMARY KEY,
      membership_id integer NOT NULL UNIQUE REFERENCES team_memberships(id),
      membership_joined_at timestamptz(3) NOT NULL,
      display_name varchar NOT NULL,
      position varchar,
      biography varchar,
      avatar varchar,
      visible boolean NOT NULL DEFAULT false,
      revision numeric NOT NULL DEFAULT 1,
      updated_at timestamptz(3) NOT NULL DEFAULT now(),
      created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE INDEX team_member_profiles_updated_at_idx ON team_member_profiles(updated_at);
    CREATE INDEX team_member_profiles_created_at_idx ON team_member_profiles(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN team_member_profiles_id integer REFERENCES team_member_profiles(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_team_member_profiles_id_idx ON payload_locked_documents_rels(team_member_profiles_id);
  `);
}
export async function down({ db }: MigrateDownArgs) {
  void db;
  throw new Error(
    "Preserve member consent and profile records: roll back application code and retain additive schema.",
  );
}
