import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from "payload";
import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import type { TranslatableCollection } from "./segments";
import { publishedForTranslation } from "./published";
import { translationAvailability } from "./translator";

export { publishedForTranslation };

/**
 * Runs queue SQL with the request's open transaction (or the adapter outside one). Inside a
 * transaction a savepoint isolates queue errors (e.g. table not migrated yet), so the
 * document write itself can never be aborted by the translation feature.
 */
async function withExecutor(req: PayloadRequest, work: (executor: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) => Promise<void>) {
  const adapter = req.payload.db as unknown as PostgresAdapter;
  const transactionID = await req.transactionID;
  const session = transactionID != null ? adapter.sessions?.[String(transactionID)] : null;
  if (!session) return work(adapter.drizzle as never);
  const executor = session.db as unknown as { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };
  await executor.execute(sql`SAVEPOINT content_translation_queue`);
  try {
    await work(executor);
    await executor.execute(sql`RELEASE SAVEPOINT content_translation_queue`);
  } catch (error) {
    await executor.execute(sql`ROLLBACK TO SAVEPOINT content_translation_queue`);
    throw error;
  }
}

/**
 * Publish/edit/unpublish trigger. The queue marker is written with the same transaction
 * as the document, so it commits or rolls back with it; nothing is sent to the provider
 * here. The worker later re-reads the committed published document. A queue failure is
 * logged by code only and never blocks or fails the write.
 */
export function queueTranslationAfterChange(collection: TranslatableCollection): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, req }) => {
    if (req.context?.skipTranslation === true || translationAvailability() !== "enabled") return doc;
    // Drafts of never-published documents create no work; unpublishing an item does,
    // so its English is withdrawn.
    if (!publishedForTranslation(collection, doc) && !publishedForTranslation(collection, previousDoc)) return doc;
    try {
      const { markTranslation, kickTranslationQueue } = await import("./store");
      await withExecutor(req, (executor) => markTranslation(executor, collection, Number(doc.id)));
      // The row becomes visible after commit; the kick only shortens the wait (the
      // per-process sweep and later kicks pick up anything missed).
      setTimeout(() => kickTranslationQueue(0), 1500).unref?.();
    } catch {
      console.warn("Content translation queue unavailable", collection);
    }
    return doc;
  };
}

export function removeTranslationAfterDelete(collection: TranslatableCollection): CollectionAfterDeleteHook {
  return async ({ id, req }) => {
    try {
      const { dropTranslation } = await import("./store");
      await withExecutor(req, (executor) => dropTranslation(executor, collection, Number(id)));
    } catch {
      /* Orphan rows are harmless: overlays only apply to documents the reader can see. */
    }
  };
}
