import type { Access, FieldAccess, Where } from "payload";
import { canPublish, hasRole, teamIDs, type Identity } from "../lib/rules";
export const admin: Access = ({ req }) =>
  hasRole(req.user as Identity, "admin");
export const adminField: FieldAccess = ({ req }) =>
  hasRole(req.user as Identity, "admin");
export const publisher: Access = ({ req }) => canPublish(req.user as Identity);
export const publisherField: FieldAccess = ({ req }) =>
  canPublish(req.user as Identity);
export const staff: Access = ({ req }) =>
  hasRole(req.user as Identity, "admin", "publisher", "editor", "leader");
export function publicWhere(honor = false): Where {
  const and: Where[] = [{ _status: { equals: "published" } }];
  if (honor) and.push({ verified: { equals: true } });
  if (process.env.APP_ENV === "production")
    and.push({ demo: { not_equals: true } });
  return { and };
}
export const readContent =
  (scoped: boolean, honor = false, self = false): Access =>
  ({ req }) => {
    const user = req.user as Identity;
    if (hasRole(user, "admin", "publisher", "editor")) return true;
    if (scoped && hasRole(user, "leader"))
      return { [self ? "id" : "team"]: { in: teamIDs(user) } } as Where;
    return publicWhere(honor);
  };
export const editContent =
  (scoped: boolean, self = false): Access =>
  ({ req }) => {
    const user = req.user as Identity;
    if (hasRole(user, "admin", "publisher", "editor")) return true;
    if (scoped && hasRole(user, "leader"))
      return { [self ? "id" : "team"]: { in: teamIDs(user) } } as Where;
    return false;
  };
