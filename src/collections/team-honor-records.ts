import {
  APIError,
  type Access,
  type CollectionConfig,
  type FieldAccess,
  type PayloadRequest,
  type Where,
} from "payload";
import {
  canParticipate,
  canPublish,
  canReviewShowcase,
  communityIDs,
  relationID,
  type Identity,
} from "../lib/rules";
import {
  honorProjectionGranted,
  honorWriteGrant,
} from "../lib/team-honor-grants";
import { honorStates } from "../lib/team-honor-model";

export async function currentHonorReader(req: PayloadRequest) {
  if (!req.user?.id) return null;
  const actor = await req.payload
    .findByID({
      collection: "users",
      id: req.user.id,
      req,
      overrideAccess: true,
      depth: 0,
      select: {
        name: true,
        roles: true,
        accountStatus: true,
        communityOffices: true,
      },
    })
    .catch(() => null);
  if (actor) req.user = { ...req.user, ...actor, collection: "users" };
  return actor;
}
const privateRead: FieldAccess = ({ req, doc }) =>
  canParticipate(req.user as Identity) &&
  (Number(relationID(doc?.author)) === req.user!.id ||
    canReviewShowcase(req.user as Identity, doc?.game));
const versionRead: FieldAccess = (args) =>
  honorProjectionGranted(args.req) || privateRead(args);
const privateAccess = { read: privateRead };
const readRecords: Access = async ({ req }) => {
  if (honorProjectionGranted(req))
    return { state: { equals: "approved" } } as Where;
  const actor = await currentHonorReader(req);
  if (!canParticipate(actor)) return false;
  if (canPublish(actor)) return true;
  const games = communityIDs(actor, "reviewShowcase");
  return {
    or: [
      { author: { equals: actor!.id } },
      ...(games.length ? [{ game: { in: games } }] : []),
    ],
  } as Where;
};
export const TeamHonorRecords: CollectionConfig = {
  slug: "team-honor-records",
  labels: { singular: "代表队荣誉记录", plural: "代表队荣誉记录" },
  admin: {
    useAsTitle: "title",
    description:
      "请从代表队与荣誉工作台投稿、审核和隐藏；成员资格来自唯一 team-memberships。",
  },
  access: {
    read: readRecords,
    create: ({ req }) => Boolean(honorWriteGrant(req)),
    update: ({ req }) => Boolean(honorWriteGrant(req)),
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      ({ req, data, originalDoc, operation }) => {
        const grant = honorWriteGrant(req);
        if (
          !grant ||
          !req.transactionID ||
          !canParticipate(req.user as Identity) ||
          (operation === "update" && grant.id !== originalDoc?.id) ||
          (operation === "create" && grant.id)
        )
          throw new APIError("请通过荣誉工作台操作，不能直接修改审核状态", 403);
        for (const key of [
          "team",
          "game",
          "author",
          "authorName",
          "membershipRef",
          "season",
        ]) {
          if (
            operation === "update" &&
            data[key] !== undefined &&
            String(relationID(data[key])) !==
              String(relationID(originalDoc?.[key]))
          )
            throw new APIError("荣誉作者与取得成绩时的归属不可更换", 403);
        }
        // Never trust status, author, game or review/version fields from browser input.
        return { ...data, ...grant.data };
      },
    ],
  },
  fields: [
    {
      name: "team",
      type: "relationship",
      relationTo: "teams",
      required: true,
      maxDepth: 0,
      index: true,
    },
    {
      name: "game",
      type: "relationship",
      relationTo: "games",
      required: true,
      maxDepth: 0,
      index: true,
    },
    {
      name: "season",
      type: "relationship",
      relationTo: "seasons",
      maxDepth: 0,
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      required: true,
      maxDepth: 0,
      index: true,
      access: { read: versionRead },
    },
    { name: "authorName", type: "text", required: true, maxLength: 40 },
    // Opaque reference to the core's membership.id; validated exclusively by that authority.
    // A numeric historical reference keeps this slice registrable before the core collection exists.
    {
      name: "membershipRef",
      label: "提交时的权威入队记录 ID",
      type: "number",
      required: true,
      min: 1,
      access: privateAccess,
    },
    { name: "title", type: "text", required: true, maxLength: 120 },
    { name: "competition", label: "赛事", type: "text", maxLength: 200 },
    { name: "placing", label: "奖项", type: "text", maxLength: 200 },
    { name: "date", label: "赛事日期", type: "date" },
    { name: "description", label: "说明", type: "textarea", maxLength: 5000 },
    { name: "images", label: "证据图片", type: "json" },
    { name: "videoURL", label: "受控 MP4", type: "text" },
    {
      name: "state",
      type: "select",
      required: true,
      options: [...honorStates],
      index: true,
    },
    { name: "revision", type: "number", required: true, min: 1 },
    { name: "submittedVersion", type: "text", access: privateAccess },
    { name: "submittedAt", type: "date", access: privateAccess },
    { name: "approvedVersion", type: "text", access: { read: versionRead } },
    { name: "approvedSnapshot", type: "json", access: privateAccess },
    { name: "approvedAt", type: "date" },
    {
      name: "reviewedBy",
      type: "relationship",
      relationTo: "users",
      maxDepth: 0,
      access: privateAccess,
    },
    {
      name: "reviewNote",
      type: "textarea",
      maxLength: 1000,
      access: privateAccess,
    },
    {
      name: "history",
      type: "json",
      access: privateAccess,
      admin: { hidden: true },
    },
  ],
};
