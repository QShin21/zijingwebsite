import { browserTestOrigin } from "./browser-test-origin";
import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import pg from "pg";
import { getPayload, type Payload } from "payload";
import { test, expect, type Page } from "@playwright/test";
import config from "../../src/payload.config";
import { writeFile } from "node:fs/promises";
import type { TeamHonorRecord, User } from "../../src/payload-types";
import { teamHonorService as service } from "../../src/lib/team-honor-service";
import { currentHonorVersion } from "../../src/lib/team-honor-service";
import { saveVideo, discardVideo } from "../../src/lib/showcase-videos";
import { discardHonorVideo } from "../../src/lib/team-honor-videos";
import {
  seedHonorCoreChain,
  cleanHonorCoreChain,
} from "../team-honor-core-fixtures";

let p: Payload, leader: User, reviewer: User, otherReviewer: User, player: User;
let game: number,
  otherGame: number,
  team: number,
  approved: TeamHonorRecord,
  pending: TeamHonorRecord;
let chain: Awaited<ReturnType<typeof seedHonorCoreChain>>;
const suffix = randomBytes(7).toString("hex"),
  password = randomBytes(24).toString("hex"),
  slug = "honor-web-" + suffix;
const records: number[] = [],
  showcases: number[] = [],
  legacy: number[] = [];
const videos: string[] = [];
// The web app and fixture preparation use real core reads against a seeded synthetic authority chain.
// The core's establishment/recruitment UI approval path is owned and verified by the core task.
test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    process.env.APP_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    (!url.pathname.endsWith("_synthetic") && process.env.CI !== "true")
  )
    throw new Error("Dedicated synthetic loopback only");
  p = await getPayload({ config, key: "honor-web-" + suffix });
  async function user(label: string, roles: User["roles"]) {
    return p.create({
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
  }
  leader = await user("honor-web-leader", ["president"]);
  reviewer = await user("honor-web-reviewer", ["member"]);
  otherReviewer = await user("honor-web-other", ["member"]);
  player = await user("honor-web-player", ["member"]);
  game = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: { title: "合成网页荣誉社群", slug, _status: "published" },
    })
  ).id;
  otherGame = (
    await p.create({
      collection: "games",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成另一社群",
        slug: slug + "-other",
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
        {
          game,
          status: "active",
          reviewShowcase: true,
          publishContent: true,
          handleJoins: true,
        },
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
  team = chain.team.id;
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
  const image =
    "data:image/png;base64," +
    (
      await sharp({
        create: { width: 30, height: 30, channels: 3, background: "purple" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
  const make = async (title: string) => {
    const row = await service.change(p, player, "submit", {
      input: {
        team,
        title,
        competition: "合成网页赛事",
        placing: "合成网页奖项",
        date: "2026-10-01",
        description: "合成说明，仅用于隔离浏览器验证",
        images: [{ source: image, caption: "合成证据图片" }],
      },
    });
    records.push(row.id);
    return row;
  };
  approved = await make("合成已批准网页荣誉");
  approved = await service.change(p, reviewer, "approve", {
    id: approved.id,
    revision: approved.revision,
    submittedVersion: approved.submittedVersion,
  });
  pending = await make("合成未审私有荣誉");
  legacy.push(
    (
      await p.create({
        collection: "honors",
        overrideAccess: true,
        context: { system: true },
        data: {
          title: "合成历史荣誉网页",
          slug: "honor-web-legacy-" + suffix,
          team,
          game,
          submittedBy: player.id,
          competition: "合成旧比赛",
          placing: "合成旧奖项",
          verified: true,
          sourceURL: "https://example.invalid/legacy-proof",
          _status: "published",
        },
      })
    ).id,
  );
  for (let index = 0; index < 7; index++)
    showcases.push(
      (
        await p.create({
          collection: "community-showcase",
          user: reviewer,
          overrideAccess: false,
          context: { webShowcaseWrite: true },
          data: { title: "合成普通风采 " + index, game, author: reviewer.id },
        })
      ).id,
    );
});
test.afterAll(async () => {
  if (!p) return;
  // A server action can create a record before navigation or a receipt assertion
  // fails. Discover only this run's team and seeded authors before removing its
  // authority chain, so cleanup also covers an interrupted browser response.
  if (chain) {
    const created = await p.find({
      collection: "team-honor-records",
      overrideAccess: true,
      depth: 0,
      pagination: false,
      where: {
        and: [
          { team: { equals: chain.team.id } },
          { game: { equals: game } },
          { author: { in: [...chain.memberships.keys()] } },
        ],
      },
      select: { team: true },
    });
    for (const row of created.docs)
      if (!records.includes(row.id)) records.push(row.id);
  }
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
  for (const id of showcases)
    await p.delete({
      collection: "community-showcase",
      id,
      overrideAccess: true,
    });
  for (const id of legacy)
    await p.delete({ collection: "honors", id, overrideAccess: true });
  for (const url of videos) {
    await discardHonorVideo(url);
    await discardVideo(url).catch(() => {});
  }
  if (chain) await cleanHonorCoreChain(p, chain);
  for (const user of [leader, reviewer, otherReviewer, player])
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
async function login(page: Page, user: User) {
  const response = await page.request.post("/api/users/login", {
    data: { email: user.email, password },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
test("队伍荣誉只有一个置顶档案，普通风采仍为 6+1 分页，稳定详情不含待审材料", async ({
  page,
  request,
}) => {
  await login(page, player);
  const path = "/community/" + slug + "/showcase",
    detail = path + "/team-honors/" + team;
  await page.goto(path);
  const pin = page.locator('[data-team-honor-archive="' + team + '"]');
  await expect(pin).toHaveCount(1);
  await expect(pin).toContainText("置顶");
  await expect(page.locator("[id^=showcase-]")).toHaveCount(6);
  await pin.getByRole("link", { name: "查看完整档案" }).click();
  await expect(page).toHaveURL(detail);
  await expect(
    page.getByRole("heading", { name: "合成已批准网页荣誉", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("合成未审私有荣誉", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("link", { name: "提交队伍荣誉", exact: true })
    .click();
  await expect(page).toHaveURL(
    `/teams/honors?view=mine&team=${team}&game=${game}#honor-editor`,
  );
  await expect(
    page.locator("[data-honor-editor]").getByLabel("所属有效代表队"),
  ).toHaveValue(String(team));
  await page.goto(path + "?page=2");
  await expect(page.locator("[id^=showcase-]")).toHaveCount(1);
  await expect(page.locator("[data-team-honor-archive]")).toHaveCount(0);
  const wrongCommunity = await page.request.get(
    "/community/" + slug + "-other/showcase/team-honors/" + team,
  );
  expect(await wrongCommunity.text()).not.toContain("合成已批准网页荣誉");
  const projected = await request.get("/api/team-honor-archives/" + team);
  expect(projected.status()).toBe(200);
  const body = await projected.text();
  expect(body).toContain("合成已批准网页荣誉");
  expect(body).not.toContain("合成未审私有荣誉");
  for (const field of [
    "membershipRef",
    "reviewNote",
    "history",
    "approvedSnapshot",
  ])
    expect(body).not.toContain(field);
});
test("荣誉档案入口说明投稿资格，筛选范围外可查看全部投稿队伍", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const submit = page.getByRole("link", { name: "提交队伍荣誉", exact: true });
  const eligibility = page.locator("#honor-editor").getByRole("heading", {
    name: "投稿需要当前有效队员身份",
    exact: true,
  });

  await login(page, otherReviewer);
  await page.goto(`/community/${slug}/showcase/team-honors/${team}`);
  await submit.click();
  await expect(eligibility).toBeVisible();
  await expect(page.locator("[data-honor-editor]")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "查看代表队招新与本人记录" }),
  ).toHaveAttribute("href", "/teams/recruitment");

  await login(page, player);
  await page.goto(`/teams/honors?game=${otherGame}`);
  await expect(
    page.getByRole("heading", { name: "暂无已批准的荣誉档案" }),
  ).toBeVisible();
  await submit.click();
  await expect(eligibility).toBeVisible();
  await page.getByRole("link", { name: "查看全部可投稿队伍" }).click();
  await expect(page).toHaveURL("/teams/honors?view=mine#honor-editor");
  await expect(
    page.locator("[data-honor-editor]").getByLabel("所属有效代表队"),
  ).toHaveValue(String(team));
});

test("真实 HTTP JWT 上传及审核；旧共享视频跨集合借用在改稿/退回/隐藏/队伍归档后无法再请求字节", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(180000);
  const context = await browser.newContext();
  try {
    const otherPage = await context.newPage();
    const { token: playerToken } = await login(page, player);
    const { token: reviewerToken } = await login(otherPage, reviewer);
    // Authenticate the other-account copy once; do not introduce unrelated session writes during honor transactions.
    await login(otherPage, otherReviewer);
    // Generate a playable synthetic MP4 on an empty page, isolated from the site's CSP.
    const fixturePage = await browser.newPage();
    const clip = await fixturePage
      .evaluate(async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext("2d")!;
        let frame = 0;
        const draw = () => {
          ctx.fillStyle = "#6633aa";
          ctx.fillRect(0, 0, 320, 180);
          ctx.fillStyle = "white";
          ctx.fillRect((frame++ * 7) % 280, 70, 40, 40);
        };
        draw();
        const stream = canvas.captureStream(24),
          chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream, {
          mimeType: "video/mp4;codecs=avc1.42001E",
        });
        const blob = await new Promise<Blob>((resolve, reject) => {
          recorder.ondataavailable = (event) => chunks.push(event.data);
          recorder.onerror = reject;
          recorder.onstop = () =>
            resolve(new Blob(chunks, { type: "video/mp4" }));
          recorder.start();
          const timer = setInterval(draw, 40);
          setTimeout(() => {
            clearInterval(timer);
            recorder.stop();
            stream.getTracks().forEach((track) => track.stop());
          }, 1800);
        });
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      })
      .finally(() => fixturePage.close());
    const bytes = Buffer.from(clip);
    const uploaded = await request.post("/api/team-honors", {
      headers: { Authorization: "JWT " + playerToken },
      multipart: {
        action: "submit",
        team: String(team),
        title: "合成视频 HTTP 荣誉",
        competition: "合成视频赛事",
        placing: "合成视频奖项",
        date: "2026-10-01",
        description: "合成视频说明",
        video: {
          name: "synthetic-native.mp4",
          mimeType: "video/mp4",
          buffer: bytes,
        },
      },
    });
    expect(uploaded.status()).toBe(201);
    let current = (await uploaded.json()).record;
    records.push(current.id);
    let stored = await p.findByID({
      collection: "team-honor-records",
      id: current.id,
      user: player,
      overrideAccess: false,
      depth: 0,
    });
    videos.push(stored.videoURL!);
    expect(stored.videoURL).toMatch(/^\/api\/private-team-honor-videos\//);
    expect(
      (
        await page.request.get(current.videoHref, {
          headers: { "Sec-Fetch-Site": "same-origin" },
        })
      ).status(),
    ).toBe(200);
    expect((await request.get(current.videoHref)).status()).toBe(404);
    expect((await request.get(stored.videoURL!)).status()).toBe(404);
    const rawURL = await saveVideo(
      new File([bytes], "synthetic-old-shared.mp4", { type: "video/mp4" }),
    );
    videos.push(rawURL);
    // Recreate both author and other-account readable pending copies that existed before the isolation fix.
    for (const actor of [player, otherReviewer]) {
      const copy = await p.create({
        collection: "community-showcase",
        user: actor,
        overrideAccess: false,
        context: { webShowcaseWrite: true },
        data: {
          title: "合成旧跨集合借用",
          game,
          author: actor.id,
          videoURL: rawURL,
        },
      });
      expect(copy.status).toBe("pending");
      showcases.push(copy.id);
      expect(
        (
          await p.findByID({
            collection: "community-showcase",
            id: copy.id,
            user: actor,
            overrideAccess: false,
            depth: 0,
          })
        ).id,
      ).toBe(copy.id);
    }
    const connection = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await connection.connect();
    try {
      await connection.query(
        "UPDATE team_honor_records SET video_u_r_l=$1 WHERE id=$2",
        [rawURL, current.id],
      );
    } finally {
      await connection.end();
    }
    stored = await p.findByID({
      collection: "team-honor-records",
      id: current.id,
      user: player,
      overrideAccess: false,
      depth: 0,
    });
    const observed = await currentHonorVersion(stored);
    const versionConnection = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await versionConnection.connect();
    try {
      await versionConnection.query(
        "UPDATE team_honor_records SET submitted_version=$1 WHERE id=$2",
        [observed.version, current.id],
      );
    } finally {
      await versionConnection.end();
    }
    current = (
      await (
        await request.get("/api/team-honors/" + current.id, {
          headers: { Authorization: "JWT " + playerToken },
        })
      ).json()
    ).record;
    const mutate = async (
      token: string,
      action: string,
      extra: object = {},
    ) => {
      const response = await request.post("/api/team-honors/" + current.id, {
        headers: { Authorization: "JWT " + token },
        data: {
          action,
          revision: current.revision,
          submittedVersion: current.submittedVersion,
          ...extra,
        },
      });
      expect(response.status(), await response.text()).toBe(200);
      current = (await response.json()).record;
    };
    const blockedCopies = async () => {
      expect(
        (
          await page.request.get(rawURL, {
            headers: { "Sec-Fetch-Site": "same-origin" },
          })
        ).status(),
      ).toBe(404);
      expect((await request.get(rawURL)).status()).toBe(404);
      expect(
        (
          await otherPage.request.get(rawURL, {
            headers: { "Sec-Fetch-Site": "same-origin" },
          })
        ).status(),
      ).toBe(404);
    };
    await blockedCopies();
    await mutate(reviewerToken, "approve");
    let publicHref =
      "/api/team-honor-evidence/" +
      current.id +
      "/video?version=" +
      observed.version;
    expect((await request.get(publicHref)).status()).toBe(200);
    expect(
      (
        await request.get(publicHref, { headers: { Range: "bytes=0-7" } })
      ).status(),
    ).toBe(206);
    expect((await request.head(publicHref)).headers()["content-length"]).toBe(
      String(bytes.length),
    );
    const archive = await (
      await request.get("/api/team-honor-archives/" + team)
    ).json();
    const publicRecord = archive.records.find(
      (row: { key: string }) => row.key === "team-honor-records:" + current.id,
    );
    expect(publicRecord).not.toHaveProperty("videoURL");
    expect(JSON.stringify(publicRecord)).not.toContain(rawURL);
    await page.goto("/community/" + slug + "/showcase/team-honors/" + team);
    const playback = page.locator(
      '[data-public-honor="team-honor-records:' + current.id + '"] video',
    );
    await expect
      .poll(() => playback.evaluate((el: HTMLVideoElement) => el.readyState))
      .toBeGreaterThanOrEqual(2);
    await playback.evaluate(async (el: HTMLVideoElement) => {
      el.muted = true;
      await el.play();
    });
    await expect
      .poll(() => playback.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(0.1);
    await playback.evaluate((el: HTMLVideoElement) => {
      el.pause();
      el.currentTime = 1;
    });
    await expect
      .poll(() => playback.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThanOrEqual(1);
    await mutate(playerToken, "save", {
      input: { description: "合成批准后改稿" },
    });
    expect((await request.get(publicHref)).status()).toBe(404);
    await blockedCopies();
    await mutate(playerToken, "submit", { input: {} });
    await mutate(reviewerToken, "return", { note: "合成视频退回" });
    expect((await request.get(publicHref)).status()).toBe(404);
    await blockedCopies();
    await mutate(playerToken, "submit", { input: {} });
    const secondVersion = current.submittedVersion;
    await mutate(reviewerToken, "approve");
    publicHref =
      "/api/team-honor-evidence/" +
      current.id +
      "/video?version=" +
      secondVersion;
    expect((await request.get(publicHref)).status()).toBe(200);
    await p.update({
      collection: "teams",
      id: team,
      overrideAccess: true,
      user: leader,
      context: { system: true, teamCoreWrite: true },
      data: { teamStatus: "archived" },
    });
    expect((await request.get(publicHref)).status()).toBe(404);
    expect(
      (await request.get("/api/team-honor-archives/" + team)).status(),
    ).toBe(404);
    await blockedCopies();
    await p.update({
      collection: "teams",
      id: team,
      overrideAccess: true,
      user: leader,
      context: { system: true, teamCoreWrite: true },
      data: { teamStatus: "active", archived: false },
    });
    await mutate(reviewerToken, "hide", { note: "合成视频最终隐藏" });
    expect((await request.get(publicHref)).status()).toBe(404);
    await blockedCopies();
    // Only the permanent marker remains after synthetic history/reference removal.
    // Readable old showcase copies must still be unable to disclose these bytes.
    const cleared = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cleared.connect();
    try {
      await cleared.query("UPDATE team_honor_records SET video_u_r_l=NULL,approved_snapshot=NULL,history='[]'::jsonb WHERE id=$1", [current.id]);
    } finally { await cleared.end(); }
    await blockedCopies();
    expect((await request.head(rawURL)).status()).toBe(404);
    expect((await page.request.get(rawURL, { headers: { "Sec-Fetch-Site": "same-origin", Range: "bytes=0-7" } })).status()).toBe(404);
    // Ordinary independently uploaded published showcase video remains usable.
    const normalURL = await saveVideo(
      new File([bytes], "synthetic-normal.mp4", { type: "video/mp4" }),
    );
    videos.push(normalURL);
    showcases.push(
      (
        await p.create({
          collection: "community-showcase",
          user: reviewer,
          overrideAccess: false,
          context: { webShowcaseWrite: true },
          data: {
            title: "合成正常视频风采",
            game,
            author: reviewer.id,
            videoURL: normalURL,
          },
        })
      ).id,
    );
    expect((await request.get(normalURL)).status()).toBe(200);
    expect(
      (
        await request.get(normalURL, { headers: { Range: "bytes=0-7" } })
      ).status(),
    ).toBe(206);
    await page.goto(
      "/community/" + slug + "/showcase/" + showcases[showcases.length - 1],
    );
    const ordinaryPlayback = page.locator('video[aria-label="风采视频预览"]');
    await expect
      .poll(() =>
        ordinaryPlayback.evaluate((el: HTMLVideoElement) => el.readyState),
      )
      .toBeGreaterThanOrEqual(2);
    await ordinaryPlayback.evaluate(async (el: HTMLVideoElement) => {
      el.muted = true;
      await el.play();
    });
    await expect
      .poll(() =>
        ordinaryPlayback.evaluate((el: HTMLVideoElement) => el.currentTime),
      )
      .toBeGreaterThan(0.1);
    await writeFile(
      ".data/team-honor-http-video-evidence.json",
      JSON.stringify({
        syntheticOnly: true,
        nativeJWT: true,
        privateNamespace: true,
        publicDTOHasNoStorageURL: true,
        oldCrossCollectionCopiesBlocked: true,
        hiddenEditedReturnedArchivedHTTPBlocked: true,
        approvedVersionPlays: true,
        approvedVersionSeeks: true,
        ordinaryPublishedVideoWorks: true,
      }),
    );
  } finally {
    await p.update({
      collection: "teams",
      id: team,
      overrideAccess: true,
      user: leader,
      context: { system: true, teamCoreWrite: true },
      data: { teamStatus: "active", archived: false },
    });
    await context.close();
  }
});

test("私有详情与原始 REST 守住社群边界，网页退回/拒绝需说明并可隐藏公开荣誉", async ({
  page,
  browser,
  request,
}) => {
  await login(page, reviewer);
  const context = await browser.newContext();
  try {
    const outsider = await context.newPage();
    await login(outsider, otherReviewer);
    const privatePage = await outsider.request.get(
      "/teams/honors/" + pending.id,
    );
    expect(await privatePage.text()).not.toContain("合成未审私有荣誉");
    expect(
      (
        await outsider.request.get("/api/team-honor-records/" + pending.id, {
          headers: { Origin: browserTestOrigin },
        })
      ).status(),
    ).toBe(404);
    expect(
      (await request.get("/api/team-honor-records/" + pending.id)).status(),
    ).toBe(403);
    expect(
      (
        await page.request.patch("/api/team-honor-records/" + pending.id, {
          headers: { Origin: browserTestOrigin },
          data: {
            state: "approved",
            context: { honorWrite: true, teamHonorWriteToken: {} },
          },
        })
      ).status(),
    ).toBe(403);
    await page.goto("/teams/honors/" + pending.id);
    const record = page.locator('[data-honor-record="' + pending.id + '"]');
    await record.getByRole("button", { name: "退回修改", exact: true }).click();
    await expect(record.getByRole("alert")).toContainText("须填写具体说明");
    await expect(record.locator('input[name="revision"]')).toHaveValue(
      String(pending.revision),
    );
    await record
      .getByLabel("审核说明（退回或拒绝必填）")
      .fill("合成网页退回说明");
    await record.getByRole("button", { name: "退回修改", exact: true }).click();
    await expect(record.getByRole("status")).toContainText("已退回");
    await expect(record).toContainText("合成网页退回说明");
    await page.goto("/teams/honors/" + approved.id);
    const approvedRecord = page.locator(`[data-honor-record="${approved.id}"]`);
    await approvedRecord.getByLabel("隐藏说明").fill("合成网页隐藏荣誉");
    await approvedRecord
      .getByRole("button", { name: "隐藏荣誉", exact: true })
      .click();
    await expect(approvedRecord.getByRole("status")).toContainText(
      "荣誉已隐藏",
    );
    await page.goto("/community/" + slug + "/showcase/team-honors/" + team);
    const legacyRecord = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "合成历史荣誉网页", exact: true }),
    });
    await legacyRecord.locator("summary").filter({ hasText: /^管理这项历史荣誉$/ }).click();
    await legacyRecord.getByLabel("隐藏历史荣誉说明").fill("合成历史荣誉隐藏说明");
    await legacyRecord
      .getByRole("button", { name: "隐藏历史荣誉", exact: true })
      .click();
    await expect(page).toHaveURL(/\/teams\/honors\?/);
    await expect(
      page.locator("main").getByRole("status").filter({ hasText: "历史荣誉已撤下" }),
    ).toContainText("历史荣誉已撤下");
    expect(new URL(page.url()).searchParams.get("team")).toBe(String(team));
    expect(new URL(page.url()).searchParams.get("game")).toBe(String(game));
    expect(
      (await request.get("/api/team-honor-archives/" + team)).status(),
    ).toBe(404);
    const hiddenPage = await page.request.get(
      "/community/" + slug + "/showcase/team-honors/" + team,
    );
    expect(await hiddenPage.text()).not.toContain("合成已批准网页荣誉");
    await page.goto("/community/" + slug + "/showcase");
    await expect(page.locator("[data-team-honor-archive]")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("真实成员网页草稿/错误保留/提交/撤回/退回重提/批准/改稿复审/离队保留历史", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const reviewContext = await browser.newContext();
  try {
    const reviewPage = await reviewContext.newPage();
    await login(page, player);
    await login(reviewPage, reviewer);
    await page.goto(`/teams/honors?team=${team}`);
    await page
      .getByRole("link", { name: "提交队伍荣誉", exact: true })
      .click();
    const receipt = page.locator("main").getByRole("status").filter({
      hasText: /^(草稿已保存|荣誉已提交)/,
    });
    let editor = page.locator("[data-honor-editor]");
    await editor
      .getByLabel("荣誉标题", { exact: true })
      .fill("合成完整网页荣誉流程");
    await editor.getByRole("button", { name: "保存草稿", exact: true }).click();
    await page.waitForURL((url) => /^\/teams\/honors\/\d+$/.test(url.pathname));
    const id = Number(new URL(page.url()).pathname.split("/").pop());
    expect(Number.isSafeInteger(id) && id > 0).toBe(true);
    records.push(id);
    const savedDraft = await p.findByID({
      collection: "team-honor-records",
      id,
      user: player,
      overrideAccess: false,
      depth: 0,
    });
    expect(savedDraft).toMatchObject({
      team,
      game,
      author: player.id,
      title: "合成完整网页荣誉流程",
      state: "draft",
    });
    await expect(receipt).toContainText("草稿已保存");
    const detail = "/teams/honors/" + id;
    const record = page.locator(`[data-honor-record="${id}"]`);
    const reviewRecord = reviewPage.locator(`[data-honor-record="${id}"]`);
    editor = page.locator("[data-honor-editor]");
    await editor.getByRole("button", { name: "提交审核", exact: true }).click();
    await expect(editor.getByRole("alert")).toContainText("赛事");
    await expect(editor.getByLabel("荣誉标题", { exact: true })).toHaveValue(
      "合成完整网页荣誉流程",
    );
    await editor.getByLabel("赛事名称", { exact: true }).fill("合成完整赛事");
    await editor.getByLabel("奖项或名次", { exact: true }).fill("合成完整奖项");
    await editor.getByLabel("赛事日期", { exact: true }).fill("2026-10-01");
    await editor
      .getByRole("textbox", { name: "获奖说明", exact: true })
      .fill("合成完整获奖说明，所有材料均为测试生成");
    await expect(
      editor.getByRole("textbox", { name: "获奖说明", exact: true }),
    ).toHaveValue("合成完整获奖说明，所有材料均为测试生成");
    const png = await sharp({
      create: { width: 40, height: 40, channels: 3, background: "purple" },
    })
      .png()
      .toBuffer();
    await editor
      .getByLabel("添加证据图片（每份 2 MB，最多 6 份）", { exact: true })
      .setInputFiles({
        name: "synthetic-award.png",
        mimeType: "image/png",
        buffer: png,
      });
    await editor.getByLabel(/新证据 1 说明/).fill("合成网页证据");
    await editor.getByRole("button", { name: "提交审核", exact: true }).click();
    await expect(receipt).toContainText("荣誉已提交");
    await record
      .getByRole("button", { name: "撤回待审记录", exact: true })
      .click();
    await expect(record.getByRole("status")).toContainText("已撤回");
    const withdrawnRevision = Number(
      await editor.locator('input[name="revision"]').inputValue(),
    );
    await page
      .locator("[data-honor-editor]")
      .getByRole("button", { name: "提交审核", exact: true })
      .click();
    await expect(editor.locator('input[name="revision"]')).toHaveValue(
      String(withdrawnRevision + 1),
    );
    await expect(record.getByText("待审核", { exact: true })).toBeVisible();
    await expect(receipt).toContainText("荣誉已提交");
    await reviewPage.goto(detail);
    await reviewPage
      .getByLabel("审核说明（退回或拒绝必填）")
      .fill("请补充合成获奖说明");
    await reviewPage
      .getByRole("button", { name: "退回修改", exact: true })
      .click();
    await expect(reviewRecord.getByRole("status")).toContainText("已退回");
    await page.reload();
    await expect(page.locator("[data-honor-record]")).toContainText(
      "请补充合成获奖说明",
    );
    await page
      .locator("[data-honor-editor]")
      .getByRole("textbox", { name: "获奖说明", exact: true })
      .fill("已补充合成说明");
    await expect(
      page
        .locator("[data-honor-editor]")
        .getByRole("textbox", { name: "获奖说明", exact: true }),
    ).toHaveValue("已补充合成说明");
    const resubmitRevision = Number(
      await page
        .locator("[data-honor-editor] input[name=revision]")
        .inputValue(),
    );
    await page
      .locator("[data-honor-editor]")
      .getByRole("button", { name: "提交审核", exact: true })
      .click();
    await expect(
      page.locator("[data-honor-editor] input[name=revision]"),
    ).toHaveValue(String(resubmitRevision + 1));
    await expect(receipt).toContainText("荣誉已提交");
    await reviewPage.reload();
    await reviewPage
      .getByRole("button", { name: "批准荣誉", exact: true })
      .click();
    await expect(reviewRecord.getByRole("status")).toContainText("已批准");
    const archiveURL = "/community/" + slug + "/showcase/team-honors/" + team;
    await page.goto(archiveURL);
    await expect(
      page.getByRole("heading", { name: "合成完整网页荣誉流程", exact: true }),
    ).toBeVisible();
    await page.goto(detail);
    await page
      .locator("[data-honor-editor]")
      .getByRole("textbox", { name: "获奖说明", exact: true })
      .fill("批准后合成改稿，需要再次审核");
    await expect(
      page
        .locator("[data-honor-editor]")
        .getByRole("textbox", { name: "获奖说明", exact: true }),
    ).toHaveValue("批准后合成改稿，需要再次审核");
    await page
      .locator("[data-honor-editor]")
      .getByRole("button", { name: "提交审核", exact: true })
      .click();
    await expect(receipt).toContainText("荣誉已提交");
    const beforeReview = await page.request.get(
      "/api/team-honor-archives/" + team,
    );
    expect(await beforeReview.text()).not.toContain("批准后合成改稿");
    await reviewPage.goto(detail);
    await reviewPage
      .getByRole("button", { name: "批准荣誉", exact: true })
      .click();
    await expect(reviewRecord.getByRole("status")).toContainText("已批准");
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
    await page.goto(detail);
    await expect(page.locator("[data-honor-editor]")).toHaveCount(0);
    await page.goto(archiveURL);
    await expect(
      page.getByRole("heading", { name: "合成完整网页荣誉流程", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("批准后合成改稿，需要再次审核", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await writeFile(
      ".data/team-honor-web-evidence.json",
      JSON.stringify({
        membershipCore: "real",
        seededSyntheticChain: true,
        recruitmentUIVerified: false,
        draftSubmitWithdrawReturnApproveReapprove: true,
        historyAfterExit: true,
        mobileWidth: 390,
      }),
    );
  } finally {
    await reviewContext.close();
  }
});
