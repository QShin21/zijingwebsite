import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Page = { data: Record<string, unknown>; setData(values: Record<string, unknown>): void } & Record<string, unknown>;
type Picker = { success(value: unknown): void; fail(value: unknown): void };
type Upload = { url: string; filePath: string; success(value: unknown): void; fail(value: unknown): void };
const id1 = "12345678-1234-4567-89ab-1234567890ab";
const id2 = "22345678-1234-4567-89ab-1234567890ab";
const invoke = (page: Page, name: string, ...args: unknown[]) =>
  (page[name] as (...values: unknown[]) => unknown).apply(page, args);

function harness() {
  let user: { id: number } | null = { id: 1 };
  let subscriber: (value: unknown) => void = () => {};
  let picker: (value: Picker) => void = value => value.success({ tempFiles: [{ tempFilePath: "/synthetic/one.png" }] });
  let uploader: (value: Upload) => void = value => {
    state.drafts.push(id1);
    value.success({ statusCode: 201, data: JSON.stringify({ id: id1 }) });
  };
  let failRead = false;
  const state = {
    title: "合成活动", mode: "selection", enabled: true, open: true, scheduled: false,
    loggedIn: true, canReview: false, rows: [{ row: 1, count: 2, offset: 0 }],
    occupancy: {}, blockedSeats: [], seatLimit: 10, proofLimit: 10, proofBytes: 8388608,
    drafts: [] as string[], mine: null, mineDetails: null,
  };
  const wx = {
    setNavigationBarTitle: vi.fn(),
    request: vi.fn((value: { success(result: unknown): void; fail(): void }) => {
      if (failRead) value.fail();
      else value.success({ statusCode: 200, data: structuredClone(state) });
    }),
    chooseMedia: vi.fn((value: Picker) => picker(value)),
    uploadFile: vi.fn((value: Upload) => { uploader(value); return {}; }),
  };
  const session = {
    user: () => user, token: () => user ? "synthetic-token" : "",
    subscribe: (fn: (value: unknown) => void) => { subscriber = fn; return () => {}; },
    clear: () => {},
  };
  const load = (file: string, dependencies: Record<string, unknown>) => {
    const module = { exports: {} };
    runInNewContext(readFileSync(file, "utf8"), {
      module, wx, Uint8Array, setTimeout, clearTimeout,
      require: (name: string) => {
        if (!Object.hasOwn(dependencies, name)) throw new Error("Unexpected dependency: " + name);
        return dependencies[name];
      },
    });
    return module.exports;
  };
  const files = load("miniprogram/src/lib/files.js", {});
  const http = load("miniprogram/src/lib/http.js", {
    "../config": { origin: "https://example.invalid" }, "./session": session,
    "./brand": { display: (value: unknown) => value },
  });
  const privacy = { authorize: vi.fn(async () => {}) };
  const dependencies: Record<string, unknown> = {
    "../../lib/theme": { page: (value: Page) => value }, "../../lib/http": http, "../../lib/files": files,
    "../../lib/privacy": privacy, "../../lib/navigation": {}, "../../lib/session": session,
    "../../lib/format": { date: () => "", beijingParts: () => ({}) }, "../../lib/page": { actions: {} },
  };
  let page!: Page;
  runInNewContext(readFileSync("miniprogram/src/pages/activity-seating/index.js", "utf8"), {
    Page: (value: Page) => { page = value; }, wx, setTimeout, clearTimeout,
    require: (name: string) => dependencies[name],
  });
  page.setData = values => Object.assign(page.data, values);
  invoke(page, "onLoad", { kind: "events", id: "1" });
  return {
    page, state, wx, privacy,
    setPicker: (value: typeof picker) => { picker = value; },
    setUploader: (value: typeof uploader) => { uploader = value; },
    failReads: () => { failRead = true; },
    changeAccount: () => { user = { id: 2 }; subscriber(user); },
  };
}

describe("选座凭证：真实选图与上传适配层", () => {
  it("成功回执即更新凭证数，即使随后刷新失败仍保留可核对的结果", async () => {
    const h = harness();
    await invoke(h.page, "onShow");
    h.setUploader(value => {
      value.success({ statusCode: 201, data: JSON.stringify({ id: id1 }) });
      h.failReads();
    });
    await invoke(h.page, "chooseProofs");
    expect(h.wx.uploadFile).toHaveBeenCalledTimes(1);
    expect(h.page.data.drafts).toEqual([id1]);
    expect(h.page.data.proofNotice).toContain("已上传 1 张");
    expect(h.page.data.loadError).toContain("连接失败");
  });

  it("只把明确取消视为取消；选图失败与空结果显示在凭证区域", async () => {
    const h = harness();
    await invoke(h.page, "onShow");
    h.setPicker(value => value.fail({ errMsg: "chooseMedia:fail cancel" }));
    await invoke(h.page, "chooseProofs");
    expect(h.page.data.proofError).toBe("");
    expect(h.wx.uploadFile).not.toHaveBeenCalled();
    h.setPicker(value => value.fail({ errMsg: "chooseMedia:fail permission denied" }));
    await invoke(h.page, "chooseProofs");
    expect(h.page.data.proofError).toContain("权限");
    h.setPicker(value => value.success({ tempFiles: [] }));
    await invoke(h.page, "chooseProofs");
    expect(h.page.data.proofError).toContain("未获取到所选图片");
    expect(h.wx.uploadFile).not.toHaveBeenCalled();
  });

  it("微信上传域名拒绝显示具体提示，且不暴露原始错误中的地址", async () => {
    const h = harness();
    await invoke(h.page, "onShow");
    h.setUploader(value => value.fail({ errMsg: "uploadFile:fail url not in domain list: https://example.invalid/private" }));
    await invoke(h.page, "chooseProofs");
    expect(h.page.data.proofError).toContain("上传域名");
    expect(h.page.data.proofError).not.toContain("example.invalid");
    expect(h.page.data.drafts).toEqual([]);
  });

  it("多图部分成功后保留已上传回执并显示后续失败", async () => {
    const h = harness();
    await invoke(h.page, "onShow");
    h.setPicker(value => value.success({ tempFiles: [{ tempFilePath: "/synthetic/one.png" }, { tempFilePath: "/synthetic/two.png" }] }));
    let index = 0;
    h.setUploader(value => {
      if (index++ === 0) { h.state.drafts.push(id1); value.success({ statusCode: 201, data: JSON.stringify({ id: id1 }) }); }
      else value.fail({ errMsg: "uploadFile:fail network" });
    });
    await invoke(h.page, "chooseProofs");
    expect(h.page.data.drafts).toEqual([id1]);
    expect(h.page.data.proofNotice).toContain("已上传 1 张");
    expect(h.page.data.proofError).toContain("上传未完成");
  });

  it("账号变化后，迟到的选图回调不会触发上传", async () => {
    const h = harness();
    await invoke(h.page, "onShow");
    let pending!: Picker;
    let pickerOpened!: () => void;
    const opened = new Promise<void>(resolve => { pickerOpened = resolve; });
    h.setPicker(value => { pending = value; pickerOpened(); });
    const result = invoke(h.page, "chooseProofs");
    await opened;
    h.changeAccount();
    pending.success({ tempFiles: [{ tempFilePath: "/synthetic/one.png" }] });
    await result;
    expect(h.wx.uploadFile).not.toHaveBeenCalled();
    expect(h.page.data.proofNotice).toBe("");
    expect(h.page.data.proofError).toBe("");
  });

  it("相册引起页面隐藏和恢复时，继续上传并刷新凭证数量", async () => {
    const h = harness();
    await invoke(h.page, "onShow");
    let pending!: Picker;
    let pickerOpened!: () => void;
    const opened = new Promise<void>(resolve => { pickerOpened = resolve; });
    h.setPicker(value => { pending = value; pickerOpened(); });
    const result = invoke(h.page, "chooseProofs");
    await opened;
    invoke(h.page, "onHide");
    invoke(h.page, "onShow");
    pending.success({ tempFiles: [{ tempFilePath: "/synthetic/one.png" }] });
    await result;
    expect(h.wx.uploadFile).toHaveBeenCalledTimes(1);
    expect(h.page.data.drafts).toEqual([id1]);
    expect(h.page.data.proofNotice).toContain("已上传 1 张");
  });

  it("编辑既有申请时保留本次上传回执", async () => {
    const h = harness();
    await invoke(h.page, "onShow");
    h.page.setData({ editing: true, editProofs: [id2] });
    h.setUploader(value => {
      value.success({ statusCode: 201, data: JSON.stringify({ id: id1 }) });
      h.failReads();
    });
    await invoke(h.page, "chooseProofs");
    expect(h.page.data.editProofs).toEqual([id2, id1]);
  });
});
