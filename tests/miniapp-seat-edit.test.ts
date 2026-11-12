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
    request: vi.fn(async (_path: string, options: { method?: string; data?: { action?: string; id: number; revision: number; seats: string[]; phone: string; proofs: string[] } }) => {
      if (options.method === "DELETE") {
        state.mine = { ...state.mine, revision: state.mine.revision + 1, status: "cancelled" };
        state.occupancy = { "1-2": "confirmed" };
        return { mine: structuredClone(state.mine) };
      }
      if (options.method === "POST" && options.data?.action === "edit") {
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
  const write = http.request.mock.calls.find(([, options]) => options.method === "POST" && options.data?.action === "edit")?.[1].data;
  expect(write).toMatchObject({ action: "edit", id: 42, revision: 0, seats: ["1-3"], phone: "13900139000", proofs: [replacement] });
  expect(page.data).toMatchObject({ editing: false, notice: "修改已保存，申请继续等待审核。" });
  await invoke(page, "cancelRequest");
  const cancel = http.request.mock.calls.find(([, options]) => options.method === "DELETE")?.[1].data;
  expect(cancel).toMatchObject({ id: 42, revision: 1 });
  expect(page.data).toMatchObject({ notice: "申请已取消，全部座位已释放。", mine: { status: "cancelled" } });
});

it("小程序管理员确认后撤销已确认申请并携带版本", async () => {
  const calls: { method?: string; data?: unknown }[] = [];
  const doc = { id: 52, revision: 3, status: "confirmed", memberName: "合成成员", phone: "13800138000", seats: ["1-1"], proofs: [], createdAt: "2026-11-12T00:00:00Z" };
  const http = { request: vi.fn(async (_path: string, options: { method?: string; data?: unknown }) => {
    if (options.method) { calls.push(options); return { fullyRevoked: true }; }
    return { title: "合成活动", enabled: true, open: true, scheduled: false, docs: [doc], hasNextPage: false };
  }) };
  const modules: Record<string, unknown> = {
    "../../lib/theme": { page: (value: NativePage) => value }, "../../lib/http": http,
    "../../lib/files": {}, "../../lib/privacy": {}, "../../lib/navigation": {},
    "../../lib/session": { user: () => ({ id: 1 }), subscribe: () => () => {} },
    "../../lib/format": { date: () => "", beijingParts: () => ({}) }, "../../lib/page": { actions: {} },
  };
  let page!: NativePage;
  runInNewContext(readFileSync("miniprogram/src/pages/activity-seating/index.js", "utf8"), {
    Page: (value: NativePage) => { page = value; }, require: (name: string) => modules[name],
    wx: { setNavigationBarTitle: vi.fn(), showModal: (options: { success: (answer: { confirm: boolean }) => void }) => options.success({ confirm: true }) }, clearTimeout, setTimeout,
  });
  page.setData = values => Object.assign(page.data, values);
  invoke(page, "onLoad", { kind: "events", id: "1", mode: "review" });
  await invoke(page, "onShow");
  await invoke(page, "revokeSeat", { currentTarget: { dataset: { id: 52, seat: "1-1" } } });
  expect(calls[0]).toMatchObject({ method: "POST", data: { action: "revoke-seat", id: 52, revision: 3, seat: "1-1" } });
  expect(page.data.notice).toBe("座位已释放，申请已全部撤销。");
  await invoke(page, "revoke", { currentTarget: { dataset: { id: 52 } } });
  expect(calls).toHaveLength(2);
  expect(calls[1]).toMatchObject({ method: "POST", data: { action: "revoke", id: 52, revision: 3 } });
  expect(page.data.notice).toBe("已撤销确认，全部座位已释放。");
});

it("小程序管理员打开申请座位图并追加空座", async () => {
  const request = { id: 53, revision: 2, status: "confirmed", seats: ["1-1"], createdAt: "2026-11-12T00:00:00Z", reviewedAt: null };
  const state = { title: "合成活动", request, rows: [{ row: 1, count: 4, offset: 0 }], seatLimit: 10,
    occupancy: { "1-1": "confirmed", "1-2": "confirmed" } as Record<string, string>, blockedSeats: ["1-2"] };
  const navigation = { go: vi.fn() };
  const http = { request: vi.fn(async (path: string, options: { method?: string; data?: { seats: string[] } }) => {
    if (options.method === "POST") {
      request.seats = request.seats.concat(options.data!.seats);
      request.revision++;
      state.occupancy["1-3"] = "confirmed";
      return { request: structuredClone(request) };
    }
    if (path.includes("mode=review")) return { title: state.title, docs: [{ ...request, memberName: "合成成员", phone: "13800138000", proofs: [] }] };
    return structuredClone(state);
  }) };
  const modules: Record<string, unknown> = {
    "../../lib/theme": { page: (value: NativePage) => value }, "../../lib/http": http,
    "../../lib/files": {}, "../../lib/privacy": {}, "../../lib/navigation": navigation,
    "../../lib/session": { user: () => ({ id: 1 }), subscribe: () => () => {} },
    "../../lib/format": { date: () => "", beijingParts: () => ({}) }, "../../lib/page": { actions: {} },
  };
  let page!: NativePage;
  const createPage = () => {
    runInNewContext(readFileSync("miniprogram/src/pages/activity-seating/index.js", "utf8"), {
      Page: (value: NativePage) => { page = value; }, require: (name: string) => modules[name],
      wx: { setNavigationBarTitle: vi.fn() }, clearTimeout, setTimeout,
    });
    page.setData = values => {
      for (const [key, value] of Object.entries(values)) {
        const path = /^rows\[(\d+)\]\.seats\[(\d+)\]$/.exec(key);
        if (path) (page.data.rows as { seats: unknown[] }[])[Number(path[1])].seats[Number(path[2])] = value;
        else page.data[key] = value;
      }
    };
  };
  createPage();
  invoke(page, "onLoad", { kind: "events", id: "1", mode: "review" });
  await invoke(page, "onShow");
  invoke(page, "openAdd", { currentTarget: { dataset: { id: 53 } } });
  expect(navigation.go).toHaveBeenCalledWith("activity-seating", { kind: "events", id: 1, mode: "add", request: 53 });
  invoke(page, "onUnload");
  createPage();
  invoke(page, "onLoad", { kind: "events", id: "1", mode: "add", request: "53" });
  await invoke(page, "onShow");
  expect(page.data).toMatchObject({ adding: true, requestNumber: 53, existingCount: 1, seatLimit: 9 });
  invoke(page, "toggle", tap("1-1"));
  invoke(page, "toggle", tap("1-2"));
  invoke(page, "toggle", tap("1-3"));
  await invoke(page, "submitAdd");
  const sent = http.request.mock.calls.find(([, options]) => options.method === "POST")?.[1].data;
  expect(sent).toMatchObject({ action: "add-seats", id: 53, revision: 2, status: "confirmed", seats: ["1-3"] });
  expect(page.data).toMatchObject({ existingCount: 2, selected: [], notice: "已为申请增加 1 个座位。" });
});

it("小程序管理员从申请打开换座并保留座位数量", async () => {
  const request = { id: 54, revision: 2, status: "confirmed", seats: ["1-1", "1-2"], createdAt: "2026-11-12T00:00:00Z", reviewedAt: null };
  const state = { title: "合成活动", request, rows: [{ row: 1, count: 5, offset: 0 }], seatLimit: 10,
    occupancy: { "1-1": "confirmed", "1-2": "confirmed", "1-3": "pending", "1-4": "confirmed" } as Record<string, string>, blockedSeats: ["1-4"] };
  const navigation = { go: vi.fn() };
  const http = { request: vi.fn(async (path: string, options: { method?: string; data?: { seats: string[] } }) => {
    if (options.method === "POST") {
      request.seats = options.data!.seats.slice(); request.revision++;
      state.occupancy = { "1-2": "confirmed", "1-3": "pending", "1-4": "confirmed", "1-5": "confirmed" };
      return { request: structuredClone(request) };
    }
    if (path.includes("mode=review")) return { title: state.title, docs: [{ ...request, memberName: "合成成员", phone: "13800138000", proofs: [] }] };
    return structuredClone(state);
  }) };
  const modules: Record<string, unknown> = {
    "../../lib/theme": { page: (value: NativePage) => value }, "../../lib/http": http,
    "../../lib/files": {}, "../../lib/privacy": {}, "../../lib/navigation": navigation,
    "../../lib/session": { user: () => ({ id: 1 }), subscribe: () => () => {} },
    "../../lib/format": { date: () => "", beijingParts: () => ({}) }, "../../lib/page": { actions: {} },
  };
  let page!: NativePage;
  const createPage = () => {
    runInNewContext(readFileSync("miniprogram/src/pages/activity-seating/index.js", "utf8"), {
      Page: (value: NativePage) => { page = value; }, require: (name: string) => modules[name],
      wx: { setNavigationBarTitle: vi.fn() }, clearTimeout, setTimeout,
    });
    page.setData = values => {
      for (const [key, value] of Object.entries(values)) {
        const path = /^rows\[(\d+)\]\.seats\[(\d+)\]$/.exec(key);
        if (path) (page.data.rows as { seats: unknown[] }[])[Number(path[1])].seats[Number(path[2])] = value;
        else page.data[key] = value;
      }
    };
  };
  createPage();
  invoke(page, "onLoad", { kind: "events", id: "1", mode: "review" });
  await invoke(page, "onShow");
  invoke(page, "openChange", { currentTarget: { dataset: { id: 54 } } });
  expect(navigation.go).toHaveBeenCalledWith("activity-seating", { kind: "events", id: 1, mode: "change", request: 54 });
  invoke(page, "onUnload");
  createPage();
  invoke(page, "onLoad", { kind: "events", id: "1", mode: "change", request: "54" });
  await invoke(page, "onShow");
  expect(page.data).toMatchObject({ changing: true, selected: ["1-1", "1-2"], seatLimit: 2, changeReady: false });
  invoke(page, "toggle", tap("1-3"));
  invoke(page, "toggle", tap("1-4"));
  invoke(page, "toggle", tap("1-1"));
  invoke(page, "toggle", tap("1-5"));
  expect(page.data).toMatchObject({ selected: ["1-2", "1-5"], changeReady: true });
  await invoke(page, "submitChange");
  const sent = http.request.mock.calls.find(([, options]) => options.method === "POST")?.[1].data;
  expect(sent).toMatchObject({ action: "change-seats", id: 54, revision: 2, status: "confirmed", seats: ["1-2", "1-5"] });
  expect(page.data).toMatchObject({ selected: ["1-2", "1-5"], changeReady: false, notice: "已更换座位，申请状态保持不变。" });
});

it("小程序随机申请按数量提交和修改，审核前不显示座位", async () => {
  const proof = "12345678-1234-4567-89ab-1234567890ab";
  const state = { title: "合成活动", mode: "random", enabled: true, open: true, scheduled: false, loggedIn: true, canReview: false,
    rows: [{ row: 1, count: 5, offset: 0 }], occupancy: {}, blockedSeats: [], seatLimit: 10, proofLimit: 10, proofBytes: 8388608,
    drafts: [proof], mine: null as null | { id: number; revision: number; status: string; seats: string[]; requestedCount: number; allocationMode: string },
    mineDetails: null as null | { phone: string; proofs: string[]; canEdit: boolean } };
  const http = { request: vi.fn(async (_path: string, options: { method?: string; data?: { action?: string; count: number; phone: string; proofs: string[] } }) => {
    if (options.method === "POST") {
      const data = options.data!;
      state.mine = { id: 77, revision: data.action === "edit" ? 1 : 0, status: "pending", seats: [], requestedCount: data.count, allocationMode: "random" };
      state.mineDetails = { phone: data.phone, proofs: data.proofs, canEdit: true };
      state.drafts = [];
      return { mine: structuredClone(state.mine) };
    }
    return structuredClone(state);
  }) };
  const modules: Record<string, unknown> = {
    "../../lib/theme": { page: (value: NativePage) => value }, "../../lib/http": http,
    "../../lib/files": {}, "../../lib/privacy": {}, "../../lib/navigation": {},
    "../../lib/session": { user: () => ({ id: 1 }), subscribe: () => () => {} },
    "../../lib/format": { date: () => "", beijingParts: () => ({}) }, "../../lib/page": { actions: {} },
  };
  let page!: NativePage;
  runInNewContext(readFileSync("miniprogram/src/pages/activity-seating/index.js", "utf8"), {
    Page: (value: NativePage) => { page = value; }, require: (name: string) => modules[name],
    wx: { setNavigationBarTitle: vi.fn() }, clearTimeout, setTimeout,
  });
  page.setData = values => Object.assign(page.data, values);
  invoke(page, "onLoad", { kind: "events", id: "1" });
  await invoke(page, "onShow");
  expect(page.data).toMatchObject({ mode: "random", rows: [], counts: null });
  invoke(page, "countInput", { detail: { value: "2" } });
  invoke(page, "phoneInput", { detail: { value: "13800138000" } });
  await invoke(page, "submit");
  expect(page.data).toMatchObject({ mine: { status: "pending", count: 2, seats: "" }, rows: [] });
  invoke(page, "startEdit");
  invoke(page, "countInput", { detail: { value: "3" } });
  await invoke(page, "submit");
  const writes = http.request.mock.calls.filter(([, options]) => options.method === "POST").map(([, options]) => options.data);
  expect(writes[0]).toMatchObject({ mode: "random", count: 2, proofs: [proof] });
  expect(writes[1]).toMatchObject({ action: "edit", id: 77, revision: 0, mode: "random", count: 3 });
  state.mine = { ...state.mine!, status: "confirmed", seats: ["1-1", "1-2", "1-3"] };
  state.mineDetails = null;
  await invoke(page, "refresh");
  expect(page.data).toMatchObject({ mine: { status: "confirmed", seats: "1排1座、1排2座、1排3座" }, rows: [], counts: null });
});

it("小程序管理员切换模式并调整随机申请数量", async () => {
  const doc = { id: 78, revision: 0, status: "pending", allocationMode: "random", requestedCount: 2, seats: [] as string[],
    memberName: "合成成员", phone: "13800138000", proofs: [], createdAt: "2026-11-12T00:00:00Z" };
  let mode = "selection";
  const http = { request: vi.fn(async (_path: string, options: { method?: string; data?: { action?: string; mode?: string; count?: number } }) => {
    if (options.method === "PUT") mode = options.data!.mode!;
    if (options.data?.action === "random-count") { doc.requestedCount = options.data.count!; doc.revision++; }
    return { title: "合成活动", enabled: true, open: true, scheduled: false, mode, docs: [structuredClone(doc)], hasNextPage: false };
  }) };
  const modules: Record<string, unknown> = {
    "../../lib/theme": { page: (value: NativePage) => value }, "../../lib/http": http,
    "../../lib/files": {}, "../../lib/privacy": {}, "../../lib/navigation": {},
    "../../lib/session": { user: () => ({ id: 1 }), subscribe: () => () => {} },
    "../../lib/format": { date: () => "", beijingParts: () => ({}) }, "../../lib/page": { actions: {} },
  };
  let page!: NativePage;
  runInNewContext(readFileSync("miniprogram/src/pages/activity-seating/index.js", "utf8"), {
    Page: (value: NativePage) => { page = value; }, require: (name: string) => modules[name],
    wx: { setNavigationBarTitle: vi.fn(), showActionSheet: (options: { success: (answer: { tapIndex: number }) => void }) => options.success({ tapIndex: 3 }) }, clearTimeout, setTimeout,
  });
  page.setData = values => Object.assign(page.data, values);
  invoke(page, "onLoad", { kind: "events", id: "1", mode: "review" });
  await invoke(page, "onShow");
  await invoke(page, "setMode", { currentTarget: { dataset: { mode: "random" } } });
  expect(page.data.mode).toBe("random");
  expect(page.data.docs).toMatchObject([{ id: 78, seatCount: 2, unassigned: true }]);
  await invoke(page, "adjustRandomCount", { currentTarget: { dataset: { id: 78 } } });
  const change = http.request.mock.calls.find(([, options]) => options.data?.action === "random-count")?.[1].data;
  expect(change).toMatchObject({ action: "random-count", id: 78, revision: 0, count: 4 });
  expect(page.data.docs).toMatchObject([{ id: 78, seatCount: 4, unassigned: true }]);
});
