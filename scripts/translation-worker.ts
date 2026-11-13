import { getPayload } from "payload";
import config from "../src/payload.config";
import { closeTranslationPool, expireExhaustedLeases, processTranslationQueue, sweepIntervalMs } from "../src/lib/content-translation/store";
import { translationAvailability } from "../src/lib/content-translation/translator";

/*
 * Standalone translation worker, for deployments that run the web server with
 * CONTENT_TRANSLATION_WORKER=off or want a supervised process (systemd/compose service).
 * Uses the same database, key, endpoint allowlist, hourly budget and lease rules as the
 * in-server sweep; several workers can run at once safely (row locks + lease tokens).
 *   node --import tsx scripts/translation-worker.ts --once [--claims 10]   (cron/timer)
 *   node --import tsx scripts/translation-worker.ts [--claims 10]          (long-running)
 * Prints counts only; never source text, translations or credentials.
 */
const args = process.argv.slice(2);
const index = args.indexOf("--claims");
const claims = index >= 0 ? Number(args[index + 1]) : 10;
if (!Number.isInteger(claims) || claims < 1 || claims > 100) throw new Error("--claims must be an integer 1–100");
const availability = translationAvailability();
if (availability !== "enabled") {
  console.error(`Translation unavailable (${availability}); worker not started.`);
  process.exit(availability === "missing" ? 0 : 1);
}
const p = await getPayload({ config });
let stopping = false;
const stop = () => { stopping = true; };
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
async function round() {
  const expired = await expireExhaustedLeases();
  const result = await processTranslationQueue({ payload: p, maxJobs: claims });
  console.log(JSON.stringify({ at: new Date().toISOString(), expired, ...result }));
}
await round();
while (!args.includes("--once") && !stopping) {
  await new Promise((resolve) => setTimeout(resolve, sweepIntervalMs));
  if (!stopping) await round().catch(() => console.warn("Translation worker round failed"));
}
await closeTranslationPool();
process.exit(0);
