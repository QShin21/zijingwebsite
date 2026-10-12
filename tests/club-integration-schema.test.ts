import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { migrations } from "../src/migrations";

const snapshot = JSON.parse(await readFile("src/migrations/20261012_170000_team_member_profiles.json", "utf8"));
const historical = JSON.parse(await readFile("src/migrations/20260927_182940_community_showcase.json", "utf8"));

it("联合迁移顺序唯一，荣誉增量先于核心和简介，历史物理表仍存在于最后快照", () => {
  const names = migrations.map(migration => migration.name);
  expect(new Set(names).size).toBe(names.length);
  const honor = names.indexOf("20261012_080000_team_honor_records"), core = names.indexOf("20261012_160000_team_core"), profiles = names.indexOf("20261012_170000_team_member_profiles");
  expect(honor).toBeGreaterThan(names.indexOf("20261012_050000_staff_recruitment")); expect(core).toBeGreaterThan(honor); expect(profiles).toBeGreaterThan(core);
  for (const table of Object.keys(historical.tables)) expect(snapshot.tables).toHaveProperty(table);
  for (const table of ["staff_batches", "staff_applications", "team_honor_records", "team_establishment_applications", "team_recruitments", "team_join_applications", "team_memberships", "team_member_profiles"]) expect(snapshot.tables["public." + table]).toBeDefined();
});

it("真实目录生成的联合快照保留数组类型与荣誉所有权四个 RESTRICT 外键", () => {
  for (const table of Object.values(snapshot.tables) as { foreignKeys: Record<string, { columnsFrom: string[]; columnsTo: string[] }> }[]) {
    for (const foreignKey of Object.values(table.foreignKeys)) {
      expect(Array.isArray(foreignKey.columnsFrom)).toBe(true); expect(Array.isArray(foreignKey.columnsTo)).toBe(true);
      expect(foreignKey.columnsFrom.length).toBe(foreignKey.columnsTo.length);
    }
  }
  const keys = Object.values(snapshot.tables["public.team_honor_records"].foreignKeys) as { columnsFrom: string[]; tableTo: string; onDelete: string }[];
  for (const [column, table] of [["team_id", "teams"], ["game_id", "games"], ["season_id", "seasons"], ["author_id", "users"]]) expect(keys.find(key => key.columnsFrom[0] === column)).toMatchObject({ tableTo: table, onDelete: "restrict" });
  expect(keys.find(key => key.columnsFrom[0] === "reviewed_by_id")).toMatchObject({ tableTo: "users", onDelete: "set null" });
});
