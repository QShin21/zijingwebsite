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
    rows: [{ row: 1, count: 15, offset: 0 }], occupancy: { "1-13": "confirmed", "1-14": "pending", "1-15": "confirmed" },
    blockedSeats: ["1-15"], seatLimit: 10, proofLimit: 10, proofBytes: 8388608, drafts: [], mine: null };
  const http = { request: vi.fn(async (path: string, options: { method?: string; data?: { action?: string; seats?: string[]; blocked?: boolean; id?: number; revision?: number; status?: string; seat?: string } }) => {
    if (path.includes("mode=seat-review")) {
      const confirmed = path.includes("1-13"), seat = confirmed ? "1-13" : "1-14";
      return { seat, request: { id: confirmed ? 43 : 42, revision: 0, status: confirmed ? "confirmed" : "pending", memberName: "合成申请人", phone: "13800138000", seats: [seat], proofs: [], createdAt: "2026-11-12T00:00:00Z" } };
    }
    if (options.method === "POST" && options.data?.action === "block") {
      for (const seat of options.data.seats || []) {
        if (options.data.blocked) { state.blockedSeats.push(seat); state.occupancy[seat] = "confirmed"; }
        else { state.blockedSeats = state.blockedSeats.filter(value => value !== seat); delete state.occupancy[seat]; }
      }
    }
    return structuredClone(state);
  }) };
  const session = { user: () => ({ id: 1 }), subscribe: () => () => {} };
  const navigation = { go: vi.fn() };
  const modules: Record<string, unknown> = {
    "../../lib/theme": { page: (definition: NativePage) => definition }, "../../lib/http": http,
    "../../lib/files": {}, "../../lib/navigation": navigation, "../../lib/privacy": {}, "../../lib/session": session,
    "../../lib/format": { date: () => "", beijingParts: () => ({}) }, "../../lib/page": { actions: {} },
  };
  let page!: NativePage;
  runInNewContext(readFileSync("miniprogram/src/pages/activity-seating/index.js", "utf8"), {
    Page: (value: NativePage) => { page = value; }, require: (name: string) => modules[name],
    wx: { setNavigationBarTitle: vi.fn(), showModal: (options: { success: (answer: { confirm: boolean }) => void }) => options.success({ confirm: true }) }, clearTimeout, setTimeout,
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
  return { page, http, state, navigation };
}

it("小程序管理员在开放前锁定和解锁座位，并点击已申请座位查看记录", async () => {
  const { page, http } = harness(true);
  await invoke(page, "onShow");
  for (let i = 1; i <= 12; i++) invoke(page, "toggle", tap(`1-${i}`));
  await invoke(page, "toggle", tap("1-14"));
  expect(page.data).toMatchObject({ inspectedSeat: "1排14座", seatReview: { id: 42, status: "pending", memberName: "合成申请人" } });
  await invoke(page, "toggle", tap("1-13"));
  expect(page.data).toMatchObject({ inspectedSeat: "1排13座", seatReview: { id: 43, status: "confirmed" } });
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

it("小程序从座位详情审核、撤销和进入增加座位", async () => {
  const { page, http, navigation } = harness(true);
  const event = (id: number, extra = {}) => ({ currentTarget: { dataset: { id, ...extra } } });
  await invoke(page, "onShow");
  await invoke(page, "toggle", tap("1-14"));
  invoke(page, "openAdd", event(42));
  expect(navigation.go).toHaveBeenCalledWith("activity-seating", { kind: "events", id: 1, mode: "add", request: 42 });
  await invoke(page, "decide", event(999, { status: "confirmed" }));
  expect(http.request.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(0);
  await invoke(page, "decide", event(42, { status: "confirmed" }));
  expect(http.request.mock.calls.filter(([, options]) => options.method === "POST")[0][1].data)
    .toMatchObject({ action: "review", id: 42, revision: 0, status: "confirmed" });
  await invoke(page, "toggle", tap("1-14"));
  await invoke(page, "decide", event(42, { status: "rejected" }));
  expect(http.request.mock.calls.filter(([, options]) => options.method === "POST")[1][1].data)
    .toMatchObject({ action: "review", id: 42, revision: 0, status: "rejected" });
  await invoke(page, "toggle", tap("1-13"));
  await invoke(page, "revokeSeat", event(43, { seat: "1-13" }));
  expect(http.request.mock.calls.filter(([, options]) => options.method === "POST")[2][1].data)
    .toMatchObject({ action: "revoke-seat", id: 43, revision: 0, seat: "1-13" });
  await invoke(page, "toggle", tap("1-13"));
  await invoke(page, "revoke", event(43));
  expect(http.request.mock.calls.filter(([, options]) => options.method === "POST")[3][1].data)
    .toMatchObject({ action: "revoke", id: 43, revision: 0 });
});
