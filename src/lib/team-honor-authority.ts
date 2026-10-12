import { APIError, type PayloadRequest } from "payload";
import { relationID } from "./rules";

export type HonorTeam = {
  id: number;
  title: string;
  game: number;
  gameSlug: string;
  gameTitle: string;
  active: boolean;
};
export type HonorMembership = {
  id: number;
  member: number;
  team: number;
  season: number | null;
  teamInfo: HonorTeam;
};
export interface HonorMembershipAuthority {
  /** Must use req's transaction, and conflict with concurrent member exit/revocation. */
  activeMembership(
    req: PayloadRequest,
    member: number,
    team: number,
  ): Promise<HonorMembership>;
  activeMemberships(
    req: PayloadRequest,
    member: number,
  ): Promise<HonorMembership[]>;
  publicTeam(req: PayloadRequest, team: number): Promise<HonorTeam | null>;
}

export async function readPublicHonorTeam(
  req: PayloadRequest,
  team: number,
): Promise<HonorTeam | null> {
  const lifecycleRegistered = req.payload.collections.teams.config.fields.some(
    (field) => "name" in field && field.name === "teamStatus",
  );
  const doc = await req.payload
    .findByID({
      collection: "teams",
      id: team,
      req: { ...req, user: null },
      user: null,
      overrideAccess: false,
      draft: false,
      depth: 0,
      select: {
        title: true,
        game: true,
        _status: true,
        archived: true,
        ...(lifecycleRegistered ? { teamStatus: true } : {}),
      },
    })
    .catch(() => null);
  if (
    !doc ||
    doc._status !== "published" ||
    doc.archived ||
    !relationID(doc.game)
  )
    return null;
  if ((doc as typeof doc & { teamStatus?: string }).teamStatus === "archived")
    return null;
  const game = await req.payload
    .findByID({
      collection: "games",
      id: Number(relationID(doc.game)),
      req: { ...req, user: null },
      user: null,
      overrideAccess: false,
      draft: false,
      depth: 0,
      select: { title: true, slug: true, _status: true, archived: true },
    })
    .catch(() => null);
  if (!game || game._status !== "published" || game.archived) return null;
  return {
    id: doc.id,
    title: doc.title,
    game: game.id,
    gameSlug: game.slug,
    gameTitle: game.title,
    active: true,
  };
}
const unavailable = async (): Promise<never> => {
  throw new APIError(
    "代表队成员权威尚未接入，暂不能新增、修改或批准荣誉。",
    503,
  );
};
// Deliberately fail closed until the core's signed contract is integrated.
// No users.teams / nickname roster / community joins / independent member table fallback.
export const pendingHonorAuthority: HonorMembershipAuthority = {
  activeMembership: unavailable,
  activeMemberships: unavailable,
  publicTeam: readPublicHonorTeam,
};
