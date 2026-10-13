import "dotenv/config";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { canAppoint, canReviewPromotion, canPublish, communityIDs, managesGame } from "../src/lib/rules";
import { decideCommunityApplication, editCommunityApplication, changeCommunityJoin, updateCommunityCard } from "../src/lib/community-operations";
import { activity, submitSignup, saveSignupForm } from "../src/lib/activity-signups";
import { normalizeSignup } from "../src/lib/signup-schema";
let p: Payload, president: User, vice: User, execution: User, publicity: User, member: User, outsider: User;
let game: number, post: number, otherGame: number | undefined, qr: string;
const suffix = randomBytes(5).toString("hex"), users: number[] = [], applications: number[] = [];
beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Isolated development database required");
  p = await getPayload({ config });
  const create = async (role: User["roles"], name: string, department?: User["department"]) => {
    const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: `${name}-${suffix}`, email: `${name}-${suffix}@example.invalid`, password: randomBytes(24).toString("hex"), roles: role, department } });
    users.push(user.id); return user;
  };
  president = await create(["president"], "governance"); vice = await create(["vicePresident"], "reviewer");
  execution = await create(["backbone"], "execution", "execution"); publicity = await create(["backbone"], "publicity", "publicity");
  member = await create(["member"], "participant"); outsider = await create(["member"], "outsider");
  game = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成运营社群", slug: `operations-${suffix}`, _status: "published" } })).id;
  qr = "data:image/png;base64," + (await sharp({ create: { width: 40, height: 40, channels: 3, background: "white" } }).png().toBuffer()).toString("base64");
});
afterAll(async () => {
  if (!p) return;
  await p.delete({ collection: "event-signups", overrideAccess: true, where: { game: { equals: game } } });
  await p.delete({ collection: "community-joins", overrideAccess: true, where: { game: { equals: game } } });
  if (post) await p.delete({ collection: "community-posts", id: post, overrideAccess: true });
  for (const id of applications) await p.delete({ collection: "community-applications", id, overrideAccess: true });
  await p.delete({ collection: "games", id: game, overrideAccess: true });
  if (otherGame) await p.delete({ collection: "games", id: otherGame, overrideAccess: true });
  for (const id of users) await p.delete({ collection: "users", id, overrideAccess: true, context: { system: true } });
  await p.destroy();
});
async function apply(user: User, name = "") {
  const app = await p.create({ collection: "community-applications", user, overrideAccess: false, data: { applicant: user.id, game: name ? undefined : game, proposedGame: name || "合成运营社群", reason: "希望组织游戏伙伴并承担社群运营工作。", realName: "合成申请者", phone: "13900000000", wechatQr: qr, contactConsent: true } });
  applications.push(app.id); return app;
}
describe.sequential("社群任职、最小权限与人工流程", () => {
  it("两部门骨干同权，无全站发布、任免、自动社群或私人资料权限", async () => {
    for (const user of [execution, publicity]) {
      expect(canReviewPromotion(user)).toBe(true); expect(canPublish(user)).toBe(false); expect(canAppoint(user)).toBe(false);
      expect(managesGame(user, game)).toBe(false); expect(communityIDs(user)).toEqual([]);
      await expect(p.findByID({ collection: "users", id: member.id, user, overrideAccess: false })).rejects.toThrow();
      await expect(p.update({ collection: "users", id: user.id, user, overrideAccess: false, data: { roles: ["president"] } })).rejects.toThrow();
    }
    expect(canAppoint(vice)).toBe(false); expect(canAppoint(president)).toBe(true);
  });
  it("骨干建群管理审批保留角色和部门，任职默认无报名隐私权限，不推断已入群", async () => {
    const app = await apply(execution);
    await expect(decideCommunityApplication(p, publicity, app.id, "approved", "", app.updatedAt)).rejects.toThrow();
    await decideCommunityApplication(p, vice, app.id, "approved", "", app.updatedAt);
    execution = await p.findByID({ collection: "users", id: execution.id, overrideAccess: true, depth: 0 });
    expect(execution.roles).toEqual(["backbone"]); expect(execution.department).toBe("execution");
    expect(managesGame(execution, game)).toBe(true); expect(communityIDs(execution, "viewSignups")).toEqual([]);
    expect((await p.count({ collection: "community-joins", user: execution, overrideAccess: false })).totalDocs).toBe(0);
    const audit = await p.find({ collection: "audit", overrideAccess: true, where: { object: { equals: `community-applications:${app.id}` } } });
    expect(audit.docs.some(row => row.action?.includes("pending->approved"))).toBe(true);
  });
  it("退回意见必填，本人修改重提保留记录，并可撤回；他人和原始接口不能修改", async () => {
    const app = await apply(publicity);
    await expect(decideCommunityApplication(p, vice, app.id, "returned", "", app.updatedAt)).rejects.toThrow();
    const returned = await decideCommunityApplication(p, vice, app.id, "returned", "请补充每周运营安排", app.updatedAt);
    await expect(editCommunityApplication(p, outsider, app.id, returned.updatedAt, { status: "pending", reason: "越权修改申请资料的测试文本" })).rejects.toThrow();
    const resubmitted = await editCommunityApplication(p, publicity, app.id, returned.updatedAt, { status: "pending", reason: "每周组织两次交流并及时维护游戏社群通知。", contactConsent: true });
    expect(resubmitted.id).toBe(app.id); expect(resubmitted.status).toBe("pending");
    const withdrawn = await editCommunityApplication(p, publicity, app.id, resubmitted.updatedAt, { status: "withdrawn" });
    expect(withdrawn.status).toBe("withdrawn");
    await expect(p.update({ collection: "community-applications", id: app.id, user: vice, overrideAccess: false, data: { status: "approved" } })).rejects.toThrow();
  });
  it("并发审批仅一项生效，失败保留可解释回执", async () => {
    const app = await apply(outsider);
    const results = await Promise.allSettled([decideCommunityApplication(p, vice, app.id, "approved", "", app.updatedAt), decideCommunityApplication(p, president, app.id, "rejected", "运营计划需要进一步准备", app.updatedAt)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });
  it("重复提交申请被数据库和业务校验收敛，保留旧申请", async () => {
    const app = await apply(member);
    await expect(apply(member)).rejects.toThrow();
    await expect(apply(member, "合成运营社群")).rejects.toThrow("该游戏已有社群");
    const result = await p.find({ collection: "community-applications", user: member, overrideAccess: false, where: { game: { equals: game } } });
    expect(result.docs).toHaveLength(1); expect(result.docs[0].id).toBe(app.id);
  });
  it("旧客户端新授权也默认关闭私人读取、导出和名片，不继承历史全能默认", async () => {
    const user = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: {
      name: `legacy-input-${suffix}`, email: `legacy-input-${suffix}@example.invalid`, password: randomBytes(24).toString("hex"), roles: ["communityAdmin"], communities: [game],
    } });
    users.push(user.id);
    expect(managesGame(user, game)).toBe(true);
    for (const capability of ["viewSignups", "exportSignups", "contactConsent"] as const) expect(communityIDs(user, capability)).toEqual([]);
  });
  it("更新/关闭名片不改变任职和平台角色，仅本人可操作", async () => {
    const app = (await p.find({ collection: "community-applications", overrideAccess: false, user: execution, where: { applicant: { equals: execution.id } } })).docs[0];
    await expect(updateCommunityCard(p, publicity, app.id, app.updatedAt, { contactConsent: false })).rejects.toThrow();
    const hidden = await updateCommunityCard(p, execution, app.id, app.updatedAt, { contactConsent: false });
    execution = await p.findByID({ collection: "users", id: execution.id, overrideAccess: true, depth: 0 });
    expect(communityIDs(execution, "contactConsent")).toEqual([]); expect(managesGame(execution, game)).toBe(true);
    await expect(changeCommunityJoin(p, member, game, "request", { contact: execution.id })).rejects.toThrow();
    await updateCommunityCard(p, execution, app.id, hidden.updatedAt, { contactConsent: true });
  });
  it("进群意向并发唯一；用户自报不能确认成功；范围/人工步骤/修订检查服务端执行", async () => {
    const results = await Promise.all([changeCommunityJoin(p, member, game, "request", { contact: execution.id }), changeCommunityJoin(p, member, game, "request", { contact: execution.id })]);
    expect(results[0].id).toBe(results[1].id); expect(results[0].status).toBe("requested");
    let row = results[0];
    await expect(changeCommunityJoin(p, member, game, "confirmJoined", { id: row.id, revision: row.updatedAt })).rejects.toThrow();
    row = await changeCommunityJoin(p, member, game, "reportFriend", { revision: row.updatedAt }); expect(row.status).toBe("friendReported");
    await expect(changeCommunityJoin(p, publicity, game, "confirmFriend", { id: row.id, revision: row.updatedAt })).rejects.toThrow();
    row = await changeCommunityJoin(p, execution, game, "confirmFriend", { id: row.id, revision: row.updatedAt }); expect(row.status).toBe("awaitingInvite");
    await expect(changeCommunityJoin(p, member, game, "withdraw", { revision: results[0].updatedAt })).rejects.toThrow();
    row = await changeCommunityJoin(p, execution, game, "confirmJoined", { id: row.id, revision: row.updatedAt });
    expect(row.status).toBe("joined"); expect(row.confirmedBy).toBe(execution.id);
    await expect(p.update({ collection: "community-joins", id: row.id, overrideAccess: false, user: member, data: { status: "joined" } })).rejects.toThrow();
  });
  it("内容/问卷编辑与私人名单读取/导出分开，CAS并发保存不覆盖", async () => {
    execution = await p.findByID({ collection: "users", id: execution.id, overrideAccess: true, depth: 0 });
    const form = normalizeSignup({ enabled: true, questions: [{ id: "name", label: "昵称", type: "text", required: true }] });
    post = (await p.create({ collection: "community-posts", overrideAccess: false, user: execution, context: { manageSignupForm: true }, data: { game, author: execution.id, title: "合成报名测试", category: "event", body: "隔离环境问卷并发和权限验证", signupForm: form } })).id;
    const current = await activity(p, "community-posts", post, execution, true);
    const receipt = await submitSignup(p, "community-posts", post, member, current.version, { name: "合成参与者" });
    await expect(p.findByID({ collection: "event-signups", id: receipt.id, overrideAccess: false, user: execution })).rejects.toThrow();
    await expect(activity(p, "community-posts", post, execution, true, undefined, "view")).rejects.toThrow();
    execution = await p.update({ collection: "users", id: execution.id, overrideAccess: false, user: president, data: { communityOffices: execution.communityOffices!.map(office => ({ ...office, viewSignups: true, exportSignups: false })) } });
    expect((await activity(p, "community-posts", post, execution, true, undefined, "view")).canView).toBe(true);
    await expect(activity(p, "community-posts", post, execution, true, undefined, "export")).rejects.toThrow();
    const results = await Promise.allSettled([saveSignupForm(p, "community-posts", post, execution, current.version, { ...form, title: "版本A" }), saveSignupForm(p, "community-posts", post, execution, current.version, { ...form, title: "版本B" })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1); expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });
  it("撤任或停用后传入旧身份也不能继续处理；平台角色不改变", async () => {
    const stale = execution;
    execution = await p.update({ collection: "users", id: execution.id, user: president, overrideAccess: false, data: { communityOffices: execution.communityOffices!.map(office => ({ ...office, status: "revoked" as const })) } });
    await expect(saveSignupForm(p, "community-posts", post, stale, "stale", {})).rejects.toThrow();
    await expect(changeCommunityJoin(p, publicity, game, "request", { contact: execution.id })).rejects.toThrow();
    expect(execution.roles).toEqual(["backbone"]);
    otherGame = (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "其他隔离社群", slug: `other-operations-${suffix}`, _status: "published" } })).id;
    execution = await p.update({ collection: "users", id: execution.id, user: president, overrideAccess: false, data: {
      communityOffices: [...execution.communityOffices!, { game: otherGame, status: "active", publishContent: false, reviewShowcase: false, handleJoins: false, viewSignups: true, exportSignups: false, contactConsent: false }],
    } });
    // Authorship does not bypass revocation of this community's private-data scope.
    const formerRecords = await p.find({ collection: "event-signups", user: execution, overrideAccess: false, where: { and: [{ game: { equals: game } }, { member: { equals: member.id } }] } });
    expect(formerRecords.docs).toEqual([]);
    await p.delete({ collection: "games", id: otherGame, overrideAccess: true }); otherGame = undefined;
    execution = await p.update({ collection: "users", id: execution.id, user: execution, overrideAccess: false, data: { name: execution.name } });
    expect(execution.communityOffices?.filter(office => office.status === "active")).toEqual([]);
    const oldVice = vice;
    await p.update({ collection: "users", id: vice.id, user: president, overrideAccess: false, data: { accountStatus: "suspended" } });
    const app = await apply(president, "停用审核测试" );
    await expect(decideCommunityApplication(p, oldVice, app.id, "approved", "", app.updatedAt)).rejects.toThrow();
  });
});
