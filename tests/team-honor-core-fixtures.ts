import { randomBytes } from "node:crypto";
import type { Payload } from "payload";
import type { User } from "../src/payload-types";

/** Seed only an isolated synthetic approved authority chain, never execute real onboarding/recruitment. */
export async function seedHonorCoreChain(
  p: Payload,
  game: number,
  reviewer: User,
  members: User[],
  suffix: string,
) {
  const trusted = {
    overrideAccess: true,
    context: { system: true, teamCoreWrite: true },
    user: reviewer,
  };
  const establishment = await p.create({
    ...trusted,
    collection: "team-establishment-applications",
    data: {
      title: "合成荣誉代表队",
      game,
      applicant: reviewer.id,
      reason: "仅用于荣誉与真实成员读取接口联调的合成建队资料",
      requestKey: "honor-establishment-" + suffix,
      status: "approved",
    },
  });
  const team = await p.create({
    ...trusted,
    collection: "teams",
    data: {
      title: "合成荣誉代表队",
      slug: "honor-authority-" + suffix,
      game,
      teamStatus: "active",
      establishmentApplication: establishment.id,
      _status: "published",
    },
  });
  await p.update({
    ...trusted,
    collection: "team-establishment-applications",
    id: establishment.id,
    data: { team: team.id },
  });
  const recruitment = await p.create({
    ...trusted,
    collection: "team-recruitments",
    data: {
      title: "合成权威来源批次",
      team: team.id,
      game,
      createdBy: reviewer.id,
      status: "open",
      signupForm: {
        enabled: true,
        questions: [
          { id: "consent", label: "合成确认", type: "text", required: true },
        ],
      },
    },
  });
  const applications: number[] = [],
    memberships = new Map<number, number>();
  for (const member of members) {
    const application = await p.create({
      ...trusted,
      collection: "team-join-applications",
      data: {
        title: "合成权威成员来源",
        team: team.id,
        game,
        recruitment: recruitment.id,
        applicant: member.id,
        requestKey: "honor-join-" + suffix + "-" + member.id,
        status: "approved",
        formVersion: randomBytes(32).toString("hex"),
        formSnapshot: {
          enabled: true,
          questions: [
            { id: "consent", label: "合成确认", type: "text", required: true },
          ],
        },
        answers: { consent: "合成测试确认" },
      },
    });
    applications.push(application.id);
    const membership = await p.create({
      ...trusted,
      collection: "team-memberships",
      data: {
        title: "合成有效入队关系",
        team: team.id,
        game,
        member: member.id,
        membershipKey: team.id + ":" + member.id,
        status: "active",
        joinedAt: new Date().toISOString(),
        sourceApplication: application.id,
        grantedBy: reviewer.id,
      },
    });
    memberships.set(member.id, membership.id);
  }
  return { team, establishment, recruitment, applications, memberships };
}
export async function cleanHonorCoreChain(
  p: Payload,
  chain: Awaited<ReturnType<typeof seedHonorCoreChain>>,
) {
  for (const id of chain.memberships.values())
    await p.delete({
      collection: "team-memberships",
      id,
      overrideAccess: true,
    });
  for (const id of chain.applications)
    await p.delete({
      collection: "team-join-applications",
      id,
      overrideAccess: true,
    });
  await p.delete({
    collection: "team-recruitments",
    id: chain.recruitment.id,
    overrideAccess: true,
  });
  await p.delete({
    collection: "teams",
    id: chain.team.id,
    overrideAccess: true,
  });
  await p.delete({
    collection: "team-establishment-applications",
    id: chain.establishment.id,
    overrideAccess: true,
  });
  const objects = [
    "teams:" + chain.team.id,
    "team-establishment-applications:" + chain.establishment.id,
    "team-recruitments:" + chain.recruitment.id,
    ...chain.applications.map((id) => "team-join-applications:" + id),
    ...[...chain.memberships.values()].map((id) => "team-memberships:" + id),
  ];
  await p.delete({
    collection: "audit",
    overrideAccess: true,
    where: { object: { in: objects } },
  });
}
