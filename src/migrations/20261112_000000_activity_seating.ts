
import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';

    CREATE TABLE activity_seatings (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_id integer UNIQUE REFERENCES events(id) ON DELETE CASCADE,
      post_id integer UNIQUE REFERENCES community_posts(id) ON DELETE CASCADE,
      enabled boolean NOT NULL,
      CHECK (num_nonnulls(event_id, post_id) = 1)
    );

    CREATE TABLE activity_seat_requests (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      seating_id integer NOT NULL REFERENCES activity_seatings(id) ON DELETE CASCADE,
      member_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_name text NOT NULL,
      phone varchar(16) NOT NULL,
      seats text[] NOT NULL CHECK (cardinality(seats) BETWEEN 1 AND 10),
      status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'rejected')),
      created_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz,
      reviewer_id integer REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (seating_id, id),
      UNIQUE (seating_id, member_id, id)
    );
    CREATE UNIQUE INDEX activity_seat_requests_active_idx
      ON activity_seat_requests (seating_id, member_id) WHERE status <> 'rejected';
    CREATE INDEX activity_seat_requests_review_idx
      ON activity_seat_requests (seating_id, status, id DESC);
    CREATE INDEX activity_seat_requests_member_idx
      ON activity_seat_requests (seating_id, member_id, id DESC);

    CREATE TABLE activity_seat_claims (
      seating_id integer NOT NULL,
      seat text NOT NULL,
      request_id integer NOT NULL,
      PRIMARY KEY (seating_id, seat),
      FOREIGN KEY (seating_id, request_id) REFERENCES activity_seat_requests(seating_id, id) ON DELETE CASCADE
    );
    CREATE INDEX activity_seat_claims_request_idx ON activity_seat_claims (seating_id, request_id);

    CREATE TABLE activity_seat_proofs (
      id uuid PRIMARY KEY,
      seating_id integer NOT NULL REFERENCES activity_seatings(id) ON DELETE CASCADE,
      member_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_id integer,
      picture bytea NOT NULL CHECK (octet_length(picture) BETWEEN 1 AND 2097152),
      created_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY (seating_id, member_id, request_id)
        REFERENCES activity_seat_requests(seating_id, member_id, id) ON DELETE CASCADE
    );
    CREATE INDEX activity_seat_proofs_draft_idx
      ON activity_seat_proofs (seating_id, member_id, created_at) WHERE request_id IS NULL;
    CREATE INDEX activity_seat_proofs_request_idx
      ON activity_seat_proofs (seating_id, request_id) WHERE request_id IS NOT NULL;
  `);
}

export async function down() {
  throw new Error("Roll back the application and retain activity seating requests and evidence.");
}
