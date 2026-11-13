import { signupFields, validateSignupForm } from './signups';
import { queueTranslationAfterChange, removeTranslationAfterDelete } from '../lib/content-translation/hooks';
import { communityVideo } from "../lib/community-video";
import { normalizeShowcaseImage } from "../lib/showcase-images";
import { controlledVideoName } from "../lib/showcase-videos";
import { isReservedHonorVideo } from "../lib/team-honor-videos";
import { APIError, type CollectionConfig, type CollectionBeforeChangeHook, type Access, type Where } from "payload";
import { canUseCampus, canPublish, communityIDs, canReviewShowcase, canSubmitClubContent, managesGame, type Identity } from "../lib/rules";
import { CommunityApplications, CommunityJoins } from "./community-operations";
import { promotionSourceChanged, promotionSourceDeleted } from "../lib/content-promotions";
import { postImagesField, validatePostImages } from "./publication-images";
import { validateCommunitySchedule } from "../lib/v2/schedule";
import { validatePublicationContent } from "../lib/publication-content";
import { audienceField, audienceWhere } from "../lib/content-audience";

const relation = (name: string, to: "games" | "users") =>
  ({ name, type: "relationship" as const, relationTo: to, required: true, maxDepth: 0,
    access: { create: () => true, update: () => false } });
const moderatorWhere: Access = ({ req }) => {
  const user = req.user as Identity;
  if (canPublish(user)) return true;
  if (communityIDs(user, "publishContent").length)
    return { game: { in: communityIDs(user, "publishContent") } } as Where;
  return false;
};
const visibleToPublic: Access = ({ req }) => {
  if (canPublish(req.user as Identity)) return true;
  const scope: Where[] = [{ and: [{ status: { equals: "visible" } }, req.context.internalPromotionSource ? {} : audienceWhere(req.user)] }];
  const editors = communityIDs(req.user as Identity, "publishContent");
  const readers = communityIDs(req.user as Identity, "viewSignups");
  if (editors.length) scope.push({ game: { in: editors } });
  if (readers.length) scope.push({ and: [{ game: { in: readers } }, { category: { equals: "event" } }] });
  return { or: scope };
};
const idOf = (value: unknown) =>
  typeof value === "object" && value !== null && "id" in value
    ? (value as { id: string | number }).id : value;

async function openGame(req: Parameters<CollectionBeforeChangeHook>[0]["req"], value: unknown) {
  const id = idOf(value);
  if (!id) throw new APIError("请选择游戏社群", 400);
  const game = await req.payload.findByID({
    collection: "games", id: id as number, user: null, overrideAccess: false,
    draft: false, depth: 0, req: { ...req, user: null },
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
        const name = controlledVideoName(video.url);
        if (name && await isReservedHonorVideo(req.payload, name, req))
          throw new APIError("荣誉私有证据不能复用为普通风采视频，请自行上传", 403);
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
      if (!(kind === "showcase" ? canReviewShowcase(user, originalDoc?.game) : managesGame(user, originalDoc?.game))) throw new APIError("无权管理此社群", 403);
      for (const key of ["author", "authorName", "game", "targetType", "targetId", "parent"]) {
        if (data[key] !== undefined && String(idOf(data[key])) !== String(idOf(originalDoc?.[key])))
          throw new APIError("关联对象不可修改", 403);
      }
      return data;
    }
    if (!canUseCampus(user)) throw new APIError("请先登录可用账号", 403);
    const game = data.game;
    if (game) {
      data.game = await openGame(req, game);
      await notBanned(req, data.game, user);
      if (kind === "local" && !managesGame(user, data.game))
        throw new APIError("仅对应社群管理员可直接发布", 403);
    } else throw new APIError("缺少游戏社群", 400);
    const body = String(data.body ?? "").trim();
    const hasArticleImages = kind === "local" && data.contentMode === "article" && Array.isArray(data.contentBlocks) && data.contentBlocks.some((block: { type?: unknown }) => block?.type === "image");
    if ((kind !== "showcase" && body.length < 1 && !hasArticleImages) || body.length > 5000) throw new APIError("文字最多 5000 字；请填写正文或插入图片", 400);
    data.body = body;
    data.author = user.id;
    data.authorName = String((req.user as Identity & { name?: string }).name ?? "社团成员");
    data.status = kind === "showcase" && !canReviewShowcase(user, data.game) ? "pending" : "visible";
    return data;
  };
function social(slug: string, title: string, kind: "local" | "showcase"): CollectionConfig {
  const fields: CollectionConfig["fields"] = [
    { name: "title", type: "text", required: true, maxLength: 120 },
    { name: "body", type: "textarea", maxLength: 5000 },
    { name: "game", type: "relationship", relationTo: "games", maxDepth: 0 },
    relation("author", "users"),
    { name: "authorName", type: "text", access: { create: () => false, update: () => false } },
    { name: "status", type: "select", defaultValue: "visible", options: kind === "showcase" ? ["visible", "hidden", "pending", "rejected"] : ["visible", "hidden"],
      access: { create: () => false, update: ({ req, doc }) => (kind === "showcase" ? canReviewShowcase(req.user as Identity, doc?.game) : managesGame(req.user as Identity, doc?.game)) } },
  ];
  if (kind === "showcase") fields.push(
    { name: "videoURL", label: "视频链接", type: "text", maxLength: 2000 },
    { name: "reviewNote", label: "审核说明", type: "textarea", maxLength: 500,
      access: { create: () => false, update: ({ req, doc }) => (kind === "showcase" ? canReviewShowcase(req.user as Identity, doc?.game) : managesGame(req.user as Identity, doc?.game)) } },
    { name: "images", label: "活动照片", type: "array", maxRows: 6, fields: [
      { name: "source", type: "textarea", required: true, maxLength: 6_000_000, admin: { hidden: true } },
      { name: "caption", label: "图片说明", type: "text", maxLength: 200 },
    ] },
  );
  if (kind === "local") fields.push(audienceField, postImagesField, ...signupFields);
  if (kind === "local") fields.push(
    { name: "contentMode", type: "text", admin: { hidden: true } },
    { name: "contentBlocks", type: "json", admin: { hidden: true } },
    { name: "category", type: "select", options: ["event", "notice"], required: true },
    ...(["startAt", "endAt"] as const).map(name => ({
      name, label: name === "startAt" ? "活动开始时间" : "活动结束时间", type: "date" as const,
      admin: { condition: (_data: unknown, siblingData: Record<string, unknown>) => siblingData.category === "event",
        date: { pickerAppearance: "dayAndTime" as const }, description: "按后台 Asia/Shanghai 时区输入；数据库保存 UTC。旧帖留空表示时间待定。" },
    })),
    { name: "location", label: "活动地点", type: "text", maxLength: 120,
      admin: { condition: (_data, siblingData) => siblingData.category === "event" } },
  );
  return {
    slug, labels: { singular: title, plural: title }, admin: { useAsTitle: "title" },
    access: {
      read: kind === "showcase" ? ({ req }) => {
        if (req.user && !canUseCampus(req.user)) return false;
        if (canPublish(req.user as Identity)) return true;
        const scope: Where[] = [{ status: { equals: "visible" } }];
        if (canUseCampus(req.user as Identity)) scope.push({ author: { equals: req.user!.id } });
        if (communityIDs(req.user as Identity, "reviewShowcase").length) scope.push({ game: { in: communityIDs(req.user as Identity, "reviewShowcase") } });
        return { or: scope };
      } : visibleToPublic,
      create: ({ req }) => canUseCampus(req.user as Identity) && (kind !== "showcase" || req.context.webShowcaseWrite === true),
      update: kind === "showcase" ? (args) => args.req.context.webShowcaseWrite === true ? (canPublish(args.req.user as Identity) || { game: { in: communityIDs(args.req.user as Identity, "reviewShowcase") } }) : false : moderatorWhere,
      delete: ({ req }) => canPublish(req.user as Identity) && (kind !== "showcase" || req.context.webShowcaseWrite === true),
    },
    hooks: { beforeChange: [participationGuard(kind), ...(kind === "local" ? [validateCommunitySchedule, validatePostImages, validatePublicationContent, validateSignupForm] : [])],
      afterChange: [promotionSourceChanged, queueTranslationAfterChange(kind === "local" ? "community-posts" : "community-showcase")], afterDelete: [promotionSourceDeleted, removeTranslationAfterDelete(kind === "local" ? "community-posts" : "community-showcase")] },
    fields,
  };
}

const bans: CollectionConfig = {
  slug: "community-bans", labels: { singular: "社群禁言", plural: "社群禁言" },
  access: { read: moderatorWhere, create: ({ req }) => canUseCampus(req.user as Identity) &&
    canSubmitClubContent(req.user as Identity),
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
  CommunityApplications, CommunityJoins, bans,
  social("community-showcase", "社群风采", "showcase"),
  social("community-posts", "社群活动与通知", "local"),
];
