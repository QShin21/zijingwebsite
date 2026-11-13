import { createHmac, randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { Payload } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { Overlay, sourceHash, sourceTexts, textHash, translatableCollections, type TranslatableCollection, type TranslationTable } from "./segments";
import { TranslationError, translateWithQuestionnaireAI, translationAvailability, type Translator } from "./translator";
import { publishedForTranslation } from "./published";

/*
 * Translation queue and cache (table content_translations, migration
 * 20261113_000900_content_translations). One row per document and locale.
 *
 * Durability: the publish/edit/unpublish hook bumps `generation` inside the same database
 * transaction as the document write (see hooks.ts), so a rolled-back write leaves no work
 * and a committed one cannot lose its marker when the process exits.
 *
 * Freshness: rows never hold source text. Each claim re-reads the *committed, published*
 * document immediately before the provider call. Unpublished, hidden or deleted documents
 * become `obsolete` (translations cleared) without any provider call.
 *
 * Ownership: a claim sets a random lease token. One claim performs at most one provider
 * batch (60 s timeout) under a 3-minute lease, then writes back only if it still owns the
 * lease. A publish during processing bumps the generation, which sends the row back to
 * `pending` after the owner finishes, so the next claim sees the newest source.
 *
 * Cost: rows are created only by publish hooks or the explicit backfill. Readers never
 * create work. Every provider call takes one slot of a site-wide hourly budget, attempts
 * per generation are bounded, and failures leave Chinese.
 */
export const translationLocale = "en";
export const maxAttempts = 3;
export const hourlyCallBudget = 120;
export const leaseSeconds = 180;
const batchCharacters = 4000;
const batchItems = 40;

let pool: Pool | null = null;
function db(): Pool {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return pool;
}
/** Tests close the pool between isolated databases. */
export async function closeTranslationPool() {
  stopTranslationTimer();
  const current = pool;
  pool = null;
  await current?.end();
}

export type QueueRow = {
  id: number; collection: TranslatableCollection; doc_id: number; generation: number; status: string; attempts: number;
  source_hash: string | null; translations: TranslationTable; error_code: string | null; lease_token: string | null;
};
const columns = "id, collection, doc_id, generation, status, attempts, source_hash, translations, error_code, lease_token";

export async function readQueueRow(collection: TranslatableCollection, id: number): Promise<QueueRow | null> {
  const result = await db().query<QueueRow>(`SELECT ${columns} FROM content_translations WHERE collection = $1 AND doc_id = $2 AND locale = $3`, [collection, id, translationLocale]);
  return result.rows[0] ?? null;
}

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };
/**
 * Marks a document for (re)translation. Called with the transaction executor of the
 * document write; a single atomic upsert, so concurrent enqueues only bump the generation
 * and never reset a live lease.
 */
export async function markTranslation(executor: Executor, collection: TranslatableCollection, id: number) {
  await executor.execute(sql`
    INSERT INTO content_translations (collection, doc_id, locale, generation, status, next_attempt_at)
    VALUES (${collection}, ${id}, ${translationLocale}, 1, 'pending', now())
    ON CONFLICT (collection, doc_id, locale) DO UPDATE SET
      generation = content_translations.generation + 1,
      status = CASE WHEN content_translations.status = 'processing' AND content_translations.lease_until > now() THEN 'processing' ELSE 'pending' END,
      attempts = 0, next_attempt_at = now(), error_code = NULL, updated_at = now()`);
}
export async function dropTranslation(executor: Executor, collection: TranslatableCollection, id: number) {
  await executor.execute(sql`DELETE FROM content_translations WHERE collection = ${collection} AND doc_id = ${id}`);
}

async function reserveCall(): Promise<boolean> {
  const key = createHmac("sha256", process.env.PAYLOAD_SECRET || "missing").update("content-translation:site").digest("hex");
  const result = await db().query<{ hits: number }>(
    `INSERT INTO auth_rate_limits (key, window_start, hits) VALUES ($1, now(), 1) ON CONFLICT (key) DO UPDATE SET hits = CASE WHEN auth_rate_limits.window_start < now() - interval '1 hour' THEN 1 ELSE auth_rate_limits.hits + 1 END, window_start = CASE WHEN auth_rate_limits.window_start < now() - interval '1 hour' THEN now() ELSE auth_rate_limits.window_start END RETURNING hits`,
    [key],
  );
  return Number(result.rows[0].hits) <= hourlyCallBudget;
}

/**
 * A worker that crashed after its last allowed claim leaves `processing` with an expired
 * lease and no attempts left. Such rows are closed as `failed` (English stays Chinese)
 * instead of staying `processing` forever. Returns the number of rows closed.
 */
export async function expireExhaustedLeases(): Promise<number> {
  const result = await db().query(
    `UPDATE content_translations SET status = 'failed', lease_token = NULL, lease_until = NULL,
       error_code = 'lease_expired', updated_at = now()
     WHERE locale = $1 AND status = 'processing' AND lease_until < now() AND attempts >= $2`,
    [translationLocale, maxAttempts],
  );
  return result.rowCount ?? 0;
}

async function claim(): Promise<QueueRow | null> {
  await expireExhaustedLeases();
  const token = randomUUID();
  const result = await db().query<QueueRow>(
    `UPDATE content_translations SET status = 'processing', lease_token = $3, lease_until = now() + make_interval(secs => $4),
       attempts = attempts + 1, updated_at = now()
     WHERE id = (SELECT id FROM content_translations WHERE locale = $1 AND attempts < $2 AND
       ((status = 'pending' AND next_attempt_at <= now()) OR (status = 'processing' AND lease_until < now()))
       ORDER BY next_attempt_at, id LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING ${columns}`,
    [translationLocale, maxAttempts, token, leaseSeconds],
  );
  return result.rows[0] ?? null;
}

/** Only the current lease owner writes; returns false when the lease was lost. */
async function finish(row: QueueRow, values: { translations: TranslationTable; sourceHash: string | null; outcome: "done" | "more" | "error" | "budget" | "obsolete"; error?: string | null }) {
  const result = await db().query(
    `UPDATE content_translations SET translations = $3::jsonb, source_hash = $4,
       status = CASE
         WHEN generation <> $5 THEN 'pending'
         WHEN $6 = 'done' THEN 'done'
         WHEN $6 = 'obsolete' THEN 'obsolete'
         WHEN $6 = 'error' AND attempts >= $7 THEN 'failed'
         ELSE 'pending' END,
       attempts = CASE WHEN generation <> $5 OR $6 = 'more' THEN 0 WHEN $6 = 'budget' THEN greatest(attempts - 1, 0) ELSE attempts END,
       next_attempt_at = CASE
         WHEN generation <> $5 OR $6 = 'more' THEN now()
         WHEN $6 = 'budget' THEN now() + interval '15 minutes'
         WHEN $6 = 'error' THEN now() + make_interval(mins => 2 * power(4, attempts)::int)
         ELSE now() END,
       lease_token = NULL, lease_until = NULL, error_code = $8, updated_at = now()
     WHERE id = $1 AND lease_token = $2`,
    [row.id, row.lease_token, JSON.stringify(values.translations), values.sourceHash, row.generation, values.outcome, maxAttempts, values.error ?? null],
  );
  return (result.rowCount ?? 0) === 1;
}

const selects: Record<TranslatableCollection, Record<string, true>> = {
  events: { title: true, summary: true, location: true, body: true, requirements: true, channelText: true, signupForm: true, _status: true },
  announcements: { title: true, summary: true, body: true, _status: true },
  "community-posts": { title: true, summary: true, location: true, body: true, contentMode: true, contentBlocks: true, signupForm: true, status: true, category: true },
};

/**
 * The committed, published state of a document (no request user, no draft).
 * Returns null only when the document is missing (`disableErrors` covers not-found) or
 * not published/visible. Database or other read failures throw, so the caller retries
 * instead of treating a temporary fault as an unpublish.
 */
export async function publishedSource(p: Payload, collection: TranslatableCollection, id: number): Promise<Record<string, unknown> | null> {
  const doc = await p.findByID({ collection, id, overrideAccess: true, draft: false, depth: 0, disableErrors: true, select: selects[collection] as never });
  return doc && publishedForTranslation(collection, doc as Record<string, unknown>) ? (doc as Record<string, unknown>) : null;
}

function firstBatch(texts: string[]) {
  const batch: Record<string, string> = {};
  let size = 0, count = 0;
  for (const text of texts) {
    if (count && (size + text.length > batchCharacters || count >= batchItems)) break;
    batch[textHash(text)] = text;
    size += text.length;
    count++;
  }
  return batch;
}

export type WorkResult = { translated: number; outcome: string; error: string | null; owned: boolean };
async function work(p: Payload, row: QueueRow, translate: Translator, signal?: AbortSignal): Promise<WorkResult> {
  let doc: Record<string, unknown> | null;
  try {
    doc = await publishedSource(p, row.collection, row.doc_id);
  } catch {
    // Temporary read failure: keep existing English, retry with backoff (bounded attempts).
    const owned = await finish(row, { translations: row.translations ?? {}, sourceHash: row.source_hash, outcome: "error", error: "read" });
    return { translated: 0, outcome: "error", error: "read", owned };
  }
  if (!doc) {
    const owned = await finish(row, { translations: {}, sourceHash: null, outcome: "obsolete" });
    return { translated: 0, outcome: "obsolete", error: null, owned };
  }
  const texts = sourceTexts(row.collection, doc);
  const hash = sourceHash(texts);
  const current = new Set(texts.map(textHash));
  const kept: TranslationTable = {};
  for (const [key, value] of Object.entries(row.translations ?? {})) if (current.has(key)) kept[key] = value;
  const missing = texts.filter((text) => !Object.hasOwn(kept, textHash(text)));
  if (!missing.length) {
    const owned = await finish(row, { translations: kept, sourceHash: hash, outcome: "done" });
    return { translated: 0, outcome: "done", error: null, owned };
  }
  if (!(await reserveCall())) {
    const owned = await finish(row, { translations: kept, sourceHash: hash, outcome: "budget", error: "budget" });
    return { translated: 0, outcome: "budget", error: "budget", owned };
  }
  const batch = firstBatch(missing);
  const hashes = Object.keys(batch);
  // Short ids keep prompts small; hashes stay server-side.
  const ids = Object.fromEntries(hashes.map((key, index) => [`t${index}`, batch[key]]));
  const done: TranslationTable = {};
  let error: string | null = null;
  try {
    const english = await translate(ids, signal);
    hashes.forEach((key, index) => {
      if (typeof english[`t${index}`] === "string") done[key] = english[`t${index}`];
    });
  } catch (cause) {
    error = cause instanceof TranslationError ? cause.code : "unknown";
  }
  const merged = { ...kept, ...done };
  const left = missing.filter((text) => !Object.hasOwn(merged, textHash(text))).length;
  // Progress resets attempts; a batch that produced nothing counts as an error.
  const outcome = !left ? "done" : Object.keys(done).length ? "more" : "error";
  const owned = await finish(row, { translations: merged, sourceHash: hash, outcome, error: outcome === "error" ? error ?? "partial" : null });
  return { translated: Object.keys(done).length, outcome, error, owned };
}

async function payload(): Promise<Payload> {
  const { cms } = await import("../content");
  return cms();
}

let running: Promise<{ processed: number; failed: number }> | null = null;
let runOwner: object | null = null;
/**
 * Processes up to `maxJobs` claims (one provider batch each). Concurrent callers in one
 * process share a run; other processes are excluded by row locks and lease tokens.
 */
export function processTranslationQueue(options: { maxJobs?: number; translate?: Translator; signal?: AbortSignal; payload?: Payload } = {}) {
  if (running) return running;
  const owner = {};
  runOwner = owner;
  const run = (async () => {
    // Yield first: an early return must not clear `running` before it is assigned.
    await Promise.resolve();
    let processed = 0, failed = 0;
    try {
      if (!options.translate && translationAvailability() !== "enabled") return { processed, failed };
      const p = options.payload ?? (await payload());
      for (let index = 0; index < (options.maxJobs ?? 10); index++) {
        if (options.signal?.aborted) break;
        const row = await claim();
        if (!row) break;
        const result = await work(p, row, options.translate ?? translateWithQuestionnaireAI, options.signal);
        processed++;
        if (result.outcome === "error") failed++;
        if (result.outcome === "budget" || ["disabled", "config", "auth"].includes(result.error ?? "")) break;
      }
    } finally {
      if (runOwner === owner) {
        running = null;
        runOwner = null;
      }
    }
    return { processed, failed };
  })();
  running = run;
  return run;
}

let lastKick = 0;
let timer: ReturnType<typeof setInterval> | null = null;
function stopTranslationTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}
/**
 * Fire-and-forget worker start; never throws or delays the caller. Also starts a
 * once-a-minute recovery sweep in this process (expired leases, retries, rows committed
 * after an earlier kick). Queue rows are durable, so a restart only delays work.
 */
function workerEnabled() {
  // CONTENT_TRANSLATION_WORKER=off: queue rows are still written; an operator, the
  // standalone worker script or a test drives processTranslationQueue explicitly.
  return translationAvailability() === "enabled" && process.env.CONTENT_TRANSLATION_WORKER !== "off";
}
export const sweepIntervalMs = 60000;
/**
 * Starts this process's recovery sweep (idempotent). Called at server start from
 * src/instrumentation.ts, so pending rows are processed after a restart even if nobody
 * publishes or reads in English. Each sweep is one bounded queue run (at most 10 claims,
 * each at most one provider call, all within the hourly budget); an empty queue costs
 * one indexed UPDATE. Returns whether the sweep is running.
 */
export function startTranslationSweep(initialDelayMs = 15000): boolean {
  if (!workerEnabled()) return false;
  if (!timer) {
    timer = setInterval(() => kickTranslationQueue(0), sweepIntervalMs);
    timer.unref?.();
    setTimeout(() => kickTranslationQueue(0), initialDelayMs).unref?.();
  }
  return true;
}
export function kickTranslationQueue(minimumInterval = 30000) {
  if (!workerEnabled()) return;
  startTranslationSweep();
  if (Date.now() - lastKick < minimumInterval) return;
  lastKick = Date.now();
  setTimeout(() => {
    processTranslationQueue().catch((error) => console.warn("Content translation worker stopped", error instanceof TranslationError ? error.code : "unavailable"));
  }, 0);
}

/**
 * Explicit recovery for documents published before this feature (or while it was off).
 * Enqueues at most `limit` published documents that have no row yet. Run only by an
 * operator script; never from a request.
 */
export async function backfillPublished(p: Payload, limit = 50): Promise<number> {
  if (translationAvailability() !== "enabled") return 0;
  let queued = 0;
  for (const collection of translatableCollections) {
    if (queued >= limit) break;
    const where = collection === "community-posts"
      ? { and: [{ status: { equals: "visible" } }, { category: { in: ["event", "notice"] } }] }
      : { _status: { equals: "published" } };
    const known = await db().query<{ doc_id: number }>("SELECT doc_id FROM content_translations WHERE collection = $1 AND locale = $2", [collection, translationLocale]);
    const skip = known.rows.map((row) => row.doc_id);
    const docs: { docs: { id: number | string }[] } = await p.find({ collection, overrideAccess: true, draft: false, depth: 0, limit: limit - queued, pagination: false,
      where: skip.length ? { and: [where as never, { id: { not_in: skip } }] } : (where as never), select: { id: true } as never, sort: "-updatedAt" }) as never;
    for (const doc of docs.docs) {
      await markTranslation(p.db.drizzle as unknown as Executor, collection, Number(doc.id));
      queued++;
    }
  }
  return queued;
}

/** English overlays for documents the caller already read with its own access rules. */
export async function loadOverlays(refs: { collection: TranslatableCollection; id: number }[]): Promise<Map<string, Overlay>> {
  const overlays = new Map<string, Overlay>();
  const unique = [...new Map(refs.filter((ref) => Number.isSafeInteger(ref.id) && ref.id > 0).map((ref) => [`${ref.collection}:${ref.id}`, ref])).values()];
  if (!unique.length) return overlays;
  try {
    const result = await db().query<{ collection: string; doc_id: number; translations: TranslationTable; status: string }>(
      `SELECT collection, doc_id, translations, status FROM content_translations
       WHERE locale = $1 AND status <> 'obsolete' AND (collection, doc_id) IN (SELECT * FROM unnest($2::varchar[], $3::int[]))`,
      [translationLocale, unique.map((ref) => ref.collection), unique.map((ref) => ref.id)],
    );
    let waiting = false;
    for (const row of result.rows) {
      overlays.set(`${row.collection}:${row.doc_id}`, new Overlay(row.translations ?? {}));
      if (row.status === "pending" || row.status === "processing") waiting = true;
    }
    // Resumes already-queued work only; reading never creates work or new cost.
    if (waiting) kickTranslationQueue();
  } catch {
    // Missing table (migration not yet applied) or database trouble: show Chinese.
  }
  return overlays;
}

/** Queue status for managers (no source or translated text). */
export async function translationStatus(collection: TranslatableCollection, id: number) {
  const availability = translationAvailability();
  if (availability !== "enabled") return { availability, status: null };
  try {
    const row = await readQueueRow(collection, id);
    return { availability, status: row?.status ?? null };
  } catch {
    return { availability, status: null };
  }
}
