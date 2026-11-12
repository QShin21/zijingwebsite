import sharp from "sharp";
export async function normalizeShowcaseImage(value: unknown, options: { limitInputPixels?: number; maxInputBytes?: number } = {}) {
  const maxInputBytes = options.maxInputBytes ?? 2 * 1024 * 1024;
  if (typeof value !== "string" || value.length > 23 + Math.ceil(maxInputBytes / 3) * 4 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) throw new Error("图片格式无效");
  const bytes = Buffer.from(value.split(",")[1], "base64");
  if (!bytes.length || bytes.length > maxInputBytes) throw new Error("图片大小超出限制");
  const result = await normalizeImageBytes(bytes, options);
  return `data:image/webp;base64,${result.toString("base64")}`;
}

export async function normalizeImageBytes(bytes: Buffer, options: { limitInputPixels?: number } = {}) {
  const picture = sharp(bytes, { limitInputPixels: options.limitInputPixels ?? 25_000_000 });
  const meta = await picture.metadata();
  if (!["png", "jpeg", "webp"].includes(meta.format || "") || (meta.pages || 1) !== 1) throw new Error("仅支持静态图片");
  return picture.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
}
