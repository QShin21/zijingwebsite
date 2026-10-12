import {
  sql,
  type MigrateUpArgs,
  type MigrateDownArgs,
} from "@payloadcms/db-postgres";

// Additive honor submissions. No rewrite/copy of legacy honors, teams, seasons or memberships.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    CREATE TYPE enum_team_honor_records_state AS ENUM ('draft','pending','withdrawn','returned','rejected','approved','hidden');
    CREATE TABLE team_honor_records (
      id serial PRIMARY KEY,
      team_id integer NOT NULL CONSTRAINT team_honor_records_team_id_teams_id_fk REFERENCES teams(id) ON DELETE RESTRICT,
      game_id integer NOT NULL CONSTRAINT team_honor_records_game_id_games_id_fk REFERENCES games(id) ON DELETE RESTRICT,
      season_id integer CONSTRAINT team_honor_records_season_id_seasons_id_fk REFERENCES seasons(id) ON DELETE RESTRICT,
      author_id integer NOT NULL CONSTRAINT team_honor_records_author_id_users_id_fk REFERENCES users(id) ON DELETE RESTRICT,
      author_name varchar NOT NULL, membership_ref numeric NOT NULL,
      title varchar NOT NULL, competition varchar, "placing" varchar, date timestamptz(3), description varchar,
      images jsonb, video_u_r_l varchar,
      state enum_team_honor_records_state NOT NULL, revision numeric NOT NULL,
      submitted_version varchar, submitted_at timestamptz(3), approved_version varchar, approved_snapshot jsonb, approved_at timestamptz(3),
      reviewed_by_id integer CONSTRAINT team_honor_records_reviewed_by_id_users_id_fk REFERENCES users(id) ON DELETE SET NULL,
      review_note varchar, history jsonb,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE INDEX team_honor_records_team_idx ON team_honor_records(team_id);
    CREATE INDEX team_honor_records_game_idx ON team_honor_records(game_id);
    CREATE INDEX team_honor_records_author_idx ON team_honor_records(author_id);
    CREATE INDEX team_honor_records_season_idx ON team_honor_records(season_id);
    CREATE INDEX team_honor_records_state_idx ON team_honor_records(state);
    CREATE INDEX team_honor_records_reviewed_by_idx ON team_honor_records(reviewed_by_id);
    CREATE INDEX team_honor_records_updated_at_idx ON team_honor_records(updated_at);
    CREATE INDEX team_honor_records_created_at_idx ON team_honor_records(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN team_honor_records_id integer
      CONSTRAINT payload_locked_documents_rels_team_honor_records_fk REFERENCES team_honor_records(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_team_honor_records_id_idx ON payload_locked_documents_rels(team_honor_records_id);
  `);
}
export async function down({ db }: MigrateDownArgs) {
  void db;
  throw new Error(
    "Preserve honor records, authors and evidence snapshots; roll back the application without dropping honor data.",
  );
}
