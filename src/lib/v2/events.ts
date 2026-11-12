import { APIError, type Payload, type Where } from "payload";
import type { User } from "@/payload-types";
import { activity, signupState } from "../activity-signups";
import { normalizeSignup } from "../signup-schema";
import { eventState, registrationState, safeURL, managesGame } from "../rules";
import { promotedContent } from "../content-promotions";
import { publicationImages } from "../publication-images";
import { controlledImageRef } from "./images";
import { projectPublicationContent } from "../publication-content";
import { refreshViewer, requireViewer } from "./identity";
import { communityRef, teamRef, mediaRef, txt, rel, iso, readRows, findRow, publicWhere, paginate, safeBody, notFound, type Row, type Input } from "./shared";
import type { EventCard, EventDetail, Page, SignupSummary } from "./types";

export const eventFields = ["title", "slug", "summary", "body", "cover", "postImages", "game", "team", "type", "category", "startAt", "endAt", "location", "lifecycle", "signupForm", "registrationStart", "registrationEnd", "registrationClosed", "registrationURL", "channelText", "requirements", "qrCode", "contact", "channelCheckedAt", "_status", "status", "demo", "archived", "createdAt", "publishedAt", "author"] as const;
const stateKeys: Record<string, EventCard["state"]> = { "即将开始": "upcoming", "进行中": "live", "已结束": "ended", "已取消": "cancelled", "已延期": "postponed" };
export function signupSummary(row: Row, source: "club" | "community", submitted: boolean | null): SignupSummary {
  let form;
  try { form = normalizeSignup(row.signupForm); } catch { form = normalizeSignup(null); }
  const label = form.enabled ? signupState(form, row) : source === "club" ? registrationState({
    _status: txt(row._status), archived: row.archived === true, lifecycle: txt(row.lifecycle), endAt: iso(row.endAt),
    registrationClosed: row.registrationClosed === true, registrationStart: iso(row.registrationStart), registrationEnd: iso(row.registrationEnd),
    registrationURL: txt(row.registrationURL), channelText: txt(row.channelText),
  }) : "未启用报名";
  const state: SignupSummary["state"] = ["报名开放"].includes(label) ? "open" : ["报名尚未开始", "尚未开始"].includes(label) ? "notStarted" : ["报名已截止", "已截止"].includes(label) ? "deadlinePassed" : ["报名已关闭", "已关闭"].includes(label) ? "closed" : "unavailable";
  const starts = [iso(form.enabled ? form.start : null), iso(row.registrationStart)].filter((value): value is string => !!value).sort();
  const ends = [iso(form.enabled ? form.end : null), iso(row.registrationEnd)].filter((value): value is string => !!value).sort();
  return { mode: form.enabled ? "form" : source === "club" && safeURL(row.registrationURL) ? "external" : source === "club" && txt(row.channelText) ? "channel" : "none", state, label, opensAt: starts.at(-1) ?? null, deadline: ends[0] ?? null, viewerSubmitted: submitted };
}
export async function eventCard(p: Payload, row: Row, source: "club" | "community", viewer: User | null = null, submitted?: Set<string>, promoted = false): Promise<EventCard> {
  const community = await communityRef(p, row.game), label = eventState({ lifecycle: txt(row.lifecycle), startAt: iso(row.startAt), endAt: iso(row.endAt) }), key = `${source}:${row.id}`;
  const cover = await mediaRef(p, row.cover, String(row.title ?? "")) ?? publicationImages(row.postImages).map((image, index) => controlledImageRef(source === "club" ? "event-post" : "community-post", row.id, index, image.source, image.alt)).find(Boolean) ?? null;
  const category = ["比赛", "观赛", "交流", "训练", "其他"].includes(String(row.type)) ? row.type as EventCard["category"] : null;
  return { key, ref: source === "club" ? { type: "event", source, id: row.id, slug: String(row.slug ?? row.id) } : { type: "event", source, id: row.id, community: community?.slug ?? "" }, href: source === "club" ? `/events/${row.slug ?? row.id}` : `/community/${community?.slug ?? ""}/updates/${row.id}`, title: String(row.title ?? ""), summary: txt(row.summary) ?? (source === "community" ? txt(row.body)?.slice(0, 180) ?? null : null), cover, community, team: source === "club" ? await teamRef(p, row.team) : null, category, startAt: iso(row.startAt), endAt: iso(row.endAt), location: txt(row.location), state: stateKeys[label] ?? "upcoming", stateLabel: label, signup: signupSummary(row, source, viewer ? submitted?.has(key) ?? false : null), promoted, demo: row.demo === true, archived: row.archived === true, publishedAt: iso(row.publishedAt) ?? iso(row.createdAt) };
}
export async function submittedKeys(p: Payload, viewer: User | null): Promise<Set<string>> {
  if (!viewer) return new Set();
  const result = await readRows(p, "event-signups", ["dedupeKey"], { member: { equals: viewer.id } }, viewer, 0);
  return new Set(result.flatMap(row => {
    const match = /^(events|community-posts):(\d+):/.exec(String(row.dedupeKey ?? ""));
    return match ? [`${match[1] === "events" ? "club" : "community"}:${match[2]}`] : [];
  }));
}
export async function getCalendar(p: Payload, viewer: User | null, input: Input = {}): Promise<Page<EventCard>> {
  viewer = await refreshViewer(p, viewer);
  const scope = String(input.scope ?? "all"), range = String(input.range ?? "upcoming"), category = txt(input.category);
  // HTTP query strings and server boolean callers share the same strict flag.
  if (input.signupOpen != null && ![true, false, "1", "0", "true", "false"].includes(input.signupOpen as boolean | string))
    throw new APIError("报名筛选无效", 400);
  const signupOpen = input.signupOpen === true || input.signupOpen === "1" || input.signupOpen === "true";
  if (!["all", "club", "community", "mine"].includes(scope) || !["upcoming", "past", "month"].includes(range)) throw new APIError("日程筛选无效", 400);
  if (scope === "mine") viewer = await requireViewer(p, viewer);
  if (category && !["比赛", "观赛", "交流", "训练", "其他"].includes(category)) throw new APIError("活动类型无效", 400);
  const month = String(input.month ?? "");
  if (range === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new APIError("请选择有效月份", 400);
  const now = Date.now(), cutoff = now - 30 * 86400000, nowISO = new Date(now).toISOString(), cutoffISO = new Date(cutoff).toISOString();
  const monthStart = range === "month" ? new Date(`${month}-01T00:00:00+08:00`).toISOString() : null;
  const nextMonth = range === "month" ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1) - 8 * 3600_000).toISOString() : null;
  const timeWhere = (source: "club" | "community"): Where => {
    if (range === "month") return { and: [{ startAt: { greater_than_equal: monthStart } }, { startAt: { less_than: nextMonth } }] };
    const ended: Where = { endAt: { less_than_equal: nowISO } };
    const undatedOld: Where = { and: [{ startAt: { exists: false } }, { createdAt: { less_than: cutoffISO } }] };
    if (range === "past") return source === "community" ? { or: [ended, undatedOld] } : { or: [
      { lifecycle: { in: ["ended", "cancelled"] } }, { and: [ended, { or: [{ lifecycle: { exists: false } }, { lifecycle: { not_equals: "postponed" } }] }] },
    ] };
    return { and: [
      { or: [{ endAt: { exists: false } }, { endAt: { greater_than: nowISO } }, ...(source === "club" ? [{ lifecycle: { equals: "postponed" } }] : [])] },
      ...(source === "community" ? [{ or: [{ startAt: { exists: true } }, { createdAt: { greater_than_equal: cutoffISO } }] }] : [{ or: [{ lifecycle: { exists: false } }, { lifecycle: { not_in: ["ended", "cancelled"] } }] }]),
    ] };
  };
  const game = input.community ? await findRow(p, "games", String(input.community), ["slug", "_status", "demo"], null, publicWhere()) : null;
  if (input.community && !game) return paginate([], input);
  const gameWhere: Where = game ? { game: { equals: game.id } } : {};
  const teamID = input.team == null ? null : rel(input.team);
  if (input.team != null && !teamID) throw new APIError("代表队筛选无效", 400);
  const [clubRows, promotionRows, submissions] = await Promise.all([
    scope === "community" ? [] : readRows(p, "events", eventFields, publicWhere({ and: [gameWhere, timeWhere("club"), ...(teamID ? [{ team: { equals: teamID } }] : []), ...(category ? [{ type: { equals: category } }] : [])] }), null, 500, range === "past" ? "-startAt" : "startAt"),
    scope === "club" || category || teamID ? [] : promotedContent(p, "event", 500),
    submittedKeys(p, viewer),
  ]);
  const promotedIDs = new Set(promotionRows.map(row => Number(row.sourceKey.split(":")[1])));
  let communityRows: Row[] = [];
  if (scope !== "club" && !category && !teamID) {
    const where: Where = { and: [{ category: { equals: "event" } }, { status: { equals: "visible" } }, gameWhere, timeWhere("community"), ...(!viewer ? [{ id: { in: [...promotedIDs] } }] : [])] };
    if (viewer || promotedIDs.size) communityRows = await readRows(p, "community-posts", eventFields, where, null, 500, range === "past" ? "-startAt" : "startAt");
  }
  const parentIDs = [...new Set(communityRows.map(row => rel(row.game)).filter((id): id is number => id !== null))];
  const parents = parentIDs.length ? await readRows(p, "games", ["_status", "demo"], publicWhere({ id: { in: parentIDs } }), null, 500) : [];
  const visibleParents = new Set(parents.filter(row => row._status === "published" && !(process.env.APP_ENV === "production" && row.demo)).map(row => row.id));
  communityRows = communityRows.filter(row => visibleParents.has(rel(row.game) ?? 0));
  let cards = await Promise.all([...clubRows.map(row => eventCard(p, row, "club", viewer, submissions)), ...communityRows.map(row => eventCard(p, row, "community", viewer, submissions, promotedIDs.has(row.id)))]);
  cards = cards.filter(card => {
    if (scope === "mine" && !submissions.has(card.key)) return false;
    if (signupOpen && card.signup.state !== "open") return false;
    if (range === "month") return card.startAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).format(new Date(card.startAt)) === month : false;
    const undatedOld = card.ref.type === "event" && card.ref.source === "community" && !card.startAt && Date.parse(card.publishedAt ?? "") < cutoff;
    return range === "past" ? ["ended", "cancelled"].includes(card.state) || undatedOld : ["upcoming", "live", "postponed"].includes(card.state) && !undatedOld;
  });
  cards.sort((a, b) => range === "past" ? (b.startAt ?? b.publishedAt ?? "").localeCompare(a.startAt ?? a.publishedAt ?? "") : a.startAt && b.startAt ? a.startAt.localeCompare(b.startAt) : a.startAt ? -1 : b.startAt ? 1 : (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return paginate(cards, input);
}
export async function getEventDetail(p: Payload, viewer: User | null, input: Input): Promise<EventDetail> {
  viewer = await refreshViewer(p, viewer);
  const source = input.source === "community" ? "community" : input.source === "club" ? "club" : null;
  if (!source) notFound();
  if (source === "community") viewer = await requireViewer(p, viewer);
  if (source === "community" && !rel(input.idOrSlug ?? input.id)) notFound();
  const row = await findRow(p, source === "club" ? "events" : "community-posts", input.idOrSlug ?? input.id, source === "community" ? [...eventFields, "contentMode", "contentBlocks"] : eventFields, null, source === "club" ? publicWhere() : { and: [{ status: { equals: "visible" } }, { category: { equals: "event" } }] });
  if (!row || source === "community" && !await communityRef(p, row.game)) notFound();
  const submissions = await submittedKeys(p, viewer), event = await eventCard(p, row, source, viewer, submissions);
  const permissions = viewer ? await activity(p, source === "club" ? "events" : "community-posts", row.id, viewer).catch(() => null) : null;
  const indexedImages = publicationImages(row.postImages).map((image, index) => controlledImageRef(source === "club" ? "event-post" : "community-post", row.id, index, image.source, image.alt));
  const images = indexedImages.filter((image): image is NonNullable<typeof image> => image !== null);
  // Related content follows member-only article rules, even on a public event page.
  const relatedRows = viewer && source === "club" ? await Promise.all([readRows(p, "news", ["title", "slug", "summary", "cover", "publishedAt", "type", "game", "demo"], publicWhere({ event: { equals: row.id } }), null, 12), readRows(p, "albums", ["title", "slug", "summary", "cover", "publishedAt", "date", "game", "demo"], publicWhere({ event: { equals: row.id } }), null, 12)]) : [[], []];
  const { articleCard } = await import("./feed");
  return { event, body: source === "club" ? safeBody(row.body) : null, bodyText: source === "community" ? txt(row.body) : null, images, presentation: source === "community" ? projectPublicationContent(row.contentMode, row.contentBlocks, indexedImages) : null, registration: source === "club" ? { url: safeURL(row.registrationURL) ? String(row.registrationURL) : null, channelText: txt(row.channelText), qrCode: await mediaRef(p, row.qrCode), contact: txt(row.contact), requirements: txt(row.requirements), checkedAt: iso(row.channelCheckedAt) } : null, related: { news: await Promise.all(relatedRows[0].map(row => articleCard(p, row, "news"))), albums: await Promise.all(relatedRows[1].map(row => articleCard(p, row, "album"))) }, viewer: viewer ? { canManageSignup: permissions?.manager ?? false, canViewSignups: permissions?.canView ?? false, canExportSignups: permissions?.canExport ?? false, canRequestPromotion: source === "community" && managesGame(viewer, rel(row.game)) } : null };
}
