import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPayload, type Payload } from "payload";
import config from "../src/payload.config";
import type { User } from "../src/payload-types";
import { randomBytes } from "node:crypto";
let p: Payload;
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
  it("普通成员申请新社群，副社长审核后创建游戏和管理身份", async () => {
    const request = await p.create({ collection: "community-applications",
      overrideAccess: false, user: member, data: {
        applicant: member.id, proposedGame: `测试游戏-${suffix}`,
        reason: "希望运营这款游戏的日常讨论和活动。",
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
