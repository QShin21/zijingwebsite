import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { User } from "../src/payload-types";
const mocks = vi.hoisted(() => ({ sources: vi.fn() }));
vi.mock("../src/lib/content-promotions", () => ({ approvedPromotionSources: mocks.sources, promotedContent: async () => [] }));
import { getHomePromoted } from "../src/lib/v2/home";
const viewer = { id: 1, roles: ["member"], accountStatus: "active" } as User;
const source = (id: number, game = 8, category = "event") => ({ id, sourceKey: `community-posts:${id}`, source: { game: { id: game }, doc: { id, game, title: "已审核合成" + id, body: "公开摘要", category, status: "visible", createdAt: "2020-01-01T00:00:00Z" } } });
function payload(active: User | null = viewer) {
  return { findByID: vi.fn(async () => active), find: vi.fn(async (args: Record<string, unknown>) => ({ docs: args.collection === "games" && !JSON.stringify(args.where).includes('"equals":9') ? [{ id: 8, slug: "public", title: "合成社群", _status: "published" }] : [] })) } as unknown as Payload;
}
beforeEach(() => { mocks.sources.mockReset(); mocks.sources.mockImplementation(async (_p: unknown, kind: string) => kind === "event" ? [source(1)] : kind === "notice" ? [source(2, 8, "notice")] : []); });
describe("V2 dedicated promotion slots", () => {
  it("keeps approved undated old events and notices independent of calendar/feed size", async () => {
    const result = await getHomePromoted(payload(), viewer);
    expect(result.events[0]).toMatchObject({ key: "community:1", promoted: true, startAt: null });
    expect(result.notices[0]).toMatchObject({ key: "communityNotice:2", promoted: true });
    expect(result.showcases).toEqual([]);
  });
  it("never projects nonpublic parent sources or member-only showcases to guests", async () => {
    mocks.sources.mockImplementation(async (_p: unknown, kind: string) => kind === "event" ? [source(1, 9), source(2)] : []);
    const result = await getHomePromoted(payload(), null);
    expect(result.events.map(item => item.key)).toEqual(["community:2"]);
    expect(result.showcases).toBeNull();
    expect(mocks.sources.mock.calls.filter(([, kind]) => kind === "showcase")).toHaveLength(0);
  });
  it("reloads current account authority and returns no member-only slots for a suspended identity", async () => {
    const result = await getHomePromoted(payload({ ...viewer, accountStatus: "suspended" }), { ...viewer, roles: ["president"] });
    expect(result.showcases).toBeNull();
  });
});
