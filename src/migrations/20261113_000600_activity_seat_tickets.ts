import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TABLE activity_seat_tickets (
      seating_id integer NOT NULL REFERENCES activity_seatings(id) ON DELETE CASCADE,
      seat text NOT NULL,
      picture bytea NOT NULL CHECK (octet_length(picture) BETWEEN 1 AND 8388608),
      mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png')),
      version uuid NOT NULL,
      uploaded_by integer REFERENCES users(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (seating_id, seat)
    );
  `);
}

export async function down() {
  throw new Error("Roll back the application and retain uploaded seat tickets.");
}
