import {
  APIError,
  createLocalReq,
  type Payload,
  type PayloadRequest,
} from "payload";
import type { User } from "../payload-types";
import { canParticipate } from "./rules";
import { workflowTransaction } from "./workflow-transactions";
import { normalizeTeamProfileAvatar } from "./team-profiles-images";
import {
  parseTeamProfile,
  sameTeamProfile,
  type OwnTeamProfile,
  type PublicTeamProfile,
  type TeamProfileDraft,
  type TeamProfilesView,
} from "./team-profiles-model";
import {
  profileMembershipAuthority,
  teamProfileMembershipVersion,
  assertProfileMembershipVersion,
  type ProfileMembership,
  type ProfileMembershipAuthority,
} from "./team-profiles-authority";

export const profileCollection = "team-member-profiles" as const;
export type TeamProfileRecord = TeamProfileDraft & {
  id: number;
  membership: number;
  membershipJoinedAt: string;
  revision: number;
};
const profileSelect = {
  displayName: true,
  position: true,
  biography: true,
  avatar: true,
  visible: true,
  revision: true,
  membershipJoinedAt: true,
} as const;
export const profileDraft = (doc: TeamProfileDraft): TeamProfileDraft => ({
  displayName: doc.displayName,
  position: doc.position || "",
  biography: doc.biography || "",
  avatar: doc.avatar || null,
  visible: doc.visible === true,
});
const ownDTO = (doc: TeamProfileRecord): OwnTeamProfile => ({
  ...profileDraft(doc),
  revision: doc.revision,
});
const publicDTO = (doc: TeamProfileRecord): PublicTeamProfile => ({
  id: doc.id,
  displayName: doc.displayName,
  position: doc.position || "",
  biography: doc.biography || "",
  avatar: doc.avatar || null,
});

export async function profileTeam(
  p: Payload,
  teamID: number,
  req?: PayloadRequest,
) {
  const team = await p
    .findByID({
      collection: "teams",
      id: teamID,
      req: req ? { ...req, user: null } : undefined,
      user: null,
      overrideAccess: false,
      draft: false,
      depth: 0,
      select: {
        title: true,
        slug: true,
        game: true,
        _status: true,
        demo: true,
      },
    })
    .catch(() => null);
  if (!team || team._status !== "published")
    throw new APIError("代表队暂时不可访问", 404);
  return team;
}

async function findOwn(
  p: Payload,
  membership: ProfileMembership,
  req: PayloadRequest,
): Promise<TeamProfileRecord | null> {
  const result = await p.find({
    collection: profileCollection,
    req: { ...req, context: { ...req.context, teamProfileOwn: membership.id } },
    overrideAccess: false,
    depth: 0,
    limit: 1,
    // The collection access rule supplies the exact membership filter. Keeping
    // this relation unreadable also prevents caller-driven relation queries.
    select: profileSelect,
  });
  return (result.docs[0] as unknown as TeamProfileRecord) ?? null;
}

/** Server only: caller identity is refreshed; DTOs never contain user/membership IDs. */
export async function readTeamProfiles(
  p: Payload,
  actor: User | null,
  teamID: number,
  authority: ProfileMembershipAuthority = profileMembershipAuthority,
): Promise<TeamProfilesView> {
  if (!canParticipate(actor)) throw new APIError("请登录后查看代表队", 401);
  const req = await createLocalReq({}, p);
  const user = await p.findByID({
    collection: "users",
    id: actor!.id,
    req,
    overrideAccess: true,
    depth: 0,
  });
  if (!canParticipate(user)) throw new APIError("账号已停用", 403);
  req.user = { ...user, collection: "users" };
  await profileTeam(p, teamID, req);
  const memberships = await authority.list(p, { teamID, req });
  const own = await authority.active(p, { teamID, userID: user.id, req });
  // The anonymous Local API read is limited to current, opted-in membership
  // periods. The collection itself refuses unscoped REST/GraphQL access.
  const publicReq = await createLocalReq(
    { context: { teamProfilePublic: memberships } },
    p,
  );
  publicReq.user = null;
  const result = memberships.length
    ? await p.find({
        collection: profileCollection,
        req: publicReq,
        user: null,
        overrideAccess: false,
        depth: 0,
        pagination: false,
        limit: 0,
        sort: "displayName",
        select: profileSelect,
      })
    : { docs: [] };
  const profile = own ? await findOwn(p, own, req) : null;
  return {
    profiles: result.docs.map((doc) =>
      publicDTO(doc as unknown as TeamProfileRecord),
    ),
    own: {
      eligible: Boolean(own),
      membershipVersion: own ? teamProfileMembershipVersion(p, own) : null,
      // A new membership period requires a fresh opt-in, retaining the draft.
      profile: profile
        ? {
            ...ownDTO(profile),
            visible:
              profile.visible && profile.membershipJoinedAt === own!.joinedAt,
          }
        : null,
    },
  };
}

/** No client context, membership, account or game fields are accepted here. */
export async function saveTeamProfile(
  p: Payload,
  actor: User | null,
  teamID: number,
  revision: unknown,
  value: unknown,
  membershipVersion: unknown,
  authority: ProfileMembershipAuthority = profileMembershipAuthority,
): Promise<OwnTeamProfile> {
  if (!canParticipate(actor)) throw new APIError("请登录后编辑队内简介", 401);
  if (
    revision !== null &&
    (!Number.isSafeInteger(revision) || Number(revision) < 1)
  )
    throw new APIError("简介版本无效，请重新加载", 400);
  const draft = parseTeamProfile(value);
  const write = async (req: PayloadRequest) => {
    await profileTeam(p, teamID, req);
    const membership = await authority.active(p, {
      teamID,
      userID: req.user!.id as number,
      req,
    });
    if (!membership)
      throw new APIError("当前入队资格已失效，无法继续编辑简介", 403);
    // Before reads, image work, idempotency and all writes: old periods cannot
    // renew consent, including after re-admission reuses the membership ID.
    assertProfileMembershipVersion(p, membership, membershipVersion);
    const existing = await findOwn(p, membership, req);
    if (draft.avatar !== (existing?.avatar ?? null))
      draft.avatar = await normalizeTeamProfileAvatar(draft.avatar);
    const same =
      existing &&
      existing.membershipJoinedAt === membership.joinedAt &&
      sameTeamProfile(draft, profileDraft(existing));
    // Idempotent retries still check current eligibility before returning.
    if (same) return ownDTO(existing);
    if (revision !== (existing?.revision ?? null))
      throw new APIError(
        "简介已在其他页面更新，请重新加载后核对；当前输入可继续预览",
        409,
      );
    const writeReq = {
      ...req,
      context: {
        ...req.context,
        teamProfileTeam: teamID,
        teamProfileMembership: membership.id,
        teamProfileMembershipVersion: membershipVersion,
      },
    };
    const data = {
      ...draft,
      membership: membership.id,
      membershipJoinedAt: membership.joinedAt,
      revision: (existing?.revision ?? 0) + 1,
    };
    const saved = existing
      ? await p.update({
          collection: profileCollection,
          id: existing.id,
          req: writeReq,
          overrideAccess: false,
          data,
        })
      : await p.create({
          collection: profileCollection,
          req: writeReq,
          overrideAccess: false,
          data,
        });
    return ownDTO(saved as unknown as TeamProfileRecord);
  };
  try {
    return await workflowTransaction(
      p,
      actor,
      { teamProfileWrite: true },
      write,
    );
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("status" in error) ||
      error.status !== 409
    )
      throw error;
    // A single fresh transaction converges identical racing saves. Different
    // stale edits still fail the revision check, and eligibility is re-read.
    return workflowTransaction(p, actor, { teamProfileWrite: true }, write);
  }
}
