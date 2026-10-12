import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { APIError, getPayload, type Payload } from "payload";
import { test, expect, type Page } from "@playwright/test";
import config from "../../src/payload.config";
import type { TeamHonorRecord, User } from "../../src/payload-types";
import { createTeamHonorService } from "../../src/lib/team-honor-service";
import { readPublicHonorTeam } from "../../src/lib/team-honor-authority";

let p: Payload, leader: User, reviewer: User, otherReviewer: User, player: User;
let game: number,
  otherGame: number,
  team: number,
  approved: TeamHonorRecord,
  pending: TeamHonorRecord;
const suffix = randomBytes(7).toString("hex"),
  password = randomBytes(24).toString("hex"),
  slug = "honor-web-" + suffix;
const records: number[] = [],
  showcases: number[] = [],
  legacy: number[] = [];
// Only fixture preparation injects synthetic membership facts. The running web app remains fail-closed
// until the integration owner connects the real core. These tests do not claim full core membership E2E.
const service = createTeamHonorService({
  publicTeam: readPublicHonorTeam,
  activeMemberships: async () => [],
  activeMembership: async (req, member, teamID) => {
    const teamInfo = await readPublicHonorTeam(req, teamID);
    if (member !== player.id || teamID !== team || !teamInfo)
      throw new APIError("Synthetic member only", 403);
    return { id: 2001, member, team: teamID, season: null, teamInfo };
  },
});
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
  team = (
    await p.create({
      collection: "teams",
      overrideAccess: true,
      context: { system: true },
      data: {
        title: "合成网页代表队",
        slug: slug + "-team",
        game,
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
        { game, status: "active", reviewShowcase: true, publishContent: true },
      ],
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
  for (const user of [leader, reviewer, otherReviewer, player])
    if (user)
      await p.delete({
        collection: "users",
        id: user.id,
        overrideAccess: true,
        context: { system: true },
      });
  if (team)
    await p.delete({ collection: "teams", id: team, overrideAccess: true });
  for (const id of [game, otherGame])
    if (id) await p.delete({ collection: "games", id, overrideAccess: true });
  await p.destroy();
});
async function login(page: Page, user: User) {
  const response = await page.request.post("/api/users/login", {
    data: { email: user.email, password },
  });
  expect(response.ok()).toBe(true);
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
          headers: { Origin: "http://localhost:3000" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (await request.get("/api/team-honor-records/" + pending.id)).status(),
    ).toBe(403);
    expect(
      (
        await page.request.patch("/api/team-honor-records/" + pending.id, {
          headers: { Origin: "http://localhost:3000" },
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
    await expect(page.getByRole("status")).toContainText("须填写具体说明");
    await record
      .getByLabel("审核说明（退回或拒绝必填）")
      .fill("合成网页退回说明");
    await record.getByRole("button", { name: "退回修改", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("已退回");
    await expect(record).toContainText("合成网页退回说明");
    await page.goto("/teams/honors/" + approved.id);
    await page.getByLabel("隐藏说明").fill("合成网页隐藏荣誉");
    await page.getByRole("button", { name: "隐藏荣誉", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("荣誉已隐藏");
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
