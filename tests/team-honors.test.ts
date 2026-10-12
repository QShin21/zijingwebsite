import "dotenv/config";
import { APIError, getPayload, type Payload } from "payload";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import config from "../src/payload.config";
import type { TeamHonorRecord, User } from "../src/payload-types";
import {
  createTeamHonorService,
  teamHonorService,
} from "../src/lib/team-honor-service";
import {
  readPublicHonorTeam,
  type HonorMembership,
  type HonorMembershipAuthority,
} from "../src/lib/team-honor-authority";
import type { HonorAction, HonorInput } from "../src/lib/team-honor-model";
import { discardVideo, saveVideo, videoPath } from "../src/lib/showcase-videos";
import { honorVideoResponse } from "../src/lib/team-honor-evidence";

let p: Payload,
  leader: User,
  vice: User,
  reviewer: User,
  otherReviewer: User,
  player: User,
  nonplayer: User,
  backbone: User;
let team: number, otherTeam: number, game: number, otherGame: number;
let picture: string;
const suffix = randomBytes(6).toString("hex"),
  users: User[] = [],
  records: number[] = [],
  legacyIDs: number[] = [],
  videos: string[] = [];
// Explicit synthetic fixture, solely in tests. It is not registered as a collection or a runtime membership fallback.
const active = new Map<string, { id: number; member: number; team: number }>();
const authority: HonorMembershipAuthority = {
  publicTeam: readPublicHonorTeam,
  activeMembership: async (req, member, teamID) => {
    const row = active.get(member + ":" + teamID),
      teamInfo = await readPublicHonorTeam(req, teamID);
    if (!row || !teamInfo?.active)
      throw new APIError("需要当前有效队员身份", 403);
    return { ...row, season: null, teamInfo };
  },
  activeMemberships: async (req, member) => {
    const rows: HonorMembership[] = [];
    for (const row of active.values())
      if (row.member === member) {
        const teamInfo = await readPublicHonorTeam(req, row.team);
        if (teamInfo) rows.push({ ...row, season: null, teamInfo });
      }
    return rows;
  },
};
const service = createTeamHonorService(authority);
const input = (): HonorInput => ({
  team,
  title: "合成荣誉记录",
  competition: "合成赛事",
  placing: "合成奖项",
  date: "2026-10-01",
  description: "只用于隔离测试的获奖说明",
  images: [{ source: picture, caption: "合成获奖证明" }],
  videoURL: null,
});
async function change(
  actor: User,
  action: HonorAction,
  row?: TeamHonorRecord,
  extra: { input?: HonorInput; note?: string } = {},
) {
  const saved = await service.change(p, actor, action, {
    id: row?.id,
    revision: row?.revision,
    submittedVersion: row?.submittedVersion,
    ...extra,
  });
  if (!records.includes(saved.id)) records.push(saved.id);
  return saved;
}
async function pending(actor = player, data = input()) {
  return change(actor, "submit", undefined, { input: data });
}
async function approved() {
  return change(reviewer, "approve", await pending());
}
async function row(id: number, user = player) {
  return p.findByID({
    collection: "team-honor-records",
    id,
    user,
    overrideAccess: false,
    depth: 0,
  });
}
function video(marker = "a") {
  const bytes = Buffer.alloc(64);
  bytes.writeUInt32BE(24, 0);
  bytes.write("ftyp", 4);
  bytes.write("isom", 8);
  bytes.write("mp41", 16);
  bytes.write("moov", 24);
  bytes.write("mdat", 32);
  bytes.write(marker, 40);
  return bytes;
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.pathname.endsWith("_synthetic")
  )
    throw new Error("Dedicated synthetic loopback database required");
  p = await getPayload({ config, key: "team-honor-synthetic" });
  picture =
    "data:image/png;base64," +
    (
      await sharp({
        create: { width: 24, height: 24, channels: 3, background: "purple" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
  async function actor(label: string, roles: User["roles"]) {
    const user = await p.create({
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
    users.push(user);
    return user;
  }
  leader = await actor("honor-leader", ["president"]);
  vice = await actor("honor-vice", ["vicePresident"]);
  reviewer = await actor("honor-reviewer", ["member"]);
  otherReviewer = await actor("honor-other-admin", ["member"]);
  player = await actor("honor-player", ["member"]);
  nonplayer = await actor("honor-nonplayer", ["member"]);
  backbone = await actor("honor-backbone", ["backbone"]);
  async function createGame(label: string) {
    return (
      await p.create({
        collection: "games",
        overrideAccess: true,
        context: { system: true },
        data: {
          title: "合成荣誉社群" + label,
          slug: "honor-" + label + "-" + suffix,
          _status: "published",
        },
      })
    ).id;
  }
  game = await createGame("a");
  otherGame = await createGame("b");
  async function createTeam(label: string, gameID: number) {
    return (
      await p.create({
        collection: "teams",
        overrideAccess: true,
        context: { system: true },
        data: {
          title: "合成代表队" + label,
          slug: "honor-team-" + label + "-" + suffix,
          game: gameID,
          _status: "published",
        },
      })
    ).id;
  }
  team = await createTeam("a", game);
  otherTeam = await createTeam("b", otherGame);
  reviewer = await p.update({
    collection: "users",
    id: reviewer.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: [{ game, status: "active", reviewShowcase: true }],
    },
  });
  otherReviewer = await p.update({
    collection: "users",
    id: otherReviewer.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: [
        { game: otherGame, status: "active", reviewShowcase: true },
      ],
    },
  });
});
beforeEach(async () => {
  active.clear();
  for (const [index, actor] of [player, reviewer, vice].entries())
    active.set(actor.id + ":" + team, {
      id: 1001 + index,
      member: actor.id,
      team,
    });
  await p.update({
    collection: "teams",
    id: team,
    user: leader,
    overrideAccess: false,
    data: { archived: false, _status: "published" },
  });
  reviewer = await p.update({
    collection: "users",
    id: reviewer.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: reviewer.communityOffices!.map((office) => ({
        ...office,
        status: "active" as const,
      })),
    },
  });
  player = await p.update({
    collection: "users",
    id: player.id,
    user: leader,
    overrideAccess: false,
    data: { accountStatus: "active" },
  });
});
afterEach(async () => {
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
  for (const id of legacyIDs)
    await p.delete({ collection: "honors", id, overrideAccess: true });
  for (const url of videos) await discardVideo(url);
  records.length = 0;
  legacyIDs.length = 0;
  videos.length = 0;
});
afterAll(async () => {
  if (!p) return;
  for (const user of users)
    await p.delete({
      collection: "users",
      id: user.id,
      overrideAccess: true,
      context: { system: true },
    });
  for (const id of [team, otherTeam])
    await p.delete({ collection: "teams", id, overrideAccess: true });
  for (const id of [game, otherGame])
    await p.delete({ collection: "games", id, overrideAccess: true });
  await p.destroy();
});

it("隔离适配器默认关闭写入；社群成员、旧分部范围与跨队不是入队资格", async () => {
  await expect(
    teamHonorService.change(p, player, "submit", { input: input() }),
  ).rejects.toThrow("尚未接入");
  await expect(pending(nonplayer)).rejects.toThrow("有效队员");
  const legacyUser = await p.update({
    collection: "users",
    id: nonplayer.id,
    user: leader,
    overrideAccess: false,
    data: { teams: [team] },
  });
  await expect(pending(legacyUser)).rejects.toThrow("有效队员");
  await expect(
    pending(player, { ...input(), team: otherTeam }),
  ).rejects.toThrow("有效队员");
  expect(
    (await service.availableTeams(p, player)).map((item) => item.team),
  ).toEqual([team]);
});
it("完整草稿/提交/撤回/退回修改/重提/拒绝流程沿用同一记录并保留说明", async () => {
  let current = await change(player, "save", undefined, {
    input: { team, title: "合成草稿" },
  });
  const id = current.id;
  expect(current.state).toBe("draft");
  current = await change(player, "submit", current, { input: input() });
  expect(current.state).toBe("pending");
  current = await change(player, "withdraw", current);
  expect(current.state).toBe("withdrawn");
  current = await change(player, "submit", current);
  await expect(
    change(reviewer, "return", current, { note: "" }),
  ).rejects.toThrow("说明");
  current = await change(reviewer, "return", current, {
    note: "请补充证据说明",
  });
  expect(current.reviewNote).toBe("请补充证据说明");
  current = await change(player, "save", current, {
    input: { description: "已补充合成说明" },
  });
  current = await change(player, "submit", current);
  current = await change(reviewer, "reject", current, { note: "合成拒绝理由" });
  expect(current.state).toBe("rejected");
  current = await change(player, "submit", current);
  current = await change(reviewer, "approve", current);
  expect(current.id).toBe(id);
  expect(current.revision).toBe(10);
  expect(current.history).toHaveLength(10);
  const archives = await service.archives(p, { game });
  expect(archives).toHaveLength(1);
  expect(archives[0].records).toHaveLength(1);
});
it("队员管理员与高权限队员必须待审且不能审核自己，骨干不能读取或改所有材料", async () => {
  for (const author of [reviewer, vice]) {
    const current = await pending(author);
    expect(current.state).toBe("pending");
    await expect(change(author, "approve", current)).rejects.toThrow("他人");
    expect((await change(leader, "approve", current)).state).toBe("approved");
  }
  const current = await pending();
  for (const actor of [otherReviewer, nonplayer, backbone]) {
    await expect(row(current.id, actor)).rejects.toThrow();
    await expect(change(actor, "approve", current)).rejects.toThrow();
  }
  await expect(
    p.findByID({
      collection: "team-honor-records",
      id: current.id,
      user: null,
      overrideAccess: false,
      context: { publicHonorProjection: true },
    }),
  ).rejects.toThrow();
});
it("绕过网页伪造状态/上下文不能创建或批准，作者不能更换历史归属", async () => {
  await expect(
    p.create({
      collection: "team-honor-records",
      user: player,
      overrideAccess: false,
      context: { system: true, honorWrite: true },
      data: {
        team,
        title: "合成越权",
        author: player.id,
        authorName: player.name,
        game,
        membershipRef: 1001,
        state: "approved",
        revision: 1,
      },
    }),
  ).rejects.toThrow();
  const current = await pending();
  await expect(
    p.update({
      collection: "team-honor-records",
      id: current.id,
      user: reviewer,
      overrideAccess: false,
      context: { honorWrite: true, honorAction: "approve" },
      data: { state: "approved" },
    }),
  ).rejects.toThrow();
  await expect(
    change(player, "save", current, { input: { team: otherTeam } }),
  ).rejects.toThrow("归属");
  await expect(
    p.delete({
      collection: "team-honor-records",
      id: current.id,
      user: leader,
      overrideAccess: false,
    }),
  ).rejects.toThrow();
});
it("已批准历史不因离队消失，离队后新写入、改稿、撤回和未审批准被阻断", async () => {
  const history = await approved(),
    waiting = await pending();
  active.delete(player.id + ":" + team);
  expect(
    (await service.archives(p, { team }))[0].records.map((item) => item.key),
  ).toEqual(["team-honor-records:" + history.id]);
  expect((await row(history.id)).author).toBe(player.id);
  await expect(pending()).rejects.toThrow("有效队员");
  await expect(
    change(player, "save", history, { input: { title: "离队后改稿" } }),
  ).rejects.toThrow("有效队员");
  await expect(change(player, "withdraw", waiting)).rejects.toThrow("有效队员");
  await expect(change(reviewer, "approve", waiting)).rejects.toThrow(
    "有效队员",
  );
  expect(
    (await change(reviewer, "hide", history, { note: "合成隐藏" })).state,
  ).toBe("hidden");
  expect(await service.archives(p, { team })).toEqual([]);
});
it("当前任职和账号状态实时复核，旧会话不能绕过撤任或停用", async () => {
  const current = await pending(),
    staleReviewer = reviewer;
  reviewer = await p.update({
    collection: "users",
    id: reviewer.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: reviewer.communityOffices!.map((office) => ({
        ...office,
        status: "revoked" as const,
      })),
    },
  });
  await expect(row(current.id, staleReviewer)).rejects.toThrow();
  await expect(change(staleReviewer, "approve", current)).rejects.toThrow();
  const stalePlayer = player;
  player = await p.update({
    collection: "users",
    id: player.id,
    user: leader,
    overrideAccess: false,
    data: { accountStatus: "suspended" },
  });
  await expect(change(stalePlayer, "withdraw", current)).rejects.toThrow(
    "停用",
  );
});
it("重复批准和撤回/审核、改稿/审核并发仅有一方提交，过期页面不能覆盖", async () => {
  let current = await pending();
  let outcomes = await Promise.allSettled([
    change(reviewer, "approve", current),
    change(vice, "approve", current),
  ]);
  expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
    1,
  );
  expect((await row(current.id)).revision).toBe(2);
  await expect(change(reviewer, "approve", current)).rejects.toThrow("更新");
  current = await pending();
  outcomes = await Promise.allSettled([
    change(player, "withdraw", current),
    change(reviewer, "approve", current),
  ]);
  expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
    1,
  );
  current = await pending();
  outcomes = await Promise.allSettled([
    change(player, "save", current, { input: { description: "合成并发改稿" } }),
    change(reviewer, "approve", current),
  ]);
  expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
    1,
  );
});
it("改稿和隐藏实时撤下投影，重提复审更新同一队伍档案，空档案和停用队伍无置顶", async () => {
  let current = await approved();
  const approvedVersion = current.approvedVersion,
    snapshot = current.approvedSnapshot;
  const href = (await service.archives(p, { game }))[0].href;
  current = await change(player, "save", current, {
    input: { description: "合成已批准后修改" },
  });
  expect(current.state).toBe("draft");
  expect(current.approvedSnapshot).toEqual(snapshot);
  expect(current.approvedVersion).toBe(approvedVersion);
  expect(await service.archives(p, { team })).toEqual([]);
  current = await change(player, "submit", current);
  current = await change(reviewer, "approve", current);
  const second = await approved();
  expect(await service.archives(p, { team })).toHaveLength(1);
  expect((await service.archives(p, { team }))[0].href).toBe(href);
  expect((await service.archives(p, { team }))[0].records).toHaveLength(2);
  current = await change(reviewer, "hide", current, { note: "合成撤下" });
  expect((await service.archives(p, { team }))[0].records).toHaveLength(1);
  await change(reviewer, "hide", second, { note: "合成撤下最后一条" });
  expect(await service.archives(p, { team })).toEqual([]);
  current = await change(player, "submit", current);
  await change(reviewer, "approve", current);
  await p.update({
    collection: "teams",
    id: team,
    user: leader,
    overrideAccess: false,
    data: { archived: true },
  });
  expect(await service.archives(p, { game })).toEqual([]);
  await expect(pending()).rejects.toThrow();
});
it("本站 MP4 字节替换/删除撤下批准投影，待审证据变化不能批准，外链不能当证据", async () => {
  await expect(
    pending(player, {
      ...input(),
      images: [],
      videoURL: "https://example.invalid/mutable.mp4",
    }),
  ).rejects.toThrow("外链");
  const url = await saveVideo(
    new File([video()], "synthetic.mp4", { type: "video/mp4" }),
  );
  videos.push(url);
  let current = await pending(player, {
    ...input(),
    images: [],
    videoURL: url,
  });
  current = await change(reviewer, "approve", current);
  expect(
    (await service.archives(p, { team }))[0].records[0].videoVersion,
  ).toMatch(/^[0-9a-f]{64}$/);
  await writeFile(videoPath(url.split("/").pop()!), video("b"));
  expect(await service.archives(p, { team })).toEqual([]);
  current = await change(player, "save", current, {
    input: { description: "合成视频改稿" },
  });
  current = await change(player, "submit", current);
  await writeFile(videoPath(url.split("/").pop()!), video("c"));
  await expect(change(reviewer, "approve", current)).rejects.toThrow("字节");
  await discardVideo(url);
  expect(await service.archives(p, { team })).toEqual([]);
});
it("证据图片变更撤下；匿名投影不含退回说明、成员关系、旧批准快照或历史审计", async () => {
  const current = await approved();
  const dto = (await service.archives(p, { team }))[0].records[0];
  expect(Object.keys(dto)).not.toContain("author");
  for (const field of [
    "history",
    "reviewNote",
    "membershipRef",
    "approvedSnapshot",
    "submittedVersion",
  ])
    expect(Object.keys(dto)).not.toContain(field);
  // Simulate damaged storage outside the controlled write path on synthetic data only.
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("UPDATE team_honor_records SET images=$1 WHERE id=$2", [
      JSON.stringify([
        { source: "data:image/webp;base64,Yg==", caption: "合成篡改" },
      ]),
      current.id,
    ]);
  } finally {
    await db.end();
  }
  expect(await service.archives(p, { team })).toEqual([]);
});
it("历史荣誉兼容纳入同一档案并保留作者/赛季，未核验及草稿不入档且无风采复制", async () => {
  const before = (
    await p.count({ collection: "community-showcase", overrideAccess: true })
  ).totalDocs;
  for (const [index, status] of ["published", "draft", "published"].entries()) {
    const legacy = await p.create({
      collection: "honors",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成旧荣誉" + index,
        slug: "honor-legacy-" + suffix + "-" + index,
        team,
        game,
        competition: "合成旧赛事",
        placing: "合成旧奖项",
        submittedBy: player.id,
        verified: index !== 2,
        sourceURL: "https://example.invalid/legacy-proof",
        _status: status as "published" | "draft",
      },
    });
    legacyIDs.push(legacy.id);
  }
  await approved();
  const archives = await service.archives(p, { game });
  expect(archives).toHaveLength(1);
  expect(archives[0].records).toHaveLength(2);
  expect(archives[0].records.filter((item) => item.legacy)).toHaveLength(1);
  expect(
    (
      await p.findByID({
        collection: "honors",
        id: legacyIDs[0],
        overrideAccess: true,
        depth: 0,
      })
    ).submittedBy,
  ).toBe(player.id);
  active.delete(player.id + ":" + team);
  expect((await service.archives(p, { team }))[0].records).toHaveLength(2);
  expect(
    (await p.count({ collection: "community-showcase", overrideAccess: true }))
      .totalDocs,
  ).toBe(before);
});
it("证据端点按作者/当前审核范围或有效批准版本授权，Range/HEAD 不泄漏待审或隐藏视频", async () => {
  const url = await saveVideo(
    new File([video()], "synthetic-evidence.mp4", { type: "video/mp4" }),
  );
  videos.push(url);
  let current = await pending(player, {
    ...input(),
    images: [],
    videoURL: url,
  });
  const privateRequest = () =>
    new Request(
      "http://localhost:3000/api/team-honor-evidence/" +
        current.id +
        "/video?revision=" +
        current.revision,
    );
  for (const actor of [null, otherReviewer, nonplayer, backbone])
    expect(
      (await honorVideoResponse(p, actor, current.id, privateRequest())).status,
    ).toBe(404);
  expect(
    (await honorVideoResponse(p, player, current.id, privateRequest())).status,
  ).toBe(200);
  expect(
    (
      await honorVideoResponse(p, reviewer, current.id, privateRequest(), true)
    ).headers.get("Content-Length"),
  ).toBe("64");
  const ranges = new Request(privateRequest().url, {
    headers: { Range: "bytes=0-7" },
  });
  const response = await honorVideoResponse(p, reviewer, current.id, ranges);
  expect(response.status).toBe(206);
  expect(await response.arrayBuffer()).toHaveProperty("byteLength", 8);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  current = await change(reviewer, "approve", current);
  const publicRequest = new Request(
    "http://localhost:3000/api/team-honor-evidence/" +
      current.id +
      "/video?version=" +
      current.approvedVersion,
  );
  expect(
    (await honorVideoResponse(p, null, current.id, publicRequest)).status,
  ).toBe(200);
  expect(
    (
      await honorVideoResponse(
        p,
        null,
        current.id,
        new Request(
          publicRequest.url.replace(current.approvedVersion!, "fake"),
        ),
      )
    ).status,
  ).toBe(404);
  current = await change(reviewer, "hide", current, { note: "合成隐藏视频" });
  expect(
    (await honorVideoResponse(p, null, current.id, publicRequest)).status,
  ).toBe(404);
  expect(
    (await honorVideoResponse(p, otherReviewer, current.id, privateRequest()))
      .status,
  ).toBe(404);
});
