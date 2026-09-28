import sharp from "sharp";

export const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024;
export async function normalizeChatImage(value: unknown): Promise<string> {
  if (typeof value !== "string" || value.length > 11_200_000 || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) throw new Error("图片格式无效");
  const bytes = Buffer.from(value.split(",")[1], "base64");
  if (!bytes.length || bytes.length > MAX_CHAT_IMAGE_BYTES) throw new Error("图片请控制在 8 MB 以内");
  const meta = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  const pages = meta.pages || 1;
  if (!["png", "jpeg", "webp", "gif"].includes(meta.format || "") || pages > 150 || (meta.width || 0) * (meta.pageHeight || meta.height || 0) * pages > 40_000_000) throw new Error("图片尺寸或动画帧数过大");
  const max = pages > 1 ? 640 : 2048;
  const result = await sharp(bytes, { animated: true, limitInputPixels: 40_000_000 }).rotate()
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, effort: 3 }).toBuffer();
  if (result.length > 2 * 1024 * 1024) throw new Error("压缩后的图片仍超过 2 MB，请选择更小的图片");
  return `data:image/webp;base64,${result.toString("base64")}`;
}
