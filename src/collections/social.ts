import { APIError, type CollectionConfig, type CollectionBeforeChangeHook, type Access, type Where } from "payload";
import { canParticipate, canPublish, hasRole, managesGame, type Identity } from "../lib/rules";
import { normalizeWechatQr, validApplicantName, validApplicantPhone } from "../lib/application-details";

const relation = (name: string, to: "games" | "users" | "forum-posts" | "comments") =>
  ({ name, type: "relationship" as const, relationTo: to, required: true, maxDepth: 0,
    access: { create: () => true, update: () => false } });
const ownOrReviewer: Access = ({ req }) => {
  if (canPublish(req.user as Identity)) return true;
  return req.user ? { applicant: { equals: req.user.id } } : false;
};
const moderatorWhere: Access = ({ req }) => {
  const user = req.user as Identity;
  if (canPublish(user)) return true;
  if (hasRole(user, "communityAdmin"))
    return { game: { in: (user.communities ?? []).map((v) => typeof v === "object" ? v.id : v) } } as Where;
  return false;
};
const visibleToPublic: Access = ({ req }) => {
  if (canPublish(req.user as Identity)) return true;
  if (hasRole(req.user as Identity, "communityAdmin")) {
    const ids = (req.user as Identity).communities ?? [];
    return { or: [{ status: { equals: "visible" } },
      { game: { in: ids.map((v) => typeof v === "object" ? v.id : v) } }] } as Where;
  }
  return { status: { equals: "visible" } };
};
const idOf = (value: unknown) =>
  typeof value === "object" && value !== null && "id" in value
    ? (value as { id: string | number }).id : value;

async function openGame(req: Parameters<CollectionBeforeChangeHook>[0]["req"], value: unknown) {
  const id = idOf(value);
  if (!id) throw new APIError("请选择游戏社群", 400);
  const game = await req.payload.findByID({
    collection: "games", id: id as number, user: null, overrideAccess: false,
    draft: false, depth: 0, req,
  }).catch(() => null);
  if (!game || game._status !== "published") throw new APIError("该社群尚未开放", 404);
  return game.id;
}
async function notBanned(req: Parameters<CollectionBeforeChangeHook>[0]["req"], game: number, user: Identity) {
  const result = await req.payload.find({
    collection: "community-bans", where: { and: [
      { game: { equals: game } }, { member: { equals: user.id } }, { active: { equals: true } },
    ] }, limit: 1, depth: 0, overrideAccess: true, req,
  });
  if (result.docs.length) throw new APIError("此社群的发言权限已受限", 403);
}
const participationGuard = (kind: "forum" | "message" | "comment" | "local"): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, req, operation }) => {
    const user = req.user as Identity;
    if (operation === "update") {
      if (!canPublish(user) && !managesGame(user, originalDoc?.game)) throw new APIError("无权管理此社群", 403);
      for (const key of ["author", "authorName", "game", "targetType", "targetId", "parent"]) {
        if (data[key] !== undefined && String(idOf(data[key])) !== String(idOf(originalDoc?.[key])))
          throw new APIError("关联对象不可修改", 403);
      }
      return data;
    }
    if (!canParticipate(user)) throw new APIError("请先登录可用账号", 403);
    let game = data.game;
    if (kind === "comment") {
      const target = data.targetType as string;
      if (!["events", "albums", "news", "announcements", "forum-posts"].includes(target) ||
          !Number.isSafeInteger(Number(data.targetId)) || Number(data.targetId) < 1)
        throw new APIError("评论对象无效", 400);
      const found = await req.payload.findByID({
        collection: target as "events", id: Number(data.targetId), user: null,
        overrideAccess: false, draft: false, depth: 0, req,
      }).catch(() => null);
      if (!found || ("_status" in found && found._status !== "published") ||
          ("status" in found && found.status !== "visible"))
        throw new APIError("评论对象不存在或未公开", 404);
      if (target === "forum-posts") game = found.game;
      if (data.parent) {
        const parent = await req.payload.findByID({ collection: "comments",
          id: idOf(data.parent) as number, user: null, overrideAccess: false, req, depth: 0 }).catch(() => null);
        if (!parent || parent.targetType !== target || Number(parent.targetId) !== Number(data.targetId))
          throw new APIError("回复必须属于同一讨论", 400);
      }
    }
    if (game) {
      data.game = await openGame(req, game);
      await notBanned(req, data.game, user);
      if (kind === "local" && !managesGame(user, data.game))
        throw new APIError("仅对应社群管理员可直接发布", 403);
    } else if (kind !== "comment") throw new APIError("缺少游戏社群", 400);
    const body = String(data.body ?? "").trim();
    if (body.length < 1 || body.length > 5000) throw new APIError("内容长度需为 1–5000 字", 400);
    data.body = body;
    data.author = user.id;
    data.authorName = String((req.user as Identity & { name?: string }).name ?? "社团成员");
    data.status = "visible";
    const existing = await req.payload.find({ collection: kind === "forum" ? "forum-posts" :
      kind === "message" ? "community-messages" : kind === "local" ? "community-posts" : "comments",
      where: { and: [{ author: { equals: user.id } }, { createdAt: { greater_than: new Date(Date.now() - 8000).toISOString() } }] },
      limit: 1, overrideAccess: true, req, depth: 0 });
    if (existing.docs.length) throw new APIError("发送过于频繁，请稍后重试", 429);
    return data;
  };
function social(slug: string, title: string, kind: "forum" | "message" | "comment" | "local"): CollectionConfig {
  const fields: CollectionConfig["fields"] = [
    ...(kind === "forum" || kind === "local" ? [{ name: "title", type: "text" as const, required: true, maxLength: 120 }] : []),
    { name: "body", type: "textarea", required: true, maxLength: 5000 },
    { name: "game", type: "relationship", relationTo: "games", maxDepth: 0 },
    relation("author", "users"),
    { name: "authorName", type: "text", access: { create: () => false, update: () => false } },
    { name: "status", type: "select", defaultValue: "visible", options: ["visible", "hidden"],
      access: { create: () => false, update: ({ req, doc }) => managesGame(req.user as Identity, doc?.game) } },
  ];
  if (kind === "comment") fields.push(
    { name: "targetType", type: "select", required: true,
      options: ["events", "albums", "news", "announcements", "forum-posts"] },
    { name: "targetId", type: "number", required: true },
    { name: "parent", type: "relationship", relationTo: "comments", maxDepth: 0 },
  );
  if (kind === "local") fields.push({ name: "category", type: "select", options: ["event", "notice"], required: true });
  return {
    slug, labels: { singular: title, plural: title }, admin: { useAsTitle: kind === "forum" || kind === "local" ? "title" : "authorName" },
    access: {
      read: visibleToPublic,
      create: ({ req }) => canParticipate(req.user as Identity),
      update: moderatorWhere,
      delete: ({ req }) => canPublish(req.user as Identity),
    },
    hooks: { beforeChange: [participationGuard(kind)] },
    fields,
  };
}

const applications: CollectionConfig = {
  slug: "community-applications",
  labels: { singular: "社群管理员申请", plural: "社群管理员申请" },
  admin: { useAsTitle: "proposedGame" },
  access: {
    read: ownOrReviewer,
    create: ({ req }) => canParticipate(req.user as Identity),
    update: ({ req }) => canPublish(req.user as Identity),
    delete: ({ req }) => canPublish(req.user as Identity),
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        if (operation === "create") {
          if (!canParticipate(req.user as Identity))
            throw new APIError("请登录", 403);
          data.realName = String(data.realName ?? "").trim();
          data.phone = String(data.phone ?? "").trim();
          if (
            !validApplicantName(data.realName) ||
            !validApplicantPhone(data.phone)
          )
            throw new APIError("请填写姓名和有效手机号", 400);
          try {
            data.wechatQr = await normalizeWechatQr(data.wechatQr);
          } catch {
            throw new APIError("请上传 2 MB 以内的有效微信名片二维码图片", 400);
          }
          const game = data.game ? await openGame(req, data.game) : null;
          const proposedGame = String(data.proposedGame ?? "").trim();
          if (!game && (proposedGame.length < 2 || proposedGame.length > 80))
            throw new APIError("新游戏名称需为 2–80 字", 400);
          if (String(data.reason ?? "").trim().length < 10)
            throw new APIError("请填写至少 10 字的申请说明", 400);
          data.applicant = req.user!.id;
          data.game = game;
          data.proposedGame = game
            ? (
                await req.payload.findByID({
                  collection: "games",
                  id: game,
                  overrideAccess: false,
                  user: null,
                  draft: false,
                  depth: 0,
                  req,
                })
              ).title
            : proposedGame;
          data.status = "pending";
        } else if (
          !req.context.applicationResolved &&
          originalDoc?.status !== "pending" &&
          data.status !== originalDoc?.status
        )
          throw new APIError("申请已经处理", 409);
        else if (
          data.status &&
          !["pending", "approved", "rejected"].includes(data.status)
        )
          throw new APIError("审核状态无效", 400);
        if (
          operation === "update" &&
          data.status === "approved" &&
          (!originalDoc?.realName ||
            !originalDoc?.phone ||
            !originalDoc?.wechatQr)
        )
          throw new APIError("旧申请资料不全，请退回后由申请人重新提交", 400);
        if (operation === "update" && !req.context.applicationResolved)
          for (const field of [
            "applicant",
            "game",
            "proposedGame",
            "reason",
            "realName",
            "phone",
            "wechatQr",
          ]) {
            if (
              data[field] !== undefined &&
              String(idOf(data[field])) !== String(idOf(originalDoc?.[field]))
            )
              throw new APIError("申请内容不可在审核时更改", 403);
          }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (
          doc.status !== "approved" ||
          previousDoc?.status === "approved" ||
          req.context.applicationResolved
        )
          return doc;
        let game = doc.game;
        if (!game) {
          const existing = await req.payload.find({
            collection: "games",
            overrideAccess: true,
            req,
            where: {
              and: [
                { title: { equals: doc.proposedGame } },
                { _status: { equals: "published" } },
              ],
            },
            limit: 1,
            depth: 0,
          });
          game = existing.docs[0]?.id;
          if (!game) {
            const created = await req.payload.create({
              collection: "games",
              overrideAccess: true,
              req,
              context: { system: true },
              data: {
                title: doc.proposedGame,
                slug: `community-${doc.id}`,
                _status: "published",
                reviewState: "approved",
              },
            });
            game = created.id;
          }
        }
        const applicant = await req.payload.findByID({
          collection: "users",
          id: idOf(doc.applicant) as number,
          overrideAccess: true,
          req,
          depth: 0,
        });
        const assigned = new Set(
          (applicant.communities ?? []).map((v) => Number(idOf(v))),
        );
        assigned.add(Number(game));
        await req.payload.update({
          collection: "users",
          id: applicant.id,
          overrideAccess: true,
          req,
          context: { system: true },
          data: {
            roles: canPublish(applicant as Identity)
              ? applicant.roles
              : ["communityAdmin"],
            communities: Array.from(assigned),
          },
        });
        await req.payload.update({
          collection: "community-applications",
          id: doc.id,
          overrideAccess: true,
          req,
          context: { applicationResolved: true },
          data: { game },
        });
        return doc;
      },
    ],
  },
  fields: [
    {
      name: "applicant",
      type: "relationship",
      relationTo: "users",
      required: true,
      access: { create: () => true, update: () => false },
    },
    {
      name: "game",
      type: "relationship",
      relationTo: "games",
      maxDepth: 0,
      access: { update: ({ req }) => canPublish(req.user as Identity) },
    },
    { name: "proposedGame", type: "text", required: true },
    { name: "reason", type: "textarea", required: true },
    // Nullable for historical applications; the create hook requires all three.
    { name: "realName", label: "姓名", type: "text", maxLength: 80 },
    { name: "phone", label: "手机号", type: "text", maxLength: 21 },
    {
      name: "wechatQr",
      label: "微信名片二维码",
      type: "textarea",
      admin: { hidden: true },
    },
    {
      name: "status",
      type: "select",
      defaultValue: "pending",
      options: ["pending", "approved", "rejected"],
      access: {
        create: () => false,
        update: ({ req }) => canPublish(req.user as Identity),
      },
    },
  ],
};
const bans: CollectionConfig = {
  slug: "community-bans", labels: { singular: "社群禁言", plural: "社群禁言" },
  access: { read: moderatorWhere, create: ({ req }) => canParticipate(req.user as Identity) &&
    hasRole(req.user as Identity, "communityAdmin", "vicePresident", "president"),
    update: moderatorWhere, delete: moderatorWhere },
  hooks: { beforeChange: [async ({ data, originalDoc, req, operation }) => {
    const game = operation === "create" ? data.game : originalDoc?.game;
    if (!managesGame(req.user as Identity, game)) throw new APIError("无权管理此社群", 403);
    if (operation === "create") {
      await openGame(req, game);
      const member = await req.payload.findByID({ collection: "users", id: idOf(data.member) as number,
        overrideAccess: true, req, depth: 0 }).catch(() => null);
      if (!member || canPublish(member as Identity)) throw new APIError("不可禁言该用户", 403);
      data.active = true;
    } else if (data.game || data.member) throw new APIError("不能转移禁言对象", 403);
    return data;
  }] },
  fields: [
    { name: "game", type: "relationship", relationTo: "games", required: true },
    { name: "member", type: "relationship", relationTo: "users", required: true },
    { name: "active", type: "checkbox", defaultValue: true },
    { name: "reason", type: "text", maxLength: 300 },
  ],
};
export const SocialCollections: CollectionConfig[] = [
  applications, bans,
  social("forum-posts", "论坛帖子", "forum"),
  social("community-messages", "社群发言", "message"),
  social("community-posts", "社群活动与通知", "local"),
  social("comments", "内容评论", "comment"),
];
