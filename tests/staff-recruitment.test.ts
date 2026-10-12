import "dotenv/config";
import { randomBytes } from "node:crypto";
import { beforeAll, beforeEach, afterEach, afterAll, expect, it, vi } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "../src/payload.config";
import type { StaffBatch, User } from "../src/payload-types";
import { saveStaffBatch, changeStaffApplication, ownStaffApplication, ownStaffReceiptHeaders, readStaffApplications, currentStaffBatches, publicStaffBatch } from "../src/lib/staff-recruitment";
import { defaultStaffForm, staffWindow } from "../src/lib/staff-recruitment-model";
import { formVersion } from "../src/lib/activity-signups";
import { canAppoint } from "../src/lib/rules";

let p: Payload, president: User, vice: User, member: User, other: User, admin: User, backbone: User, batch: StaffBatch;
const suffix = randomBytes(6).toString("hex"), actors: User[] = [], batches: number[] = [];
const answers = { department: "执行部", name: "合成申请人", school: "合成院系与年级", motivation: "合成动机", experience: "暂无经验，有合成兴趣", time: "合成每周时段", contact: "synthetic@example.invalid" };
async function create(open = true) {
  let row = await saveStaffBatch(p, president, null, "", { title: "合成骨干批次", state: "draft", signupForm: defaultStaffForm, endAt: new Date(Date.now() + 86400000).toISOString() });
  batches.push(row.id);
  if (open) row = await saveStaffBatch(p, president, row.id, row.updatedAt, { title: row.title, state: "open", signupForm: defaultStaffForm, endAt: row.endAt });
  return row;
}
const apply = (actor = member) => changeStaffApplication(p, actor, batch.id, "submit", { version: formVersion(defaultStaffForm), answers });
beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback only");
  p = await getPayload({ config });
  const actor = async (label: string, roles: User["roles"]) => {
    const value = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: label + "-" + suffix, email: label + "-" + suffix + "@example.invalid", password: randomBytes(24).toString("hex"), roles } });
    actors.push(value); return value;
  };
  president = await actor("staff-president", ["president"]); vice = await actor("staff-vice", ["vicePresident"]);
  member = await actor("staff-member", ["member"]); other = await actor("staff-other", ["member"]);
  admin = await actor("staff-local-admin", ["communityAdmin"]); backbone = await actor("staff-backbone", ["backbone"]);
});
beforeEach(async () => {
  vice = await p.update({ collection: "users", id: vice.id, user: president, overrideAccess: false, data: { roles: ["vicePresident"], accountStatus: "active" } });
  batch = await create();
});
afterEach(async () => {
  vi.restoreAllMocks();
  const rows = await p.find({ collection: "staff-applications", overrideAccess: true, pagination: false, where: { batch: { in: batches } } });
  await p.delete({ collection: "staff-applications", overrideAccess: true, where: { batch: { in: batches } } });
  await p.delete({ collection: "audit", overrideAccess: true, where: { or: [
    { object: { in: [...batches.map(id => "staff-batches:" + id), ...rows.docs.map(row => "staff-applications:" + row.id)] } },
    { and: [{ object: { equals: "staff-applications" } }, { actor: { in: actors.map(actor => String(actor.id)) } }] },
  ] } });
  await p.delete({ collection: "staff-batches", overrideAccess: true, where: { id: { in: batches } } }); batches.length = 0;
});
afterAll(async () => { if (p) { for (const actor of actors) await p.delete({ collection: "users", id: actor.id, overrideAccess: true, context: { system: true } }); await p.destroy(); } });

it("草稿不公开，唯一当前批次动态投影；关闭后才可发布下一批次", async () => {
  const draft = await create(false);
  await expect(publicStaffBatch(p, draft.id)).rejects.toThrow();
  expect((await currentStaffBatches(p)).map(row => row.id)).toEqual([batch.id]);
  await expect(saveStaffBatch(p, vice, draft.id, draft.updatedAt, { title: draft.title, state: "open", endAt: draft.endAt, signupForm: defaultStaffForm })).rejects.toThrow("已有当前");
  await saveStaffBatch(p, vice, batch.id, batch.updatedAt, { title: batch.title, state: "closed", endAt: batch.endAt, signupForm: defaultStaffForm });
  await saveStaffBatch(p, vice, draft.id, draft.updatedAt, { title: draft.title, state: "open", endAt: draft.endAt, signupForm: defaultStaffForm });
  expect((await currentStaffBatches(p)).map(row => row.id)).toEqual([draft.id]);
});
it("重复及同时申请仅一个记录，重试保留原作答", async () => {
  const results = await Promise.allSettled([apply(), apply()]);
  expect(results.some(result => result.status === "fulfilled")).toBe(true);
  const rows = await p.find({ collection: "staff-applications", user: member, overrideAccess: false, where: { batch: { equals: batch.id } } });
  expect(rows.docs).toHaveLength(1); expect((await apply()).id).toBe(rows.docs[0].id); expect(rows.docs[0].answers).toEqual({ ...answers, works: "" });
});
it("撤下后的本人回执标题来自原申请，最小列表不读取新草稿或他人资料", async () => {
  const current = await apply();
  await saveStaffBatch(p, president, batch.id, batch.updatedAt, { title: "私有新草稿标题", description: "私有新草稿说明", state: "draft", signupForm: defaultStaffForm });
  await expect(publicStaffBatch(p, batch.id)).rejects.toThrow();
  expect(await currentStaffBatches(p)).toEqual([]);
  const own = (await ownStaffReceiptHeaders(p, member, batch.id))!.docs[0];
  expect(own).toMatchObject({ id: current.id, batch: batch.id, batchTitle: batch.title, status: "submitted" });
  expect(own).not.toHaveProperty("answers"); expect(own).not.toHaveProperty("reviewNotes");
  expect((await ownStaffReceiptHeaders(p, other, batch.id))?.docs).toEqual([]);
  expect((await ownStaffReceiptHeaders(p, vice, batch.id))?.docs).toEqual([]);
  expect(await ownStaffReceiptHeaders(p, null, batch.id)).toBeNull();
  for (const action of ["submit", "edit", "withdraw"] as const) await expect(changeStaffApplication(p, member, batch.id, action, { revision: current.updatedAt, version: current.formVersion, answers })).rejects.toThrow();
  expect((await ownStaffApplication(p, member, batch.id))?.updatedAt).toBe(current.updatedAt);
});
it("两个草稿同时发布只产生一个当前批次", async () => {
  await saveStaffBatch(p, president, batch.id, batch.updatedAt, { title: batch.title, state: "closed", endAt: batch.endAt });
  const first = await create(false), second = await create(false);
  const results = await Promise.allSettled([first, second].map(row => saveStaffBatch(p, vice, row.id, row.updatedAt, {
    title: row.title, state: "open", endAt: row.endAt, signupForm: defaultStaffForm,
  })));
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(await currentStaffBatches(p)).toHaveLength(1);
});
it("开放期间修改、撤回及重提保留同一ID与历史，截止后仅可查看", async () => {
  let current = await apply(); const id = current.id;
  current = await changeStaffApplication(p, member, batch.id, "edit", { version: formVersion(defaultStaffForm), revision: current.updatedAt, answers: { ...answers, time: "合成新时段" } });
  current = await changeStaffApplication(p, member, batch.id, "withdraw", { revision: current.updatedAt });
  expect(current.status).toBe("withdrawn");
  current = await changeStaffApplication(p, member, batch.id, "submit", { version: formVersion(defaultStaffForm), revision: current.updatedAt, answers });
  expect(current.id).toBe(id); expect(current.history).toHaveLength(4);
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(batch.endAt!));
  expect(staffWindow(batch)).toBe("申请已截止");
  await expect(changeStaffApplication(p, member, batch.id, "edit", { version: formVersion(defaultStaffForm), revision: current.updatedAt, answers })).rejects.toThrow("截止");
  await expect(changeStaffApplication(p, member, batch.id, "withdraw", { revision: current.updatedAt })).rejects.toThrow("截止");
  expect((await ownStaffApplication(p, member, batch.id))?.id).toBe(id);
});
it("明确退回反馈、内部备注分开；录用不改变角色，任免仍仅社长", async () => {
  let current = await apply();
  await expect(changeStaffApplication(p, vice, batch.id, "review", { id: current.id, revision: current.updatedAt, status: "returned" })).rejects.toThrow();
  await changeStaffApplication(p, vice, batch.id, "review", { id: current.id, revision: current.updatedAt, status: "returned", feedback: "请补充合成时段", reviewNotes: "管理层合成内部备注" });
  const own = await ownStaffApplication(p, member, batch.id); expect(own?.feedback).toBe("请补充合成时段"); expect(own?.reviewNotes).toBeUndefined();
  current = await changeStaffApplication(p, member, batch.id, "edit", { revision: own!.updatedAt, version: formVersion(defaultStaffForm), answers });
  current = await changeStaffApplication(p, vice, batch.id, "review", { id: current.id, revision: current.updatedAt, status: "accepted", feedback: "合成录用结果" });
  expect(current.status).toBe("accepted");
  expect((await p.findByID({ collection: "users", id: member.id, overrideAccess: true })).roles).toEqual(["member"]);
  expect(canAppoint(vice)).toBe(false); expect(canAppoint(president)).toBe(true);
  await expect(changeStaffApplication(p, member, batch.id, "edit", { revision: current.updatedAt, version: formVersion(defaultStaffForm), answers })).rejects.toThrow("最终结果");
});
it("社群管理员、骨干和其他申请人不能读取/导出他人候选资料", async () => {
  const current = await apply();
  for (const actor of [admin, backbone, other]) {
    await expect(p.findByID({ collection: "staff-applications", id: current.id, user: actor, overrideAccess: false })).rejects.toThrow();
    await expect(readStaffApplications(p, actor, batch.id, new URLSearchParams(), true)).rejects.toThrow();
    await expect(changeStaffApplication(p, actor, batch.id, "review", { id: current.id, revision: current.updatedAt, status: "accepted" })).rejects.toThrow();
  }
  const exported = await readStaffApplications(p, vice, batch.id, new URLSearchParams("department=execution&status=submitted"), true);
  expect("csv" in exported && exported.csv).toContain("合成申请人");
  const audits = await p.find({ collection: "audit", overrideAccess: true, where: { actor: { equals: String(vice.id) } } });
  expect(audits.docs.map(row => row.action)).toEqual(expect.arrayContaining(["read-staff-applications", "export-staff-applications"]));
  expect(JSON.stringify(audits.docs)).not.toContain(answers.contact);
  await expect(p.update({ collection: "staff-applications", id: current.id, user: vice, overrideAccess: false, data: { status: "accepted" } })).rejects.toThrow();
});
it("并发审核及撤回竞争仅一个新决定；原答案与权限保持", async () => {
  const current = await apply();
  const results = await Promise.allSettled([
    changeStaffApplication(p, vice, batch.id, "review", { id: current.id, revision: current.updatedAt, status: "accepted" }),
    changeStaffApplication(p, president, batch.id, "review", { id: current.id, revision: current.updatedAt, status: "rejected", feedback: "合成未录用" }),
    changeStaffApplication(p, member, batch.id, "withdraw", { revision: current.updatedAt }),
  ]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await ownStaffApplication(p, member, batch.id))?.history).toHaveLength(2);
});
it("跨批次不可转移或审核另一批次记录，按新批次独立申请", async () => {
  const current = await apply();
  batch = await saveStaffBatch(p, president, batch.id, batch.updatedAt, { title: batch.title, state: "closed", endAt: batch.endAt, signupForm: defaultStaffForm });
  const next = await create();
  await expect(changeStaffApplication(p, vice, next.id, "review", { id: current.id, revision: current.updatedAt, status: "accepted" })).rejects.toThrow("批次不匹配");
  const newRecord = await changeStaffApplication(p, member, next.id, "submit", { version: formVersion(defaultStaffForm), answers: { ...answers, department: "宣传部" } });
  expect(newRecord.id).not.toBe(current.id); expect(newRecord.department).toBe("publicity"); expect((await ownStaffApplication(p, member, batch.id))?.id).toBe(current.id);
});
it("截止边界、开始窗口和充分字段均在后端校验", async () => {
  expect(staffWindow({ state: "open", startAt: "2099-01-01T00:00:00Z", endAt: "2099-01-02T00:00:00Z" }, 0)).toBe("申请尚未开始");
  await expect(changeStaffApplication(p, member, batch.id, "submit", { version: "old", answers })).rejects.toThrow("问卷已更新");
  await expect(changeStaffApplication(p, member, batch.id, "submit", { version: formVersion(defaultStaffForm), answers: { ...answers, contact: "" } })).rejects.toThrow();
  await expect(changeStaffApplication(p, member, batch.id, "submit", { version: formVersion(defaultStaffForm), answers: { ...answers, works: "http://example.invalid" } })).rejects.toThrow("HTTPS");
});
it("撤销管理身份后旧对象不能审核或导出，本人仍可查看自己的回执", async () => {
  const current = await apply(), stale = vice;
  await p.update({ collection: "users", id: vice.id, user: president, overrideAccess: false, data: { roles: ["member"] } });
  await expect(changeStaffApplication(p, stale, batch.id, "review", { id: current.id, revision: current.updatedAt, status: "accepted" })).rejects.toThrow();
  await expect(readStaffApplications(p, stale, batch.id, new URLSearchParams(), true)).rejects.toThrow();
  expect((await ownStaffApplication(p, member, batch.id))?.id).toBe(current.id);
});
