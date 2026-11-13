import { isDeepStrictEqual } from "node:util";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import {
  APIError,
  type Access,
  type CollectionConfig,
  type Where,
} from "payload";
import {
  canUseCampus,
  canPublish,
  canReviewShowcase,
  communityIDs,
  relationID,
} from "../lib/rules";
import { currentHonorReader } from "./team-honor-records";

const legacyUpdate: Access = async ({ req }) => {
  const actor = await currentHonorReader(req);
  if (!canUseCampus(actor)) return false;
  if (canPublish(actor)) return true;
  const games = communityIDs(actor, "reviewShowcase");
  if (!games.length) return false;
  const teams = await req.payload.find({
    collection: "teams",
    req,
    overrideAccess: true,
    depth: 0,
    pagination: false,
    where: { game: { in: games } },
    select: { game: true },
  });
  return {
    or: [
      { game: { in: games } },
      ...(teams.docs.length
        ? [
            {
              and: [
                { game: { exists: false } },
                { team: { in: teams.docs.map((team) => team.id) } },
              ],
            },
          ]
        : []),
    ],
  } as Where;
};
/** Keep pre-existing honors readable, while closing the old direct-publish/self-review path. */
export function protectLegacyTeamHonors(
  collection: CollectionConfig,
): CollectionConfig {
  const protectedKeys = collection.fields.flatMap((field) =>
    "name" in field &&
    !["_status", "verified", "reviewState"].includes(field.name)
      ? [field.name]
      : [],
  );
  const relations = new Set(["team", "game", "season", "submittedBy", "cover"]);
  return {
    ...collection,
    admin: {
      ...collection.admin,
      description:
        "历史荣誉保持原归属。新增、内容修改与复审请使用代表队荣誉工作台；这里只能撤下已有记录。",
    },
    access: {
      ...collection.access,
      create: () => false,
      update: legacyUpdate,
      delete: () => false,
    },
    hooks: {
      ...collection.hooks,
      beforeOperation: [
        ...(collection.hooks?.beforeOperation ?? []),
        ({ args, operation }) => {
          // The generic contributor guard saves drafts; a legacy withdrawal must update the published base row.
          if (
            operation === "update" &&
            "data" in args &&
            (args.data?._status === "draft" || args.data?.verified === false) &&
            "draft" in args
          )
            args.draft = false;
          return args;
        },
      ],
      beforeChange: [
        ...(collection.hooks?.beforeChange ?? []),
        async ({ req, data, originalDoc, operation }) => {
          // Trusted Local API historical imports/isolated fixture setup only; REST JSON cannot set req.context.
          if (req.context.system === true) return data;
          if (operation === "create" || !originalDoc)
            throw new APIError("新增荣誉请使用队员投稿与审核工作台", 403);
          const db = req.payload.db as unknown as PostgresAdapter,
            transaction = await req.transactionID;
          const session =
            transaction != null ? db.sessions[String(transaction)] : null;
          if (!session) throw new APIError("暂时无法安全撤下历史荣誉", 503);
          await session.db.execute(
            sql`SELECT id FROM users WHERE id=${req.user?.id ?? 0} FOR SHARE`,
          );
          await session.db.execute(
            sql`SELECT id FROM honors WHERE id=${originalDoc.id} FOR UPDATE`,
          );
          const latest = await req.payload.findByID({
            collection: "honors",
            id: originalDoc.id,
            req,
            overrideAccess: true,
            draft: false,
            depth: 0,
            select: { updatedAt: true, game: true, team: true },
          });
          if (latest.updatedAt !== originalDoc.updatedAt)
            throw new APIError("历史荣誉已更新，请刷新后核对", 409);
          const actor = await currentHonorReader(req);
          let game = relationID(originalDoc.game);
          if (!game && originalDoc.team) {
            await session.db.execute(
              sql`SELECT id FROM teams WHERE id=${Number(relationID(originalDoc.team))} FOR SHARE`,
            );
            game = (
              await req.payload.findByID({
                collection: "teams",
                id: Number(relationID(originalDoc.team)),
                req,
                overrideAccess: true,
                depth: 0,
                select: { game: true },
              })
            ).game;
          }
          if (!canReviewShowcase(actor, game))
            throw new APIError("无权撤下此社群的历史荣誉", 403);
          for (const key of protectedKeys)
            if (data[key] !== undefined) {
              const before = relations.has(key)
                ? relationID(originalDoc[key])
                : originalDoc[key];
              const after = relations.has(key)
                ? relationID(data[key])
                : data[key];
              if (!isDeepStrictEqual(before ?? null, after ?? null))
                throw new APIError(
                  "历史荣誉内容只读；修改请按当前成员资格重新投稿并审核",
                  409,
                );
            }
          if (data.verified !== false && data._status !== "draft")
            throw new APIError(
              "历史入口不能重新核验或发布；请通过新的荣誉审核流程",
              409,
            );
          data.verified = false;
          data._status = "draft";
          data.reviewState = "editing";
          return data;
        },
      ],
    },
  };
}
