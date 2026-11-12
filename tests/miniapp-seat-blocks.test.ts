import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

type NativePage = { data: Record<string, unknown>; setData(data: Record<string, unknown>): void; [key: string]: unknown };
type State = {
  title: string; enabled: boolean; open: boolean; scheduled: boolean; loggedIn: boolean; canReview: boolean;
  rows: { row: number; count: number; offset: number }[]; occupancy: Record<string, string>;
  blockedSeats: string[]; seatLimit: number; proofLimit: number; proofBytes: number; drafts: string[]; mine: null;
};
const invoke = (page: NativePage, method: string, ...args: unknown[]) =>
  (page[method] as (...values: unknown[]) => unknown).apply(page, args);
const tap = (seat: string) => ({ currentTarget: { dataset: { seat } } });

function harness(manage: boolean, canReview = true) {
  const state: State = { title: "合成活动", enabled: false, open: false, scheduled: false, loggedIn: true, canReview,
    rows: [{ row: 1, count: 15, offset: 0 }], occupancy: { "1-14": "pending", "1-15": "confirmed" },
    blockedSeats: ["1-15"], seatLimit: 10, proofLimit: 10, proofBytes: 8388608, drafts: [], mine: null };
  const http = { request: vi.fn(async (_path: string, options: { method?: string; data?: { seats: string[]; blocked: boolean } }) => {
    if (options.method === "POST" && options.data) {
      for (const seat of options.data.seats) {
        if (options.data.blocked) { state.blockedSeats.push(seat); state.occupancy[seat] = "confirmed"; }
        else { state.blockedSeats = state.blockedSeats.filter(value => value !== seat); delete state.occupancy[seat]; }
      }
    }
    return structuredClone(state);
  }) };
  const session = { user: () => ({ id: 1 }), subscribe: () => () => {} };
  const modules: Record<string, unknown> = {
    "../../lib/theme": { page: (definition: NativePage) => definition }, "../../lib/http": http,
    "../../lib/files": {}, "../../lib/navigation": {}, "../../lib/privacy": {}, "../../lib/session": session,
    "../../lib/format": { date: () => "", beijingParts: () => ({}) }, "../../lib/page": { actions: {} },
  };
  let page!: NativePage;
  runInNewContext(readFileSync("miniprogram/src/pages/activity-seating/index.js", "utf8"), {
    Page: (value: NativePage) => { page = value; }, require: (name: string) => modules[name],
    wx: { setNavigationBarTitle: vi.fn() }, clearTimeout, setTimeout,
  });
  page.setData = values => {
    for (const [key, value] of Object.entries(values)) {
      const path = /^rows\[(\d+)\]\.seats\[(\d+)\]$/.exec(key);
      if (path) {
        const rows = page.data.rows as { seats: unknown[] }[];
        rows[Number(path[1])].seats[Number(path[2])] = value;
      } else page.data[key] = value;
    }
  };
  invoke(page, "onLoad", { kind: "events", id: "1", ...(manage ? { mode: "manage" } : {}) });
  return { page, http, state };
}

it("小程序管理员在开放前批量锁定和解锁座位，已申请座位不可选择", async () => {
  const { page, http } = harness(true);
  await invoke(page, "onShow");
  for (let i = 1; i <= 12; i++) invoke(page, "toggle", tap(`1-${i}`));
  invoke(page, "toggle", tap("1-14"));
  invoke(page, "toggle", tap("1-15"));
  expect(page.data).toMatchObject({ selectedAvailable: 12, selectedBlocked: 1 });
  await invoke(page, "setSeatBlocks", { currentTarget: { dataset: { blocked: true } } });
  const first = http.request.mock.calls.find(([, options]) => options.method === "POST")?.[1].data;
  expect(first?.seats).toHaveLength(12);
  expect(first?.seats).not.toContain("1-14");
  invoke(page, "toggle", tap("1-15"));
  await invoke(page, "setSeatBlocks", { currentTarget: { dataset: { blocked: false } } });
  const writes = http.request.mock.calls.filter(([, options]) => options.method === "POST");
  expect(writes[1][1].data).toMatchObject({ seats: ["1-15"], blocked: false });
  expect(page.data).toMatchObject({ selectedAvailable: 0, selectedBlocked: 0 });
});

it("小程序成员看到未开放座位且无法选择，无权用户不能进入座位管理", async () => {
  const member = harness(false);
  member.state.enabled = true; member.state.open = true; member.state.canReview = false;
  await invoke(member.page, "onShow");
  const rows = member.page.data.rows as { seats: { style: string; locked: boolean }[] }[];
  expect(rows[0].seats[14]).toMatchObject({ style: "blocked", locked: true });
  invoke(member.page, "toggle", tap("1-15"));
  expect(member.page.data.selected).toEqual([]);
  const unauthorized = harness(true, false);
  await invoke(unauthorized.page, "onShow");
  expect(unauthorized.page.data).toMatchObject({ editable: false, rows: [], loadError: "无权管理此活动的座位" });
});
