import { sql, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";

// Reviewed expand/backfill migration. Historical 58 tables and roles remain intact.
// This migration never creates auth_codes/auth_rate_limits/event_signups again and never drops legacy data.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    ALTER TYPE enum_users_roles ADD VALUE IF NOT EXISTS 'backbone';
    ALTER TYPE enum_community_applications_status ADD VALUE IF NOT EXISTS 'returned';
    ALTER TYPE enum_community_applications_status ADD VALUE IF NOT EXISTS 'withdrawn';
    CREATE TYPE enum_users_department AS ENUM ('execution','publicity');
    CREATE TYPE enum_users_community_offices_status AS ENUM ('active','revoked');
    CREATE TYPE enum_community_joins_status AS ENUM ('requested','friendReported','awaitingInvite','joined','withdrawn');
    ALTER TABLE users ADD COLUMN department enum_users_department;
    ALTER TABLE community_applications ADD COLUMN contact_consent boolean DEFAULT false,
      ADD COLUMN request_key varchar, ADD COLUMN review_note varchar,
      ADD COLUMN reviewed_by_id integer CONSTRAINT community_applications_reviewed_by_id_users_id_fk REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN reviewed_at timestamptz(3);
    UPDATE community_applications SET request_key='legacy:' || id;
    -- Existing approved cards were already explicitly authorized for member display in the prior release.
    UPDATE community_applications SET contact_consent=true WHERE status='approved' AND wechat_qr IS NOT NULL;
    CREATE UNIQUE INDEX community_applications_request_key_idx ON community_applications(request_key);
    CREATE INDEX community_applications_reviewed_by_idx ON community_applications(reviewed_by_id);
    CREATE TABLE users_community_offices (
      _order integer NOT NULL, _parent_id integer NOT NULL CONSTRAINT users_community_offices_parent_id_fk REFERENCES users(id) ON DELETE CASCADE,
      id varchar PRIMARY KEY, game_id integer CONSTRAINT users_community_offices_game_id_games_id_fk REFERENCES games(id) ON DELETE SET NULL,
      status enum_users_community_offices_status NOT NULL DEFAULT 'active',
      publish_content boolean DEFAULT true, review_showcase boolean DEFAULT true, handle_joins boolean DEFAULT true,
      view_signups boolean DEFAULT false, export_signups boolean DEFAULT false, contact_consent boolean DEFAULT false,
      granted_by_id integer CONSTRAINT users_community_offices_granted_by_id_users_id_fk REFERENCES users(id) ON DELETE SET NULL, granted_at timestamptz(3),
      source_application_id integer CONSTRAINT users_community_offices_source_application_id_community_applications_id_fk REFERENCES community_applications(id) ON DELETE SET NULL
    );
    CREATE INDEX users_community_offices_order_idx ON users_community_offices(_order);
    CREATE INDEX users_community_offices_parent_id_idx ON users_community_offices(_parent_id);
    CREATE INDEX users_community_offices_game_idx ON users_community_offices(game_id);
    CREATE INDEX users_community_offices_granted_by_idx ON users_community_offices(granted_by_id);
    CREATE INDEX users_community_offices_source_application_idx ON users_community_offices(source_application_id);
    -- Preserve the effective pre-release scope, including explicit assignments held by management.
    INSERT INTO users_community_offices (_order,_parent_id,id,game_id,status,publish_content,review_showcase,handle_joins,view_signups,export_signups,contact_consent,granted_at,source_application_id)
    SELECT row_number() OVER (PARTITION BY r.parent_id ORDER BY r.games_id), r.parent_id,
      'legacy-' || r.parent_id || '-' || r.games_id, r.games_id, 'active', true,true,true,true,true,
      EXISTS(SELECT 1 FROM community_applications a WHERE a.applicant_id=r.parent_id AND a.game_id=r.games_id AND a.status='approved' AND a.wechat_qr IS NOT NULL),
      NULL, (SELECT max(a.id) FROM community_applications a WHERE a.applicant_id=r.parent_id AND a.game_id=r.games_id AND a.status='approved')
    FROM (SELECT DISTINCT parent_id,games_id FROM users_rels WHERE path='communities' AND games_id IS NOT NULL) r
    JOIN users u ON u.id=r.parent_id JOIN games g ON g.id=r.games_id
    WHERE EXISTS(SELECT 1 FROM users_roles role WHERE role.parent_id=r.parent_id AND role.value IN('communityAdmin','vicePresident','president'));
    CREATE TABLE community_joins (
      id serial PRIMARY KEY, member_id integer NOT NULL CONSTRAINT community_joins_member_id_users_id_fk REFERENCES users(id), game_id integer NOT NULL CONSTRAINT community_joins_game_id_games_id_fk REFERENCES games(id),
      contact_id integer CONSTRAINT community_joins_contact_id_users_id_fk REFERENCES users(id) ON DELETE SET NULL, member_name varchar NOT NULL,
      dedupe_key varchar NOT NULL, status enum_community_joins_status NOT NULL, note varchar,
      confirmed_by_id integer CONSTRAINT community_joins_confirmed_by_id_users_id_fk REFERENCES users(id) ON DELETE SET NULL, confirmed_at timestamptz(3),
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX community_joins_dedupe_key_idx ON community_joins(dedupe_key);
    CREATE INDEX community_joins_member_idx ON community_joins(member_id);
    CREATE INDEX community_joins_game_idx ON community_joins(game_id);
    CREATE INDEX community_joins_contact_idx ON community_joins(contact_id);
    CREATE INDEX community_joins_confirmed_by_idx ON community_joins(confirmed_by_id);
    CREATE INDEX community_joins_updated_at_idx ON community_joins(updated_at);
    CREATE INDEX community_joins_created_at_idx ON community_joins(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN community_joins_id integer REFERENCES community_joins(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_community_joins_id_idx ON payload_locked_documents_rels(community_joins_id);
  `);
}
export async function down({ db }: MigrateDownArgs) {
  void db;
  throw new Error("Preserve offices, applications and manual join evidence. Use a reviewed compatible application rollback; do not remove schema or records.");
}
