export type IconCrop = { x: number; y: number; zoom: number };
export const defaultIconCrop: IconCrop = { x: 50, y: 50, zoom: 1 };
export const communityIconMaxBytes = 4 * 1024 * 1024;
export const communityIconTypes = ["image/png", "image/jpeg", "image/webp"];

export function validIconCrop(value: unknown): value is IconCrop {
  if (!value || typeof value !== "object") return false;
  const crop = value as IconCrop;
  return (
    [crop.x, crop.y, crop.zoom].every(Number.isFinite) &&
    crop.x >= 0 &&
    crop.x <= 100 &&
    crop.y >= 0 &&
    crop.y <= 100 &&
    crop.zoom >= 1 &&
    crop.zoom <= 4
  );
}
export function iconCropRect(width: number, height: number, crop: IconCrop) {
  const size = Math.max(1, Math.floor(Math.min(width, height) / crop.zoom));
  return {
    left: Math.round(((width - size) * crop.x) / 100),
    top: Math.round(((height - size) * crop.y) / 100),
    width: size,
    height: size,
  };
}
