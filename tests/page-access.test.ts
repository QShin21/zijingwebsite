import { describe, expect, it } from "vitest";
import { isCampusAPI, isCampusPage, isGuestPage, isLegacyPublicRead, isRemovedCommunityChatPath, isRemovedCommunityInteractionPath } from "../src/lib/page-access";

describe("已移除的社群聊天访问", () => {
  it("旧页面、推送、图片、表情及消息集合入口全部关闭", () => {
    for (const path of [
      "/community/lol/chat", "/community/lol/chat/", "/community/lol/chat/feed",
      "/community/lol/chat/stream", "/community/chat-images/1", "/community/stickers",
      "/api/community-messages", "/api/community-messages/1", "/api/community-messages/access",
      "/admin/collections/community-messages", "/admin/collections/community-messages/1",
    ]) expect(isRemovedCommunityChatPath(path), path).toBe(true);
  });
  it("活动详情按可见范围读取，社群栏目保留清华账号入口", () => {
    for (const path of [
      "/community/lol", "/community/lol/updates",
      "/community/lol/showcase", "/community/lol/contacts",
      "/api/community-posts", "/api/community-showcase", "/api/community-messages-other",
    ]) {
      expect(isRemovedCommunityChatPath(path), path).toBe(false);
      expect(isGuestPage(path), path).toBe(false);
    }
    expect(isGuestPage("/events")).toBe(true);
    expect(isGuestPage("/announcements")).toBe(true);
    expect(isGuestPage("/community/lol/updates/7")).toBe(true);
    expect(isCampusPage("/community/lol/updates/7")).toBe(false);
    expect(isCampusPage("/teams/recruitment")).toBe(true);
    expect(isCampusPage("/join/staff")).toBe(true);
    expect(isCampusAPI("/api/events/7")).toBe(true);
    expect(isCampusAPI("/api/v2/events/club/test")).toBe(false);
    expect(isLegacyPublicRead("/api/pages", "GET", "privacy")).toBe(true);
    expect(isLegacyPublicRead("/api/pages", "GET", "join-teams")).toBe(false);
    expect(isLegacyPublicRead("/api/pages", "POST", "privacy")).toBe(false);
    expect(isLegacyPublicRead("/api/events", "GET", null)).toBe(true);
    expect(isLegacyPublicRead("/api/events/7", "GET", null)).toBe(false);
  });
});

describe("已移除的论坛与互动访问", () => {
  it("旧页面、REST、后台及小程序互动入口全部关闭", () => {
    for (const path of ["/community/lol/forum", "/community/lol/forum/1", "/api/forum-posts", "/api/comments/1", "/api/community-reactions", "/admin/collections/forum-posts", "/admin/collections/comments", "/admin/collections/community-reactions", "/api/miniapp/reactions", "/api/miniapp/reactions/toggle"])
      expect(isRemovedCommunityInteractionPath(path), path).toBe(true);
    for (const path of ["/community/lol/updates", "/community/lol/showcase", "/api/community-posts", "/api/community-showcase", "/api/comments-other"])
      expect(isRemovedCommunityInteractionPath(path), path).toBe(false);
  });
});
