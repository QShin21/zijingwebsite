import type { Access, FieldAccess, Where } from "payload";
import { canPublish, hasRole, type Identity } from "../lib/rules";
export const admin: Access = ({ req }) =>
  hasRole(req.user as Identity, "president");
export const adminField: FieldAccess = ({ req }) =>
  hasRole(req.user as Identity, "president");
export const publisher: Access = ({ req }) => canPublish(req.user as Identity);
export const publisherField: FieldAccess = ({ req }) =>
  canPublish(req.user as Identity);
export const staff: Access = ({ req }) =>
  hasRole(req.user as Identity, "president", "vicePresident", "communityAdmin");
export function publicWhere(honor = false): Where {
  const and: Where[] = [{ _status: { equals: "published" } }];
  if (honor) and.push({ verified: { equals: true } });
  if (process.env.APP_ENV === "production")
    and.push({ demo: { not_equals: true } });
  return { and };
}
export const readContent =
  (_scoped: boolean, honor = false, _self = false): Access =>
  ({ req }) => {
    const user = req.user as Identity;
    if (canPublish(user)) return true;
    if (hasRole(user, "communityAdmin"))
      return { or: [publicWhere(honor), { submittedBy: { equals: user.id } }] } as Where;
    return publicWhere(honor);
  };
export const editContent =
  (_scoped: boolean, _self = false): Access =>
  ({ req }) => {
    const user = req.user as Identity;
    if (canPublish(user)) return true;
    if (hasRole(user, "communityAdmin"))
      return { submittedBy: { equals: user.id } } as Where;
    return false;
  };
