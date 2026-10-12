import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import pg from "pg";
import { getPayload, createLocalReq } from "payload";
import { postgresAdapter, type PostgresAdapter, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";
import config from "../src/payload.config";
import { migrations } from "../src/migrations";
import * as core from "../src/migrations/20261012_160000_team_core";
const base = new URL(process.env.DATABASE_URL!);
if (
  process.env.APP_ENV !== "development" ||
  !["127.0.0.1", "localhost"].includes(base.hostname) ||
  process.env.DB_PUSH !== "false"
)
  throw new Error(
    "Explicit isolated loopback development database and DB_PUSH=false required",
  );
const database = `team_core_migration_${randomBytes(6).toString("hex")}`;
const adminURL = new URL(base);
adminURL.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminURL.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE "${database}"`);
const url = new URL(base);
url.pathname = `/${database}`;
let p: Awaited<ReturnType<typeof getPayload>> | undefined;
try {
  const resolved = await config;
  const adapter = postgresAdapter({ pool: { connectionString: url.toString() }, push: false, disableCreateDatabase: true });
  p = await getPayload({
    key: database,
    config: {
      ...resolved,
      db: { ...resolved.db, init: adapter.init },
    },
  });
  const db = p.db as unknown as PostgresAdapter;
  const list = migrations.map(migration => ({ name: migration.name, up: (args: unknown) => migration.up(args as MigrateUpArgs), down: (args: unknown) => migration.down(args as MigrateDownArgs) }));
  await db.migrate({
    migrations: list.filter(
      (m) => m.name !== "20261012_160000_team_core",
    ),
  });
  const pool = db.pool;
  const tableRows = (
    await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
    )
  ).rows;
  const legacyTables = tableRows
    .map((row) => row.table_name)
    .filter((name) => name !== "payload_migrations");
  const user = (
    await pool.query(
      "INSERT INTO users(email,name,name_key,account_status) VALUES('synthetic@example.invalid','合成历史用户','合成历史用户','active') RETURNING id",
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO users_roles(\"order\",parent_id,value) VALUES(1,$1,'member')",
    [user],
  );
  const game = (
    await pool.query(
      "INSERT INTO games(title,slug,_status) VALUES('合成历史社群','synthetic-legacy-game','published') RETURNING id",
    )
  ).rows[0].id;
  const team = (
    await pool.query(
      "INSERT INTO teams(title,slug,game_id,_status,internal_notes) VALUES('合成历史队伍','synthetic-legacy-team',$1,'published','保留合成内部文字') RETURNING id",
      [game],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO users_rels(parent_id,path,teams_id) VALUES($1,'teams',$2)",
    [user, team],
  );
  const season = (
    await pool.query(
      "INSERT INTO seasons(title,slug,team_id,season,_status) VALUES('合成历史赛季','synthetic-legacy-season',$1,'合成2025','published') RETURNING id",
      [team],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO seasons_members(_order,_parent_id,id,display_name,position,consent) VALUES(1,$1,'synthetic-roster','合成历史昵称','合成位置',true)",
    [season],
  );
  await pool.query(
    "INSERT INTO honors(title,slug,team_id,season_id,game_id,competition,\"placing\",verified,source_u_r_l,_status) VALUES('合成历史荣誉','synthetic-legacy-honor',$1,$2,$3,'合成赛事','合成名次',false,'https://example.invalid/synthetic','draft')",
    [team, season, game],
  );
  await pool.query(
    "INSERT INTO _teams_v(parent_id,version_title,version_slug,version_game_id,version__status,latest) VALUES($1,'合成历史版本','synthetic-legacy-team',$2,'published',true)",
    [team, game],
  );
  const before: Record<string, unknown[]> = {},
    columns: Record<string, string[]> = {};
  for (const table of legacyTables) {
    columns[table] = (
      await pool.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
        [table],
      )
    ).rows.map((row) => row.column_name);
    before[table] = (
      await pool.query(`SELECT * FROM "${table}" ORDER BY ctid`)
    ).rows;
  }
  await db.migrate({ migrations: list });
  const after: Record<string, unknown[]> = {};
  for (const table of legacyTables)
    after[table] = (
      await pool.query(
        `SELECT ${columns[table].map((column) => `"${column}"`).join(",")} FROM "${table}" ORDER BY ctid`,
      )
    ).rows;
  if (!isDeepStrictEqual(before, after))
    throw new Error("Legacy data changed during team migration");
  const rows = (
    await pool.query(
      "SELECT team_status,establishment_application_id FROM teams WHERE id=$1",
      [team],
    )
  ).rows[0];
  if (
    rows.team_status !== "unestablished" ||
    rows.establishment_application_id !== null
  )
    throw new Error("Legacy team implicitly became approved");
  const count = (
    await pool.query("SELECT count(*)::int n FROM team_memberships")
  ).rows[0].n;
  if (count !== 0)
    throw new Error("Legacy roles/roster implicitly became membership");
  const stable = JSON.stringify(after),
    hash = createHash("sha256").update(stable).digest("hex");
  await db.migrate({ migrations: list }); // runner records migration once; repeat must be a no-op.
  const listed = (
    await pool.query(
      "SELECT count(*)::int n FROM payload_migrations WHERE name='20261012_160000_team_core'",
    )
  ).rows[0].n;
  if (listed !== 1) throw new Error("Migration tracking is not idempotent");
  let downBlocked = false;
  try {
    await core.down({ db: db.drizzle, payload: p, req: await createLocalReq({}, p) });
  } catch {
    downBlocked = true;
  }
  if (!downBlocked)
    throw new Error("Automatic destructive down must remain blocked");
  console.log(
    JSON.stringify({
      database: "isolated-disposable",
      cleanSequentialMigrations: true,
      legacyTablesPreserved: legacyTables.length,
      legacyRowsPreserved: Object.values(before).reduce(
        (sum, rows) => sum + rows.length,
        0,
      ),
      legacyHash: hash,
      noImplicitMembership: true,
      legacyTeamUnestablished: true,
      migrationRepeatNoop: true,
      destructiveDownBlocked: true,
    }),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await p?.destroy();
  if (p) void (p.db as unknown as PostgresAdapter).pool.end();
  // This exact random database was created here and contains synthetic fixtures only.
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()",
    [database],
  );
  await admin.query(`DROP DATABASE "${database}"`);
  await admin.end();
}
process.exit(0);
