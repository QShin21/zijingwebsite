import { createElement } from "react";
import { expect, it, vi } from "vitest";
import type { ApplicationItem, EventCard, SignupReceiptCard } from "../src/lib/v2/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// Cards read the interface language on the server; outside a request this is the default (Chinese).
vi.mock("@/lib/i18n/server", async () => {
  const { translator } = await import("../src/lib/i18n/locale");
  return { getLocale: async () => "zh", getT: async () => ({ locale: "zh", t: translator("zh") }) };
});
// Async server components resolve to an element first; the markup is then rendered as before.
async function render(component: unknown, props: Record<string, unknown>) {
  const { prerender } = await import("react-dom/static.edge");
  const { prelude } = await prerender(createElement(component as never, props as never));
  return (await new Response(prelude).text()).replace(/<!-- -->/g, "");
}
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: unknown }) => createElement("a", { href, ...rest }, children as never) }));

const event: EventCard = {
  key: "club:7", ref: { type: "event", source: "club", id: 7, slug: "s" } as EventCard["ref"], href: "/events/s", title: "合成活动", summary: null, cover: null,
  community: null, team: null, category: null, startAt: "2026-11-20T10:00:00Z", endAt: "2026-11-20T12:00:00Z", location: null, state: "upcoming", stateLabel: "即将开始",
  signup: { mode: "none", state: "closed", label: "", opensAt: null, deadline: null, viewerSubmitted: true } as EventCard["signup"], promoted: false, demo: false, archived: false, publishedAt: null,
};
const application: ApplicationItem = { key: "staff:3", kind: "staff", categoryLabel: "骨干招新", title: "合成申请", status: "accepted", statusLabel: "已录用", tone: "success",
  href: "/join/staff", webOnly: false, updatedAt: "2026-11-01T00:00:00Z", next: "说明", steps: [], archived: true };
const receipt: SignupReceiptCard = { key: "signup:1", eventTitle: "合成活动", event, submittedAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
  href: "/account", editable: false, archiveTarget: "club:7", archived: true };

it("公共日程卡不显示归档；我的赛程把详情箭头和归档按钮上下排列在链接外", async () => {
  const { MatchCard } = await import("../src/components/v2/cards");
  const { ArchiveButton } = await import("../src/components/v2/ArchiveButton");
  const plain = await render(MatchCard, { event });
  expect(plain).not.toContain("<button");
  const mine = await render(MatchCard, { event, archive: createElement(ArchiveButton, { target: event.key, archived: false, title: event.title }) });
  const side = mine.slice(mine.lastIndexOf("</a>"));
  // Arrow first, then the archive button, both after (never inside) the details link.
  expect(side.indexOf("aria-hidden=\"true\"")).toBeLessThan(side.indexOf("<button"));
  expect(side).toContain('type="button"');
  expect(side).toContain('aria-label="归档：合成活动"');
  expect(mine.match(/<a /g)).toHaveLength(1);
});

it("全部申请与全部报名显示已归档并提供撤销归档", async () => {
  const { ApplicationCard, ReceiptRow } = await import("../src/components/v2/cards");
  const { ArchiveButton } = await import("../src/components/v2/ArchiveButton");
  const card = await render(ApplicationCard, { item: application, archive: createElement(ArchiveButton, { target: application.key, archived: true, title: application.title, variant: "text" }) });
  expect(card).toContain("已归档");
  expect(card).toContain("撤销归档");
  expect(card.indexOf("<button")).toBeGreaterThan(card.indexOf("</a>"));
  const row = await render(ReceiptRow, { receipt, archive: createElement(ArchiveButton, { target: "club:7", archived: true, title: receipt.eventTitle, variant: "text" }) });
  expect(row).toContain("已归档");
  expect(row).toContain("撤销归档");
});
