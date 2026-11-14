import assert from "node:assert/strict";
import { getPayload } from "payload";
import { sql } from "@payloadcms/db-postgres";
import config from "../src/payload.config";

// Synthetic-only upgrade check for the bilingual migration. Started by
// scripts/verify-bilingual-database.mjs against a throwaway embedded PostgreSQL.
const url = new URL(process.env.DATABASE_URL!);
if (process.env.BILINGUAL_TEST !== "isolated" || url.hostname !== "127.0.0.1" || !url.pathname.startsWith("/bilingual_"))
  throw new Error("Synthetic bilingual database only");
const p = await getPayload({ config });
await p.db.migrate();
// Simulate a database from before this feature: remove the new migration, keep everything else.
await p.db.drizzle.execute(sql`DELETE FROM payload_migrations WHERE name IN ('20261113_000900_content_translations', '20261114_001000_content_translation_sources', '20261114_001100_content_translation_more_sources')`);
await p.db.drizzle.execute(sql`DROP TABLE content_translations`);
const event = await p.create({ collection: "events", overrideAccess: true, context: { system: true, manageSignupForm: true },
  data: { title: "合成旧活动", slug: "bilingual-legacy-event", _status: "published", audience: "campus",
    signupForm: { enabled: true, questions: [{ id: "q", label: "合成旧题", type: "single", required: true, options: ["甲", "乙"] }] } } as never });
const census = async () => ({
  events: (await p.db.drizzle.execute(sql`SELECT id, title, audience, signup_form FROM events ORDER BY id`)).rows,
  versions: (await p.db.drizzle.execute(sql`SELECT count(*)::int AS n FROM _events_v`)).rows,
  migrations: (await p.db.drizzle.execute(sql`SELECT name FROM payload_migrations WHERE name NOT IN ('20261113_000900_content_translations', '20261114_001000_content_translation_sources', '20261114_001100_content_translation_more_sources') ORDER BY id`)).rows,
});
const before = await census();
await p.db.migrate();
assert.deepEqual(await census(), before, "existing data and migrations preserved");
const applied = await p.db.drizzle.execute(sql`SELECT name FROM payload_migrations WHERE name = '20261113_000900_content_translations'`);
assert.equal(applied.rows.length, 1);
const sources = await p.db.drizzle.execute(sql`SELECT name FROM payload_migrations WHERE name = '20261114_001000_content_translation_sources'`);
assert.equal(sources.rows.length, 1, "source widening migration applied after the table");
assert.equal((await p.db.drizzle.execute(sql`SELECT count(*)::int AS n FROM content_translations`)).rows[0].n, 0, "upgrade creates no translation work");
const legacy = await p.findByID({ collection: "events", id: event.id, overrideAccess: true, depth: 0 });
assert.equal(legacy.title, "合成旧活动");
const { GET } = await import("../src/app/health/ready/route");
assert.equal((await GET()).status, 200, "readiness check passes after upgrade");
console.log(JSON.stringify({ upgrade: "PASS", preservedEvents: before.events.length, migrations: before.migrations.length + 3 }));
process.exit(0);
