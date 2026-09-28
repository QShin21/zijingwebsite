import sharp from "sharp";
export async function normalizeShowcaseImage(value: unknown) {
  if (typeof value !== "string" || value.length > 2_800_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) throw new Error("图片格式无效");
  const bytes = Buffer.from(value.split(",")[1], "base64");
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error("单张图片不得超过 2 MB");
  const picture = sharp(bytes, { limitInputPixels: 25_000_000 });
  const meta = await picture.metadata();
  if (!["png", "jpeg", "webp"].includes(meta.format || "") || (meta.pages || 1) !== 1) throw new Error("仅支持静态图片");
  const result = await picture.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  return `data:image/webp;base64,${result.toString("base64")}`;
}
