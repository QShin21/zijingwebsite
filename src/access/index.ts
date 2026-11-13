import type { Access, FieldAccess, Where } from "payload";
import { audienceWhere } from "../lib/content-audience";
import { canPublish, canSubmitClubContent, canUseCampus, communityIDs, hasRole, type Identity } from "../lib/rules";
export const admin: Access = ({ req }) =>
  hasRole(req.user as Identity, "president");
export const adminField: FieldAccess = ({ req }) =>
  hasRole(req.user as Identity, "president");
export const publisher: Access = ({ req }) => canPublish(req.user as Identity);
export const publisherField: FieldAccess = ({ req }) =>
  canPublish(req.user as Identity);
export const staff: Access = ({ req }) =>
  canSubmitClubContent(req.user as Identity);
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
    if (user && !canUseCampus(user)) return false;
    if (canPublish(user)) return true;
    if (canSubmitClubContent(user))
      return { or: [publicWhere(honor), { submittedBy: { equals: user.id } }] } as Where;
    return publicWhere(honor);
  };
export const editContent =
  (_scoped: boolean, _self = false): Access =>
  ({ req }) => {
    const user = req.user as Identity;
    if (canPublish(user)) return true;
    if (canSubmitClubContent(user))
      return { submittedBy: { equals: user.id } } as Where;
    return false;
  };
export const readEventContent: Access = ({ req }) => {
  const user = req.user as Identity;
  if (canPublish(user)) return true;
  if (canSubmitClubContent(user))
    return { or: [publicWhere(), { submittedBy: { equals: user.id } }] } as Where;
  const games = communityIDs(user, "viewSignups");
  if (games.length) return { or: [publicWhere(), { and: [
    { submittedBy: { equals: user.id } }, { or: [{ game: { in: games } }, { game: { exists: false } }] },
  ] }] } as Where;
  return { and: [publicWhere(), audienceWhere(user)] };
};
export const readAnnouncementContent: Access = ({ req }) => {
  const user = req.user as Identity;
  if (canPublish(user)) return true;
  if (canSubmitClubContent(user))
    return { or: [publicWhere(), { submittedBy: { equals: user.id } }] } as Where;
  return { and: [publicWhere(), audienceWhere(user)] };
};
