import {
  sql,
  type MigrateUpArgs,
  type MigrateDownArgs,
} from "@payloadcms/db-postgres";

// Expand only. Old teams, historical season text, honors and users.teams stay intact.
// No legacy content implies team approval or membership, and no production execution.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    CREATE TYPE enum_teams_team_status AS ENUM ('unestablished','active','resting','archived');
    CREATE TYPE enum__teams_v_version_team_status AS ENUM ('unestablished','active','resting','archived');
    CREATE TYPE enum_team_establishment_applications_status AS ENUM ('pending','returned','rejected','withdrawn','approved');
    CREATE TYPE enum_team_recruitments_status AS ENUM ('draft','open','closed','archived');
    CREATE TYPE enum_team_join_applications_status AS ENUM ('draft','pending','returned','rejected','withdrawn','approved');
    CREATE TYPE enum_team_memberships_status AS ENUM ('active','revoked');
    CREATE TABLE team_establishment_applications (
      id serial PRIMARY KEY, title varchar NOT NULL, game_id integer NOT NULL REFERENCES games(id),
      applicant_id integer NOT NULL REFERENCES users(id), reason varchar NOT NULL, request_key varchar NOT NULL,
      status enum_team_establishment_applications_status NOT NULL DEFAULT 'pending', review_note varchar,
      reviewed_by_id integer REFERENCES users(id) ON DELETE SET NULL, reviewed_at timestamptz(3),
      team_id integer REFERENCES teams(id) ON DELETE SET NULL,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX team_establishment_applications_request_key_idx ON team_establishment_applications(request_key);
    CREATE INDEX team_establishment_applications_game_idx ON team_establishment_applications(game_id);
    CREATE INDEX team_establishment_applications_applicant_idx ON team_establishment_applications(applicant_id);
    CREATE INDEX team_establishment_applications_status_idx ON team_establishment_applications(status);
    CREATE INDEX team_establishment_applications_team_idx ON team_establishment_applications(team_id);
    CREATE INDEX team_establishment_applications_reviewed_by_idx ON team_establishment_applications(reviewed_by_id);
    CREATE INDEX team_establishment_applications_updated_at_idx ON team_establishment_applications(updated_at);
    CREATE INDEX team_establishment_applications_created_at_idx ON team_establishment_applications(created_at);
    ALTER TABLE teams ADD COLUMN team_status enum_teams_team_status DEFAULT 'unestablished',
      ADD COLUMN establishment_application_id integer REFERENCES team_establishment_applications(id) ON DELETE SET NULL;
    ALTER TABLE _teams_v ADD COLUMN version_team_status enum__teams_v_version_team_status DEFAULT 'unestablished',
      ADD COLUMN version_establishment_application_id integer REFERENCES team_establishment_applications(id) ON DELETE SET NULL;
    CREATE UNIQUE INDEX teams_establishment_application_idx ON teams(establishment_application_id);
    CREATE INDEX _teams_v_version_establishment_application_idx ON _teams_v(version_establishment_application_id);
    CREATE TABLE team_recruitments (
      id serial PRIMARY KEY, title varchar NOT NULL, team_id integer NOT NULL REFERENCES teams(id),
      game_id integer NOT NULL REFERENCES games(id), status enum_team_recruitments_status NOT NULL DEFAULT 'draft',
      signup_form jsonb NOT NULL, created_by_id integer NOT NULL REFERENCES users(id),
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE INDEX team_recruitments_team_idx ON team_recruitments(team_id);
    CREATE INDEX team_recruitments_game_idx ON team_recruitments(game_id);
    CREATE INDEX team_recruitments_status_idx ON team_recruitments(status);
    CREATE INDEX team_recruitments_created_by_idx ON team_recruitments(created_by_id);
    CREATE INDEX team_recruitments_updated_at_idx ON team_recruitments(updated_at);
    CREATE INDEX team_recruitments_created_at_idx ON team_recruitments(created_at);
    CREATE UNIQUE INDEX team_recruitments_one_open_team_idx ON team_recruitments(team_id) WHERE status='open';
    CREATE TABLE team_join_applications (
      id serial PRIMARY KEY, title varchar NOT NULL, team_id integer NOT NULL REFERENCES teams(id),
      game_id integer NOT NULL REFERENCES games(id), recruitment_id integer NOT NULL REFERENCES team_recruitments(id),
      applicant_id integer NOT NULL REFERENCES users(id), request_key varchar NOT NULL,
      status enum_team_join_applications_status NOT NULL DEFAULT 'draft', form_version varchar NOT NULL,
      form_snapshot jsonb NOT NULL, answers jsonb NOT NULL, review_note varchar,
      reviewed_by_id integer REFERENCES users(id) ON DELETE SET NULL, reviewed_at timestamptz(3),
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX team_join_applications_request_key_idx ON team_join_applications(request_key);
    CREATE UNIQUE INDEX team_join_applications_recruitment_applicant_idx ON team_join_applications(recruitment_id,applicant_id);
    CREATE INDEX team_join_applications_team_idx ON team_join_applications(team_id);
    CREATE INDEX team_join_applications_game_idx ON team_join_applications(game_id);
    CREATE INDEX team_join_applications_recruitment_idx ON team_join_applications(recruitment_id);
    CREATE INDEX team_join_applications_applicant_idx ON team_join_applications(applicant_id);
    CREATE INDEX team_join_applications_status_idx ON team_join_applications(status);
    CREATE INDEX team_join_applications_reviewed_by_idx ON team_join_applications(reviewed_by_id);
    CREATE INDEX team_join_applications_updated_at_idx ON team_join_applications(updated_at);
    CREATE INDEX team_join_applications_created_at_idx ON team_join_applications(created_at);
    CREATE TABLE team_memberships (
      id serial PRIMARY KEY, title varchar NOT NULL, team_id integer NOT NULL REFERENCES teams(id),
      game_id integer NOT NULL REFERENCES games(id), member_id integer NOT NULL REFERENCES users(id),
      membership_key varchar NOT NULL, status enum_team_memberships_status NOT NULL,
      joined_at timestamptz(3) NOT NULL, revoked_at timestamptz(3), left_at timestamptz(3),
      season_id integer REFERENCES seasons(id) ON DELETE SET NULL,
      source_application_id integer NOT NULL REFERENCES team_join_applications(id),
      granted_by_id integer NOT NULL REFERENCES users(id), revoked_by_id integer REFERENCES users(id) ON DELETE SET NULL,
      revocation_reason varchar, updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX team_memberships_membership_key_idx ON team_memberships(membership_key);
    CREATE UNIQUE INDEX team_memberships_team_member_idx ON team_memberships(team_id,member_id);
    CREATE INDEX team_memberships_team_idx ON team_memberships(team_id);
    CREATE INDEX team_memberships_game_idx ON team_memberships(game_id);
    CREATE INDEX team_memberships_member_idx ON team_memberships(member_id);
    CREATE INDEX team_memberships_status_idx ON team_memberships(status);
    CREATE INDEX team_memberships_source_application_idx ON team_memberships(source_application_id);
    CREATE INDEX team_memberships_granted_by_idx ON team_memberships(granted_by_id);
    CREATE INDEX team_memberships_revoked_by_idx ON team_memberships(revoked_by_id);
    CREATE INDEX team_memberships_updated_at_idx ON team_memberships(updated_at);
    CREATE INDEX team_memberships_created_at_idx ON team_memberships(created_at);
    ALTER TABLE payload_locked_documents_rels
      ADD COLUMN team_establishment_applications_id integer REFERENCES team_establishment_applications(id) ON DELETE CASCADE,
      ADD COLUMN team_recruitments_id integer REFERENCES team_recruitments(id) ON DELETE CASCADE,
      ADD COLUMN team_join_applications_id integer REFERENCES team_join_applications(id) ON DELETE CASCADE,
      ADD COLUMN team_memberships_id integer REFERENCES team_memberships(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_team_establishment_applications_id_idx ON payload_locked_documents_rels(team_establishment_applications_id);
    CREATE INDEX payload_locked_documents_rels_team_recruitments_id_idx ON payload_locked_documents_rels(team_recruitments_id);
    CREATE INDEX payload_locked_documents_rels_team_join_applications_id_idx ON payload_locked_documents_rels(team_join_applications_id);
    CREATE INDEX payload_locked_documents_rels_team_memberships_id_idx ON payload_locked_documents_rels(team_memberships_id);
  `);
}
export async function down({ db }: MigrateDownArgs) {
  void db;
  throw new Error(
    "Preserve team approval, private applications and membership history. Roll back with a reviewed compatible application; no automatic schema removal.",
  );
}
