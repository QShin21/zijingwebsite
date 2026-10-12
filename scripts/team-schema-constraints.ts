export type CatalogForeignKey = {
  name: string;
  table_from: string;
  table_to: string;
  columns_from: string[];
  columns_to: string[];
  delete_action: string;
  update_action: string;
};

/** The reviewed SQL preserves honor ownership independently of Payload defaults. */
export function assertHonorForeignKeys(foreignKeys: CatalogForeignKey[]) {
  const required = [
    { column: "team_id", target: "teams", deleteAction: "r" },
    { column: "game_id", target: "games", deleteAction: "r" },
    { column: "season_id", target: "seasons", deleteAction: "r" },
    { column: "author_id", target: "users", deleteAction: "r" },
    { column: "reviewed_by_id", target: "users", deleteAction: "n" },
  ];
  for (const relation of required) {
    const actual = foreignKeys.find((foreignKey) =>
      foreignKey.table_from === "team_honor_records" &&
      Array.isArray(foreignKey.columns_from) &&
      foreignKey.columns_from.length === 1 &&
      foreignKey.columns_from[0] === relation.column);
    if (!actual || actual.table_to !== relation.target ||
      !Array.isArray(actual.columns_to) || actual.columns_to.length !== 1 || actual.columns_to[0] !== "id" ||
      actual.delete_action !== relation.deleteAction || actual.update_action !== "a")
      throw new Error("Missing or unsafe honor foreign key: " + relation.column);
  }
}
