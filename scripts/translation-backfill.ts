import { getPayload } from "payload";
import config from "../src/payload.config";
import { backfillPublished, closeTranslationPool, processTranslationQueue } from "../src/lib/content-translation/store";
import { translationAvailability } from "../src/lib/content-translation/translator";

/*
 * Operator recovery for English translations of already-published content.
 *   node --import tsx scripts/translation-backfill.ts --confirm [--limit 50] [--process 0]
 * --limit: documents to enqueue (max 500). --process: claims to run now (each claim is at
 * most one provider batch and counts against the hourly budget); 0 leaves work for the
 * server's worker. Prints counts only, never text or credentials.
 */
const args = process.argv.slice(2);
if (!args.includes("--confirm")) {
  console.error("Refusing to run without --confirm (enqueues paid translation work).");
  process.exit(2);
}
const number = (flag: string, fallback: number, max: number) => {
  const index = args.indexOf(flag);
  const value = index >= 0 ? Number(args[index + 1]) : fallback;
  if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`${flag} must be an integer 0–${max}`);
  return value;
};
const limit = number("--limit", 50, 500), claims = number("--process", 0, 200);
const availability = translationAvailability();
if (availability !== "enabled") {
  console.error(`Translation unavailable (${availability}); nothing queued.`);
  process.exit(1);
}
const p = await getPayload({ config });
const queued = await backfillPublished(p, limit);
const result = claims ? await processTranslationQueue({ payload: p, maxJobs: claims }) : { processed: 0, failed: 0 };
console.log(JSON.stringify({ queued, ...result }));
await closeTranslationPool();
process.exit(0);
