import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { User } from "../src/payload-types";
import { getCommunityHeader, getCommunity } from "../src/lib/v2/community";
import { getManage, getMyApplications } from "../src/lib/v2/account";
import { homeSections, defaultHomeSections, validateHomeSections } from "../src/lib/v2/home-sections";
import { validateTeamSlug, reservedTeamSlugs } from "../src/lib/team-slugs";

vi.mock("../src/lib/v2/teams", () => ({ getTeams: async () => ({ docs: [] }) }));

const actor = { id: 4, name: "合成成员", roles: ["member"], accountStatus: "active", communityOffices: [] } as unknown as User;
const leader = { ...actor, roles: ["president"] } as User;
const game = { id: 8, title: "合成社群", slug: "synthetic", summary: "简介", _status: "published" };
function payload(user: User | null = actor) {
  return { findByID: vi.fn(async () => user), count: vi.fn(async () => ({ totalDocs: 0 })),
    find: vi.fn(async (args: Record<string, unknown>) => ({ docs: args.collection === "games" ? [game] : [], totalDocs: 0 })) } as unknown as Payload;
}
describe("V2 backend follow-up contracts (synthetic Local API)", () => {
  it("header reads one game and counts, no body, officers or child-content lists; viewer matches detail", async () => {
    const p = payload();
    const header = await getCommunityHeader(p, actor, { slug: "synthetic" });
    expect(header.card).toMatchObject({ community: { id: 8, hue: 16 }, summary: "简介", counts: { teams: 0, showcase: 0 } });
    const calls = vi.mocked(p.find).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toMatchObject({ collection: "games", overrideAccess: false, user: null, draft: false });
    expect(calls[0][0].select).not.toHaveProperty("body");
    const detail = await getCommunity(p, actor, { slug: "synthetic" });
    expect(header.viewer).toEqual(detail.viewer);
  });
  it("header preserves authenticated membership and scoped capabilities", async () => {
    await expect(getCommunityHeader(payload(), null, { slug: "synthetic" })).rejects.toMatchObject({ status: 401 });
    const scoped = { ...actor, communityOffices: [{ game: 8, status: "active", publishContent: true, reviewShowcase: false, viewSignups: false, handleJoins: true }] } as User;
    const header = await getCommunityHeader(payload(scoped), scoped, { slug: "synthetic" });
    expect(header.viewer).toMatchObject({ canPublish: true, canManageTeams: true, canReviewShowcase: false, canViewSignups: false, canApplyOfficer: false });
    const p = payload(); vi.mocked(p.find).mockResolvedValue({ docs: [] } as never);
    await expect(getCommunityHeader(p, actor, { slug: "hidden" })).rejects.toMatchObject({ status: 404 });
  });
  it("queue webOnly is server-declared by capability, not inferred from href", async () => {
    const queues = (await getManage(payload(leader), leader)).queues;
    expect(queues.filter(queue => queue.webOnly).map(queue => queue.key)).toEqual(["promotions", "activities", "cms"]);
    expect(queues.filter(queue => !queue.webOnly).length).toBeGreaterThan(0);
    const p = payload();
    vi.mocked(p.count).mockResolvedValue({ totalDocs: 1 } as never);
    vi.mocked(p.find).mockImplementation(async args => ({ docs: args.collection === "team-join-applications" ? [{ id: 1, applicant: actor.id, title: "合成申请", status: "returned", recruitment: 2 }] : [], totalDocs: 1 }) as never);
    const result = await getMyApplications(p, actor);
    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]).toMatchObject({ kind: "teamJoin", webOnly: false, href: "/teams/recruitment/2" });
  });
  it.each(reservedTeamSlugs)("rejects creating or renaming a team to reserved %s with a Chinese reason", slug => {
    expect(validateTeamSlug(slug)).toContain("保留路径");
    expect(validateTeamSlug(slug, { operation: "update", previousValue: "old-slug" })).toContain("保留路径");
    expect(validateTeamSlug(slug, { operation: "update", previousValue: slug })).toBe(true);
    expect(validateTeamSlug(slug, { operation: "create", previousValue: slug })).toContain("保留路径");
  });
  it("normal team slugs retain the original format restriction", () => {
    expect(validateTeamSlug("sample-team-21")).toBe(true);
    expect(validateTeamSlug("Team_Name")).toContain("小写");
  });
  it("V2 CMS section overrides preserve order, hidden state and safe defaults without mutating legacy settings", () => {
    const before = JSON.stringify(defaultHomeSections);
    const config = [{ kind: "highlights", title: " 自定义高光 ", enabled: false }, { kind: "communities", enabled: true }];
    expect(validateHomeSections(config)).toBe(true);
    const output = homeSections(config);
    expect(output.slice(0, 2)).toEqual([{ kind: "highlights", title: "自定义高光", enabled: false }, { kind: "communities", title: "游戏社群", enabled: true }]);
    expect(output).toHaveLength(7);
    expect(new Set(output.map(section => section.kind)).size).toBe(7);
    expect(JSON.stringify(defaultHomeSections)).toBe(before);
    expect(homeSections(null)).toEqual(defaultHomeSections);
    expect(homeSections([{ kind: "upcoming", title: "接下来的赛程" }])[0].title).toBe("近期日程");
    expect(homeSections([{ kind: "upcoming", title: "自定义安排" }])[0].title).toBe("自定义安排");
    expect(validateHomeSections([{ kind: "open" }, { kind: "open" }])).toContain("只能配置一次");
    expect(validateHomeSections([{ kind: "private-data" }])).toContain("有效");
    expect(validateHomeSections([{ kind: "about", title: "x".repeat(61) }])).toContain("60");
    expect(homeSections([{ kind: "private-data" }])).toEqual(defaultHomeSections);
  });
});
