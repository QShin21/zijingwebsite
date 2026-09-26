import sharp from "sharp";

export const validApplicantName = (value: string) =>
  value.length >= 1 && value.length <= 80 && !/[\p{Cc}]/u.test(value);
export const validApplicantPhone = (value: string) =>
  /^\+?[0-9]{6,20}$/.test(value);

// Keep contact QR images inside the access-controlled application, never public media.
export async function normalizeWechatQr(value: unknown): Promise<string> {
  if (
    typeof value !== "string" ||
    value.length > 2_800_000 ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  )
    throw new Error("请上传 2 MB 以内的 PNG、JPEG 或 WebP 微信名片二维码");
  const input = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
  if (!input.length || input.length > 2 * 1024 * 1024)
    throw new Error("二维码图片不得超过 2 MB");
  const picture = sharp(input, { limitInputPixels: 16_000_000 });
  const meta = await picture.metadata();
  if (
    !["png", "jpeg", "webp"].includes(meta.format ?? "") ||
    (meta.pages ?? 1) !== 1
  )
    throw new Error("请上传静态 PNG、JPEG 或 WebP 图片");
  const png = await picture
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
