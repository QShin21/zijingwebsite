import type { Payload } from "payload";
import type { StaffBatch, TeamRecruitment, User } from "@/payload-types";
import { staffWindow } from "../staff-recruitment-model";
import { normalizeSignup } from "../signup-schema";
import { normalizeTeamForm, teamRecruitmentState } from "../team-core";
import { isEstablishedTeam } from "../team-memberships";
import { ownApplicationItems } from "./account";
import { refreshViewer } from "./identity";
import { communityRef, iso, pageInput, publicWhere, rel, selectFields, teamRef, txt, type Input, type Row } from "./shared";
import type { RecruitmentCard, RecruitmentCenter } from "./types";

export const teamRecruitmentFields = ["title", "team", "game", "status", "signupForm", "updatedAt"] as const;
type ApplicationState = { status: string; statusLabel: string };
const stateKey = (label: string): RecruitmentCard["state"] => /尚未开始/.test(label) ? "upcoming" : ["申请开放", "招新开放"].includes(label) ? "open" : "closed";
const effectiveDate = (values: unknown[], latest: boolean) => {
  const dates = values.map(iso).filter((value): value is string => value !== null).sort();
  return (latest ? dates.at(-1) : dates[0]) ?? null;
};

export function staffRecruitmentCard(row: Row, application: ApplicationState | null = null): RecruitmentCard {
  const batch = { state: String(row.state), startAt: iso(row.startAt), endAt: iso(row.endAt), signupForm: row.signupForm } as Pick<StaffBatch, "state" | "startAt" | "endAt" | "signupForm">;
  const form = row.signupForm ? normalizeSignup(row.signupForm) : null, stateLabel = staffWindow(batch);
  return { key: `staff:${row.id}`, ref: { type: "staffBatch", id: row.id }, href: `/join/staff/batches/${row.id}`, kind: "staff",
    title: txt(row.title) ?? "骨干招新", summary: txt(row.description), team: null, community: null,
    opensAt: effectiveDate([row.startAt, form?.start], true), deadline: effectiveDate([row.endAt, form?.end], false),
    state: stateKey(stateLabel), stateLabel, viewerApplication: application };
}

/** Uses the same normalized form and established-team authority as the existing detail service. */
export async function teamRecruitmentCard(p: Payload, row: Row, viewer: User | null = null, application: ApplicationState | null = null): Promise<RecruitmentCard | null> {
  if (!["open", "closed"].includes(String(row.status))) return null;
  const team = await teamRef(p, row.team);
  if (!team || !(await isEstablishedTeam(p, team.id))) return null;
  let form;
  try { form = normalizeTeamForm(row.signupForm); }
  catch { return null; } // An incomplete legacy batch cannot take down the team directory.
  const stateLabel = teamRecruitmentState({ status: row.status as TeamRecruitment["status"] }, form);
  return { key: `team:${row.id}`, ref: { type: "teamRecruitment", id: row.id }, href: `/teams/recruitment/${row.id}`, kind: "team",
    title: txt(row.title) ?? "代表队招新", summary: txt(form.intro), team, community: team.community,
    opensAt: iso(form.start), deadline: iso(form.end), state: stateKey(stateLabel), stateLabel, viewerApplication: viewer ? application : null };
}

export async function getRecruitmentCenter(p: Payload, viewer: User | null, input: Input = {}): Promise<RecruitmentCenter> {
  const user = await refreshViewer(p, viewer);
  const [batches, mine] = await Promise.all([
    p.find({ collection: "staff-batches", user: null, overrideAccess: false, draft: false, depth: 0, pagination: false, limit: 0, sort: "-createdAt",
      where: { state: { in: ["open", "closed"] } }, select: { title: true, description: true, state: true, startAt: true, endAt: true, signupForm: true } }),
    user ? ownApplicationItems(p, user, ["staff", "teamJoin"]) : null,
  ]);
  const applicationByHref = new Map((mine ?? []).map(item => [item.href, { status: item.status, statusLabel: item.statusLabel }]));
  const staff = batches.docs.filter(batch => ["open", "closed"].includes(batch.state)).map(batch => staffRecruitmentCard(batch as unknown as Row, applicationByHref.get(`/join/staff/batches/${batch.id}`) ?? null));
  if (!user) return { staff, teams: null, mine: null };

  // Apply the public parent-object projection before paginating batches, even for high-privilege viewers.
  const publicTeams = await p.find({ collection: "teams", user: null, overrideAccess: false, draft: false, depth: 0, pagination: false, limit: 0,
    where: publicWhere({ and: [{ archived: { not_equals: true } }, { teamStatus: { in: ["active", "resting"] } }, { establishmentApplication: { exists: true } }] }),
    select: { game: true, _status: true, archived: true, demo: true, teamStatus: true, establishmentApplication: true } });
  const eligible = await Promise.all(publicTeams.docs.map(async team => {
    if (team._status !== "published" || team.archived || !["active", "resting"].includes(team.teamStatus ?? "") || !rel(team.establishmentApplication) || (process.env.APP_ENV === "production" && team.demo)) return null;
    const community = await communityRef(p, team.game);
    return community && await isEstablishedTeam(p, team.id) ? team.id : null;
  }));
  const ids = eligible.filter((id): id is number => id !== null), { page, limit } = pageInput(input);
  if (!ids.length) return { staff, teams: { docs: [], page, totalPages: 0, totalDocs: 0, hasNextPage: false }, mine };
  const result = await p.find({ collection: "team-recruitments", user, overrideAccess: false, draft: false, depth: 0, page, limit, sort: "-createdAt",
    where: { and: [{ status: { in: ["open", "closed"] } }, { team: { in: ids } }] }, select: selectFields(teamRecruitmentFields) });
  const cards = await Promise.all((result.docs as unknown as Row[]).filter(row => ids.includes(rel(row.team) ?? 0)).map(row => teamRecruitmentCard(p, row, user, applicationByHref.get(`/teams/recruitment/${row.id}`) ?? null)));
  return { staff, teams: { docs: cards.filter((card): card is RecruitmentCard => card !== null), page, totalPages: result.totalPages, totalDocs: result.totalDocs, hasNextPage: result.hasNextPage }, mine };
}
