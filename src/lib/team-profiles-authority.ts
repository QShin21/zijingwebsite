import { APIError, type Payload, type PayloadRequest } from "payload";

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

// The core task owns the only membership implementation. Fail closed until its
// formal helper is available; test doubles are passed explicitly in unit tests.
const unavailable = async (): Promise<never> => {
  throw new APIError("代表队成员服务尚待集成，请稍后重试", 503);
};
export const profileMembershipAuthority: ProfileMembershipAuthority = {
  active: unavailable,
  list: unavailable,
};
