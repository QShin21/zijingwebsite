import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
let p: Payload, leader: User, admin: User, execution: User, publicity: User, member: User, game: number, post: number;
const suffix = randomBytes(6).toString("hex"), password = randomBytes(24).toString("hex"), slug = "promotion-web-" + suffix;
const origin = { Origin: "http://localhost:3000" }, postIDs: number[] = [], showcaseIDs: number[] = [], receiptIDs: number[] = [];
test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback only");
  p = await getPayload({ config, key: "promotions-web-e2e" });
  const actor = (label: string, roles: User["roles"], department?: User["department"]) => p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { name: label + "-" + suffix, email: label + "-" + suffix + "@example.invalid", password, roles, department } });
  leader = await actor("promotion-web-leader", ["president"]); admin = await actor("promotion-web-admin", ["member"]);
  execution = await actor("promotion-web-execution", ["backbone"], "execution"); publicity = await actor("promotion-web-publicity", ["backbone"], "publicity"); member = await actor("promotion-web-member", ["member"]);
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成升推网页社群", slug, _status: "published" } })).id;
  admin = await p.update({ collection: "users", id: admin.id, user: leader, overrideAccess: false, data: { communityOffices: [{ game, status: "active", publishContent: true, reviewShowcase: true, viewSignups: false, exportSignups: false }] } });
  post = (await p.create({ collection: "community-posts", user: admin, overrideAccess: false, context: { manageSignupForm: true },
    data: { game, author: admin.id, title: "合成网页升推活动", body: "合成活动安排，仅用于隔离测试", category: "event", signupForm: { enabled: true, questions: [{ id: "name", label: "合成称呼", type: "text", required: true }] } } })).id;
  postIDs.push(post);
});
test.afterAll(async () => {
  if (!p) return;
  if (receiptIDs.length) await p.delete({ collection: "event-signups", overrideAccess: true, where: { id: { in: receiptIDs } } });
  const rows = await p.find({ collection: "content-promotions", overrideAccess: true, pagination: false, where: { sourceKey: { in: [...postIDs.map(id => "community-posts:" + id), ...showcaseIDs.map(id => "community-showcase:" + id)] } } });
  if (rows.docs.length) {
    await p.delete({ collection: "audit", overrideAccess: true, where: { object: { in: rows.docs.map(row => "content-promotions:" + row.id) } } });
    await p.delete({ collection: "content-promotions", overrideAccess: true, where: { id: { in: rows.docs.map(row => row.id) } } });
  }
  for (const id of postIDs) await p.delete({ collection: "community-posts", id, overrideAccess: true });
  for (const id of showcaseIDs) await p.delete({ collection: "community-showcase", id, overrideAccess: true, context: { webShowcaseWrite: true } });
  for (const user of [leader, admin, execution, publicity, member]) if (user) await p.delete({ collection: "users", id: user.id, overrideAccess: true, context: { system: true } });
  if (game) await p.delete({ collection: "games", id: game, overrideAccess: true });
  await p.destroy();
});
async function login(page: Page, user: User) {
  await page.goto("/login"); await page.getByLabel("昵称或邮箱").fill(user.name); await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
}
test("活动网页申请/撤回/退回/重提/审核/改稿复审及主动升降级，报名ID与隐私权限保持", async ({ page, browser, request }) => {
  test.setTimeout(180000);
  const staffContext = await browser.newContext(), memberContext = await browser.newContext();
  try {
    const staff = await staffContext.newPage(), participant = await memberContext.newPage();
    await login(participant, member); const sourcePath = "/community/" + slug + "/updates/" + post;
    await participant.goto(sourcePath); await participant.getByLabel("合成称呼", { exact: true }).fill("合成参与者");
    await participant.getByRole("button", { name: "核对并提交", exact: true }).click();
    await participant.getByRole("button", { name: "提交并确认报名", exact: true }).click();
    await expect(participant.getByText("已报名", { exact: false }).first()).toBeVisible();
    const receipt = (await p.find({ collection: "event-signups", user: member, overrideAccess: false, depth: 0,
      where: { and: [{ activityType: { equals: "community-posts" } }, { activityID: { equals: post } }, { member: { equals: member.id } }] } })).docs[0]; receiptIDs.push(receipt.id);
    await login(page, admin); await page.goto(sourcePath); await page.getByRole("link", { name: "申请社团级展示", exact: true }).click();
    const source = page.locator('[data-promotion-source="community-posts:' + post + '"]');
    await source.getByLabel("升推理由", { exact: true }).fill("合成活动适合社团成员共同参与");
    await source.getByRole("button", { name: "申请升推", exact: true }).click(); await expect(page.getByRole("status")).toContainText("升推结果已保存");
    await expect(source).toContainText("待审核");
    await source.getByRole("button", { name: "撤回申请", exact: true }).click(); await expect(page.getByRole("status")).toContainText("升推结果已保存");
    await expect(source).toContainText("已撤回");
    await source.getByRole("button", { name: "重新申请升推", exact: true }).click(); await expect(page.getByRole("status")).toContainText("升推结果已保存");
    await expect(source).toContainText("待审核");
    const pending = (await p.find({ collection: "content-promotions", user: admin, overrideAccess: false, where: { sourceKey: { equals: "community-posts:" + post } } })).docs[0];
    await login(staff, execution); await staff.goto("/community/promotions?view=review");
    const record = staff.locator('[data-promotion-record="' + pending.id + '"]');
    await record.getByLabel("审核意见（退回或拒绝必填）").fill("请补充活动安排");
    await record.getByRole("button", { name: "退回修改", exact: true }).click(); await expect(staff.getByRole("status")).toContainText("升推结果已保存");
    const staffSource = staff.locator('[data-promotion-source="community-posts:' + post + '"]');
    await expect(staffSource).toContainText("已退回");
    await page.goto("/community/promotions"); await expect(source).toContainText("请补充活动安排");
    await source.getByRole("button", { name: "重新申请升推", exact: true }).click(); await expect(page.getByRole("status")).toContainText("升推结果已保存");
    await expect(source).toContainText("待审核");
    await staff.goto("/community/promotions?view=review"); await record.getByRole("button", { name: "通过升推", exact: true }).click(); await expect(staff.getByRole("status")).toContainText("升推结果已保存");
    await expect(staffSource).toContainText("已升推");
    await page.goto("/"); const projected = page.locator('[data-section="promoted-event"] [data-promotion-source="community-posts:' + post + '"]');
    await expect(projected.getByRole("link", { name: "合成网页升推活动", exact: true })).toHaveAttribute("href", sourcePath);
    await participant.reload(); await expect(participant.getByText("已报名", { exact: false }).first()).toBeVisible();
    expect((await p.findByID({ collection: "community-posts", id: post, overrideAccess: true, depth: 0 })).game).toBe(game);
    expect((await participant.request.get("/api/event-signups/" + receipt.id, { headers: origin })).status()).toBe(200);
    for (const mode of ["view", "entries", "export"]) expect((await staff.request.get("/api/activities/community-posts/" + post + "/signup?mode=" + mode, { headers: origin })).status()).toBe(403);
    expect((await staff.request.get("/api/event-signups/" + receipt.id, { headers: origin })).status()).toBe(404);
    expect((await page.request.post("/api/content-promotions", { headers: origin, data: { sourceCollection: "community-posts", sourceID: post, sourceKey: "community-posts:" + post, game, kind: "event", status: "approved", context: { promotionWrite: true, promotionAction: "promote", system: true } } })).status()).toBe(403);
    expect((await request.get("/api/content-promotions")).status()).toBe(403);
    expect((await page.request.patch("/api/community-posts/" + post, { headers: origin, data: { title: "合成改稿升推活动" } })).status()).toBe(200);
    await page.reload(); await expect(projected).toHaveCount(0); await page.goto("/community/promotions"); await expect(source).toContainText("改稿待复审");
    await source.getByRole("button", { name: "重新申请升推", exact: true }).click(); await expect(page.getByRole("status")).toContainText("升推结果已保存");
    await expect(source).toContainText("待审核");
    await staff.goto("/community/promotions?view=review"); await record.getByRole("button", { name: "通过升推", exact: true }).click(); await expect(staff.getByRole("status")).toContainText("升推结果已保存");
    await expect(staffSource).toContainText("已升推");
    await staffSource.getByLabel("降级理由", { exact: true }).fill("合成降级说明");
    await staffSource.getByRole("button", { name: "降为社群展示", exact: true }).click(); await expect(staff.getByRole("status")).toContainText("升推结果已保存");
    await expect(staffSource).toContainText("已降级");
    await staffSource.getByLabel("主动升推理由", { exact: true }).fill("合成重新确认");
    await staffSource.getByRole("button", { name: "主动升推", exact: true }).click();
    await expect(staff.getByRole("status")).toContainText("已主动升推");
    await expect(staffSource).toContainText("已升推");
    await page.goto("/"); await expect(projected.getByRole("link", { name: "合成改稿升推活动", exact: true })).toBeVisible();
    expect((await p.findByID({ collection: "event-signups", id: receipt.id, user: member, overrideAccess: false })).id).toBe(receipt.id);
  } finally { await staffContext.close(); await memberContext.close(); }
});
test("公告网页申请由宣传部骨干审核，社团首页链接原公告且不出现报名", async ({ page, browser }) => {
  const notice = await p.create({ collection: "community-posts", user: admin, overrideAccess: false, data: { game, author: admin.id, title: "合成网页升推公告", body: "合成公告说明", category: "notice" } }); postIDs.push(notice.id);
  const staffContext = await browser.newContext();
  try {
    await login(page, admin); const sourcePath = "/community/" + slug + "/updates/" + notice.id;
    await page.goto(sourcePath); await expect(page.getByRole("button", { name: "核对并提交" })).toHaveCount(0);
    await page.getByRole("link", { name: "申请社团级展示", exact: true }).click();
    const source = page.locator('[data-promotion-source="community-posts:' + notice.id + '"]');
    await source.getByLabel("升推理由", { exact: true }).fill("合成公告对社团成员有帮助");
    await source.getByRole("button", { name: "申请升推", exact: true }).click(); await expect(page.getByRole("status")).toContainText("升推结果已保存");
    await expect(source).toContainText("待审核");
    const pending = (await p.find({ collection: "content-promotions", user: admin, overrideAccess: false, where: { sourceKey: { equals: "community-posts:" + notice.id } } })).docs[0];
    const staff = await staffContext.newPage(); await login(staff, publicity); await staff.goto("/community/promotions?view=review");
    await staff.locator('[data-promotion-record="' + pending.id + '"]').getByRole("button", { name: "通过升推", exact: true }).click(); await expect(staff.getByRole("status")).toContainText("升推结果已保存");
    await expect(staff.locator('[data-promotion-source="community-posts:' + notice.id + '"]')).toContainText("已升推");
    await page.goto("/"); const projected = page.locator('[data-section="promoted-notice"] [data-promotion-source="community-posts:' + notice.id + '"]');
    await expect(projected.getByRole("link", { name: "合成网页升推公告", exact: true })).toHaveAttribute("href", sourcePath);
    await projected.getByRole("link", { name: "合成网页升推公告", exact: true }).click(); await expect(page).toHaveURL(new RegExp("/updates/" + notice.id + "$"));
    await expect(page.getByRole("button", { name: "核对并提交" })).toHaveCount(0);
  } finally { await staffContext.close(); }
});
test("风采本地批准后网页申请升推，隐藏关闭首页且重新公开仍需复审", async ({ page, browser }) => {
  test.setTimeout(120000);
  const source = await p.create({ collection: "community-showcase", user: member, overrideAccess: false, context: { webShowcaseWrite: true },
    data: { game, author: member.id, title: "合成网页升推风采", body: "合成风采说明", images: [{ source: "data:image/png;base64," + (await sharp({ create: { width: 32, height: 32, channels: 3, background: "purple" } }).png().toBuffer()).toString("base64"), caption: "合成照片" }] } }); showcaseIDs.push(source.id);
  const staffContext = await browser.newContext(), path = "/community/" + slug + "/showcase";
  try {
    await login(page, admin); await page.goto(path + "?view=review");
    let card = page.locator("#showcase-" + source.id); await expect(card.getByRole("link", { name: "申请社团级展示" })).toHaveCount(0);
    await card.getByRole("button", { name: "批准发布", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "审核已保存" })).toBeVisible();
    const newerPosts = async (start: number) => {
      for (let i = start; i < start + 7; i++) {
        const newer = await p.create({ collection: "community-showcase", user: admin, overrideAccess: false, context: { webShowcaseWrite: true },
          data: { game, author: admin.id, title: "合成后续风采" + i, body: "验证分页，不扩无限列表", images: [] } });
        showcaseIDs.push(newer.id);
      }
    };
    await newerPosts(0);
    await page.goto(path); await expect(page.locator("#showcase-" + source.id)).toHaveCount(0);
    const detail = path + "/" + source.id; await page.goto(detail);
    card = page.locator("#showcase-" + source.id); await card.getByRole("link", { name: "申请社团级展示", exact: true }).click();
    const item = page.locator('[data-promotion-source="community-showcase:' + source.id + '"]');
    await item.getByLabel("升推理由", { exact: true }).fill("合成风采适合社团成员了解");
    await item.getByRole("button", { name: "申请升推", exact: true }).click(); await expect(page.getByRole("status")).toContainText("升推结果已保存");
    await expect(item).toContainText("待审核");
    const pending = (await p.find({ collection: "content-promotions", user: admin, overrideAccess: false, where: { sourceKey: { equals: "community-showcase:" + source.id } } })).docs[0];
    const staff = await staffContext.newPage(); await login(staff, execution); await staff.goto("/community/promotions?view=review");
    await staff.locator('[data-promotion-record="' + pending.id + '"]').getByRole("button", { name: "通过升推", exact: true }).click(); await expect(staff.getByRole("status")).toContainText("升推结果已保存");
    await expect(staff.locator('[data-promotion-source="community-showcase:' + source.id + '"]')).toContainText("已升推");
    await page.goto("/"); const projected = page.locator('[data-section="promoted-showcase"] [data-promotion-source="community-showcase:' + source.id + '"]');
    await expect(projected.getByRole("link", { name: "合成网页升推风采", exact: true })).toHaveAttribute("href", detail);
    await projected.getByRole("link", { name: "合成网页升推风采", exact: true }).click();
    await expect(page.getByRole("heading", { name: "合成网页升推风采", level: 1 })).toBeVisible();
    await newerPosts(7); await page.goto(path); await expect(page.locator("#showcase-" + source.id)).toHaveCount(0);
    await page.goto("/"); await projected.getByRole("link", { name: "合成网页升推风采", exact: true }).click();
    await expect(page.getByRole("heading", { name: "合成网页升推风采", level: 1 })).toBeVisible();
    await page.locator("#showcase-" + source.id).getByRole("button", { name: "隐藏风采", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "审核已保存" })).toBeVisible();
    expect((await page.request.get(detail, { headers: origin })).status()).toBe(404);
    await page.goto("/"); await expect(projected).toHaveCount(0);
    await page.goto(path + "?view=review"); await page.locator("#showcase-" + source.id).getByRole("button", { name: "批准发布", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "审核已保存" })).toBeVisible();
    await page.goto("/"); await expect(projected).toHaveCount(0);
    const retained = await p.findByID({ collection: "content-promotions", id: pending.id, user: admin, overrideAccess: false });
    expect(retained.status).toBe("needsReview"); expect(retained.approvedVersion).toBeTruthy();
  } finally { await staffContext.close(); }
});
test("外链风采保留社群展示，在同一风采上传受控视频后才可审核升推", async ({ page, browser }) => {
  test.setTimeout(180000);
  await page.route("https://example.invalid/**", route => route.abort());
  const source = await p.create({ collection: "community-showcase", user: admin, overrideAccess: false, context: { webShowcaseWrite: true },
    data: { game, author: admin.id, title: "合成外链转受控风采", body: "不抓取远程视频", videoURL: "https://example.invalid/mutable.mp4" } }); showcaseIDs.push(source.id);
  const detail = "/community/" + slug + "/showcase/" + source.id, staffContext = await browser.newContext();
  try {
    await login(page, admin); await page.goto(detail);
    await expect(page.getByText("外链视频保留社群展示", { exact: false })).toBeVisible();
    const staff = await staffContext.newPage(); await login(staff, execution); await staff.goto(detail);
    await expect(staff.getByText("上传或替换本站视频", { exact: true })).toHaveCount(0);
    const fixturePage = await browser.newPage();
    const clip = await fixturePage.evaluate(async () => {
      const canvas = document.createElement("canvas"); canvas.width = 160; canvas.height = 90; const ctx = canvas.getContext("2d")!;
      let frame = 0;
      const draw = () => { ctx.fillStyle = "#6633aa"; ctx.fillRect(0, 0, 160, 90); ctx.fillStyle = "white"; ctx.fillRect((frame++ * 5) % 140, 30, 20, 20); };
      draw(); const stream = canvas.captureStream(24), chunks: Blob[] = [], recorder = new MediaRecorder(stream, { mimeType: "video/mp4;codecs=avc1.42001E" });
      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = event => chunks.push(event.data); recorder.onerror = reject; recorder.onstop = () => resolve(new Blob(chunks, { type: "video/mp4" }));
        recorder.start(); const timer = setInterval(draw, 40); setTimeout(() => { clearInterval(timer); recorder.stop(); stream.getTracks().forEach(track => track.stop()); }, 1800);
      });
      const probe = document.createElement("video"), url = URL.createObjectURL(blob);
      try {
        const duration = await new Promise<number>((resolve, reject) => { probe.onloadedmetadata = () => resolve(probe.duration); probe.onerror = reject; probe.src = url; });
        return { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), duration };
      } finally { probe.removeAttribute("src"); probe.load(); URL.revokeObjectURL(url); }
    }).finally(() => fixturePage.close());
    expect(Number.isFinite(clip.duration)).toBe(true); expect(clip.duration).toBeGreaterThanOrEqual(1.5);
    await page.getByText("上传或替换本站视频", { exact: true }).click();
    await page.getByLabel("本站受控 MP4（10 MB 以内）", { exact: true }).setInputFiles({ name: "synthetic-controlled.mp4", mimeType: "video/mp4", buffer: Buffer.from(clip.bytes) });
    await page.getByRole("button", { name: "保存本站视频", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("本站视频已更新");
    const updated = await p.findByID({ collection: "community-showcase", id: source.id, user: admin, overrideAccess: false, depth: 0 });
    expect(updated.id).toBe(source.id); expect(updated.game).toBe(game); expect(updated.videoURL).toMatch(/^\/api\/showcase-videos\//);
    await page.getByRole("link", { name: "申请社团级展示", exact: true }).click();
    const item = page.locator('[data-promotion-source="community-showcase:' + source.id + '"]');
    await item.getByLabel("升推理由", { exact: true }).fill("合成受控视频符合升推边界");
    await item.getByRole("button", { name: "申请升推", exact: true }).click(); await expect(item).toContainText("待审核");
    const pending = (await p.find({ collection: "content-promotions", user: admin, overrideAccess: false, where: { sourceKey: { equals: "community-showcase:" + source.id } } })).docs[0];
    await staff.goto("/community/promotions?view=review"); await staff.locator('[data-promotion-record="' + pending.id + '"]').getByRole("button", { name: "通过升推", exact: true }).click();
    await expect(staff.locator('[data-promotion-source="community-showcase:' + source.id + '"]')).toContainText("已升推");
    await page.goto("/"); await expect(page.locator('[data-section="promoted-showcase"] [data-promotion-source="community-showcase:' + source.id + '"]')).toBeVisible();
  } finally { await staffContext.close(); }
});
