import { randomBytes } from "node:crypto";
import type { Payload } from "payload";
import type { User } from "../src/payload-types";
import { emptySignup } from "../src/lib/signup-schema";

/** Real core schema + read API fixture, not an approval-workflow acceptance test.
 * The internal core write context is used only to prepare synthetic, valid
 * establishment/team/game/account/membership relationships. Authority is never mocked.
 */
export async function profileFixture(p: Payload) {
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error(
      "Profile tests require a synthetic loopback development database",
    );
  const suffix = randomBytes(5).toString("hex"),
    password = randomBytes(18).toString("hex");
  const users: User[] = [],
    membershipIDs: number[] = [],
    joinIDs: number[] = [],
    recruitmentIDs: number[] = [],
    teamIDs: number[] = [],
    applicationIDs: number[] = [];
  const user = async (name: string, roles: User["roles"]) => {
    const value = await p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        name: name + suffix,
        email: name + suffix + "@example.invalid",
        password,
        roles,
      },
    });
    users.push(value);
    return value;
  };
  const admin = await user("ProfileAdmin", ["president"]),
    member = await user("ProfileMember", ["member"]),
    viewer = await user("ProfileViewer", ["member"]);
  const game = await p.create({
    collection: "games",
    overrideAccess: true,
    context: { system: true },
    data: {
      title: "合成简介游戏",
      slug: "profile-game-" + suffix,
      _status: "published",
      demo: true,
    },
  });
  const core = {
    user: admin,
    overrideAccess: false,
    context: { teamCoreWrite: true },
  } as const;
  async function team(label: string) {
    const application = await p.create({
      ...core,
      collection: "team-establishment-applications",
      data: {
        title: "合成简介队" + label,
        game: game.id,
        applicant: admin.id,
        reason:
          "合成读取接口与简介测试，禁止生产导入，不代表建队审批流程验收。",
        requestKey: `profiles-establish:${suffix}:${label}`,
        status: "pending",
      },
    });
    applicationIDs.push(application.id);
    const value = await p.create({
      ...core,
      collection: "teams",
      data: {
        title: "合成简介队" + label,
        slug: "profile-team-" + label + "-" + suffix,
        game: game.id,
        _status: "published",
        demo: true,
        teamStatus: "active",
        establishmentApplication: application.id,
      },
    });
    teamIDs.push(value.id);
    await p.update({
      ...core,
      collection: "team-establishment-applications",
      id: application.id,
      data: { status: "approved", team: value.id },
    });
    return value;
  }
  const first = await team("a"),
    second = await team("b");
  async function enroll(teamID: number, memberID = member.id) {
    const recruitment = await p.create({
      ...core,
      collection: "team-recruitments",
      data: {
        title: "合成入队批次",
        team: teamID,
        game: game.id,
        status: "open",
        signupForm: {
          ...emptySignup,
          enabled: true,
          end: new Date(Date.now() + 3600_000).toISOString(),
        },
        createdBy: admin.id,
      },
    });
    recruitmentIDs.push(recruitment.id);
    const application = await p.create({
      ...core,
      collection: "team-join-applications",
      data: {
        title: "合成已审核关系",
        team: teamID,
        game: game.id,
        recruitment: recruitment.id,
        applicant: memberID,
        requestKey: `profiles-join:${suffix}:${teamID}:${memberID}`,
        status: "approved",
        formVersion: "synthetic-v1",
        formSnapshot: { questions: [] },
        answers: { privateSyntheticAnswer: "PRIVATE_PROFILE_TEST_ANSWER" },
      },
    });
    joinIDs.push(application.id);
    const membership = await p.create({
      ...core,
      collection: "team-memberships",
      data: {
        title: "合成有效成员",
        member: memberID,
        team: teamID,
        game: game.id,
        membershipKey: `${teamID}:${memberID}`,
        status: "active",
        joinedAt: new Date().toISOString(),
        sourceApplication: application.id,
        grantedBy: admin.id,
      },
    });
    membershipIDs.push(membership.id);
    return membership;
  }
  const membership = await enroll(first.id);
  const changeMembership = (data: {
    status?: "active" | "revoked";
    joinedAt?: string;
    revokedAt?: string | null;
    leftAt?: string | null;
  }) =>
    p.update({
      ...core,
      collection: "team-memberships",
      id: membership.id,
      data,
    });
  async function cleanup() {
    for (const id of membershipIDs)
      await p.delete({
        collection: "team-member-profiles",
        overrideAccess: true,
        where: { membership: { equals: id } },
      });
    for (const id of membershipIDs)
      await p.delete({
        collection: "team-memberships",
        overrideAccess: true,
        id,
      });
    for (const id of joinIDs)
      await p.delete({
        collection: "team-join-applications",
        overrideAccess: true,
        id,
      });
    for (const id of recruitmentIDs)
      await p.delete({
        collection: "team-recruitments",
        overrideAccess: true,
        id,
      });
    for (const id of teamIDs)
      await p.delete({ collection: "teams", overrideAccess: true, id });
    for (const id of applicationIDs)
      await p.delete({
        collection: "team-establishment-applications",
        overrideAccess: true,
        id,
      });
    await p.delete({ collection: "games", overrideAccess: true, id: game.id });
    for (const value of users)
      await p.delete({
        collection: "users",
        id: value.id,
        overrideAccess: true,
        context: { system: true },
      });
  }
  return {
    p,
    suffix,
    password,
    admin,
    member,
    viewer,
    game,
    first,
    second,
    membership,
    enroll,
    changeMembership,
    cleanup,
  };
}
