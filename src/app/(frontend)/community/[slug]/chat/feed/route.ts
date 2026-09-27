import { bySlug, cms } from "@/lib/content";
import { managesGame } from "@/lib/rules";
import type { Where } from "payload";
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const game = await bySlug("games", (await params).slug);
  if (!game) return Response.json({ error: "社群不存在" }, { status: 404, headers });
  const p = await cms(); const { user } = await p.auth({ headers: request.headers });
  const query = new URL(request.url).searchParams;
  const before = Number(query.get("before")); const after = Number(query.get("after"));
  const where: Where = { game: { equals: game.id } };
  if (Number.isSafeInteger(before) && before > 0) where.id = { less_than: before };
  else if (Number.isSafeInteger(after) && after > 0) where.id = { greater_than: after };
  const result = await p.find({ collection: "community-messages", overrideAccess: false, user: null, depth: 0,
    where, sort: after > 0 && !before ? "id" : "-id", limit: 50,
    select: { author: true, authorName: true, body: true, createdAt: true } });
  const known = (query.get("known") || "").split(",").map(Number).filter(n => Number.isSafeInteger(n) && n > 0).slice(0, 1000);
  const visible = known.length ? await p.find({ collection: "community-messages", overrideAccess: false, user: null, depth: 0,
    where: { game: { equals: game.id }, id: { in: known } }, limit: 1000, select: { createdAt: true } }) : null;
  return Response.json({
    messages: result.docs.map(message => ({ id: message.id, name: message.authorName || "社团成员", body: message.body,
      createdAt: message.createdAt, own: Boolean(user && Number(message.author) === user.id),
      member: managesGame(user, game.id) ? Number(message.author) : undefined })),
    hasMore: result.hasNextPage,
    removed: known.filter(id => !visible?.docs.some(message => message.id === id)),
  }, { headers });
}
