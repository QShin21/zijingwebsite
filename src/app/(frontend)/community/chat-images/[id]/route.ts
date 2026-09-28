import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const p = await cms(); const { user } = await p.auth({ headers: request.headers });
  if (!canParticipate(user)) return new Response(null, { status: 401, headers });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response(null, { status: 404, headers });
  const message = await p.findByID({ collection: "community-messages", id, overrideAccess: false, user: null, depth: 0, select: { image: true, game: true } }).catch(() => null);
  const game = message?.game && await p.findByID({ collection: "games", id: Number(message.game), overrideAccess: false, user: null, draft: false, depth: 0 }).catch(() => null);
  if (!game || game._status !== "published" || !message?.image) return new Response(null, { status: 404, headers });
  return new Response(Buffer.from(message.image.split(",")[1], "base64"), { headers: { ...headers, "Content-Type": "image/webp" } });
}
