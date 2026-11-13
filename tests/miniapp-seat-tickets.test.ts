import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

type Page = { data: Record<string, unknown>; setData(values: Record<string, unknown>): void } & Record<string, unknown>;
type Download = { url: string; header: Record<string, string>; success(value: unknown): void; fail(): void };
const invoke = (page: Page, name: string, ...args: unknown[]) => (page[name] as (...values: unknown[]) => unknown).apply(page, args);
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness(review = false) {
  let user = { id: 1 }, subscriber: (value: unknown) => void = () => {};
  let download: (value: Download) => void = value => value.success({ statusCode: 200, tempFilePath: "/synthetic/private.png" });
  const state = { title: "合成活动", mode: "selection", enabled: true, open: true, scheduled: false,
    loggedIn: true, canReview: review, rows: [{ row: 1, count: 2, offset: 0 }], occupancy: {}, blockedSeats: [],
    seatLimit: 10, proofLimit: 10, proofBytes: 8388608, drafts: [], mineDetails: null,
    mine: { status: "confirmed", seats: ["1-1", "1-2"], requestedCount: 2 },
    ticketImages: [{ seat: "1-1", version: "abc", extension: "png" }] };
  const wx = {
    setNavigationBarTitle: vi.fn(),
    request: vi.fn((value: { url: string; success(result: unknown): void }) => value.success({ statusCode: 200,
      data: value.url.endsWith("/tickets") ? { seats: ["1-1"] } : review ? { ...state, docs: [], hasNextPage: false } : state })),
    downloadFile: vi.fn((value: Download) => { download(value); return {}; }),
    previewImage: vi.fn(),
    saveImageToPhotosAlbum: vi.fn((value: { success(): void }) => value.success()),
    chooseMessageFile: vi.fn((value: { success(result: unknown): void }) => value.success({ tempFiles: [
      { name: "01排01座.png", path: "/synthetic/one.png", size: 128 },
      { name: "01排02座.jpg", path: "/synthetic/two.jpg", size: 128 },
    ] })),
    uploadFile: vi.fn((value: { formData: { filename: string }; success(result: unknown): void }) => {
      value.success(value.formData.filename.endsWith("png") ? { statusCode: 201, data: '{"seat":"1-1"}' }
        : { statusCode: 400, data: '{"error":"图片无效"}' }); return {};
    }),
  };
  const session = { user: () => user, token: () => `token-${user.id}`,
    subscribe: (fn: (value: unknown) => void) => { subscriber = fn; return () => {}; }, clear: () => {} };
  const module = { exports: {} };
  runInNewContext(readFileSync("miniprogram/src/lib/http.js", "utf8"), { module, wx,
    require: (name: string) => ({ "../config": { origin: "https://example.invalid" }, "./session": session,
      "./brand": { display: (value: unknown) => value } } as Record<string, unknown>)[name] });
  const privacy = { authorize: vi.fn(async () => {}) };
  let page!: Page;
  const deps: Record<string, unknown> = { "../../lib/theme": { page: (value: Page) => value },
    "../../lib/http": module.exports, "../../lib/files": {}, "../../lib/privacy": privacy,
    "../../lib/navigation": {}, "../../lib/session": session, "../../lib/format": { date: () => "", beijingParts: () => ({}) },
    "../../lib/page": { actions: {} } };
  runInNewContext(readFileSync("miniprogram/src/pages/activity-seating/index.js", "utf8"), {
    Page: (value: Page) => { page = value; }, wx, setTimeout, clearTimeout, require: (name: string) => deps[name],
  });
  page.setData = values => Object.assign(page.data, values);
  invoke(page, "onLoad", { kind: "events", id: "1", ...(review ? { mode: "review" } : {}) });
  return { page, wx, privacy, state, setDownload: (handler: typeof download) => { download = handler; },
    changeAccount: () => { user = { id: 2 }; state.mine.status = "pending"; state.ticketImages = []; subscriber(user); } };
}

it("小程序回执使用登录凭据读取原图，并能预览和保存到相册", async () => {
  const h = harness();
  await invoke(h.page, "onShow"); await flush();
  const tickets = h.page.data.tickets as { seat: string; path: string; version: string }[];
  expect(tickets.map(item => [item.seat, item.path])).toEqual([["1-1", "/synthetic/private.png"], ["1-2", ""]]);
  const request = h.wx.downloadFile.mock.calls[0][0] as Download;
  expect(request.header.Authorization).toBe("JWT token-1");
  invoke(h.page, "previewTicket", { currentTarget: { dataset: { seat: "1-1" } } });
  expect(h.wx.previewImage).toHaveBeenCalledWith(expect.objectContaining({ current: "/synthetic/private.png" }));
  await invoke(h.page, "saveTicket", { currentTarget: { dataset: { seat: "1-1" } } });
  expect(h.privacy.authorize).toHaveBeenCalled();
  expect(h.wx.saveImageToPhotosAlbum).toHaveBeenCalledWith(expect.objectContaining({ filePath: "/synthetic/private.png" }));
  expect(h.page.data.notice).toContain("已保存到相册");
  invoke(h.page, "onUnload");
});

it("切换账号后，迟到的票据下载不能显示在新账号页面", async () => {
  const h = harness(); let pending!: Download;
  h.setDownload(value => { pending = value; });
  await invoke(h.page, "onShow"); await flush();
  h.changeAccount(); await flush();
  pending.success({ statusCode: 200, tempFilePath: "/synthetic/old-account.png" });
  await flush();
  expect(h.page.data.tickets).toEqual([]);
  invoke(h.page, "onUnload");
});

it("管理员批量选择文件时保留文件名并反馈部分成功", async () => {
  const h = harness(true);
  await invoke(h.page, "onShow"); await flush();
  await invoke(h.page, "chooseTickets"); await flush();
  expect(h.wx.uploadFile).toHaveBeenCalledTimes(2);
  expect(h.wx.uploadFile.mock.calls.map(call => call[0].formData.filename)).toEqual(["01排01座.png", "01排02座.jpg"]);
  expect(h.page.data.notice).toContain("已保存 1 张票据，1 张未完成");
  expect(h.page.data.ticketUploadErrors).toEqual([expect.stringContaining("01排02座.jpg")]);
  invoke(h.page, "onUnload");
});
