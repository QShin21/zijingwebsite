import "dotenv/config";
import { randomBytes } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";

let p: Payload, president: User, vice: User, member: User, localAdmin: User, batch: number;
const suffix = randomBytes(6).toString("hex"), password = randomBytes(24).toString("hex"), title = "合成网页骨干批次-" + suffix;
const games: { id: number; slug: string }[] = [], actors: User[] = [], origin = { Origin: "http://localhost:3000" };
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback only");
  p = await getPayload({ config, key: "staff-web-e2e" });
  const actor = async (name: string, roles: User["roles"]) => {
    const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: name + "-" + suffix, email: name + "-" + suffix + "@example.invalid", password, roles } });
    actors.push(user); return user;
  };
  president = await actor("staff-web-president", ["president"]); vice = await actor("staff-web-vice", ["vicePresident"]);
  member = await actor("staff-web-member", ["member"]); localAdmin = await actor("staff-web-local", ["member"]);
  const game = await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成骨干入口社群", slug: "staff-web-" + suffix, _status: "published" } }); games.push(game);
  localAdmin = await p.update({ collection: "users", id: localAdmin.id, user: president, overrideAccess: false, data: { communityOffices: [{ game: game.id, status: "active", publishContent: true, viewSignups: true, exportSignups: true, reviewShowcase: true }] } });
});
test.afterAll(async () => {
  if (!p) return;
  if (batch) {
    const rows = await p.find({ collection: "staff-applications", overrideAccess: true, pagination: false, where: { batch: { equals: batch } } });
    await p.delete({ collection: "staff-applications", overrideAccess: true, where: { batch: { equals: batch } } });
    await p.delete({ collection: "audit", overrideAccess: true, where: { or: [
      { object: { in: ["staff-batches:" + batch, ...rows.docs.map(row => "staff-applications:" + row.id)] } },
      { and: [{ object: { equals: "staff-applications" } }, { actor: { in: actors.map(actor => String(actor.id)) } }] },
    ] } });
    await p.delete({ collection: "staff-batches", id: batch, overrideAccess: true });
  }
  for (const actor of actors) await p.delete({ collection: "users", id: actor.id, overrideAccess: true, context: { system: true } });
  for (const game of games) await p.delete({ collection: "games", id: game.id, overrideAccess: true });
  await p.destroy();
});
async function login(page: Page, user: User) {
  page.setDefaultTimeout(15000);
  await page.goto("/login"); await page.getByLabel("昵称或邮箱").fill(user.name); await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
}
async function complete(page: Page, editing = false) {
  if (!editing) {
    await page.getByLabel("宣传部", { exact: true }).check(); await page.getByLabel("姓名", { exact: true }).fill("合成申请人");
    await page.getByLabel("学校、院系与年级", { exact: true }).fill("合成学校院系年级"); await page.getByLabel("申请动机", { exact: true }).fill("合成参与动机");
  }
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  if (!editing) {
    await page.getByLabel("相关经验（无经验可说明兴趣）", { exact: true }).fill("合成暂无经验");
    await page.getByLabel("可投入时间与时段", { exact: true }).fill("合成每周时段");
    await page.getByLabel("一种便于联系的方式（邮箱或微信等）", { exact: true }).fill("synthetic@example.invalid");
  }
  await page.getByRole("button", { name: "核对并提交", exact: true }).click();
  await page.getByRole("button", { name: editing ? "保存申请并提交" : "提交骨干申请", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "骨干申请已提交" })).toBeVisible();
}
test("单批次网页草稿/发布、申请/撤回重提、审核回执、私有导出及关闭；现有和新社群共用入口", async ({ page, browser, request }) => {
  test.setTimeout(240000);
  const applicantContext = await browser.newContext(), reviewerContext = await browser.newContext(), localContext = await browser.newContext();
  try {
    await login(page, president); await page.goto("/staff/manage"); await page.getByText("创建骨干招新批次", { exact: true }).click();
    const create = page.locator("details").filter({ has: page.getByText("创建骨干招新批次", { exact: true }) });
    await create.getByLabel("批次标题", { exact: true }).fill(title); await create.getByLabel("批次说明", { exact: true }).fill("执行及宣传方向的合成网页选拔，仅用于测试");
    await create.getByLabel("截止时间", { exact: true }).fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await create.getByRole("button", { name: "保存草稿", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "草稿未公开" })).toBeVisible();
    batch = (await p.find({ collection: "staff-batches", user: president, overrideAccess: false, where: { title: { equals: title } } })).docs[0].id;
    expect((await request.get("/api/staff/batches/" + batch + "/application")).status()).toBe(404);
    const edit = page.locator("details").filter({ has: page.getByText("配置批次：" + title, { exact: true }) }); await edit.locator(":scope > summary").click();
    await edit.getByRole("button", { name: "发布骨干招新", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "已发布" })).toBeVisible();
    const path = "/join/staff/batches/" + batch, notice = '[data-staff-batch="' + batch + '"]';
    await page.goto("/"); await expect(page.locator(notice).getByRole("link")).toHaveAttribute("href", path);
    const applicant = await applicantContext.newPage(); await login(applicant, member); await applicant.goto("/community/" + games[0].slug + "/updates");
    await expect(applicant.locator(notice).getByRole("link")).toHaveAttribute("href", path); await applicant.locator(notice).getByRole("link").click();
    await expect(applicant.getByRole("link", { name: "查看游戏社群", exact: true })).toBeVisible();
    const formInfo = await (await applicant.request.get("/api/staff/batches/" + batch + "/application", { headers: origin })).json();
    expect(formInfo.draftKey).toBe("staff:" + batch + ":" + member.id + ":" + formInfo.version);
    await applicant.setViewportSize({ width: 360, height: 900 });
    expect(await applicant.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await complete(applicant);
    const saved = (await p.find({ collection: "staff-applications", user: member, overrideAccess: false, where: { batch: { equals: batch } } })).docs[0];
    await applicant.getByRole("button", { name: "撤回申请", exact: true }).click(); await expect(applicant.getByRole("heading", { name: /已撤回/ })).toBeVisible();
    await applicant.getByRole("button", { name: "重新提交申请", exact: true }).click(); await complete(applicant, true);
    expect((await p.find({ collection: "staff-applications", user: member, overrideAccess: false, where: { batch: { equals: batch } } })).docs.map(row => row.id)).toEqual([saved.id]);
    const local = await localContext.newPage(); await login(local, localAdmin);
    expect((await local.request.get("/api/staff/batches/" + batch + "/application?mode=review", { headers: origin })).status()).toBe(403);
    expect((await local.request.get("/api/staff/batches/" + batch + "/application?mode=export", { headers: origin })).status()).toBe(403);
    expect((await local.request.get("/api/staff-applications/" + saved.id, { headers: origin })).status()).toBe(404);
    const reviewer = await reviewerContext.newPage(); await login(reviewer, vice); await reviewer.goto("/staff/manage?batch=" + batch);
    await reviewer.setViewportSize({ width: 390, height: 900 });
    expect(await reviewer.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const row = reviewer.locator('[data-staff-application="' + saved.id + '"]');
    await row.getByLabel("本人可见反馈（退回/未录用必填）", { exact: true }).fill("合成录用反馈");
    await row.getByLabel("内部备注（仅管理层可见）", { exact: true }).fill("合成仅管理层备注");
    await row.getByRole("button", { name: "录用", exact: true }).click(); await expect(reviewer.getByRole("status").filter({ hasText: "申请处理结果已保存" })).toBeVisible();
    await applicant.reload(); await expect(applicant.getByRole("heading", { name: /已录用/ })).toBeVisible();
    await expect(applicant.getByText("合成仅管理层备注", { exact: true })).toHaveCount(0);
    const selfRead = await applicant.request.get("/api/staff-applications/" + saved.id, { headers: origin });
    expect(selfRead.status()).toBe(200); expect((await selfRead.json()).reviewNotes).toBeUndefined();
    expect((await p.findByID({ collection: "users", id: member.id, overrideAccess: true })).roles).toEqual(["member"]);
    await reviewer.getByRole("combobox", { name: /^部门意向/ }).selectOption("publicity"); await reviewer.getByRole("combobox", { name: /^申请状态/ }).selectOption("accepted");
    await reviewer.getByRole("button", { name: "筛选申请", exact: true }).click(); await expect(row).toBeVisible();
    const exported = await reviewer.request.get("/api/staff/batches/" + batch + "/application?mode=export&department=publicity&status=accepted", { headers: origin });
    expect(exported.status()).toBe(200); expect(await exported.text()).toContain("合成申请人");
    await p.update({ collection: "users", id: vice.id, user: president, overrideAccess: false, data: { roles: ["member"] } });
    expect((await reviewer.request.get("/api/staff/batches/" + batch + "/application?mode=review", { headers: origin })).status()).toBe(403);
    expect((await reviewer.request.get("/api/staff/batches/" + batch + "/application?mode=export", { headers: origin })).status()).toBe(403);
    expect((await reviewer.request.post("/api/staff/batches/" + batch + "/application", { headers: origin, data: {
      action: "review", id: saved.id, revision: saved.updatedAt, status: "accepted", context: { system: true, staffApplicationWrite: true },
    } })).status()).toBe(403);
    const newGame = await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成后建骨干入口社群", slug: "staff-later-" + suffix, _status: "published" } }); games.push(newGame);
    await applicant.goto("/community/" + newGame.slug + "/updates"); await expect(applicant.locator(notice).getByRole("link")).toHaveAttribute("href", path);
    for (const width of [360, 390, 768, 1440]) { await applicant.setViewportSize({ width, height: 900 }); await applicant.goto(path); expect(await applicant.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); }
    await page.goto("/staff/manage"); await edit.locator(":scope > summary").click(); await edit.getByRole("button", { name: "关闭批次", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "已关闭" })).toBeVisible();
    await applicant.goto("/community/" + newGame.slug + "/updates"); await expect(applicant.locator(notice)).toHaveCount(0);
    await applicant.goto(path); await expect(applicant.getByRole("status").filter({ hasText: "申请已关闭" })).toBeVisible();
    await expect(applicant.getByRole("button", { name: "修改申请", exact: true })).toHaveCount(0);
  } finally { await Promise.allSettled([applicantContext.close(), reviewerContext.close(), localContext.close()]); }
});
