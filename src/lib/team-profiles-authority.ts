import type { Payload, PayloadRequest } from "payload";
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
