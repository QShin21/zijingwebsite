import { type MigrateUpArgs, sql } from "@payloadcms/db-postgres";

// Independent tables keep the tool's answer keys and personal records outside
// the public CMS API. Existing application records are untouched.
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    CREATE TABLE quiz_events (
      id serial PRIMARY KEY,
      title varchar(120) NOT NULL,
      description text NOT NULL DEFAULT '',
      status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      created_by integer REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE quiz_prizes (
      id serial PRIMARY KEY,
      event_id integer NOT NULL REFERENCES quiz_events(id),
      name varchar(120) NOT NULL,
      quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 100000),
      remaining integer NOT NULL CHECK (remaining >= 0 AND remaining <= quantity),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX quiz_prizes_event_idx ON quiz_prizes(event_id, id);
    CREATE TABLE quiz_rounds (
      id serial PRIMARY KEY,
      event_id integer NOT NULL REFERENCES quiz_events(id),
      title varchar(120) NOT NULL,
      threshold integer NOT NULL CHECK (threshold > 0),
      questions jsonb NOT NULL,
      correct_answers jsonb,
      closes_at timestamptz,
      status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'settled')),
      created_at timestamptz NOT NULL DEFAULT now(),
      settled_at timestamptz
    );
    CREATE INDEX quiz_rounds_event_idx ON quiz_rounds(event_id, id);
    CREATE TABLE quiz_entries (
      id serial PRIMARY KEY,
      round_id integer NOT NULL REFERENCES quiz_rounds(id),
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      answers jsonb NOT NULL,
      prize_id integer REFERENCES quiz_prizes(id),
      score integer,
      submitted_at timestamptz NOT NULL DEFAULT now(),
      drawn_at timestamptz,
      UNIQUE (round_id, user_id),
      CHECK ((prize_id IS NULL AND drawn_at IS NULL AND score IS NULL) OR
             (prize_id IS NOT NULL AND drawn_at IS NOT NULL AND score IS NOT NULL))
    );
    CREATE INDEX quiz_entries_user_idx ON quiz_entries(user_id, round_id);
    CREATE INDEX quiz_entries_prize_idx ON quiz_entries(prize_id) WHERE prize_id IS NOT NULL;
  `);
}

export async function down() {
  throw new Error("竞猜答卷和中奖记录需要保留；回退应用时保留这些数据表。");
}
