import { APIError, type Payload } from "payload";
import type { User } from "@/payload-types";
import { canManageTeam, getTeamMembership, isEstablishedTeam } from "../team-memberships";
import { readTeamProfiles } from "../team-profiles";
import { teamHonorService, type HonorArchive } from "../team-honor-service";
import { teamLifecycleLabels, normalizeTeamForm, teamRecruitmentState } from "../team-core";
import { controlledImageRef } from "./images";
import { requireCampusViewer } from "./identity";
import { teamRef, mediaRef, txt, iso, rows, readRows, findRow, publicWhere, paginate, safeBody, notFound, type Row, type Input } from "./shared";
import type { HonorCard, MembershipView, Page, RecruitmentCard, TeamCard, TeamDetail, TeamProfileCard } from "./types";

const teamFields = ["title", "slug", "summary", "cover", "game", "body", "demo", "archived", "teamStatus", "positions", "_status"] as const;
export function honorsFromArchives(archives: HonorArchive[]): HonorCard[] {
  return archives.flatMap(archive => archive.records.map(record => ({ key: record.key, ref: { type: "honor" as const, key: record.key, team: String(archive.team.id) }, href: record.sourceHref ?? archive.href, team: { id: archive.team.id, slug: String(archive.team.id), title: archive.team.title, community: { id: archive.team.game, slug: archive.team.gameSlug, title: archive.team.gameTitle, hue: archive.team.game * 137 % 360 } }, title: record.title, competition: record.competition, placing: record.placing, date: record.date, description: txt(record.description), images: record.images.flatMap((image, index) => { const ref = controlledImageRef("honor", Number(record.key.split(":")[1]), index, image.source, image.caption); return ref ? [ref] : []; }), video: record.videoHref ? { src: record.videoHref } : null, legacy: record.legacy, demo: false, approvedAt: record.approvedAt })));
}
export async function getHonors(p: Payload, viewer: User | null, input: Input = {}): Promise<Page<HonorCard> & { years: number[] }> {
  await requireCampusViewer(p, viewer);
  const game = input.community ? await findRow(p, "games", input.community, ["title", "slug"], null, publicWhere()) : null;
  const team = input.team ? await findRow(p, "teams", input.team, ["title", "slug"], null, publicWhere()) : null;
  if ((input.community && !game) || (input.team && !team)) return { ...paginate([], input), years: [] };
  const archives = await teamHonorService.archives(p, { ...(game ? { game: game.id } : {}), ...(team ? { team: team.id } : {}) });
  let cards = honorsFromArchives(archives);
  const years = [...new Set(cards.flatMap(row => row.date ? [Number(row.date.slice(0, 4))] : []))].sort((a, b) => b - a);
  if (input.year) cards = cards.filter(row => row.date?.startsWith(String(input.year) + "-"));
  cards.sort((a, b) => (b.date ?? b.approvedAt ?? "").localeCompare(a.date ?? a.approvedAt ?? ""));
  // Public authority keeps numeric IDs; resolve canonical team slugs for links/filters.
  await Promise.all(cards.map(async card => { const team = await teamRef(p, card.team.id); if (team) { card.team = team; card.ref = { type: "honor", key: card.key, team: team.slug }; } }));
  return { ...paginate(cards, input), years };
}
async function profiles(p: Payload, actor: User, id: number): Promise<TeamProfileCard[]> {
  const value = await readTeamProfiles(p, actor, id);
  return value.profiles.map(profile => ({ id: profile.id, displayName: profile.displayName, position: profile.position, biography: profile.biography, avatar: profile.avatar ? controlledImageRef("profile", profile.id, 0, profile.avatar, profile.displayName) : null }));
}
export async function teamCard(p: Payload, actor: User, row: Row, honorCount?: number): Promise<TeamCard> {
  const team = await teamRef(p, row.id); if (!team) notFound();
  const [roster, membership, manager, recruitments, cover, honors] = await Promise.all([
    profiles(p, actor, row.id), getTeamMembership(p, { teamID: row.id, userID: actor.id }), canManageTeam(p, actor, row.id), readRows(p, "team-recruitments", ["title", "team", "game", "status", "signupForm"], { team: { equals: row.id } }, actor, 30), mediaRef(p, row.cover, team.title), honorCount === undefined ? teamHonorService.archives(p, { team: row.id }).then(archives => archives.reduce((sum, archive) => sum + archive.records.length, 0)) : honorCount,
  ]);
  const open = recruitments.flatMap(row => { let form; try { form = normalizeTeamForm(row.signupForm); } catch { return []; } const stateLabel = teamRecruitmentState(row as never, form); return stateLabel === "招新开放" ? [{ id: row.id, title: String(row.title ?? ""), deadline: iso(form.end), stateLabel }] : []; })[0] ?? null;
  const status = ["active", "resting", "archived", "unestablished"].includes(String(row.teamStatus)) ? row.teamStatus as TeamCard["status"] : row.archived ? "archived" : "unestablished";
  return { team, summary: txt(row.summary), cover, demo: row.demo === true, archived: row.archived === true || status === "archived", status, statusLabel: teamLifecycleLabels[status], counts: { publicMembers: roster.length, honors }, roster: roster.slice(0, 5).map(row => ({ name: row.displayName, avatar: row.avatar })), openRecruitment: open, viewer: { membership: membership ? membership.leftAt ? "left" : membership.status === "active" ? "active" : "revoked" : null, canManage: manager } };
}
export async function getTeams(p: Payload, viewer: User | null, input: Input = {}): Promise<Page<TeamCard>> {
  if (input.status != null && !["active", "resting", "archived"].includes(String(input.status))) throw new APIError("代表队筛选无效", 400);
  const actor = await requireCampusViewer(p, viewer), game = input.community ? await findRow(p, "games", input.community, ["slug"], null, publicWhere()) : null;
  if (input.community && !game) return paginate([], input);
  const docs = await readRows(p, "teams", teamFields, publicWhere({ and: [...(game ? [{ game: { equals: game.id } }] : []), ...(input.status ? [{ teamStatus: { equals: String(input.status) } }] : [])] }), null);
  const allowed = await Promise.all(docs.map(async row => await teamRef(p, row.id) ? row : null));
  const archives = await teamHonorService.archives(p, game ? { game: game.id } : {});
  return paginate(await Promise.all(allowed.filter((row): row is Row => row !== null).map(row => teamCard(p, actor, row, archives.find(archive => archive.team.id === row.id)?.records.length ?? 0))), input);
}
export async function getTeam(p: Payload, viewer: User | null, input: Input): Promise<TeamDetail> {
  const actor = await requireCampusViewer(p, viewer), row = await findRow(p, "teams", input.slug ?? input.team, teamFields, null, publicWhere());
  if (!row) notFound();
  const [card, roster, honors, seasonRows, recruitment] = await Promise.all([teamCard(p, actor, row), profiles(p, actor, row.id), getHonors(p, actor, { team: row.id, limit: 50 }), readRows(p, "seasons", ["title", "team", "startAt", "members", "demo"], publicWhere({ team: { equals: row.id } }), null, 500, "-startAt"), (async () => {
    const { teamRecruitmentCard, teamRecruitmentFields } = await import("./recruitment");
    const { ownApplicationItems } = await import("./account");
    const [calls, applications] = await Promise.all([
      readRows(p, "team-recruitments", teamRecruitmentFields, { and: [{ team: { equals: row.id } }, { status: { in: ["open", "closed"] } }] }, actor),
      ownApplicationItems(p, actor, ["teamJoin"]),
    ]);
    return (await Promise.all(calls.map(call => {
      const own = applications.find(item => item.href === `/teams/recruitment/${call.id}`);
      return teamRecruitmentCard(p, call, actor, own ? { status: own.status, statusLabel: own.statusLabel } : null);
    }))).filter((call): call is RecruitmentCard => call !== null);
  })()]);
  const active = card.viewer?.membership === "active" && await isEstablishedTeam(p, row.id), membership = await getTeamMembership(p, { teamID: row.id, userID: actor.id });
  const membershipView: MembershipView | null = membership ? { id: membership.id, team: card.team, status: membership.leftAt ? "left" : membership.status === "active" ? "active" : "revoked", joinedAt: membership.joinedAt, leftAt: membership.leftAt, actions: { editProfile: active, submitHonor: active, leave: active } } : null;
  const { getCalendar } = await import("./events");
  const events = await getCalendar(p, actor, { team: row.id, scope: "club", limit: 50 });
  return { card, body: safeBody(row.body), positions: rows(row.positions).map(position => ({ name: String(position.name ?? ""), duties: txt(position.duties), requirements: txt(position.requirements), commitment: txt(position.commitment), arrangement: txt(position.arrangement) })), roster, legacyRoster: [], honors: honors.docs, seasons: seasonRows.map(season => ({ id: season.id, title: String(season.title ?? ""), startAt: iso(season.startAt), members: rows(season.members).filter(member => member.consent === true).map(member => ({ displayName: String(member.displayName ?? ""), position: txt(member.position) })) })), recruitments: recruitment, events: events.docs.filter(card => card.team?.id === row.id), viewer: { membership: membershipView, canManage: card.viewer?.canManage ?? false, canEditProfile: active, canSubmitHonor: active } };
}
