import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { assertHonorForeignKeys, type CatalogForeignKey } from "./team-schema-constraints";
const url = new URL(process.env.DATABASE_URL!);
if (
  process.env.APP_ENV !== "development" ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  process.env.DB_PUSH !== "false" ||
  process.env.PAYLOAD_DROP_DATABASE === "true"
)
  throw new Error(
    "Only isolated loopback schema reads with DB_PUSH=false are allowed",
  );
const target =
  process.argv[2] || "src/migrations/20261012_160000_team_core.json";
const generated = spawnSync(
  process.execPath,
  [
    path.resolve("node_modules/tsx/dist/cli.mjs"),
    "scripts/club-operations-schema.ts",
    target,
  ],
  {
    env: process.env,
    encoding: "utf8",
    timeout: 50000,
  },
);
if (generated.status !== 0)
  throw new Error(
    generated.error?.message || "Base schema snapshot generation failed",
  );
const snapshot = JSON.parse(await fs.readFile(target, "utf8"));
url.searchParams.set("options", "-c default_transaction_read_only=on");
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  if (
    (await client.query("SHOW transaction_read_only")).rows[0]
      .transaction_read_only !== "on"
  )
    throw new Error("Read-only schema connection required");
  // Reconcile reviewed SQL constraints, including NO ACTION evidence retention and partial uniqueness.
  const owned = [
    "team_establishment_applications",
    "team_recruitments",
    "team_join_applications",
    "team_memberships",
    "teams",
    "_teams_v",
    "payload_locked_documents_rels",
    ...(snapshot.tables["public.team_member_profiles"] ? ["team_member_profiles"] : []),
    ...(snapshot.tables["public.staff_batches"] ? ["staff_batches"] : []),
    ...(snapshot.tables["public.staff_applications"] ? ["staff_applications"] : []),
    ...(snapshot.tables["public.team_honor_records"] ? ["team_honor_records"] : []),
  ];
  for (const table of owned) {
    const definition = snapshot.tables[`public.${table}`];
    if (!definition)
      throw new Error(
        "Run reviewed migrations before generating the team snapshot",
      );
    const foreignKeys = (
      await client.query<CatalogForeignKey>(
        `SELECT c.conname name, src.relname table_from, dest.relname table_to, c.confdeltype delete_action, c.confupdtype update_action,
      ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY ord) columns_from,
      ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.n ORDER BY ord) columns_to
      FROM pg_constraint c JOIN pg_class src ON src.oid=c.conrelid JOIN pg_class dest ON dest.oid=c.confrelid JOIN pg_namespace ns ON ns.oid=src.relnamespace
      WHERE c.contype='f' AND ns.nspname='public' AND src.relname=$1`,
        [table],
      )
    ).rows;
    if (table === "team_honor_records") assertHonorForeignKeys(foreignKeys);
    const actions: Record<string, string> = {
      a: "no action",
      r: "restrict",
      c: "cascade",
      n: "set null",
      d: "set default",
    };
    definition.foreignKeys = Object.fromEntries(
      foreignKeys.map((fk) => [
        fk.name,
        {
          name: fk.name,
          tableFrom: fk.table_from,
          tableTo: fk.table_to,
          columnsFrom: fk.columns_from,
          columnsTo: fk.columns_to,
          onDelete: actions[fk.delete_action],
          onUpdate: actions[fk.update_action],
        },
      ]),
    );
    const indexes = (
      await client.query(
        `SELECT idx.relname name,i.indisunique is_unique,am.amname method,pg_get_expr(i.indpred,i.indrelid) predicate,
      ARRAY(SELECT pg_get_indexdef(i.indexrelid,n,true) FROM generate_series(1,i.indnkeyatts) n ORDER BY n) columns
      FROM pg_index i JOIN pg_class src ON src.oid=i.indrelid JOIN pg_class idx ON idx.oid=i.indexrelid
      JOIN pg_am am ON am.oid=idx.relam JOIN pg_namespace ns ON ns.oid=src.relnamespace
      WHERE ns.nspname='public' AND src.relname=$1 AND NOT i.indisprimary`,
        [table],
      )
    ).rows;
    definition.indexes = Object.fromEntries(
      indexes.map((index) => [
        index.name,
        {
          name: index.name,
          isUnique: index.is_unique,
          method: index.method,
          concurrently: false,
          with: {},
          columns: index.columns.map((column: string) => ({
            expression: column.replaceAll('"', ""),
            isExpression: false,
            asc: true,
            nulls: "last",
          })),
          ...(index.predicate ? { where: index.predicate } : {}),
        },
      ]),
    );
  }
  await fs.writeFile(target, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(
    JSON.stringify({
      readOnly: true,
      target,
      tables: Object.keys(snapshot.tables).length,
      reconciledConstraintTables: owned.length,
      noDDL: true,
    }),
  );
} finally {
  await client.end();
}
