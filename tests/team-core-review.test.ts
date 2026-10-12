import "dotenv/config";
import { beforeAll, afterAll, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { getPayload, type Payload } from "payload";
import pg from "pg";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import {
  submitTeamEstablishment,
  decideTeamEstablishment,
  saveTeamRecruitment,
  saveTeamJoinApplication,
  decideTeamJoinApplication,
  changeTeamLifecycle,
  teamRecruitmentInfo,
  defaultTeamForm,
} from "../src/lib/team-core";
import {
  getActiveTeamMembership,
  listActiveTeamMemberships,
} from "../src/lib/team-memberships";
let p: Payload,
  db: pg.Client,
  leader: User,
  manager: User,
  applicant: User,
  outsider: User,
  game: number;
const suffix = randomBytes(5).toString("hex"),
  users: number[] = [];
const form = {
  ...defaultTeamForm,
  end: new Date(Date.now() + 86400000).toISOString(),
};
const answers = {
  gameID: "合成历史答案",
  position: "合成位置",
  experience: "合成经历",
  availability: "合成训练时间",
  contact: "synthetic@example.invalid",
};
async function createTeam(label: string) {
  const app = await submitTeamEstablishment(p, manager, {
    gameID: game,
    title: `${label}-${suffix}`,
    reason: "合成训练计划与组织安排，供隔离权限测试。",
  });
  return Number(
    (
      await decideTeamEstablishment(
        p,
        leader,
        app.id,
        "approved",
        "",
        app.updatedAt,
      )
    ).team,
  );
}
async function join(team: number) {
  const batch = await saveTeamRecruitment(p, manager, {
    teamID: team,
    title: "合成受审查批次",
    status: "open",
    form,
  });
  const info = await teamRecruitmentInfo(p, applicant, batch.id);
  const application = await saveTeamJoinApplication(p, applicant, batch.id, {
    action: "submit",
    version: info.version,
    answers,
  });
  return { batch, application, info };
}
beforeAll(async () => {
  if (
    process.env.APP_ENV !== "development" ||
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Synthetic loopback only");
  p = await getPayload({ config });
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const user = async (name: string, roles: User["roles"]) => {
    const row = await p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        name: `${name}-${suffix}`,
        email: `${name}-${suffix}@example.invalid`,
        password: randomBytes(24).toString("hex"),
        roles,
      },
    });
    users.push(row.id);
    return row;
  };
  leader = await user("review-high", ["president"]);
  manager = await user("review-manager", ["member"]);
  applicant = await user("review-applicant", ["member"]);
  outsider = await user("review-outsider", ["member"]);
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成复核社群",
        slug: `team-review-${suffix}`,
        _status: "published",
      },
    })
  ).id;
  manager = await p.update({
    collection: "users",
    id: manager.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: [
        { game, status: "active", handleJoins: true, publishContent: true },
      ],
    },
  });
});
afterAll(async () => {
  if (!p) return;
  for (const collection of [
    "team-memberships",
    "team-join-applications",
    "team-recruitments",
    "team-establishment-applications",
    "teams",
  ] as const)
    await p.delete({
      collection,
      overrideAccess: true,
      where: { game: { equals: game } },
    });
  for (const id of users)
    await p.delete({
      collection: "users",
      id,
      overrideAccess: true,
      context: { system: true },
    });
  if (game)
    await p.delete({ collection: "games", id: game, overrideAccess: true });
  await db?.end();
  await p.destroy();
});
it("既有CMS归档同步生命周期；低权限两种恢复拒绝，旧revision/并发不得清除归档", async () => {
  const team = await createTeam("合成归档权限队"),
    { application } = await join(team);
  await decideTeamJoinApplication(
    p,
    manager,
    application.id,
    "approved",
    "",
    application.updatedAt,
  );
  let doc = await p.findByID({
    collection: "teams",
    id: team,
    user: leader,
    overrideAccess: false,
  });
  const before = doc.updatedAt;
  doc = await p.update({
    collection: "teams",
    id: team,
    user: leader,
    overrideAccess: false,
    data: { archived: true },
  });
  expect(doc.archived).toBe(true);
  expect(doc.teamStatus).toBe("archived");
  for (const status of ["active", "resting"])
    await expect(
      changeTeamLifecycle(p, manager, team, status, doc.updatedAt),
    ).rejects.toMatchObject({ status: 403 });
  await expect(
    changeTeamLifecycle(p, leader, team, "active", before),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    await getActiveTeamMembership(p, { teamID: team, userID: applicant.id }),
  ).toBeNull();
  expect(await listActiveTeamMemberships(p, { teamID: team })).toEqual([]);
  // Existing pre-fix inconsistent row: one flag alone is still authoritative for restoration checks.
  await db.query(
    "UPDATE teams SET team_status='active',archived=true WHERE id=$1",
    [team],
  );
  doc = await p.findByID({
    collection: "teams",
    id: team,
    user: leader,
    overrideAccess: false,
  });
  for (const status of ["active", "resting"])
    await expect(
      changeTeamLifecycle(p, manager, team, status, doc.updatedAt),
    ).rejects.toMatchObject({ status: 403 });
  expect(
    await getActiveTeamMembership(p, { teamID: team, userID: applicant.id }),
  ).toBeNull();
  expect(await listActiveTeamMemberships(p, { teamID: team })).toEqual([]);
  const restored = await changeTeamLifecycle(
    p,
    leader,
    team,
    "resting",
    doc.updatedAt,
  );
  expect(restored.archived).toBe(false);
  expect(
    await getActiveTeamMembership(p, { teamID: team, userID: applicant.id }),
  ).not.toBeNull();
  const revision = restored.updatedAt;
  await p.update({
    collection: "teams",
    id: team,
    user: leader,
    overrideAccess: false,
    data: { archived: true },
  });
  const attempts = await Promise.allSettled([
    changeTeamLifecycle(p, manager, team, "active", revision),
    changeTeamLifecycle(p, manager, team, "resting", revision),
  ]);
  expect(attempts.every((result) => result.status === "rejected")).toBe(true);
  doc = await p.findByID({
    collection: "teams",
    id: team,
    user: leader,
    overrideAccess: false,
  });
  expect(doc.archived).toBe(true);
  const unarchived = await p.update({
    collection: "teams",
    id: team,
    user: leader,
    overrideAccess: false,
    data: { archived: false },
  });
  expect(unarchived.teamStatus).toBe("active");
  expect(
    await getActiveTeamMembership(p, { teamID: team, userID: applicant.id }),
  ).not.toBeNull();
});
it.each(["draft", "team-archived"] as const)(
  "%s隐藏后本人只能读取旧snapshot；旁人/匿名拒绝，当前配置不泄漏且不能修改重提",
  async (mode) => {
    const team = await createTeam(`合成回执${mode}`),
      { batch, application, info } = await join(team);
    const marker = `PRIVATE-CURRENT-${mode}-${suffix}`;
    await saveTeamRecruitment(p, manager, {
      teamID: team,
      id: batch.id,
      revision: batch.updatedAt,
      title: marker,
      status: mode === "draft" ? "draft" : "open",
      form: {
        ...form,
        intro: marker,
        questions: [
          ...form.questions,
          { id: "privateNew", label: marker, type: "text", required: true },
        ],
      },
    });
    if (mode === "team-archived") {
      const doc = await p.findByID({
        collection: "teams",
        id: team,
        user: leader,
        overrideAccess: false,
      });
      await changeTeamLifecycle(p, manager, team, "archived", doc.updatedAt);
    }
    await expect(
      p.findByID({
        collection: "team-recruitments",
        id: batch.id,
        user: applicant,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
    const historical = await teamRecruitmentInfo(p, applicant, batch.id);
    expect(historical.readOnly).toBe(true);
    expect(historical.state).toBe("历史申请只读");
    expect(historical.form.enabled).toBe(false);
    expect(historical.form.closed).toBe(true);
    expect(historical.version).toBe(info.version);
    expect(historical.own?.answers).toEqual(answers);
    expect(JSON.stringify(historical)).not.toContain(marker);
    expect(historical.form.questions.map((q) => q.id)).not.toContain(
      "privateNew",
    );
    await expect(
      teamRecruitmentInfo(p, outsider, batch.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(teamRecruitmentInfo(p, null, batch.id)).rejects.toMatchObject({
      status: 401,
    });
    for (const action of ["draft", "submit"] as const)
      await expect(
        saveTeamJoinApplication(p, applicant, batch.id, {
          action,
          version: historical.version,
          revision: application.updatedAt,
          answers,
        }),
      ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await p.findByID({
          collection: "team-join-applications",
          id: application.id,
          user: applicant,
          overrideAccess: false,
        })
      ).answers,
    ).toEqual(answers);
  },
);
