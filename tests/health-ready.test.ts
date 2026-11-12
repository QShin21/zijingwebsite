import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cms: vi.fn(), count: vi.fn(), query: vi.fn() }));
vi.mock("../src/lib/content", () => ({ cms: mocks.cms }));
import { GET } from "../src/app/health/ready/route";

type IndexRow = {
  name: string;
  table_name: string;
  columns: string[];
  valid: boolean;
  ready: boolean;
  is_unique: boolean;
  predicate: string | null;
};
function migratedIndexes(): IndexRow[] {
  const records = [
    ["team_honor_records_team_idx", "team_id"],
    ["team_honor_records_game_idx", "game_id"],
    ["team_honor_records_author_idx", "author_id"],
    ["team_honor_records_season_idx", "season_id"],
    ["team_honor_records_state_idx", "state"],
    ["team_honor_records_reviewed_by_idx", "reviewed_by_id"],
    ["team_honor_records_updated_at_idx", "updated_at"],
    ["team_honor_records_created_at_idx", "created_at"],
  ].map(([name, column]) => ({
    name, table_name: "team_honor_records", columns: [column],
    valid: true, ready: true, is_unique: false, predicate: null,
  }));
  const seats = [
    ["activity_seatings_event_id_key", "activity_seatings", ["event_id"]],
    ["activity_seatings_post_id_key", "activity_seatings", ["post_id"]],
    ["activity_seat_claims_pkey", "activity_seat_claims", ["seating_id", "seat"]],
    ["activity_seat_blocks_pkey", "activity_seat_blocks", ["seating_id", "seat"]],
    ["activity_seat_requests_active_idx", "activity_seat_requests", ["seating_id", "member_id"]],
  ].map(([name, table_name, columns]) => ({
    name: name as string, table_name: table_name as string, columns: columns as string[],
    valid: true, ready: true, is_unique: true,
    predicate: name === "activity_seat_requests_active_idx" ? "(status <> 'rejected'::text)" : null,
  }));
  return [...records, ...seats, {
    name: "payload_locked_documents_rels_team_honor_records_id_idx",
    table_name: "payload_locked_documents_rels", columns: ["team_honor_records_id"],
    valid: true, ready: true, is_unique: false, predicate: null,
  }];
}
let catalog: IndexRow[];
let honorMigrationRows: number;
let seatingMigrationRows: number;
let unavailableProbe: string;
beforeEach(() => {
  vi.resetAllMocks();
  catalog = migratedIndexes();
  honorMigrationRows = 1; seatingMigrationRows = 1;
  unavailableProbe = "";
  mocks.count.mockResolvedValue({ totalDocs: 0 });
  mocks.cms.mockResolvedValue({ count: mocks.count, db: { pool: { query: mocks.query } } });
  mocks.query.mockImplementation(async (statement: string, parameters?: unknown[]) => {
    if (unavailableProbe && statement.includes(unavailableProbe)) throw new Error("private-schema-detail");
    if (statement.includes("FROM pg_index")) return { rows: catalog, rowCount: catalog.length };
    if (statement.includes("FROM payload_migrations")) {
      if (Array.isArray(parameters?.[0])) return { rows: parameters[0].map(name => ({ name })), rowCount: parameters[0].length };
      const rowCount = parameters?.[0] === "20261012_080000_team_honor_records" ? honorMigrationRows : parameters?.[0] === "20261112_000000_activity_seating" ? seatingMigrationRows : 1;
      return { rows: rowCount ? [{ name: parameters?.[0] }] : [], rowCount };
    }
    return { rows: [], rowCount: 0 };
  });
});

it("a migrated joint schema is ready using anonymous and zero-row data probes", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ready", schema: "club-operations-1" });
  expect(mocks.count).toHaveBeenCalledWith({ collection: "events", overrideAccess: false, user: null });
  expect(mocks.query).toHaveBeenCalledWith("SELECT 1 FROM payload_migrations WHERE name=$1", ["20261012_080000_team_honor_records"]);
  const probes = mocks.query.mock.calls.filter(([statement]) => /FROM (team_honor_records|payload_locked_documents_rels)\b/.test(statement));
  expect(probes).toHaveLength(2);
  for (const [statement] of probes) expect(statement).toMatch(/LIMIT 0$/);
});

it.each([0, 2])("honor migration presence must be exactly once: %s", async rows => {
  honorMigrationRows = rows;
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
});

it.each(["FROM team_honor_records", "FROM payload_locked_documents_rels"])(
  "missing honor structure fails readiness without exposing database details: %s", async probe => {
    unavailableProbe = probe;
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-schema-detail");
  },
);

it("a missing honor lookup index fails readiness", async () => {
  catalog = catalog.filter(index => index.name !== "team_honor_records_state_idx");
  expect((await GET()).status).toBe(503);
});

it("a missing honor lock-relation index fails readiness", async () => {
  catalog = catalog.filter(index => index.table_name !== "payload_locked_documents_rels");
  expect((await GET()).status).toBe(503);
});

it("unparsed PostgreSQL name[] index columns fail readiness", async () => {
  const stateIndex = catalog.find(index => index.name === "team_honor_records_state_idx")!;
  Object.assign(stateIndex, { columns: "{state}" });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
});

it.each([
  { valid: false }, { ready: false }, { is_unique: true },
  { table_name: "unrelated_table" }, { columns: ["game_id"] },
  { columns: ["state", "team_id"] }, { predicate: "state = 'approved'" },
])("an unusable or mismatched honor index fails readiness: %j", async invalid => {
  const stateIndex = catalog.find(index => index.name === "team_honor_records_state_idx")!;
  Object.assign(stateIndex, invalid);
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
});


it.each([0, 2])("seating migration must exist exactly once: %s", async count => {
  seatingMigrationRows = count;
  expect((await GET()).status).toBe(503);
});
it.each(["activity_seatings", "activity_seat_claims", "activity_seat_blocks", "activity_seat_releases", "activity_seat_additions", "activity_seat_requests", "activity_seat_proofs", "pending_uploads", "site_home_sections"])("missing seating/V2 structure is not ready: %s", async table => {
  unavailableProbe = "FROM " + table;
  expect((await GET()).status).toBe(503);
});
it.each(["activity_seatings_event_id_key", "activity_seatings_post_id_key", "activity_seat_claims_pkey", "activity_seat_blocks_pkey", "activity_seat_requests_active_idx"])("missing seating unique index is not ready: %s", async name => {
  catalog = catalog.filter(index => index.name !== name);
  expect((await GET()).status).toBe(503);
});
it.each([{ valid: false }, { ready: false }, { is_unique: false }, { columns: ["member_id"] }, { predicate: null }, { predicate: "status = 'pending'::text" }])("a weakened active-seat uniqueness index is not ready: %j", async invalid => {
  Object.assign(catalog.find(index => index.name === "activity_seat_requests_active_idx")!, invalid);
  expect((await GET()).status).toBe(503);
});
