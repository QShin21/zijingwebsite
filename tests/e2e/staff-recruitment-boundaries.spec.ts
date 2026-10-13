import "dotenv/config";
import { randomBytes } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { getPayload, type Payload } from "payload";
import config from "../../src/payload.config";
import type { StaffBatch, User } from "../../src/payload-types";
import { saveStaffBatch } from "../../src/lib/staff-recruitment";
import { defaultStaffForm } from "../../src/lib/staff-recruitment-model";

let p: Payload, president: User, vice: User, member: User, other: User;
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
  president = await actor("staff-boundary-president", ["president"]); vice = await actor("staff-boundary-vice", ["vicePresident"]);
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
  page.setDefaultTimeout(15000);
  await page.goto("/login"); await page.getByLabel("昵称或邮箱").fill(user.name); await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click(); await expect(page).toHaveURL(/\/account$/);
}
async function managementFormReady(page: Page, application: number) {
  // Editing prefilled textareas must wait until their form has hydrated.
  await page.waitForFunction(id => {
    const form = document.querySelector('[data-staff-application="' + id + '"] form');
    if (!form) return false;
    const controls = Array.from(form.querySelectorAll("textarea, button"));
    return controls.length > 0 && controls.every(control => Object.keys(control).some(key => key.startsWith("__reactProps$")));
  }, application);
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
    const nativeResponse = await page.request.get("/api/miniapp/staff/" + batch.id, { headers: origin });
    expect(nativeResponse.status()).toBe(200); expect(nativeResponse.headers()["cache-control"]).toBe("private, no-store");
    const native = await nativeResponse.json();
    expect(native).toMatchObject({ title: info.title, form: null, version: saved.formVersion, state: info.state,
      application: { id: saved.id, answers: saved.answers, updatedAt: saved.updatedAt }, actions: { submit: false, edit: false, withdraw: false } });
    for (const privateValue of [draftTitle, draftDescription, "private_draft", "仅管理层历史备注-" + suffix, "reviewNotes", "history", "requestKey"]) expect(JSON.stringify(native)).not.toContain(privateValue);
    const ownList = await (await page.request.get("/api/staff-applications?depth=0&where[applicant][equals]=" + member.id + "&select[batch]=true&select[batchTitle]=true&select[status]=true&select[updatedAt]=true", { headers: origin })).json();
    expect(ownList.docs).toEqual(expect.arrayContaining([expect.objectContaining({ id: saved.id, batch: batch.id, batchTitle: batch.title })]));
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
    expect((await outsider.request.get("/api/miniapp/staff/" + batch.id, { headers: origin })).status()).toBe(404);
    expect((await outsider.request.get("/api/staff-batches/" + batch.id, { headers: origin })).status()).toBe(404);
    expect((await outsider.request.post(endpoint(batch), { headers: origin, data: { version: saved.formVersion, answers } })).status()).toBe(404);
    await outsider.goto("/join/staff"); await expect(outsider.locator('[data-staff-receipt="' + saved.id + '"]')).toHaveCount(0); await expect(outsider.getByText(draftTitle, { exact: true })).toHaveCount(0);
    expect((await request.get(endpoint(batch))).status()).toBe(404);
    expect((await request.get("/api/miniapp/staff/" + batch.id)).status()).toBe(401);
    const guestPage = await request.get(path(batch), { maxRedirects: 0 }); expect(guestPage.status()).toBe(307); expect(guestPage.headers().location).toContain("/login");
    expect(await guestPage.text()).not.toContain(batch.title);
  } finally { await managerContext.close(); await otherContext.close(); }
});

test("原生同形审核请求缺省保留内部备注，显式清空仍生效，普通申请人读取与审核均隔离", async ({ page, browser }) => {
  const batch = await createBatch(), managerContext = await browser.newContext();
  try {
    await login(page, member); const own = await apply(page, batch);
    const manager = await managerContext.newPage(); await login(manager, president);
    const initial = await manager.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: own.id, revision: own.updatedAt,
      status: "reviewing", feedback: "合成选拔反馈", reviewNotes: "合成已有网页私有备注" } });
    expect(initial.status()).toBe(200); const noted = (await initial.json()).application;
    const returned = await manager.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: own.id, revision: noted.updatedAt,
      status: "returned", feedback: "合成原生审核退回反馈" } });
    expect(returned.status()).toBe(200); const result = (await returned.json()).application;
    expect(result.id).toBe(own.id); expect(result.reviewNotes).toBe("合成已有网页私有备注");
    expect((await p.findByID({ collection: "staff-applications", id: own.id, user: president, overrideAccess: false })).reviewNotes).toBe("合成已有网页私有备注");
    const native = await (await page.request.get("/api/miniapp/staff/" + batch.id, { headers: origin })).json();
    expect(native.application).toMatchObject({ id: own.id, status: "returned", feedback: "合成原生审核退回反馈", updatedAt: result.updatedAt });
    expect(JSON.stringify(native)).not.toContain("合成已有网页私有备注"); expect(native.application.reviewNotes).toBeUndefined();
    expect((await page.request.get("/api/miniapp/staff/" + batch.id + "?mode=review", { headers: origin })).status()).toBe(403);
    expect((await page.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: own.id, revision: result.updatedAt, status: "accepted", context: { system: true } } })).status()).toBe(403);
    const cleared = await manager.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: own.id, revision: result.updatedAt,
      status: "returned", feedback: "合成明确保留退回", reviewNotes: "" } });
    expect(cleared.status()).toBe(200); expect((await cleared.json()).application.reviewNotes).toBe("");
  } finally { await managerContext.close(); }
});

for (const finalStatus of ["accepted", "rejected"] as const) test(finalStatus + " 最终结果拒绝静默进入选拔，明确退回与反馈后本人才能补充", async ({ page, browser }) => {
  test.setTimeout(180000);
  const batch = await createBatch(), managerContext = await browser.newContext();
  try {
    await login(page, member); const receipt = await apply(page, batch);
    const manager = await managerContext.newPage(); await login(manager, vice);
    const response = await manager.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: receipt.id, revision: receipt.updatedAt, status: finalStatus, feedback: "合成最终结果反馈", reviewNotes: "合成最终结果私有备注" } });
    expect(response.status()).toBe(200); const final = (await response.json()).application;
    const nativeQueue = await (await manager.request.get("/api/miniapp/staff/" + batch.id + "?mode=review", { headers: origin })).json();
    expect(nativeQueue.docs.find((row: { id: number }) => row.id === final.id).actions.reviewStatuses).toEqual(["returned", finalStatus]);
    for (const feedback of ["", "尝试改变可见反馈"]) {
      const invalid = await manager.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: final.id, revision: final.updatedAt, status: "reviewing", feedback } });
      expect(invalid.status()).toBe(409); expect((await invalid.json()).error).toContain("先明确退回补充");
    }
    expect((await manager.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: final.id, revision: final.updatedAt, status: finalStatus === "accepted" ? "rejected" : "accepted", feedback: "合成结果更正须先退回" } })).status()).toBe(409);
    for (const feedback of ["", "   "]) expect((await manager.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: final.id, revision: final.updatedAt, status: "returned", feedback } })).status()).toBe(400);
    expect((await page.request.patch(endpoint(batch), { headers: origin, data: { revision: final.updatedAt, version: final.formVersion, answers: { ...answers, name: "未经退回擅改" } } })).status()).toBe(409);
    expect((await page.request.post(endpoint(batch), { headers: origin, data: { action: "withdraw", revision: final.updatedAt } })).status()).toBe(409);
    const retry = await page.request.post(endpoint(batch), { headers: origin, data: { answers: { ...answers, name: "重试不能改最终答案" } } });
    expect(retry.status()).toBe(200); expect((await retry.json()).application).toMatchObject({ id: final.id, status: finalStatus, updatedAt: final.updatedAt, answers: final.answers });
    const unchanged = await p.findByID({ collection: "staff-applications", id: final.id, user: president, overrideAccess: false });
    expect(unchanged.updatedAt).toBe(final.updatedAt); expect(unchanged.history).toEqual(final.history); expect(unchanged.feedback).toBe(final.feedback);
    await page.goto(path(batch)); await expect(page.getByRole("button", { name: "修改申请", exact: true })).toHaveCount(0); await expect(page.getByRole("button", { name: "撤回申请", exact: true })).toHaveCount(0);
    await manager.goto("/staff/manage?batch=" + batch.id);
    await managementFormReady(manager, final.id);
    const row = manager.locator('[data-staff-application="' + final.id + '"]');
    await expect(row.getByRole("button", { name: "进入选拔", exact: true })).toBeDisabled();
    await expect(row.getByRole("button", { name: finalStatus === "accepted" ? "未录用" : "录用", exact: true })).toBeDisabled();
    await expect(row.getByRole("button", { name: "退回补充", exact: true })).toBeEnabled();
    await row.getByRole("textbox", { name: /^本人可见反馈/ }).fill("");
    await expect(row.getByRole("textbox", { name: /^本人可见反馈/ })).toHaveValue("");
    await row.getByRole("button", { name: "退回补充", exact: true }).click();
    await expect(row.getByRole("alert").filter({ hasText: "退回或未录用须说明原因" })).toBeVisible();
    await managementFormReady(manager, final.id);
    await expect(row.getByRole("button", { name: "进入选拔", exact: true })).toBeDisabled();
    await row.getByRole("textbox", { name: /^本人可见反馈/ }).fill("请补充合成姓名，并重新提交资料");
    await row.getByRole("button", { name: "退回补充", exact: true }).click();
    await expect(manager.getByRole("status").filter({ hasText: "申请处理结果已保存" })).toBeVisible();
    await page.reload(); await expect(page.getByRole("heading", { name: "待补充 · 申请编号 " + final.id })).toBeVisible();
    await expect(page.getByText("处理反馈：请补充合成姓名，并重新提交资料", { exact: true })).toBeVisible();
    await expect(page.getByText("合成最终结果私有备注", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "修改申请", exact: true }).click();
    await page.getByLabel("姓名", { exact: true }).fill("合成明确退回后补充姓名");
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.getByRole("button", { name: "核对并提交", exact: true }).click();
    await page.getByRole("button", { name: "保存申请并提交", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "骨干申请已提交" })).toBeVisible();
    const current = await (await page.request.get(endpoint(batch), { headers: origin })).json();
    expect(current.application).toMatchObject({ id: final.id, status: "submitted", feedback: null, answers: { name: "合成明确退回后补充姓名" } });
    expect(current.application.reviewNotes).toBeUndefined();
    expect(current.application.history).toEqual(expect.arrayContaining([expect.objectContaining({ from: finalStatus, to: "returned", feedback: "请补充合成姓名，并重新提交资料" })]));
    expect((await p.findByID({ collection: "users", id: member.id, overrideAccess: true })).roles).toEqual(["member"]);
    await manager.reload(); await managementFormReady(manager, final.id); await expect(row.getByRole("button", { name: "进入选拔", exact: true })).toBeEnabled();
    await row.getByRole("button", { name: "进入选拔", exact: true }).click(); await expect(manager.getByRole("status").filter({ hasText: "申请处理结果已保存" })).toBeVisible();
    await expect(row.getByRole("heading", { name: /选拔处理中/ })).toBeVisible();
    const reviewing = await (await page.request.get(endpoint(batch), { headers: origin })).json(); expect(reviewing.application.status).toBe("reviewing");
  } finally { await managerContext.close(); }
});

test("同版本并发结果更新只有一次生效，失败请求及旧版本不能覆盖反馈、答案或角色", async ({ page, browser }) => {
  const batch = await createBatch(), presidentContext = await browser.newContext(), viceContext = await browser.newContext();
  try {
    await login(page, member); const receipt = await apply(page, batch);
    const manager = await presidentContext.newPage(), deputy = await viceContext.newPage(); await login(manager, president); await login(deputy, vice);
    const results = await Promise.all([
      manager.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: receipt.id, revision: receipt.updatedAt, status: "accepted", feedback: "合成并发录用" } }),
      deputy.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: receipt.id, revision: receipt.updatedAt, status: "rejected", feedback: "合成并发未录用" } }),
    ]);
    expect(results.map(response => response.status()).sort()).toEqual([200, 409]);
    const winner = (await results.find(response => response.status() === 200)!.json()).application;
    expect(winner.history).toHaveLength(2); expect(winner.answers).toEqual(receipt.answers);
    expect((await deputy.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: receipt.id, revision: receipt.updatedAt, status: "returned", feedback: "合成过期退回" } })).status()).toBe(409);
    const returns = await Promise.all([manager, deputy].map((reviewer, index) => reviewer.request.post(endpoint(batch), { headers: origin, data: { action: "review", id: winner.id, revision: winner.updatedAt, status: "returned", feedback: "合成明确退回 " + index } })));
    expect(returns.map(response => response.status()).sort()).toEqual([200, 409]);
    const returned = (await returns.find(response => response.status() === 200)!.json()).application;
    const current = (await (await page.request.get(endpoint(batch), { headers: origin })).json()).application;
    expect(current).toMatchObject({ id: receipt.id, status: "returned", feedback: returned.feedback, updatedAt: returned.updatedAt, answers: receipt.answers });
    expect(current.history).toHaveLength(3); expect(current.history[2]).toMatchObject({ from: winner.status, to: "returned", feedback: returned.feedback });
    const audit = await p.find({ collection: "audit", overrideAccess: true, where: { object: { equals: "staff-applications:" + receipt.id } } });
    expect(audit.docs.map(row => row.action).sort()).toEqual(["submit:new->submitted", "review:submitted->" + winner.status, "review:" + winner.status + "->returned"].sort());
    expect((await p.findByID({ collection: "users", id: member.id, overrideAccess: true })).roles).toEqual(["member"]);
  } finally { await presidentContext.close(); await viceContext.close(); }
});

test("保存与发布拒绝跳过核心资料的分支，合法扩展分支可提交且撤下历史快照仍可读", async ({ page, browser }) => {
  test.setTimeout(180000);
  let batch = await createBatch();
  const applicantContext = await browser.newContext(), otherContext = await browser.newContext();
  try {
    await login(page, president); await page.goto("/staff/manage?batch=" + batch.id);
    const editor = page.locator("details").filter({ has: page.getByText("配置批次：" + batch.title, { exact: true }) });
    const conditional = (label: string, target: string) => ({ when: { mode: "all" as const, rules: [{ questionId: "department", operator: "equals" as const, value: label }] }, target });
    const jumps = [
      [{ target: "$end" }], [{ target: "school" }],
      [conditional("执行部", "$end"), conditional("宣传部", "name")],
      [conditional("执行部", "name"), conditional("宣传部", "school")],
    ];
    for (const branches of jumps) for (const state of ["draft", "open"] as const) {
      await page.goto("/staff/manage?batch=" + batch.id);
      await editor.locator(":scope > summary").click();
      const invalid = structuredClone(defaultStaffForm); invalid.questions[0].jumps = branches;
      await editor.locator('input[name="signupForm"]').evaluate((node, form) => { (node as HTMLInputElement).value = JSON.stringify(form); }, invalid);
      await editor.getByRole("button", { name: state === "draft" ? "保存草稿" : "发布骨干招新", exact: true }).click();
      await expect(editor.getByRole("alert").filter({ hasText: "跳转不得跳过骨干申请核心必填字段" })).toBeVisible();
      const unchanged = await p.findByID({ collection: "staff-batches", id: batch.id, user: president, overrideAccess: false });
      expect(unchanged.updatedAt).toBe(batch.updatedAt); expect(unchanged.state).toBe("open"); expect(unchanged.signupForm).toEqual(batch.signupForm);
    }
    const invalid = structuredClone(defaultStaffForm); invalid.questions[0].jumps = [{ target: "$end" }];
    expect((await page.request.patch("/api/staff-batches/" + batch.id, { headers: origin, data: { state: "open", signupForm: invalid, context: { staffBatchWrite: true, system: true } } })).status()).toBe(403);
    const legal = structuredClone(defaultStaffForm);
    legal.questions.splice(1, 0, { id: "extra_rating", label: "合成扩展评分", type: "rating", required: true, options: [] }, { id: "role_note", label: "合成宣传扩展说明", type: "description", required: false, options: [] });
    legal.questions[0].jumps = [conditional("执行部", "name"), conditional("宣传部", "role_note")];
    legal.questions.find(question => question.id === "contact")!.jumps = [{ target: "$end" }];
    legal.questions.push({ id: "follow_up", label: "合成可跳过扩展题", type: "single", required: true, options: ["可以", "暂不"] });
    await page.goto("/staff/manage?batch=" + batch.id);
    await editor.locator(":scope > summary").click();
    await editor.locator('input[name="signupForm"]').evaluate((node, form) => { (node as HTMLInputElement).value = JSON.stringify(form); }, legal);
    await editor.getByRole("button", { name: "发布骨干招新", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "已发布" })).toBeVisible();
    batch = await p.findByID({ collection: "staff-batches", id: batch.id, user: president, overrideAccess: false });
    const applicant = await applicantContext.newPage(); await login(applicant, member); await applicant.goto(path(batch));
    await applicant.getByLabel("执行部", { exact: true }).check();
    await applicant.getByRole("button", { name: "下一步", exact: true }).click();
    await applicant.getByLabel("姓名", { exact: true }).fill(answers.name);
    await applicant.getByLabel("学校、院系与年级", { exact: true }).fill(answers.school); await applicant.getByLabel("申请动机", { exact: true }).fill(answers.motivation);
    await applicant.getByLabel("相关经验（无经验可说明兴趣）", { exact: true }).fill(answers.experience);
    await applicant.getByRole("button", { name: "下一步", exact: true }).click();
    await applicant.getByLabel("可投入时间与时段", { exact: true }).fill(answers.time);
    await applicant.getByLabel("一种便于联系的方式（邮箱或微信等）", { exact: true }).fill(answers.contact);
    await expect(applicant.getByLabel("合成扩展评分", { exact: true })).toHaveCount(0); await expect(applicant.getByLabel("合成可跳过扩展题", { exact: true })).toHaveCount(0);
    await applicant.getByRole("button", { name: "核对并提交", exact: true }).click(); await applicant.getByRole("button", { name: "提交骨干申请", exact: true }).click();
    await expect(applicant.getByRole("status").filter({ hasText: "骨干申请已提交" })).toBeVisible();
    const memberInfo = await (await applicant.request.get(endpoint(batch), { headers: origin })).json();
    const own = memberInfo.application; expect(own.answers).toMatchObject(answers); expect(own.answers).not.toHaveProperty("follow_up");
    expect(own.questions.some((question: { id: string }) => question.id === "role_note")).toBe(false);
    expect(own.questions[0].jumps.some((jump: { target: string }) => jump.target === "role_note")).toBe(true);
    const outsider = await otherContext.newPage(); await login(outsider, other);
    const publicity = await outsider.request.post(endpoint(batch), { headers: origin, data: { version: memberInfo.version, answers: { ...answers, department: "宣传部", name: "合成另一申请人", contact: "other-receipt@example.invalid" } } });
    expect(publicity.status()).toBe(200); const otherReceipt = (await publicity.json()).application; expect(otherReceipt.department).toBe("publicity");
    expect(otherReceipt.questions.some((question: { id: string }) => question.id === "role_note")).toBe(true);
    batch = await saveStaffBatch(p, president, batch.id, batch.updatedAt, { title: "合成撤下新草稿-" + suffix, state: "draft", signupForm: legal });
    for (const [applicantPage, receipt] of [[applicant, own], [outsider, otherReceipt]] as const) {
      const archived = await applicantPage.request.get(endpoint(batch), { headers: origin }); expect(archived.status()).toBe(200);
      expect(await archived.json()).toMatchObject({ form: null, state: "批次已撤下，仅可查看回执", application: { id: receipt.id, answers: receipt.answers } });
      const nativeArchived = await applicantPage.request.get("/api/miniapp/staff/" + batch.id, { headers: origin });
      expect(nativeArchived.status()).toBe(200);
      expect(await nativeArchived.json()).toMatchObject({ form: null, version: receipt.formVersion,
        state: "批次已撤下，仅可查看回执", application: { id: receipt.id, questions: receipt.questions, answers: receipt.answers } });
      expect((await applicantPage.goto(path(batch)))?.status()).toBe(200); await expect(applicantPage.getByRole("heading", { name: "已提交 · 申请编号 " + receipt.id })).toBeVisible();
      expect((await applicantPage.request.get("/api/staff-applications/" + (receipt.id === own.id ? otherReceipt.id : own.id), { headers: origin })).status()).toBe(404);
    }
  } finally { await applicantContext.close(); await otherContext.close(); }
});
