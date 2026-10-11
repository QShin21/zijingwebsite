import "dotenv/config";
import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

if (process.env.APP_ENV !== "development") throw new Error("Development only");
const source = new URL(process.env.DATABASE_URL!);
if (!["127.0.0.1", "localhost"].includes(source.hostname)) throw new Error("Isolated loopback database required");
const pgBin = process.env.PG_BIN;
if (!pgBin) throw new Error("Set PG_BIN to PostgreSQL 17+ client binaries; embedded-postgres only bundles server tools");
const db = new pg.Client({ connectionString: source.toString() });
await db.connect();
const suffix = randomBytes(8).toString("hex");
let user: number | undefined, ordinary: number | undefined, game: number | undefined;
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
try {
  const count = await db.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'");
  if (count.rows[0].n !== 58) throw new Error("Run drill on the historical 58-table migrated baseline, before new migration");
  user = (await db.query("INSERT INTO users(name,name_key,email) VALUES($1,$1,$2) RETURNING id", [`migration-${suffix}`, `migration-${suffix}@example.invalid`])).rows[0].id;
  await db.query("INSERT INTO users_roles(\"order\",parent_id,value) VALUES(1,$1,'communityAdmin')", [user]);
  game = (await db.query("INSERT INTO games(title,slug,_status) VALUES($1,$2,'published') RETURNING id", ["合成迁移验证社群", `migration-${suffix}`])).rows[0].id;
  await db.query("INSERT INTO users_rels(\"order\",parent_id,path,games_id) VALUES(1,$1,'communities',$2)", [user, game]);
  ordinary = (await db.query("INSERT INTO users(name,name_key,email) VALUES($1,$1,$2) RETURNING id", [`ordinary-${suffix}`, `ordinary-${suffix}@example.invalid`])).rows[0].id;
  await db.query("INSERT INTO users_roles(\"order\",parent_id,value) VALUES(1,$1,'member')", [ordinary]);
  await db.query("INSERT INTO users_rels(\"order\",parent_id,path,games_id) VALUES(1,$1,'communities',$2)", [ordinary, game]);
  await db.query("INSERT INTO community_applications(applicant_id,game_id,proposed_game,reason,real_name,phone,wechat_qr,status) VALUES($1,$2,'合成迁移验证社群','隔离迁移夹具，禁止生产导入','合成姓名','13900000000','fixture-private-card','approved')", [user, game]);
  const schema = await db.query<{ table_name: string; column_name: string }>("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position");
  const tables = new Map<string, string[]>();
  for (const row of schema.rows) tables.set(row.table_name, [...(tables.get(row.table_name) ?? []), row.column_name]);
  async function census(client: pg.Client) {
    const result: Record<string, { count: number; hash: string }> = {};
    for (const [table, columns] of tables) {
      const records = await client.query(`SELECT row_to_json(t)::text row FROM (SELECT ${columns.map(quote).join(",")} FROM ${quote(table)}) t ORDER BY row_to_json(t)::text`);
      result[table] = { count: records.rows.length, hash: createHash("sha256").update(records.rows.map(row => row.row).join("\n")).digest("hex") };
    }
    return result;
  }
  const before = await census(db);
  const localDir = path.resolve(process.env.MEDIA_DIR || "media", ".showcase-videos"), objectDir = path.resolve(".data", `object-fixture-${suffix}`);
  await fs.mkdir(localDir, { recursive: true }); await fs.mkdir(objectDir, { recursive: true });
  const video = path.join(localDir, `migration-${suffix}.mp4`);
  await fs.writeFile(video, randomBytes(64)); await fs.writeFile(path.join(objectDir, "object-fixture.bin"), randomBytes(32));
  const env = { ...process.env, PG_BIN: pgBin, S3_BUCKET: "isolated-backup-fixture", MEDIA_BACKUP_SOURCE: objectDir,
    BACKUP_DEST: path.resolve(".data", "club-backups"), RESTORE_EVIDENCE_PATH: "docs/evidence/club-operations-restore.json" };
  const backup = JSON.parse(execFileSync(process.execPath, ["scripts/backup.mjs", "create"], { env, encoding: "utf8" }));
  const restored = JSON.parse(execFileSync(process.execPath, ["scripts/backup.mjs", "verify", backup.backup], { env, encoding: "utf8" }));
  const target = new URL(source); target.pathname = `/${restored.database}`;
  const clone = new pg.Client({ connectionString: target.toString() }); await clone.connect();
  try {
    if (JSON.stringify(await census(clone)) !== JSON.stringify(before)) throw new Error("Restore census mismatch");
    execFileSync("pnpm", ["migrate"], { env: { ...process.env, DATABASE_URL: target.toString(), DB_PUSH: "false" }, stdio: ["ignore", "pipe", "pipe"] });
    const after = await census(clone);
    const changed = Object.keys(before).filter(table => JSON.stringify(before[table]) !== JSON.stringify(after[table]));
    if (changed.some(table => table !== "payload_migrations")) throw new Error(`Historical data changed: ${changed.join(",")}`);
    const offices = await clone.query("SELECT game_id,publish_content,review_showcase,handle_joins,view_signups,export_signups,contact_consent FROM users_community_offices WHERE _parent_id=$1", [user]);
    if (offices.rows.length !== 1 || Number(offices.rows[0].game_id) !== game || !offices.rows[0].view_signups || !offices.rows[0].contact_consent) throw new Error("Legacy office backfill mismatch");
    const roles = await clone.query("SELECT value FROM users_roles WHERE parent_id=$1", [user]);
    if (roles.rows[0].value !== "communityAdmin") throw new Error("Platform role overwritten");
    if ((await clone.query("SELECT count(*)::int n FROM users_community_offices WHERE _parent_id=$1", [ordinary])).rows[0].n !== 0) throw new Error("Residual ordinary-user relation gained privileges");
    if ((await clone.query("SELECT count(*)::int n FROM community_joins")).rows[0].n !== 0) throw new Error("Migration invented WeChat membership");
    if (JSON.stringify(await census(db)) !== JSON.stringify(before)) throw new Error("Source database changed during drill");
    const migratedTables = (await clone.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0].n;
    await fs.writeFile("docs/evidence/club-operations-migration.json", JSON.stringify({ at: new Date().toISOString(), environment: "cloud isolated synthetic development databases", sourceTables: 58, migratedTables, historicalTablesPreserved: true, unchangedOriginalColumnTables: 57, expectedChangedTable: "payload_migrations", platformRolesPreserved: true, legacyOfficeCapabilitiesPreserved: true, ordinaryResidualRelationsDoNotGrantPrivileges: true, noInventedMembership: true, s3MirrorAndSeparateLocalVideoRestore: restored.result, mediaFiles: restored.mediaFiles, localVideoFiles: restored.localVideoFiles, sourceUnchangedAfterDrill: true, productionAccess: false }, null, 2) + "\n");
    console.log(JSON.stringify({ result: "PASS", sourceTables: 58, migratedTables, unchangedHistoricalBusinessTables: 57, localVideosRestored: restored.localVideoFiles }));
  } finally { await clone.end(); await fs.rm(video); }
} finally {
  if (user) { await db.query("DELETE FROM community_applications WHERE applicant_id=$1", [user]); await db.query("DELETE FROM users_rels WHERE parent_id=$1", [user]); await db.query("DELETE FROM users_roles WHERE parent_id=$1", [user]); }
  if (ordinary) { await db.query("DELETE FROM users_rels WHERE parent_id=$1", [ordinary]); await db.query("DELETE FROM users_roles WHERE parent_id=$1", [ordinary]); await db.query("DELETE FROM users WHERE id=$1", [ordinary]); }
  if (game) await db.query("DELETE FROM games WHERE id=$1", [game]);
  if (user) await db.query("DELETE FROM users WHERE id=$1", [user]);
  await db.end();
}
