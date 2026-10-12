import { APIError, type Payload, type PayloadRequest } from "payload";
import type { User, TeamMembership } from "../payload-types";
import {
  canParticipate,
  canPublish,
  communityIDs,
  relationID,
  type Identity,
} from "./rules";

export type TeamMembershipView = {
  id: number;
  teamID: number;
  userID: number;
  gameID: number;
  seasonID: number | null;
  status: "active" | "revoked";
  joinedAt: string;
  revokedAt: string | null;
  leftAt: string | null;
};
export const positiveID = (value: unknown) => {
  const id = Number(relationID(value));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
export async function currentTeamActor(
  p: Payload,
  actor: Pick<User, "id"> | null,
  req?: PayloadRequest,
) {
  if (!positiveID(actor?.id)) return null;
  return p
    .findByID({
      collection: "users",
      id: actor!.id,
      req,
      overrideAccess: true,
      depth: 0,
      select: {
        roles: true,
        accountStatus: true,
        communityOffices: true,
        name: true,
      },
    })
    .catch(() => null);
}
export function canProposeTeam(actor: Identity | null, gameID: number) {
  return (
    canPublish(actor) ||
    (canParticipate(actor) &&
      ["publishContent", "handleJoins"].some((capability) =>
        communityIDs(
          actor,
          capability as "publishContent" | "handleJoins",
        ).includes(String(gameID)),
      ))
  );
}
export async function canManageTeam(
  p: Payload,
  actor: Pick<User, "id"> | null,
  teamID: number,
  req?: PayloadRequest,
) {
  const user = await currentTeamActor(p, actor, req);
  if (!canParticipate(user) || !positiveID(teamID)) return false;
  const team = await p
    .findByID({
      collection: "teams",
      id: teamID,
      req,
      overrideAccess: true,
      depth: 0,
      select: { game: true },
    })
    .catch(() => null);
  const gameID = positiveID(team?.game);
  if (!gameID) return false;
  return (
    canPublish(user) ||
    communityIDs(user, "handleJoins").includes(String(gameID))
  );
}
export async function isEstablishedTeam(
  p: Payload,
  teamID: number,
  req?: PayloadRequest,
) {
  if (!positiveID(teamID)) return false;
  const team = await p
    .findByID({
      collection: "teams",
      id: teamID,
      req,
      overrideAccess: true,
      depth: 0,
      select: {
        teamStatus: true,
        establishmentApplication: true,
        game: true,
        _status: true,
        archived: true,
      },
    })
    .catch(() => null);
  if (
    !team ||
    !["active", "resting"].includes(team.teamStatus ?? "") ||
    team.archived ||
    team._status !== "published"
  )
    return false;
  const applicationID = positiveID(team.establishmentApplication),
    gameID = positiveID(team.game);
  if (!applicationID || !gameID) return false;
  const application = await p
    .findByID({
      collection: "team-establishment-applications",
      id: applicationID,
      req,
      overrideAccess: true,
      depth: 0,
      select: { status: true, team: true, game: true },
    })
    .catch(() => null);
  const game = await p
    .findByID({
      collection: "games",
      id: gameID,
      req: req ? { ...req, user: null } : undefined,
      user: null,
      overrideAccess: false,
      draft: false,
      depth: 0,
      select: { _status: true, archived: true },
    })
    .catch(() => null);
  return Boolean(
    application?.status === "approved" &&
      positiveID(application.team) === teamID &&
      positiveID(application.game) === gameID &&
      game?._status === "published" &&
      !game.archived,
  );
}
const view = (
  row: Pick<
    TeamMembership,
    | "id"
    | "team"
    | "member"
    | "game"
    | "season"
    | "status"
    | "joinedAt"
    | "revokedAt"
    | "leftAt"
  >,
): TeamMembershipView => ({
  id: row.id,
  teamID: positiveID(row.team)!,
  userID: positiveID(row.member)!,
  gameID: positiveID(row.game)!,
  seasonID: positiveID(row.season),
  status: row.status,
  joinedAt: row.joinedAt,
  revokedAt: row.revokedAt ?? null,
  leftAt: row.leftAt ?? null,
});
// Trusted server reads: only relation facts, never answers, contacts, or a second member list.
export async function getTeamMembership(
  p: Payload,
  input: { teamID: number; userID: number; req?: PayloadRequest },
) {
  if (!positiveID(input.teamID) || !positiveID(input.userID)) return null;
  const rows = await p.find({
    collection: "team-memberships",
    req: input.req,
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: {
      and: [
        { team: { equals: input.teamID } },
        { member: { equals: input.userID } },
      ],
    },
    select: {
      team: true,
      member: true,
      game: true,
      season: true,
      status: true,
      joinedAt: true,
      revokedAt: true,
      leftAt: true,
    },
  });
  const row = rows.docs[0];
  return row && positiveID(row.game) ? view(row) : null;
}
export async function getTeamMembershipByID(
  p: Payload,
  input: { membershipID: number; req?: PayloadRequest },
) {
  if (!positiveID(input.membershipID)) return null;
  const row = await p
    .findByID({
      collection: "team-memberships",
      id: input.membershipID,
      req: input.req,
      overrideAccess: true,
      depth: 0,
      select: {
        team: true,
        member: true,
        game: true,
        season: true,
        status: true,
        joinedAt: true,
        revokedAt: true,
        leftAt: true,
      },
    })
    .catch(() => null);
  return row &&
    positiveID(row.game) &&
    positiveID(row.team) &&
    positiveID(row.member)
    ? view(row)
    : null;
}
export async function requireActiveTeamMember(
  p: Payload,
  actor: Pick<User, "id"> | null,
  teamID: number,
  req?: PayloadRequest,
) {
  if (!actor) throw new APIError("请先登录", 401);
  const row = await getActiveTeamMembership(p, {
    teamID,
    userID: actor.id,
    req,
  });
  if (!row) throw new APIError("当前没有该代表队的有效成员关系", 403);
  return row;
}
export async function requireTeamManager(
  p: Payload,
  actor: Pick<User, "id"> | null,
  teamID: number,
  req?: PayloadRequest,
) {
  if (!actor) throw new APIError("请先登录", 401);
  if (!(await canManageTeam(p, actor, teamID, req)))
    throw new APIError("无权管理此社群的代表队", 403);
}
export async function getActiveTeamMembership(
  p: Payload,
  input: { teamID: number; userID: number; req?: PayloadRequest },
) {
  const row = await getTeamMembership(p, input);
  if (
    !row ||
    row.status !== "active" ||
    !(await isEstablishedTeam(p, input.teamID, input.req))
  )
    return null;
  const user = await currentTeamActor(p, { id: input.userID }, input.req);
  return canParticipate(user) ? row : null;
}
export async function listActiveTeamMemberships(
  p: Payload,
  input: { teamID: number; req?: PayloadRequest },
) {
  if (!(await isEstablishedTeam(p, input.teamID, input.req))) return [];
  const rows = await p.find({
    collection: "team-memberships",
    req: input.req,
    overrideAccess: true,
    depth: 0,
    pagination: false,
    where: {
      and: [
        { team: { equals: input.teamID } },
        { status: { equals: "active" } },
      ],
    },
    select: {
      team: true,
      member: true,
      game: true,
      season: true,
      status: true,
      joinedAt: true,
      revokedAt: true,
      leftAt: true,
    },
  });
  if (!rows.docs.length) return [];
  const users = await p.find({
    collection: "users",
    req: input.req,
    overrideAccess: true,
    depth: 0,
    pagination: false,
    where: {
      and: [
        {
          id: {
            in: rows.docs.map((row) => positiveID(row.member)).filter(Boolean),
          },
        },
        { accountStatus: { not_equals: "suspended" } },
      ],
    },
    select: { accountStatus: true },
  });
  const active = new Set(users.docs.map((user) => user.id));
  return rows.docs
    .filter(
      (row) => positiveID(row.game) && active.has(positiveID(row.member)!),
    )
    .map(view);
}
