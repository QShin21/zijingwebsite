import { sql, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    CREATE TYPE enum_staff_batches_state AS ENUM ('draft','open','closed');
    CREATE TYPE enum_staff_applications_department AS ENUM ('execution','publicity','both');
    CREATE TYPE enum_staff_applications_status AS ENUM ('submitted','reviewing','returned','accepted','rejected','withdrawn');
    CREATE TABLE staff_batches (
      id serial PRIMARY KEY, title varchar NOT NULL, description varchar, state enum_staff_batches_state NOT NULL,
      start_at timestamptz(3), end_at timestamptz(3), current_key varchar, signup_form jsonb NOT NULL,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX staff_batches_current_key_idx ON staff_batches(current_key);
    CREATE INDEX staff_batches_updated_at_idx ON staff_batches(updated_at);
    CREATE INDEX staff_batches_created_at_idx ON staff_batches(created_at);
    CREATE TABLE staff_applications (
      id serial PRIMARY KEY, batch_id integer NOT NULL CONSTRAINT staff_applications_batch_id_staff_batches_id_fk REFERENCES staff_batches(id),
      applicant_id integer NOT NULL CONSTRAINT staff_applications_applicant_id_users_id_fk REFERENCES users(id),
      request_key varchar NOT NULL, member_name varchar NOT NULL, batch_title varchar NOT NULL,
      department enum_staff_applications_department NOT NULL, status enum_staff_applications_status NOT NULL,
      form_version varchar NOT NULL, questions jsonb NOT NULL, answers jsonb NOT NULL,
      feedback varchar, review_notes varchar, history jsonb,
      updated_at timestamptz(3) NOT NULL DEFAULT now(), created_at timestamptz(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX staff_applications_request_key_idx ON staff_applications(request_key);
    CREATE INDEX staff_applications_batch_idx ON staff_applications(batch_id);
    CREATE INDEX staff_applications_applicant_idx ON staff_applications(applicant_id);
    CREATE INDEX staff_applications_updated_at_idx ON staff_applications(updated_at);
    CREATE INDEX staff_applications_created_at_idx ON staff_applications(created_at);
    ALTER TABLE payload_locked_documents_rels ADD COLUMN staff_batches_id integer CONSTRAINT payload_locked_documents_rels_staff_batches_fk REFERENCES staff_batches(id) ON DELETE CASCADE,
      ADD COLUMN staff_applications_id integer CONSTRAINT payload_locked_documents_rels_staff_applications_fk REFERENCES staff_applications(id) ON DELETE CASCADE;
    CREATE INDEX payload_locked_documents_rels_staff_batches_id_idx ON payload_locked_documents_rels(staff_batches_id);
    CREATE INDEX payload_locked_documents_rels_staff_applications_id_idx ON payload_locked_documents_rels(staff_applications_id);
  `);
}
export async function down({ db }: MigrateDownArgs) { void db; throw new Error("Keep staff batches, applicant answers and decisions; use a compatible application rollback without removing data."); }
