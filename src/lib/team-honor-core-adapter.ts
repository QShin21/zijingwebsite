import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import {
  APIError,
  type CollectionSlug,
  type Payload,
  type PayloadRequest,
} from "payload";
import {
  readPublicHonorTeam,
  type HonorMembership,
  type HonorMembershipAuthority,
} from "./team-honor-authority";
import { honorID } from "./team-honor-model";

// Structural type matches the core's 20261012 contract. The integration owner supplies
// its getActiveTeamMembership function; this module does not implement membership rules.
type CoreMembershipView = {
  id: number;
  teamID: number;
  userID: number;
  gameID: number;
  seasonID: number | null;
  status: "active" | "revoked";
};
export type HonorCoreContract = {
  getActiveTeamMembership(
    p: Payload,
    input: { teamID: number; userID: number; req?: PayloadRequest },
  ): Promise<CoreMembershipView | null>;
};
async function lockFacts(
  req: PayloadRequest,
  team: number,
  membership: number,
  member: number,
) {
  if (!req.transactionID) return;
  const db = req.payload.db as unknown as PostgresAdapter,
    id = await req.transactionID,
    session = id != null ? db.sessions[String(id)] : null;
  if (!session) throw new APIError("无法安全核验成员关系，请刷新重试", 503);
  // Real core updates acquire normal row update locks, so exit/disable and honor writes serialize.
  await session.db.execute(
    sql`SELECT id FROM teams WHERE id=${team} FOR SHARE`,
  );
  await session.db.execute(
    sql`SELECT id FROM users WHERE id=${member} FOR SHARE`,
  );
  await session.db.execute(
    sql`SELECT id FROM team_memberships WHERE id=${membership} FOR SHARE`,
  );
  await session.db.execute(
    sql`SELECT id FROM games WHERE id=(SELECT game_id FROM teams WHERE id=${team}) FOR SHARE`,
  );
  await session.db.execute(
    sql`SELECT id FROM team_establishment_applications WHERE id=(SELECT establishment_application_id FROM teams WHERE id=${team}) FOR SHARE`,
  );
}
export function createCoreTeamHonorAuthority(
  core: HonorCoreContract,
): HonorMembershipAuthority {
  async function activeMembership(
    req: PayloadRequest,
    member: number,
    team: number,
  ): Promise<HonorMembership> {
    if (
      !Object.prototype.hasOwnProperty.call(
        req.payload.collections,
        "team-memberships",
      )
    )
      throw new APIError(
        "代表队成员权威尚未接入，暂不能新增、修改或批准荣誉。",
        503,
      );
    const row = await core.getActiveTeamMembership(req.payload, {
      teamID: team,
      userID: member,
      req,
    });
    if (
      !row ||
      row.status !== "active" ||
      row.userID !== member ||
      row.teamID !== team
    )
      throw new APIError("当前没有该代表队的有效成员关系", 403);
    await lockFacts(req, row.teamID, row.id, row.userID);
    const teamInfo = await readPublicHonorTeam(req, team);
    if (!teamInfo?.active || teamInfo.game !== row.gameID)
      throw new APIError("成员关系的队伍或社群已变化，请刷新后核对", 409);
    return {
      id: row.id,
      member: row.userID,
      team: row.teamID,
      season: row.seasonID,
      teamInfo,
    };
  }
  return {
    activeMembership,
    publicTeam: readPublicHonorTeam,
    activeMemberships: async (req, member) => {
      if (
        !Object.prototype.hasOwnProperty.call(
          req.payload.collections,
          "team-memberships",
        )
      )
        throw new APIError(
          "代表队成员权威尚未接入，暂不能新增、修改或批准荣誉。",
          503,
        );
      // Find only opaque references for this user, then let the core validate every one.
      const references = await req.payload.find({
        collection: "team-memberships" as CollectionSlug,
        req,
        overrideAccess: true,
        depth: 0,
        pagination: false,
        where: { member: { equals: member } },
        select: { team: true },
      });
      const results: HonorMembership[] = [];
      for (const reference of references.docs as unknown as {
        team: unknown;
      }[]) {
        try {
          results.push(
            await activeMembership(req, member, honorID(reference.team)),
          );
        } catch (error) {
          if (!(error instanceof APIError && error.status === 403)) throw error;
        }
      }
      return results;
    },
  };
}
