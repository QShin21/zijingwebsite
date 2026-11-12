import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TABLE activity_seat_additions (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      seating_id integer NOT NULL,
      request_id integer NOT NULL,
      seat text NOT NULL,
      added_by integer REFERENCES users(id) ON DELETE SET NULL,
      added_at timestamptz NOT NULL DEFAULT now(),
      revision integer NOT NULL,
      FOREIGN KEY (seating_id, request_id) REFERENCES activity_seat_requests(seating_id, id) ON DELETE CASCADE
    );
    CREATE INDEX activity_seat_additions_request_idx ON activity_seat_additions (seating_id, request_id, id);
  `);
}

export async function down() {
  throw new Error("Roll back the application and retain seat addition history.");
}
