/* eslint-disable @typescript-eslint/no-explicit-any -- WeChat Page definitions are dynamic JavaScript objects. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

type Page = { data: Record<string, any>; setData(data: Record<string, unknown>): void; [key: string]: any };
const require = createRequire(import.meta.url);

function loadPage(file: string, modules: Record<string, unknown>, wx: Record<string, unknown>) {
  let page!: Page;
  runInNewContext(readFileSync(file, "utf8"), { Page: (value: Page) => { page = value; }, require: (name: string) => modules[name], wx, setTimeout, clearTimeout });
  // Minimal WeChat setData with "a.b" paths.
  page.setData = values => {
    for (const [key, value] of Object.entries(values)) {
      const parts = key.split(".");
      let target = page.data;
      for (const part of parts.slice(0, -1)) target = target[part];
      target[parts.at(-1)!] = value;
    }
  };
  return page;
}
function deferred<T = unknown>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const tap = (target: string, archived: boolean) => ({ currentTarget: { dataset: { target, archived } } });
const archiveModule = () => {
  // Real validation and list helper; only the network call is replaced.
  const real = require("../miniprogram/src/lib/archive.js") as { valid: (value: unknown) => boolean; mark: (...args: unknown[]) => unknown[] };
  return { valid: real.valid, mark: real.mark, set: vi.fn() };
};

it("archive.js 只发送合法目标与明确布尔值", async () => {
  const post = vi.fn(async () => ({ target: "staff:1", archived: true }));
  const modules = { "./v2": { post } };
  const source = readFileSync("miniprogram/src/lib/archive.js", "utf8");
  const module = { exports: {} as any };
  runInNewContext(source, { module, require: (name: string) => (modules as any)[name] });
  const archive = module.exports;
  for (const target of ["staff:1", "teamJoin:2", "teamEstablishment:3", "communityOfficer:4", "club:5", "community:6"]) expect(archive.valid(target)).toBe(true);
  for (const target of ["staff:0", "signup:1", "club:abc", "", null, "club:1 "]) expect(archive.valid(target)).toBe(false);
  await expect(archive.set("signup:1", true)).rejects.toThrow();
  await expect(archive.set("staff:1", "true")).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
  await archive.set("staff:1", true);
  expect(post).toHaveBeenCalledWith("me/archive", { target: "staff:1", archived: true });
});

function recordsPage(get: ReturnType<typeof vi.fn>) {
  let user: any = { id: 1, affiliation: "tsinghua" };
  const listeners: ((value: unknown) => void)[] = [];
  let credential = "jwt-1";
  const session = { user: () => user, token: () => (user ? credential : ""), campus: () => true, subscribe: (fn: (value: unknown) => void) => { listeners.push(fn); return () => {}; } };
  const v2 = require("../miniprogram/src/lib/v2.js");
  const archive = archiveModule();
  const toast = vi.fn();
  const page = loadPage("miniprogram/src/pages/records/index.js", {
    "../../lib/theme": { page: (value: Page) => value }, "../../lib/session": session, "../../lib/v2": { ...v2, get },
    "../../lib/archive": archive, "../../lib/navigation": { go: vi.fn(), login: vi.fn() }, "../../lib/page": { actions: {} },
  }, { setNavigationBarTitle: vi.fn(), showToast: toast, stopPullDownRefresh: vi.fn() });
  // session.refreshUser / login / logout all notify subscribers with the current user.
  const emit = (next: any) => { user = next; listeners.forEach(fn => fn(next)); };
  // A new login issues a new JWT even for the same account.
  const relogin = (next: any) => { credential = `jwt-${Math.random()}`; emit(next); };
  return { page, archive, toast, emit, relogin };
}
const item = (key: string, title: string, archived: boolean) => ({ key, kind: key.split(":")[0], categoryLabel: "申请", title, status: "pending", statusLabel: "待审核", tone: "info",
  href: "/join", webOnly: false, updatedAt: "2026-11-01T00:00:00Z", next: "", steps: [], archived });
const pageOf = (docs: unknown[], page: number, hasNextPage: boolean) => ({ docs, page, totalDocs: 3, totalPages: 2, hasNextPage });

it("全部记录页：防重复点击、成功只更新当前行、失败回滚", async () => {
  const get = vi.fn(async () => pageOf([item("staff:1", "甲", true), item("teamJoin:2", "乙", false)], 1, true));
  const { page, archive, toast } = recordsPage(get);
  page.onLoad({ mode: "applications" }); page.onShow();
  await vi.waitFor(() => expect(page.data.docs).toHaveLength(2));
  expect(get).toHaveBeenCalledWith("me/applications", { page: 1, limit: 20 }, { required: true });
  const first = deferred<any>();
  archive.set.mockReturnValueOnce(first.promise);
  const pending = page.setArchive(tap("staff:1", true));
  await page.setArchive(tap("staff:1", true));
  await page.setArchive(tap("teamJoin:2", false));
  expect(archive.set).toHaveBeenCalledTimes(1);
  expect(archive.set).toHaveBeenCalledWith("staff:1", false);
  first.resolve({ target: "staff:1", archived: false });
  await pending;
  expect(page.data.docs[0]).toMatchObject({ archived: false, archiving: false });
  archive.set.mockRejectedValueOnce(new Error("内容已更新或已处理，请刷新后重试"));
  await page.setArchive(tap("teamJoin:2", false));
  expect(page.data.docs[1]).toMatchObject({ archived: false, archiving: false });
  expect(toast).toHaveBeenLastCalledWith({ title: "内容已更新或已处理，请刷新后重试", icon: "none" });
});

it("全部记录页：归档进行中加载下一页或离页，成功结果仍应用到当前行且不锁死", async () => {
  const get = vi.fn(async (_path: string, query: { page: number }) => query.page === 1
    ? pageOf([item("staff:1", "甲", false), item("teamJoin:2", "乙", false)], 1, true) : pageOf([item("communityOfficer:3", "丙", true)], 2, false));
  const { page, archive } = recordsPage(get);
  page.onLoad({ mode: "applications" }); page.onShow();
  await vi.waitFor(() => expect(page.data.docs).toHaveLength(2));
  const write = deferred<any>();
  archive.set.mockReturnValueOnce(write.promise);
  const pending = page.setArchive(tap("staff:1", false));
  await page.onReachBottom();
  expect(page.data.docs).toHaveLength(3);
  expect(page.data.docs[0].archiving).toBe(true);
  write.resolve({ target: "staff:1", archived: true });
  await pending;
  expect(page.data.docs[0]).toMatchObject({ archived: true, archiving: false });
  // Lock released: the next write proceeds.
  archive.set.mockResolvedValueOnce({ target: "communityOfficer:3", archived: false });
  const hidden = deferred<any>();
  archive.set.mockReset(); archive.set.mockReturnValueOnce(hidden.promise);
  const away = page.setArchive(tap("communityOfficer:3", true));
  page.onHide();
  hidden.resolve({ target: "communityOfficer:3", archived: false });
  await away;
  expect(page.data.docs[2]).toMatchObject({ archived: false, archiving: false });
});

it("全部记录页：同账号 refreshUser 不清空列表；换账号丢弃旧写入且旧写入不会清除新账号的写锁", async () => {
  const get = vi.fn(async () => pageOf([item("staff:1", "甲", false), item("teamJoin:2", "乙", false)], 1, false));
  const { page, archive, emit } = recordsPage(get);
  page.onLoad({ mode: "applications" }); page.onShow();
  await vi.waitFor(() => expect(page.data.docs).toHaveLength(2));
  emit({ id: 1, affiliation: "tsinghua", name: "资料已刷新" });
  expect(page.data.docs).toHaveLength(2);
  expect(get).toHaveBeenCalledTimes(1);

  const old = deferred<any>();
  archive.set.mockReturnValueOnce(old.promise);
  const oldWrite = page.setArchive(tap("staff:1", false));
  emit({ id: 2, affiliation: "tsinghua" });
  await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(page.data.docs).toHaveLength(2));
  expect(page.data.docs[0].archiving).toBeFalsy();
  const fresh = deferred<any>();
  archive.set.mockReturnValueOnce(fresh.promise);
  const newWrite = page.setArchive(tap("teamJoin:2", false));
  old.resolve({ target: "staff:1", archived: true });
  await oldWrite;
  expect(page.data.docs[0]).toMatchObject({ archived: false });
  // The new account's lock survives the old write's completion.
  await page.setArchive(tap("staff:1", false));
  expect(archive.set).toHaveBeenCalledTimes(2);
  fresh.resolve({ target: "teamJoin:2", archived: true });
  await newWrite;
  expect(page.data.docs[1]).toMatchObject({ archived: true, archiving: false });
});

it("全部记录页：先读后写，写先结束，读后结束——旧读取不覆盖已确认的归档", async () => {
  let call = 0;
  const reads = [deferred<any>()];
  const get = vi.fn(async () => (call++ === 0 ? pageOf([item("staff:1", "甲", false), item("teamJoin:2", "乙", false)], 1, false) : reads[0].promise));
  const { page, archive } = recordsPage(get);
  page.onLoad({ mode: "applications" }); page.onShow();
  await vi.waitFor(() => expect(page.data.docs).toHaveLength(2));
  // Read starts first (pull-to-refresh) and stays pending.
  const read = page.load();
  // Write starts after it, and finishes first.
  archive.set.mockResolvedValueOnce({ target: "staff:1", archived: true });
  await page.setArchive(tap("staff:1", false));
  expect(page.data.docs[0]).toMatchObject({ archived: true, archiving: false });
  expect(page._write).toBeNull();
  // The older read now returns its pre-write snapshot.
  reads[0].resolve(pageOf([item("staff:1", "甲", false), item("teamJoin:2", "乙", false)], 1, false));
  await read;
  expect(page.data.docs[0]).toMatchObject({ archived: true, archiving: false });
  expect(page.data.docs[1]).toMatchObject({ archived: false });
  // A read that starts after the write trusts the server again (e.g. restored elsewhere).
  get.mockResolvedValueOnce(pageOf([item("staff:1", "甲", false), item("teamJoin:2", "乙", false)], 1, false));
  await page.load();
  expect(page.data.docs[0].archived).toBe(false);
});

it("全部记录页：卸载后丢弃结果", async () => {
  const get = vi.fn(async () => pageOf([item("staff:1", "甲", false)], 1, false));
  const { page, archive } = recordsPage(get);
  page.onLoad({ mode: "applications" }); page.onShow();
  await vi.waitFor(() => expect(page.data.docs).toHaveLength(1));
  const write = deferred<any>();
  archive.set.mockReturnValueOnce(write.promise);
  const pending = page.setArchive(tap("staff:1", false));
  page.onUnload();
  write.resolve({ target: "staff:1", archived: true });
  await pending;
  expect(page.data.docs[0].archived).toBe(false);
});

it("全部报名投影：归档目标来自本人回执，活动撤下仍可恢复", () => {
  const v2 = require("../miniprogram/src/lib/v2.js");
  const removed = v2.receipt({ key: "signup:9", eventTitle: "已撤下", event: null, submittedAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", href: "/account", editable: false, archiveTarget: "club:4", archived: true });
  expect(removed).toMatchObject({ archiveTarget: "club:4", archived: true, page: "", statusLabel: "活动已撤下" });
  const app = v2.application({ key: "communityOfficer:3", categoryLabel: "社群管理员申请", title: "丙", statusLabel: "待审核", tone: "info", next: "", href: "/community/apply", webOnly: false, steps: [], archived: false });
  expect(app).toMatchObject({ archiveTarget: "communityOfficer:3", archived: false, archiving: false });
});

function accountPage() {
  let user: any = { id: 1, affiliation: "tsinghua", roles: [], name: "合成" };
  let credential = "jwt-1";
  const session = { user: () => user, token: () => (user ? credential : ""), campus: (value: unknown = user) => Boolean(value), refreshUser: vi.fn() };
  const archive = archiveModule();
  const v2 = require("../miniprogram/src/lib/v2.js");
  const page = loadPage("miniprogram/src/pages/account/index.js", {
    "../../lib/theme": { page: (value: Page) => value }, "../../lib/session": session, "../../lib/http": { request: vi.fn() },
    "../../lib/v2": v2, "../../lib/navigation": { login: vi.fn(), go: vi.fn() }, "../../config": { version: "test" },
    "../../lib/page": { actions: {} }, "../../lib/archive": archive,
  }, { showToast: vi.fn() });
  page.setData({ user, me: { counts: { archivedUpcoming: 0, archivedApplications: 0 },
    upcoming: [{ key: "club:1", archiveTarget: "club:1", archived: false, archiving: false }],
    applications: [{ key: "staff:1", archiveTarget: "staff:1", archived: false, archiving: false }, { key: "staff:2", archiveTarget: "staff:2", archived: false, archiving: false }] } });
  return { page, archive, setUser: (next: any) => { user = next; }, relogin: (next: any) => { credential = `jwt-${Math.random()}`; user = next; } };
}

it("我的页：防重复点击；成功后立即从总览隐藏并重新读取", async () => {
  const { page, archive } = accountPage();
  page.refresh = vi.fn(async () => {});
  archive.set.mockResolvedValueOnce({ target: "club:1", archived: true });
  await Promise.all([page.setArchive(tap("club:1", false)), page.setArchive(tap("club:1", false))]);
  expect(archive.set).toHaveBeenCalledTimes(1);
  expect(archive.set).toHaveBeenCalledWith("club:1", true);
  expect(page.data.me.upcoming).toEqual([]);
  expect(page.data.me.counts.archivedUpcoming).toBe(1);
  expect(page.refresh).toHaveBeenCalledTimes(1);
});

it("我的页：归档中下拉刷新（且刷新失败）不丢弃写入、不锁死按钮", async () => {
  const { page, archive } = accountPage();
  const write = deferred<any>();
  archive.set.mockReturnValueOnce(write.promise);
  const pending = page.setArchive(tap("staff:1", false));
  // A pull-to-refresh bumps the read ticket while the write is in flight.
  page._ticket = (page._ticket || 0) + 5;
  page.refresh = vi.fn(async () => { throw new Error("刷新失败"); });
  write.resolve({ target: "staff:1", archived: true });
  await pending.catch(() => {});
  expect(page.data.me.applications.map((row: any) => row.key)).toEqual(["staff:2"]);
  expect(page._write).toBeNull();
  archive.set.mockResolvedValueOnce({ target: "staff:2", archived: true });
  page.refresh = vi.fn(async () => {});
  await page.setArchive(tap("staff:2", false));
  expect(archive.set).toHaveBeenCalledTimes(2);
});

it("我的页：刷新时进行中的归档行保持锁定；失败恢复按钮；换账号丢弃结果", async () => {
  const { page, archive, setUser } = accountPage();
  const write = deferred<any>();
  archive.set.mockReturnValueOnce(write.promise);
  const pending = page.setArchive(tap("staff:1", false));
  expect(page.pendingWrite([{ archiveTarget: "staff:1", archiving: false }])[0].archiving).toBe(true);
  write.reject(new Error("连接失败，请检查网络后重试"));
  await pending;
  expect(page.data.me.applications[0]).toMatchObject({ archiving: false, archived: false });
  expect(page._write).toBeNull();

  const late = deferred<any>();
  archive.set.mockReturnValueOnce(late.promise);
  page.refresh = vi.fn(async () => {});
  const switched = page.setArchive(tap("staff:2", false));
  setUser({ id: 2, affiliation: "tsinghua", roles: [], name: "另一人" });
  late.resolve({ target: "staff:2", archived: true });
  await switched;
  expect(page.refresh).not.toHaveBeenCalled();
  expect(page._write).toBeNull();
});

it("我的页：先读后写，写先结束，读后结束——旧刷新被作废，已归档行不回到总览", async () => {
  const pending = deferred<any>();
  let first = true, meReads = 0;
  const viewer = { capabilities: { communities: [] } };
  const app = (key: string) => ({ key, kind: "staff", categoryLabel: "骨干招新", title: key, status: "submitted", statusLabel: "已提交", tone: "info", href: "/join/staff", webOnly: false, updatedAt: "2026-11-01T00:00:00Z", next: "", steps: [], archived: false });
  const meWith = (keys: string[]) => ({ todo: [], upcoming: [], applications: keys.map(app), memberships: [], viewer, counts: { signups: 0, applications: 2, archivedApplications: 2 - keys.length, archivedUpcoming: 0 } });
  const request = vi.fn(async (url: string) => {
    if (url === "/api/users/me") { if (first) { first = false; return pending.promise; } return { user: { id: 1, affiliation: "tsinghua", roles: [], name: "合成" } }; }
    // First overview read (the post-write refresh) omits staff:1; any later one would be the stale pre-write snapshot.
    if (url.startsWith("/api/v2/me?") || url === "/api/v2/me") return meWith(meReads++ === 0 ? ["staff:2"] : ["staff:1", "staff:2"]);
    if (url.startsWith("/api/v2/manage")) return { queues: [] };
    return { docs: [], hasNextPage: false };
  });
  const session = { user: () => ({ id: 1, affiliation: "tsinghua", roles: [], name: "合成" }), token: () => "jwt-1", campus: () => true, refreshUser: vi.fn() };
  const archive = archiveModule();
  const page = loadPage("miniprogram/src/pages/account/index.js", {
    "../../lib/theme": { page: (value: Page) => value }, "../../lib/session": session, "../../lib/http": { request },
    "../../lib/v2": { ...require("../miniprogram/src/lib/v2.js"), get: (path: string) => request("/api/v2/" + path) },
    "../../lib/navigation": { login: vi.fn(), go: vi.fn() }, "../../config": { version: "test" }, "../../lib/page": { actions: {} }, "../../lib/archive": archive,
  }, { showToast: vi.fn() });
  page.setData({ user: session.user(), me: { counts: { archivedUpcoming: 0, archivedApplications: 0 }, upcoming: [],
    applications: [{ key: "staff:1", archiveTarget: "staff:1", archived: false, archiving: false }, { key: "staff:2", archiveTarget: "staff:2", archived: false, archiving: false }] } });
  const oldRead = page.refresh();
  archive.set.mockResolvedValueOnce({ target: "staff:1", archived: true });
  await page.setArchive(tap("staff:1", false));
  expect(page.data.me.applications.map((row: any) => row.key)).toEqual(["staff:2"]);
  // The pre-write refresh resolves last with a snapshot that still lists staff:1.
  pending.resolve({ user: { id: 1, affiliation: "tsinghua", roles: [], name: "合成" } });
  await oldRead;
  expect(page.data.me.applications.map((row: any) => row.key)).toEqual(["staff:2"]);
  expect(meReads).toBe(1);
  expect(page._write).toBeNull();
});

it("会话边界：A 退出后重新登录 A，或经 B 再登录 A，旧会话的归档响应都不写回、不清新锁", async () => {
  const get = vi.fn(async () => pageOf([item("staff:1", "甲", false), item("teamJoin:2", "乙", false)], 1, false));
  const { page, archive, emit, relogin } = recordsPage(get);
  const A = { id: 1, affiliation: "tsinghua" }, B = { id: 2, affiliation: "tsinghua" };
  page.onLoad({ mode: "applications" }); page.onShow();
  await vi.waitFor(() => expect(page.data.docs).toHaveLength(2));
  for (const path of [[null, A], [B, A]]) {
    const old = deferred<any>();
    archive.set.mockReturnValueOnce(old.promise);
    const oldWrite = page.setArchive(tap("staff:1", false));
    emit(path[0]);
    relogin(path[1]);
    await vi.waitFor(() => expect(page.data.docs).toHaveLength(2));
    const fresh = deferred<any>();
    archive.set.mockReturnValueOnce(fresh.promise);
    const newWrite = page.setArchive(tap("teamJoin:2", false));
    old.resolve({ target: "staff:1", archived: true });
    await oldWrite;
    expect(page.data.docs[0]).toMatchObject({ archived: false });
    expect(page._write).toMatchObject({ target: "teamJoin:2" });
    fresh.resolve({ target: "teamJoin:2", archived: false });
    await newWrite;
    expect(page._write).toBeNull();
  }

  // Account page: re-login as A elsewhere (new JWT), page still shows A.
  const account = accountPage();
  const realRefresh = account.page.refresh;
  account.page.refresh = vi.fn(async () => {});
  const stale = deferred<any>();
  account.archive.set.mockReturnValueOnce(stale.promise);
  const staleWrite = account.page.setArchive(tap("staff:1", false));
  account.relogin({ id: 1, affiliation: "tsinghua", roles: [], name: "合成" });
  stale.resolve({ target: "staff:1", archived: true });
  await staleWrite;
  expect(account.page.data.me.applications.map((row: any) => row.key)).toEqual(["staff:1", "staff:2"]);
  expect(account.page.refresh).not.toHaveBeenCalled();
  // A→退出→A through the page refresh also ends the old write.
  const second = deferred<any>();
  account.archive.set.mockReturnValueOnce(second.promise);
  const secondWrite = account.page.setArchive(tap("staff:2", false));
  account.setUser(null);
  // Real refresh with no session (logout elsewhere, then the 我的 tab is shown).
  await realRefresh.call(account.page);
  expect(account.page._write).toBeNull();
  account.setUser({ id: 1, affiliation: "tsinghua", roles: [], name: "合成" });
  second.resolve({ target: "staff:2", archived: true });
  await secondWrite;
  expect(account.page.data.me).toBeNull();
});

it("归档按钮使用 catchtap，不冒泡到卡片详情；账户与记录页入口指向 records", () => {
  const files = ["miniprogram/src/templates/v2.wxml", "miniprogram/src/pages/records/index.wxml"];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const buttons = [...text.matchAll(/<button class="zj-archive"[^>]*>/g)].map(match => match[0]);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) { expect(button).toContain('catchtap="setArchive"'); expect(button).not.toContain("bindtap"); expect(button).toContain('disabled="{{item.archiving}}"'); }
  }
  const account = readFileSync("miniprogram/src/pages/account/index.wxml", "utf8");
  expect(account).toContain("page: 'records', params: signupRecordParams");
  expect(account).toContain("page: 'records', params: applicationRecordParams");
  expect(JSON.parse(readFileSync("miniprogram/src/app.json", "utf8")).pages).toContain("pages/records/index");
  const navigation = readFileSync("miniprogram/src/lib/navigation.js", "utf8");
  expect(navigation).toContain("go('records'");
});
