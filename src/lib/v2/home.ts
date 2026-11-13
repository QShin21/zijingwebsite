import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { publicHref } from "../presentation";
import { approvedPromotionSources } from "../content-promotions";
import { refreshViewer, viewerProjection } from "./identity";
import { canUseCampus } from "../rules";
import { eventCard, getCalendar, getEventDetail, submittedKeys } from "./events";
import { articleCard, getFeed } from "./feed";
import { getCommunities, showcaseCard } from "./community";
import { getRecruitmentCenter } from "./recruitment";
import { getMe, getManage } from "./account";
import { getFixedPage } from "./pages";
import { communityRef, mediaRef, txt, plainBody, beijingDate, type Input, type Row } from "./shared";
import type { HomeResponse } from "./types";
import { homeSections } from "./home-sections";

/** Promotion slots are independent of calendar dates and recent-feed truncation. */
export async function getHomePromoted(p: Payload, viewer: User | null): Promise<HomeResponse["promoted"]> {
  viewer = await refreshViewer(p, viewer);
  const [events, notices, showcases] = await Promise.all([
    approvedPromotionSources(p, "event", 6, viewer), approvedPromotionSources(p, "notice", 6, viewer),
    canUseCampus(viewer) ? approvedPromotionSources(p, "showcase", 6, viewer) : [],
  ]);
  const parents = new Map<number, ReturnType<typeof communityRef>>();
  const visible = async (sources: typeof events) => {
    const allowed = await Promise.all(sources.map(({ source }) => {
      const id = source.game.id;
      if (!parents.has(id)) parents.set(id, communityRef(p, id));
      return parents.get(id)!;
    }));
    return sources.filter((_source, index) => !!allowed[index]).slice(0, 6);
  };
  const [publicEvents, publicNotices, publicShowcases] = await Promise.all([visible(events), visible(notices), visible(showcases)]);
  const submissions = viewer && publicEvents.length ? await submittedKeys(p, viewer) : undefined;
  return {
    events: await Promise.all(publicEvents.map(({ source }) => eventCard(p, source.doc as unknown as Row, "community", viewer, submissions, true))),
    notices: await Promise.all(publicNotices.map(({ source }) => articleCard(p, source.doc as unknown as Row, "communityNotice", true))),
    showcases: canUseCampus(viewer) ? await Promise.all(publicShowcases.map(({ source }) => showcaseCard(p, viewer, source.doc as unknown as Row))) : null,
  };
}

export async function getHome(p: Payload, viewer: User | null, _input: Input = {}): Promise<HomeResponse> {
  const actor = await refreshViewer(p, viewer);
  const campus = canUseCampus(actor);
  const [site, calendar, recruitment, notices, communities, feed, me, manage, about, promoted] = await Promise.all([
    p.findGlobal({ slug: "site", overrideAccess: false, user: null, depth: 0, select: { name: true, heroTitle: true, heroSubtitle: true, heroImage: true, heroButtonLabel: true, heroButtonURL: true, footer: true, featuredEvents: true, homeSections: true } }),
    getCalendar(p, actor, { limit: 50 }), getRecruitmentCenter(p, actor, { limit: 50 }), getFeed(p, actor, { kind: "announcements", limit: 4 }), campus ? getCommunities(p, actor, { limit: 8 }) : null, campus ? getFeed(p, actor, { highlightsOnly: true, promotedOnly: true, limit: 5 }) : null, actor ? getMe(p, actor) : null, actor ? getManage(p, actor) : null, getFixedPage(p, null, { key: "about" }), getHomePromoted(p, actor),
  ]);
  const featured = Array.isArray(site.featuredEvents) ? site.featuredEvents.map(value => Number(typeof value === "object" && value ? value.id : value)) : [];
  const eligible = calendar.docs.filter(row => !["ended", "cancelled"].includes(row.state));
  const featuredCards = await Promise.all(featured.slice(0, 3).map(id => getEventDetail(p, actor, { source: "club", id })
    .then(value => value.event).catch(error => { if ((error as { status?: number }).status === 404) return null; throw error; })));
  const spotlight = featuredCards.find(row => row && !["ended", "cancelled"].includes(row.state)) ?? eligible.find(row => row.ref.type === "event" && row.ref.source === "club" && row.state === "upcoming") ?? eligible.find(row => row.state === "live") ?? null;
  const calls = [...recruitment.staff, ...(recruitment.teams?.docs ?? [])].filter(row => row.state === "open").sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  return { sections: homeSections(site.homeSections), promoted, viewer: actor ? await viewerProjection(p, actor) : null, site: { name: site.name, heroTitle: txt(site.heroTitle), heroSubtitle: txt(site.heroSubtitle), heroImage: await mediaRef(p, site.heroImage), heroAction: txt(site.heroButtonLabel) && txt(site.heroButtonURL) ? { label: String(site.heroButtonLabel), href: publicHref(site.heroButtonURL, "/join") } : null, footer: txt(site.footer) }, today: beijingDate(), spotlight, upcoming: calendar.docs.slice(0, 6), openSignups: calendar.docs.filter(row => row.signup.state === "open").slice(0, 4), openCalls: calls.slice(0, 6), notices: notices.docs.flatMap(row => row.kind === "article" ? [row.item] : []).slice(0, 4), highlights: feed ? feed.docs.filter(row => row.kind === "honor" || row.kind === "showcase" || row.item.kind === "album").slice(0, 5) : null, communities: communities?.docs ?? null, me: me ? { todo: me.todo.length, upcomingSignups: me.upcoming.length, reviewPending: (manage?.queues ?? []).reduce((sum, queue) => sum + (queue.pending ?? 0), 0) } : null, about: about.updatedAt ? { excerpt: txt(plainBody(about.body))?.slice(0, 160) ?? null } : null };
}
