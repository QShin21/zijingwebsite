import { createHash } from "node:crypto";
import { APIError } from "payload";
import { normalizeShowcaseImage } from "./showcase-images";
import {
  publicationImageLimit,
  publicationImageBytes,
  publicationImages,
  type PublicationImage,
} from "./publication-images";

export async function normalizePublicationImages(
  value: unknown,
  previous: unknown,
  questionIds?: ReadonlySet<string>,
) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > publicationImageLimit)
    throw new APIError(`最多上传 ${publicationImageLimit} 张图片。`, 400);

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
      const normalized = retained.has(source) ? source : await normalizeShowcaseImage(source);
      if (normalized.length > 23 + Math.ceil(publicationImageBytes / 3) * 4)
        throw new Error("Normalized image exceeds storage limit");
      images.push({
        source: normalized,
        alt: alt.trim(),
        ...(questionId == null ? {} : { questionId }),
      });
    } catch {
      throw new APIError("请上传 2 MB 以内的静态 PNG、JPEG 或 WebP 图片。", 400);
    }
  }
  return images;
}

export function publicationImageRevision(images: PublicationImage[]) {
  // JSONB can reorder object keys. The fingerprint follows only the displayed values.
  const values = images.map(({ source, alt, questionId }) => [source, alt, questionId ?? null]);
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}
