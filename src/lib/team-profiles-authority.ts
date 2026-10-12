import { APIError, type Payload, type PayloadRequest } from "payload";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getActiveTeamMembership,
  listActiveTeamMemberships,
} from "./team-memberships";

export type ProfileMembership = {
  id: number;
  teamID: number;
  userID: number;
  joinedAt: string;
};
export type ProfileMembershipAuthority = {
  active(
    p: Payload,
    options: { teamID: number; userID: number; req?: PayloadRequest },
  ): Promise<ProfileMembership | null>;
  list(
    p: Payload,
    options: { teamID: number; req?: PayloadRequest },
  ): Promise<ProfileMembership[]>;
};

// Formal core contract: the core task owns all eligibility and roster facts.
// This adapter only narrows the return type; it never invents membership rules.
export const profileMembershipAuthority: ProfileMembershipAuthority = {
  active: getActiveTeamMembership,
  list: listActiveTeamMemberships,
};

/** Opaque server-issued concurrency credential, scoped to the actual live epoch. */
export function teamProfileMembershipVersion(
  p: Payload,
  membership: ProfileMembership,
) {
  return (
    "v1." +
    createHmac("sha256", p.config.secret)
      .update(
        JSON.stringify([
          "team-profile-period",
          membership.id,
          membership.teamID,
          membership.userID,
          membership.joinedAt,
        ]),
      )
      .digest("base64url")
  );
}
export function assertProfileMembershipVersion(
  p: Payload,
  membership: ProfileMembership,
  supplied: unknown,
) {
  const expected = teamProfileMembershipVersion(p, membership);
  if (
    typeof supplied !== "string" ||
    !/^v1\.[A-Za-z0-9_-]{43}$/.test(supplied) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw new APIError(
      "入队周期已更新，请重新加载后确认当前周期的展示选择；原请求未保存",
      409,
      { code: "PROFILE_PERIOD_CHANGED" },
    );
}
