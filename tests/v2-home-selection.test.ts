import { expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { User } from "../src/payload-types";
const mocks = vi.hoisted(() => ({ feed: vi.fn(async () => ({ docs: [] })) }));
vi.mock("../src/lib/v2/identity", () => ({ getSession: async () => ({ viewer: { id: 1 } }), refreshViewer: async (_p:unknown, viewer: unknown) => viewer }));
vi.mock("../src/lib/v2/feed", () => ({ getFeed: mocks.feed }));
vi.mock("../src/lib/v2/events", () => ({ getCalendar: async () => ({ docs: [] }) }));
vi.mock("../src/lib/v2/community", () => ({ getCommunities: async () => ({ docs: [] }) }));
vi.mock("../src/lib/v2/recruitment", () => ({ getRecruitmentCenter: async () => ({ staff: [], teams: { docs: [] } }) }));
vi.mock("../src/lib/v2/account", () => ({ getMe: async () => ({ todo: [], upcoming: [] }), getManage: async () => ({ queues: [] }) }));
vi.mock("../src/lib/v2/pages", () => ({ getFixedPage: async () => ({ updatedAt: null }) }));
vi.mock("../src/lib/content-promotions", () => ({ approvedPromotionSources: async () => [] }));
import { getHome } from "../src/lib/v2/home";
it("member home uses public notices and promoted-only highlights before pagination", async () => {
  const actor = { id: 1 } as User, p = { findGlobal: async () => ({ name: "Club" }) } as unknown as Payload;
  await getHome(p, actor);
  expect(mocks.feed).toHaveBeenCalledWith(p, null, { kind: "announcements", limit: 4 });
  expect(mocks.feed).toHaveBeenCalledWith(p, actor, { highlightsOnly: true, promotedOnly: true, limit: 5 });
});
