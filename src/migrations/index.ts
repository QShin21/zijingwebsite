import * as migration_20260920_102916 from "./20260920_102916";

export const migrations = [
  {
    up: migration_20260920_102916.up,
    down: migration_20260920_102916.down,
    name: "20260920_102916",
  },
];
