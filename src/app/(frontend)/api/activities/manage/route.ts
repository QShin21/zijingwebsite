import { cms } from "@/lib/content";
import { canParticipate, canPublish, canSubmitClubContent, canReadActivitySignups, canExportActivitySignups, communityIDs, managesGame } from "@/lib/rules";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const p = await cms(), { user } = await p.auth({ headers: request.headers });
  if (!canParticipate(user) || (!canSubmitClubContent(user) && !communityIDs(user, "viewSignups").length))
    return Response.json({ error: "无权管理或查看活动报名" }, { status: 403, headers });
  const url = new URL(request.url), kind = url.searchParams.get("kind") || "events";
  const page = Math.max(1, Math.min(100000, Math.floor(Number(url.searchParams.get("page"))) || 1));
  if (kind === "events") {
    const canManage = canSubmitClubContent(user);
    const canViewSignups = canReadActivitySignups(user, kind, null, user!.id);
    const data = await p.find({ collection: "events", overrideAccess: false, user, draft: canManage || canViewSignups, depth: 0, limit: 20, page, sort: "-updatedAt",
      where: canPublish(user) ? {} : { submittedBy: { equals: user!.id } }, select: { title: true, _status: true, game: true } });
    return Response.json({ docs: data.docs.map(doc => ({ id: doc.id, title: doc.title, _status: doc._status, canManage,
      canViewSignups: canReadActivitySignups(user, kind, doc.game, user!.id),
      canExportSignups: canExportActivitySignups(user, kind, doc.game, user!.id) })), page: data.page, hasNextPage: data.hasNextPage }, { headers });
  }
  if (kind !== "community-posts") return Response.json({ error: "活动类型无效" }, { status: 400, headers });
  const games = [...new Set([...communityIDs(user, "publishContent"), ...communityIDs(user, "viewSignups")])];
  if (!canPublish(user) && !games.length) return Response.json({ docs: [], page: 1, hasNextPage: false }, { headers });
  const data = await p.find({ collection: "community-posts", overrideAccess: false, user, depth: 0, limit: 20, page, sort: "-updatedAt",
    where: { and: [{ category: { equals: "event" } }, ...(canPublish(user) ? [] : [{ game: { in: games } }])] }, select: { title: true, status: true, game: true, author: true } });
  return Response.json({ docs: data.docs.map(doc => ({ id: doc.id, title: doc.title, status: doc.status,
    canManage: managesGame(user, doc.game), canViewSignups: canReadActivitySignups(user, kind, doc.game, doc.author),
    canExportSignups: canExportActivitySignups(user, kind, doc.game, doc.author) })), page: data.page, hasNextPage: data.hasNextPage }, { headers });
}
