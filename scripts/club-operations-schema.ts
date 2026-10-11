import "dotenv/config";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { getPayload } from "payload";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
import config from "../src/payload.config";

// Snapshot generation only. No schema SQL is executed. Run against the isolated baseline.
if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Isolated development database required");
const p = await getPayload({ config });
try {
  const db = p.db as unknown as PostgresAdapter;
  const require = createRequire(import.meta.url);
  const adapterRequire = createRequire(require.resolve("@payloadcms/db-postgres"));
  const drizzleRequire = createRequire(adapterRequire.resolve("@payloadcms/drizzle/postgres"));
  const kit = await import(pathToFileURL(drizzleRequire.resolve("drizzle-kit/api")).href);
  const old = JSON.parse(await fs.readFile("src/migrations/20260927_182940_community_showcase.json", "utf8"));
  const snapshot = kit.generateDrizzleJson(db.schema, old.id);
  // Retired collections and fields remain owned by the historical schema, never DROP them.
  for (const [name, table] of Object.entries(old.tables)) {
    if (!snapshot.tables[name]) snapshot.tables[name] = table;
    else for (const key of ["columns", "indexes", "foreignKeys", "compositePrimaryKeys", "uniqueConstraints", "checkConstraints"]) snapshot.tables[name][key] = { ...old.tables[name][key], ...snapshot.tables[name][key] };
  }
  for (const [name, enumeration] of Object.entries(old.enums)) if (!snapshot.enums[name]) snapshot.enums[name] = enumeration;
  // Recover columns added by hand-written migrations, including auth tables and chat images.
  const columns = await db.pool.query<{ table_name: string; column_name: string; type: string; not_null: boolean; default_value: string | null; primary_key: boolean }>(`
    SELECT c.relname table_name, a.attname column_name, format_type(a.atttypid,a.atttypmod) type,
      a.attnotnull not_null, pg_get_expr(d.adbin,d.adrelid) default_value,
      EXISTS(SELECT 1 FROM pg_constraint con WHERE con.conrelid=c.oid AND con.contype='p' AND a.attnum=ANY(con.conkey)) primary_key
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`);
  for (const row of columns.rows) {
    const name = `public.${row.table_name}`;
    snapshot.tables[name] ??= { name: row.table_name, schema: "", columns: {}, indexes: {}, foreignKeys: {}, compositePrimaryKeys: {}, uniqueConstraints: {}, policies: {}, checkConstraints: {}, isRLSEnabled: false };
    if (!snapshot.tables[name].columns[row.column_name]) {
      const serial = row.default_value?.startsWith("nextval(");
      snapshot.tables[name].columns[row.column_name] = { name: row.column_name, type: serial ? "serial" : row.type, primaryKey: row.primary_key, notNull: row.not_null,
        ...(!serial && row.default_value ? { default: row.default_value } : {}) };
    }
  }
  // These two authentication tables are deliberately outside Payload collections.
  snapshot.tables["public.auth_codes"].indexes.auth_codes_expires_at_idx = { name: "auth_codes_expires_at_idx", columns: [{ expression: "expires_at", isExpression: false, asc: true, nulls: "last" }], isUnique: false, concurrently: false, method: "btree", with: {} };
  const enums = await db.pool.query<{ type_name: string; label: string }>("SELECT t.typname type_name,e.enumlabel label FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder");
  for (const type of new Set(enums.rows.map(row => row.type_name))) {
    const name = `public.${type}`, existing = enums.rows.filter(row => row.type_name === type).map(row => row.label);
    if (snapshot.enums[name]) snapshot.enums[name].values = [...existing, ...snapshot.enums[name].values.filter((value: string) => !existing.includes(value))];
  }
  // Required join relations preserve evidence by refusing deletion of referenced users/games.
  for (const fk of Object.values(snapshot.tables["public.community_joins"].foreignKeys)) {
    const key = fk as { columnsFrom: string[]; onDelete: string };
    if (["member_id", "game_id"].includes(key.columnsFrom[0])) key.onDelete = "no action";
  }
  await fs.writeFile("src/migrations/20261011_180000_club_operations.json", JSON.stringify(snapshot, null, 2) + "\n");
  console.log(JSON.stringify({ tables: Object.keys(snapshot.tables).length, baselineTables: new Set(columns.rows.map(row => row.table_name)).size, newTables: Object.values(snapshot.tables).map(table => (table as { name: string }).name).filter(name => !columns.rows.some(row => row.table_name === name)) }));
} finally { await (p.db as unknown as PostgresAdapter).pool.end(); await p.destroy(); }
