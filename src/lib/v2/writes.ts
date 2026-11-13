import sharp from "sharp";
import { APIError, type Payload, type PayloadRequest } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import type { CommunityShowcase, User } from "../../payload-types";
import type { ShowcaseCard, UploadReceipt } from "./types";
import { requireCampusViewer } from "./identity";
import { controlledImageRef } from "./images";
import { showcaseCard } from "./community";
import { canReviewShowcase, relationID } from "../rules";
import { normalizeShowcaseImage } from "../showcase-images";
import { communityVideo } from "../community-video";
import { workflowTransaction } from "../workflow-transactions";
import { publicationImageBytes } from "../publication-images";

const text = (value: unknown, max: number, label: string, required = false) => {
  if (value != null && typeof value !== "string") throw new APIError(`${label}无效`, 400);
  const result = typeof value === "string" ? value.trim() : "";
  if ((required && !result) || result.length > max) throw new APIError(`${label}${required ? "需填写且" : ""}最多 ${max} 字`, 400);
  return result;
};
function identifier(value: unknown) {
  const id = typeof value === "number" || typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 0;
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new APIError("内容不可访问", 404);
  return id;
}
async function session(p: Payload, req: PayloadRequest) {
  const db = p.db as unknown as PostgresAdapter, transactionID = await req.transactionID;
  const connection = transactionID != null ? db.sessions[String(transactionID)] : null;
  if (!connection) throw new APIError("暂时无法安全保存，请稍后重试", 503);
  return connection.db;
}

export async function createUpload(
  p: Payload,
  viewer: User | null,
  input: { file: unknown; purpose: unknown },
): Promise<{ upload: UploadReceipt }> {
  const actor = await requireCampusViewer(p, viewer);
  if (input.purpose !== "showcase" && input.purpose !== "publication") throw new APIError("上传用途无效", 400);
  const purpose = input.purpose;
  const file = input.file;
  if (!(file instanceof File) || !file.size) throw new APIError("请选择一张图片", 400);
  const maxBytes = purpose === "publication" ? publicationImageBytes : 2 * 1024 * 1024;
  if (file.size > maxBytes) throw new APIError(`单张图片不得超过 ${maxBytes / 1024 / 1024} MB`, 413);
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new APIError("仅支持静态 PNG、JPEG 或 WebP 图片", 415);
  const bytes = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata().catch(() => null);
  if (!metadata) throw new APIError("图片无效或超过 4000 万像素", 400);
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1)
    throw new APIError("仅支持静态 PNG、JPEG 或 WebP 图片", 415);
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000)
    throw new APIError("图片不得超过 4000 万像素", 400);
  const data = await normalizeShowcaseImage(`data:${file.type};base64,${bytes.toString("base64")}`, { limitInputPixels: 40_000_000, maxInputBytes: maxBytes })
    .catch(() => { throw new APIError("图片处理失败，请选择有效的静态图片", 400); });
  const normalized = await sharp(Buffer.from(data.slice(data.indexOf(",") + 1), "base64")).metadata();
  const upload = await workflowTransaction(p, actor, { v2UploadWrite: true }, async req => {
    // Cleanup is confined to expired temporary records, with access still on.
    await p.delete({ collection: "pending-uploads", req: { ...req, context: { ...req.context, v2UploadCleanup: true } },
      overrideAccess: false, where: { and: [{ expiresAt: { less_than_equal: new Date().toISOString() } }, { consumedAt: { exists: false } }] } });
    return p.create({ collection: "pending-uploads", req, overrideAccess: false, data: {
      owner: req.user!.id as number, purpose, data, width: normalized.width!, height: normalized.height!,
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    } });
  });
  return { upload: { id: upload.id, purpose, width: upload.width, height: upload.height, expiresAt: upload.expiresAt,
    preview: controlledImageRef("upload", upload.id, 0, upload.data, "待提交的风采图片", upload)! } };
}

type ShowcaseInput = { title: unknown; body?: unknown; videoURL?: unknown };
function showcaseContent(input: ShowcaseInput) {
  const title = text(input.title, 120, "标题", true), body = text(input.body, 5000, "正文"), videoURL = text(input.videoURL, 2000, "视频链接");
  if (videoURL && !communityVideo(videoURL)) throw new APIError("请填写有效的 HTTPS 视频链接或 B 站嵌入代码", 400);
  return { title, body, videoURL };
}

async function saveShowcase(p: Payload, req: PayloadRequest, game: number, content: ReturnType<typeof showcaseContent>, images: { source: string; caption: string }[]) {
  return p.create({ collection: "community-showcase", req, overrideAccess: false,
    data: { game, author: req.user!.id as number, ...content, images } });
}

/** Website upload adapter and V2 uploads converge on the same guarded write. */
export async function submitShowcase(
  p: Payload,
  viewer: User | null,
  input: ShowcaseInput & { game: number; images: { source: string; caption: string }[] },
) {
  const content = showcaseContent(input);
  if (!Array.isArray(input.images) || input.images.length > 6) throw new APIError("最多上传 6 张照片", 400);
  return workflowTransaction(p, viewer, { webShowcaseWrite: true }, req => saveShowcase(p, req, identifier(input.game), content, input.images));
}

export async function createShowcase(
  p: Payload,
  viewer: User | null,
  input: ShowcaseInput & { slug: string; images: unknown },
): Promise<{ showcase: ShowcaseCard }> {
  const actor = await requireCampusViewer(p, viewer), content = showcaseContent(input);
  if (!Array.isArray(input.images) || input.images.length > 6) throw new APIError("最多上传 6 张照片", 400);
  const images = input.images.map(value => {
    if (!value || typeof value !== "object" || !("upload" in value)) throw new APIError("图片信息无效", 400);
    return { upload: identifier(value.upload), caption: text("caption" in value ? value.caption : undefined, 200, "图片说明") };
  });
  if (new Set(images.map(image => image.upload)).size !== images.length) throw new APIError("同一图片不能重复使用", 409);
  const saved = await workflowTransaction(p, actor, { webShowcaseWrite: true }, async req => {
    const games = await p.find({ collection: "games", req: { ...req, user: null }, user: null, overrideAccess: false, depth: 0, draft: false,
      limit: 1, where: { slug: { equals: input.slug } }, select: { _status: true, demo: true } });
    const game = games.docs[0];
    if (!game || game._status !== "published" || process.env.APP_ENV === "production" && game.demo) throw new APIError("社群不可访问", 404);
    const db = await session(p, req);
    // Deterministic row locks plus serializable transaction prevent double use.
    for (const id of images.map(image => image.upload).sort((a, b) => a - b))
      await db.execute(sql`SELECT id FROM pending_uploads WHERE id=${id} FOR UPDATE`);
    const sources: { source: string; caption: string }[] = [];
    for (const image of images) {
      const upload = await p.findByID({ collection: "pending-uploads", id: image.upload, req, overrideAccess: false, depth: 0,
        select: { owner: true, purpose: true, data: true, expiresAt: true, consumedAt: true } }).catch(() => null);
      if (!upload || Number(relationID(upload.owner)) !== req.user!.id || upload.purpose !== "showcase" ||
        upload.consumedAt || Date.parse(upload.expiresAt) <= Date.now()) throw new APIError("图片已使用或过期，请重新上传", 409);
      sources.push({ source: upload.data, caption: image.caption });
    }
    const post = await saveShowcase(p, req, game.id, content, sources);
    for (const image of images) await p.update({ collection: "pending-uploads", id: image.upload,
      req: { ...req, context: { ...req.context, v2UploadConsume: true } }, overrideAccess: false,
      data: { consumedAt: new Date().toISOString() } });
    return post;
  });
  return { showcase: await showcaseCard(p, actor, saved as unknown as Record<string, unknown> & { id: number }) };
}

export async function reviewShowcase(
  p: Payload,
  viewer: User | null,
  input: { id: number; decision: unknown; reviewNote?: unknown; revision: unknown },
): Promise<{ showcase: ShowcaseCard }> {
  const actor = await requireCampusViewer(p, viewer), id = identifier(input.id);
  if (!["visible", "rejected", "hidden"].includes(String(input.decision))) throw new APIError("审核决定无效", 400);
  const decision = input.decision as "visible" | "rejected" | "hidden", reviewNote = text(input.reviewNote, 500, "审核说明");
  if (decision !== "visible" && !reviewNote) throw new APIError("拒绝或隐藏需填写具体原因", 400);
  const saved = await workflowTransaction(p, actor, { webShowcaseWrite: true }, async req => {
    const db = await session(p, req);
    await db.execute(sql`SELECT id FROM community_showcase WHERE id=${id} FOR UPDATE`);
    const post = await p.findByID({ collection: "community-showcase", id, req, overrideAccess: false, depth: 0,
      select: { game: true, updatedAt: true } }).catch(() => null);
    if (!post || !canReviewShowcase(req.user, post.game)) throw new APIError("内容不可访问", 404);
    if (typeof input.revision !== "string" || input.revision !== post.updatedAt) throw new APIError("风采已更新，请刷新后核对", 409);
    return p.update({ collection: "community-showcase", id, req, overrideAccess: false, data: { status: decision, reviewNote } });
  });
  return { showcase: await showcaseCard(p, actor, saved as unknown as CommunityShowcase & Record<string, unknown>) };
}
