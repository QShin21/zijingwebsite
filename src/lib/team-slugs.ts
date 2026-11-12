import { APIError, type CollectionBeforeChangeHook } from "payload";

/** Static /teams routes take precedence over a dynamic team slug. */
export const reservedTeamSlugs = ["apply", "honors", "manage", "profiles", "recruitment"] as const;

export function validateTeamSlug(value: unknown, options?: { previousValue?: unknown; operation?: string }) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    return "使用小写字母、数字和短横线；已发布后慎重修改";
  if ((reservedTeamSlugs as readonly string[]).includes(value) && !(options?.operation === "update" && options.previousValue === value))
    return `“${value}”是代表队栏目的保留路径，请换一个永久链接标识`;
  // Legacy collisions are reported by the read-only audit, never silently renamed.
  return true;
}

/** Payload skips field validators for draft/autosave writes. Reserve routes there too. */
export const guardTeamSlug: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (typeof data.slug === "string" && (reservedTeamSlugs as readonly string[]).includes(data.slug) &&
    (operation === "create" || originalDoc?.slug !== data.slug))
    throw new APIError(`“${data.slug}”是代表队栏目的保留路径，请换一个永久链接标识`, 400);
  return data;
};
