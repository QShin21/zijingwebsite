import type { TranslatableCollection } from "./segments";

/** Only the published, publicly listed state of a document is translated. */
export function publishedForTranslation(collection: TranslatableCollection, doc: Record<string, unknown> | null | undefined): boolean {
  if (!doc || typeof doc !== "object") return false;
  if (collection === "community-posts") return doc.status === "visible" && (doc.category === "event" || doc.category === "notice");
  if (collection === "community-showcase") return doc.status === "visible";
  if (collection === "team-honor-records") return doc.state === "approved";
  if (collection === "honors") return doc._status === "published" && doc.verified === true;
  if (collection === "staff-batches") return doc.state === "open" || doc.state === "closed";
  if (collection === "team-recruitments") return doc.status === "open" || doc.status === "closed";
  if (collection === "site") return true;
  // The privacy notice is legal text and stays Chinese only.
  if (collection === "pages") return doc._status === "published" && doc.key !== "privacy";
  return doc._status === "published";
}
