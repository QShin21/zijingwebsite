import "dotenv/config";
import pg from "pg";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { getPayload } from "payload";
import type { MigrateUpArgs, MigrateDownArgs } from "@payloadcms/db-postgres";
import { migrations } from "../src/migrations";
import {
  profileFixture,
  saveLoadedProfile as saveTeamProfile,
} from "../tests/team-profiles-fixture";
import { emptyTeamProfile } from "../src/lib/team-profiles-model";

if (process.env.APP_ENV !== "development" || process.env.DB_PUSH !== "false")
  throw new Error(
    "Synthetic migration check requires development and DB_PUSH=false",
  );
const source = new URL(process.env.DATABASE_URL!);
if (!["127.0.0.1", "localhost"].includes(source.hostname))
  throw new Error("Loopback database only");
const suffix = randomBytes(6).toString("hex"),
  database = `team_profiles_migration_${suffix}`;
const adminURL = new URL(source);
adminURL.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminURL.toString() });
await admin.connect();
await admin.query(`CREATE DATABASE "${database}"`);
await admin.end();
source.pathname = `/${database}`;
process.env.DATABASE_URL = source.toString();
// Load config only after selecting the new empty database; never migrate the source.
const { default: config } = await import("../src/payload.config");
const p = await getPayload({ config });
const db = new pg.Client({ connectionString: source.toString() });
await db.connect();
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
// Payload's generic Migration accepts unknown; this project uses PostgreSQL.
const runnable = (items: typeof migrations) =>
  items.map((item) => ({
    name: item.name,
    up: (args: unknown) => item.up(args as MigrateUpArgs),
    down: (args: unknown) => item.down(args as MigrateDownArgs),
  }));
async function census(columns?: Record<string, string[]>) {
  if (!columns) {
    columns = {};
    const result = await db.query(
      "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    );
    for (const row of result.rows)
      (columns[row.table_name] ??= []).push(row.column_name);
  }
  const records: Record<string, { rows: number; hash: string }> = {};
  for (const [table, fields] of Object.entries(columns)) {
    const data = await db.query(
      `SELECT ${fields.map(quote).join(",")} FROM ${quote(table)}`,
    );
    const values = data.rows.map((row) => JSON.stringify(row)).sort();
    records[table] = {
      rows: values.length,
      hash: createHash("sha256").update(JSON.stringify(values)).digest("hex"),
    };
  }
  return { columns, records };
}
function preserved(
  before: Awaited<ReturnType<typeof census>>,
  after: Awaited<ReturnType<typeof census>>,
) {
  const changed = Object.keys(before.records).filter(
    (table) =>
      JSON.stringify(before.records[table]) !==
      JSON.stringify(after.records[table]),
  );
  if (changed.some((table) => table !== "payload_migrations"))
    throw new Error(`Original data changed in ${changed.join(",")}`);
  return Object.keys(before.records).length - 1;
}
try {
  const core = migrations.find(
    (value) => value.name === "20261012_160000_team_core",
  )!;
  const profile = migrations.find(
    (value) => value.name === "20261012_170000_team_member_profiles",
  )!;
  await p.db.migrate({
    migrations: runnable(
      migrations.filter((value) => value !== core && value !== profile),
    ),
  });
  const sentinel = (
    await db.query(
      "INSERT INTO users(name,name_key,email,account_status) VALUES($1,$1,$2,'active') RETURNING id",
      [`migration-sentinel-${suffix}`, `sentinel-${suffix}@example.invalid`],
    )
  ).rows[0].id;
  const game = (
    await db.query(
      "INSERT INTO games(title,slug,_status,demo) VALUES('合成迁移保留游戏',$1,'published',true) RETURNING id",
      [`migration-game-${suffix}`],
    )
  ).rows[0].id;
  const team = (
    await db.query(
      "INSERT INTO teams(title,slug,game_id,_status,demo) VALUES('合成旧代表队保留资料',$1,$2,'published',true) RETURNING id",
      [`migration-team-${suffix}`, game],
    )
  ).rows[0].id;
  const baseline = await census();
  await p.db.migrate({ migrations: runnable([core]) });
  const coreOriginalColumnTables = preserved(
    baseline,
    await census(baseline.columns),
  );
  if (
    (await db.query("SELECT count(*)::int n FROM team_memberships")).rows[0]
      .n !== 0
  )
    throw new Error("Migration invented memberships from legacy records");
  if (
    (await db.query("SELECT team_status FROM teams WHERE id=$1", [team]))
      .rows[0].team_status !== "unestablished"
  )
    throw new Error("Legacy team acquired establishment status");
  // Seed core preservation records with SQL before the profile lock relation
  // exists. Payload document updates use every registered lock relation, so
  // application services are exercised only after all migrations have finished.
  const established = (
    await db.query(
      "INSERT INTO team_establishment_applications(title,game_id,applicant_id,reason,request_key,status) VALUES('合成保留批准',$1,$2,'仅迁移保留夹具',$3,'approved') RETURNING id",
      [game, sentinel, `migration-establishment-${suffix}`],
    )
  ).rows[0].id;
  const qualifiedTeam = (
    await db.query(
      "INSERT INTO teams(title,slug,game_id,_status,demo,team_status,establishment_application_id) VALUES('合成保留已成立队',$1,$2,'published',true,'active',$3) RETURNING id",
      [`migration-established-${suffix}`, game, established],
    )
  ).rows[0].id;
  await db.query(
    "UPDATE team_establishment_applications SET team_id=$1 WHERE id=$2",
    [qualifiedTeam, established],
  );
  const recruitment = (
    await db.query(
      "INSERT INTO team_recruitments(title,team_id,game_id,status,signup_form,created_by_id) VALUES('合成保留招新',$1,$2,'closed','{}',$3) RETURNING id",
      [qualifiedTeam, game, sentinel],
    )
  ).rows[0].id;
  const joined = (
    await db.query(
      "INSERT INTO team_join_applications(title,team_id,game_id,recruitment_id,applicant_id,request_key,status,form_version,form_snapshot,answers) VALUES('合成保留入队关系',$1,$2,$3,$4,$5,'approved','synthetic-v1','{}','{}') RETURNING id",
      [qualifiedTeam, game, recruitment, sentinel, `migration-join-${suffix}`],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO team_memberships(title,team_id,game_id,member_id,membership_key,status,joined_at,source_application_id,granted_by_id) VALUES('合成保留成员',$1,$2,$3,$4,'active',now(),$5,$3)",
    [qualifiedTeam, game, sentinel, `${qualifiedTeam}:${sentinel}`, joined],
  );
  const beforeProfile = await census();
  await p.db.migrate({ migrations: runnable([profile]) });
  const profileOriginalColumnTables = preserved(
    beforeProfile,
    await census(beforeProfile.columns),
  );
  const unique = await db.query(
    "SELECT indisunique FROM pg_index JOIN pg_class ON pg_class.oid=indexrelid WHERE relname='team_member_profiles_membership_idx'",
  );
  if (unique.rows[0]?.indisunique !== true)
    throw new Error("Membership/profile uniqueness missing");
  const f = await profileFixture(p);
  const draft = {
    ...emptyTeamProfile(),
    displayName: "合成迁移后简介",
    visible: true,
  };
  const first = await saveTeamProfile(p, f.member, f.first.id, null, draft);
  const retry = await saveTeamProfile(p, f.member, f.first.id, null, draft);
  if (
    first.revision !== 1 ||
    retry.revision !== 1 ||
    (await db.query("SELECT count(*)::int n FROM team_member_profiles")).rows[0]
      .n !== 1
  )
    throw new Error(
      "Migrated real authority/profile write or idempotency failed",
    );
  const final = await census();
  const evidence = {
    at: new Date().toISOString(),
    profileCodeSHA: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    environment: "new empty synthetic loopback database, DB_PUSH=false",
    database,
    baselineTables: Object.keys(baseline.records).length,
    beforeProfileTables: Object.keys(beforeProfile.records).length,
    finalTables: Object.keys(final.records).length,
    coreOriginalColumnTablesPreserved: coreOriginalColumnTables,
    profileOriginalColumnTablesPreserved: profileOriginalColumnTables,
    onlyExpectedChangedTable: "payload_migrations",
    legacyTeamRemainsUnestablished: true,
    noInventedMemberships: true,
    coreRecordPreserved: true,
    uniqueMembershipProfileIndex: true,
    migratedRealAuthorityWriteAndRetry: true,
    sourceDatabaseMigrated: false,
    productionAccess: false,
  };
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    process.env.TEAM_PROFILES_MIGRATION_EVIDENCE || "docs/evidence/team-profiles-migration-20261012.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await f.cleanup();
  console.log(JSON.stringify({ result: "PASS", ...evidence }));
} finally {
  await db.end();
  await p.destroy();
}
// Payload CLI initialization can retain handles after its pools are closed.
process.exit(0);
