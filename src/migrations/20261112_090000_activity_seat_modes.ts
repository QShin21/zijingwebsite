import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE activity_seatings ADD COLUMN mode text NOT NULL DEFAULT 'selection'
      CHECK (mode IN ('selection', 'random'));
    ALTER TABLE activity_seat_requests ADD COLUMN allocation_mode text NOT NULL DEFAULT 'selection'
      CHECK (allocation_mode IN ('selection', 'random'));
    ALTER TABLE activity_seat_requests ADD COLUMN requested_count integer;
    UPDATE activity_seat_requests SET requested_count = cardinality(seats);
    ALTER TABLE activity_seat_requests ALTER COLUMN requested_count SET NOT NULL;
    ALTER TABLE activity_seat_requests ADD CONSTRAINT activity_seat_requests_count_check CHECK (requested_count BETWEEN 1 AND 10);
    ALTER TABLE activity_seat_requests DROP CONSTRAINT activity_seat_requests_seats_check;
    ALTER TABLE activity_seat_requests ADD CONSTRAINT activity_seat_requests_allocation_check CHECK (
      (allocation_mode = 'selection' AND cardinality(seats) = requested_count)
      OR (allocation_mode = 'random' AND (
        (status IN ('pending', 'rejected') AND cardinality(seats) = 0)
        OR cardinality(seats) = requested_count
      ))
    );
    CREATE FUNCTION activity_seat_sync_count() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.allocation_mode = 'selection' OR cardinality(NEW.seats) > 0 THEN
        NEW.requested_count := cardinality(NEW.seats);
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER activity_seat_sync_count_trigger BEFORE INSERT OR UPDATE ON activity_seat_requests
      FOR EACH ROW EXECUTE FUNCTION activity_seat_sync_count();
  `);
}

export async function down() {
  throw new Error("Roll back the application and retain seating modes and random applications.");
}
