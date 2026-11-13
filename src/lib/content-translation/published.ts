import type { TranslatableCollection } from "./segments";

/** Only the published, publicly listed state of a document is translated. */
export function publishedForTranslation(collection: TranslatableCollection, doc: Record<string, unknown> | null | undefined): boolean {
  if (!doc || typeof doc !== "object") return false;
  if (collection === "community-posts") return doc.status === "visible" && (doc.category === "event" || doc.category === "notice");
  return doc._status === "published";
}
