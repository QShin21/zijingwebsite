/**
 * Server start hook (Next.js instrumentation). Starts the content-translation recovery
 * sweep in the Node.js server so queued English translations resume after a restart
 * without waiting for a publish or an English reader. No-op without the AI key, with
 * CONTENT_TRANSLATION_WORKER=off, on the Edge runtime and during `next build`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { startTranslationSweep } = await import("./lib/content-translation/store");
    startTranslationSweep();
  } catch {
    // Translation is optional; server start must never depend on it.
    console.warn("Content translation sweep unavailable");
  }
}
