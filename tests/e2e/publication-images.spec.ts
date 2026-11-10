import "dotenv/config";
import { randomBytes } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import sharp from "sharp";
import config from "../../src/payload.config";
import type { User } from "../../src/payload-types";
import { browserTestOrigin } from "./browser-test-origin";

const suffix = randomBytes(5).toString("hex");
const password = randomBytes(20).toString("hex");
const slug = `image-fixture-${suffix}`;
const imageHeaders = { Origin: browserTestOrigin, "X-Questionnaire-Images": "1" };
const headers = { Origin: browserTestOrigin };
let p: Payload;
let president: User;
let member: User;
let game: number;
let png: Buffer;
const eventTitle = `合成配图活动 ${suffix}`;
const noticeTitle = `合成配图通知 ${suffix}`;

test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" ||
      !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Isolated browser test only");
  p = await getPayload({ config, key: "publication-images-browser" });
  const user = (name: string, roles: User["roles"]) => p.create({
    collection: "users", overrideAccess: true, context: { system: true },
    data: { name: `${name}-${suffix}`, email: `${name}-${suffix}@example.invalid`, password, roles },
  });
  president = await user("image-editor", ["president"]);
  member = await user("image-reader", ["member"]);
  game = (await p.create({
    collection: "games", overrideAccess: true, context: { system: true },
    data: { title: "合成配图社群", slug, _status: "published", demo: true },
  })).id;
  png = await sharp({ create: { width: 640, height: 320, channels: 3, background: "#8352aa" } }).png().toBuffer();
});

test.afterAll(async () => {
  if (!p) return;
  try {
    if (game) {
      for (const collection of ["event-signups", "community-posts", "events", "announcements"] as const)
        await p.delete({ collection, overrideAccess: true, where: { game: { equals: game } } });
      await p.delete({ collection: "games", id: game, overrideAccess: true });
    }
    for (const user of [president, member])
      if (user) await p.delete({ collection: "users", id: user.id, overrideAccess: true, context: { system: true } });
  } finally {
    await p.destroy();
  }
});

async function login(page: Page, user: User) {
  await page.goto("/login");
  await page.getByLabel("昵称或邮箱").fill(user.name);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}

async function addImage(scope: Locator, label: string, alt: string) {
  await scope.getByLabel(label, { exact: true }).setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: png });
  await scope.getByLabel("第 1 张图片说明（选填）", { exact: true }).fill(alt);
}

async function decoded(image: Locator) {
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(640);
}

test("网站发布活动和通知，问卷配图可以预览、保存和显示，原答卷继续可用", async ({ page, browser }) => {
  await login(page, president);
  await page.setViewportSize({ width: 390, height: 844 });
  const composer = `/community/${slug}/updates/new`;
  await page.goto(composer);
  const body = page.getByRole("region", { name: "内容与发布范围" });
  await body.getByRole("textbox", { name: "标题", exact: true }).fill(eventTitle);
  await body.getByRole("textbox", { name: "内容", exact: true }).fill("合成活动正文");
  await addImage(body, "正文配图", "合成活动海报");
  const builder = page.getByRole("region", { name: "问卷制作" });
  await builder.getByLabel("启用填写问卷报名").check();
  await builder.getByRole("button", { name: "单行文本", exact: true }).click();
  await builder.getByLabel("题目标题", { exact: true }).fill("合成题目");
  await addImage(builder, "问卷配图", "合成题目插图");
  await builder.getByLabel("展示位置").selectOption({ label: "第 1 题 · 合成题目" });
  await builder.getByRole("button", { name: "预览填写效果", exact: true }).click();
  const preview = page.getByRole("dialog");
  await decoded(preview.getByRole("img", { name: "合成题目插图", exact: true }));
  await preview.getByRole("button", { name: "关闭预览", exact: true }).click();
  await page.getByRole("button", { name: "发布社群活动" }).click();
  await expect(page.getByRole("status").filter({ hasText: "内容已发布到当前社群" })).toBeVisible();
  const post = (await p.find({
    collection: "community-posts", overrideAccess: true, limit: 1, where: { title: { equals: eventTitle } },
  })).docs[0];
  expect(post).toBeTruthy();

  await page.goto(composer);
  await body.getByLabel("类型").selectOption("notice");
  await body.getByRole("textbox", { name: "标题", exact: true }).fill(noticeTitle);
  await body.getByRole("textbox", { name: "内容", exact: true }).fill("合成通知正文");
  await addImage(body, "正文配图", "合成通知配图");
  await page.getByRole("button", { name: "发布社群通知" }).click();
  await expect(page.getByRole("status").filter({ hasText: "内容已发布到当前社群" })).toBeVisible();
  await page.goto(`/community/${slug}/updates`);
  await page.getByRole("link", { name: noticeTitle, exact: true }).click();
  await decoded(page.getByRole("img", { name: "合成通知配图", exact: true }));

  const endpoint = `/api/activities/community-posts/${post.id}/signup`;
  const viewer = await browser.newPage();
  try {
    await login(viewer, member);
    await viewer.goto(`/community/${slug}/updates/${post.id}`);
    await decoded(viewer.getByRole("img", { name: "合成活动海报", exact: true }));
    const fill = `/activities/community-posts/${post.id}/fill`;
    await viewer.goto(fill);
    await decoded(viewer.getByRole("img", { name: "合成题目插图", exact: true }));
    const original = await (await viewer.request.get(endpoint, { headers })).json();
    expect(original.images).toBeUndefined();
    const qid = original.form.questions[0].id;
    const answer = await viewer.request.post(endpoint, {
      headers, data: { version: original.version, answers: { [qid]: "合成原答卷" } },
    });
    expect(answer.status()).toBe(200);
    const originalReceipt = (await answer.json()).signup;

    const manage = endpoint + "?mode=manage";
    const before = await (await page.request.get(manage, { headers: imageHeaders })).json();
    await page.goto(`/activities/community-posts/${post.id}/manage`);
    await builder.getByLabel("第 1 张图片说明（选填）").fill("更新后的题图说明");
    await page.getByRole("button", { name: "保存报名问卷", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "报名问卷已保存" })).toBeVisible();

    const latest = await (await page.request.get(manage, { headers: imageHeaders })).json();
    expect(latest.version).toBe(original.version);
    expect(latest.imageRevision).not.toBe(before.imageRevision);
    expect(latest.images[0].alt).toBe("更新后的题图说明");
    expect((await page.request.put(endpoint, {
      headers: imageHeaders, data: { form: before.form, version: before.version, images: [], imageRevision: before.imageRevision },
    })).status()).toBe(409);
    expect((await viewer.request.put(endpoint, {
      headers: imageHeaders, data: { form: latest.form, version: latest.version, images: [], imageRevision: latest.imageRevision },
    })).status()).toBe(403);
    expect((await page.request.put(endpoint, {
      headers, data: { form: latest.form, version: latest.version },
    })).status()).toBe(200);
    const after = await (await viewer.request.get(endpoint, { headers: imageHeaders })).json();
    expect(after.images[0].alt).toBe("更新后的题图说明");
    expect(after.signup).toEqual(originalReceipt);
    const csv = await page.request.get(endpoint + "?mode=export", { headers });
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("合成原答卷");
  } finally {
    await viewer.close();
  }
});

test("后台正文配图随通知草稿保存，公开页只显示已发布的图片", async ({ page, request }) => {
  const doc = await p.create({
    collection: "announcements", user: president, overrideAccess: false, draft: true,
    data: { title: "合成后台配图通知", slug, game },
  });
  await login(page, president);
  await page.goto(`/admin/collections/announcements/${doc.id}`);
  await addImage(page.locator("main"), "正文配图", "合成后台通知配图");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect.poll(async () => {
    const draft = await p.findByID({ collection: "announcements", id: doc.id, draft: true, overrideAccess: true });
    return (draft.postImages as { alt: string }[] | undefined)?.[0]?.alt;
  }).toBe("合成后台通知配图");
  expect((await request.get(`/announcements/${slug}`)).status()).toBe(404);
  await page.getByRole("button", { name: "发布修改", exact: true }).click();
  await expect.poll(async () => {
    const live = await p.findByID({ collection: "announcements", id: doc.id, draft: false, overrideAccess: false, user: null }).catch(() => null);
    return live?._status;
  }).toBe("published");
  await page.goto(`/announcements/${slug}`);
  await decoded(page.getByRole("img", { name: "合成后台通知配图", exact: true }));
});
