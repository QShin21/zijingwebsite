import "dotenv/config";
import { getPayload, type Payload } from "payload";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import config from "../src/payload.config";
import {
  saveTeamProfile as submitProfile,
  readTeamProfiles,
} from "../src/lib/team-profiles";
import { emptyTeamProfile } from "../src/lib/team-profiles-model";
import { getActiveTeamMembership } from "../src/lib/team-memberships";
import {
  profileFixture,
  saveLoadedProfile as saveTeamProfile,
} from "./team-profiles-fixture";

let p: Payload, f: Awaited<ReturnType<typeof profileFixture>>;
const draft = () => ({
  ...emptyTeamProfile(),
  displayName: "合成队员公开昵称",
  position: "中路",
  biography: "这是一条合成公开介绍。",
});
beforeAll(async () => {
  p = await getPayload({ config });
  f = await profileFixture(p);
});
afterAll(async () => {
  if (f) await f.cleanup();
  if (p) await p.destroy();
});
describe("入队周期并发凭据（真实核心关系，无资格 mock）", () => {
  it.each([true, false])(
    "旧周期公开/隐藏资料请求拒绝，刷新新周期明确选择后才可展示：%s",
    async (visible) => {
      const g = await profileFixture(p);
      const value = { ...draft(), visible };
      const stored = async () =>
        (
          await p.find({
            collection: "team-member-profiles",
            overrideAccess: true,
            depth: 0,
            where: { membership: { equals: g.membership.id } },
          })
        ).docs[0];
      try {
        const oldVersion = (await readTeamProfiles(p, g.member, g.first.id)).own
          .membershipVersion;
        await submitProfile(p, g.member, g.first.id, null, value, oldVersion);
        const before = await stored();
        await g.changeMembership({
          status: "revoked",
          revokedAt: new Date().toISOString(),
        });
        await expect(
          submitProfile(p, g.member, g.first.id, 1, value, oldVersion),
        ).rejects.toMatchObject({ status: 403 });
        await g.changeMembership({
          status: "active",
          joinedAt: new Date(Date.now() + 1000).toISOString(),
          revokedAt: null,
          leftAt: null,
        });
        const current = await readTeamProfiles(p, g.member, g.first.id);
        expect(current.own.membershipVersion).not.toBe(oldVersion);
        expect(current.own.profile?.visible).toBe(false);
        expect(current.profiles).toEqual([]);
        for (const version of [
          oldVersion,
          undefined,
          g.membership.joinedAt,
          "v1." + "a".repeat(43),
        ]) {
          await expect(
            submitProfile(
              p,
              g.member,
              g.first.id,
              1,
              { ...value, visible: true },
              version,
            ),
          ).rejects.toMatchObject({
            status: 409,
            data: { code: "PROFILE_PERIOD_CHANGED" },
          });
          expect(await stored()).toEqual(before);
        }
        const newVersion = current.own.membershipVersion;
        await submitProfile(
          p,
          g.member,
          g.first.id,
          1,
          { ...value, visible: false },
          newVersion,
        );
        expect(
          (await readTeamProfiles(p, g.viewer, g.first.id)).profiles,
        ).toEqual([]);
        await submitProfile(
          p,
          g.member,
          g.first.id,
          2,
          { ...value, visible: true },
          newVersion,
        );
        expect(
          (await readTeamProfiles(p, g.viewer, g.first.id)).profiles,
        ).toHaveLength(1);
        // Even an identical idempotent request cannot cross the period boundary.
        await expect(
          submitProfile(
            p,
            g.member,
            g.first.id,
            3,
            { ...value, visible: true },
            oldVersion,
          ),
        ).rejects.toMatchObject({ status: 409 });
        expect((await stored()).revision).toBe(3);
        await g.changeMembership({
          status: "revoked",
          revokedAt: new Date().toISOString(),
        });
        await g.changeMembership({
          status: "active",
          joinedAt: new Date(Date.now() + 2000).toISOString(),
          revokedAt: null,
          leftAt: null,
        });
        await expect(
          submitProfile(
            p,
            g.member,
            g.first.id,
            3,
            { ...value, visible: true },
            newVersion,
          ),
        ).rejects.toMatchObject({ status: 409 });
        expect((await stored()).revision).toBe(3);
        expect(
          (await readTeamProfiles(p, g.viewer, g.first.id)).profiles,
        ).toEqual([]);
      } finally {
        await g.cleanup();
      }
    },
  );
  it("旧周期空编辑器不能新建；凭据不可跨队使用", async () => {
    const g = await profileFixture(p);
    try {
      const old = (await readTeamProfiles(p, g.member, g.first.id)).own
        .membershipVersion;
      await g.changeMembership({ status: "revoked" });
      await g.changeMembership({
        status: "active",
        joinedAt: new Date(Date.now() + 1000).toISOString(),
      });
      await expect(
        submitProfile(
          p,
          g.member,
          g.first.id,
          null,
          { ...draft(), visible: true },
          old,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (
          await p.find({
            collection: "team-member-profiles",
            overrideAccess: true,
            where: { membership: { equals: g.membership.id } },
          })
        ).totalDocs,
      ).toBe(0);
      const current = (await readTeamProfiles(p, g.member, g.first.id)).own
        .membershipVersion;
      await g.enroll(g.second.id);
      await expect(
        submitProfile(p, g.member, g.second.id, null, draft(), current),
      ).rejects.toMatchObject({ status: 409 });
      await submitProfile(p, g.member, g.first.id, null, draft(), current);
      expect(
        (await readTeamProfiles(p, g.viewer, g.first.id)).profiles,
      ).toEqual([]);
    } finally {
      await g.cleanup();
    }
  });
});
describe.sequential("真实核心成员服务 + 简介数据库（仅合成账号）", () => {
  it("调用正式实时资格服务，未入队和普通社群关系不能写", async () => {
    expect(
      (
        await getActiveTeamMembership(p, {
          teamID: f.first.id,
          userID: f.member.id,
        })
      )?.id,
    ).toBe(f.membership.id);
    expect(
      await getActiveTeamMembership(p, {
        teamID: f.first.id,
        userID: f.viewer.id,
      }),
    ).toBeNull();
    await expect(
      saveTeamProfile(p, null, f.first.id, null, draft()),
    ).rejects.toThrow();
    const offices = [
      {
        game: f.game.id,
        status: "active" as const,
        handleJoins: true,
        publishContent: true,
      },
    ];
    await p.update({
      collection: "users",
      id: f.viewer.id,
      overrideAccess: true,
      context: { system: true },
      data: { communityOffices: offices, teams: [f.first.id] },
    });
    await expect(
      saveTeamProfile(p, f.viewer, f.first.id, null, draft()),
    ).rejects.toThrow("入队资格");
    await expect(
      saveTeamProfile(p, f.admin, f.first.id, null, draft()),
    ).rejects.toThrow("入队资格");
  });
  it("首次默认隐藏，同一关系一个简介且名单不泄露隐藏资料", async () => {
    const [saved, duplicate] = await Promise.all([
      saveTeamProfile(p, f.member, f.first.id, null, draft()),
      saveTeamProfile(p, f.member, f.first.id, null, draft()),
    ]);
    expect(duplicate).toEqual(saved);
    expect(saved.visible).toBe(false);
    expect(saved.revision).toBe(1);
    const view = await readTeamProfiles(p, f.viewer, f.first.id);
    expect(view.profiles).toEqual([]);
    expect(view.own).toEqual({
      eligible: false,
      membershipVersion: null,
      profile: null,
    });
    expect(
      (await readTeamProfiles(p, f.member, f.first.id)).own.profile
        ?.displayName,
    ).toBe(draft().displayName);
  });
  it("本人授权后只展示公开 DTO，敏感/资格字段拒绝写入", async () => {
    await expect(
      saveTeamProfile(p, f.member, f.first.id, 1, {
        ...draft(),
        answers: { private: true },
      }),
    ).rejects.toThrow();
    const saved = await saveTeamProfile(p, f.member, f.first.id, 1, {
      ...draft(),
      visible: true,
    });
    expect(saved.revision).toBe(2);
    const view = await readTeamProfiles(p, f.viewer, f.first.id);
    expect(view.profiles).toHaveLength(1);
    expect(Object.keys(view.profiles[0]).sort()).toEqual([
      "avatar",
      "biography",
      "displayName",
      "id",
      "position",
    ]);
    expect(JSON.stringify(view)).not.toMatch(
      /PRIVATE_PROFILE_TEST_ANSWER|"membership"|realName|email|student|contact|reviewNote/,
    );
  });
  it("原始集合 REST/Local 读写关闭，不能用管理员身份代改简介", async () => {
    const record = (
      await p.find({
        collection: "team-member-profiles",
        overrideAccess: true,
        depth: 0,
        where: { membership: { equals: f.membership.id } },
      })
    ).docs[0];
    for (const user of [null, f.viewer, f.admin]) {
      await expect(
        p.find({
          collection: "team-member-profiles",
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow();
      await expect(
        p.update({
          collection: "team-member-profiles",
          id: record.id,
          overrideAccess: false,
          user,
          data: { displayName: "越权昵称" },
        }),
      ).rejects.toThrow();
    }
    await expect(
      p.create({
        collection: "team-member-profiles",
        overrideAccess: false,
        user: f.member,
        data: {
          ...draft(),
          membership: f.membership.id,
          membershipJoinedAt: f.membership.joinedAt,
          revision: 1,
        },
      }),
    ).rejects.toThrow();
  });
  it("裸 active 关系不足：建队批准、队伍状态和游戏状态均由真实核心实时核对", async () => {
    const applicationID =
      typeof f.first.establishmentApplication === "object"
        ? f.first.establishmentApplication!.id
        : f.first.establishmentApplication!;
    const core = {
      user: f.admin,
      overrideAccess: false,
      context: { teamCoreWrite: true },
    } as const;
    await p.update({
      ...core,
      collection: "team-establishment-applications",
      id: applicationID,
      data: { status: "pending" },
    });
    expect(
      await getActiveTeamMembership(p, {
        teamID: f.first.id,
        userID: f.member.id,
      }),
    ).toBeNull();
    expect((await readTeamProfiles(p, f.viewer, f.first.id)).profiles).toEqual(
      [],
    );
    await expect(
      saveTeamProfile(p, f.member, f.first.id, 2, {
        ...draft(),
        visible: true,
      }),
    ).rejects.toThrow("入队资格");
    await p.update({
      ...core,
      collection: "team-establishment-applications",
      id: applicationID,
      data: { status: "approved" },
    });
    await p.update({
      ...core,
      collection: "teams",
      id: f.first.id,
      data: { teamStatus: "unestablished" },
    });
    expect(
      await getActiveTeamMembership(p, {
        teamID: f.first.id,
        userID: f.member.id,
      }),
    ).toBeNull();
    await p.update({
      ...core,
      collection: "teams",
      id: f.first.id,
      data: { teamStatus: "active" },
    });
    await p.update({
      collection: "games",
      id: f.game.id,
      user: f.admin,
      overrideAccess: false,
      data: { archived: true },
    });
    expect((await readTeamProfiles(p, f.viewer, f.first.id)).profiles).toEqual(
      [],
    );
    await expect(
      saveTeamProfile(p, f.member, f.first.id, 2, {
        ...draft(),
        visible: true,
      }),
    ).rejects.toThrow("入队资格");
    await p.update({
      collection: "games",
      id: f.game.id,
      user: f.admin,
      overrideAccess: false,
      data: { archived: false },
    });
    expect(
      await getActiveTeamMembership(p, {
        teamID: f.first.id,
        userID: f.member.id,
      }),
    ).not.toBeNull();
  });
  it("重复保存幂等；不同旧版本修改拒绝且保留既有资料", async () => {
    const retry = await saveTeamProfile(p, f.member, f.first.id, 1, {
      ...draft(),
      visible: true,
    });
    expect(retry.revision).toBe(2);
    await expect(
      saveTeamProfile(p, f.member, f.first.id, 1, {
        ...draft(),
        displayName: "旧页面误覆盖",
      }),
    ).rejects.toThrow("其他页面");
    expect(
      (
        await p.find({
          collection: "team-member-profiles",
          overrideAccess: true,
          where: { membership: { equals: f.membership.id } },
        })
      ).totalDocs,
    ).toBe(1);
  });
  it("并发修改最多一个成功，旧版本不覆盖并可刷新重试", async () => {
    const results = await Promise.allSettled(
      ["并发昵称A", "并发昵称B"].map((displayName) =>
        saveTeamProfile(p, f.member, f.first.id, 2, {
          ...draft(),
          displayName,
          visible: true,
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      (await readTeamProfiles(p, f.member, f.first.id)).own.profile?.revision,
    ).toBe(3);
  });
  it("改队伍由服务器检查新队资格，不把旧简介错存新队", async () => {
    await expect(
      saveTeamProfile(p, f.member, f.second.id, null, draft()),
    ).rejects.toThrow("入队资格");
    await f.enroll(f.second.id);
    await saveTeamProfile(p, f.member, f.second.id, null, {
      ...draft(),
      displayName: "第二队合成昵称",
      visible: true,
    });
    expect(
      (await readTeamProfiles(p, f.viewer, f.second.id)).profiles[0]
        .displayName,
    ).toBe("第二队合成昵称");
    expect(
      (await readTeamProfiles(p, f.viewer, f.first.id)).profiles[0].displayName,
    ).not.toBe("第二队合成昵称");
  });
  it("离队/移除立即过滤，旧页面包括重复请求拒绝保存且数据保留", async () => {
    await f.changeMembership({
      status: "revoked",
      revokedAt: new Date().toISOString(),
      leftAt: new Date().toISOString(),
    });
    expect((await readTeamProfiles(p, f.viewer, f.first.id)).profiles).toEqual(
      [],
    );
    expect((await readTeamProfiles(p, f.member, f.first.id)).own).toEqual({
      eligible: false,
      membershipVersion: null,
      profile: null,
    });
    await expect(
      saveTeamProfile(p, f.member, f.first.id, 3, draft()),
    ).rejects.toThrow("入队资格");
    expect(
      (
        await p.find({
          collection: "team-member-profiles",
          overrideAccess: true,
          where: { membership: { equals: f.membership.id } },
        })
      ).totalDocs,
    ).toBe(1);
  });
  it("重新入队保留唯一简介草稿，新的加入周期需本人重新选择展示", async () => {
    await f.changeMembership({
      status: "active",
      joinedAt: new Date().toISOString(),
      revokedAt: null,
      leftAt: null,
    });
    const view = await readTeamProfiles(p, f.member, f.first.id);
    expect(view.profiles).toEqual([]);
    expect(view.own.profile?.visible).toBe(false);
    expect(view.own.profile?.revision).toBe(3);
    await saveTeamProfile(p, f.member, f.first.id, 3, {
      ...draft(),
      visible: true,
    });
    expect(
      (await readTeamProfiles(p, f.viewer, f.first.id)).profiles,
    ).toHaveLength(1);
  });
  it("本人可再次隐藏，不删除成员关系或公开档案", async () => {
    await saveTeamProfile(p, f.member, f.first.id, 4, draft());
    expect((await readTeamProfiles(p, f.viewer, f.first.id)).profiles).toEqual(
      [],
    );
    expect(
      await getActiveTeamMembership(p, {
        teamID: f.first.id,
        userID: f.member.id,
      }),
    ).not.toBeNull();
  });
  it("账号停用、队伍归档通过核心实时服务撤销展示/写权限", async () => {
    await saveTeamProfile(p, f.member, f.first.id, 5, {
      ...draft(),
      visible: true,
    });
    await p.update({
      collection: "users",
      id: f.member.id,
      overrideAccess: true,
      context: { system: true },
      data: { accountStatus: "suspended" },
    });
    expect((await readTeamProfiles(p, f.viewer, f.first.id)).profiles).toEqual(
      [],
    );
    await expect(
      saveTeamProfile(p, f.member, f.first.id, 6, draft()),
    ).rejects.toThrow("停用");
    await p.update({
      collection: "users",
      id: f.member.id,
      overrideAccess: true,
      context: { system: true },
      data: { accountStatus: "active" },
    });
    await p.update({
      collection: "teams",
      id: f.first.id,
      overrideAccess: false,
      user: f.admin,
      context: { teamCoreWrite: true },
      data: { teamStatus: "archived" },
    });
    expect((await readTeamProfiles(p, f.viewer, f.first.id)).profiles).toEqual(
      [],
    );
    await expect(
      saveTeamProfile(p, f.member, f.first.id, 6, draft()),
    ).rejects.toThrow("入队资格");
  });
});
