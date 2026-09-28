import "dotenv/config";
import { up as installChatNotifications } from "../src/migrations/20260928_120000_chat_notifications";
import type { MigrateUpArgs } from "@payloadcms/db-postgres";
import sharp from "sharp";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { randomBytes } from "node:crypto";
let p: Payload;
let qr: string;
const suffix = String(Date.now());
const password = randomBytes(24).toString("hex");
let member: User;
let vice: typeof member;
let game: number;
let application: number;
let forum: number;
let announcement: number;
beforeAll(async () => {
  if (process.env.APP_ENV !== "development") throw new Error("Integration tests require a development database");
  p = await getPayload({ config });
  qr = "data:image/png;base64," + (await sharp({ create: { width: 40, height: 40, channels: 3, background: "white" } }).png().toBuffer()).toString("base64");
  member = await p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { name: "社群测试成员", email: `member-${suffix}@example.invalid`,
      password, roles: ["member"] } });
  vice = await p.create({ collection: "users", overrideAccess: true, context: { system: true },
    data: { name: "社群测试审核", email: `review-${suffix}@example.invalid`,
      password, roles: ["vicePresident"] } });
});
afterAll(async () => {
  if (!p) return;
  if (forum) await p.delete({ collection: "forum-posts", id: forum, overrideAccess: true });
  if (application) await p.delete({ collection: "community-applications", id: application, overrideAccess: true });
  if (announcement) await p.delete({ collection: "announcements", id: announcement, overrideAccess: true });
  if (game) await p.delete({ collection: "games", id: game, overrideAccess: true });
  if (member) await p.delete({ collection: "users", id: member.id, overrideAccess: true, context: { system: true } });
  if (vice) await p.delete({ collection: "users", id: vice.id, overrideAccess: true, context: { system: true } });
  await p.destroy();
});
describe.sequential("申请、建群、发言与跨级审核", () => {
  it("普通成员不可变更角色或直接发布全站内容", async () => {
    await expect(p.update({ collection: "users", id: member.id, overrideAccess: false,
      user: member, data: { roles: ["president"] } })).rejects.toThrow();
    await expect(p.create({ collection: "announcements", overrideAccess: false, user: member,
      data: { title: "越权", slug: `unauthorized-${suffix}` } })).rejects.toThrow();
  });
  it("申请必须提供完整联系资料和有效图片，其他成员不能读取", async () => {
    const data = {
      applicant: member.id,
      proposedGame: "资料检查",
      reason: "此处为申请资料校验测试说明。",
      realName: "测试姓名",
      phone: "13900000000",
      wechatQr: qr,
    };
    for (const missing of [
      { realName: "" },
      { phone: "无效" },
      { wechatQr: "data:image/png;base64,aGVsbG8=" },
    ]) {
      await expect(
        p.create({
          collection: "community-applications",
          overrideAccess: false,
          user: member,
          data: { ...data, ...missing },
        }),
      ).rejects.toThrow();
    }
    const request = await p.create({
      collection: "community-applications",
      overrideAccess: false,
      user: member,
      data,
    });
    try {
      expect(request.wechatQr).toMatch(/^data:image\/png;base64,/);
      await expect(p.find({ collection: "community-applications", overrideAccess: false, user: null, where: { id: { equals: request.id } } })).rejects.toThrow();
      await expect(
        p.findByID({
          collection: "community-applications",
          id: request.id,
          overrideAccess: false,
          user: { ...member, id: 2147483647 },
        }),
      ).rejects.toThrow();
      await expect(
        p.update({
          collection: "community-applications",
          id: request.id,
          overrideAccess: false,
          user: vice,
          data: { phone: "13800000000" },
        }),
      ).rejects.toThrow();
      const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await db.connect();
      try {
        await db.query(
          "UPDATE community_applications SET real_name = NULL, phone = NULL, wechat_qr = NULL WHERE id = $1",
          [request.id],
        );
      } finally {
        await db.end();
      }
      await expect(
        p.update({
          collection: "community-applications",
          id: request.id,
          overrideAccess: false,
          user: vice,
          data: { status: "approved" },
        }),
      ).rejects.toThrow();
      await p.update({
        collection: "community-applications",
        id: request.id,
        overrideAccess: false,
        user: vice,
        data: { status: "rejected" },
      });
    } finally {
      await p.delete({
        collection: "community-applications",
        id: request.id,
        overrideAccess: true,
      });
    }
  });
  it("2 MB 以内的真实尺寸二维码图片不受默认文本字段 40000 字符限制", async () => {
    const picture = await sharp(randomBytes(256 * 256 * 3), { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
    const image = "data:image/png;base64," + picture.toString("base64");
    expect(image.length).toBeGreaterThan(40_000);
    const request = await p.create({ collection: "community-applications", overrideAccess: false, user: member,
      data: { applicant: member.id, proposedGame: "图片边界回归", reason: "这是一条验证实际尺寸图片可以正常提交的申请。", realName: "测试申请人", phone: "13900000000", wechatQr: image } });
    try { expect(request.wechatQr!.length).toBeGreaterThan(40_000); }
    finally { await p.delete({ collection: "community-applications", id: request.id, overrideAccess: true }); }
  });
  it("普通成员申请新社群，副社长审核后创建游戏和管理身份", async () => {
    const request = await p.create({ collection: "community-applications",
      overrideAccess: false, user: member, data: {
        applicant: member.id, proposedGame: `测试游戏-${suffix}`,
        reason: "希望运营这款游戏的日常讨论和活动。",
        realName: "测试申请人", phone: "13900000000", wechatQr: qr,
      } });
    application = request.id;
    expect(request.status).toBe("pending");
    await expect(p.update({ collection: "community-applications", id: application,
      overrideAccess: false, user: member, data: { status: "approved" } })).rejects.toThrow();
    await p.update({ collection: "community-applications", id: application,
      overrideAccess: false, user: vice, data: { status: "approved" } });
    const approved = await p.findByID({ collection: "community-applications",
      id: application, overrideAccess: true, depth: 0 });
    game = Number(approved.game);
    expect((await p.findByID({ collection: "games", id: game,
      overrideAccess: false, user: null }))._status).toBe("published");
    member = await p.findByID({ collection: "users", id: member.id, overrideAccess: true });
    expect(member.roles).toEqual(["communityAdmin"]);
    expect(member.communities?.map((v) => typeof v === "object" ? v.id : v)).toContain(game);
  });
  it("公开名片投影只包含当前管理员和已批准申请，原始申请保持私有", async () => {
    const context = { publicCommunityContacts: game };
    const users = await p.find({ collection: "users", overrideAccess: false, user: null, context, depth: 0, select: { name: true } });
    expect(users.docs.map(u => u.id)).toContain(member.id);
    expect(users.docs[0]).not.toHaveProperty("email");
    const cards = await p.find({ collection: "community-applications", overrideAccess: false, user: null, context, depth: 0, select: { applicant: true, wechatQr: true } });
    expect(cards.docs.map(a => a.id)).toContain(application);
    expect(cards.docs[0]).not.toHaveProperty("phone");
    expect(cards.docs[0]).not.toHaveProperty("realName");
    await expect(p.findByID({ collection: "community-applications", id: application, overrideAccess: false, user: null })).rejects.toThrow();
  });
  it("本社群可直接发通知和论坛帖，跨社群不能管理", async () => {
    forum = (await p.create({ collection: "forum-posts", overrideAccess: false, user: member,
      data: { game, author: member.id, title: "第一条讨论", body: "测试普通论坛的社群交流。" } })).id;
    const notice = await p.create({ collection: "community-posts", overrideAccess: false, user: member,
      data: { game, author: member.id, title: "社群通知", category: "notice", body: "测试游戏社群通知。" } });
    expect(notice.status).toBe("visible");
    await p.delete({ collection: "community-posts", id: notice.id, overrideAccess: true });
    const other = await p.create({ collection: "games", overrideAccess: true, context: { system: true },
      data: { title: "另一个游戏", slug: `other-game-${suffix}`, _status: "published" } });
    await expect(p.create({ collection: "community-posts", overrideAccess: false, user: member,
      data: { game: other.id, author: member.id, title: "越权通知",
        category: "notice", body: "不能在其他社群发布通知。" } })).rejects.toThrow();
    await p.delete({ collection: "games", id: other.id, overrideAccess: true });
  });
  it("活动点赞和意愿唯一、可取消，通知不接受参加意愿且评论继承社群", async () => {
    const notice = await p.create({ collection: "community-posts", overrideAccess: false, user: vice,
      data: { game, author: vice.id, title: "互动测试", category: "event", body: "测试活动点赞与留言" } });
    const data = { targetType: "community-posts" as const, targetId: notice.id, kind: "attend" as const, author: member.id, key: "ignored" };
    try {
      const reaction = await p.create({ collection: "community-reactions", overrideAccess: false, user: member, data });
      expect(reaction.kind).toBe("attend");
      await expect(p.create({ collection: "community-reactions", overrideAccess: false, user: member, data })).rejects.toThrow();
      const own = await p.find({ collection: "community-reactions", overrideAccess: false, user: member, context: { ownReactions: true }, where: { targetType: { equals: "community-posts" }, targetId: { equals: notice.id }, kind: { equals: "attend" } } });
      expect(own.totalDocs).toBe(1);
      await expect(p.delete({ collection: "community-reactions", id: reaction.id, overrideAccess: false, user: vice })).rejects.toThrow();
      await p.delete({ collection: "community-reactions", id: reaction.id, overrideAccess: false, user: member });
      const comment = await p.create({ collection: "comments", overrideAccess: false, user: member,
        data: { targetType: "community-posts", targetId: notice.id, author: member.id, body: "期待活动" } });
      expect(Number(comment.game)).toBe(game);
      await p.delete({ collection: "comments", id: comment.id, overrideAccess: true });
      await p.update({ collection: "community-posts", id: notice.id, overrideAccess: false, user: member, data: { category: "notice" } });
      await expect(p.create({ collection: "community-reactions", overrideAccess: false, user: member, data })).rejects.toThrow();
      await p.update({ collection: "community-posts", id: notice.id, overrideAccess: false, user: member, data: { status: "hidden" } });
      await expect(p.create({ collection: "community-reactions", overrideAccess: false, user: member, data: { ...data, kind: "like" } })).rejects.toThrow();
    } finally {
      await p.delete({ collection: "community-reactions", overrideAccess: true, where: { targetId: { equals: notice.id } } });
      await p.delete({ collection: "community-posts", id: notice.id, overrideAccess: true });
    }
  });
  it("置顶加精限定社群管理员，热度随有效互动增减", async () => {
    const ordinary = { ...member, roles: ["member"] as User["roles"], communities: [] };
    await expect(p.update({ collection: "forum-posts", id: forum, overrideAccess: false, user: ordinary, data: { pinned: true, featured: true } })).rejects.toThrow();
    await p.update({ collection: "forum-posts", id: forum, overrideAccess: false, user: member, data: { pinned: true, featured: true } });
    const reaction = await p.create({ collection: "community-reactions", overrideAccess: false, user: member,
      data: { targetType: "forum-posts", targetId: forum, kind: "like", author: member.id, key: "ignored" } });
    const read = () => p.findByID({ collection: "forum-posts", id: forum, overrideAccess: false, user: null });
    expect((await read()).heat).toBe(1);
    expect((await read()).featured).toBe(true);
    await p.delete({ collection: "community-reactions", id: reaction.id, overrideAccess: false, user: member });
    expect((await read()).heat).toBe(0);
    const reply = await p.create({ collection: "comments", overrideAccess: false, user: vice,
      data: { targetType: "forum-posts", targetId: forum, author: vice.id, body: "热度回复" } });
    expect((await read()).heat).toBe(1);
    await p.update({ collection: "comments", id: reply.id, overrideAccess: false, user: member, data: { status: "hidden" } });
    expect((await read()).heat).toBe(0);
    await p.delete({ collection: "comments", id: reply.id, overrideAccess: true });
  });
  it("普通成员图文投稿先审核，跨社群管理和匿名不能读取待审图片", async () => {
    const ordinary = { ...vice, roles: ["member"] as User["roles"], communities: [] };
    const post = await p.create({ collection: "community-showcase", overrideAccess: false, user: ordinary,
      data: { game, author: ordinary.id, title: "活动精彩记录", body: "活动后的精彩瞬间", status: "visible",
        images: [{ source: qr, caption: "测试照片" }], videoURL: "https://www.bilibili.com/video/BV1B7411m7LV/" } });
    try {
      expect(post.status).toBe("pending");
      expect(post.images?.[0].source).toMatch(/^data:image\/webp;base64,/);
      await expect(p.findByID({ collection: "community-showcase", id: post.id, overrideAccess: false, user: null })).rejects.toThrow();
      const outsider = { ...member, communities: [] };
      await expect(p.findByID({ collection: "community-showcase", id: post.id, overrideAccess: false, user: outsider })).rejects.toThrow();
      await expect(p.update({ collection: "community-showcase", id: post.id, overrideAccess: false, user: ordinary, data: { status: "visible" } })).rejects.toThrow();
      await expect(p.update({ collection: "community-showcase", id: post.id, overrideAccess: false, user: outsider, data: { status: "visible" } })).rejects.toThrow();
      await p.update({ collection: "community-showcase", id: post.id, overrideAccess: false, user: member, data: { status: "rejected", reviewNote: "请核对记录" } });
      expect((await p.findByID({ collection: "community-showcase", id: post.id, overrideAccess: false, user: ordinary })).reviewNote).toBe("请核对记录");
      await p.update({ collection: "community-showcase", id: post.id, overrideAccess: false, user: member, data: { status: "visible" } });
      expect((await p.findByID({ collection: "community-showcase", id: post.id, overrideAccess: false, user: null })).title).toBe("活动精彩记录");
    } finally { await p.delete({ collection: "community-showcase", id: post.id, overrideAccess: true }); }
    await expect(p.create({ collection: "community-showcase", overrideAccess: false, user: member,
      data: { game, author: member.id, title: "伪造图片", body: "无效图片必须拒绝", images: [{ source: "data:image/png;base64,aGVsbG8=" }] } })).rejects.toThrow();
  });
  it("连续发言无冷却，提交后通知其他连接，隐藏和删除同样通知", async () => {
    const listener = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await listener.connect();
    const installed = await listener.query("SELECT 1 FROM pg_trigger WHERE tgname = 'community_chat_changed'");
    if (!installed.rowCount) await installChatNotifications({ db: p.db.drizzle } as MigrateUpArgs);
    await listener.query("LISTEN community_chat_changed");
    const notifications: string[] = [];
    listener.on("notification", event => notifications.push(event.payload || ""));
    const ids: number[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const message = await p.create({ collection: "community-messages", overrideAccess: false, user: member,
          data: { game, author: member.id, body: `连续消息 ${i}` } });
        ids.push(message.id);
      }
      await expect.poll(() => notifications.filter(id => id === String(game)).length).toBe(3);
      await p.update({ collection: "community-messages", id: ids[0], overrideAccess: false, user: member, data: { status: "hidden" } });
      await expect.poll(() => notifications.length).toBe(4);
      const visible = await p.find({ collection: "community-messages", overrideAccess: false, user: null, where: { id: { in: ids } } });
      expect(visible.docs.map(m => m.id)).not.toContain(ids[0]);
      await p.delete({ collection: "community-messages", id: ids.pop()!, overrideAccess: true });
      await expect.poll(() => notifications.length).toBe(5);
      await expect(p.create({ collection: "community-messages", overrideAccess: false, user: null,
        data: { game, author: member.id, body: "匿名消息" } })).rejects.toThrow();
      const ban = await p.create({ collection: "community-bans", overrideAccess: true, user: vice,
        data: { game, member: member.id, active: true } });
      try {
        await expect(p.create({ collection: "community-messages", overrideAccess: false, user: member,
          data: { game, author: member.id, body: "禁言消息" } })).rejects.toThrow();
      } finally { await p.delete({ collection: "community-bans", id: ban.id, overrideAccess: true }); }
    } finally {
      for (const id of ids) await p.delete({ collection: "community-messages", id, overrideAccess: true });
      await listener.end();
    }
  });
  it("全站投稿须提交审核，副社长才能公开", async () => {
    const draft = await p.create({ collection: "announcements", overrideAccess: false,
      user: member, draft: true, data: { title: "待审通知", slug: `review-${suffix}` } });
    announcement = draft.id;
    await expect(p.update({ collection: "announcements", id: draft.id, overrideAccess: false,
      user: vice, data: { _status: "published" } })).rejects.toThrow();
    await p.update({ collection: "announcements", id: draft.id, overrideAccess: false,
      user: member, draft: true, data: { reviewState: "submitted" } });
    await p.update({ collection: "announcements", id: draft.id, overrideAccess: false,
      user: vice, data: { _status: "published" } });
    const publicItem = await p.findByID({ collection: "announcements", id: draft.id,
      overrideAccess: false, user: null });
    expect(publicItem._status).toBe("published");
  });
});
