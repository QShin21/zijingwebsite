import { APIError } from "payload";
import { normalizeShowcaseImage } from "./showcase-images";

export async function normalizeTeamProfileAvatar(value: string | null) {
  if (value === null) return null;
  try {
    // Existing image decoder strips metadata, rejects SVG/multi-page images,
    // and checks actual image bytes and dimensions before re-encoding.
    return await normalizeShowcaseImage(value);
  } catch {
    throw new APIError(
      "头像无效，请上传 2 MB 以内的静态 PNG、JPEG 或 WebP 图片",
      400,
    );
  }
}
