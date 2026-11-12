import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

type NativePage = { data: Record<string, unknown>; setData(data: Record<string, unknown>): void; [key: string]: unknown };
const invoke = (page: NativePage, method: string, ...args: unknown[]) =>
  (page[method] as (...values: unknown[]) => unknown).apply(page, args);
const tap = (seat: string) => ({ currentTarget: { dataset: { seat } } });

it("小程序预填待审核申请，保存调整后的座位、手机号和凭证", async () => {
  const original = "12345678-1234-4567-89ab-1234567890ab";
  const replacement = "22345678-1234-4567-89ab-1234567890ab";
  const state = { title: "合成活动", enabled: true, open: true, scheduled: false, loggedIn: true, canReview: false,
    rows: [{ row: 1, count: 3, offset: 0 }], occupancy: { "1-1": "pending", "1-2": "confirmed" } as Record<string, string>,
    blockedSeats: [] as string[], seatLimit: 10, proofLimit: 10, proofBytes: 8388608, drafts: [] as string[],
    mine: { id: 42, revision: 0, status: "pending", seats: ["1-1"] },
    mineDetails: { phone: "13800138000", proofs: [original], canEdit: true } };
  const http = {
    request: vi.fn(async (_path: string, options: { method?: string; data?: { id: number; revision: number; seats: string[]; phone: string; proofs: string[] } }) => {
      if (options.method === "DELETE") {
        state.mine = { ...state.mine, revision: state.mine.revision + 1, status: "cancelled" };
        state.occupancy = { "1-2": "confirmed" };
        return { mine: structuredClone(state.mine) };
      }
      if (options.method === "PATCH" && options.data) {
        state.mine = { ...state.mine, revision: state.mine.revision + 1, seats: options.data.seats };
        state.mineDetails = { ...state.mineDetails, phone: options.data.phone, proofs: options.data.proofs };
        state.drafts = [];
        state.occupancy = { "1-2": "confirmed", [options.data.seats[0]]: "pending" };
        return { mine: structuredClone(state.mine) };
      }
      return structuredClone(state);
    }),
    upload: vi.fn(async () => { state.drafts.push(replacement); return { id: replacement }; }),
  };
  const modules: Record<string, unknown> = {
    "../../lib/theme": { page: (value: NativePage) => value }, "../../lib/http": http,
    "../../lib/files": { choose: async () => ["synthetic.png"] }, "../../lib/privacy": { authorize: async () => true },
    "../../lib/navigation": {}, "../../lib/session": { user: () => ({ id: 1 }), subscribe: () => () => {} },
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
      if (path) (page.data.rows as { seats: unknown[] }[])[Number(path[1])].seats[Number(path[2])] = value;
      else page.data[key] = value;
    }
  };
  invoke(page, "onLoad", { kind: "events", id: "1" });
  await invoke(page, "onShow");
  invoke(page, "startEdit");
  expect(page.data).toMatchObject({ editing: true, selected: ["1-1"], phone: "13800138000", editProofs: [original] });
  invoke(page, "toggle", tap("1-1"));
  invoke(page, "toggle", tap("1-2"));
  invoke(page, "toggle", tap("1-3"));
  invoke(page, "removeProof", { currentTarget: { dataset: { proof: original } } });
  await invoke(page, "chooseProofs");
  invoke(page, "phoneInput", { detail: { value: "13900139000" } });
  await invoke(page, "submit");
  const write = http.request.mock.calls.find(([, options]) => options.method === "PATCH")?.[1].data;
  expect(write).toMatchObject({ id: 42, revision: 0, seats: ["1-3"], phone: "13900139000", proofs: [replacement] });
  expect(page.data).toMatchObject({ editing: false, notice: "修改已保存，申请继续等待审核。" });
  await invoke(page, "cancelRequest");
  const cancel = http.request.mock.calls.find(([, options]) => options.method === "DELETE")?.[1].data;
  expect(cancel).toMatchObject({ id: 42, revision: 1 });
  expect(page.data).toMatchObject({ notice: "申请已取消，全部座位已释放。", mine: { status: "cancelled" } });
});
