/* eslint-disable @typescript-eslint/no-explicit-any -- WeChat Page definitions are dynamic JavaScript objects. */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

type Page = { data: Record<string, any>; setData(data: Record<string, unknown>): void; [key: string]: any };
function loadPage(file: string, modules: Record<string, unknown>) {
  let page!: Page;
  runInNewContext(readFileSync(file, "utf8"), {
    Page: (value: Page) => { page = value; }, require: (name: string) => modules[name],
    wx: { setNavigationBarTitle: vi.fn() }, clearTimeout, setTimeout,
  });
  page.setData = values => {
    for (const [key, value] of Object.entries(values)) {
      const cell = /^layoutCells\[(\d+)\]\.cells\[(\d+)\]\.present$/.exec(key);
      if (cell) page.data.layoutCells[Number(cell[1])].cells[Number(cell[2])].present = value;
      else page.data[key] = value;
    }
  };
  return page;
}

it("小程序编辑方格、保留受保护座位并提交版本", async () => {
  const initial = { layout: { rowCount: 2, columnCount: 3, gaps: ["1-2"] }, revision: 4, protectedSeats: ["2-3"] };
  const calls: { method?: string; data?: any }[] = [];
  const http = { request: vi.fn(async (_url: string, options: { method?: string; data?: any }) => {
    calls.push(options);
    return options.method ? { ...initial, layout: options.data.layout, revision: 5 } : initial;
  }) };
  const page = loadPage("miniprogram/src/pages/activity-seating/index.js", {
    "../../lib/theme": { page: (value: Page) => value }, "../../lib/http": http, "../../lib/files": {}, "../../lib/privacy": {},
    "../../lib/navigation": {}, "../../lib/session": { user: () => ({ id: 1 }), subscribe: () => () => {} },
    "../../lib/format": {}, "../../lib/page": { actions: {} },
  });
  page._endpoint = "/synthetic"; page._revision = 0; page._closed = false;
  page.setData({ review: true, loading: false, busy: "" }); page.load = vi.fn(async () => {});
  await page.openLayout();
  expect(page.data.layoutCount).toBe(5);
  page.layoutToggle({ currentTarget: { dataset: { row: 0, column: 1 } } });
  page.layoutToggle({ currentTarget: { dataset: { row: 1, column: 2 } } });
  expect(page.data.layoutCount).toBe(6);
  page.layoutInput({ currentTarget: { dataset: { key: "column" } }, detail: { value: "2" } });
  page.layoutResize();
  expect(page.data.error).toContain("保留");
  page.layoutInput({ currentTarget: { dataset: { key: "column" } }, detail: { value: "4" } });
  page.layoutResize();
  page.layoutToggle({ currentTarget: { dataset: { row: 0, column: 3 } } });
  await page.saveLayout();
  expect(calls.at(-1)?.data).toMatchObject({ revision: 4, layout: { rowCount: 2, columnCount: 4, gaps: ["1-4"] } });
  const rows = page.layout({ rows: [{ row: 1, count: 4, offset: 0 }], missingSeats: ["1-4"], occupancy: { "1-4": "confirmed" }, blockedSeats: ["1-4"] }, [], 1, false);
  expect(rows[0].seats[3]).toMatchObject({ id: "1-4", missing: true });
});

it("小程序报名页面显示本人选座和票据，并丢弃换账号后的异步结果", async () => {
  let user = { id: 1 }, finish!: (value: unknown) => void;
  const http = { request: vi.fn(async () => new Promise(resolve => { finish = resolve; })), download: vi.fn(async () => "/tmp/ticket.png") };
  const session = { user: () => user, subscribe: () => () => {} };
  const navigation = { go: vi.fn() };
  const page = loadPage("miniprogram/src/pages/signup/index.js", {
    "../../lib/theme": { page: (value: Page) => value }, "../../lib/http": http, "../../lib/session": session,
    "../../lib/navigation": navigation, "../../lib/brand": {}, "../../lib/questionnaire": {}, "../../config": {},
    "../../lib/staff": {}, "../../lib/team": {}, "../../lib/page": { actions: {}, protect: () => true, error: () => {} },
  });
  page.onLoad({ kind: "events", id: "42" });
  const pending = page.loadSeatReceipt();
  finish({ mine: { status: "confirmed", seats: ["14-50"], requestedCount: 1 }, ticketImages: [{ seat: "14-50", version: "v1" }] });
  await pending;
  expect(page.data.seatReceipt).toMatchObject({ statusText: "已确认", seats: "14排50座" });
  expect(page.data.seatTickets).toMatchObject([{ path: "/tmp/ticket.png" }]);
  page.openSeatReceipt();
  expect(navigation.go).toHaveBeenCalledWith("activity-seating", { kind: "events", id: "42" });
  const stale = page.loadSeatReceipt(); user = { id: 2 };
  finish({ mine: { status: "pending", seats: ["1-1"] }, ticketImages: [] });
  await stale;
  expect(page.data.seatReceipt.seats).toBe("14排50座");
  page.onHide();
  expect(page.data.seatReceipt).toBeNull();
});
