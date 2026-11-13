import { APIError, type Payload, type Where } from "payload";
import type { User } from "@/payload-types";
import { promotedContent } from "../content-promotions";
import { publicationImages } from "../publication-images";
import { controlledImageRef } from "./images";
import { projectPublicationContent } from "../publication-content";
import { refreshViewer, requireCampusViewer } from "./identity";
import { canUseCampus } from "../rules";
import { audienceWhere } from "../content-audience";
import { communityRef, teamRef, mediaRef, txt, rel, iso, rows, readRows, findRow, publicWhere, paginate, safeBody, notFound, type Row, type Input } from "./shared";
import { showcaseCard, showcaseFields } from "./community";
import { getHonors } from "./teams";
import type { ArticleCard, ArticleDetail, CommunityRef, FeedItem, Page } from "./types";

export const articleFields = ["title", "slug", "summary", "body", "cover", "postImages", "game", "team", "event", "type", "date", "publishedAt", "createdAt", "demo", "_status", "category", "status", "photos", "sections"] as const;
/** Reuse relation lookups within a page; never inspect draft or privileged parents. */
function articleCommunityResolver(p: Payload, viewer: User | null = null) {
  const cache = new Map<string, Promise<CommunityRef | null>>();
  const memo = (key: string, read: () => Promise<CommunityRef | null>) => {
    if (!cache.has(key)) cache.set(key, read());
    return cache.get(key)!;
  };
  const game = (id: unknown) => memo(`game:${rel(id)}`, () => communityRef(p, id));
  return async (row: Row, kind: ArticleCard["kind"]): Promise<CommunityRef | null> => {
    if (kind !== "news" && kind !== "album") return game(row.game);
    // News/albums have no game column. Event association takes precedence,
    // with a published team association as the fallback.
    const eventID = rel(row.event);
    const eventCommunity = eventID ? await memo(`event:${eventID}`, async () => {
      const event = await findRow(p, "events", eventID, ["game"], viewer, publicWhere());
      return event ? game(event.game) : null;
    }) : null;
    if (eventCommunity) return eventCommunity;
    const teamID = rel(row.team);
    return teamID ? memo(`team:${teamID}`, async () => {
      const team = await findRow(p, "teams", teamID, ["game"], null, publicWhere());
      return team ? game(team.game) : null;
    }) : null;
  };
}
export async function articleCard(p: Payload, row: Row, kind: ArticleCard["kind"], promoted = false, resolvedCommunity?: CommunityRef | null): Promise<ArticleCard> {
  const community = resolvedCommunity === undefined ? await articleCommunityResolver(p)(row, kind) : resolvedCommunity, href = kind === "communityNotice" ? `/community/${community?.slug ?? ""}/updates/${row.id}` : `/${kind === "announcement" ? "announcements" : kind === "album" ? "gallery" : "news"}/${row.slug ?? row.id}`;
  const cover = await mediaRef(p, row.cover, String(row.title ?? "")) ?? (kind === "announcement" || kind === "communityNotice" ? publicationImages(row.postImages).map((image, index) => controlledImageRef(kind === "announcement" ? "announcement-post" : "community-post", row.id, index, image.source, image.alt)).find(Boolean) : null) ?? null;
  return { key: `${kind}:${row.id}`, kind, ref: kind === "communityNotice" ? { type: "communityNotice", id: row.id, community: community?.slug ?? "" } : { type: kind, id: row.id, slug: String(row.slug ?? row.id) }, href, label: kind === "announcement" ? "公告" : kind === "communityNotice" ? "社群通知" : kind === "album" ? "影像" : txt(row.type) ?? "新闻", title: String(row.title ?? ""), summary: txt(row.summary) ?? (kind === "communityNotice" ? txt(row.body)?.slice(0, 180) ?? null : null), cover, community, publishedAt: iso(row.publishedAt) ?? iso(row.date) ?? iso(row.createdAt), promoted, demo: row.demo === true };
}
export async function getFeed(p: Payload, viewer: User | null, input: Input = {}): Promise<Page<FeedItem> & { restricted: boolean }> {
  viewer = await refreshViewer(p, viewer);
  const kind = String(input.kind ?? "all");
  if (!["all", "announcements", "news", "albums", "showcase", "honors"].includes(kind)) throw new APIError("动态筛选无效", 400);
  const game = input.community ? await findRow(p, "games", input.community, ["slug"], null, publicWhere()) : null;
  if (input.community && !game) return { ...paginate([], input), restricted: !canUseCampus(viewer) };
  const gameWhere: Where = game ? { game: { equals: game.id } } : {};
  const highlightsOnly = input.highlightsOnly === true;
  const include = (name: string) => (!highlightsOnly || ["albums", "showcase", "honors"].includes(name)) && (kind === "all" || kind === name);
  const campus = canUseCampus(viewer);
  const noticePromotions = include("announcements") ? await promotedContent(p, "notice", 500, viewer) : [];
  const noticeIDs = new Set(noticePromotions.map(row => Number(row.sourceKey.split(":")[1])));
  const showcasePromotions = campus && include("showcase") && input.promotedOnly === true ? await promotedContent(p, "showcase", 500, viewer) : [];
  const showcaseIDs = showcasePromotions.map(row => Number(row.sourceKey.split(":")[1]));
  const [announcements, notices, news, albums, showcases, honors] = await Promise.all([
    include("announcements") ? readRows(p, "announcements", articleFields, publicWhere({ and: [gameWhere, audienceWhere(viewer)] }), viewer) : [],
    include("announcements") ? readRows(p, "community-posts", articleFields, { and: [{ category: { equals: "notice" } }, { status: { equals: "visible" } }, gameWhere, audienceWhere(viewer), ...(input.promotedOnly === true ? [{ id: { in: [...noticeIDs] } }] : [])] }, viewer) : [],
    campus && include("news") ? readRows(p, "news", articleFields, publicWhere(), null) : [],
    campus && include("albums") ? readRows(p, "albums", articleFields, publicWhere(), null) : [],
    campus && include("showcase") ? readRows(p, "community-showcase", showcaseFields, { and: [{ status: { equals: "visible" } }, gameWhere, ...(input.promotedOnly === true ? [{ id: { in: showcaseIDs } }] : [])] }, null) : [],
    campus && include("honors") ? getHonors(p, viewer, { community: input.community, limit: 50 }) : null,
  ]);
  // Social rows have their own visibility but do not inherit the parent game's
  // publication/demo constraints. Check the parent before projecting or paginating.
  const parentCache = new Map<unknown, Promise<boolean>>();
  const visibleSocial = async (records: Row[]) => {
    const allowed = await Promise.all(records.map(row => {
      if (!parentCache.has(row.game)) parentCache.set(row.game, communityRef(p, row.game).then(Boolean));
      return parentCache.get(row.game)!;
    }));
    return records.filter((_row, index) => allowed[index]);
  };
  const [visibleNotices, visibleShowcases] = await Promise.all([visibleSocial(notices), visibleSocial(showcases)]);
  const resolveCommunity = articleCommunityResolver(p, viewer);
  const relatedArticles = await Promise.all([...news.map(async row => articleCard(p, row, "news", false, await resolveCommunity(row, "news"))), ...albums.map(async row => articleCard(p, row, "album", false, await resolveCommunity(row, "album")))]);
  const articles: FeedItem[] = await Promise.all([...announcements.map(async row => ({ kind: "article" as const, item: await articleCard(p, row, "announcement") })), ...visibleNotices.map(async row => ({ kind: "article" as const, item: await articleCard(p, row, "communityNotice", noticeIDs.has(row.id)) }))]);
  articles.push(...relatedArticles.filter(card => !game || card.community?.id === game.id).map(item => ({ kind: "article" as const, item })));
  const showcaseItems: FeedItem[] = await Promise.all(visibleShowcases.map(async row => ({ kind: "showcase" as const, item: await showcaseCard(p, viewer, row) })));
  const result: FeedItem[] = [...articles, ...showcaseItems, ...(honors?.docs ?? []).map(item => ({ kind: "honor" as const, item }))];
  const date = (item: FeedItem) => item.kind === "article" ? item.item.publishedAt : item.kind === "showcase" ? item.item.createdAt : item.item.approvedAt ?? item.item.date;
  result.sort((a, b) => (date(b) ?? "").localeCompare(date(a) ?? "") || a.item.key.localeCompare(b.item.key));
  return { ...paginate(result, input), restricted: !canUseCampus(viewer) };
}
export async function getArticle(p: Payload, viewer: User | null, input: Input): Promise<ArticleDetail> {
  const kind = String(input.kind);
  if (!["announcement", "communityNotice", "news", "album"].includes(kind)) notFound();
  viewer = kind === "news" || kind === "album"
    ? await requireCampusViewer(p, viewer)
    : await refreshViewer(p, viewer);
  if (kind === "communityNotice" && !rel(input.idOrSlug ?? input.id)) notFound();
  const collection = kind === "announcement" ? "announcements" : kind === "communityNotice" ? "community-posts" : kind === "news" ? "news" : "albums";
  const row = await findRow(p, collection, input.idOrSlug ?? input.id, kind === "communityNotice" ? [...articleFields, "contentMode", "contentBlocks"] : articleFields, viewer, kind === "communityNotice"
    ? { and: [audienceWhere(viewer), { status: { equals: "visible" } }, { category: { equals: "notice" } }] }
    : publicWhere(kind === "announcement" ? audienceWhere(viewer) : {}));
  if (!row) notFound();
  if (kind === "communityNotice" && !(await communityRef(p, row.game))) notFound();
  const article = await articleCard(p, row, kind as ArticleCard["kind"]), photoRows = rows(row.photos);
  const indexedImages = publicationImages(row.postImages).map((image, index) => controlledImageRef(kind === "announcement" ? "announcement-post" : "community-post", row.id, index, image.source, image.alt));
  const images = indexedImages.filter((image): image is NonNullable<typeof image> => !!image);
  const photos = kind === "album" ? paginate((await Promise.all(photoRows.map(async photo => { const image = await mediaRef(p, photo.image, txt(photo.caption) ?? article.title); return image ? { image, caption: txt(photo.caption) } : null; }))).filter((photo): photo is NonNullable<typeof photo> => !!photo), { page: input.page, limit: 12 }) : null;
  const { getEventDetail } = await import("./events");
  const event = row.event ? await getEventDetail(p, viewer, { source: "club", id: row.event }).then(value => value.event).catch(error => { if ((error as { status?: number }).status === 404) return null; throw error; }) : null;
  return { article, body: kind === "communityNotice" ? null : safeBody(row.body), bodyText: kind === "communityNotice" ? txt(row.body) : null, images, presentation: kind === "communityNotice" ? projectPublicationContent(row.contentMode, row.contentBlocks, indexedImages) : null, sections: rows(row.sections).map((section, index) => ({ id: String(section.id ?? index), heading: String(section.heading ?? ""), text: String(section.text ?? "") })), photos, related: { event, team: canUseCampus(viewer) ? await teamRef(p, row.team) : null } };
}
