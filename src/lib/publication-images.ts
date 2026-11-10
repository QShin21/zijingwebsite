export type PublicationImage = {
  source: string;
  alt: string;
  questionId?: string;
};

export const publicationImageLimit = 4;
export const publicationImageBytes = 2 * 1024 * 1024;
export const publicationImageTypes = ["image/png", "image/jpeg", "image/webp"];

export function publicationImages(value: unknown): PublicationImage[] {
  return Array.isArray(value) ? value : [];
}
