import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { User } from "../src/payload-types";
import type { EventCard, SignupReceiptCard } from "../src/lib/v2/types";
import { getManage, getMySignups, getShowcaseReviewTargets } from "../src/lib/v2/account";
import { ownStaffBatchIDs, ownStaffReceiptHeaders } from "../src/lib/staff-recruitment";
import { MatchCard, ReceiptRow } from "../src/components/v2/cards";
import { ScheduleTimeFields } from "../src/components/v2/ScheduleTimeFields";
import { eventCard } from "../src/lib/v2/events";

vi.mock("../src/lib/v2/events", () => ({ eventFields: [], eventCard: vi.fn() }));
const actor = { id: 4, name: "合成成员", roles: ["member"], accountStatus: "active", communityOffices: [] } as unknown as User;
const event: EventCard = {
  key: "club:1", ref: { type: "event", source: "club", id: 1, slug: "synthetic" }, href: "/events/synthetic",
  title: "演示 · 校园组队赛", summary: null, cover: null,
  community: { id: 8, title: "演示 · 英雄联盟", slug: "lol", hue: 20 }, team: null, category: "比赛",
  startAt: "2099-11-14T06:00:00Z", endAt: null, location: "演示场地（非真实安排）", state: "upcoming", stateLabel: "即将开始",
  signup: { mode: "form", state: "open", label: "报名开放", opensAt: null, deadline: null, viewerSubmitted: true },
  promoted: false, demo: true, archived: false, publishedAt: null,
};
const game = { id: 8, title: "合成社群", slug: "synthetic", _status: "published" };
function payload(user: User = actor, games = [game]) {
  return { findByID: vi.fn(async () => user), count: vi.fn(async () => ({ totalDocs: 1 })),
    find: vi.fn(async (args: Record<string, unknown>) => ({ docs: args.collection === "games" ? games : [] })) } as unknown as Payload;
}

describe("pixel audit: cards and filter presentation", () => {
  it("deduplicates demo prefixes only inside explicitly marked demo cards, retaining status and destination", () => {
    const html = renderToStaticMarkup(createElement(MatchCard, { event }));
    expect(html.match(/演示资料/g)).toHaveLength(1);
    expect(html).not.toContain("演示 ·");
    for (const text of ["校园组队赛", "英雄联盟", "非真实安排", "即将开始", "已报名", 'href="/events/synthetic"']) expect(html).toContain(text);
    expect(event.title).toBe("演示 · 校园组队赛");
    const real = renderToStaticMarkup(createElement(MatchCard, { event: { ...event, demo: false } }));
    expect(real).toContain("演示 · 校园组队赛");
    const name = renderToStaticMarkup(createElement(MatchCard, { event: { ...event, title: "演示技术交流" } }));
    expect(name).toContain("演示技术交流");
  });
  it("renders withdrawn activities as static history, keeping live receipt links", () => {
    const receipt: SignupReceiptCard = { key: "signup:1", eventTitle: "合成活动", event: null, submittedAt: "2026-11-01T08:00:00Z", updatedAt: "2026-11-01T08:00:00Z", href: "/activities/events/1/fill", editable: false };
    const html = renderToStaticMarkup(createElement(ReceiptRow, { receipt }));
    expect(html).not.toContain("<a ");
    expect(html).toContain("历史记录保留");
    expect(html).toContain("11月1日");
    expect(renderToStaticMarkup(createElement(ReceiptRow, { receipt: { ...receipt, event, editable: true } }))).toContain('href="/activities/events/1/fill"');
  });
  it("keeps month submitted with the original GET name while non-month modes are read-only", () => {
    for (const range of ["upcoming", "past", "month"]) {
      const html = renderToStaticMarkup(createElement(ScheduleTimeFields, { range, month: "2026-11" }));
      expect(html).toContain('name="range"');
      expect(html).toContain('name="month"');
      expect(html).toContain('value="2026-11"');
      expect(html.includes('readOnly=""')).toBe(range !== "month");
      expect(html).not.toContain('disabled=""');
    }
  });
});

describe("pixel audit: owner projections and review routes", () => {
  it("does not project a known failing signup destination when an activity is unavailable", async () => {
    const p = payload();
    vi.mocked(eventCard).mockResolvedValue(event);
    vi.mocked(p.find).mockImplementation(async args => {
      if (args.collection === "event-signups") return { docs: [1, 2].map(id => ({ id, member: actor.id, activityType: "events", activityID: id, eventTitle: "合成活动", createdAt: "2026-11-01T08:00:00Z", updatedAt: "2026-11-01T08:00:00Z" })), totalDocs: 2, totalPages: 1, hasNextPage: false } as never;
      if (args.collection === "events") return { docs: [{ id: 1, _status: "published" }] } as never;
      return { docs: [] } as never;
    });
    const result = await getMySignups(p, actor);
    expect(result.docs[0]).toMatchObject({ href: "/activities/events/1/fill", editable: true });
    expect(result.docs[1]).toMatchObject({ href: "/account?view=signups", event: null, editable: false });
  });
  it("finds the owner's batch marker beyond the first 20 receipts, independent of page", async () => {
    const records = Array.from({ length: 21 }, (_, index) => ({ id: index + 1, applicant: actor.id, batch: index + 1 }));
    const p = payload();
    vi.mocked(p.find).mockImplementation(async args => {
      const page = args.page ?? 1;
      return { docs: args.pagination === false ? records.filter(row => row.batch === 21) : records.slice((page - 1) * 20, page * 20), totalDocs: 21 } as never;
    });
    const first = await ownStaffReceiptHeaders(p, actor, undefined, 1);
    expect(first?.docs.some(row => row.batch === 21)).toBe(false);
    expect(await ownStaffBatchIDs(p, actor, [21])).toEqual(new Set(["21"]));
    await ownStaffReceiptHeaders(p, actor, undefined, 2);
    expect(await ownStaffBatchIDs(p, actor, [21])).toEqual(new Set(["21"]));
    expect(p.find).toHaveBeenCalledWith(expect.objectContaining({ collection: "staff-applications", user: actor, overrideAccess: false,
      where: { and: [{ applicant: { equals: actor.id } }, { batch: { in: [21] } }] }, select: { batch: true }, pagination: false }));
    vi.mocked(p.find).mockClear();
    expect(await ownStaffBatchIDs(p, null, [21])).toEqual(new Set());
    expect(p.find).not.toHaveBeenCalled();
  });
  it("links a single authorized community straight to its review view", async () => {
    const reviewer = { ...actor, communityOffices: [{ game: 8, status: "active", reviewShowcase: true }] } as User;
    const p = payload(reviewer);
    const queue = (await getManage(p, reviewer)).queues.find(row => row.key === "showcase");
    expect(queue).toMatchObject({ href: "/community/synthetic/showcase?view=review", webOnly: false, scope: "合成社群" });
    expect(p.count).toHaveBeenCalledWith(expect.objectContaining({ collection: "community-showcase", overrideAccess: false, user: expect.objectContaining({ id: reviewer.id }),
      where: { and: [{ status: { equals: "pending" } }, { game: { in: [8] } }] } }));
  });
  it("offers a scoped selector for multiple communities, excluding unauthorized and draft parents", async () => {
    const reviewer = { ...actor, communityOffices: [8, 9].map(game => ({ game, status: "active", reviewShowcase: true })) } as User;
    const p = payload(reviewer, [game, { ...game, id: 9, slug: "second" }, { ...game, id: 10, slug: "unauthorized" }, { ...game, id: 11, _status: "draft" }]);
    expect((await getManage(p, reviewer)).queues.find(row => row.key === "showcase")).toMatchObject({ href: "/community/review/showcase", webOnly: true });
    expect((await getShowcaseReviewTargets(p, reviewer)).map(row => row.id)).toEqual([8, 9]);
    expect(await getShowcaseReviewTargets(payload(), actor)).toEqual([]);
    await expect(getShowcaseReviewTargets(payload({ ...reviewer, communityOffices: [] }), reviewer)).resolves.toEqual([]);
    await expect(getShowcaseReviewTargets(payload({ ...reviewer, accountStatus: "suspended" }), reviewer)).rejects.toMatchObject({ status: 401 });
  });
});
