import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type User = { id: number; roles: string[] };
type Row = { id: number; updatedAt: string; status: string; actions: Record<string, boolean>; [key: string]: unknown };
type Data = {
  docs: Row[]; games: { id: number | string; title: string }[]; page: number; hasMore: boolean; loading: boolean;
  allowed: boolean; busy: boolean; imageBusy: boolean; needsLogin: boolean; game: { id?: number; title?: string };
  join: Row | null; joinActions: Record<string, boolean>; joinBusy: boolean; contacts: { id: number; image: string }[];
  contactsError: string; contentError: string; error: string; formError: string; operationError: string; mode: string;
  editId: number | string; revision: string; realName: string; reason: string; qr: string; contactConsent: boolean;
  promotions: { kindText: string; sourceKey: string }[]; staffBatches: { id: number; title: string }[]; [key: string]: unknown;
};
type Event = { currentTarget: { dataset: Record<string, unknown> }; detail: { value?: unknown } };
type NativePage = {
  data: Data; _qr: string; setData(values: Record<string, unknown>): void; onLoad(options?: Record<string, string>): void;
  onShow(): Promise<unknown>; onHide(): void; onUnload(): void; load(more?: boolean): Promise<unknown>;
  submit(): Promise<void>; openForm(event: Event): Promise<void>; inspect(event: Event): Promise<void>; chooseQr(): Promise<void>;
  consent(event: Event): void; withdraw(event: Event): Promise<void>; decide(event: Event): Promise<void>; note(event: Event): void;
  handle(event: Event): Promise<void>; retryContacts(): Promise<void>; previewImage(event: Event): void;
  joinAction(event: Event): Promise<void>; retryJoin(): Promise<void>; area(event: Event): Promise<void>; contactAdmins(): void;
  loadArea(more?: boolean): Promise<void>; staff(): void; applyStaff(event: Event): void;
  contactImageError(event: Event): void; showcaseImageError(event: Event): void; nativeCoverError(event: Event): void;
  imageError(event: Event): void; openPage(event: Event): void; staffPage(): void;
};
type RequestOptions = { method?: string; required?: boolean; auth?: boolean; data?: Record<string, unknown> };
type RequestCall = { path: string; options: RequestOptions };
type ModalOptions = { success(value: { confirm: boolean }): void; fail(): void; content: string };
type HarnessOptions = {
  request?: (path: string, options: RequestOptions) => unknown | Promise<unknown>;
  user?: User | null; modalAuto?: boolean;
  cmsList?: (collection: string, options: { page: number }) => unknown | Promise<unknown>;
  cmsSocial?: (collection: string, options: { page: number }) => unknown | Promise<unknown>;
  cmsDetail?: () => unknown | Promise<unknown>;
};
const source = (path: string) => readFileSync('miniprogram/src/' + path, 'utf8');
const event = (dataset: Record<string, unknown>, value?: unknown): Event => ({ currentTarget: { dataset }, detail: { value } });
const qr = 'data:image/png;base64,c3ludGhldGlj';
const application = (status = 'pending', extra: Record<string, unknown> = {}): Row => ({
  id: 17, updatedAt: 'synthetic-v1', status, proposedGame: '合成测试游戏', game: null, realName: '合成测试申请人',
  phone: '00000000000', reason: '合成测试：每周共同组织社群活动', contactConsent: false,
  actions: { edit: false, withdraw: false, card: false, review: false }, ...extra,
});
const joined = (extra: Record<string, unknown> = {}): Row => ({ id: 23, updatedAt: 'synthetic-join-v1', status: 'requested', memberName: '合成测试成员', actions: {}, ...extra });
const pageResult = (docs: unknown[], page = 1, hasNextPage = false) => ({ docs, page, hasNextPage, totalPages: hasNextPage ? 2 : page, totalDocs: docs.length });
/** V2 CommunityCard (src/lib/v2/types.ts) with synthetic values. */
const communityCard = (id: number, coverSrc = '') => ({
  community: { id, slug: 'synthetic-' + id, title: '合成测试社群', hue: (id * 137) % 360 }, summary: null,
  cover: coverSrc ? { src: coverSrc, width: null, height: null, alt: '' } : null, demo: false,
  counts: { upcomingEvents: 1, teams: 0, showcase: 0 }, viewer: { isOfficer: false } });
/** V2 RecruitmentCard for an open staff batch. */
const staffCall = (id: number) => ({ key: 'staff:' + id, ref: { type: 'staffBatch', id }, href: '/join/staff/batches/' + id, kind: 'staff',
  title: '合成测试骨干批次', summary: null, team: null, community: null, opensAt: null, deadline: '2026-11-20T15:59:00.000Z',
  state: 'open', stateLabel: '申请开放', viewerApplication: null });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

function harness(name: string, options: HarnessOptions = {}) {
  let current: User | null = options.user === undefined ? { id: 1, roles: ['member'] } : options.user;
  let callbacks: ((value: User | null) => void)[] = [];
  const calls: RequestCall[] = [], modals: ModalOptions[] = [];
  const http = { request: vi.fn(async (path: string, requestOptions: RequestOptions = {}) => {
    calls.push({ path, options: requestOptions });
    if (options.request) return options.request(path, requestOptions);
    if (path === '/api/miniapp/workbench') return { reviewCommunity: false, reviewStaff: false };
    if (path === '/api/miniapp/club') return { staffBatches: [], promotions: {} };
    if (path.startsWith('/api/miniapp/community/applications')) return requestOptions.method === 'POST' ? { application: application() } : pageResult([]);
    if (path.startsWith('/api/community-applications/')) return { wechatQr: qr };
    if (path.includes('?mode=manage')) return { ...pageResult([]), canHandle: true };
    if (path.includes('/join')) return { record: null, actions: { request: true }, canHandle: false };
    if (path.endsWith('/contacts')) return [];
    throw new Error('Unexpected synthetic request: ' + path);
  }) };
  const session = { user: () => current, token: () => (current ? 'synthetic-jwt' : null), subscribe: (callback: (value: User | null) => void) => {
    callbacks.push(callback); return () => { callbacks = callbacks.filter(value => value !== callback); };
  }, reviewer: () => { throw new Error('Client roles must not decide server permissions'); } };
  const navigation = { go: vi.fn(), back: vi.fn(), login: vi.fn(), content: vi.fn(), website: vi.fn(), copy: vi.fn(), open: vi.fn(), requireUser: () => Boolean(current) };
  const wx = { previewImage: vi.fn(), setNavigationBarTitle: vi.fn(), stopPullDownRefresh: vi.fn(),
    nextTick: vi.fn((_callback: () => void) => {}), pageScrollTo: vi.fn(),
    showModal: vi.fn((value: ModalOptions) => { modals.push(value); if (options.modalAuto !== false) value.success({ confirm: true }); }) };
  // Real V2 client modules (lib/v2.js projections, lib/v2-images.js signing) on the synthetic transport.
  const config = { origin: 'https://synthetic.invalid' };
  const v2Module = { exports: {} };
  runInNewContext(source('lib/v2.js'), { module: v2Module, require: (path: string) => { if (path === './http') return http; throw new Error('Unmocked module ' + path); } });
  const imagesModule = { exports: {} };
  runInNewContext(source('lib/v2-images.js'), { module: imagesModule,
    require: (path: string) => ({ '../config': config, './http': http, './session': session } as Record<string, unknown>)[path] });
  const pageModule = { exports: {} };
  runInNewContext(source('lib/page.js'), { module: pageModule, wx,
    require: (path: string) => path === './navigation' ? navigation : path === './v2-images' ? imagesModule.exports : session });
  const files = { choose: vi.fn(async () => ['wxfile://synthetic-chosen.png']), readImage: vi.fn(async () => qr), localImage: vi.fn(async (value: string) => value ? 'wxfile://synthetic-private.png' : '') };
  const privacy = { authorize: vi.fn(async () => {}), openContract: vi.fn(async () => {}) };
  const cms = { list: vi.fn(options.cmsList || (async () => pageResult([{ id: 9, title: '合成测试社群' }]))),
    detail: vi.fn(options.cmsDetail || (async () => ({ id: 9, slug: 'synthetic', title: '合成测试社群', body: null }))),
    decorate: async (docs: unknown[]) => docs, social: vi.fn(options.cmsSocial || (async () => pageResult([]))) };
  const modules: Record<string, unknown> = { cms, http, session, files, privacy, page: pageModule.exports, navigation, config,
    v2: v2Module.exports, 'v2-images': imagesModule.exports,
    'native-presentation': createRequire(import.meta.url)('../miniprogram/src/lib/native-presentation.js'),
    format: { date: (value: string) => value || '' }, richtext: { render: () => ({ nodes: [] }) }, video: { source: (value: string) => value && value.endsWith('.mp4') ? value : '' } };
  let native!: NativePage;
  runInNewContext(source('pages/' + name + '/index.js'), { Page: (value: NativePage) => { native = value; }, wx,
    require: (path: string) => { const module = modules[path.split('/').pop() || '']; if (!module) throw new Error('Unmocked module ' + path); return module; } });
  native.setData = (values: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(values)) {
      const match = /^docs\[(\d+)\]\.(\w+)$/.exec(key);
      if (match) { native.data.docs[Number(match[1])][match[2]] = value; continue; }
      if (!key.includes('.') || key.includes('[')) { native.data[key] = value; continue; }
      // WeChat dotted path keys ('img.key') write nested objects.
      const parts = key.split('.');
      let node = native.data as Record<string, unknown>;
      for (const part of parts.slice(0, -1)) node = (node[part] && typeof node[part] === 'object' ? node[part] : (node[part] = {})) as Record<string, unknown>;
      node[parts[parts.length - 1]] = value;
    }
  };
  if (typeof native.onLoad === 'function') native.onLoad(name === 'community' ? { id: '9', area: 'updates' } : name === 'community-joins' ? { id: '9', title: '合成测试社群' } : {});
  return { page: native, calls, http, wx, cms, files, privacy, navigation, modals,
    changeUser(value: User | null) { current = value; callbacks.slice().forEach(callback => callback(value)); } };
}

describe('Native community applications — synthetic VM only', () => {
  it('keeps failed new applications and submits only the allowed fields after explicit contact consent', async () => {
    let fail = true;
    const h = harness('applications', { request: (path, options) => {
      if (options.method === 'POST') { if (fail) throw new Error('合成断网'); return { application: application('pending', { contactConsent: true }) }; }
      if (path.startsWith('/api/miniapp/community/applications')) return pageResult([]);
      throw new Error('Unexpected read');
    } });
    await h.page.onShow();
    expect(h.privacy.authorize).not.toHaveBeenCalled();
    h.page.setData({ apply: true, proposedGame: '合成测试新游戏', realName: '合成测试申请人', phone: '00000000000', reason: '合成测试：每周共同组织社群活动' });
    await h.page.chooseQr();
    h.page.consent(event({}, ['contact']));
    await h.page.submit();
    expect(h.page.data.formError).toBe('合成断网');
    expect(h.page.data.realName).toBe('合成测试申请人'); expect(h.page.data.qr).toContain('synthetic-chosen'); expect(h.page.data.apply).toBe(true);
    expect(h.calls.find(call => call.options.method === 'POST')?.options.data?.contactConsent).toBe(true);
    expect(h.page.data.contactConsent).toBe(true);
    fail = false; await h.page.submit();
    const payload = h.calls.filter(call => call.options.method === 'POST').at(-1)?.options.data;
    expect(payload).toMatchObject({ action: 'submit', game: null, proposedGame: '合成测试新游戏', contactConsent: true, wechatQr: qr });
    expect(Object.keys(payload || {}).sort()).toEqual(['action', 'contactConsent', 'game', 'phone', 'proposedGame', 'realName', 'reason', 'wechatQr'].sort());
    expect(h.page.data.apply).toBe(false); expect(h.page.data.contactConsent).toBe(false); expect(h.page._qr).toBe('');
  });

  it.each(['returned', 'withdrawn'])('edits a %s receipt with the same id/revision and preserves edits after a conflict', async status => {
    const original = application(status, { actions: { edit: true } });
    const h = harness('applications', { request: (path, options) => {
      if (options.method === 'POST') throw Object.assign(new Error('申请已更新，请刷新回执后核对'), { status: 409 });
      if (path.startsWith('/api/community-applications/')) return { wechatQr: qr };
      return pageResult([original]);
    } });
    await h.page.onShow();
    expect(h.calls.some(call => call.path.startsWith('/api/community-applications/'))).toBe(false);
    await h.page.openForm(event({ id: original.id, action: 'edit' }));
    expect(h.page.data.editId).toBe(17); expect(h.page.data.revision).toBe('synthetic-v1');
    h.page.setData({ reason: '合成测试：补充组织计划和时间安排' });
    h.page.consent(event({}, ['contact']));
    await h.page.submit();
    expect(h.calls.find(call => call.options.method === 'POST')?.options.data).toMatchObject({ action: 'edit', id: 17, revision: 'synthetic-v1', wechatQr: qr });
    expect(h.page.data.reason).toBe('合成测试：补充组织计划和时间安排'); expect(h.page.data.mode).toBe('edit'); expect(h.page.data.formError).toContain('刷新');
  });

  it('saves a corrected application into the existing receipt', async () => {
    let saved = application('returned', { actions: { edit: true } });
    const h = harness('applications', { request: (path, options) => {
      if (path.startsWith('/api/community-applications/')) return { wechatQr: qr };
      if (options.method === 'POST') { saved = application('pending', { updatedAt: 'synthetic-v2', contactConsent: true, actions: { withdraw: true }, reason: options.data?.reason }); return { application: saved }; }
      return pageResult([saved]);
    } });
    await h.page.onShow(); await h.page.openForm(event({ id: 17, action: 'edit' })); h.page.setData({ reason: '合成测试：新的组织计划已补充' }); h.page.consent(event({}, ['contact'])); await h.page.submit();
    expect(h.page.data.docs).toHaveLength(1); expect(h.page.data.docs[0]).toMatchObject({ id: 17, updatedAt: 'synthetic-v2', status: 'pending', reason: '合成测试：新的组织计划已补充' });
    expect(h.page.data.apply).toBe(false);
  });

  it('withdraws into the same receipt and exposes the server-provided edit action', async () => {
    let saved = application('pending', { actions: { withdraw: true } });
    const h = harness('applications', { request: (_path, options) => {
      if (options.method === 'POST') { saved = application('withdrawn', { updatedAt: 'synthetic-v2', actions: { edit: true } }); return { application: saved }; }
      return pageResult([saved]);
    } });
    await h.page.onShow(); await h.page.withdraw(event({ id: 17 }));
    expect(h.calls.find(call => call.options.method === 'POST')?.options.data).toEqual({ action: 'withdraw', id: 17, revision: 'synthetic-v1' });
    expect(h.page.data.docs[0]).toMatchObject({ id: 17, status: 'withdrawn', actions: { edit: true } }); expect(h.page.data.busy).toBe(false);
  });

  it('retains a receipt game when late picker options arrive while an edit has opened', async () => {
    const pendingGames = deferred<unknown>();
    const original = application('returned', { game: 105, proposedGame: '合成测试第105个社群', actions: { edit: true } });
    const h = harness('applications', { cmsList: () => pendingGames.promise,
      request: path => path.startsWith('/api/community-applications/') ? { wechatQr: qr } : pageResult([original]) });
    const loading = h.page.onShow(); await flush(); await h.page.openForm(event({ id: 17, action: 'edit' }));
    pendingGames.resolve(pageResult([{ id: 9, title: '合成测试社群' }])); await loading;
    const selected = h.page.data.games[Number(h.page.data.gameIndex)]; expect(selected.id).toBe(105); expect(selected.title).toBe('合成测试第105个社群');
  });

  it('changes approved contact visibility without rewriting private application answers or loading the old QR', async () => {
    const original = application('approved', { contactConsent: true, actions: { card: true } });
    const h = harness('applications', { request: (_path, options) => options.method === 'POST'
      ? { application: { ...original, contactConsent: false, updatedAt: 'synthetic-v2' } } : pageResult([original]) });
    await h.page.onShow(); await h.page.openForm(event({ id: 17, action: 'card' }));
    expect(h.calls.some(call => call.path.startsWith('/api/community-applications/'))).toBe(false);
    h.page.consent(event({}, [])); await h.page.submit();
    expect(h.calls.find(call => call.options.method === 'POST')?.options.data).toEqual({ action: 'card', id: 17, revision: 'synthetic-v1', contactConsent: false });
  });

  it('does not read images after privacy denial and lets the same filled form retry', async () => {
    const h = harness('applications'); await h.page.onShow(); h.page.setData({ realName: '合成测试申请人' });
    h.privacy.authorize.mockRejectedValueOnce(new Error('隐私授权未完成'));
    await h.page.chooseQr();
    expect(h.files.choose).not.toHaveBeenCalled(); expect(h.files.readImage).not.toHaveBeenCalled();
    expect(h.page.data.realName).toBe('合成测试申请人'); expect(h.page.data.imageBusy).toBe(false);
    await h.page.chooseQr(); expect(h.files.choose).toHaveBeenCalledTimes(1); expect(h.page._qr).toBe(qr);
  });

  it('loads saved QR only on inspection and never writes from preview', async () => {
    const h = harness('applications', { request: path => path.startsWith('/api/community-applications/') ? { wechatQr: qr } : pageResult([application()]) });
    await h.page.onShow(); await h.page.inspect(event({ id: 17 }));
    expect(h.calls.filter(call => call.path.startsWith('/api/community-applications/'))[0].path).toBe('/api/community-applications/17?depth=0&select[wechatQr]=true');
    expect(h.wx.previewImage).toHaveBeenCalledTimes(1); expect(h.calls.some(call => call.options.method === 'POST')).toBe(false);
  });

  it('locks withdrawal before the confirmation modal and ignores confirmation after hiding', async () => {
    const h = harness('applications', { modalAuto: false, request: () => pageResult([application('pending', { actions: { withdraw: true } })]) });
    await h.page.onShow(); const first = h.page.withdraw(event({ id: 17 })); await h.page.withdraw(event({ id: 17 }));
    expect(h.wx.showModal).toHaveBeenCalledTimes(1); expect(h.page.data.busy).toBe(true);
    h.page.onHide(); h.modals[0].success({ confirm: true }); await first;
    expect(h.calls.some(call => call.options.method === 'POST')).toBe(false); expect(h.page.data.busy).toBe(false);
  });

  it('does not advance pagination on failure or double taps', async () => {
    let response = deferred<unknown>();
    const h = harness('applications', { request: path => path.endsWith('page=2') ? response.promise : pageResult([application()], 1, true) });
    await h.page.onShow(); const loading = h.page.load(true); await h.page.load(true);
    expect(h.calls.filter(call => call.path.endsWith('page=2'))).toHaveLength(1); expect(h.page.data.page).toBe(1);
    response.reject(new Error('合成断网')); await loading; expect(h.page.data.page).toBe(1);
    response = deferred<unknown>(); const retry = h.page.load(true); response.resolve(pageResult([application('pending', { id: 18 })], 2)); await retry;
    expect(h.page.data.page).toBe(2); expect(h.page.data.docs.map(doc => doc.id)).toEqual([17, 18]);
  });
});

describe('Native authorized workbench and manual joins — synthetic VM only', () => {
  it('原生损坏名片降低联系CTA，风采图片保留图注；旧URL和隐藏回调不写回', async () => {
    const h = harness('community'); await h.page.onShow();
    h.page.setData({ contacts: [{ id: 5, image: 'wxfile://synthetic-current.png' }], contactAvailable: true,
      docs: [{ id: 77, localImages: [{ source: 'wxfile://synthetic-photo.png', caption: '合成图注' }] }] });
    h.page.contactImageError(event({ id: 5, url: 'wxfile://synthetic-old.png' }));
    expect(h.page.data.contactAvailable).toBe(true);
    h.page.contactImageError(event({ id: 5, url: 'wxfile://synthetic-current.png' }));
    expect(h.page.data.contacts).toMatchObject([{ id: 5, image: 'wxfile://synthetic-current.png', imageError: true }]);
    expect(h.page.data.contactAvailable).toBe(false);
    h.page.showcaseImageError(event({ id: 77, url: 'wxfile://synthetic-photo.png' }));
    expect(h.page.data.docs).toMatchObject([{ id: 77, localImages: [{ caption: '合成图注', imageError: true }] }]);
    h.page.setData({ contacts: [{ id: 5, image: 'wxfile://synthetic-current.png' }], contactAvailable: true });
    h.page.onHide(); h.page.contactImageError(event({ id: 5, url: 'wxfile://synthetic-current.png' }));
    expect(h.page.data.contactAvailable).toBe(true);
    expect(h.calls.some(call => call.options.method === 'POST')).toBe(false);
  });
  it('项目目录 V2 封面失败显示文字封面并保留社群卡片数据；旧地址与离页后的错误事件不改数据', async () => {
    // V2 directory (GET /api/v2/communities): public media covers load directly; a failed cover falls back to the crest.
    const coverURL = 'https://synthetic.invalid/api/media/file/synthetic-cover.webp';
    const h = harness('communities', { request: path => path.startsWith('/api/v2/communities')
      ? { ...pageResult([communityCard(9, '/api/media/file/synthetic-cover.webp')]), totalDocs: 1 }
      : Promise.reject(new Error('Unexpected synthetic request: ' + path)) });
    await h.page.onShow();
    const [doc] = h.page.data.docs as unknown as Record<string, unknown>[];
    const key = doc.coverKey as string, img = () => (h.page.data.img as Record<string, unknown>)[key];
    await vi.waitFor(() => expect(img()).toBe(coverURL));
    const before = JSON.stringify(h.page.data.docs);
    h.page.imageError(event({ key, url: 'https://synthetic.invalid/api/media/file/old-cover.webp' }));
    expect(img()).toBe(coverURL);
    h.page.imageError(event({ key, url: coverURL }));
    expect(img()).toBe('');
    expect(JSON.stringify(h.page.data.docs)).toBe(before);
    h.page.setData({ ['img.' + key]: coverURL }); h.page.onHide();
    h.page.imageError(event({ key, url: coverURL }));
    expect(img()).toBe(coverURL);
    expect(h.calls.some(call => call.options.method === 'POST')).toBe(false);
  });
  it('locates contact cards without a write and ignores deferred scrolling after the page is hidden', async () => {
    const h = harness('community'); await h.page.onShow();
    h.page.setData({ joinBusy: true });
    const callsBefore = h.calls.length;
    h.page.contactAdmins();
    expect(h.page.data.area).toBe('contacts'); expect(h.calls).toHaveLength(callsBefore);
    h.wx.nextTick.mock.calls[0][0]();
    expect(h.wx.pageScrollTo).toHaveBeenCalledWith({ selector: '#community-contacts', duration: 0 });
    h.page.contactAdmins(); h.page.onHide(); h.wx.nextTick.mock.calls[1][0]();
    expect(h.wx.pageScrollTo).toHaveBeenCalledTimes(1);
    h.page.contactAdmins(); expect(h.wx.nextTick).toHaveBeenCalledTimes(2);
    expect(h.calls.filter(call => call.options.method === 'POST')).toEqual([]);
  });
  it('shows the directory icon in the community header and refreshes both after a replacement', async () => {
    let coverSrc = '/api/game-icons/default/league-of-legends';
    const request = (path: string) => {
      if (path === '/api/v2/communities/synthetic-9/header') return { card: communityCard(9, coverSrc) };
      if (path.startsWith('/api/v2/communities?')) return pageResult([communityCard(9, coverSrc)]);
      if (path.endsWith('/contacts')) return [];
      if (path === '/api/miniapp/club') return { staffBatches: [], promotions: {} };
      throw new Error('Unexpected synthetic request: ' + path);
    };
    const list = harness('communities', { request });
    const detail = harness('community', { request,
      cmsDetail: async () => ({ id: 9, slug: 'synthetic-9', title: '合成测试社群', body: null }) });
    const visibleIcon = () => (detail.page.data.img as Record<string, string>)[String(detail.page.data.iconKey)];
    const assertSameIcon = () => {
      const listKey = String(list.page.data.docs[0].coverKey);
      expect((list.page.data.img as Record<string, string>)[listKey]).toBe('https://synthetic.invalid' + coverSrc);
      expect(visibleIcon()).toBe('https://synthetic.invalid' + coverSrc);
    };
    await Promise.all([list.page.onShow(), detail.page.onShow()]);
    await vi.waitFor(assertSameIcon);

    coverSrc = '/api/game-icons/synthetic-9?v=updated';
    await Promise.all([list.page.load(), detail.page.onShow()]);
    await vi.waitFor(assertSameIcon);
    detail.changeUser(null);
    expect(detail.page.data.iconKey).toBe('');
    expect(detail.page.data.img).toEqual({});
  });
  it('accepts permissions from fresh server workbench rather than stored president roles', async () => {
    const denied = harness('review', { user: { id: 1, roles: ['president'] } });
    await denied.page.onShow(); expect(denied.page.data.allowed).toBe(false); expect(denied.calls.some(call => call.path.includes('mode=review'))).toBe(false);
    const allowed = harness('review', { user: { id: 1, roles: ['member'] }, request: path => path === '/api/miniapp/workbench'
      ? { reviewCommunity: true } : pageResult([application('pending', { actions: { review: true } })]) });
    await allowed.page.onShow(); expect(allowed.page.data.allowed).toBe(true); expect(allowed.page.data.docs).toHaveLength(1);
    expect(allowed.calls.some(call => call.path.startsWith('/api/users/'))).toBe(false);
  });

  it('submits distinct return decisions with revision and retains review notes on a rejected write', async () => {
    const h = harness('review', { modalAuto: false, request: (path, options) => {
      if (options.method === 'POST') throw Object.assign(new Error('无权审核社群申请'), { status: 403 });
      return path === '/api/miniapp/workbench' ? { reviewCommunity: true } : pageResult([application('pending', { actions: { review: true } })]);
    } });
    await h.page.onShow(); h.page.note(event({ id: 17 }, '合成测试：请补充活动计划'));
    const first = h.page.decide(event({ id: 17, decision: 'returned' })); await h.page.decide(event({ id: 17, decision: 'approved' }));
    expect(h.wx.showModal).toHaveBeenCalledTimes(1); h.modals[0].success({ confirm: true }); await first;
    expect(h.calls.find(call => call.options.method === 'POST')?.options.data).toEqual({ action: 'review', id: 17, revision: 'synthetic-v1', decision: 'returned', reviewNote: '合成测试：请补充活动计划' });
    expect(h.page.data.docs[0].reviewDraft).toBe('合成测试：请补充活动计划'); expect(h.page.data.operationError).toContain('无权');
  });

  it('separates contacts failure from existing social content and retries authorized cards without writing', async () => {
    let fail = true;
    const h = harness('community', { cmsSocial: async () => pageResult([{ id: 31, title: '合成测试活动', category: 'event' }]), request: path => {
      if (path.endsWith('/contacts')) { if (fail) throw new Error('合成名片断网'); return [{ id: 5, name: '合成测试管理员', qr }]; }
      if (path.endsWith('/join')) return { record: null, actions: { request: true }, canHandle: false };
      return { staffBatches: [], promotions: {} };
    } });
    await h.page.onShow(); expect(h.page.data.error).toBe(''); expect(h.page.data.contactsError).toBe('合成名片断网'); expect(h.page.data.docs[0].title).toBe('合成测试活动');
    fail = false; await h.page.retryContacts(); expect(h.page.data.contactsError).toBe('');
    h.page.previewImage(event({ url: h.page.data.contacts[0].image })); expect(h.wx.previewImage).toHaveBeenCalledTimes(1);
    expect(h.calls.some(call => call.options.method === 'POST')).toBe(false);
  });

  it('records an explicit contact intent once and displays the returned receipt without asserting membership', async () => {
    let saved = false;
    const h = harness('community', { modalAuto: false, request: (path, options) => {
      if (path.endsWith('/contacts')) return [{ id: 5, name: '合成测试管理员', qr }];
      if (options.method === 'POST') { saved = true; return { record: joined() }; }
      if (path.endsWith('/join')) return { record: saved ? joined() : null, actions: saved ? { reportFriend: true, withdraw: true } : { request: true }, canHandle: false };
      return { staffBatches: [], promotions: {} };
    } });
    await h.page.onShow(); const first = h.page.joinAction(event({ action: 'request', contact: 5 })); await h.page.joinAction(event({ action: 'request', contact: 5 }));
    expect(h.wx.showModal).toHaveBeenCalledTimes(1); h.modals[0].success({ confirm: true }); await first;
    expect(h.calls.filter(call => call.options.method === 'POST')).toHaveLength(1);
    expect(h.calls.find(call => call.options.method === 'POST')?.options.data).toEqual({ action: 'request', contact: 5 });
    expect(h.page.data.join?.status).toBe('requested'); expect(h.page.data.join?.statusText).toContain('联系管理员'); expect(h.page.data.joinActions.reportFriend).toBe(true);
  });

  it('uses only server-approved manual handling actions and does not send a second write while a modal is open', async () => {
    const row = joined({ actions: { confirmFriend: true, confirmJoined: false } });
    const h = harness('community-joins', { modalAuto: false, request: (_path, options) => options.method === 'POST'
      ? { record: joined({ status: 'awaitingInvite', updatedAt: 'synthetic-join-v2', actions: { confirmJoined: true } }) }
      : { ...pageResult([row]), canHandle: true } });
    await h.page.onShow(); await h.page.handle(event({ id: 23, action: 'confirmJoined' })); expect(h.wx.showModal).not.toHaveBeenCalled();
    h.page.note(event({ id: 23 }, '合成测试：已在微信核实'));
    const first = h.page.handle(event({ id: 23, action: 'confirmFriend' })); await h.page.handle(event({ id: 23, action: 'confirmFriend' }));
    expect(h.wx.showModal).toHaveBeenCalledTimes(1); h.modals[0].success({ confirm: true }); await first;
    expect(h.calls.filter(call => call.options.method === 'POST')).toHaveLength(1);
    expect(h.calls.find(call => call.options.method === 'POST')?.options.data).toEqual({ action: 'confirmFriend', id: 23, revision: 'synthetic-join-v1', note: '合成测试：已在微信核实' });
  });

  it('clears a denied manual workbench despite a stored manager role and supports retry', async () => {
    let denied = true;
    const h = harness('community-joins', { user: { id: 1, roles: ['communityAdmin'] }, request: () => {
      if (denied) throw Object.assign(new Error('无权处理此社群进群'), { status: 403 });
      return { ...pageResult([joined({ actions: { confirmFriend: true } })]), canHandle: true };
    } });
    await h.page.onShow(); expect(h.page.data.docs).toHaveLength(0); expect(h.page.data.allowed).toBe(false);
    denied = false; await h.page.load(); expect(h.page.data.allowed).toBe(true); expect(h.page.data.docs).toHaveLength(1);
  });

  it('V2 选拔中心 staff entries route to the same batch from the server recruitment center without promotion reads', async () => {
    // V2 IA: the communities directory no longer hosts staff entries; 选拔中心 does (GET /api/v2/recruitment).
    const h = harness('recruitment', { request: path => path.startsWith('/api/v2/recruitment')
      ? { staff: [staffCall(44)], teams: null, mine: null }
      : Promise.reject(new Error('Unexpected synthetic request: ' + path)) });
    await h.page.onShow(); h.page.staffPage();
    const call = (h.page.data.staff as unknown as Record<string, unknown>[])[0];
    expect(call).toMatchObject({ title: '合成测试骨干批次', page: 'signup', params: { kind: 'staff', id: 44 } });
    h.page.openPage(event({ page: call.page, params: call.params }));
    expect(h.navigation.go).toHaveBeenCalledWith('staff'); expect(h.navigation.go).toHaveBeenCalledWith('signup', { kind: 'staff', id: 44 });
    expect(h.calls.some(request => request.path.startsWith('/api/content-promotions'))).toBe(false);
  });

  it.each(['community'])('routes %s staff entries to the same batch and uses approved club projection', async name => {
    const h = harness(name, { request: path => path.endsWith('/contacts') ? [] : path.endsWith('/join')
      ? { record: null, actions: {}, canHandle: false } : { staffBatches: [{ id: 44, title: '合成测试骨干批次', state: '申请开放' }], promotions: { event: [{ sourceKey: 'community-posts:31', snapshot: { title: '合成活动' } }] } } });
    await h.page.onShow(); h.page.staff(); h.page.applyStaff(event({ id: 44 }));
    expect(h.navigation.go).toHaveBeenCalledWith('staff'); expect(h.navigation.go).toHaveBeenCalledWith('signup', { kind: 'staff', id: 44 });
    expect(h.page.data.staffBatches[0].id).toBe(44); expect(h.page.data.promotions[0].kindText).toBe('社团活动');
    expect(h.calls.some(call => call.path.startsWith('/api/content-promotions'))).toBe(false);
  });

  it('preserves image/video previews and does not skip a social page during repeated load-more taps', async () => {
    const second = deferred<unknown>();
    const h = harness('community', { cmsSocial: (_collection, options) => options.page === 2 ? second.promise
      : pageResult([{ id: 32, images: [{ source: qr, caption: '合成测试照片' }], videoURL: 'https://example.invalid/synthetic.mp4' }], 1, true) });
    await h.page.onShow(); await h.page.area(event({ area: 'showcase' }));
    expect(h.page.data.docs[0].videoSource).toBe('https://example.invalid/synthetic.mp4'); expect(h.page.data.docs[0].localImages).toEqual([{ source: 'wxfile://synthetic-private.png', caption: '合成测试照片' }]);
    const first = h.page.loadArea(true); await h.page.loadArea(true); expect(h.page.data.page).toBe(1);
    expect(h.cms.social.mock.calls.filter(call => call[1]?.page === 2)).toHaveLength(1);
    second.resolve(pageResult([{ id: 33 }], 2)); await first; expect(h.page.data.page).toBe(2); expect(h.page.data.docs.map(doc => doc.id)).toEqual([32, 33]);
  });
});

describe('Private native lifecycle — synthetic VM only', () => {
  it.each(['applications', 'review', 'community', 'community-joins', 'communities'])('clears %s private data on account changes and ignores old async replies', async name => {
    const pending = deferred<unknown>();
    const h = harness(name, { request: path => path === '/api/miniapp/workbench' ? { reviewCommunity: true }
      : path === '/api/miniapp/club' ? { staffBatches: [], promotions: {} } : pending.promise,
      cmsList: async () => name === 'communities' ? pending.promise : pageResult([]),
      cmsDetail: async () => name === 'community' ? pending.promise : {} });
    h.page.setData({ docs: [application()], realName: '合成测试旧账号', qr: 'wxfile://synthetic-private.png' }); h.page._qr = qr;
    const loading = h.page.onShow(); await flush(); h.changeUser(null);
    pending.resolve({ ...pageResult([application()]), id: 9, title: '迟到的合成数据', canHandle: true, actions: { request: true } });
    await loading;
    expect(h.page.data.docs).toHaveLength(0); expect(h.page.data.needsLogin).toBe(true); expect(h.page.data.loading).toBe(false);
    if (name === 'applications') { expect(h.page.data.realName).toBe(''); expect(h.page.data.qr).toBe(''); expect(h.page._qr).toBe(''); }
    h.page.onUnload();
  });

  it.each(['applications', 'review', 'community', 'community-joins', 'communities'])('ignores %s loads that finish after onHide', async name => {
    const pending = deferred<unknown>();
    const h = harness(name, { request: path => path === '/api/miniapp/workbench' ? { reviewCommunity: true }
      : path === '/api/miniapp/club' ? { staffBatches: [], promotions: {} } : pending.promise,
      cmsList: async () => name === 'communities' ? pending.promise : pageResult([]),
      cmsDetail: async () => name === 'community' ? pending.promise : {} });
    const loading = h.page.onShow(); await flush(); h.page.onHide();
    pending.resolve({ ...pageResult([application()]), id: 9, title: '迟到的合成数据', canHandle: true }); await loading;
    expect(h.page.data.docs).toHaveLength(0); expect(h.page.data.loading).toBe(false);
  });
});
