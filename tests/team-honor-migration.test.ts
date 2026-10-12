import "dotenv/config";
import { randomBytes } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { getPayload, type Payload, createLocalReq } from "payload";
import { postgresAdapter, type PostgresAdapter } from "@payloadcms/db-postgres";
import { afterAll, beforeAll, expect, it } from "vitest";
import originalConfig from "../src/payload.config";
import { migrations } from "../src/migrations";
import { down } from "../src/migrations/20261012_080000_team_honor_records";

let p: Payload, admin: pg.Client, connection: pg.Client;
const suffix = randomBytes(8).toString("hex"),
  name = "team_honors_migrate_" + suffix + "_synthetic";
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    process.env.APP_ENV !== "development" ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error("Synthetic loopback only");
  const administrative = new URL(url);
  administrative.pathname = "/postgres";
  admin = new pg.Client({ connectionString: administrative.href });
  await admin.connect();
  await admin.query('CREATE DATABASE "' + name + '"');
  const isolated = new URL(url);
  isolated.pathname = "/" + name;
  const base = await originalConfig;
  const factory = postgresAdapter({
    pool: { connectionString: isolated.href },
    push: false,
    disableCreateDatabase: true,
    migrationDir: path.resolve("src/migrations"),
  });
  p = await getPayload({
    config: {
      ...base,
      db: {
        ...base.db,
        init: factory.init,
      },
    },
    key: "honor-migration-" + suffix,
    disableOnInit: true,
    disableDBConnect: true,
  });
  // Set the isolated pool after Payload finishes adapter initialization. Its
  // ordinary first connection retains a bootstrap lease, which must not outlive
  // a database that this test creates and drops.
  const adapter = p.db as unknown as PostgresAdapter;
  adapter.pool = new adapter.pg.Pool(adapter.poolOptions);
  if (!adapter.connect) throw new Error("Synthetic PostgreSQL connection required");
  await adapter.connect();
  connection = new pg.Client({ connectionString: isolated.href });
  await connection.connect();
});
afterAll(async () => {
  if (connection) await connection.end();
  if (p) {
    // Payload's destroy clears schema but does not end pg pools. Close only this test DB's clients.
    const adapter = p.db as unknown as PostgresAdapter;
    for (const id of Object.keys(adapter.sessions))
      await adapter.rollbackTransaction(id);
    await adapter.pool.end();
    await p.destroy();
  }
  if (admin) {
    await admin.query('DROP DATABASE IF EXISTS "' + name + '"');
    await admin.end();
  }
});
it("从干净数据库顺序迁移，旧已批准荣誉/作者/赛季原样保留，新荣誉关联受删除保护且禁止丢数据 down", async () => {
  const honorMigration = migrations.find(
    (item) => item.name === "20261012_080000_team_honor_records",
  )!;
  const typedMigrations = (items: typeof migrations) =>
    items.map((item) => ({
      name: item.name,
      up: (args: unknown) => item.up(args as Parameters<typeof item.up>[0]),
      down: (args: unknown) =>
        item.down(args as Parameters<typeof item.down>[0]),
    }));
  await p.db.migrate({
    migrations: typedMigrations(
      migrations.filter((item) => item !== honorMigration),
    ),
  });
  const leader = await p.create({
    collection: "users",
    overrideAccess: true,
    context: { system: true },
    data: {
      name: "honor-migration-" + suffix,
      email: suffix + "@example.invalid",
      password: randomBytes(24).toString("hex"),
      roles: ["president"],
    },
  });
  const game = await p.create({
    collection: "games",
    overrideAccess: true,
    context: { system: true },
    data: {
      title: "合成迁移社群",
      slug: "honor-migration-game-" + suffix,
      _status: "published",
    },
  });
  const team = await p.create({
    collection: "teams",
    overrideAccess: true,
    context: { system: true },
    data: {
      title: "合成迁移队伍",
      slug: "honor-migration-team-" + suffix,
      game: game.id,
      _status: "published",
    },
  });
  const season = await p.create({
    collection: "seasons",
    overrideAccess: true,
    context: { system: true },
    data: {
      title: "合成旧赛季",
      slug: "honor-migration-season-" + suffix,
      team: team.id,
      season: "合成赛季",
      _status: "published",
    },
  });
  const honor = await p.create({
    collection: "honors",
    overrideAccess: true,
    context: { system: true },
    data: {
      title: "合成旧批准荣誉",
      slug: "honor-migration-legacy-" + suffix,
      team: team.id,
      season: season.id,
      game: game.id,
      submittedBy: leader.id,
      competition: "合成旧比赛",
      placing: "合成旧奖项",
      verified: true,
      sourceURL: "https://example.invalid/honor-proof",
      _status: "published",
    },
  });
  const before = (
    await connection.query(
      "SELECT to_jsonb(h) AS data FROM honors h WHERE id=$1",
      [honor.id],
    )
  ).rows[0].data;
  const tablesBefore = (
    await connection.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows.map((row) => row.tablename);
  await p.db.migrate({ migrations: typedMigrations([honorMigration]) });
  const after = (
    await connection.query(
      "SELECT to_jsonb(h) AS data FROM honors h WHERE id=$1",
      [honor.id],
    )
  ).rows[0].data;
  expect(after).toEqual(before);
  expect(after.submitted_by_id).toBe(leader.id);
  expect(after.season_id).toBe(season.id);
  const tablesAfter = (
    await connection.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows.map((row) => row.tablename);
  expect(tablesAfter.filter((table) => !tablesBefore.includes(table))).toEqual([
    "team_honor_records",
  ]);
  expect(tablesBefore.every((table) => tablesAfter.includes(table))).toBe(true);
  const keys = (
    await connection.query(
      "SELECT confdeltype FROM pg_constraint WHERE conrelid='team_honor_records'::regclass AND contype='f'",
    )
  ).rows;
  expect(keys.filter((row) => row.confdeltype === "r")).toHaveLength(4);
  const db = p.db as typeof p.db & {
    drizzle: Parameters<typeof down>[0]["db"];
  };
  await expect(
    down({ db: db.drizzle, payload: p, req: await createLocalReq({}, p) }),
  ).rejects.toThrow("Preserve");
  expect(
    (
      await connection.query(
        "SELECT COUNT(*) AS count FROM honors WHERE id=$1",
        [honor.id],
      )
    ).rows[0].count,
  ).toBe("1");
}, 60000);
