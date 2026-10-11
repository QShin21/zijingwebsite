import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres';
// Additive only: legacy forums, messages and existing content remain intact.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    ALTER TABLE events ADD COLUMN signup_form jsonb;
    ALTER TABLE _events_v ADD COLUMN version_signup_form jsonb;
    ALTER TABLE community_posts ADD COLUMN signup_form jsonb;
    CREATE TABLE event_signups (
      id serial PRIMARY KEY, activity_type varchar NOT NULL, activity_i_d numeric NOT NULL,
      dedupe_key varchar NOT NULL UNIQUE, member_id integer NOT NULL REFERENCES users(id),
      organizer_id integer REFERENCES users(id) ON DELETE SET NULL,
      game_id integer REFERENCES games(id) ON DELETE SET NULL,
      member_name varchar NOT NULL, event_title varchar NOT NULL, form_version varchar NOT NULL,
      questions jsonb NOT NULL, answers jsonb NOT NULL,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE INDEX event_signups_activity_i_d_idx ON event_signups(activity_i_d);
    CREATE INDEX event_signups_member_idx ON event_signups(member_id);
    CREATE INDEX event_signups_organizer_idx ON event_signups(organizer_id);
    CREATE INDEX event_signups_game_idx ON event_signups(game_id);
    CREATE INDEX event_signups_updated_at_idx ON event_signups(updated_at);
    CREATE INDEX event_signups_created_at_idx ON event_signups(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN event_signups_id integer REFERENCES event_signups(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_event_signups_id_idx ON payload_locked_documents_rels(event_signups_id);
  `);
}
export async function down({ db }: MigrateDownArgs) { void db; throw new Error('Preserve activity registrations: roll back application code; retain additive schema and records.'); }
