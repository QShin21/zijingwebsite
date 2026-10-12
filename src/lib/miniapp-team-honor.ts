import { APIError, createLocalReq, type Payload } from "payload";
import type { TeamHonorRecord, User } from "../payload-types";
import { canParticipate, canReviewShowcase, relationID } from "./rules";
import { currentTeamActor, getActiveTeamMembership } from "./team-memberships";
import { createCoreTeamHonorAuthority } from "./team-honor-core-adapter";
import type { HonorMembership, HonorTeam } from "./team-honor-authority";
import { completeHonor, honorID, nextHonorState, type HonorAction } from "./team-honor-model";
import { currentHonorVersion, teamHonorService } from "./team-honor-service";
import { honorCanReview } from "./team-honor-web";

type Scope = { team?: number; game?: number };
type ReviewAction = "approve" | "return" | "reject";
const authority = createCoreTeamHonorAuthority({ getActiveTeamMembership });
const unavailable = (error: unknown) => error instanceof APIError && [400, 403, 404, 409].includes(error.status);
const noActions = () => ({ edit: false, save: false, submit: false, withdraw: false, hide: false, reviewActions: [] as ReviewAction[] });

// Read hints only. Every mutation still rechecks the same authority and state in its original transaction.
export async function miniappTeamHonorReads(p: Payload, actor: User, scope: Scope = {}) {
  const fresh = await currentTeamActor(p, actor);
  if (!canParticipate(fresh)) throw new APIError("账号已停用或不可用，请联系负责人", 403);
  const user: User = { ...actor, ...fresh!, collection: "users" };
  const req = await createLocalReq({ user }, p);
  const available = await teamHonorService.availableTeams(p, user);
  const teams = available.filter(row => (!scope.team || row.team === scope.team) && (!scope.game || row.teamInfo.game === scope.game));
  const members = new Map<string, Promise<HonorMembership | null>>();
  const publicTeams = new Map<number, Promise<HonorTeam | null>>();
  for (const row of available) members.set(user.id + ":" + row.team, Promise.resolve(row));
  const member = (author: number, team: number) => {
    const key = author + ":" + team;
    if (!members.has(key)) members.set(key, author === user.id ? Promise.resolve(null) : authority.activeMembership(req, author, team).catch(error => {
      if (unavailable(error)) return null;
      throw error;
    }));
    return members.get(key)!;
  };
  const publicTeam = (team: number) => {
    if (!publicTeams.has(team)) publicTeams.set(team, authority.publicTeam(req, team));
    return publicTeams.get(team)!;
  };
  const scopedTeam = scope.team ? await p.findByID({ collection: "teams", id: scope.team, user, overrideAccess: false,
    depth: 0, select: { game: true } }).catch(error => { if (unavailable(error)) return null; throw error; }) : null;
  const scopeGame = scope.game ?? (scopedTeam ? honorID(scopedTeam.game) : undefined);
  const scopedGame = scopeGame ? await p.findByID({ collection: "games", id: scopeGame, user, overrideAccess: false,
    depth: 0, select: { _status: true } }).catch(error => { if (unavailable(error)) return null; throw error; }) : null;
  const matchesScope = (!scope.team || Boolean(scopedTeam)) && (!scope.game || Boolean(scopedGame)) &&
    (!scope.team || !scope.game || Number(relationID(scopedTeam?.game)) === scope.game);

  const recordActions = async (record: TeamHonorRecord) => {
    const team = honorID(record.team), author = honorID(record.author), game = honorID(record.game);
    const visibleTeam = await publicTeam(team);
    // The original service rejects all operations when a still-public team has changed its game.
    if (visibleTeam && visibleTeam.game !== game) return noActions();
    const owner = author === user.id, reviewer = !owner && canReviewShowcase(user, game);
    const can = (action: HonorAction) => {
      try { nextHonorState(record.state, action); return true; }
      catch (error) { if (unavailable(error)) return false; throw error; }
    };
    const membership = owner || reviewer && can("approve") ? await member(author, team) : null;
    const bound = Boolean(membership && membership.id === record.membershipRef && membership.team === team &&
      membership.member === author && membership.teamInfo.active && membership.teamInfo.game === game && visibleTeam?.active);
    const save = owner && bound && can("save"), submit = owner && bound && can("submit");
    const reviewActions: ReviewAction[] = [];
    if (reviewer && can("approve") && bound && record.submittedVersion) {
      try {
        const observed = await currentHonorVersion(record);
        completeHonor(observed.content);
        if (observed.version === record.submittedVersion) reviewActions.push("approve");
      } catch (error) { if (!unavailable(error)) throw error; }
    }
    if (reviewer) for (const action of ["return", "reject"] as const) if (can(action)) reviewActions.push(action);
    return { edit: save || submit, save, submit, withdraw: owner && bound && can("withdraw"),
      hide: (owner && bound || reviewer) && can("hide"), reviewActions };
  };
  return { actor: user, teams, recordActions,
    actions: { create: teams.length > 0, review: matchesScope && (scopeGame ? Boolean(scopedGame) && canReviewShowcase(user, scopeGame) : honorCanReview(user)) } };
}
