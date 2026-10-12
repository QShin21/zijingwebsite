import { randomBytes } from "node:crypto";
import type { Payload } from "payload";
import type { User } from "../src/payload-types";
import {
  submitTeamEstablishment,
  decideTeamEstablishment,
  saveTeamRecruitment,
  closeTeamRecruitment,
  teamRecruitmentInfo,
  saveTeamJoinApplication,
  decideTeamJoinApplication,
  revokeTeamMembership,
  defaultTeamForm,
} from "../src/lib/team-core";
import { getTeamMembership, positiveID } from "../src/lib/team-memberships";

/** Actual formation, approval and admission services; synthetic records only. */
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
  const admin = await user("ProfileAdmin", ["president"]);
  const member = await user("ProfileMember", ["member"]);
  const viewer = await user("ProfileViewer", ["member"]);
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
  async function team(label: string) {
    const application = await submitTeamEstablishment(p, admin, {
      gameID: game.id,
      title: "合成简介队" + label + suffix,
      reason: "合成测试建队与公开简介资料，禁止导入生产。",
    });
    applicationIDs.push(application.id);
    const approved = await decideTeamEstablishment(
      p,
      admin,
      application.id,
      "approved",
      "合成批准",
      application.updatedAt,
    );
    const teamID = positiveID(approved.team)!;
    teamIDs.push(teamID);
    return p.update({
      collection: "teams",
      id: teamID,
      overrideAccess: true,
      user: admin,
      context: { system: true },
      data: { demo: true },
    });
  }
  const first = await team("a"),
    second = await team("b");
  async function enroll(teamID: number, memberID = member.id) {
    const applicant = users.find((value) => value.id === memberID)!;
    const batches = await p.find({
      collection: "team-recruitments",
      user: admin,
      overrideAccess: false,
      depth: 0,
      pagination: false,
      where: {
        and: [{ team: { equals: teamID } }, { status: { equals: "open" } }],
      },
    });
    for (const batch of batches.docs)
      await closeTeamRecruitment(p, admin, batch.id, "closed", batch.updatedAt);
    const recruitment = await saveTeamRecruitment(p, admin, {
      teamID,
      title: "合成入队批次",
      status: "open",
      form: {
        ...defaultTeamForm,
        enabled: true,
        closed: false,
        end: new Date(Date.now() + 3600_000).toISOString(),
      },
    });
    recruitmentIDs.push(recruitment.id);
    const info = await teamRecruitmentInfo(p, applicant, recruitment.id);
    const application = await saveTeamJoinApplication(
      p,
      applicant,
      recruitment.id,
      {
        action: "submit",
        version: info.version,
        answers: {
          gameID: "SyntheticPlayer",
          position: "中路",
          experience: "合成测试游戏经历",
          availability: "合成测试训练安排",
          contact: "PRIVATE_PROFILE_TEST_ANSWER@example.invalid",
        },
      },
    );
    joinIDs.push(application.id);
    await decideTeamJoinApplication(
      p,
      admin,
      application.id,
      "approved",
      "合成录取",
      application.updatedAt,
    );
    const relation = await getTeamMembership(p, { teamID, userID: memberID });
    if (!relation || relation.status !== "active")
      throw new Error(
        "Real core admission did not produce an active membership",
      );
    if (!membershipIDs.includes(relation.id)) membershipIDs.push(relation.id);
    return p.findByID({
      collection: "team-memberships",
      id: relation.id,
      overrideAccess: true,
      depth: 0,
    });
  }
  const membership = await enroll(first.id);
  async function changeMembership(data: {
    status?: "active" | "revoked";
    joinedAt?: string;
    revokedAt?: string | null;
    leftAt?: string | null;
  }) {
    if (data.status === "active") return enroll(first.id);
    const current = await p.findByID({
      collection: "team-memberships",
      id: membership.id,
      overrideAccess: true,
      depth: 0,
    });
    return revokeTeamMembership(
      p,
      data.leftAt ? member : admin,
      current.id,
      current.updatedAt,
      "合成离队 / 移除",
      Boolean(data.leftAt),
    );
  }
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
