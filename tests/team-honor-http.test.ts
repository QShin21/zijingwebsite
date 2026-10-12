import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getPayload, type Payload } from "payload";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { teamHonorHTTP } from "../src/lib/team-honor-http";
import { discardHonorVideo } from "../src/lib/team-honor-videos";
import {
  seedHonorCoreChain,
  cleanHonorCoreChain,
} from "./team-honor-core-fixtures";

let p: Payload,
  leader: User,
  reviewer: User,
  player: User,
  outsider: User,
  otherReviewer: User;
let game: number, otherGame: number, picture: string;
let chain: Awaited<ReturnType<typeof seedHonorCoreChain>>;
const suffix = randomBytes(6).toString("hex"),
  password = randomBytes(24).toString("hex");
const tokens = new Map<number, string>(),
  records: number[] = [],
  videos: string[] = [];
const base = process.env.SERVER_URL || "http://localhost:3000";
function input() {
  return {
    team: chain.team.id,
    title: "合成 HTTP 荣誉",
    competition: "合成接口赛事",
    placing: "合成接口奖项",
    date: "2026-10-01",
    description: "合成隔离 HTTP 测试材料",
    images: [{ source: picture, caption: "合成接口证据" }],
  };
}
async function call(
  actor: User | null,
  data?: object,
  id?: number,
  extraHeaders: Record<string, string> = {},
  query = "",
) {
  const headers = new Headers(extraHeaders);
  if (actor && !headers.has("authorization") && !headers.has("cookie"))
    headers.set("authorization", "JWT " + tokens.get(actor.id));
  if (data) headers.set("content-type", "application/json");
  const response = await teamHonorHTTP(
    p,
    new Request(base + "/api/team-honors" + (id ? "/" + id : "") + query, {
      method: data ? "POST" : "GET",
      headers,
      ...(data ? { body: JSON.stringify(data) } : {}),
    }),
    id,
  );
  const body = await response.json();
  if (response.status === 201) records.push(body.record.id);
  return { response, body };
}
beforeAll(async () => {
  const dbURL = new URL(process.env.DATABASE_URL!);
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(dbURL.hostname) ||
    (!dbURL.pathname.endsWith("_synthetic") && process.env.CI !== "true")
  )
    throw new Error("Dedicated synthetic loopback only");
  p = await getPayload({ config, key: "honor-http-" + suffix });
  async function actor(label: string, roles: User["roles"]) {
    const user = await p.create({
      collection: "users",
      overrideAccess: true,
      context: { system: true },
      data: {
        name: label + "-" + suffix,
        email: label + "-" + suffix + "@example.invalid",
        password,
        roles,
      },
    });
    const result = await p.login({
      collection: "users",
      data: { email: user.email, password },
    });
    if (!result.token) throw new Error("Synthetic login required");
    tokens.set(user.id, result.token);
    return user;
  }
  leader = await actor("honor-http-leader", ["president"]);
  reviewer = await actor("honor-http-reviewer", ["member"]);
  player = await actor("honor-http-player", ["member"]);
  outsider = await actor("honor-http-outsider", ["backbone"]);
  otherReviewer = await actor("honor-http-other", ["member"]);
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成接口社群",
        slug: "honor-http-" + suffix,
        _status: "published",
      },
    })
  ).id;
  otherGame = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成接口其他社群",
        slug: "honor-http-other-" + suffix,
        _status: "published",
      },
    })
  ).id;
  reviewer = await p.update({
    collection: "users",
    id: reviewer.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: [
        { game, status: "active", reviewShowcase: true, handleJoins: true },
      ],
    },
  });
  await p.update({
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
        create: { width: 22, height: 22, channels: 3, background: "purple" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
});
beforeEach(async () => {
  if (!chain) return;
  await p.update({
    collection: "team-memberships",
    id: chain.memberships.get(player.id)!,
    user: leader,
    overrideAccess: true,
    context: { system: true, teamCoreWrite: true },
    data: { status: "active", leftAt: null, revokedAt: null },
  });
  reviewer = await p.update({
    collection: "users",
    id: reviewer.id,
    user: leader,
    overrideAccess: false,
    data: {
      communityOffices: [
        { game, status: "active", reviewShowcase: true, handleJoins: true },
      ],
    },
  });
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
  for (const url of videos) await discardHonorVideo(url);
  if (chain) await cleanHonorCoreChain(p, chain);
  for (const user of [leader, reviewer, player, outsider, otherReviewer])
    if (user)
      await p.delete({
        collection: "users",
        id: user.id,
        overrideAccess: true,
        context: { system: true },
      });
  for (const id of [game, otherGame])
    if (id) await p.delete({ collection: "games", id, overrideAccess: true });
  await p.destroy();
});
it("原生 JWT 和同源 cookie 可写；跨源或无 Origin cookie 写入被拒，失效 JWT 不回退 cookie", async () => {
  const cookie = "payload-token=" + tokens.get(player.id);
  for (const origin of [
    undefined,
    "https://attacker.example.invalid",
    "null",
  ]) {
    expect(
      (
        await call(null, { action: "save", input: input() }, undefined, {
          cookie,
          ...(origin ? { origin } : {}),
        })
      ).response.status,
    ).toBe(403);
  }
  expect(
    (
      await call(null, { action: "save", input: input() }, undefined, {
        cookie,
        origin: new URL(base).origin,
      })
    ).response.status,
  ).toBe(201);
  expect(
    (await call(player, { action: "save", input: input() })).response.status,
  ).toBe(201);
  expect(
    (
      await call(null, { action: "save", input: input() }, undefined, {
        cookie,
        authorization: "JWT invalid.signature.token",
      })
    ).response.status,
  ).toBe(401);
  expect((await call(null)).response.status).toBe(401);
});
it("HTTP 仅当前真实队员能投稿，私人 DTO 不暴露账户/成员/审计，跨社群及骨干无全局材料", async () => {
  const saved = await call(player, { action: "submit", input: input() });
  expect(saved.response.status).toBe(201);
  for (const key of [
    "author",
    "membershipRef",
    "approvedSnapshot",
    "history",
    "videoURL",
  ])
    expect(saved.body.record).not.toHaveProperty(key);
  for (const actor of [outsider, otherReviewer]) {
    expect(
      (await call(actor, { action: "save", input: input() })).response.status,
    ).toBe(403);
    expect(
      (await call(actor, undefined, saved.body.record.id)).response.status,
    ).toBe(404);
    expect(
      (await call(actor, undefined, undefined, {}, "?view=review")).body.docs,
    ).toEqual([]);
  }
  const mine = await call(player);
  expect(mine.body.teams.map((row: { id: number }) => row.id)).toEqual([
    chain.team.id,
  ]);
  expect(
    (await call(reviewer, undefined, saved.body.record.id)).body.record
      .canReview,
  ).toBe(true);
  const self = (await call(reviewer, { action: "submit", input: input() })).body
    .record;
  expect(
    (
      await call(
        reviewer,
        {
          action: "approve",
          revision: self.revision,
          submittedVersion: self.submittedVersion,
        },
        self.id,
      )
    ).response.status,
  ).toBe(403);
});
it("审核需正确修订和提交版本，重复批准失败，退回说明/撤回/改稿重提通过同一事务服务", async () => {
  let current = (await call(player, { action: "submit", input: input() })).body
    .record;
  expect(
    (
      await call(
        reviewer,
        { action: "return", revision: current.revision },
        current.id,
      )
    ).response.status,
  ).toBe(400);
  current = (
    await call(
      reviewer,
      { action: "return", revision: current.revision, note: "合成补证说明" },
      current.id,
    )
  ).body.record;
  expect(current.state).toBe("returned");
  current = (
    await call(
      player,
      {
        action: "submit",
        revision: current.revision,
        input: { description: "合成修改重提" },
      },
      current.id,
    )
  ).body.record;
  current = (
    await call(
      player,
      { action: "withdraw", revision: current.revision },
      current.id,
    )
  ).body.record;
  expect(current.state).toBe("withdrawn");
  current = (
    await call(
      player,
      { action: "submit", revision: current.revision, input: {} },
      current.id,
    )
  ).body.record;
  expect(
    (
      await call(
        reviewer,
        {
          action: "approve",
          revision: current.revision,
          submittedVersion: "fake",
        },
        current.id,
      )
    ).response.status,
  ).toBe(409);
  const approval = {
    action: "approve",
    revision: current.revision,
    submittedVersion: current.submittedVersion,
  };
  current = (await call(reviewer, approval, current.id)).body.record;
  expect(current.state).toBe("approved");
  expect((await call(reviewer, approval, current.id)).response.status).toBe(
    409,
  );
  current = (
    await call(
      player,
      {
        action: "save",
        revision: current.revision,
        input: { description: "合成批准后改稿" },
      },
      current.id,
    )
  ).body.record;
  expect(current.state).toBe("draft");
});
it("会话仍有效时撤销成员和管理员能力也立即阻断新写入与审核/材料读取", async () => {
  const current = (await call(player, { action: "submit", input: input() }))
    .body.record;
  await p.update({
    collection: "team-memberships",
    id: chain.memberships.get(player.id)!,
    user: leader,
    overrideAccess: true,
    context: { system: true, teamCoreWrite: true },
    data: {
      status: "revoked",
      leftAt: new Date().toISOString(),
      revokedAt: new Date().toISOString(),
    },
  });
  expect(
    (
      await call(
        player,
        {
          action: "save",
          revision: current.revision,
          input: { title: "合成退队后修改" },
        },
        current.id,
      )
    ).response.status,
  ).toBe(403);
  expect((await call(player)).body.teams).toEqual([]);
  await p.update({
    collection: "users",
    id: reviewer.id,
    user: leader,
    overrideAccess: false,
    data: { communityOffices: [] },
  });
  expect((await call(reviewer, undefined, current.id)).response.status).toBe(
    404,
  );
  expect(
    (
      await call(
        reviewer,
        {
          action: "approve",
          revision: current.revision,
          submittedVersion: current.submittedVersion,
        },
        current.id,
      )
    ).response.status,
  ).toBe(404);
});
it("未知身份/状态/context 与原始视频路径不能写入，正文及媒体格式受限", async () => {
  for (const data of [
    { action: "save", input: input(), author: leader.id },
    {
      action: "save",
      input: {
        ...input(),
        videoURL:
          "/api/showcase-videos/12345678-1234-1234-1234-123456789012.mp4",
      },
    },
    { action: "save", input: input(), context: { system: true } },
    {
      action: "save",
      input: {
        ...input(),
        images: [
          { source: "https://example.invalid/proof.png", caption: "外链" },
        ],
      },
    },
  ])
    expect((await call(player, data)).response.status).toBe(400);
  const response = await teamHonorHTTP(
    p,
    new Request(base + "/api/team-honors", {
      method: "POST",
      headers: {
        authorization: "JWT " + tokens.get(player.id),
        "content-type": "application/json",
        "content-length": String(18 * 1024 * 1024),
      },
      body: "{}",
    }),
  );
  expect(response.status).toBe(413);
});
it("multipart 上传复用静态图片和私有 MP4 字节检查，路径只从服务器生成", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(input()))
    if (key !== "images") form.set(key, String(value));
  form.set("action", "submit");
  const bytes = Buffer.alloc(64);
  bytes.writeUInt32BE(24, 0);
  bytes.write("ftyp", 4);
  bytes.write("isom", 8);
  bytes.write("mp41", 16);
  bytes.write("moov", 24);
  bytes.write("mdat", 32);
  form.set(
    "video",
    new File([bytes], "synthetic-http.mp4", { type: "video/mp4" }),
  );
  const response = await teamHonorHTTP(
    p,
    new Request(base + "/api/team-honors", {
      method: "POST",
      headers: { authorization: "JWT " + tokens.get(player.id) },
      body: form,
    }),
  );
  const body = await response.json();
  expect(response.status).toBe(201);
  records.push(body.record.id);
  expect(body.record.videoHref).toBe(
    "/api/team-honor-evidence/" + body.record.id + "/video?revision=1",
  );
  const stored = await p.findByID({
    collection: "team-honor-records",
    id: body.record.id,
    overrideAccess: true,
    depth: 0,
  });
  videos.push(stored.videoURL!);
  expect(stored.videoURL).toMatch(/^\/api\/private-team-honor-videos\//);
  expect(body.record).not.toHaveProperty("videoURL");
});
