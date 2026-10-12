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
  return [...records, {
    name: "payload_locked_documents_rels_team_honor_records_id_idx",
    table_name: "payload_locked_documents_rels", columns: ["team_honor_records_id"],
    valid: true, ready: true, is_unique: false, predicate: null,
  }];
}
let catalog: IndexRow[];
let honorMigrationRows: number;
let unavailableProbe: string;
beforeEach(() => {
  vi.resetAllMocks();
  catalog = migratedIndexes();
  honorMigrationRows = 1;
  unavailableProbe = "";
  mocks.count.mockResolvedValue({ totalDocs: 0 });
  mocks.cms.mockResolvedValue({ count: mocks.count, db: { pool: { query: mocks.query } } });
  mocks.query.mockImplementation(async (statement: string, parameters?: unknown[]) => {
    if (unavailableProbe && statement.includes(unavailableProbe)) throw new Error("private-schema-detail");
    if (statement.includes("FROM pg_index")) return { rows: catalog, rowCount: catalog.length };
    if (statement.includes("FROM payload_migrations")) {
      if (Array.isArray(parameters?.[0])) return { rows: parameters[0].map(name => ({ name })), rowCount: parameters[0].length };
      const rowCount = parameters?.[0] === "20261012_080000_team_honor_records" ? honorMigrationRows : 1;
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
