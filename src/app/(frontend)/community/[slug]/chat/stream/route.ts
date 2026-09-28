import { canParticipate } from "@/lib/rules";
import { bySlug, cms } from "@/lib/content";
import { chatNotifications } from "@/lib/chat-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { user } = await (await cms()).auth({ headers: request.headers });
  if (!canParticipate(user)) return new Response(null, { status: 401 });
  const game = await bySlug("games", (await params).slug);
  if (!game) return new Response(null, { status: 404 });
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let lifetime: ReturnType<typeof setTimeout> | undefined;
      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        clearTimeout(lifetime);
        request.signal.removeEventListener("abort", cleanup);
        try { controller.close(); } catch { /* Already cancelled by the reader. */ }
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
      if (request.signal.aborted) { cleanup(); return; }
      const send = (text: string) => { if (!closed) controller.enqueue(encoder.encode(text)); };
      try {
        unsubscribe = await chatNotifications.subscribe({ game: game.id, change: () => send("event: change\ndata: {}\n\n"), disconnect: cleanup });
        if (closed) { unsubscribe(); return; }
        send("retry: 1000\nevent: ready\ndata: {}\n\n");
        heartbeat = setInterval(() => send(": heartbeat\n\n"), 15000);
        // Periodically reconnect to recheck access and publication state.
        lifetime = setTimeout(cleanup, 60000);
      } catch { cleanup(); }
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "private, no-cache, no-store, no-transform",
    "X-Accel-Buffering": "no",
  } });
}
