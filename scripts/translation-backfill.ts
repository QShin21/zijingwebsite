import { getPayload } from "payload";
import config from "../src/payload.config";
import { backfill, closeTranslationPool, processTranslationQueue, type BackfillCursor } from "../src/lib/content-translation/store";
import { translatableCollections, type TranslatableCollection } from "../src/lib/content-translation/segments";
import { translationAvailability } from "../src/lib/content-translation/translator";

/*
 * Bounded history backfill for English translations (operator tool; never run from requests).
 *
 *   Dry run (default; no writes, no provider call, works without the AI key):
 *     node --import tsx scripts/translation-backfill.ts [--limit 200] [--page-size 50]
 *          [--collections news,albums] [--after news:120]
 *   Queue (writes queue markers only; translation happens later under the hourly budget):
 *     node --import tsx scripts/translation-backfill.ts --confirm [same options] [--process 0]
 *
 * --limit: documents examined in this run (1–1000). --after: resume cursor printed as `next`.
 * --process: claims to run now (each ≤ 1 provider call; max 50); default 0 leaves the work
 * to the server's sweep. Re-running is idempotent: queued rows and current translations are
 * skipped, cached English segments are reused. Output is counts only (no text, no keys).
 *
 * Call volume: one provider call per claim, each batch ≤ 40 segments and ≤ 4,000 characters,
 * except that a single segment longer than 4,000 characters (segments are capped at 6,000)
 * is sent alone. `estimatedCalls` uses the worker's own sequential batching and counts only
 * first attempts that succeed; failed calls are retried with backoff (≤ 3 failed attempts per
 * generation) and later edits re-translate changed text, so real calls can be higher. The
 * only hard limit is the site-wide budget of 120 calls per hour, which bounds the number of
 * calls, not their monetary cost.
 */
const args = process.argv.slice(2);
const value = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const integer = (flag: string, fallback: number, min: number, max: number) => {
  const raw = value(flag);
  const number = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${flag} must be an integer ${min}–${max}`);
  return number;
};
const confirm = args.includes("--confirm");
const limit = integer("--limit", 200, 1, 1000), pageSize = integer("--page-size", 50, 1, 100), claims = integer("--process", 0, 0, 50);
const collections = value("--collections")?.split(",").map((name) => name.trim()) as TranslatableCollection[] | undefined;
if (collections?.some((name) => !translatableCollections.includes(name))) throw new Error(`--collections must be among: ${translatableCollections.join(", ")}`);
const afterRaw = value("--after");
let after: BackfillCursor | null = null;
if (afterRaw) {
  const [collection, id] = afterRaw.split(":");
  if (!translatableCollections.includes(collection as TranslatableCollection) || !/^\d+$/.test(id ?? "")) throw new Error("--after must look like news:120");
  after = { collection: collection as TranslatableCollection, id: Number(id) };
}
if (confirm && translationAvailability() !== "enabled") {
  console.error(`Translation unavailable (${translationAvailability()}); nothing queued. Dry-run works without a key.`);
  process.exit(1);
}
if (!confirm && claims) throw new Error("--process requires --confirm");
const p = await getPayload({ config });
const report = await backfill(p, { dryRun: !confirm, limit, pageSize, collections, after });
const processed = claims ? await processTranslationQueue({ payload: p, maxJobs: claims }) : null;
console.log(JSON.stringify({ ...report, ...(processed ? { processed } : {}), next: report.next ? `${report.next.collection}:${report.next.id}` : null }, null, 2));
await closeTranslationPool();
process.exit(0);
