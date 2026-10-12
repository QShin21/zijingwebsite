import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import pg from "pg";
import { createLocalReq, getPayload, type Payload } from "payload";
import { afterAll, beforeAll, expect, it } from "vitest";
import config from "../src/payload.config";
import type { TeamHonorRecord, User } from "../src/payload-types";
import { teamHonorService } from "../src/lib/team-honor-service";
import {
  getActiveTeamMembership,
  getTeamMembership,
} from "../src/lib/team-memberships";
import { createCoreTeamHonorAuthority } from "../src/lib/team-honor-core-adapter";
import {
  seedHonorCoreChain,
  cleanHonorCoreChain,
} from "./team-honor-core-fixtures";

let p: Payload,
  leader: User,
  reviewer: User,
  player: User,
  outsider: User,
  game: number;
let chain: Awaited<ReturnType<typeof seedHonorCoreChain>>;
let picture: string;
const suffix = randomBytes(6).toString("hex"),
  records: number[] = [];
async function submit() {
  const saved = await teamHonorService.change(p, player, "submit", {
    input: {
      team: chain.team.id,
      title: "合成真实权威荣誉",
      competition: "合成联调赛事",
      placing: "合成联调奖项",
      date: "2020-10-01",
      description: "证明当前有效成员可补录历史成绩，不用 joinedAt 推断获奖资格",
      images: [{ source: picture, caption: "合成联调证据" }],
    },
  });
  records.push(saved.id);
  return saved;
}
async function approve(record: TeamHonorRecord) {
  return teamHonorService.change(p, reviewer, "approve", {
    id: record.id,
    revision: record.revision,
    submittedVersion: record.submittedVersion,
  });
}
async function restoreMember() {
  await p.update({
    collection: "team-memberships",
    id: chain.memberships.get(player.id)!,
    overrideAccess: true,
    user: leader,
    context: { system: true, teamCoreWrite: true },
    data: { status: "active", leftAt: null, revokedAt: null },
  });
}
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    (!url.pathname.endsWith("_synthetic") && process.env.CI !== "true")
  )
    throw new Error("Dedicated synthetic loopback only");
  p = await getPayload({ config, key: "honor-real-core-" + suffix });
  async function actor(label: string, roles: User["roles"]) {
    return p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        name: label + "-" + suffix,
        email: label + "-" + suffix + "@example.invalid",
        password: randomBytes(24).toString("hex"),
        roles,
      },
    });
  }
  leader = await actor("honor-core-leader", ["president"]);
  reviewer = await actor("honor-core-reviewer", ["member"]);
  player = await actor("honor-core-player", ["member"]);
  outsider = await actor("honor-core-outsider", ["backbone"]);
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成真实权威社群",
        slug: "honor-core-game-" + suffix,
        _status: "published",
      },
    })
  ).id;
  reviewer = await p.update({
    collection: "users",
    id: reviewer.id,
    overrideAccess: false,
    user: leader,
    data: {
      communityOffices: [
        { game, status: "active", handleJoins: true, reviewShowcase: true },
      ],
    },
  });
  chain = await seedHonorCoreChain(
    p,
    game,
    reviewer,
    [player, reviewer],
    suffix,
  );
  picture =
    "data:image/png;base64," +
    (
      await sharp({
        create: { width: 20, height: 20, channels: 3, background: "purple" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
});
afterAll(async () => {
  if (!p) return;
  if (records.length) {
    await p.delete({
      collection: "audit",
      overrideAccess: true,
      where: {
        object: { in: records.map((id) => "team-honor-records:" + id) },
      },
    });
    await p.delete({
      collection: "team-honor-records",
      overrideAccess: true,
      where: { id: { in: records } },
    });
  }
  if (chain) await cleanHonorCoreChain(p, chain);
  for (const user of [leader, reviewer, player, outsider])
    if (user)
      await p.delete({
        collection: "users",
        id: user.id,
        overrideAccess: true,
        context: { system: true },
      });
  if (game)
    await p.delete({ collection: "games", id: game, overrideAccess: true });
  await p.destroy();
});
it("真实读取接口核验批准建队链、当前成员与账号；普通社群管理员和骨干身份不等于队员", async () => {
  expect(
    (
      await getActiveTeamMembership(p, {
        teamID: chain.team.id,
        userID: player.id,
      })
    )?.id,
  ).toBe(chain.memberships.get(player.id));
  const available = await teamHonorService.availableTeams(p, player);
  expect(available[0].id).toBe(chain.memberships.get(player.id));
  const current = await submit();
  expect(current.membershipRef).toBe(chain.memberships.get(player.id));
  expect((await approve(current)).state).toBe("approved");
  await expect(
    teamHonorService.change(p, outsider, "submit", {
      input: { team: chain.team.id, title: "合成非队员" },
    }),
  ).rejects.toThrow("有效成员");
  await p.update({
    collection: "team-establishment-applications",
    id: chain.establishment.id,
    overrideAccess: true,
    user: leader,
    context: { system: true, teamCoreWrite: true },
    data: { status: "returned" },
  });
  expect(
    await getActiveTeamMembership(p, {
      teamID: chain.team.id,
      userID: player.id,
    }),
  ).toBeNull();
  await expect(submit()).rejects.toThrow("有效成员");
  await p.update({
    collection: "team-establishment-applications",
    id: chain.establishment.id,
    overrideAccess: true,
    user: leader,
    context: { system: true, teamCoreWrite: true },
    data: { status: "approved" },
  });
});
it("真实 revoked/leftAt 关系阻断写入和待审批准，历史已批准作者与档案保留", async () => {
  await restoreMember();
  const history = await approve(await submit()),
    waiting = await submit();
  await p.update({
    collection: "team-memberships",
    id: chain.memberships.get(player.id)!,
    overrideAccess: true,
    user: leader,
    context: { system: true, teamCoreWrite: true },
    data: {
      status: "revoked",
      leftAt: new Date().toISOString(),
      revokedAt: new Date().toISOString(),
    },
  });
  expect(
    (await getTeamMembership(p, { teamID: chain.team.id, userID: player.id }))
      ?.status,
  ).toBe("revoked");
  expect(
    await getActiveTeamMembership(p, {
      teamID: chain.team.id,
      userID: player.id,
    }),
  ).toBeNull();
  await expect(submit()).rejects.toThrow("有效成员");
  await expect(approve(waiting)).rejects.toThrow("有效成员");
  expect(
    (
      await teamHonorService.archives(p, { team: chain.team.id })
    )[0].records.some(
      (record) => record.key === "team-honor-records:" + history.id,
    ),
  ).toBe(true);
  expect(
    (
      await p.findByID({
        collection: "team-honor-records",
        id: history.id,
        user: player,
        overrideAccess: false,
        depth: 0,
      })
    ).author,
  ).toBe(player.id);
});
it("真实队伍归档/账号停用阻断权限，队伍档案同步撤下", async () => {
  await restoreMember();
  await p.update({
    collection: "users",
    id: player.id,
    user: leader,
    overrideAccess: false,
    data: { accountStatus: "suspended" },
  });
  expect(
    await getActiveTeamMembership(p, {
      teamID: chain.team.id,
      userID: player.id,
    }),
  ).toBeNull();
  await expect(submit()).rejects.toThrow("停用");
  await p.update({
    collection: "users",
    id: player.id,
    user: leader,
    overrideAccess: false,
    data: { accountStatus: "active" },
  });
  await p.update({
    collection: "teams",
    id: chain.team.id,
    overrideAccess: true,
    user: leader,
    context: { system: true, teamCoreWrite: true },
    data: { teamStatus: "archived" },
  });
  expect(await teamHonorService.archives(p, { team: chain.team.id })).toEqual(
    [],
  );
  await expect(submit()).rejects.toThrow("有效成员");
  await expect(
    p.update({
      collection: "teams",
      id: chain.team.id,
      overrideAccess: true,
      user: reviewer,
      context: { teamCoreWrite: true },
      data: { teamStatus: "active", archived: false },
    }),
  ).rejects.toThrow("高权限");
  const connection = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  await connection.connect();
  try {
    // Legacy dual-marker inconsistencies still cannot restore current submission/archive authority.
    for (const [status, archived] of [
      ["active", true],
      ["archived", false],
    ] as const) {
      await connection.query(
        "UPDATE teams SET team_status=$1,archived=$2 WHERE id=$3",
        [status, archived, chain.team.id],
      );
      expect(
        await teamHonorService.archives(p, { team: chain.team.id }),
      ).toEqual([]);
      await expect(submit()).rejects.toThrow("有效成员");
      await expect(
        p.update({
          collection: "teams",
          id: chain.team.id,
          overrideAccess: true,
          user: reviewer,
          context: { teamCoreWrite: true },
          data: { teamStatus: "active", archived: false },
        }),
      ).rejects.toThrow("高权限");
    }
  } finally {
    await connection.end();
  }
  await p.update({
    collection: "teams",
    id: chain.team.id,
    overrideAccess: true,
    user: leader,
    context: { system: true, teamCoreWrite: true },
    data: { teamStatus: "active", archived: false },
  });
});
it("真实成员行锁使退出和荣誉写入串行化，不使用缓存有效关系越过已完成退出", async () => {
  await restoreMember();
  const connection = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  await connection.connect();
  const req = await createLocalReq({}, p);
  req.user = { ...player, collection: "users" };
  const transaction = await p.db.beginTransaction({
    isolationLevel: "serializable",
  });
  if (transaction == null) throw new Error("Synthetic transaction unavailable");
  req.transactionID = transaction;
  const authority = createCoreTeamHonorAuthority({ getActiveTeamMembership });
  let exit: Promise<pg.QueryResult> | undefined;
  try {
    await authority.activeMembership(req, player.id, chain.team.id);
    await connection.query("SET lock_timeout='3s'");
    let settled = false;
    exit = connection
      .query(
        "UPDATE team_memberships SET status='revoked',left_at=now(),revoked_at=now() WHERE id=$1",
        [chain.memberships.get(player.id)],
      )
      .finally(() => {
        settled = true;
      });
    // A short scheduling window verifies that a real SQL update is blocked by the live authority's share lock.
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(settled).toBe(false);
    await p.db.commitTransaction(await req.transactionID!);
    req.transactionID = undefined;
    await exit;
    await expect(submit()).rejects.toThrow("有效成员");
  } finally {
    if (req.transactionID)
      await p.db.rollbackTransaction(await req.transactionID);
    if (exit) await exit.catch(() => null);
    await connection.end();
  }
});
