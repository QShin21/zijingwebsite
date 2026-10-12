import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getPayload, type Payload } from "payload";
import { test, expect, type Page } from "@playwright/test";
import config from "../../src/payload.config";
import { writeFile } from "node:fs/promises";
import type { TeamHonorRecord, User } from "../../src/payload-types";
import { teamHonorService as service } from "../../src/lib/team-honor-service";
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
    await page.goto("/community/" + slug + "/showcase/team-honors/" + team);
    await page.getByLabel("隐藏历史荣誉说明").fill("合成历史荣誉隐藏说明");
    await page
      .getByRole("button", { name: "隐藏历史荣誉", exact: true })
      .click();
    await expect(page.getByRole("status").first()).toContainText(
      "历史荣誉已撤下",
    );
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
    await page.goto("/teams/honors?view=mine");
    let editor = page.locator("[data-honor-editor]");
    await editor
      .getByLabel("荣誉标题", { exact: true })
      .fill("合成完整网页荣誉流程");
    await editor.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("草稿已保存");
    const id = Number(new URL(page.url()).pathname.split("/").pop());
    records.push(id);
    const detail = "/teams/honors/" + id;
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
    await expect(page.getByRole("status")).toContainText("荣誉已提交");
    await page
      .getByRole("button", { name: "撤回待审记录", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("已撤回");
    await page
      .locator("[data-honor-editor]")
      .getByRole("button", { name: "提交审核", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("荣誉已提交");
    await reviewPage.goto(detail);
    await reviewPage
      .getByLabel("审核说明（退回或拒绝必填）")
      .fill("请补充合成获奖说明");
    await reviewPage
      .getByRole("button", { name: "退回修改", exact: true })
      .click();
    await expect(reviewPage.getByRole("status")).toContainText("已退回");
    await page.reload();
    await expect(page.locator("[data-honor-record]")).toContainText(
      "请补充合成获奖说明",
    );
    await page
      .locator("[data-honor-editor]")
      .getByRole("textbox", { name: "获奖说明", exact: true })
      .fill("已补充合成说明");
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
    await expect(page.getByRole("status")).toContainText("荣誉已提交");
    await reviewPage.reload();
    await reviewPage
      .getByRole("button", { name: "批准荣誉", exact: true })
      .click();
    await expect(reviewPage.getByRole("status")).toContainText("已批准");
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
    await page
      .locator("[data-honor-editor]")
      .getByRole("button", { name: "提交审核", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("荣誉已提交");
    const beforeReview = await page.request.get(
      "/api/team-honor-archives/" + team,
    );
    expect(await beforeReview.text()).not.toContain("批准后合成改稿");
    await reviewPage.goto(detail);
    await reviewPage
      .getByRole("button", { name: "批准荣誉", exact: true })
      .click();
    await expect(reviewPage.getByRole("status")).toContainText("已批准");
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
