import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type User = { id: number; name: string; roles: string[] };
type Data = Record<string, unknown>;
type Options = { method?: string; raw?: boolean; required?: boolean; data?: Data };
type Event = { currentTarget: { dataset: { index: number; key?: string } }; detail: { value: string } };
type Doc = Data & { id: number; status: string; updatedAt: string; allowed: { value: string; label: string }[]; feedbackDraft: string; decisionIndex: number };
type Page = { data: { docs: Doc[]; busy: boolean; loading: boolean; error: string; message: string; total: number; needsLogin: boolean; page: number };
  setData(value: Data): void; onLoad(options: { id: string }): void; onShow(): Promise<void>; onHide(): void; onUnload(): void;
  load(page?: number): Promise<void>; retry(): Promise<void>; decide(event: Event): Promise<void>; field(event: Event): void };
type Modal = { success(value: { confirm: boolean }): void; fail(): void };
const path = "miniprogram/src/pages/staff-review/index.js";
// Exact source fixtures retain the negative regression proof in shallow CI checkouts.
const frozen = readFileSync(new URL("./fixtures/miniapp-staff-review-72f580f.js.txt", import.meta.url), "utf8");
const frozenWXML = readFileSync(new URL("./fixtures/miniapp-staff-review-72f580f.wxml.txt", import.meta.url), "utf8");
const require = createRequire(import.meta.url);
const staff = require("../miniprogram/src/lib/staff.js"), cms = require("../miniprogram/src/lib/cms.js");
const oldRevision = "2026-10-12T01:00:00Z", newRevision = "2026-10-12T02:00:00Z";
const firstUser: User = { id: 501, name: "合成审核人甲", roles: ["vicePresident"] }, secondUser = { ...firstUser, id: 502, name: "合成审核人乙" };
const row = (revision = oldRevision, status = "reviewing", statuses = ["returned", "accepted"]) => ({ id: 811, batch: 71, memberName: "合成申请者",
  status, createdAt: oldRevision, updatedAt: revision, questions: [{ id: "name", label: "合成必要资料", type: "text", required: true, options: [] }],
  answers: { name: "合成私有答案" }, formVersion: "form-v3", feedback: "合成已有反馈", actions: { reviewStatuses: statuses } });
const result = (revision = oldRevision, status = "reviewing", statuses = ["returned", "accepted"]) => ({ docs: [row(revision, status, statuses)], page: 1, totalPages: 1, totalDocs: 1 });
const event = (key?: string, value = ""): Event => ({ currentTarget: { dataset: { index: 0, ...(key ? { key } : {}) } }, detail: { value } });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const failure = (message: string, status?: number) => Object.assign(new Error(message), status === undefined ? {} : { status });
function harness(source = readFileSync(path, "utf8")) {
  let page!: Page, user: User | null = firstUser;
  const listeners = new Set<(user: User | null) => void>(), modals: Modal[] = [], patches: Data[] = [];
  const request = vi.fn<(path: string, options?: Options) => Promise<Data>>().mockResolvedValue(result());
  const wx = { showModal: vi.fn((options: Modal) => modals.push(options)), setNavigationBarTitle: vi.fn(), stopPullDownRefresh: vi.fn() };
  const dependencies: Data = { "../../lib/http": { request }, "../../lib/session": { user: () => user,
    subscribe: (listener: (user: User | null) => void) => { listeners.add(listener); return () => listeners.delete(listener); } },
    "../../lib/staff": staff, "../../lib/cms": cms, "../../lib/page": { actions: {}, protect: (target: Page) => {
      target.setData({ needsLogin: !user }); return user;
    }, error: (target: Page, cause: Error & { status?: number }) => target.setData({ loading: false, error: cause.message, needsLogin: cause.status === 401 }) } };
  runInNewContext(source, { Page: (value: Page) => { page = value; }, require: (name: string) => dependencies[name], wx });
  page.setData = values => {
    patches.push(values);
    for (const [key, value] of Object.entries(values)) {
      const parts = key.replace(/\[(\d+)\]/g, ".$1").split("."); let target = page.data as unknown as Data;
      for (const part of parts.slice(0, -1)) target = target[part] as Data;
      target[parts[parts.length - 1]] = value;
    }
  };
  page.onLoad({ id: "71" });
  return { page, request, modals, wx, patches, listeners, changeUser(value: User | null) { user = value; for (const listener of listeners) listener(value); },
    reads: () => request.mock.calls.filter(([, options]) => !options?.method || options.method === "GET"),
    posts: () => request.mock.calls.filter(([, options]) => options?.method === "POST") };
}
async function start(source?: string) { const h = harness(source); await h.page.load(); return h; }

describe("冻结72f580f的真实Page时序证据", () => {
  it("后台/前台期间的迟到POST在旧page留下旧actions与revision，重复点击产生第二条POST", async () => {
    const h = await start(frozen), pending = deferred<Data>();
    h.request.mockImplementation(async (_path, options) => options?.method === "POST" ? h.posts().length === 1 ? pending.promise : { application: row(newRevision, "accepted", []) } : result(newRevision, "accepted", []));
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await flush();
    h.page.onHide(); await h.page.onShow(); pending.resolve({ application: row(newRevision, "accepted", []) }); await saving;
    expect(h.reads()).toHaveLength(1); expect(h.page.data.busy).toBe(false); expect(h.page.data.docs[0].updatedAt).toBe(oldRevision);
    expect(h.page.data.docs[0].allowed).toHaveLength(2);
    const again = h.page.decide(event()); h.modals[1].success({ confirm: true }); await again;
    expect(h.posts()).toHaveLength(2); expect(h.posts().map(([, options]) => options?.data?.revision)).toEqual([oldRevision, oldRevision]);
  });
});

describe("骨干审核生命周期修复", () => {
  it("hide/show保持真实POST锁，迟到完成先刷新当前能力，重复点击只有一条POST", async () => {
    const h = await start(), pending = deferred<Data>(), fresh = deferred<Data>();
    h.request.mockImplementation((_path, options) => options?.method === "POST" ? pending.promise : fresh.promise);
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await flush();
    h.page.onHide(); await h.page.onShow(); await h.page.decide(event());
    expect(h.posts()).toHaveLength(1); expect(h.reads()).toHaveLength(1); expect(h.page.data.busy).toBe(true);
    pending.resolve({ application: row(newRevision, "accepted", []) }); await flush();
    expect(h.reads()).toHaveLength(2); await h.page.decide(event()); expect(h.posts()).toHaveLength(1);
    fresh.resolve(result(newRevision, "accepted", [])); await saving;
    expect(h.page.data.docs[0].updatedAt).toBe(newRevision); expect(h.page.data.docs[0].allowed).toEqual([]);
    expect(h.page.data.message).toContain("已录用");
  });

  it("POST在后台先完成时不GET；下次show读取新revision并显示实际返回状态", async () => {
    const h = await start(), pending = deferred<Data>();
    h.request.mockImplementation((_path, options) => options?.method === "POST" ? pending.promise : Promise.resolve(result(newRevision, "accepted", [])));
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await flush();
    expect(h.posts()[0][1]?.data?.status).toBe("returned");
    h.page.onHide(); pending.resolve({ application: row(newRevision, "accepted", []) }); await saving;
    expect(h.reads()).toHaveLength(1); expect(h.page.data.busy).toBe(false); expect(h.page.data.docs[0].allowed).toEqual([]);
    await h.page.decide(event()); expect(h.posts()).toHaveLength(1);
    await h.page.onShow();
    expect(h.reads()).toHaveLength(2); expect(h.page.data.docs[0].updatedAt).toBe(newRevision); expect(h.page.data.message).toContain("已录用");
    expect(h.page.data.message).not.toContain("待补充"); expect(h.posts()).toHaveLength(1);
  });

  it.each([false, true])("modal hide后迟到confirm不POST，show-before-confirm=%s仍锁住再次点击", async showFirst => {
    const h = await start(), deciding = h.page.decide(event());
    h.page.onHide(); if (showFirst) await h.page.onShow();
    await h.page.decide(event()); expect(h.wx.showModal).toHaveBeenCalledTimes(1); expect(h.page.data.busy).toBe(true);
    h.request.mockResolvedValue(result(newRevision, "accepted", []));
    h.modals[0].success({ confirm: true }); await deciding;
    expect(h.posts()).toHaveLength(0); expect(h.reads()).toHaveLength(showFirst ? 2 : 1);
    if (!showFirst) await h.page.onShow();
    expect(h.page.data.docs[0].updatedAt).toBe(newRevision); expect(h.page.data.docs[0].allowed).toEqual([]); expect(h.page.data.busy).toBe(false);
  });

  it.each(["actor", "route", "unload"])("%s变化隔离迟到写回执；锁结束前无新POST", async change => {
    const h = await start(), pending = deferred<Data>();
    h.request.mockImplementation((_path, options) => options?.method === "POST" ? pending.promise : Promise.resolve({ ...result(newRevision, "reviewing", ["rejected"]), docs: [{ ...row(newRevision), id: 812, answers: { name: "当前范围合成答案" }, actions: { reviewStatuses: ["rejected"] } }] }));
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await flush();
    if (change === "actor") h.changeUser(secondUser);
    if (change === "route") h.page.onLoad({ id: "72" });
    if (change === "unload") h.page.onUnload();
    else await h.page.onShow();
    await h.page.decide(event()); expect(h.posts()).toHaveLength(1); expect(h.reads()).toHaveLength(1);
    const patchCount = h.patches.length;
    pending.resolve({ application: row(newRevision, "accepted", []) }); await saving;
    expect(h.page.data.message).not.toContain("已录用"); expect(h.posts()).toHaveLength(1);
    if (change === "unload") { expect(h.reads()).toHaveLength(1); expect(h.page.data.docs).toEqual([]); expect(h.patches).toHaveLength(patchCount); expect(h.listeners.size).toBe(0); }
    else { expect(h.reads()).toHaveLength(2); expect(h.page.data.docs[0].id).toBe(812); expect(h.page.data.docs[0].answers).toEqual({ name: "当前范围合成答案" });
      expect(h.reads()[1][0]).toContain("/api/miniapp/staff/" + (change === "route" ? "72" : "71") + "?"); }
  });

  it("账号切换后再回原账号也不显示旧操作的成功提示或保留原备注", async () => {
    const h = await start(), pending = deferred<Data>();
    h.page.field(event("feedbackDraft", "切换前合成备注"));
    h.request.mockImplementation((_path, options) => options?.method === "POST" ? pending.promise : Promise.resolve(result()));
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await flush();
    h.changeUser(secondUser); h.changeUser(firstUser); await h.page.onShow();
    expect(h.page.data.busy).toBe(true); pending.resolve({ application: row(newRevision, "accepted", []) }); await saving;
    expect(h.page.data.message).toBe(""); expect(h.page.data.docs[0].feedbackDraft).toBe("合成已有反馈"); expect(h.posts()).toHaveLength(1);
  });

  it.each(["hide", "actor", "route", "unload"])("%s后旧GET返回不能重新显示私有答案或旧actions", async change => {
    const h = harness(), pending = deferred<Data>(); h.request.mockReturnValueOnce(pending.promise);
    const reading = h.page.load();
    if (change === "hide") h.page.onHide();
    if (change === "actor") h.changeUser(secondUser);
    if (change === "route") h.page.onLoad({ id: "72" });
    if (change === "unload") h.page.onUnload();
    const patchCount = h.patches.length; pending.resolve(result()); await reading;
    expect(h.page.data.docs).toEqual([]); expect(h.patches).toHaveLength(patchCount); expect(h.posts()).toHaveLength(0);
  });

  it.each([409, undefined])("保存失败status=%s与刷新弱网后禁动作；显式GET重试在同revision恢复备注并重新取能力", async status => {
    const h = await start(), pending = deferred<Data>(), refresh = deferred<Data>();
    h.page.field(event("feedbackDraft", "合成未保存备注")); h.page.field(event("decisionIndex", "1"));
    h.request.mockImplementation((_path, options) => options?.method === "POST" ? pending.promise : refresh.promise);
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await flush();
    pending.reject(failure(status ? "合成revision冲突" : "合成网络中断", status)); await flush();
    expect(h.reads()).toHaveLength(2); refresh.reject(failure("合成刷新失败")); await saving;
    expect(h.page.data.docs).toEqual([]); expect(h.page.data.error).toBe("合成刷新失败"); expect(h.page.data.loading).toBe(false);
    await h.page.decide(event()); expect(h.posts()).toHaveLength(1); expect(h.wx.showModal).toHaveBeenCalledTimes(1);
    h.request.mockResolvedValueOnce(result(oldRevision, "reviewing", ["accepted", "returned"])); await h.page.retry();
    expect(h.page.data.docs[0].feedbackDraft).toBe("合成未保存备注"); expect(h.page.data.docs[0].decisionIndex).toBe(0);
    h.request.mockImplementation(async (_path, options) => options?.method === "POST" ? { application: row(newRevision, "accepted", []) } : result(newRevision, "accepted", []));
    const retry = h.page.decide(event()); h.modals[1].success({ confirm: true }); await retry;
    expect(h.posts()).toHaveLength(2); expect(h.posts()[1][1]?.data).toEqual({ action: "review", id: 811, revision: oldRevision, status: "accepted", feedback: "合成未保存备注" });
    expect(h.page.data.docs[0].allowed).toEqual([]);
  });

  it("冲突后GET发现revision已变，不将旧备注附到新申请", async () => {
    const h = await start(); h.page.field(event("feedbackDraft", "过期合成备注"));
    h.request.mockImplementation(async (_path, options) => { if (options?.method === "POST") throw failure("合成冲突", 409); return { ...result(newRevision), docs: [{ ...row(newRevision), feedback: "合成新服务端反馈" }] }; });
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await saving;
    expect(h.page.data.docs[0].updatedAt).toBe(newRevision); expect(h.page.data.docs[0].feedbackDraft).toBe("合成新服务端反馈"); expect(h.posts()).toHaveLength(1);
  });

  it.each([401, 403])("保存与刷新status=%s时清私有资料/备注；恢复权限必须显式重新GET", async status => {
    const h = await start(); h.page.field(event("feedbackDraft", "无权后必须清除的合成备注"));
    h.request.mockRejectedValue(failure("合成权限已撤销", status));
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await saving;
    expect(h.page.data.docs).toEqual([]); expect(h.page.data.total).toBe(0); expect(h.page.data.error).toBe("合成权限已撤销");
    await h.page.decide(event()); expect(h.posts()).toHaveLength(1);
    h.request.mockResolvedValue(result()); await h.page.retry();
    expect(h.page.data.docs[0].feedbackDraft).toBe("合成已有反馈"); expect(h.page.data.docs[0].allowed).toHaveLength(2); expect(h.posts()).toHaveLength(1);
  });

  it("保存成功但读刷新失败仍禁动作；重试取到撤权后的空能力不会发第二次POST", async () => {
    const h = await start();
    h.request.mockImplementation(async (_path, options) => { if (options?.method === "POST") return { application: row(newRevision, "accepted", []) }; throw failure("合成读取弱网"); });
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await saving;
    expect(h.page.data.message).toContain("已录用"); expect(h.page.data.error).toBe("合成读取弱网"); expect(h.page.data.docs).toEqual([]);
    await h.page.decide(event()); expect(h.posts()).toHaveLength(1);
    h.request.mockResolvedValue(result(newRevision, "accepted", [])); await h.page.retry();
    h.page.field(event("feedbackDraft", "合成禁止修改")); await h.page.decide(event());
    expect(h.page.data.docs[0].feedbackDraft).toBe("合成已有反馈"); expect(h.posts()).toHaveLength(1);
  });

  it("没有真实匹配回执的200不展示成功，仍只刷新读取而不自动补发", async () => {
    const h = await start(); h.request.mockImplementation(async (_path, options) => options?.method === "POST" ? { application: { id: 999, status: "accepted" } } : result(newRevision, "accepted", []));
    const saving = h.page.decide(event()); h.modals[0].success({ confirm: true }); await saving;
    expect(h.page.data.message).toContain("暂不可确认"); expect(h.page.data.message).not.toContain("已保存"); expect(h.posts()).toHaveLength(1); expect(h.reads()).toHaveLength(2);
  });

  it("重构后的审核界面保持原输入、决定、加载锁与分页合同", () => {
    const current = readFileSync("miniprogram/src/pages/staff-review/index.wxml", "utf8");
    expect(createHash("sha256").update(frozen).digest("hex")).toBe("6765c720c65245f90e356ef1bf2886b05ce39ce0a7049b7701f41b7dde4aeebe");
    expect(createHash("sha256").update(frozenWXML).digest("hex")).toBe("92dc5e04a8d18118ada86823df5db28644fb439755f04c4da32b2823e0527c6f");
    const interactiveContract = (source: string) => [...source.matchAll(/<(?:button|input|textarea|picker)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)].map(match => {
      const attributes = Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(item => [item[1], item[2]]));
      return Object.fromEntries(Object.entries(attributes).filter(([key]) => /^(?:bind|data-)/.test(key) || ["disabled", "loading", "value", "range", "range-key", "maxlength", "wx:if", "wx:else"].includes(key)));
    });
    const currentContract = interactiveContract(current);
    expect(currentContract.filter(control => control.bindtap === "toggleRecord")).toEqual([
      { bindtap: "toggleRecord", "data-id": "{{item.id}}", disabled: "{{busy}}" },
    ]);
    expect(currentContract.filter(control => control.bindtap !== "toggleRecord")).toEqual(interactiveContract(frozenWXML));
    expect(current).toContain('<view wx:if="{{expandedId === item.id}}" class="record-detail">');
    for (const binding of ['data="{{loading,error,needsLogin}}"', 'wx:if="{{!loading && !error && !needsLogin}}"', 'wx:for="{{docs}}"', 'wx:for="{{item.rows}}"', 'wx:if="{{item.allowed.length}}"', 'range="{{item.allowed}}"', 'value="{{item.feedbackDraft}}"', '{{answer.answer}}', 'wx:if="{{pages > 1}}"', 'disabled="{{busy || page <= 1}}"', 'disabled="{{busy || page >= pages}}"']) expect(current).toContain(binding);
  });
});
