import { communityVideo } from "../lib/community-video";
import { normalizeShowcaseImage } from "../lib/showcase-images";
import { APIError, type CollectionConfig, type CollectionBeforeChangeHook, type Access, type Where } from "payload";
import { canParticipate, canPublish, hasRole, managesGame, type Identity } from "../lib/rules";
import { MAX_WECHAT_QR_TEXT_LENGTH, normalizeWechatQr, validApplicantName, validApplicantPhone } from "../lib/application-details";

const relation = (name: string, to: "games" | "users") =>
  ({ name, type: "relationship" as const, relationTo: to, required: true, maxDepth: 0,
    access: { create: () => true, update: () => false } });
const ownOrReviewer: Access = ({ req }) => {
  if (req.context.publicCommunityContacts) return { and: [{ game: { equals: req.context.publicCommunityContacts } }, { status: { equals: "approved" } }] } as Where;
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
const participationGuard = (kind: "local" | "showcase"): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, req, operation }) => {
    const user = req.user as Identity;
    if (kind === "showcase") {
      if (data.videoURL) {
        const video = communityVideo(data.videoURL);
        if (!video) throw new APIError("请填写有效的 HTTPS 视频链接或 B 站嵌入代码", 400);
        data.videoURL = video.url;
      }
      if (data.images !== undefined) {
        if (!Array.isArray(data.images) || data.images.length > 6) throw new APIError("最多上传 6 张照片", 400);
        try {
          data.images = await Promise.all(data.images.map(async (image: { source?: unknown; caption?: string }) => ({
            source: await normalizeShowcaseImage(image.source), caption: String(image.caption || "").slice(0,200),
          })));
        } catch { throw new APIError("请上传 2 MB 以内的静态 PNG、JPEG 或 WebP 照片", 400); }
      }
    }
    if (operation === "update") {
      if (!canPublish(user) && !managesGame(user, originalDoc?.game)) throw new APIError("无权管理此社群", 403);
      for (const key of ["author", "authorName", "game", "targetType", "targetId", "parent"]) {
        if (data[key] !== undefined && String(idOf(data[key])) !== String(idOf(originalDoc?.[key])))
          throw new APIError("关联对象不可修改", 403);
      }
      return data;
    }
    if (!canParticipate(user)) throw new APIError("请先登录可用账号", 403);
    const game = data.game;
    if (game) {
      data.game = await openGame(req, game);
      await notBanned(req, data.game, user);
      if (kind === "local" && !managesGame(user, data.game))
        throw new APIError("仅对应社群管理员可直接发布", 403);
    } else throw new APIError("缺少游戏社群", 400);
    const body = String(data.body ?? "").trim();
    if ((kind !== "showcase" && body.length < 1) || body.length > 5000) throw new APIError("文字最多 5000 字；活动与通知须填写正文", 400);
    data.body = body;
    data.author = user.id;
    data.authorName = String((req.user as Identity & { name?: string }).name ?? "社团成员");
    data.status = kind === "showcase" && !managesGame(user, data.game) ? "pending" : "visible";
    return data;
  };
function social(slug: string, title: string, kind: "local" | "showcase"): CollectionConfig {
  const fields: CollectionConfig["fields"] = [
    { name: "title", type: "text", required: true, maxLength: 120 },
    { name: "body", type: "textarea", required: kind !== "showcase", maxLength: 5000 },
    { name: "game", type: "relationship", relationTo: "games", maxDepth: 0 },
    relation("author", "users"),
    { name: "authorName", type: "text", access: { create: () => false, update: () => false } },
    { name: "status", type: "select", defaultValue: "visible", options: kind === "showcase" ? ["visible", "hidden", "pending", "rejected"] : ["visible", "hidden"],
      access: { create: () => false, update: ({ req, doc }) => managesGame(req.user as Identity, doc?.game) } },
  ];
  if (kind === "showcase") fields.push(
    { name: "videoURL", label: "视频链接", type: "text", maxLength: 2000 },
    { name: "reviewNote", label: "审核说明", type: "textarea", maxLength: 500,
      access: { create: () => false, update: ({ req, doc }) => managesGame(req.user as Identity, doc?.game) } },
    { name: "images", label: "活动照片", type: "array", maxRows: 6, fields: [
      { name: "source", type: "textarea", required: true, maxLength: 6_000_000, admin: { hidden: true } },
      { name: "caption", label: "图片说明", type: "text", maxLength: 200 },
    ] },
  );
  if (kind === "local") fields.push({ name: "category", type: "select", options: ["event", "notice"], required: true });
  return {
    slug, labels: { singular: title, plural: title }, admin: { useAsTitle: "title" },
    access: {
      read: kind === "showcase" ? ({ req }) => {
        if (canPublish(req.user as Identity)) return true;
        const scope: Where[] = [{ status: { equals: "visible" } }];
        if (canParticipate(req.user as Identity)) scope.push({ author: { equals: req.user!.id } });
        if (hasRole(req.user as Identity, "communityAdmin")) scope.push({ game: { in: ((req.user as Identity).communities || []).map(idOf) } });
        return { or: scope };
      } : visibleToPublic,
      create: ({ req }) => canParticipate(req.user as Identity) && (kind !== "showcase" || req.context.webShowcaseWrite === true),
      update: kind === "showcase" ? (args) => args.req.context.webShowcaseWrite === true ? moderatorWhere(args) : false : moderatorWhere,
      delete: ({ req }) => canPublish(req.user as Identity) && (kind !== "showcase" || req.context.webShowcaseWrite === true),
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
          if (!validApplicantName(data.realName))
            throw new APIError("请填写 1–80 字的姓名", 400);
          if (!validApplicantPhone(data.phone))
            throw new APIError("手机号需为 6–20 位数字，可在开头添加 + 国际区号", 400);
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
      maxLength: MAX_WECHAT_QR_TEXT_LENGTH,
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
  social("community-showcase", "社群风采", "showcase"),
  social("community-posts", "社群活动与通知", "local"),
];
