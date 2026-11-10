import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import { APIError, type CollectionAfterChangeHook, type CollectionAfterDeleteHook, type Payload, type PayloadRequest } from "payload";
import type { ContentPromotion, User } from "../payload-types";
import { canReviewPromotion, managesGame, relationID } from "./rules";
import { workflowTransaction } from "./workflow-transactions";
import { controlledVideoVersion } from "./showcase-videos";
import { publicationImages } from "./publication-images";
import { publicationImageRevision } from "./publication-image-storage";
import { promotionKey, promotionSource, promotionVersion, supportedPromotionKinds, type PromotionAction, type PromotionHistory, type PromotionKind, type PromotionSnapshot, type PromotionSource } from "./promotion-model";

export async function readPromotionSource(p: Payload, collection: PromotionSource, id: number, req?: PayloadRequest) {
  const common = { title: true, body: true, game: true, status: true, authorName: true } as const;
  const doc = await p.findByID({ collection, id, overrideAccess: false, user: null,
    ...(req ? { req: { ...req, user: null } } : {}), depth: 0,
    context: { ...req?.context, readSignupImages: true },
    select: collection === "community-posts"
      ? { ...common, category: true, signupForm: true, postImages: true, signupImages: true }
      : { ...common, images: true, videoURL: true } }).catch(() => null);
  if (!doc || doc.status !== "visible") throw new APIError("原内容尚未发布或已隐藏", 409);
  const kind: PromotionKind = collection === "community-showcase" ? "showcase" : ("category" in doc && doc.category === "event" ? "event" : "notice");
  if (!supportedPromotionKinds.includes(kind)) throw new APIError("该类升推尚未开放", 400);
  const gameID = Number(relationID(doc.game));
  const game = await p.findByID({ collection: "games", id: gameID, overrideAccess: false, user: null,
    ...(req ? { req: { ...req, user: null } } : {}), draft: false, depth: 0, select: { title: true, slug: true, _status: true } }).catch(() => null);
  if (!game || game._status !== "published") throw new APIError("原社群尚未开放", 409);
  const videoURL = "videoURL" in doc ? doc.videoURL || null : null;
  const videoVersion = videoURL ? await controlledVideoVersion(videoURL) : null;
  const value = { ...doc, game: gameID, videoVersion } as unknown as Record<string, unknown>;
  if ("category" in doc) {
    const postImages = publicationImages(doc.postImages);
    const signupImages = publicationImages(doc.signupImages);
    if (postImages.length || signupImages.length)
      value.images = [publicationImageRevision(postImages), publicationImageRevision(signupImages)];
  }
  const snapshot: PromotionSnapshot = { title: doc.title, body: doc.body ?? "", authorName: doc.authorName ?? "", kind, game: gameID, videoURL, videoVersion };
  return { collection, doc, game, kind, version: promotionVersion(value), snapshot,
    href: "/community/" + game.slug + (collection === "community-posts" ? "/updates/" + doc.id : "/showcase/" + doc.id) };
}
async function lockPromotion(req: PayloadRequest, key: string) {
  const db = req.payload.db as unknown as PostgresAdapter;
  const transactionID = await req.transactionID;
  const session = transactionID != null ? db.sessions[String(transactionID)] : null;
  if (!session) throw new APIError("无法安全保存升推，请刷新重试", 503);
  await session.db.execute(sql`SELECT id FROM content_promotions WHERE source_key=${key} FOR UPDATE`);
}
async function lockSource(req: PayloadRequest, collection: PromotionSource, id: number) {
  const db = req.payload.db as unknown as PostgresAdapter, transactionID = await req.transactionID;
  const session = transactionID != null ? db.sessions[String(transactionID)] : null;
  if (!session) throw new APIError("无法安全保存升推，请刷新重试", 503);
  // Same order as source writes: source row, then its promotion row.
  await session.db.execute(collection === "community-posts" ? sql`SELECT id FROM community_posts WHERE id=${id} FOR SHARE`
    : sql`SELECT id FROM community_showcase WHERE id=${id} FOR SHARE`);
}
function historyOf(doc?: ContentPromotion) {
  return Array.isArray(doc?.history) ? doc.history as unknown as PromotionHistory[] : [];
}
function reasonFor(value: unknown, minimum: number) {
  const reason = String(value ?? "").trim();
  if (reason.length < minimum || reason.length > 1000) throw new APIError("请填写 " + minimum + "–1000 字的具体理由", 400);
  return reason;
}
export async function changePromotion(p: Payload, actor: User | null, collectionValue: unknown, id: number, action: PromotionAction,
  options: { revision?: unknown; sourceVersion?: unknown; reason?: unknown } = {}) {
  const collection = promotionSource(collectionValue), key = promotionKey(collection, id);
  return workflowTransaction(p, actor, { promotionWrite: true, promotionAction: action }, async req => {
    const user = req.user as User;
    if (!["submit", "withdraw"].includes(action) && !canReviewPromotion(user)) throw new APIError("无权审核或升推", 403);
    await lockSource(req, collection, id);
    await lockPromotion(req, key);
    const current = (await p.find({ collection: "content-promotions", req, overrideAccess: false, depth: 0, limit: 1, where: { sourceKey: { equals: key } } })).docs[0];
    const source = ["submit", "approve", "promote"].includes(action) ? await readPromotionSource(p, collection, id, req)
      : await readPromotionSource(p, collection, id, req).catch(() => null);
    if (["submit", "withdraw"].includes(action) && !managesGame(user, source?.game.id ?? current?.game)) throw new APIError("仅对应社群管理员可申请或撤回", 403);
    if (current && options.revision !== current.updatedAt) throw new APIError("升推记录已更新，请刷新后核对", 409);
    if (!current && options.revision) throw new APIError("升推记录不存在，请刷新", 409);
    const reason = reasonFor(options.reason, action === "submit" ? 5 : ["return", "reject", "promote", "demote"].includes(action) ? 1 : 0);
    const data: Partial<ContentPromotion> = { kind: source?.kind ?? current?.kind ?? "event" };
    if (action === "submit") {
      if (current && ["pending", "approved"].includes(current.status)) throw new APIError("内容已经待审或升推，请查看当前状态", 409);
      if (!source || options.sourceVersion !== source.version) throw new APIError("原内容已修改，请刷新后申请", 409);
      Object.assign(data, { status: "pending", requestedBy: user.id, reason, requestedVersion: source.version, requestedSnapshot: source.snapshot, reviewNote: null });
    } else if (action === "withdraw") {
      if (!current || current.status !== "pending" || Number(relationID(current.requestedBy)) !== user.id) throw new APIError("仅申请人可撤回自己的待审升推", 409);
      data.status = "withdrawn";
    } else if (["approve", "return", "reject"].includes(action)) {
      if (!current || current.status !== "pending") throw new APIError("此申请已处理，请刷新", 409);
      if (action === "approve" && (!source || current.requestedVersion !== source.version || options.sourceVersion !== current.requestedVersion)) throw new APIError("原内容已修改，请退回并重新申请", 409);
      Object.assign(data, { status: action === "approve" ? "approved" : action === "return" ? "returned" : "rejected", reviewNote: reason });
    } else if (action === "promote") {
      if (current?.status === "approved") throw new APIError("内容已升推", 409);
      if (!source || options.sourceVersion !== source.version) throw new APIError("原内容已修改，请刷新后升推", 409);
      Object.assign(data, { status: "approved", requestedBy: current?.requestedBy ?? user.id, reason: current?.reason ?? reason,
        requestedVersion: source.version, requestedSnapshot: source.snapshot, reviewNote: reason });
    } else if (action === "demote") {
      if (!current || current.status !== "approved") throw new APIError("仅已升推内容可降级", 409);
      Object.assign(data, { status: "demoted", reviewNote: reason });
    } else throw new APIError("升推操作无效", 400);
    if (data.status === "approved") {
      if (!source) throw new APIError("原内容不可升推", 409);
      Object.assign(data, { approvedVersion: source.version, approvedSnapshot: source.snapshot, approvedBy: user.id, approvedAt: new Date().toISOString() });
    }
    const entry: PromotionHistory = { action, actor: String(user.id), actorName: user.name ?? "管理员", at: new Date().toISOString(),
      from: current?.status ?? "new", to: data.status!, reason, version: source?.version ?? current?.requestedVersion ?? "" };
    data.history = [...historyOf(current), entry];
    const saved = current ? await p.update({ collection: "content-promotions", id: current.id, req, overrideAccess: false, data })
      : await p.create({ collection: "content-promotions", req, overrideAccess: false, data: { ...data, sourceCollection: collection, sourceID: id, sourceKey: key, game: source!.game.id, status: data.status!, kind: source!.kind } });
    await p.create({ collection: "audit", req, overrideAccess: true, data: { actor: String(user.id), object: "content-promotions:" + saved.id, action: action + ":" + entry.from + "->" + entry.to, status: saved.status } });
    return saved;
  });
}
async function sourceChanged(req: PayloadRequest, collection: PromotionSource, id: number, deleted = false) {
  const key = promotionKey(collection, id);
  await lockPromotion(req, key);
  const current = (await req.payload.find({ collection: "content-promotions", req, overrideAccess: true, depth: 0, limit: 1,
    where: { and: [{ sourceKey: { equals: key } }, { status: { in: ["pending", "approved"] } }] } })).docs[0];
  if (!current) return;
  if (!deleted) {
    const source = await readPromotionSource(req.payload, collection, id, req).catch(() => null);
    const reviewedVersion = current.status === "approved" ? current.approvedVersion : current.requestedVersion;
    if (source && source.version === reviewedVersion) return;
  }
  const status = current.status === "approved" ? "needsReview" : "returned";
  const reason = deleted ? "原内容已删除，社团级展示已撤下。" : "原内容已修改或隐藏，社团级展示已撤下；请重新申请复审。";
  const entry: PromotionHistory = { action: deleted ? "sourceDeleted" : "sourceChanged", actor: String(req.user?.id ?? "system"), actorName: req.user?.name ?? "系统", at: new Date().toISOString(),
    from: current.status, to: status, reason, version: current.approvedVersion ?? current.requestedVersion ?? "" };
  await req.payload.update({ collection: "content-promotions", id: current.id, req: { ...req, context: { ...req.context, promotionWrite: true, promotionSourceChanged: true } },
    overrideAccess: true, data: { status, reviewNote: reason, history: [...historyOf(current), entry] } });
  await req.payload.create({ collection: "audit", req, overrideAccess: true, data: { actor: entry.actor, object: "content-promotions:" + current.id, action: entry.action + ":" + entry.from + "->" + entry.to, status } });
}
export const promotionSourceChanged: CollectionAfterChangeHook = async ({ req, doc, collection, operation }) => {
  if (operation === "update") await sourceChanged(req, promotionSource(collection.slug), doc.id);
  return doc;
};
export const promotionSourceDeleted: CollectionAfterDeleteHook = async ({ req, doc, collection }) => {
  await sourceChanged(req, promotionSource(collection.slug), doc.id, true);
  return doc;
};
export async function promotedContent(p: Payload, kind: PromotionKind, limit = 6) {
  if (!supportedPromotionKinds.includes(kind) || limit <= 0) return [];
  const items: { id: number; sourceKey: string; href: string; gameTitle: string; snapshot: PromotionSnapshot }[] = [];
  // Keep reads bounded even when the directory requests every approved item.
  for (let page = 1; items.length < limit; page++) {
    const result = await p.find({ collection: "content-promotions", overrideAccess: false, user: null, context: { publicPromotionProjection: true },
      depth: 0, page, limit: 20, sort: ["-approvedAt", "-id"], where: { and: [{ kind: { equals: kind } }, { status: { equals: "approved" } }] },
      select: { sourceCollection: true, sourceID: true, approvedVersion: true, approvedSnapshot: true } });
    const candidates = await Promise.all(result.docs.map(async item => {
      const source = await readPromotionSource(p, promotionSource(item.sourceCollection), item.sourceID).catch(() => null);
      if (!source || source.version !== item.approvedVersion || source.kind !== kind || !item.approvedSnapshot) return null;
      return { id: item.id, sourceKey: promotionKey(item.sourceCollection, item.sourceID), href: source.href, gameTitle: source.game.title,
        snapshot: item.approvedSnapshot as unknown as PromotionSnapshot };
    }));
    items.push(...candidates.filter(item => item !== null).slice(0, limit - items.length));
    if (!result.hasNextPage || !result.docs.length) break;
  }
  return items;
}
