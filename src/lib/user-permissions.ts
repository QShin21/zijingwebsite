import { isDeepStrictEqual } from "node:util";
import { relationID } from "./rules";

export const userPermissionFields = [
  "roles",
  "communities",
  "communityOffices",
  "department",
  "accountStatus",
  "teams",
] as const;

// The CMS sends read-only values too, including 0 for an empty array and
// populated relationships. Compare their meaning before rejecting a change.
function normalize(value: unknown, field = ""): unknown {
  if (["roles", "communities", "communityOffices", "teams"].includes(field)) {
    const rows = value == null || value === 0 ? [] : value;
    if (!Array.isArray(rows)) return rows;
    return field === "communityOffices"
      ? rows.map((row) => normalize(row))
      : rows.map((row) => String(relationID(row))).sort();
  }
  if (["game", "grantedBy", "sourceApplication"].includes(field))
    return value == null || value === ""
      ? undefined
      : String(relationID(value));
  if (value == null || value === "") return undefined;
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, normalize(item, key)])
        .filter(([, item]) => item !== undefined),
    );
  return value;
}

export function userPermissionUnchanged(
  field: string,
  submitted: unknown,
  current: unknown,
): boolean {
  return isDeepStrictEqual(
    normalize(submitted, field),
    normalize(current, field),
  );
}
