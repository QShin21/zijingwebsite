import { APIError, type Payload, type Where } from "payload";
import type { User } from "@/payload-types";
import { canPublish, canReviewShowcase, communityIDs, managesGame } from "../rules";
import { communityVideo } from "../community-video";
import { promotionStatusLabels } from "../promotion-model";
import { controlledImageRef } from "./images";
import { requireViewer } from "./identity";
import { communityRef, mediaRef, txt, rel, iso, readRows, findRow, publicWhere, paginate, safeBody, notFound, rows, type Row, type Input } from "./shared";
import { eventFields, eventCard, submittedKeys } from "./events";
import type { ArticleCard, CommunityCard, CommunityDetail, CommunityHeader, CommunityRef, EventCard, Page, ShowcaseCard } from "./types";

export const showcaseFields = ["game", "title", "body", "images", "videoURL", "author", "authorName", "createdAt", "updatedAt", "status", "reviewNote"] as const;
export async function showcaseCard(p: Payload, viewer: User | null, row: Row, game?: CommunityRef): Promise<ShowcaseCard> {
  const community = game ?? await communityRef(p, row.game);
  if (!community) notFound();
  const isAuthor = !!viewer && rel(row.author) === viewer.id, canReview = canReviewShowcase(viewer, community.id), video = communityVideo(row.videoURL);
  // Collection ACL permits only the requester, scoped publisher or promotion reviewer.
  const promotionRow = viewer ? (await readRows(p, "content-promotions", ["status"], { sourceKey: { equals: `community-showcase:${row.id}` } }, viewer, 1))[0] : null;
  const promotion = promotionRow ? { status: String(promotionRow.status), label: promotionStatusLabels[String(promotionRow.status)] ?? "处理中" } : null;
  return { key: `showcase:${row.id}`, id: row.id, ref: { type: "showcase", id: row.id, community: community.slug }, href: `/community/${community.slug}/showcase/${row.id}`, community, title: String(row.title ?? ""), body: txt(row.body), images: rows(row.images).flatMap((image, index) => { const ref = controlledImageRef("showcase", row.id, index, image.source, txt(image.caption) ?? String(row.title ?? "")); return ref ? [{ image: ref, caption: txt(image.caption) }] : []; }), video: video ? video.embed ? { kind: "bilibili", embedSrc: video.embed, pageURL: video.url } : video.direct ? { kind: "file", src: video.url } : { kind: "link", url: video.url } : null, authorName: String(row.authorName ?? "社团成员"), createdAt: iso(row.createdAt) ?? "", revision: txt(row.updatedAt) ?? "", status: ["visible", "pending", "hidden", "rejected"].includes(String(row.status)) ? row.status as ShowcaseCard["status"] : "hidden", reviewNote: isAuthor || canReview ? txt(row.reviewNote) : null, promotion, viewer: viewer ? { isAuthor, canReview, canRequestPromotion: managesGame(viewer, community.id) } : null };
}
export async function communityCard(p: Payload, viewer: User, row: Row): Promise<CommunityCard> {
  const community: CommunityRef = { id: row.id, slug: String(row.slug ?? ""), title: String(row.title ?? ""), hue: row.id * 137 % 360 }, now = new Date().toISOString(), cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const count = async (collection: "community-posts" | "teams" | "community-showcase", where: Where) => (await p.count({ collection, overrideAccess: false, user: null, where })).totalDocs;
  const [upcomingEvents, teams, showcase, cover] = await Promise.all([
    count("community-posts", { and: [{ game: { equals: row.id } }, { status: { equals: "visible" } }, { category: { equals: "event" } }, { or: [{ endAt: { greater_than: now } }, { and: [{ endAt: { exists: false } }, { startAt: { greater_than_equal: now } }] }, { and: [{ startAt: { exists: false } }, { createdAt: { greater_than_equal: cutoff } }] }] }] }),
    count("teams", publicWhere({ and: [{ game: { equals: row.id } }, { archived: { not_equals: true } }, { teamStatus: { not_equals: "archived" } }] })),
    count("community-showcase", { and: [{ game: { equals: row.id } }, { status: { equals: "visible" } }] }), mediaRef(p, row.cover, community.title),
  ]);
  return { community, summary: txt(row.summary), cover, demo: row.demo === true, counts: { upcomingEvents, teams, showcase }, viewer: { isOfficer: communityIDs(viewer).includes(String(row.id)) } };
}
export async function getCommunities(p: Payload, viewer: User | null, input: Input = {}): Promise<Page<CommunityCard>> {
  const actor = await requireViewer(p, viewer), q = String(input.q ?? "").trim();
  if (q.length > 80) throw new APIError("搜索文字最多80字", 400);
  const where: Where = q ? { or: [{ title: { contains: q } }, { summary: { contains: q } }] } : {};
  const docs = await readRows(p, "games", ["title", "slug", "summary", "cover", "demo"], publicWhere(where), null, 500, "sort");
  return paginate(await Promise.all(docs.map(row => communityCard(p, actor, row))), input);
}
async function gameFor(p: Payload, input: Input, withBody = false) {
  const game = await findRow(p, "games", input.slug ?? input.community, ["title", "slug", "summary", "cover", "demo", ...(withBody ? ["body"] : [])], null, publicWhere());
  if (!game) notFound();
  return game;
}
export async function getShowcase(p: Payload, viewer: User | null, input: Input): Promise<Page<ShowcaseCard>> {
  const actor = await requireViewer(p, viewer), game = await gameFor(p, input), view = String(input.view ?? "public");
  if (!["public", "mine", "review"].includes(view)) throw new APIError("风采筛选无效", 400);
  if (view === "review" && !canReviewShowcase(actor, game.id)) throw new APIError("无权审核此社群", 403);
  const where: Where = { and: [{ game: { equals: game.id } }, view === "mine" ? { author: { equals: actor.id } } : { status: { equals: view === "review" ? "pending" : "visible" } }] };
  const docs = await readRows(p, "community-showcase", showcaseFields, where, actor);
  return paginate(await Promise.all(docs.map(row => showcaseCard(p, actor, row))), input);
}
export async function getCommunityPosts(p: Payload, viewer: User | null, input: Input): Promise<Page<EventCard | ArticleCard>> {
  const actor = await requireViewer(p, viewer), game = await gameFor(p, input), category = String(input.category ?? "event");
  if (!["event", "notice"].includes(category)) throw new APIError("内容类别无效", 400);
  const where: Where = { and: [{ game: { equals: game.id } }, { category: { equals: category } }, ...(!managesGame(actor, game.id) ? [{ status: { equals: "visible" } }] : [])] };
  const docs = await readRows(p, "community-posts", eventFields, where, actor);
  const submitted = category === "event" ? await submittedKeys(p, actor) : new Set<string>();
  const { articleCard } = await import("./feed");
  const cards = await Promise.all(docs.map(async row => {
    if (category === "event") { const card = await eventCard(p, row, "community", actor, submitted); if (row.status === "hidden") card.stateLabel = "已隐藏"; return card; }
    const card = await articleCard(p, row, "communityNotice"); if (row.status === "hidden") card.label = "已隐藏"; return card;
  }));
  return paginate(cards, input);
}
export async function contactRows(p: Payload, gameID: number) {
  const common = { overrideAccess: false as const, user: null, depth: 0, context: { publicCommunityContacts: gameID }, pagination: false, limit: 0 };
  const candidates = await p.find({ collection: "users", ...common, select: { name: true, communityOffices: true } });
  const users = candidates.docs.filter(user => communityIDs(user, "contactConsent").includes(String(gameID)));
  if (!users.length) return [];
  const apps = await p.find({ collection: "community-applications", ...common, where: { applicant: { in: users.map(user => user.id) } }, sort: "-createdAt", select: { applicant: true, wechatQr: true } });
  return users.flatMap(user => { const application = apps.docs.find(row => rel(row.applicant) === user.id && row.wechatQr); return application ? [{ id: user.id, name: user.name, source: application.wechatQr! }] : []; });
}
export async function getContacts(p: Payload, viewer: User | null, input: Input) {
  await requireViewer(p, viewer); const game = await gameFor(p, input);
  return { contacts: (await contactRows(p, game.id)).flatMap(row => { const qr = controlledImageRef("contact", game.id, row.id, row.source, row.name); return qr ? [{ id: row.id, name: row.name, qr }] : []; }) };
}
async function communityHeader(p: Payload, actor: User, game: Row): Promise<CommunityHeader> {
  const [card, pending] = await Promise.all([
    communityCard(p, actor, game),
    canReviewShowcase(actor, game.id) ? p.count({ collection: "community-showcase", overrideAccess: false, user: actor,
      where: { and: [{ game: { equals: game.id } }, { status: { equals: "pending" } }] } }).then(result => result.totalDocs) : null,
  ]);
  return { card, viewer: { canPublish: managesGame(actor, game.id), canReviewShowcase: canReviewShowcase(actor, game.id), pendingShowcase: pending,
    canManageTeams: canPublish(actor) || communityIDs(actor, "handleJoins").includes(String(game.id)),
    canViewSignups: canPublish(actor) || communityIDs(actor, "viewSignups").includes(String(game.id)),
    canApplyOfficer: !communityIDs(actor).includes(String(game.id)) } };
}
export async function getCommunityHeader(p: Payload, viewer: User | null, input: Input): Promise<CommunityHeader> {
  const actor = await requireViewer(p, viewer);
  return communityHeader(p, actor, await gameFor(p, input));
}
export async function getCommunity(p: Payload, viewer: User | null, input: Input): Promise<CommunityDetail> {
  const actor = await requireViewer(p, viewer), game = await gameFor(p, input, true);
  const [header, contacts, events, notices, showcase, teams] = await Promise.all([
    communityHeader(p, actor, game), contactRows(p, game.id), getCommunityPosts(p, actor, { ...input, slug: game.slug, category: "event", limit: 50 }), getCommunityPosts(p, actor, { ...input, slug: game.slug, category: "notice", limit: 3 }), getShowcase(p, actor, { ...input, slug: game.slug, limit: 6, view: "public" }), import("./teams").then(({ getTeams }) => getTeams(p, actor, { community: game.slug, limit: 50 })),
  ]);
  const cutoff = Date.now() - 30 * 86400000;
  return { ...header, body: safeBody(game.body), officers: contacts.map(row => ({ id: row.id, name: row.name, hasContactCard: true })), upcoming: (events.docs as EventCard[]).filter(card => ["upcoming", "live", "postponed"].includes(card.state) && (card.startAt || Date.parse(card.publishedAt ?? "") >= cutoff)).slice(0, 3), notices: notices.docs as ArticleCard[], showcase: showcase.docs, teams: teams.docs };
}
