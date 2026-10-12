import { expect, it } from "vitest";
import { assertHonorForeignKeys, type CatalogForeignKey } from "../scripts/team-schema-constraints";

const ownershipColumns = ["team_id", "game_id", "season_id", "author_id"];
function reviewedForeignKeys(): CatalogForeignKey[] {
  return [
    ["team_id", "teams", "r"],
    ["game_id", "games", "r"],
    ["season_id", "seasons", "r"],
    ["author_id", "users", "r"],
    ["reviewed_by_id", "users", "n"],
  ].map(([column, target, action]) => ({
    name: "honor_" + column,
    table_from: "team_honor_records",
    table_to: target,
    columns_from: [column],
    columns_to: ["id"],
    delete_action: action,
    update_action: "a",
  }));
}

it("honor ownership uses four RESTRICT relations and nullable reviewer metadata", () => {
  expect(() => assertHonorForeignKeys(reviewedForeignKeys())).not.toThrow();
});

it.each(ownershipColumns.flatMap(column => ["a", "n", "c"].map(action => [column, action])))(
  "%s cannot lose the reviewed RESTRICT action to %s during snapshot reconciliation", (column, action) => {
    const rows = reviewedForeignKeys();
    rows.find(row => row.columns_from[0] === column)!.delete_action = action;
    expect(() => assertHonorForeignKeys(rows)).toThrow(column);
  },
);

it.each(ownershipColumns)("missing ownership relation %s refuses a snapshot", column => {
  const rows = reviewedForeignKeys().filter(row => row.columns_from[0] !== column);
  expect(() => assertHonorForeignKeys(rows)).toThrow(column);
});

it("the same delete action cannot conceal a foreign key to another table or column", () => {
  const rows = reviewedForeignKeys();
  rows[0].table_to = "users";
  expect(() => assertHonorForeignKeys(rows)).toThrow("team_id");
  rows[0].table_to = "teams";
  rows[0].columns_to = ["slug"];
  expect(() => assertHonorForeignKeys(rows)).toThrow("team_id");
});

it("reviewer deletion and ID update actions retain the reviewed contract", () => {
  const rows = reviewedForeignKeys();
  rows[4].delete_action = "r";
  expect(() => assertHonorForeignKeys(rows)).toThrow("reviewed_by_id");
  rows[4].delete_action = "n";
  rows[0].update_action = "c";
  expect(() => assertHonorForeignKeys(rows)).toThrow("team_id");
});

it.each(["columns_from", "columns_to"])("unparsed PostgreSQL name[] %s cannot pass FK verification", field => {
  const rows = reviewedForeignKeys();
  Object.assign(rows[0], { [field]: field === "columns_from" ? "{team_id}" : "{id}" });
  expect(() => assertHonorForeignKeys(rows)).toThrow("team_id");
});
