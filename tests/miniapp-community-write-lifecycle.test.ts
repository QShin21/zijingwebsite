import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Real native Page handlers and private-file epoch; all records, images and HTTP responses are synthetic.
type Row = { id: number; status: string; updatedAt: string; actions: Record<string, boolean>; [key: string]: unknown };
type Data = { docs: Row[]; game: { id?: number }; join: Row | null; loading: boolean; busy: boolean; joinBusy: boolean;
  needsLogin: boolean; error: string; formError: string; operationError: string; joinError: string;
  realName: string; reason: string; contactConsent: boolean; contacts: unknown[]; [key: string]: unknown };
type Event = { currentTarget: { dataset: Record<string, unknown> }; detail: { value?: unknown } };
type NativePage = { data: Data; _qr: string; setData(value: Record<string, unknown>): void; onLoad(options?: Record<string, string>): void;
  onShow(): Promise<unknown>; onHide(): void; onUnload(): void; retry(): Promise<unknown>; submit(): Promise<void>; withdraw(event: Event): Promise<void>;
  openForm(event: Event): Promise<void>; note(event: Event): void; decide(event: Event): Promise<void>; joinAction(event: Event): Promise<void>;
  handle(event: Event): Promise<void>; chooseQr(): Promise<void>; inspect(event: Event): Promise<void>; retryJoin(): Promise<void>; consent(event: Event): void;
  qrImageError(event: Event): void; retryQrPreview(event: Event): void; newApplication(): void };
type RequestOptions = { method?: string; required?: boolean; data?: Record<string, unknown> };
type Modal = { success(value: { confirm: boolean }): void };
type FileWrite = { filePath: string; success(): void };
type Flow = { page: string; action: string };
const flows: Flow[] = [
  { page: 'applications', action: 'submit' }, { page: 'applications', action: 'edit' }, { page: 'applications', action: 'card' }, { page: 'applications', action: 'withdraw' },
  { page: 'review', action: 'review' }, { page: 'community', action: 'request' }, { page: 'community', action: 'reportFriend' }, { page: 'community', action: 'withdraw' },
  { page: 'community-joins', action: 'confirmFriend' }, { page: 'community-joins', action: 'confirmJoined' },
];
const representatives = [flows[0], flows[4], flows[5], flows[8]];
const source = (path: string) => readFileSync('miniprogram/src/' + path, 'utf8');
const pageSource = (name: string) => process.env.MINIAPP_COMMUNITY_BASELINE
  ? readFileSync(process.env.MINIAPP_COMMUNITY_BASELINE + '/' + name + '.js', 'utf8') : source('pages/' + name + '/index.js');
const event = (dataset: Record<string, unknown>, value?: unknown): Event => ({ currentTarget: { dataset }, detail: { value } });
const qr = 'data:image/png;base64,c3ludGhldGlj';
const application = (extra: Record<string, unknown> = {}): Row => ({ id: 17, status: 'pending', updatedAt: 'synthetic-v1', proposedGame: '合成测试社群',
  game: null, realName: '合成测试申请人', phone: '00000000000', reason: '合成测试：组织每周社群活动', contactConsent: false, actions: { edit: false, card: false, withdraw: true, review: true }, ...extra });
const join = (extra: Record<string, unknown> = {}): Row => ({ id: 23, status: 'requested', updatedAt: 'synthetic-v1', memberName: '合成测试成员', actions: { confirmFriend: true, confirmJoined: false }, ...extra });
const paged = (docs: Row[]) => ({ docs, page: 1, hasNextPage: false, totalPages: 1, totalDocs: docs.length });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (value: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness(flow: Flow, options: { deferredPost?: boolean; modalAuto?: boolean; readFailure?: boolean; deferFile?: boolean } = {}) {
  let user: { id: number } | null = { id: 1 }, saved = false;
  let listeners: ((value: typeof user) => void)[] = [];
  const post = deferred<unknown>(), calls: { path: string; options: RequestOptions }[] = [], modals: Modal[] = [], fileWrites: FileWrite[] = [];
  const oldApp = application({ ...(flow.action === 'edit' ? { status: 'returned', actions: { edit: true } } : flow.action === 'card' ? { status: 'approved', contactConsent: true, actions: { card: true } } : {}) });
  const oldJoin = join({ ...(flow.action === 'confirmJoined' ? { status: 'awaitingInvite', actions: { confirmJoined: true } } : {}) });
  const confirmedApp = application({ status: flow.action === 'withdraw' ? 'withdrawn' : flow.action === 'review' ? 'returned' : flow.action === 'card' ? 'approved' : 'pending', updatedAt: 'synthetic-v2', contactConsent: ['submit', 'edit', 'card'].includes(flow.action), actions: { edit: true, withdraw: true, card: true, review: true } });
  const confirmedJoin = join({ status: flow.action === 'confirmJoined' ? 'joined' : flow.action === 'confirmFriend' ? 'awaitingInvite' : flow.action === 'withdraw' ? 'withdrawn' : flow.action === 'reportFriend' ? 'friendReported' : 'requested',
    updatedAt: 'synthetic-v2', actions: { confirmJoined: true } });
  const confirmed = ['applications', 'review'].includes(flow.page) ? { application: confirmedApp } : { record: confirmedJoin, actions: { reportFriend: true, withdraw: true } };
  const fs = { writeFile: vi.fn((value: FileWrite) => { fileWrites.push(value); if (!options.deferFile) value.success(); }), unlink: vi.fn(), readdir: vi.fn() };
  const wx = { env: { USER_DATA_PATH: '/synthetic-private' }, getFileSystemManager: () => fs, previewImage: vi.fn(), setNavigationBarTitle: vi.fn(), stopPullDownRefresh: vi.fn(),
    chooseMedia: vi.fn((value: { success(result: { tempFiles: { tempFilePath: string }[] }): void }) => value.success({ tempFiles: [{ tempFilePath: 'wxfile://synthetic-selected.png' }] })),
    showModal: vi.fn((value: Modal) => { modals.push(value); if (options.modalAuto !== false) value.success({ confirm: true }); }) };
  const fileModule = { exports: {} as { clearPrivate(): void; localImage(value: string): Promise<string>; choose(): Promise<string[]> } };
  runInNewContext(source('lib/files.js'), { module: fileModule, wx });
  const files = { ...fileModule.exports, readImage: vi.fn(async () => qr) };
  const session = { user: () => user, subscribe: (callback: (value: typeof user) => void) => { listeners.push(callback); return () => { listeners = listeners.filter(value => value !== callback); }; } };
  const http = { request: vi.fn(async (path: string, requestOptions: RequestOptions = {}) => {
    calls.push({ path, options: requestOptions });
    if (requestOptions.method === 'POST') { if (options.deferredPost) return post.promise; saved = true; return confirmed; }
    if (saved && options.readFailure && path.includes('/api/miniapp/')) throw new Error('合成写后读取失败');
    if (path === '/api/miniapp/workbench') return { reviewCommunity: true };
    if (path.startsWith('/api/miniapp/community/applications')) return paged(saved ? [confirmedApp] : [oldApp]);
    if (path.startsWith('/api/community-applications/')) return { wechatQr: qr };
    if (path.includes('mode=manage')) return { ...paged(saved ? [confirmedJoin] : [oldJoin]), canHandle: true };
    if (path.endsWith('/join')) return { record: saved ? confirmedJoin : flow.action === 'request' ? null : oldJoin, actions: { request: true, reportFriend: true, withdraw: true }, canHandle: true };
    if (path.endsWith('/contacts')) return [{ id: 5, name: '合成测试管理员', qr }];
    if (path === '/api/miniapp/club') return { staffBatches: [], promotions: {} };
    throw new Error('Unexpected synthetic API ' + path);
  }) };
  const cms = { list: vi.fn(async () => paged([])), detail: vi.fn(async (_collection: string, id: string) => ({ id: Number(id), slug: 'synthetic-' + id, title: '合成测试社群' })), social: vi.fn(async () => paged([])) };
  const navigation = { back: vi.fn(), login: vi.fn(), content: vi.fn(), go: vi.fn(), website: vi.fn(), copy: vi.fn(), requireUser: () => Boolean(user) };
  const pageModule = { exports: {} }; runInNewContext(source('lib/page.js'), { module: pageModule, wx, require: (path: string) => path === './navigation' ? navigation : session });
  const modules: Record<string, unknown> = { cms, http, session, files, navigation, page: pageModule.exports, privacy: { authorize: vi.fn(async () => {}), openContract: vi.fn(async () => {}) },
    'native-presentation': createRequire(import.meta.url)('../miniprogram/src/lib/native-presentation.js'),
    format: { date: (value: string) => value || '' }, video: { source: () => '' }, richtext: { render: () => ({ nodes: [] }) } };
  let page!: NativePage;
  runInNewContext(pageSource(flow.page), { Page: (value: NativePage) => { page = value; }, wx, require: (path: string) => modules[path.split('/').pop() || ''] });
  page.setData = (values: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(values)) {
      const match = /^docs\[(\d+)\]\.(\w+)$/.exec(key); if (match) page.data.docs[Number(match[1])][match[2]] = value; else page.data[key] = value;
    }
  };
  page.onLoad(['community', 'community-joins'].includes(flow.page) ? { id: '9' } : {});
  return { page, http, cms, wx, files, fs, calls, modals, fileWrites, post, confirmed, confirmedApp, confirmedJoin,
    settle(error = false) { if (error) post.reject(new Error('合成提交结果未知')); else { saved = true; post.resolve(confirmed); } },
    changeUser(id: number | null) { user = id ? { id } : null; files.clearPrivate(); listeners.slice().forEach(callback => callback(user)); } };
}
type Harness = ReturnType<typeof harness>;
const writes = (h: Harness) => h.calls.filter(call => call.options.method === 'POST');
const reads = (h: Harness) => h.calls.filter(call => call.options.method !== 'POST');
const busy = (h: Harness) => Boolean(h.page.data.busy || h.page.data.joinBusy);
async function prepare(h: Harness, flow: Flow) {
  await h.page.onShow();
  if (flow.page === 'applications') {
    if (['edit', 'card'].includes(flow.action)) await h.page.openForm(event({ id: 17, action: flow.action }));
    else { h.page.setData({ apply: true, proposedGame: '合成测试新游戏', realName: '合成测试申请人', phone: '00000000000', reason: '合成测试：尚未提交的组织计划' }); h.page._qr = qr; }
    if (['submit', 'edit'].includes(flow.action)) h.page.consent(event({}, ['contact']));
  }
  if (flow.page === 'review') h.page.note(event({ id: 17 }, '合成测试：请补充训练安排'));
  if (flow.page === 'community-joins') h.page.note(event({ id: 23 }, '合成测试：已人工核实好友'));
}
function act(h: Harness, flow: Flow) {
  if (flow.page === 'applications') return flow.action === 'withdraw' ? h.page.withdraw(event({ id: 17 })) : h.page.submit();
  if (flow.page === 'review') return h.page.decide(event({ id: 17, decision: 'returned' }));
  if (flow.page === 'community') return h.page.joinAction(event({ action: flow.action, contact: 5 }));
  return h.page.handle(event({ id: 23, action: flow.action }));
}

describe('Community real deferred POST lock regression — synthetic VM', () => {
  it.each(flows)('$page $action holds one write lock across hide/show and duplicate clicks', async flow => {
    const h = harness(flow, { deferredPost: true }); await prepare(h, flow); const writing = act(h, flow); await flush(); expect(writes(h)).toHaveLength(1);
    const initialReads = reads(h).length; h.page.onHide(); await h.page.onShow(); const duplicate = act(h, flow); await flush();
    expect(writes(h)).toHaveLength(1); expect(busy(h)).toBe(true); expect(reads(h)).toHaveLength(initialReads);
    h.settle(); await writing; await duplicate; expect(writes(h)).toHaveLength(1); expect(busy(h)).toBe(false); expect(reads(h).length).toBeGreaterThan(initialReads);
  });

  it.each(representatives.flatMap(flow => [false, true].map(error => ({ ...flow, error }))))('$page settles in background (error=$error), waits for onShow GET and retains failed drafts', async flow => {
    const h = harness(flow, { deferredPost: true }); await prepare(h, flow); const initialReads = reads(h).length;
    const writing = act(h, flow); await flush(); h.page.onHide(); expect(busy(h)).toBe(true); h.settle(flow.error); await writing;
    expect(busy(h)).toBe(false); expect(reads(h)).toHaveLength(initialReads); await act(h, flow); expect(writes(h)).toHaveLength(1);
    await h.page.onShow(); expect(reads(h).length).toBeGreaterThan(initialReads); expect(writes(h)).toHaveLength(1);
    if (flow.error) {
      const record = flow.page === 'community' ? h.page.data.join : h.page.data.docs[0];
      if (flow.page === 'community') expect(record).toBeNull();
      else expect(record).toMatchObject({ updatedAt: 'synthetic-v1', status: flow.page === 'community-joins' ? 'requested' : 'pending' });
    }
    if (flow.error && flow.page === 'applications') { expect(h.page.data.reason).toBe('合成测试：尚未提交的组织计划'); expect(h.page._qr).toBe(qr); expect(h.page.data.contactConsent).toBe(true); }
    if (flow.error && flow.page === 'review') expect(h.page.data.docs[0].reviewDraft).toBe('合成测试：请补充训练安排');
    if (flow.error && flow.page === 'community-joins') expect(h.page.data.docs[0].noteDraft).toBe('合成测试：已人工核实好友');
  });

  it.each(representatives)('$page account switch clears private data but retains the pending POST lock until current-scope read', async flow => {
    const h = harness(flow, { deferredPost: true }); await prepare(h, flow); const writing = act(h, flow); await flush(); const initialReads = reads(h).length;
    h.changeUser(2); expect(h.page.data.docs).toHaveLength(0); expect(busy(h)).toBe(true); await h.page.onShow(); await act(h, flow);
    expect(reads(h)).toHaveLength(initialReads); expect(writes(h)).toHaveLength(1); h.settle(); await writing;
    expect(reads(h).length).toBeGreaterThan(initialReads); expect(writes(h)).toHaveLength(1);
    if (flow.page === 'applications') { expect(h.page.data.reason).toBe(''); expect(h.page._qr).toBe(''); }
  });

  it.each([flows[3], ...representatives.filter(flow => flow.page !== 'applications')])('$page cancels a modal confirmed after hide without any business POST', async flow => {
    const h = harness(flow, { modalAuto: false }); await prepare(h, flow); const confirming = act(h, flow); expect(h.modals).toHaveLength(1);
    h.page.onHide(); expect(busy(h)).toBe(true); await h.page.onShow(); h.modals[0].success({ confirm: true }); await confirming;
    expect(writes(h)).toHaveLength(0); expect(busy(h)).toBe(false);
  });

  it.each(representatives)('$page keeps confirmed POST data read-only when the next GET fails', async flow => {
    const h = harness(flow, { readFailure: true }); await prepare(h, flow); await act(h, flow);
    const record = flow.page === 'community' ? h.page.data.join : h.page.data.docs[0];
    expect(record).toMatchObject({ updatedAt: 'synthetic-v2', status: ['applications', 'review'].includes(flow.page) ? h.confirmedApp.status : h.confirmedJoin.status });
    expect(record?.actions).toEqual({});
    if (flow.page === 'community') expect(h.page.data.joinActions).toEqual({});
    expect(writes(h)).toHaveLength(1);
  });

  it.each(['community', 'community-joins'])('%s same-account route change keeps lock and rejects the old POST result', async name => {
    const flow = representatives.find(value => value.page === name)!; const h = harness(flow, { deferredPost: true }); await prepare(h, flow);
    const writing = act(h, flow); await flush(); const initialReads = reads(h).length; h.page.onLoad({ id: '10' });
    expect(h.page.data.docs).toHaveLength(0); expect(busy(h)).toBe(true); await h.page.onShow(); await act(h, flow);
    expect(reads(h)).toHaveLength(initialReads); h.settle(); await writing; expect(writes(h)).toHaveLength(1);
    expect(h.calls.at(-1)?.path).toContain(name === 'community' ? '/api/miniapp/' : '/community/10/');
    if (name === 'community') expect(h.page.data.game.id).toBe(10);
  });

  it('does not start photo selection or a second business POST during an application POST', async () => {
    const flow = flows[0], h = harness(flow, { deferredPost: true }); await prepare(h, flow); const writing = act(h, flow); await flush();
    h.page.onHide(); await h.page.onShow(); await h.page.chooseQr(); const duplicate = h.page.submit(); await flush(); expect(h.wx.chooseMedia).not.toHaveBeenCalled(); expect(writes(h)).toHaveLength(1);
    h.settle(); await writing; await duplicate;
  });

  it('preserves the private-file epoch: an old QR file finishing after account switch is deleted and never previewed', async () => {
    const flow = flows[0], h = harness(flow, { deferFile: true }); await prepare(h, flow); const inspecting = h.page.inspect(event({ id: 17 })); await flush();
    expect(h.fileWrites).toHaveLength(1); h.changeUser(2); h.fileWrites[0].success(); await inspecting;
    expect(h.fs.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: h.fileWrites[0].filePath })); expect(h.wx.previewImage).not.toHaveBeenCalled(); expect(h.page.data.docs).toHaveLength(0);
  });

  it('原生名片预览失败保留上传材料、主动同意和未提交字段，重试只恢复预览', async () => {
    const h = harness(flows[0]); await prepare(h, flows[0]); await h.page.chooseQr();
    const current = event({ url: h.page.data.qr, scope: h.page.data.qrPreviewScope });
    const selected = h.page.data.qr, material = h.page._qr, reason = h.page.data.reason;
    h.page.qrImageError(event({ url: 'wxfile://old-selection.png', scope: h.page.data.qrPreviewScope }));
    expect(h.page.data.qrFailed).toBe(false);
    h.page.qrImageError(current);
    expect(h.page.data.qrFailed).toBe(true); expect(h.page.data.qr).toBe(selected); expect(h.page._qr).toBe(material);
    expect(h.page.data.reason).toBe(reason); expect(h.page.data.contactConsent).toBe(true); expect(writes(h)).toHaveLength(0);
    h.page.retryQrPreview(current); expect(h.page.data.qrFailed).toBe(false);
    expect(h.wx.chooseMedia).toHaveBeenCalledTimes(1); expect(writes(h)).toHaveLength(0);
    h.page.qrImageError(current); await h.page.chooseQr(); expect(h.page.data.qrFailed).toBe(false);
    expect(h.page.data.contactConsent).toBe(true); expect(writes(h)).toHaveLength(0);
  });

  it('原生名片预览忽略隐藏、重新显示前旧scope和卸载后的错误回调', async () => {
    const h = harness(flows[0]); await prepare(h, flows[0]); await h.page.chooseQr();
    const old = event({ url: h.page.data.qr, scope: h.page.data.qrPreviewScope });
    h.page.onHide(); h.page.qrImageError(old); expect(h.page.data.qrFailed).toBe(false);
    await h.page.onShow(); h.page.qrImageError(old); expect(h.page.data.qrFailed).toBe(false);
    const current = event({ url: h.page.data.qr, scope: h.page.data.qrPreviewScope });
    h.page.qrImageError(current); expect(h.page.data.qrFailed).toBe(true);
    h.page.retryQrPreview(current); h.page.onUnload(); h.page.qrImageError(current);
    expect(h.page.data.qrFailed).toBe(false); expect(writes(h)).toHaveLength(0);
  });

  it('原生名片预览换号后同URL的旧回调无效，新申请清空失败标志和同意', async () => {
    const h = harness(flows[0]); await prepare(h, flows[0]); await h.page.chooseQr();
    const old = event({ url: h.page.data.qr, scope: h.page.data.qrPreviewScope });
    h.changeUser(2); expect(h.page.data.qr).toBe(''); expect(h.page._qr).toBe(''); expect(h.page.data.contactConsent).toBe(false);
    await h.page.onShow(); h.page.newApplication(); await h.page.chooseQr();
    expect(h.page.data.qr).toBe(old.currentTarget.dataset.url);
    h.page.qrImageError(old); expect(h.page.data.qrFailed).toBe(false);
    h.page.qrImageError(event({ url: h.page.data.qr, scope: h.page.data.qrPreviewScope })); expect(h.page.data.qrFailed).toBe(true);
    h.page.newApplication(); expect(h.page.data.qrFailed).toBe(false); expect(h.page.data.qr).toBe(''); expect(h.page.data.contactConsent).toBe(false);
    expect(writes(h)).toHaveLength(0);
  });
});
