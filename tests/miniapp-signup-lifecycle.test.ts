import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { normalizeSignup, type Answers, type SignupForm } from '../src/lib/signup-schema';

// Real native Page handlers, synthetic sessions and deferred API promises only.
// MINIAPP_LIFECYCLE_REF optionally reproduces a frozen source with read-only git.
const sourcePath = 'miniprogram/src/pages/signup/index.js';
const sourceRef = process.env.MINIAPP_LIFECYCLE_REF;
if (sourceRef && !/^[a-f0-9]{7,40}$/i.test(sourceRef)) throw new Error('MINIAPP_LIFECYCLE_REF must be a commit SHA');
const pageSource = sourceRef
  ? execFileSync('git', ['show', sourceRef + ':' + sourcePath], { encoding: 'utf8', maxBuffer: 1024 * 1024 })
  : readFileSync(sourcePath, 'utf8');

type Kind = 'events' | 'community-posts' | 'staff';
type Route = { kind: Kind; id: string };
type User = { id: number; name: string };
type Options = { method?: string; required?: boolean; questionnaire?: boolean; data?: Record<string, unknown> };
type Receipt = {
  id: number; questions: SignupForm['questions']; answers: Answers;
  createdAt: string; updatedAt: string; formVersion: string; status?: string;
};
type Info = Record<string, unknown> & {
  title: string; form: SignupForm; version: string; state: string; signup?: Receipt | null; application?: Receipt | null;
};
type Page = {
  data: Record<string, unknown> & {
    loading: boolean; busy: boolean; error: string; message: string; needsLogin: boolean;
    info: Info | null; receipt: Receipt | null; answers: Answers; questions: unknown[];
    review: boolean; responseEditing: boolean; reviewRows: unknown[]; entries: unknown[];
  };
  setData(value: Record<string, unknown>): void;
  onLoad(options: Route): void; onShow(): Promise<void> | void; onHide(): void; onUnload(): void;
  load(): Promise<void>; retry(): Promise<void> | void; submit(): Promise<void>;
  editAnswers(): void; answer(event: { currentTarget: { dataset: { id: string } }; detail: { value: string } }): void;
  answerNext(): void;
};
const actorA: User = { id: 901, name: '合成测试甲' };
const actorB: User = { id: 902, name: '合成测试乙' };
const modes: { label: string; kind: Kind }[] = [
  { label: '活动报名', kind: 'events' }, { label: '社区活动报名', kind: 'community-posts' }, { label: '骨干申请', kind: 'staff' },
];
const form = normalizeSignup({ enabled: true, questions: [
  { id: 'note', label: '合成测试答案', type: 'text', required: true, options: [] },
] });
const receipt = (id = 811, note = '合成已保存答案'): Receipt => ({
  id, status: 'returned', createdAt: '2026-10-12T01:00:00Z', updatedAt: '2026-10-12T02:00:00Z',
  formVersion: 'synthetic-v1', questions: form.questions, answers: { note },
});
const response = (route: Route, marker: string, saved: Receipt | null = receipt()): Info => ({
  title: '合成' + marker, form, version: 'synthetic-v1',
  state: route.kind === 'staff' ? '申请开放' : '报名开放',
  canManage: false, canViewSignups: false, loggedIn: true,
  ...(route.kind === 'staff' ? { application: saved, actions: { submit: true, edit: true, withdraw: true } } : { signup: saved }),
});
const readPath = (route: Route) => route.kind === 'staff'
  ? '/api/miniapp/staff/' + route.id : '/api/activities/' + route.kind + '/' + route.id + '/signup';
const writePath = (route: Route) => route.kind === 'staff'
  ? '/api/staff/batches/' + route.id + '/application' : readPath(route);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function harness(route: Route) {
  let page!: Page;
  let user: User | null = actorA;
  const listeners = new Set<(value: User | null) => void>();
  const request = vi.fn<(path: string, options?: Options) => Promise<Record<string, unknown>>>();
  request.mockRejectedValue(new Error('Unexpected synthetic request'));
  const session = {
    user: () => user,
    subscribe: (listener: (value: User | null) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  const wx = { setNavigationBarTitle: vi.fn(), pageScrollTo: vi.fn(), showToast: vi.fn(), stopPullDownRefresh: vi.fn() };
  const navigation = { login: vi.fn(), back: vi.fn(), go: vi.fn(), content: vi.fn(), website: vi.fn(), copy: vi.fn() };
  const sharedRequire = createRequire(new URL('../miniprogram/src/lib/page.js', import.meta.url));
  const shared = { exports: {} };
  runInNewContext(readFileSync('miniprogram/src/lib/page.js', 'utf8'), {
    module: shared, wx, require: (name: string) => name === './session' ? session : name === './navigation' ? navigation : sharedRequire(name),
  });
  const localRequire = createRequire(new URL('../' + sourcePath, import.meta.url));
  const dependencies: Record<string, unknown> = {
    '../../lib/http': { request }, '../../lib/session': session, '../../lib/page': shared.exports,
    '../../lib/navigation': navigation,
  };
  runInNewContext(pageSource, {
    Page: (value: Page) => { page = value; }, wx,
    require: (name: string) => dependencies[name] ?? localRequire(name),
    setTimeout, clearTimeout,
  });
  page.setData = value => Object.assign(page.data, value);
  page.onLoad(route);
  return {
    page, request, listeners,
    getUser() { return user; },
    changeUser(next: User | null) { user = next; for (const listener of listeners) listener(next); },
  };
}
type Harness = ReturnType<typeof harness>;
const reads = (request: Harness['request']) => request.mock.calls.filter(([, options]) => !options?.method || options.method === 'GET');
const writes = (request: Harness['request']) => request.mock.calls.filter(([, options]) => options?.method && options.method !== 'GET');
function expectVisible(page: Page, title: string, id: number | null = 811) {
  expect(page.data.loading).toBe(false);
  expect(page.data.info?.title).toBe('合成' + title);
  expect(page.data.receipt?.id ?? null).toBe(id);
  expect(page.data.error).toBe('');
  expect(page.data.needsLogin).toBe(false);
}
function expectPrivateCleared(page: Page) {
  expect(page.data.info).toBeNull();
  expect(page.data.receipt).toBeNull();
  expect(page.data.answers).toEqual({});
  expect(page.data.questions).toEqual([]);
  expect(page.data.reviewRows).toEqual([]);
  expect(page.data.entries).toEqual([]);
}
async function loaded(route: Route, saved: Receipt | null = receipt()) {
  const result = harness(route);
  result.request.mockResolvedValueOnce(response(route, '初始回执', saved));
  await result.page.onShow();
  expectVisible(result.page, '初始回执', saved?.id ?? null);
  return result;
}
function draft(page: Page) {
  if (page.data.receipt) page.editAnswers();
  page.answer({ currentTarget: { dataset: { id: 'note' } }, detail: { value: '合成未提交草稿' } });
  page.answerNext();
  expect(page.data.review).toBe(true);
}

describe.each(modes)('$label 真实 Page 加载生命周期', ({ kind }) => {
  const route: Route = { kind, id: '55' };

  it('首次 GET 被 hide 打断后 show 重新读取，旧响应不会替换最新回执', async () => {
    const { page, request } = harness(route);
    const old = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => old.promise).mockResolvedValueOnce(response(route, '重新显示', receipt(822)));
    const first = page.onShow();
    expect(page.data.loading).toBe(true);
    page.onHide();
    expect(page.data.loading).toBe(false);
    await page.onShow();
    expect(reads(request).map(([path]) => path)).toEqual([readPath(route), readPath(route)]);
    expectVisible(page, '重新显示', 822);
    old.resolve(response(route, '旧迟到回执'));
    await first;
    expectVisible(page, '重新显示', 822);
  });

  it('已有回执 retry 的 GET 被 hide 打断后 show 再读，最终不会卡 loading=true/info=null', async () => {
    const { page, request } = await loaded(route);
    const old = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => old.promise).mockResolvedValueOnce(response(route, '刷新完成', receipt(823)));
    const reloading = page.retry();
    expect(page.data.loading).toBe(true);
    expect(page.data.info).toBeNull();
    page.onHide();
    await page.onShow();
    old.resolve(response(route, '旧刷新'));
    await reloading;
    await flush();
    const visible = JSON.stringify({ loading: page.data.loading, info: page.data.info?.title ?? null, receipt: page.data.receipt?.id ?? null, error: page.data.error });
    expect(reads(request).map(([path]) => path), 'Visible state after hide/show: ' + visible).toEqual([readPath(route), readPath(route), readPath(route)]);
    expectVisible(page, '刷新完成', 823);
  });

  it.each(['success', 'error'] as const)('较旧 GET 的迟到 %s 不能覆盖后发请求的可见状态', async result => {
    const { page, request } = harness(route);
    const old = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => old.promise).mockResolvedValueOnce(response(route, '后发结果', receipt(824)));
    const first = page.onShow();
    await page.load();
    expectVisible(page, '后发结果', 824);
    if (result === 'success') old.resolve(response(route, '旧成功'));
    else old.reject(new Error('合成旧错误'));
    await first;
    expectVisible(page, '后发结果', 824);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('中断后新 GET 失败可见且停止加载，显式 retry 返回 Promise 并恢复回执', async () => {
    const { page, request } = await loaded(route);
    const old = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => old.promise).mockRejectedValueOnce(new Error('合成新读取失败'));
    const reloading = page.retry();
    page.onHide();
    await page.onShow();
    expect(page.data.loading).toBe(false);
    expect(page.data.info).toBeNull();
    expect(page.data.receipt).toBeNull();
    expect(page.data.error).toBe('合成新读取失败');
    old.reject(new Error('合成旧读取失败'));
    await reloading;
    await flush();
    expect(page.data.error).toBe('合成新读取失败');
    request.mockResolvedValueOnce(response(route, '重试恢复', receipt(825)));
    const retrying = page.retry();
    expect(retrying).toHaveProperty('then', expect.any(Function));
    await retrying;
    expectVisible(page, '重试恢复', 825);
    expect(reads(request).map(([path]) => path)).toEqual(Array(4).fill(readPath(route)));
  });

  it('logout 清空私有资料，旧 GET 晚到仍显示登录态且不会重复网络读取', async () => {
    const { page, request, changeUser } = await loaded(route);
    draft(page);
    const old = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => old.promise);
    const loading = page.load();
    changeUser(null);
    expectPrivateCleared(page);
    await page.onShow();
    old.resolve(response(route, '退出前私有答案'));
    await loading;
    expectPrivateCleared(page);
    expect(page.data.loading).toBe(false);
    expect(page.data.needsLogin).toBe(true);
    expect(page.data.error).toBe('');
    expect(reads(request).map(([path]) => path)).toEqual([readPath(route), readPath(route)]);
  });

  it('account change 后安全读取新账号，旧账号的迟到错误不覆盖新账号回执', async () => {
    const { page, request, changeUser } = await loaded(route);
    draft(page);
    const old = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => old.promise).mockResolvedValueOnce(response(route, '乙账号回执', receipt(826)));
    const loading = page.load();
    changeUser(actorB);
    expectPrivateCleared(page);
    await page.onShow();
    old.reject(new Error('合成甲账号迟到错误'));
    await loading;
    expectVisible(page, '乙账号回执', 826);
    expect(page.data.answers).toEqual({});
    expect(reads(request).map(([path]) => path)).toEqual(Array(3).fill(readPath(route)));
  });

  it('onLoad 换 route 清空旧草稿并只保留一次监听，旧 route 响应不能污染新 route', async () => {
    const { page, request, listeners } = await loaded(route);
    draft(page);
    const old = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => old.promise);
    const loading = page.load();
    const next: Route = { kind: kind === 'staff' ? 'events' : 'staff', id: '77' };
    page.onLoad(next);
    expectPrivateCleared(page);
    expect(listeners.size).toBe(1);
    request.mockResolvedValueOnce(response(next, '新路由回执', receipt(827)));
    await page.onShow();
    old.resolve(response(route, '旧路由回执'));
    await loading;
    expectVisible(page, '新路由回执', 827);
    expect(reads(request).map(([path]) => path)).toEqual([readPath(route), readPath(route), readPath(next)]);
  });

  it('onUnload 解除监听并使迟到 GET 无效，不恢复旧私有资料或再次读取', async () => {
    const { page, request, listeners } = harness(route);
    const old = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => old.promise);
    const loading = page.onShow();
    page.onUnload();
    expect(listeners.size).toBe(0);
    const destroyedState = JSON.stringify(page.data);
    old.resolve(response(route, '卸载后旧回执'));
    await loading;
    expect(JSON.stringify(page.data)).toBe(destroyedState);
    expect(page.data.loading).toBe(false);
    expect(page.data.info).toBeNull();
    expect(request.mock.calls.map(([path]) => path)).toEqual([readPath(route)]);
  });

  it.each([false, true])('已加载的未提交草稿正常 hide/show 保留，不额外 GET（已存回执=%s）', async existing => {
    const { page, request } = await loaded(route, existing ? receipt() : null);
    draft(page);
    const before = {
      info: page.data.info, receipt: page.data.receipt, answers: page.data.answers,
      reviewRows: page.data.reviewRows, responseEditing: page.data.responseEditing,
    };
    page.onHide();
    await page.onShow();
    expectVisible(page, '初始回执', existing ? 811 : null);
    expect(page.data.answers).toEqual(before.answers);
    expect(page.data.receipt).toEqual(before.receipt);
    expect(page.data.reviewRows).toEqual(before.reviewRows);
    expect(page.data.responseEditing).toBe(before.responseEditing);
    expect(page.data.review).toBe(true);
    expect(request.mock.calls.map(([path]) => path)).toEqual([readPath(route)]);
  });

  it('retry 可等待实际读取结束，而非丢弃 load 的 Promise', async () => {
    const { page, request } = await loaded(route);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const retrying = page.retry();
    expect(retrying).toHaveProperty('then', expect.any(Function));
    expect(page.data.loading).toBe(true);
    pending.resolve(response(route, '可等待重试', receipt(828)));
    await retrying;
    expectVisible(page, '可等待重试', 828);
    expect(request.mock.calls.map(([path]) => path)).toEqual([readPath(route), readPath(route)]);
  });

  it.each(['success', 'error'] as const)('提交中 hide/show 和连续点击不额外 POST；迟到 %s 后通过 GET 对账', async result => {
    const { page, request } = await loaded(route, null);
    draft(page);
    const pending = deferred<Record<string, unknown>>();
    const committed = receipt(829, '合成服务器已保存答案');
    request.mockImplementationOnce(() => pending.promise).mockResolvedValue(response(route, '只读对账', committed));
    const sending = page.submit();
    expect(writes(request)).toHaveLength(1);
    expect(writes(request)[0][0]).toBe(writePath(route));
    expect(writes(request)[0][1]?.method).toBe('POST');
    page.onHide();
    await page.onShow();
    await page.submit();
    expect(page.data.busy).toBe(true);
    expect(writes(request)).toHaveLength(1);
    expect(reads(request)).toHaveLength(1);
    if (result === 'success') pending.resolve(kind === 'staff' ? { application: committed } : { signup: committed });
    else pending.reject(new Error('合成提交结果未确认'));
    await sending;
    await flush();
    expect(page.data.busy).toBe(false);
    // Recovery may automatically perform a GET or expose an explicit retry
    // state. Either path must prevent a second write of the uncertain request.
    await page.submit();
    expect(writes(request)).toHaveLength(1);
    if (reads(request).length === 1) {
      expect(page.data.loading).toBe(false);
      expect(page.data.info).toBeNull();
      expect(page.data.message || page.data.error).not.toBe('');
      await page.retry();
    }
    await flush();
    expectVisible(page, '只读对账', 829);
    expect(page.data.answers).toEqual({});
    expect(page.data.review).toBe(false);
    expect(reads(request).map(([path]) => path)).toEqual([readPath(route), readPath(route)]);
    expect(writes(request)).toHaveLength(1);
  });

  it.each([
    { existing: false, outcome: 'success' },
    { existing: false, outcome: 'error' },
    { existing: true, outcome: 'success' },
    { existing: true, outcome: 'error' },
  ])('后台请求先结束再 show：$outcome，原有回执=$existing，仅 GET 对账并按服务器结果处理草稿', async ({ existing, outcome }) => {
    const original = existing ? receipt() : null;
    const { page, request, getUser } = await loaded(route, original);
    draft(page);
    const pendingWrite = deferred<Record<string, unknown>>();
    const pendingRead = deferred<Record<string, unknown>>();
    const committed: Receipt = {
      ...receipt(existing ? original!.id : 840, '合成服务器确认写入'),
      status: 'submitted', updatedAt: '2026-10-12T03:00:00Z',
    };
    const current = outcome === 'success' ? committed : original;
    request.mockImplementationOnce(() => pendingWrite.promise).mockImplementationOnce((path, options) => {
      expect(path).toBe(readPath(route));
      expect(options?.method ?? 'GET').toBe('GET');
      expect(options?.required).toBe(true);
      expect(getUser()?.id).toBe(actorA.id);
      return pendingRead.promise;
    });
    const sending = page.submit();
    expect(writes(request)).toHaveLength(1);
    expect(writes(request)[0][0]).toBe(writePath(route));
    expect(writes(request)[0][1]?.method).toBe('POST');
    if (existing) expect(writes(request)[0][1]?.data?.action).toBe('edit');
    else expect(writes(request)[0][1]?.data).not.toHaveProperty('action');
    page.onHide();
    await page.submit();
    expect(page.data.busy).toBe(true);
    expect(writes(request)).toHaveLength(1);
    if (outcome === 'success') pendingWrite.resolve(kind === 'staff' ? { application: committed } : { signup: committed });
    else pendingWrite.reject(new Error('合成请求在后台失败'));
    // The write settles while the page is still hidden, before any onShow.
    await sending;
    await flush();
    expect(page.data.busy).toBe(false);
    expect(page.data.loading).toBe(false);
    await page.submit();
    expect(reads(request).map(([path]) => path)).toEqual([readPath(route)]);
    expect(writes(request)).toHaveLength(1);
    const showing = page.onShow();
    expect(page.data.loading).toBe(true);
    expect(page.data.info).toBeNull();
    await page.submit();
    expect(writes(request)).toHaveLength(1);
    pendingRead.resolve(response(route, '后台结束后对账', current));
    await showing;
    expectVisible(page, '后台结束后对账', current?.id ?? null);
    expect(request.mock.calls.map(([path]) => path)).toEqual([readPath(route), writePath(route), readPath(route)]);
    expect(writes(request)).toHaveLength(1);
    if (outcome === 'success') {
      expect(page.data.receipt?.updatedAt).toBe(committed.updatedAt);
      expect(page.data.receipt?.answers).toEqual(committed.answers);
      expect(page.data.answers).toEqual({});
      expect(page.data.responseEditing).toBe(false);
      expect(page.data.review).toBe(false);
    } else {
      expect(page.data.receipt?.answers ?? null).toEqual(original?.answers ?? null);
      expect(page.data.answers).toEqual({ note: '合成未提交草稿' });
      expect(page.data.responseEditing).toBe(existing);
    }
  });

  it.each([false, true])('后台写失败后 GET 确认原记录未变，保留当前账号草稿而不自动再写（已存回执=%s）', async existing => {
    const original = existing ? receipt() : null;
    const { page, request, getUser } = await loaded(route, original);
    draft(page);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise).mockImplementationOnce(async path => {
      expect(path).toBe(readPath(route));
      expect(getUser()?.id).toBe(actorA.id);
      return response(route, '原记录未变', original);
    });
    const sending = page.submit();
    page.onHide();
    await page.onShow();
    await page.submit();
    expect(writes(request)).toHaveLength(1);
    pending.reject(new Error('合成后台写失败'));
    await sending;
    await flush();
    expectVisible(page, '原记录未变', original?.id ?? null);
    expect(page.data.answers).toEqual({ note: '合成未提交草稿' });
    expect(page.data.responseEditing).toBe(existing);
    expect(page.data.receipt?.answers ?? null).toEqual(original?.answers ?? null);
    expect(page.data.busy).toBe(false);
    expect(reads(request).map(([path]) => path)).toEqual([readPath(route), readPath(route)]);
    expect(writes(request)).toHaveLength(1);
    expect(writes(request)[0][1]?.method).toBe('POST');
    if (existing) expect(writes(request)[0][1]?.data?.action).toBe('edit');
    else expect(writes(request)[0][1]?.data).not.toHaveProperty('action');
  });

  it.each([false, true])('后台失败后的对账 GET 失败可显式 retry，原记录未变时仍恢复草稿（已存回执=%s）', async existing => {
    const original = existing ? receipt() : null;
    const { page, request, getUser } = await loaded(route, original);
    draft(page);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise).mockRejectedValueOnce(new Error('合成对账 GET 失败'));
    const sending = page.submit();
    page.onHide();
    await page.onShow();
    pending.reject(new Error('合成写结果未知'));
    await sending;
    expect(page.data.loading).toBe(false);
    expect(page.data.info).toBeNull();
    expect(page.data.receipt).toBeNull();
    expect(page.data.error).toBe('合成对账 GET 失败');
    expect(page.data.busy).toBe(false);
    await page.submit();
    expect(writes(request)).toHaveLength(1);
    request.mockImplementationOnce(async path => {
      expect(path).toBe(readPath(route));
      expect(getUser()?.id).toBe(actorA.id);
      return response(route, '显式对账恢复', original);
    });
    const retrying = page.retry();
    expect(retrying).toHaveProperty('then', expect.any(Function));
    await retrying;
    expectVisible(page, '显式对账恢复', original?.id ?? null);
    expect(page.data.answers).toEqual({ note: '合成未提交草稿' });
    expect(page.data.responseEditing).toBe(existing);
    expect(page.data.receipt?.answers ?? null).toEqual(original?.answers ?? null);
    expect(reads(request).map(([path]) => path)).toEqual(Array(3).fill(readPath(route)));
    expect(writes(request)).toHaveLength(1);
  });

  it('后台写失败后账号已切换，只读取当前账号且不恢复旧账号草稿', async () => {
    const { page, request, changeUser, getUser } = await loaded(route, null);
    draft(page);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise).mockImplementationOnce(async path => {
      expect(path).toBe(readPath(route));
      expect(getUser()?.id).toBe(actorB.id);
      return response(route, '乙账号原记录', null);
    });
    const sending = page.submit();
    page.onHide();
    changeUser(actorB);
    await page.onShow();
    pending.reject(new Error('合成甲账号写失败'));
    await sending;
    expectVisible(page, '乙账号原记录', null);
    expect(page.data.answers).toEqual({});
    expect(page.data.responseEditing).toBe(false);
    expect(reads(request).map(([path]) => path)).toEqual([readPath(route), readPath(route)]);
    expect(writes(request)).toHaveLength(1);
  });

  it('后台写失败期间 route 改变，只 GET 新 route 且不恢复旧 route 草稿', async () => {
    const { page, request, getUser } = await loaded(route, null);
    draft(page);
    const pending = deferred<Record<string, unknown>>();
    const next: Route = { kind: kind === 'staff' ? 'events' : 'staff', id: '77' };
    request.mockImplementationOnce(() => pending.promise).mockImplementationOnce(async path => {
      expect(path).toBe(readPath(next));
      expect(getUser()?.id).toBe(actorA.id);
      return response(next, '新路由原记录', null);
    });
    const sending = page.submit();
    page.onHide();
    page.onLoad(next);
    await page.onShow();
    pending.reject(new Error('合成旧路由写失败'));
    await sending;
    expectVisible(page, '新路由原记录', null);
    expect(page.data.answers).toEqual({});
    expect(page.data.responseEditing).toBe(false);
    expect(reads(request).map(([path]) => path)).toEqual([readPath(route), readPath(next)]);
    expect(writes(request)).toHaveLength(1);
    expect(writes(request)[0][0]).toBe(writePath(route));
  });
});
