import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { User } from "../src/payload-types";
vi.mock("../src/lib/v2/identity", () => ({
  refreshViewer: async (_p: unknown, viewer: unknown) => viewer,
  requireViewer: async (_p: unknown, viewer: unknown) => viewer,
}));
vi.mock("../src/lib/content-promotions", () => ({ promotedContent: async () => [] }));
vi.mock("../src/lib/v2/events", () => ({ eventFields: [], eventCard: vi.fn() }));
vi.mock("../src/lib/v2/teams", () => ({ getHonors: async () => ({ docs: [] }) }));
vi.mock("../src/lib/v2/images", () => ({ controlledImageRef: () => null }));
import { getFeed, getArticle } from "../src/lib/v2/feed";
import { showcaseCard } from "../src/lib/v2/community";
const actor = { id: 4, name: "Member", roles: ["member"], communityOffices: [] } as unknown as User;
const hiddenPost = { id: 12, game: 9, status: "visible", category: "notice", title: "Hidden parent", body: "not public", createdAt: "2026-11-01" };
const visiblePost = { ...hiddenPost, id: 13, game: 10, title: "Open parent", body: "allowed" };
function payload() {
  const find = vi.fn(async (args: Record<string, unknown>) => {
    if (args.collection === "users") return { docs: [] };
    if (args.collection === "games") return { docs: JSON.stringify(args.where).includes('"equals":10') ? [{ id: 10, title: "Public", slug: "public", _status: "published" }] : [] };
    if (args.collection === "community-posts") return { docs: [hiddenPost, visiblePost] };
    if (args.collection === "community-showcase") return { docs: [{ ...hiddenPost, id: 15, author: 5 }] };
    return { docs: [] };
  });
  return { find, findByID: vi.fn(async () => null) } as unknown as Payload;
}
describe("V2 member read projection boundaries (synthetic Local API)", () => {
  it("filters inaccessible parent notices/showcases before feed pagination instead of leaking or failing the whole feed", async () => {
    const p = payload();
    const result = await getFeed(p, actor);
    expect(result.totalDocs).toBe(1);
    expect(result.docs[0]).toMatchObject({ kind: "article", item: { title: "Open parent", community: { id: 10 } } });
    expect(JSON.stringify(result)).not.toContain("not public");
  });
  it("a community notice with an inaccessible parent is 404", async () => {
    await expect(getArticle(payload(), actor, { kind: "communityNotice", id: 12 })).rejects.toMatchObject({ status: 404 });
  });
  it("does not expose showcase review notes to unrelated members; reads promotion through viewer ACL", async () => {
    const p = payload();
    const card = await showcaseCard(p, actor, { id: 23, game: 10, author: 5, reviewNote: "private", status: "visible" }, { id: 10, title: "Public", slug: "public", hue: 10 });
    expect(card.reviewNote).toBeNull();
    expect(card.promotion).toBeNull();
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "content-promotions", overrideAccess: false, user: actor, select: { status: true }, where: { sourceKey: { equals: "community-showcase:23" } } }));
  });
  it("projects only the permitted promotion state, never internal review data", async () => {
    const p = { find: vi.fn(async () => ({ docs: [{ id: 1, status: "needsReview", reviewNote: "secret", requestedBy: 4 }] })) } as unknown as Payload;
    const card = await showcaseCard(p, actor, { id: 23, game: 10, author: 4, reviewNote: "own feedback" }, { id: 10, title: "Public", slug: "public", hue: 10 });
    expect(card.promotion).toEqual({ status: "needsReview", label: "改稿待复审" });
    expect(card.reviewNote).toBe("own feedback");
    expect(JSON.stringify(card)).not.toContain("secret");
  });
});

describe("V2 related article community resolution", () => {
  it("filters news/albums via public event/team parents, not a nonexistent game column; caches repeated relations", async () => {
    const find = vi.fn(async (args: Record<string, unknown>) => {
      const collection = args.collection;
      if (collection === "games") return { docs: [{ id: 10, title: "Public", slug: "public" }] };
      if (collection === "news") return { docs: [{ id: 21, event: 31, title: "News" }, { id: 22, event: 31, title: "News again" }] };
      if (collection === "albums") return { docs: [{ id: 41, team: 51, title: "Album" }] };
      if (collection === "events" || collection === "teams") return { docs: [{ id: collection === "events" ? 31 : 51, game: 10 }] };
      return { docs: [] };
    });
    const p = { find } as unknown as Payload;
    const result = await getFeed(p, actor, { community: "public" });
    expect(result.docs).toHaveLength(3);
    expect(result.docs.every(row => row.kind === "article" && row.item.community?.id === 10)).toBe(true);
    for (const [args] of find.mock.calls) if (["news", "albums"].includes(String(args.collection))) {
      expect(JSON.stringify(args.where)).not.toContain('"game"');
      expect(args.overrideAccess).toBe(false);
      expect(args.user).toBeNull();
    }
    expect(find.mock.calls.filter(([args]) => args.collection === "events")).toHaveLength(1);
  });
  it("does not resolve a news community from inaccessible event/team parents", async () => {
    const find = vi.fn(async (args: Record<string, unknown>) => ({ docs: args.collection === "games" ? [{ id: 10, slug: "public" }] : args.collection === "news" ? [{ id: 21, event: 31, team: 51 }] : [] }));
    const result = await getFeed({ find } as unknown as Payload, actor, { community: "public", kind: "news" });
    expect(result.docs).toEqual([]);
  });
  it("internal home highlights read only albums/honors and constrain showcase to approved promotion IDs", async () => {
    const find = vi.fn(async () => ({ docs: [] }));
    await getFeed({ find } as unknown as Payload, actor, { highlightsOnly: true, promotedOnly: true });
    const queries = find.mock.calls as unknown as [Record<string, unknown>][];
    expect(queries.some(([args]) => ["news", "announcements", "community-posts"].includes(String(args.collection)))).toBe(false);
    expect(queries.find(([args]) => args.collection === "community-showcase")?.[0].where).toMatchObject({ and: expect.arrayContaining([{ id: { in: [] } }]) });
  });
});
