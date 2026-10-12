import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import { randomBytes } from "node:crypto";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import {
  submitTeamEstablishment,
  decideTeamEstablishment,
  withdrawTeamEstablishment,
  saveTeamRecruitment,
  saveTeamJoinApplication,
  decideTeamJoinApplication,
  withdrawTeamJoinApplication,
  closeTeamRecruitment,
  revokeTeamMembership,
  changeTeamLifecycle,
  teamRecruitmentInfo,
  defaultTeamForm,
  normalizeTeamForm,
} from "../src/lib/team-core";
import {
  canManageTeam,
  getActiveTeamMembership,
  getTeamMembership,
  getTeamMembershipByID,
  listActiveTeamMemberships,
  requireActiveTeamMember,
} from "../src/lib/team-memberships";

let p: Payload,
  leader: User,
  vice: User,
  manager: User,
  foreign: User,
  member: User,
  other: User,
  backbone: User;
let game: number, otherGame: number, team: number, batch: number;
const suffix = randomBytes(5).toString("hex"),
  users: number[] = [],
  games: number[] = [];
const form = {
  ...defaultTeamForm,
  end: new Date(Date.now() + 86400000).toISOString(),
};
const answers = {
  gameID: "合成游戏帐号",
  position: "合成位置",
  experience: "合成比赛经历",
  availability: "每周三晚上",
  contact: "synthetic@example.invalid",
};
async function createUser(name: string, roles: User["roles"]) {
  const user = await p.create({
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
  users.push(user.id);
  return user;
}
async function createTeam(name: string) {
  const app = await submitTeamEstablishment(p, manager, {
    gameID: game,
    title: `${name}-${suffix}`,
    reason: "合成训练计划，固定安排训练并负责选拔。",
  });
  return decideTeamEstablishment(
    p,
    vice,
    app.id,
    "approved",
    "合成审核通过",
    app.updatedAt,
  );
}
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(url.hostname)
  )
    throw new Error("Synthetic loopback database only");
  p = await getPayload({ config });
  leader = await createUser("team-president", ["president"]);
  vice = await createUser("team-vice", ["vicePresident"]);
  manager = await createUser("team-manager", ["member"]);
  foreign = await createUser("team-foreign", ["member"]);
  member = await createUser("team-member", ["member"]);
  other = await createUser("team-other", ["member"]);
  backbone = await createUser("team-backbone", ["backbone"]);
  for (const label of ["team-game", "team-other-game"])
    games.push(
      (
        await p.create({
          collection: "games",
          overrideAccess: true,
          context: { system: true },
          data: {
            title: `合成${label}`,
            slug: `${label}-${suffix}`,
            _status: "published",
          },
        })
      ).id,
    );
  [game, otherGame] = games;
  manager = await p.update({
    collection: "users",
    id: manager.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: [
        { game, status: "active", publishContent: true, handleJoins: true },
      ],
    },
  });
  foreign = await p.update({
    collection: "users",
    id: foreign.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: [
        {
          game: otherGame,
          status: "active",
          publishContent: true,
          handleJoins: true,
        },
      ],
    },
  });
}, 30000);
afterAll(async () => {
  if (!p) return;
  // Delete only isolated fixtures, in relation order; production workflows never delete evidence.
  for (const collection of [
    "team-memberships",
    "team-join-applications",
    "team-recruitments",
    "team-establishment-applications",
    "seasons",
    "teams",
  ] as const)
    await p.delete({
      collection,
      overrideAccess: true,
      where:
        collection === "seasons"
          ? {
              team: {
                in: (
                  await p.find({
                    collection: "teams",
                    overrideAccess: true,
                    depth: 0,
                    pagination: false,
                    where: { game: { in: games } },
                    select: { title: true },
                  })
                ).docs.map((t) => t.id),
              },
            }
          : { game: { in: games } },
    });
  for (const id of users)
    await p.delete({
      collection: "users",
      id,
      overrideAccess: true,
      context: { system: true },
    });
  for (const id of games)
    await p.delete({ collection: "games", id, overrideAccess: true });
  await p.destroy();
});
describe.sequential("代表队核心合成数据库", () => {
  it("旧队伍/未批准不能招新；骨干和跨社群不能建队/审核", async () => {
    const legacy = await p.create({
      collection: "teams",
      user: leader,
      overrideAccess: false,
      data: {
        title: "合成旧队",
        slug: `legacy-team-${suffix}`,
        game,
        _status: "published",
      },
    });
    await expect(
      saveTeamRecruitment(p, manager, {
        teamID: legacy.id,
        title: "旧队招新",
        status: "open",
        form,
      }),
    ).rejects.toThrow("尚未批准");
    await expect(
      submitTeamEstablishment(p, backbone, {
        gameID: game,
        title: "骨干越权申请",
        reason: "未授任职不能申请建立此队伍。",
      }),
    ).rejects.toThrow();
    await expect(
      submitTeamEstablishment(p, foreign, {
        gameID: game,
        title: "跨社群申请",
        reason: "跨社群的申请应拒绝处理。",
      }),
    ).rejects.toThrow();
    const app = await submitTeamEstablishment(p, manager, {
      gameID: game,
      title: `合成核心队-${suffix}`,
      reason: "合成训练与选拔计划，使用固定时间训练。",
    });
    await expect(
      decideTeamEstablishment(
        p,
        backbone,
        app.id,
        "approved",
        "",
        app.updatedAt,
      ),
    ).rejects.toThrow();
    await expect(
      decideTeamEstablishment(
        p,
        manager,
        app.id,
        "approved",
        "",
        app.updatedAt,
      ),
    ).rejects.toThrow();
  });
  it("建队申请撤回/退回重提；并发批准只有一个队伍且不改角色", async () => {
    let app = (
      await p.find({
        collection: "team-establishment-applications",
        user: manager,
        overrideAccess: false,
        where: { title: { equals: `合成核心队-${suffix}` } },
      })
    ).docs[0];
    app = await withdrawTeamEstablishment(p, manager, app.id, app.updatedAt);
    app = await submitTeamEstablishment(p, manager, {
      id: app.id,
      revision: app.updatedAt,
      gameID: game,
      title: app.title,
      reason: "撤回后重新提交的合成训练计划。",
    });
    app = await decideTeamEstablishment(
      p,
      vice,
      app.id,
      "returned",
      "补充训练时间",
      app.updatedAt,
    );
    app = await submitTeamEstablishment(p, manager, {
      id: app.id,
      revision: app.updatedAt,
      gameID: game,
      title: app.title,
      reason: "每周固定合成训练时间并负责选拔。",
    });
    const approved = await Promise.all([
      decideTeamEstablishment(p, vice, app.id, "approved", "", app.updatedAt),
      decideTeamEstablishment(p, leader, app.id, "approved", "", app.updatedAt),
    ]);
    expect(approved[0].team).toBe(approved[1].team);
    team = Number(approved[0].team);
    expect(
      (
        await p.find({
          collection: "teams",
          overrideAccess: true,
          where: { establishmentApplication: { equals: app.id } },
        })
      ).totalDocs,
    ).toBe(1);
    const user = await p.findByID({
      collection: "users",
      id: manager.id,
      overrideAccess: true,
    });
    expect(user.roles).toEqual(["member"]);
    expect(user.teams ?? []).toEqual([]);
    expect(await canManageTeam(p, manager, team)).toBe(true);
    expect(await canManageTeam(p, foreign, team)).toBe(false);
    const record = await saveTeamRecruitment(p, manager, {
      teamID: team,
      title: "合成核心招新",
      status: "open",
      form,
    });
    batch = record.id;
  });
  it("普通用户/骨干看不到他人申请；直接REST集合写路径拒绝", async () => {
    const info = await teamRecruitmentInfo(p, member, batch);
    const app = await saveTeamJoinApplication(p, member, batch, {
      action: "submit",
      version: info.version,
      answers,
    });
    await expect(
      p.findByID({
        collection: "team-join-applications",
        id: app.id,
        user: other,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
    await expect(
      p.findByID({
        collection: "team-join-applications",
        id: app.id,
        user: backbone,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
    expect(
      (
        await p.findByID({
          collection: "team-join-applications",
          id: app.id,
          user: manager,
          overrideAccess: false,
        })
      ).answers,
    ).toEqual(answers);
    await expect(
      p.update({
        collection: "team-join-applications",
        id: app.id,
        user: member,
        overrideAccess: false,
        data: { status: "approved" },
      }),
    ).rejects.toThrow();
    await expect(
      decideTeamJoinApplication(
        p,
        foreign,
        app.id,
        "approved",
        "",
        app.updatedAt,
      ),
    ).rejects.toThrow();
    await expect(
      p.find({
        collection: "team-memberships",
        user: null,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
  });
  it("重复申请/批准幂等，只有一份成员关系，批准不授管理权", async () => {
    const info = await teamRecruitmentInfo(p, member, batch);
    const records = await Promise.all([
      saveTeamJoinApplication(p, member, batch, {
        action: "submit",
        version: info.version,
        answers,
      }),
      saveTeamJoinApplication(p, member, batch, {
        action: "submit",
        version: info.version,
        answers,
      }),
    ]);
    expect(records[0].id).toBe(records[1].id);
    const results = await Promise.all([
      decideTeamJoinApplication(
        p,
        manager,
        records[0].id,
        "approved",
        "",
        records[0].updatedAt,
      ),
      decideTeamJoinApplication(
        p,
        manager,
        records[0].id,
        "approved",
        "",
        records[0].updatedAt,
      ),
    ]);
    expect(results.every((app) => app.status === "approved")).toBe(true);
    const membership = await getActiveTeamMembership(p, {
      teamID: team,
      userID: member.id,
    });
    expect(membership?.status).toBe("active");
    expect((await listActiveTeamMemberships(p, { teamID: team })).length).toBe(
      1,
    );
    expect(
      (await getTeamMembershipByID(p, { membershipID: membership!.id }))
        ?.userID,
    ).toBe(member.id);
    const fresh = await p.findByID({
      collection: "users",
      id: member.id,
      overrideAccess: true,
    });
    expect(fresh.roles).toEqual(["member"]);
    expect(fresh.communityOffices ?? []).toEqual([]);
    expect(fresh.teams ?? []).toEqual([]);
    await expect(
      saveTeamJoinApplication(p, member, batch, {
        action: "submit",
        version: info.version,
        answers,
      }),
    ).rejects.toThrow();
  });
  it("草稿、待审改稿、退回、撤回和重提均保留同一回执", async () => {
    const info = await teamRecruitmentInfo(p, other, batch);
    let app = await saveTeamJoinApplication(p, other, batch, {
      action: "draft",
      version: info.version,
      answers: { gameID: "草稿账号" },
    });
    expect(app.status).toBe("draft");
    const id = app.id;
    app = await saveTeamJoinApplication(p, other, batch, {
      action: "submit",
      revision: app.updatedAt,
      version: info.version,
      answers,
    });
    app = await decideTeamJoinApplication(
      p,
      manager,
      id,
      "returned",
      "请补充训练安排",
      app.updatedAt,
    );
    app = await saveTeamJoinApplication(p, other, batch, {
      action: "submit",
      revision: app.updatedAt,
      version: info.version,
      answers: { ...answers, availability: "周四晚上" },
    });
    const oldRevision = app.updatedAt;
    app = await saveTeamJoinApplication(p, other, batch, {
      action: "draft",
      revision: app.updatedAt,
      version: info.version,
      answers: { ...answers, availability: "改稿" },
    });
    await expect(
      decideTeamJoinApplication(p, manager, id, "approved", "", oldRevision),
    ).rejects.toThrow();
    app = await saveTeamJoinApplication(p, other, batch, {
      action: "submit",
      revision: app.updatedAt,
      version: info.version,
      answers,
    });
    app = await withdrawTeamJoinApplication(p, other, id, app.updatedAt);
    app = await saveTeamJoinApplication(p, other, batch, {
      action: "submit",
      revision: app.updatedAt,
      version: info.version,
      answers,
    });
    expect(app.id).toBe(id);
    expect(app.status).toBe("pending");
  });
  it("表单升级不覆盖原快照，旧版本写入409；管理员按提交版本审核", async () => {
    const old = await teamRecruitmentInfo(p, other, batch);
    const batchDoc = await p.findByID({
      collection: "team-recruitments",
      id: batch,
      user: manager,
      overrideAccess: false,
    });
    await saveTeamRecruitment(p, manager, {
      teamID: team,
      id: batch,
      revision: batchDoc.updatedAt,
      title: batchDoc.title,
      status: "open",
      form: {
        ...form,
        questions: [
          ...form.questions,
          {
            id: "newQuestion",
            label: "新批次补充选拔题",
            type: "text",
            required: true,
          },
        ],
      },
    });
    await expect(
      saveTeamJoinApplication(p, other, batch, {
        action: "submit",
        revision: old.own!.updatedAt,
        version: old.version,
        answers,
      }),
    ).rejects.toThrow("申请表已更新");
    const current = await teamRecruitmentInfo(p, other, batch);
    expect(current.own!.formVersion).toBe(old.version);
    expect((current.own!.answers as typeof answers).gameID).toBe(
      answers.gameID,
    );
    expect(
      (
        await decideTeamJoinApplication(
          p,
          manager,
          old.own!.id,
          "approved",
          "",
          old.own!.updatedAt,
        )
      ).status,
    ).toBe("approved");
    expect(() =>
      normalizeTeamForm({
        ...form,
        questions: [{ id: "bad", label: "身份证号码", type: "text" }],
      }),
    ).toThrow();
  });
  it("撤权立即影响旧身份、成员与申请数据，离队留存事实；重复批准不能复活成员", async () => {
    const membership = await getActiveTeamMembership(p, {
      teamID: team,
      userID: member.id,
    });
    const raw = await p.findByID({
      collection: "team-memberships",
      id: membership!.id,
      user: member,
      overrideAccess: false,
    });
    await revokeTeamMembership(
      p,
      member,
      raw.id,
      raw.updatedAt,
      "合成本人离队",
      true,
    );
    expect(
      await getActiveTeamMembership(p, { teamID: team, userID: member.id }),
    ).toBeNull();
    expect(
      (await getTeamMembership(p, { teamID: team, userID: member.id }))?.leftAt,
    ).toBeTruthy();
    await expect(requireActiveTeamMember(p, member, team)).rejects.toThrow();
    const oldApp = (await teamRecruitmentInfo(p, member, batch)).own!;
    await decideTeamJoinApplication(
      p,
      manager,
      oldApp.id,
      "approved",
      "",
      oldApp.updatedAt,
    );
    expect(
      (await getTeamMembership(p, { teamID: team, userID: member.id }))?.status,
    ).toBe("revoked");
    const stale = manager;
    manager = await p.update({
      collection: "users",
      id: manager.id,
      user: leader,
      overrideAccess: false,
      data: { communityOffices: [] },
    });
    expect(await canManageTeam(p, stale, team)).toBe(false);
    await expect(
      p.findByID({
        collection: "team-join-applications",
        id: oldApp.id,
        user: stale,
        overrideAccess: false,
      }),
    ).rejects.toThrow();
    await expect(
      decideTeamJoinApplication(
        p,
        stale,
        oldApp.id,
        "approved",
        "",
        oldApp.updatedAt,
      ),
    ).rejects.toThrow();
    manager = await p.update({
      collection: "users",
      id: manager.id,
      user: leader,
      overrideAccess: false,
      data: {
        communityOffices: manager.communityOffices!.map((office) => ({
          ...office,
          status: "active",
        })),
      },
    });
    await p.update({
      collection: "users",
      id: other.id,
      user: leader,
      overrideAccess: false,
      data: { accountStatus: "suspended" },
    });
    expect(
      await getActiveTeamMembership(p, { teamID: team, userID: other.id }),
    ).toBeNull();
    expect((await listActiveTeamMemberships(p, { teamID: team })).length).toBe(
      0,
    );
  });
  it("截止/关闭拒绝改稿重提，但允许撤回，休整自动关闭招新", async () => {
    const newTeam = Number((await createTeam("合成截止队")).team);
    let newBatch = await saveTeamRecruitment(p, manager, {
      teamID: newTeam,
      title: "合成截止批次",
      status: "open",
      form,
    });
    const info = await teamRecruitmentInfo(p, member, newBatch.id);
    let app = await saveTeamJoinApplication(p, member, newBatch.id, {
      action: "submit",
      version: info.version,
      answers,
    });
    newBatch = await saveTeamRecruitment(p, manager, {
      teamID: newTeam,
      id: newBatch.id,
      revision: newBatch.updatedAt,
      title: newBatch.title,
      status: "closed",
      form: { ...form, end: new Date(Date.now() - 1000).toISOString() },
    });
    await expect(
      saveTeamJoinApplication(p, member, newBatch.id, {
        action: "submit",
        version: info.version,
        revision: app.updatedAt,
        answers,
      }),
    ).rejects.toThrow();
    app = await withdrawTeamJoinApplication(p, member, app.id, app.updatedAt);
    expect(app.status).toBe("withdrawn");
    await expect(
      saveTeamJoinApplication(p, member, newBatch.id, {
        action: "submit",
        version: info.version,
        revision: app.updatedAt,
        answers,
      }),
    ).rejects.toThrow();
    newBatch = await saveTeamRecruitment(p, manager, {
      teamID: newTeam,
      id: newBatch.id,
      revision: newBatch.updatedAt,
      title: newBatch.title,
      status: "open",
      form,
    });
    const doc = await p.findByID({
      collection: "teams",
      id: newTeam,
      user: leader,
      overrideAccess: false,
    });
    await changeTeamLifecycle(p, manager, newTeam, "resting", doc.updatedAt);
    expect((await teamRecruitmentInfo(p, member, newBatch.id)).state).toBe(
      "招新已关闭",
    );
    await closeTeamRecruitment(
      p,
      manager,
      newBatch.id,
      "archived",
      (
        await p.findByID({
          collection: "team-recruitments",
          id: newBatch.id,
          user: manager,
          overrideAccess: false,
        })
      ).updatedAt,
    );
  });
});
