import { APIError, type CollectionConfig, type FieldAccess, type PayloadRequest, type Where } from "payload";
import { canParticipate, canReviewPromotion, communityIDs, managesGame, relationID, type Identity } from "../lib/rules";

async function currentReader(req: PayloadRequest) {
  if (!req.user?.id) return null;
  const user = await req.payload.findByID({ collection: "users", id: req.user.id, req, overrideAccess: true, depth: 0,
    select: { roles: true, accountStatus: true, communityOffices: true } }).catch(() => null);
  if (user) req.user = { ...req.user, ...user, collection: "users" };
  return user;
}
const privateRead: FieldAccess = ({ req, doc }) => canParticipate(req.user as Identity) &&
  (canReviewPromotion(req.user as Identity) || String(relationID(doc?.requestedBy)) === String(req.user!.id) ||
    communityIDs(req.user as Identity, "publishContent").includes(String(relationID(doc?.game))));
const privateAccess = { read: privateRead };
const controlledWrite = ({ req }: { req: PayloadRequest }) => req.context.promotionWrite === true;
export const ContentPromotions: CollectionConfig = {
  slug: "content-promotions", labels: { singular: "社群升推", plural: "社群升推" },
  admin: { useAsTitle: "sourceKey", description: "通过网站升推工作台申请、审核与降级；原内容和报名归属不变。" },
  access: {
    read: async ({ req }) => {
      if (req.context.publicPromotionProjection === true) return { status: { equals: "approved" } } as Where;
      const user = await currentReader(req);
      if (!canParticipate(user)) return false;
      if (canReviewPromotion(user)) return true;
      return { or: [{ requestedBy: { equals: user!.id } }, { game: { in: communityIDs(user, "publishContent") } }] } as Where;
    },
    create: controlledWrite, update: controlledWrite, delete: () => false,
  },
  hooks: { beforeChange: [({ req, data, originalDoc, operation }) => {
    if (!req.context.promotionWrite || !req.transactionID) throw new APIError("请从网站升推工作台操作", 403);
    if (operation === "update") for (const key of ["sourceCollection", "sourceID", "sourceKey", "game"]) {
      if (data[key] !== undefined && String(relationID(data[key])) !== String(relationID(originalDoc?.[key]))) throw new APIError("升推不能移动原内容归属", 403);
    }
    if (req.context.promotionSourceChanged === true) return data;
    const action = req.context.promotionAction;
    if (["submit", "withdraw"].includes(String(action))) {
      if (!managesGame(req.user as Identity, data.game ?? originalDoc?.game)) throw new APIError("仅对应社群管理员可申请或撤回", 403);
      if (data.status !== (action === "submit" ? "pending" : "withdrawn")) throw new APIError("申请状态无效", 400);
    } else if (!canReviewPromotion(req.user as Identity) || !["approve", "return", "reject", "promote", "demote"].includes(String(action))) throw new APIError("无权审核或升推", 403);
    return data;
  }] },
  fields: [
    { name: "sourceCollection", type: "select", required: true, options: ["community-posts", "community-showcase"] },
    { name: "sourceID", type: "number", required: true, min: 1 },
    { name: "sourceKey", type: "text", required: true, unique: true },
    { name: "game", type: "relationship", relationTo: "games", maxDepth: 0 },
    { name: "kind", type: "select", required: true, options: ["event", "notice", "showcase"] },
    { name: "status", type: "select", required: true, options: ["pending", "returned", "rejected", "withdrawn", "approved", "demoted", "needsReview"] },
    { name: "requestedBy", type: "relationship", relationTo: "users", maxDepth: 0, access: privateAccess },
    { name: "reason", type: "textarea", maxLength: 1000, access: privateAccess },
    { name: "requestedVersion", type: "text", access: privateAccess },
    { name: "requestedSnapshot", type: "json", access: privateAccess },
    { name: "approvedVersion", type: "text" },
    { name: "approvedSnapshot", type: "json" },
    { name: "approvedBy", type: "relationship", relationTo: "users", maxDepth: 0, access: privateAccess },
    { name: "approvedAt", type: "date" },
    { name: "reviewNote", type: "textarea", maxLength: 1000, access: privateAccess },
    { name: "history", type: "json", access: privateAccess, admin: { hidden: true } },
  ],
};
