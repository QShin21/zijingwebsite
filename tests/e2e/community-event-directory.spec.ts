import "dotenv/config";
import { randomBytes } from "node:crypto";
import type { PostgresAdapter } from "@payloadcms/db-postgres";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import sharp from "sharp";
import config from "../../src/payload.config";
import { activity, submitSignup } from "../../src/lib/activity-signups";
import { changePromotion, readPromotionSource } from "../../src/lib/content-promotions";
import type { User } from "../../src/payload-types";

const suffix = randomBytes(5).toString("hex");
const password = randomBytes(20).toString("hex");
const slug = `directory-a-${suffix}`;
const featuredTitle = `合成升推活动 ${suffix}`;
const localTitle = `合成未升推活动 ${suffix}`;
const foreignTitle = `合成另一项目活动 ${suffix}`;
const hiddenTitle = `合成已隐藏活动 ${suffix}`;
const noticeTitle = `合成旧通知 ${suffix}`;
const siteTitle = `合成站点活动 ${suffix}`;
let p: Payload, leader: User, manager: User, member: User;
let game: number, foreignGame: number, featured: number, local: number, notice: number;
let png: Buffer, replacement: Buffer;
const posts: number[] = [];
const form = { enabled: true, questions: [{ id: "name", label: "称呼", type: "text", required: true }] };

async function promote(id: number) {
  const source = await readPromotionSource(p, "community-posts", id);
  return changePromotion(p, leader, "community-posts", id, "promote", {
    reason: "合成目录测试", sourceVersion: source.version,
  });
}

test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" ||
      !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Isolated browser test only");
  p = await getPayload({ config, key: "community-event-directory-browser" });
  const user = (name: string, roles: User["roles"]) => p.create({
    collection: "users", overrideAccess: true, context: { system: true },
    data: { name: `${name}-${suffix}`, email: `${name}-${suffix}@example.invalid`, password, roles },
  });
  leader = await user("directory-leader", ["president"]);
  manager = await user("directory-manager", ["member"]);
  member = await user("directory-member", ["member"]);
  const makeGame = async (name: string, key: string) => (await p.create({
    collection: "games", overrideAccess: true, context: { system: true },
    data: { title: name, slug: key, _status: "published", demo: true },
  })).id;
  game = await makeGame("合成项目甲", slug);
  foreignGame = await makeGame("合成项目乙", `directory-b-${suffix}`);
  manager = await p.update({
    collection: "users", id: manager.id, user: leader, overrideAccess: false,
    data: { communityOffices: [{ game, status: "active", publishContent: true }] },
  });
  png = await sharp({ create: { width: 320, height: 180, channels: 3, background: "purple" } }).png().toBuffer();
  replacement = await sharp({ create: { width: 480, height: 180, channels: 3, background: "blue" } }).png().toBuffer();
  const makePost = async (title: string, gameID: number, category: "event" | "notice" = "event", signup = false) => {
    const post = await p.create({
      collection: "community-posts", user: leader, overrideAccess: false,
      context: { manageSignupForm: true, manageSignupImages: true },
      data: {
        game: gameID, author: leader.id, category, title, body: "隔离测试正文",
        ...(signup ? {
          signupForm: form,
          signupImages: [{ alt: "原问卷说明图", source: "data:image/png;base64," + png.toString("base64") }],
        } : {}),
      },
    });
    posts.push(post.id);
    return post.id;
  };
  featured = await makePost(featuredTitle, game, "event", true);
  // Simulate a pre-normalization questionnaire with a historical property.
  const db = p.db as unknown as PostgresAdapter;
  await db.pool.query("UPDATE community_posts SET signup_form=$1 WHERE id=$2", [
    JSON.stringify({ ...form, legacyNote: "保留原始字段" }), featured,
  ]);
  await promote(featured);
  local = await makePost(localTitle, game);
  notice = await makePost(noticeTitle, game, "notice");
  const hidden = await makePost(hiddenTitle, game);
  await p.update({ collection: "community-posts", id: hidden, user: leader, overrideAccess: false,
    data: { status: "hidden" } });
  for (let i = 1; i <= 12; i++) {
    const title = i === 12 ? foreignTitle : `合成升推填充 ${i} ${suffix}`;
    await promote(await makePost(title, foreignGame));
  }
  await makePost("合成乙组未升推活动", foreignGame);
  await p.create({
    collection: "events", user: leader, overrideAccess: false,
    data: { title: siteTitle, slug, game, startAt: "2099-01-01T12:00:00.000Z", _status: "published", demo: true },
  });
});

test.afterAll(async () => {
  if (!p) return;
  try {
    if (posts.length) {
      await p.delete({ collection: "event-signups", overrideAccess: true, where: { activityID: { in: posts } } });
      await p.delete({ collection: "content-promotions", overrideAccess: true,
        where: { sourceKey: { in: posts.map((id) => "community-posts:" + id) } } });
      await p.delete({ collection: "community-posts", overrideAccess: true, where: { id: { in: posts } } });
    }
    if (game) await p.delete({ collection: "events", overrideAccess: true, where: { slug: { equals: slug } } });
    for (const id of [game, foreignGame])
      if (id) await p.delete({ collection: "games", id, overrideAccess: true });
    for (const actor of [leader, manager, member])
      if (actor) await p.delete({ collection: "users", id: actor.id, overrideAccess: true, context: { system: true } });
  } finally {
    await p.destroy();
  }
});

function href(id: number) {
  return `/community/${slug}/updates/${id}`;
}

async function login(page: Page, user: User) {
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(user.name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function selectPicture(editor: Locator, label: string, buffer: Buffer, alt: string) {
  await editor.getByLabel(label, { exact: true }).setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer });
  const description = editor.getByLabel("第 1 张图片说明（选填）", { exact: true });
  await description.fill(alt);
}

async function openEditor(page: Page) {
  const article = page.getByRole("article", { name: "正文" });
  await article.getByText("编辑配图", { exact: true }).click();
  return article.locator("details");
}

async function assertPicture(page: Page, alt: string, width: number) {
  const image = page.locator("article[aria-label='正文'] > div > img").and(page.getByRole("img", { name: alt, exact: true }));
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(width);
}

test("全部项目翻页显示全部升推，游戏筛选合并已发布社群活动和站点活动", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/events");
  await expect(page.getByRole("link", { name: foreignTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: siteTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: localTitle, exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: hiddenTitle, exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "下一页 →" }).click();
  await expect(page.getByRole("link", { name: featuredTitle, exact: true })).toHaveAttribute("href", href(featured));

  await page.getByRole("combobox", { name: "游戏项目", exact: true }).selectOption(String(game));
  await page.getByRole("button", { name: "筛选活动" }).click();
  await expect(page.getByRole("link", { name: featuredTitle, exact: true })).toHaveAttribute("href", href(featured));
  await expect(page.getByRole("link", { name: localTitle, exact: true })).toHaveAttribute("href", href(local));
  await expect(page.getByRole("link", { name: siteTitle, exact: true })).toBeVisible();
  for (const title of [hiddenTitle, noticeTitle, foreignTitle])
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("combobox", { name: "时间", exact: true }).selectOption("upcoming");
  await page.getByRole("button", { name: "筛选活动" }).click();
  await expect(page.getByRole("link", { name: siteTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: localTitle, exact: true })).toHaveCount(0);
});

test("管理员在原详情页给已发布活动和通知补图与换图，原问卷答卷保留", async ({ page, browser }) => {
  const questionnaire = await activity(p, "community-posts", featured, member);
  const receipt = await submitSignup(p, "community-posts", featured, member, questionnaire.version, { name: "原答卷" });
  const before = await p.findByID({ collection: "community-posts", id: featured, overrideAccess: true, depth: 0 });
  const answerBefore = await p.findByID({ collection: "event-signups", id: receipt.id, overrideAccess: true, depth: 0 });
  await login(page, manager);
  await page.goto(href(featured));
  const editor = await openEditor(page);

  const stale = await page.context().newPage();
  try {
    await stale.goto(href(featured));
    const oldEditor = await openEditor(stale);
    await selectPicture(oldEditor, "正文配图", replacement, "较早打开的草稿");
    await selectPicture(editor, "正文配图", png, "补充海报");
    await editor.getByRole("button", { name: "保存配图", exact: true }).click();
    await assertPicture(page, "补充海报", 320);
    await expect(page).toHaveURL(new RegExp(href(featured) + "$"));

    await oldEditor.getByRole("button", { name: "保存配图", exact: true }).click();
    await expect(oldEditor.getByRole("alert")).toContainText("内容已有更新");
    await expect(oldEditor.getByLabel("第 1 张图片说明（选填）")).toHaveValue("较早打开的草稿");
    await selectPicture(editor, "更换第 1 张图片", replacement, "替换后的海报");
    await editor.getByRole("button", { name: "保存配图", exact: true }).click();
    await assertPicture(page, "替换后的海报", 480);
    await expect(page.locator("article[aria-label='正文'] > div > img")).toHaveCount(1);
  } finally {
    await stale.close();
  }

  const saved = await p.findByID({ collection: "community-posts", id: featured, overrideAccess: true, depth: 0 });
  expect(saved).toMatchObject({ id: before.id, game: before.game, body: before.body });
  expect(saved.signupForm).toEqual(before.signupForm);
  expect(saved.signupImages).toEqual(before.signupImages);
  expect(await p.findByID({ collection: "event-signups", id: receipt.id, overrideAccess: true, depth: 0 })).toEqual(answerBefore);
  expect((await activity(p, "community-posts", featured, member)).version).toBe(questionnaire.version);
  const approval = (await p.find({ collection: "content-promotions", overrideAccess: true, depth: 0,
    where: { sourceKey: { equals: "community-posts:" + featured } } })).docs[0];
  expect(approval.status).toBe("needsReview");

  await page.goto(href(notice));
  const noticeEditor = await openEditor(page);
  await selectPicture(noticeEditor, "正文配图", png, "旧通知补图");
  await noticeEditor.getByRole("button", { name: "保存配图", exact: true }).click();
  await assertPicture(page, "旧通知补图", 320);
  await expect(page).toHaveURL(new RegExp(href(notice) + "$"));

  const reader = await browser.newPage();
  try {
    await login(reader, member);
    await reader.goto(href(featured));
    await assertPicture(reader, "替换后的海报", 480);
    await expect(reader.getByText("编辑配图", { exact: true })).toHaveCount(0);
    await expect(reader.getByRole("heading", { name: "我的报名回执", exact: true })).toBeVisible();
  } finally {
    await reader.close();
  }

  // A previously opened form must also honor a revoked office at write time.
  await selectPicture(noticeEditor, "更换第 1 张图片", replacement, "撤权后尝试替换");
  await p.update({ collection: "users", id: manager.id, user: leader, overrideAccess: false,
    data: { communityOffices: [] } });
  await noticeEditor.getByRole("button", { name: "保存配图", exact: true }).click();
  await expect(noticeEditor.getByRole("alert")).toContainText("无权编辑");
  await assertPicture(page, "旧通知补图", 320);
});
