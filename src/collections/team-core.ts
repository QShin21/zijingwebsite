import { APIError, type Access, type CollectionConfig, type CollectionBeforeChangeHook, type Field, type RelationshipField, type Where } from "payload";
import type { User } from "../payload-types";
import { canParticipate, canPublish, communityIDs, relationID } from "../lib/rules";
import { currentTeamActor } from "../lib/team-memberships";

async function actorScope(req: Parameters<Access>[0]["req"]) {
  const actor = await currentTeamActor(req.payload, req.user as User | null, req);
  return { actor, games: communityIDs(actor, "handleJoins") };
}
const privateRead = (memberField: "applicant" | "member", establishment = false): Access => async ({ req }) => {
  const { actor, games } = await actorScope(req);
  if (!canParticipate(actor)) return false;
  if (canPublish(actor)) return true;
  return { or: [{ [memberField]: { equals: actor!.id } }, ...(!establishment && games.length ? [{ game: { in: games } }] : [])] } as Where;
};
const write: Access = ({ req }) => canParticipate(req.user as User) && req.context.teamCoreWrite === true;
const audit: NonNullable<CollectionConfig["hooks"]>["afterChange"] = [async ({ doc, previousDoc, req, collection, operation }) => {
  await req.payload.create({ collection: "audit", req, overrideAccess: true, data: {
    actor: String(req.user?.id ?? "system"), object: `${collection.slug}:${doc.id}`,
    action: previousDoc?.status !== doc.status ? `${operation}:${previousDoc?.status ?? "new"}->${doc.status}` : operation,
    status: doc.status,
  } });
  return doc;
}];
const guard: CollectionBeforeChangeHook = ({ req, data }) => {
  if (req.context.teamCoreWrite !== true) throw new APIError("请使用代表队工作台操作", 403);
  return data;
};
const rel = (name: string, relationTo: "users" | "games" | "teams" | "team-establishment-applications" | "team-recruitments" | "team-join-applications", required = true): RelationshipField =>
  ({ name, type: "relationship", relationTo, required, maxDepth: 0, index: true });
const note: Field = { name: "reviewNote", label: "审核意见", type: "textarea", maxLength: 1000 };
const reviewed: Field[] = [note, rel("reviewedBy", "users", false), { name: "reviewedAt", type: "date" }];
function workflow(slug: string, label: string, read: Access, fields: Field[]): CollectionConfig {
  return { slug, labels: { singular: label, plural: label }, admin: { useAsTitle: "title", description: "仅通过代表队网页工作台操作；成员录取不会授予平台或社群权限。" },
    access: { read, create: write, update: write, delete: () => false },
    hooks: { beforeChange: [guard], afterChange: audit }, fields };
}
export const TeamEstablishmentApplications = workflow("team-establishment-applications", "建队申请", privateRead("applicant", true), [
  { name: "title", label: "拟用队名", type: "text", required: true, maxLength: 80 },
  rel("game", "games"), rel("applicant", "users"), { name: "reason", label: "组织与训练计划", type: "textarea", required: true, maxLength: 3000 },
  { name: "requestKey", type: "text", required: true, unique: true, admin: { hidden: true } },
  { name: "status", type: "select", required: true, defaultValue: "pending", index: true, options: ["pending", "returned", "rejected", "withdrawn", "approved"] },
  ...reviewed, rel("team", "teams", false),
]);
export const TeamRecruitments = workflow("team-recruitments", "代表队招新批次", async ({ req }) => {
  const { actor, games } = await actorScope(req);
  if (!canParticipate(actor)) return false;
  if (canPublish(actor)) return true;
  const teams = await req.payload.find({ collection: "teams", req: { ...req, user: null }, user: null, overrideAccess: false, depth: 0,
    pagination: false, draft: false, where: { and: [{ teamStatus: { in: ["active", "resting"] } }, { archived: { not_equals: true } }, { establishmentApplication: { exists: true } }] }, select: { game: true } });
  return { or: [
    { and: [{ team: { in: teams.docs.map(team => team.id) } }, { status: { in: ["open", "closed", "archived"] } }] },
    ...(games.length ? [{ game: { in: games } }] : []),
  ] } as Where;
}, [
  { name: "title", type: "text", label: "批次名称", required: true, maxLength: 120 }, rel("team", "teams"), rel("game", "games"),
  { name: "status", type: "select", required: true, defaultValue: "draft", index: true, options: ["draft", "open", "closed", "archived"] },
  { name: "signupForm", label: "代表队申请表", type: "json", required: true },
  rel("createdBy", "users"),
]);
export const TeamJoinApplications = workflow("team-join-applications", "入队申请", privateRead("applicant"), [
  { name: "title", type: "text", required: true }, rel("team", "teams"), rel("game", "games"), rel("recruitment", "team-recruitments"), rel("applicant", "users"),
  { name: "requestKey", type: "text", required: true, unique: true, admin: { hidden: true } },
  { name: "status", type: "select", required: true, defaultValue: "draft", index: true, options: ["draft", "pending", "returned", "rejected", "withdrawn", "approved"] },
  { name: "formVersion", type: "text", required: true }, { name: "formSnapshot", type: "json", required: true },
  { name: "answers", type: "json", required: true }, ...reviewed,
]);
export const TeamMemberships = workflow("team-memberships", "权威代表队成员关系", privateRead("member"), [
  { name: "title", type: "text", required: true }, rel("team", "teams"), rel("game", "games"), rel("member", "users"),
  { name: "membershipKey", type: "text", required: true, unique: true, admin: { hidden: true } },
  { name: "status", type: "select", required: true, index: true, options: ["active", "revoked"] },
  { name: "joinedAt", type: "date", required: true }, { name: "revokedAt", type: "date" },
  { name: "season", type: "relationship", relationTo: "seasons", maxDepth: 0 },
  { name: "leftAt", type: "date" }, rel("sourceApplication", "team-join-applications"), rel("grantedBy", "users"), rel("revokedBy", "users", false),
  { name: "revocationReason", type: "textarea", maxLength: 1000 },
]);
export const TeamCoreCollections = [TeamEstablishmentApplications, TeamRecruitments, TeamJoinApplications, TeamMemberships];
export const teamLifecycleFields: Field[] = [
  { name: "teamStatus", label: "成立与运营状态", type: "select", defaultValue: "unestablished", options: ["unestablished", "active", "resting", "archived"],
    access: { create: ({ req }) => req.context.teamCoreWrite === true, update: ({ req }) => req.context.teamCoreWrite === true } },
  { ...rel("establishmentApplication", "team-establishment-applications", false),
    access: { create: ({ req }) => req.context.teamCoreWrite === true, update: () => false } },
];
export const guardTeamLifecycle: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (originalDoc?.establishmentApplication && data.game !== undefined && String(relationID(data.game)) !== String(relationID(originalDoc.game)))
    throw new APIError("已成立代表队不可更换所属社群", 409);
  return data;
};
