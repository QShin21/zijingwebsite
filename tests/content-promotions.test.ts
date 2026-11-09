import "dotenv/config";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { beforeAll, beforeEach, afterEach, afterAll, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "../src/payload.config";
import type { ContentPromotion, User } from "../src/payload-types";
import { changePromotion, promotedContent, readPromotionSource } from "../src/lib/content-promotions";
import type { PromotionAction } from "../src/lib/promotion-model";
import { activity, submitSignup, saveSignupForm } from "../src/lib/activity-signups";
import { canAppoint, canPublish } from "../src/lib/rules";
import { saveVideo, discardVideo, videoPath, controlledVideoVersion } from "../src/lib/showcase-videos";

let p: Payload, leader: User, vice: User, admin: User, execution: User, publicity: User, member: User, outsider: User;
let game: number, otherGame: number, post: number;
const suffix = randomBytes(6).toString("hex"), actors: User[] = [], posts: number[] = [], showcases: number[] = [], receipts: number[] = [];
const form = { enabled: true, questions: [{ id: "name", label: "合成称呼", type: "text", required: true }] };
const videos: string[] = [];
function syntheticVideo(marker = "a") {
  // Container-header bytes test immutable storage/hash behavior; real playback remains in the MP4 E2E.
  const bytes = Buffer.alloc(64); bytes.writeUInt32BE(24, 0); bytes.write("ftyp", 4); bytes.write("isom", 8); bytes.write("mp41", 16); bytes.write("moov", 24); bytes.write("mdat", 32); bytes.write(marker, 40);
  return bytes;
}
async function event() {
  const row = await p.create({ collection: "community-posts", overrideAccess: false, user: admin, context: { manageSignupForm: true },
    data: { game, author: admin.id, title: "合成升推活动", body: "只有合成内容的社群活动", category: "event", signupForm: form } });
  posts.push(row.id); return row.id;
}
async function change(actor: User, action: PromotionAction, row?: ContentPromotion, reason = "适合社团成员共同参与的合成活动", id = post) {
  const source = await readPromotionSource(p, "community-posts", id).catch(() => null);
  return changePromotion(p, actor, "community-posts", id, action, { revision: row?.updatedAt ?? "", sourceVersion: source?.version ?? row?.requestedVersion, reason });
}
async function row(id = post) {
  return (await p.find({ collection: "content-promotions", overrideAccess: true, depth: 0, where: { sourceKey: { equals: "community-posts:" + id } } })).docs[0];
}
beforeAll(async () => {
  if (process.env.APP_ENV !== "development" || !["127.0.0.1", "localhost"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Synthetic loopback only");
  p = await getPayload({ config });
  const create = async (label: string, roles: User["roles"], department?: User["department"]) => {
    const actor = await p.create({ collection: "users", overrideAccess: true, context: { system: true }, data: { name: label + "-" + suffix, email: label + "-" + suffix + "@example.invalid", password: randomBytes(24).toString("hex"), roles, department } });
    actors.push(actor); return actor;
  };
  leader = await create("promotion-leader", ["president"]); vice = await create("promotion-vice", ["vicePresident"]);
  admin = await create("promotion-admin", ["member"]); execution = await create("promotion-execution", ["backbone"], "execution");
  publicity = await create("promotion-publicity", ["backbone"], "publicity"); member = await create("promotion-member", ["member"]); outsider = await create("promotion-outsider", ["member"]);
  const createGame = async (label: string) => (await p.create({ collection: "games", overrideAccess: true, context: { system: true }, data: { title: "合成升推社群" + label, slug: "promotion-" + label + "-" + suffix, _status: "published" } })).id;
  game = await createGame("a"); otherGame = await createGame("b");
  admin = await p.update({ collection: "users", id: admin.id, user: leader, overrideAccess: false, data: { communityOffices: [{ game, status: "active", publishContent: true, reviewShowcase: true, viewSignups: false, exportSignups: false }] } });
  outsider = await p.update({ collection: "users", id: outsider.id, user: leader, overrideAccess: false, data: { communityOffices: [{ game: otherGame, status: "active", publishContent: true, viewSignups: false, exportSignups: false }] } });
});
beforeEach(async () => {
  const fresh = await p.findByID({ collection: "users", id: admin.id, overrideAccess: true, depth: 0 });
  admin = await p.update({ collection: "users", id: admin.id, user: leader, overrideAccess: false, data: { communityOffices: fresh.communityOffices!.map(office => ({ ...office, status: "active" as const })) } });
  execution = await p.update({ collection: "users", id: execution.id, user: leader, overrideAccess: false, data: { roles: ["backbone"] } });
  post = await event();
});
afterEach(async () => {
  if (receipts.length) await p.delete({ collection: "event-signups", overrideAccess: true, where: { id: { in: receipts } } });
  const own = await p.find({ collection: "content-promotions", overrideAccess: true, pagination: false, where: { sourceKey: { in: [...posts.map(id => "community-posts:" + id), ...showcases.map(id => "community-showcase:" + id)] } } });
  if (own.docs.length) {
    await p.delete({ collection: "audit", overrideAccess: true, where: { object: { in: own.docs.map(doc => "content-promotions:" + doc.id) } } });
    await p.delete({ collection: "content-promotions", overrideAccess: true, where: { id: { in: own.docs.map(doc => doc.id) } } });
  }
  for (const id of posts) await p.delete({ collection: "community-posts", id, overrideAccess: true }).catch(() => null);
  for (const id of showcases) await p.delete({ collection: "community-showcase", id, overrideAccess: true, context: { webShowcaseWrite: true } }).catch(() => null);
  for (const video of videos) await discardVideo(video);
  videos.length = 0;
  posts.length = 0; showcases.length = 0; receipts.length = 0;
});
afterAll(async () => {
  if (!p) return;
  for (const actor of actors) await p.delete({ collection: "users", id: actor.id, overrideAccess: true, context: { system: true } });
  for (const id of [game, otherGame]) await p.delete({ collection: "games", id, overrideAccess: true });
  await p.destroy();
});

it("只允许当前社群管理员申请，原始写入/伪造上下文不能跳过动作授权", async () => {
  await expect(change(outsider, "submit")).rejects.toThrow();
  await expect(change(member, "submit")).rejects.toThrow();
  await expect(change(admin, "promote")).rejects.toThrow();
  await expect(p.create({ collection: "content-promotions", user: admin, overrideAccess: false, data: {
    sourceCollection: "community-posts", sourceID: post, sourceKey: "community-posts:" + post, game, kind: "event", status: "approved",
  } })).rejects.toThrow();
  const pending = await change(admin, "submit");
  await expect(p.update({ collection: "content-promotions", id: pending.id, user: execution, overrideAccess: false, data: { status: "approved" } })).rejects.toThrow();
  await expect(p.findByID({ collection: "content-promotions", id: pending.id, user: outsider, overrideAccess: false })).rejects.toThrow();
});
it("升推不复制活动或报名、不移动game，两部门骨干审核同权且无私人答案能力", async () => {
  const source = await activity(p, "community-posts", post, member);
  const receipt = await submitSignup(p, "community-posts", post, member, source.version, { name: "保留的合成答案" }); receipts.push(receipt.id);
  const before = (await p.count({ collection: "events", overrideAccess: true })).totalDocs;
  const pending = await change(admin, "submit"), approved = await change(execution, "approve", pending);
  expect(approved.status).toBe("approved"); expect(approved.sourceID).toBe(post); expect(Number(approved.game)).toBe(game);
  expect((await p.findByID({ collection: "community-posts", id: post, overrideAccess: true, depth: 0 })).game).toBe(game);
  expect((await p.count({ collection: "events", overrideAccess: true })).totalDocs).toBe(before);
  expect((await submitSignup(p, "community-posts", post, member, source.version, { name: "保留的合成答案" })).id).toBe(receipt.id);
  expect((await promotedContent(p, "event")).find(item => item.sourceKey === "community-posts:" + post)?.href).toContain("/updates/" + post);
  for (const actor of [admin, execution, publicity]) {
    await expect(p.findByID({ collection: "event-signups", id: receipt.id, user: actor, overrideAccess: false })).rejects.toThrow();
    await expect(activity(p, "community-posts", post, actor, true, undefined, "view")).rejects.toThrow();
  }
  for (const actor of [execution, publicity]) { expect(canPublish(actor)).toBe(false); expect(canAppoint(actor)).toBe(false); }
  const demoted = await change(publicity, "demote", approved, "合成降级理由");
  expect(demoted.status).toBe("demoted");
  expect((await change(vice, "promote", demoted, "重新确认适合社团级展示")).status).toBe("approved");
});
it("退回/拒绝需理由，撤回和重提使用同一记录，历史与审核决定可追踪", async () => {
  let current = await change(admin, "submit");
  await expect(change(publicity, "return", current, "")).rejects.toThrow();
  current = await change(publicity, "return", current, "请补充活动安排");
  const id = current.id; current = await change(admin, "submit", current);
  current = await change(admin, "withdraw", current, "");
  expect(current.status).toBe("withdrawn"); current = await change(admin, "submit", current);
  current = await change(leader, "reject", current, "需要进一步准备");
  current = await change(admin, "submit", current); current = await change(vice, "approve", current);
  expect(current.id).toBe(id); expect(current.history).toHaveLength(8);
  const audits = await p.find({ collection: "audit", overrideAccess: true, where: { object: { equals: "content-promotions:" + id } }, limit: 20 });
  expect(audits.docs).toHaveLength(8);
});
it("保存未改变的内容保持升推，正文改变后仍须复审", async () => {
  const approved = await change(execution, "promote", undefined, "合成主动升推理由");
  await p.update({ collection: "community-posts", id: post, user: admin, overrideAccess: false, data: { title: "合成升推活动" } });
  expect((await row()).status).toBe("approved");
  expect((await row()).approvedVersion).toBe(approved.approvedVersion);
  expect((await promotedContent(p, "event")).some(item => item.sourceKey === "community-posts:" + post)).toBe(true);
  await p.update({ collection: "community-posts", id: post, user: admin, overrideAccess: false, data: { body: "合成正文新内容" } });
  expect((await row()).status).toBe("needsReview");
  expect((await promotedContent(p, "event")).some(item => item.sourceKey === "community-posts:" + post)).toBe(false);
});
it("改稿/问卷修改立即撤下并复审，旧批准快照保留且旧版本不能通过", async () => {
  let current = await change(admin, "submit"); current = await change(execution, "approve", current);
  const approvedVersion = current.approvedVersion, approvedSnapshot = current.approvedSnapshot;
  await p.update({ collection: "community-posts", id: post, user: admin, overrideAccess: false, data: { title: "合成改稿活动" } });
  current = await row(); expect(current.status).toBe("needsReview"); expect(current.approvedVersion).toBe(approvedVersion); expect(current.approvedSnapshot).toEqual(approvedSnapshot);
  expect((await promotedContent(p, "event")).some(item => item.sourceKey === "community-posts:" + post)).toBe(false);
  current = await change(admin, "submit", current);
  const oldPending = current, source = await activity(p, "community-posts", post, admin, true);
  await saveSignupForm(p, "community-posts", post, admin, source.version, { ...source.form, title: "合成更新问卷" });
  expect((await row()).status).toBe("returned");
  await expect(change(execution, "approve", oldPending)).rejects.toThrow();
  current = await change(admin, "submit", await row()); current = await change(publicity, "approve", current);
  expect(current.approvedVersion).not.toBe(approvedVersion); expect((current.approvedSnapshot as { title: string }).title).toBe("合成改稿活动");
});
it("源隐藏/删除关闭展示，保留升推决定与既有本人答卷", async () => {
  const value = await activity(p, "community-posts", post, member);
  const receipt = await submitSignup(p, "community-posts", post, member, value.version, { name: "历史合成答案" }); receipts.push(receipt.id);
  await change(publicity, "promote", undefined, "合成主动升推理由");
  await p.update({ collection: "community-posts", id: post, user: admin, overrideAccess: false, data: { status: "hidden" } });
  expect((await row()).status).toBe("needsReview"); expect((await promotedContent(p, "event")).some(item => item.sourceKey === "community-posts:" + post)).toBe(false);
  await p.update({ collection: "community-posts", id: post, user: admin, overrideAccess: false, data: { status: "visible" } });
  const current = await change(execution, "promote", await row(), "合成重新升推");
  await p.delete({ collection: "community-posts", id: post, overrideAccess: true });
  expect((await row()).approvedSnapshot).toEqual(current.approvedSnapshot); expect((await row()).status).toBe("needsReview");
  expect((await p.findByID({ collection: "event-signups", id: receipt.id, user: member, overrideAccess: false })).answers).toEqual({ name: "历史合成答案" });
});
it("重复申请唯一，审核与撤回/其他审核竞争仅一项决定生效", async () => {
  const submitted = await Promise.allSettled([change(admin, "submit"), change(admin, "submit")]);
  expect(submitted.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await p.find({ collection: "content-promotions", overrideAccess: true, where: { sourceKey: { equals: "community-posts:" + post } } })).docs).toHaveLength(1);
  const pending = await row();
  const decisions = await Promise.allSettled([change(execution, "approve", pending), change(publicity, "return", pending, "合成退回理由"), change(admin, "withdraw", pending, "")]);
  expect(decisions.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await row()).history).toHaveLength(2);
});
it.each([1, 2, 3])("审核与改稿竞态 %i：新稿不能静默替换审核版本", async () => {
  const pending = await change(admin, "submit");
  await Promise.allSettled([change(execution, "approve", pending), p.update({ collection: "community-posts", id: post, user: admin, overrideAccess: false, data: { title: "合成竞态新稿" } })]);
  const latest = await readPromotionSource(p, "community-posts", post), current = await row();
  if (latest.snapshot.title === "合成竞态新稿") { expect(current.status).not.toBe("approved"); expect((await promotedContent(p, "event")).some(item => item.sourceKey === "community-posts:" + post)).toBe(false); }
  else if (current.status === "approved") expect(current.approvedVersion).toBe(latest.version);
  expect(current.history).toBeDefined();
});
it("旧身份不能在撤任/撤销骨干后继续申请或审核", async () => {
  const pending = await change(admin, "submit"), staleAdmin = admin, staleReviewer = execution;
  await p.update({ collection: "users", id: admin.id, user: leader, overrideAccess: false, data: { communityOffices: [] } });
  await expect(change(staleAdmin, "withdraw", pending, "")).rejects.toThrow();
  await p.update({ collection: "users", id: execution.id, user: leader, overrideAccess: false, data: { roles: ["member"] } });
  await expect(change(staleReviewer, "approve", pending)).rejects.toThrow();
});
it("公告使用原内容引用与审核流程，升推不生成活动或报名表", async () => {
  const notice = await p.create({ collection: "community-posts", user: admin, overrideAccess: false,
    data: { game, author: admin.id, title: "合成升推公告", body: "合成公告，不发送通知", category: "notice" } }); posts.push(notice.id);
  let current = await change(admin, "submit", undefined, "合成公告适合社团成员查看", notice.id);
  current = await change(publicity, "approve", current, "", notice.id);
  expect(current.kind).toBe("notice"); expect(current.sourceID).toBe(notice.id);
  expect((await promotedContent(p, "notice")).some(item => item.sourceKey === "community-posts:" + notice.id)).toBe(true);
  expect((await promotedContent(p, "event")).some(item => item.sourceKey === "community-posts:" + notice.id)).toBe(false);
  await expect(activity(p, "community-posts", notice.id, member)).rejects.toThrow();
  const snapshot = current.approvedSnapshot;
  await p.update({ collection: "community-posts", id: notice.id, user: admin, overrideAccess: false, data: { body: "合成公告改稿" } });
  current = await row(notice.id); expect(current.status).toBe("needsReview"); expect(current.approvedSnapshot).toEqual(snapshot);
});
it("活动改为公告必须复审，保留原来源键、原答卷及唯一升推记录", async () => {
  const value = await activity(p, "community-posts", post, member), receipt = await submitSignup(p, "community-posts", post, member, value.version, { name: "合成历史答卷" }); receipts.push(receipt.id);
  let current = await change(execution, "promote", undefined, "合成活动主动升推");
  const id = current.id;
  await p.update({ collection: "community-posts", id: post, user: admin, overrideAccess: false, context: { manageSignupForm: true },
    data: { category: "notice", signupForm: { enabled: false, questions: [] } } });
  expect((await row()).status).toBe("needsReview");
  current = await change(admin, "submit", await row()); current = await change(vice, "approve", current);
  expect(current.id).toBe(id); expect(current.kind).toBe("notice"); expect(current.sourceKey).toBe("community-posts:" + post);
  expect((await p.findByID({ collection: "event-signups", id: receipt.id, user: member, overrideAccess: false })).answers).toEqual({ name: "合成历史答卷" });
});
it("风采先本地审核再申请，骨干升推不授本地发布或私人报名能力", async () => {
  const source = await p.create({ collection: "community-showcase", user: member, overrideAccess: false, context: { webShowcaseWrite: true },
    data: { game, author: member.id, title: "合成风采记录", body: "合成内容", images: [] } }); showcases.push(source.id);
  expect(source.status).toBe("pending");
  await expect(changePromotion(p, admin, "community-showcase", source.id, "submit", { sourceVersion: "fake", reason: "合成风采需要升推" })).rejects.toThrow();
  await expect(p.update({ collection: "community-showcase", id: source.id, user: execution, overrideAccess: false, context: { webShowcaseWrite: true }, data: { status: "visible" } })).rejects.toThrow();
  await p.update({ collection: "community-showcase", id: source.id, user: admin, overrideAccess: false, context: { webShowcaseWrite: true }, data: { status: "visible" } });
  const visible = await readPromotionSource(p, "community-showcase", source.id);
  let current = await changePromotion(p, admin, "community-showcase", source.id, "submit", { sourceVersion: visible.version, reason: "合成风采适合社团展示" });
  current = await changePromotion(p, execution, "community-showcase", source.id, "approve", { revision: current.updatedAt, sourceVersion: current.requestedVersion });
  expect(current.kind).toBe("showcase"); expect(current.sourceID).toBe(source.id); expect(Number(current.game)).toBe(game);
  expect((await promotedContent(p, "showcase")).find(item => item.sourceKey === "community-showcase:" + source.id)?.href).toContain("/showcase/" + source.id);
  expect(canPublish(execution)).toBe(false);
});
it("风采媒体改稿撤下并保留旧批准版本，重新申请后才展示新版本", async () => {
  const image = async (background: string) => "data:image/png;base64," + (await sharp({ create: { width: 32, height: 32, channels: 3, background } }).png().toBuffer()).toString("base64");
  const source = await p.create({ collection: "community-showcase", user: admin, overrideAccess: false, context: { webShowcaseWrite: true },
    data: { game, author: admin.id, title: "合成风采媒体", body: "合成媒体", images: [{ source: await image("white"), caption: "合成原图" }] } }); showcases.push(source.id);
  const first = await readPromotionSource(p, "community-showcase", source.id);
  let current = await changePromotion(p, publicity, "community-showcase", source.id, "promote", { sourceVersion: first.version, reason: "合成媒体主动升推" });
  const approved = current.approvedVersion, snapshot = current.approvedSnapshot;
  await p.update({ collection: "community-showcase", id: source.id, user: admin, overrideAccess: false, context: { webShowcaseWrite: true }, data: { images: [{ source: await image("purple"), caption: "合成新图" }] } });
  current = (await p.find({ collection: "content-promotions", overrideAccess: true, where: { sourceKey: { equals: "community-showcase:" + source.id } } })).docs[0];
  expect(current.status).toBe("needsReview"); expect(current.approvedVersion).toBe(approved); expect(current.approvedSnapshot).toEqual(snapshot);
  expect((await promotedContent(p, "showcase")).some(item => item.sourceKey === "community-showcase:" + source.id)).toBe(false);
  const next = await readPromotionSource(p, "community-showcase", source.id);
  current = await changePromotion(p, admin, "community-showcase", source.id, "submit", { revision: current.updatedAt, sourceVersion: next.version, reason: "合成媒体改稿重新申请" });
  current = await changePromotion(p, vice, "community-showcase", source.id, "approve", { revision: current.updatedAt, sourceVersion: current.requestedVersion });
  expect(current.approvedVersion).not.toBe(approved);
});
it("社群外链视频仍可发布，但外链 MP4/B站均不能成为受审核视频升推", async () => {
  for (const url of ["https://example.invalid/mutable.mp4", "https://www.bilibili.com/video/BV1B7411m7LV/"]) {
    const source = await p.create({ collection: "community-showcase", user: admin, overrideAccess: false, context: { webShowcaseWrite: true },
      data: { game, author: admin.id, title: "合成外链视频", body: "社群功能保留", videoURL: url } }); showcases.push(source.id);
    expect(source.status).toBe("visible");
    await expect(readPromotionSource(p, "community-showcase", source.id)).rejects.toThrow("本站受控");
    await expect(changePromotion(p, execution, "community-showcase", source.id, "promote", { sourceVersion: "fake", reason: "不可用外链的合成升推" })).rejects.toThrow("本站受控");
  }
});
it("受控视频绑定实际字节，原地变化或删除不会继续展示旧批准版本，换新文件需复审", async () => {
  const url = await saveVideo(new File([syntheticVideo()], "synthetic.mp4", { type: "video/mp4" })); videos.push(url);
  const source = await p.create({ collection: "community-showcase", user: admin, overrideAccess: false, context: { webShowcaseWrite: true },
    data: { game, author: admin.id, title: "合成受控视频", videoURL: url } }); showcases.push(source.id);
  const first = await readPromotionSource(p, "community-showcase", source.id);
  let current = await changePromotion(p, execution, "community-showcase", source.id, "promote", { sourceVersion: first.version, reason: "合成受控视频审核" });
  expect((current.approvedSnapshot as { videoVersion: string }).videoVersion).toBe(await controlledVideoVersion(url));
  await writeFile(videoPath(url.split("/").pop()!), syntheticVideo("b"));
  expect((await promotedContent(p, "showcase")).some(item => item.sourceKey === "community-showcase:" + source.id)).toBe(false);
  expect((await readPromotionSource(p, "community-showcase", source.id)).version).not.toBe(current.approvedVersion);
  await discardVideo(url);
  await expect(readPromotionSource(p, "community-showcase", source.id)).rejects.toThrow("不可用");
  expect((await promotedContent(p, "showcase")).some(item => item.sourceKey === "community-showcase:" + source.id)).toBe(false);
  const nextURL = await saveVideo(new File([syntheticVideo("c")], "synthetic-new.mp4", { type: "video/mp4" })); videos.push(nextURL);
  await p.update({ collection: "community-showcase", id: source.id, user: admin, overrideAccess: false, context: { webShowcaseWrite: true }, data: { videoURL: nextURL } });
  current = (await p.find({ collection: "content-promotions", overrideAccess: true, where: { sourceKey: { equals: "community-showcase:" + source.id } } })).docs[0];
  expect(current.status).toBe("needsReview"); expect((current.approvedSnapshot as { videoURL: string }).videoURL).toBe(url);
  const next = await readPromotionSource(p, "community-showcase", source.id);
  current = await changePromotion(p, publicity, "community-showcase", source.id, "promote", { revision: current.updatedAt, sourceVersion: next.version, reason: "合成新视频重新审核" });
  expect(current.approvedVersion).toBe(next.version);
});
it.each([1, 2, 3])("首次主动升推与改稿竞争 %i：不匹配新稿不能作为批准版本展示", async () => {
  await Promise.allSettled([change(execution, "promote", undefined, "合成首次主动升推"), p.update({ collection: "community-posts", id: post, user: admin, overrideAccess: false, data: { title: "合成首次竞态新稿" } })]);
  const latest = await readPromotionSource(p, "community-posts", post), current = await row();
  const displayed = (await promotedContent(p, "event")).find(item => item.sourceKey === "community-posts:" + post);
  if (displayed) { expect(current.approvedVersion).toBe(latest.version); expect(displayed.snapshot.title).toBe(latest.snapshot.title); }
  if (latest.snapshot.title === "合成首次竞态新稿" && current?.approvedVersion !== latest.version) expect(displayed).toBeUndefined();
});
