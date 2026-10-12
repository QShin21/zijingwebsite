import "dotenv/config";
import { randomBytes } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { StaffBatch, User } from "../../src/payload-types";
import { saveStaffBatch } from "../../src/lib/staff-recruitment";
import { defaultStaffForm } from "../../src/lib/staff-recruitment-model";

let p: Payload, president: User, member: User, other: User;
const suffix = randomBytes(6).toString("hex"), password = randomBytes(24).toString("hex"), actors: User[] = [], batches: number[] = [];
const origin = { Origin: "http://localhost:3000" };
const answers = { department: "执行部", name: "合成历史申请人", school: "合成院系年级", motivation: "合成申请动机", experience: "合成相关经验", time: "合成每周时段", contact: "own-receipt@example.invalid" };
const endpoint = (batch: StaffBatch) => "/api/staff/batches/" + batch.id + "/application";
const path = (batch: StaffBatch) => "/join/staff/batches/" + batch.id;

test.beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback only");
  p = await getPayload({ config, key: "staff-boundaries-browser" });
  const actor = async (name: string, roles: User["roles"]) => {
    const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: name + "-" + suffix, email: name + "-" + suffix + "@example.invalid", password, roles } });
    actors.push(user); return user;
  };
  president = await actor("staff-boundary-president", ["president"]);
  member = await actor("staff-boundary-member", ["member"]); other = await actor("staff-boundary-other", ["member"]);
});
test.afterEach(async () => {
  if (!p || !batches.length) return;
  const rows = await p.find({ collection: "staff-applications", overrideAccess: true, pagination: false, where: { batch: { in: batches } } });
  await p.delete({ collection: "staff-applications", overrideAccess: true, where: { batch: { in: batches } } });
  await p.delete({ collection: "audit", overrideAccess: true, where: { or: [
    { object: { in: [...batches.map(id => "staff-batches:" + id), ...rows.docs.map(row => "staff-applications:" + row.id)] } },
    { and: [{ object: { equals: "staff-applications" } }, { actor: { in: actors.map(actor => String(actor.id)) } }] },
  ] } });
  await p.delete({ collection: "staff-batches", overrideAccess: true, where: { id: { in: batches } } }); batches.length = 0;
});
test.afterAll(async () => {
  if (!p) return;
  for (const actor of actors) await p.delete({ collection: "users", id: actor.id, overrideAccess: true, context: { system: true } });
  await p.destroy();
});
async function createBatch() {
  const batch = await saveStaffBatch(p, president, null, "", { title: "合成历史骨干批次-" + suffix, description: "合成已公开批次说明", state: "open", endAt: new Date(Date.now() + 86400000).toISOString(), signupForm: defaultStaffForm });
  batches.push(batch.id); return batch;
}
async function login(page: Page, user: User) {
  await page.goto("/login"); await page.getByLabel("昵称或邮箱").fill(user.name); await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
}
async function apply(page: Page, batch: StaffBatch) {
  const info = await (await page.request.get(endpoint(batch), { headers: origin })).json();
  const response = await page.request.post(endpoint(batch), { headers: origin, data: { version: info.version, answers } });
  expect(response.status()).toBe(200); return (await response.json()).application;
}

test("发布后保存新草稿，本人旧链接及列表回执可读，游客和他人无权，撤下后不可写", async ({ page, browser, request }) => {
  test.setTimeout(180000);
  const batch = await createBatch(), managerContext = await browser.newContext(), otherContext = await browser.newContext();
  try {
    await login(page, member); const receipt = await apply(page, batch);
    const manager = await managerContext.newPage(); await login(manager, president);
    const reviewed = await manager.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: receipt.id, revision: receipt.updatedAt, status: "reviewing", feedback: "合成本人可见反馈", reviewNotes: "仅管理层历史备注-" + suffix } });
    expect(reviewed.status()).toBe(200); const saved = (await reviewed.json()).application;
    const outsider = await otherContext.newPage(); await login(outsider, other);
    expect((await outsider.request.get("/api/staff-applications/" + saved.id, { headers: origin })).status()).toBe(404);
    await manager.goto("/staff/manage?batch=" + batch.id);
    const editor = manager.locator("details").filter({ has: manager.getByText("配置批次：" + batch.title, { exact: true }) });
    await editor.locator(":scope > summary").click();
    const draftTitle = "撤下后私有草稿标题-" + suffix, draftDescription = "撤下后私有草稿说明-" + suffix;
    await editor.getByLabel("批次标题", { exact: true }).fill(draftTitle);
    await editor.getByRole("textbox", { name: /^批次说明/ }).fill(draftDescription);
    const draftForm = structuredClone(defaultStaffForm); draftForm.questions.push({ id: "private_draft", label: "撤下后私有新增问题-" + suffix, type: "text", required: false, options: [] });
    await editor.locator('input[name="signupForm"]').evaluate((node, form) => { (node as HTMLInputElement).value = JSON.stringify(form); }, draftForm);
    await editor.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(manager.getByRole("status").filter({ hasText: "草稿未公开" })).toBeVisible();
    const draft = await p.findByID({ collection: "staff-batches", id: batch.id, user: president, overrideAccess: false });
    expect(draft.state).toBe("draft"); expect(draft.title).toBe(draftTitle); expect(JSON.stringify(draft.signupForm)).toContain("private_draft");

    const document = await page.request.get(path(batch), { headers: origin }); expect(document.status()).toBe(200);
    expect(document.headers()["cache-control"]).toMatch(/no-cache|no-store/);
    const html = await document.text(); expect(html).toContain(batch.title);
    for (const privateValue of [draftTitle, draftDescription, "撤下后私有新增问题-" + suffix, "仅管理层历史备注-" + suffix]) expect(html).not.toContain(privateValue);
    const infoResponse = await page.request.get(endpoint(batch), { headers: origin }); expect(infoResponse.status()).toBe(200);
    expect(infoResponse.headers()["cache-control"]).toBe("private, no-store");
    const info = await infoResponse.json(); expect(info).toMatchObject({ title: batch.title, state: "批次已撤下，仅可查看回执", form: null, version: saved.formVersion, application: { id: saved.id, feedback: "合成本人可见反馈" } });
    expect(info.application.reviewNotes).toBeUndefined(); expect(info.draftKey).toBeUndefined(); expect(JSON.stringify(info)).not.toContain(draftTitle);
    await page.goto(path(batch)); await page.reload();
    await expect(page.getByRole("heading", { name: batch.title, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "选拔处理中 · 申请编号 " + saved.id })).toBeVisible();
    await expect(page.getByText("处理反馈：合成本人可见反馈", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "修改申请", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "撤回申请", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "刷新回执", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "批次已撤下，仅可查看回执" })).toBeVisible();
    await page.getByRole("link", { name: "查看骨干批次与本人回执", exact: true }).click();
    const historical = page.locator('[data-staff-receipt="' + saved.id + '"]');
    await expect(historical.getByRole("link", { name: batch.title, exact: true })).toBeVisible();
    await expect(page.getByText(draftTitle, { exact: true })).toHaveCount(0);
    await historical.getByRole("link", { name: "查看本人回执 ↗", exact: true }).click(); await expect(page).toHaveURL(new RegExp(path(batch) + "$"));
    for (const action of ["submit", "withdraw"]) expect((await page.request.post(endpoint(batch), { headers: origin, data: { action, revision: saved.updatedAt, version: saved.formVersion, answers } })).status()).toBe(404);
    expect((await page.request.patch(endpoint(batch), { headers: origin, data: { revision: saved.updatedAt, version: saved.formVersion, answers: { ...answers, name: "擅改合成姓名" } } })).status()).toBe(404);
    expect((await page.request.patch("/api/staff-applications/" + saved.id, { headers: origin, data: { answers: { name: "直接擅改" }, context: { system: true, staffApplicationWrite: true } } })).status()).toBe(403);
    const unchanged = await p.findByID({ collection: "staff-applications", id: saved.id, user: president, overrideAccess: false });
    expect(unchanged.updatedAt).toBe(saved.updatedAt); expect(unchanged.answers).toEqual(saved.answers); expect(unchanged.history).toEqual(saved.history);
    expect((await outsider.request.get(path(batch), { headers: origin })).status()).toBe(404);
    expect((await outsider.request.get(endpoint(batch), { headers: origin })).status()).toBe(404);
    expect((await outsider.request.get("/api/staff-batches/" + batch.id, { headers: origin })).status()).toBe(404);
    expect((await outsider.request.post(endpoint(batch), { headers: origin, data: { version: saved.formVersion, answers } })).status()).toBe(404);
    await outsider.goto("/join/staff"); await expect(outsider.locator('[data-staff-receipt="' + saved.id + '"]')).toHaveCount(0); await expect(outsider.getByText(draftTitle, { exact: true })).toHaveCount(0);
    expect((await request.get(endpoint(batch))).status()).toBe(404);
    const guestPage = await request.get(path(batch), { maxRedirects: 0 }); expect(guestPage.status()).toBe(307); expect(guestPage.headers().location).toContain("/login");
    expect(await guestPage.text()).not.toContain(batch.title);
  } finally { await managerContext.close(); await otherContext.close(); }
});
