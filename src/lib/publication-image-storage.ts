import { createHash } from "node:crypto";
import { APIError, type PayloadRequest } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import { normalizeShowcaseImage } from "./showcase-images";
import {
  publicationImageBytes,
  publicationImageMegabytes,
  publicationImageStoredBytes,
  publicationAsset,
  publicationImages,
  type PublicationImage,
} from "./publication-images";

export async function normalizePublicationImages(
  value: unknown,
  previous: unknown,
  questionIds?: ReadonlySet<string>,
  req?: PayloadRequest,
) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new APIError("配图格式无效。", 400);

  const retained = new Set(publicationImages(previous).map(({ source }) => source));
  const images: PublicationImage[] = [];
  for (const image of value) {
    if (!image || typeof image.source !== "string" ||
        typeof image.alt !== "string" || image.alt.trim().length > 120)
      throw new APIError("请检查图片及图片说明，说明最多 120 字。", 400);
    const { source, alt, questionId } = image;
    if (questionId != null && (typeof questionId !== "string" || !questionIds?.has(questionId)))
      throw new APIError("配图关联的题目已删除，请重新选择展示位置。", 400);
    try {
      let normalized = source;
      const asset = publicationAsset(source);
      if (asset && !retained.has(source)) {
        if (!req?.user || !req.transactionID) throw new APIError("请重新上传图片。", 409);
        const db = req.payload.db as unknown as PostgresAdapter;
        const transactionID = await req.transactionID;
        const session = db.sessions[String(transactionID)];
        if (!session) throw new APIError("暂时无法安全保存图片。", 503);
        await session.db.execute(sql`SELECT id FROM pending_uploads WHERE id=${asset.id} FOR UPDATE`);
        const upload = await req.payload.findByID({ collection: "pending-uploads", id: asset.id, req, overrideAccess: false, depth: 0 }).catch(() => null);
        if (!upload || upload.purpose !== "publication" || upload.consumedAt || Date.parse(upload.expiresAt) <= Date.now() ||
          createHash("sha256").update(Buffer.from(upload.data.split(",")[1], "base64")).digest("hex").slice(0, 16) !== asset.version)
          throw new APIError("图片已使用或过期，请重新上传。", 409);
        await req.payload.update({ collection: "pending-uploads", id: asset.id,
          req: { ...req, context: { ...req.context, v2UploadConsume: true } }, overrideAccess: false,
          data: { consumedAt: new Date().toISOString() } });
      } else if (!asset && !retained.has(source)) {
        normalized = await normalizeShowcaseImage(source, { maxInputBytes: publicationImageBytes });
      }
      if (normalized.length > 23 + Math.ceil(publicationImageStoredBytes / 3) * 4)
        throw new Error("Normalized image exceeds storage limit");
      images.push({
        source: normalized,
        alt: alt.trim(),
        ...(questionId == null ? {} : { questionId }),
      });
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(`请上传 ${publicationImageMegabytes} MB 以内的静态 PNG、JPEG 或 WebP 图片。`, 400);
    }
  }
  return images;
}

export function publicationImageRevision(images: PublicationImage[]) {
  // JSONB can reorder object keys. The fingerprint follows only the displayed values.
  const values = images.map(({ source, alt, questionId }) => [source, alt, questionId ?? null]);
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}
