export type PublicationImage = {
  source: string;
  alt: string;
  questionId?: string;
  preview?: string;
};

export const publicationImageMegabytes = 10;
export const publicationImageBytes = publicationImageMegabytes * 1024 * 1024;
// The image endpoint accepts stored data URLs below 6,000,000 characters.
export const publicationImageStoredBytes = 4 * 1024 * 1024;
// Legacy documents can contain four inline 2 MiB images. New images upload individually.
export const publicationImageRequestBytes = 12 * 1024 * 1024;
export const publicationImageTypes = ["image/png", "image/jpeg", "image/webp"];

export function publicationAsset(source: string) {
  const match = /^asset:([1-9]\d*):([a-f0-9]{16})$/.exec(source);
  if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) > 2147483647) return null;
  return { id: Number(match[1]), version: match[2] };
}

export function publicationPreview(image: PublicationImage) {
  if (image.preview) return image.preview;
  const asset = publicationAsset(image.source);
  return asset ? `/api/v2/images/upload/${asset.id}/0?v=${asset.version}` : image.source;
}

export function publicationImages(value: unknown): PublicationImage[] {
  return Array.isArray(value) ? value : [];
}

export function publicationImageInput(images: PublicationImage[]) {
  return images.map(({ source, alt, questionId }) => ({ source, alt, ...(questionId ? { questionId } : {}) }));
}
