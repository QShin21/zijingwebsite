import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Real Page + http/session/page SDK consumers; wx transport and all records/files are synthetic.
// No socket, platform message, real credential, stored answer or production request is used.
type Values = Record<string, unknown>;
type Row = Values & { id: number; updatedAt: string; status: string; actions: Record<string, boolean>; contactConsent?: unknown; reviewDraft?: string };
type State = Values & { docs: Row[]; apply: boolean; mode: string; busy: boolean; loading: boolean; imageBusy: boolean;
  contactConsent: unknown; formError: string; operationError: string; qr: string; realName: string; phone: string; reason: string; revision: string };
type Event = { currentTarget: { dataset: Values }; detail: { value: unknown } };
type NativePage = { data: State; _qr: string; setData(values: Values, callback?: () => void): void;
  onLoad(options?: Record<string, string>): void; onShow(): Promise<void>; onHide(): void; onUnload(): void;
  submit(): Promise<void>; input(event: Event): void; consent(event: Event): void; newApplication(): void;
  openForm(event: Event): Promise<void>; chooseQr(): Promise<void>; decide(event: Event): Promise<void>; note(event: Event): void };
type SDKRequest = { url: string; method: string; data?: Values; header: Record<string, string>;
  success(response: { statusCode: number; data: unknown }): void; fail(): void };
type Session = { save(result: { token: string; exp: number; user: Values }): void; clear(): void };
type HarnessOptions = { docs?: Row[]; statusError?: number | 'network'; deferRender?: boolean; deferRead?: boolean; reviewAllowed?: boolean };
const source = (file: string) => readFileSync('miniprogram/src/' + file, 'utf8');
const consentLabel = '我同意展示我的微信名片作为进群联系方式';
const consentError = '由于入社流程规定，必须展示管理联系方式';
const reviewConsentError = '申请人尚未同意展示管理联系方式，请退回由本人补充同意后重新提交。';
const qr = 'data:image/png;base64,c3ludGhldGljLWNvbnNlbnQ=';
const event = (dataset: Values = {}, value: unknown = []): Event => ({ currentTarget: { dataset }, detail: { value } });
const row = (extra: Values = {}): Row => ({ id: 17, updatedAt: 'synthetic-v1', status: 'returned', game: null,
  proposedGame: '合成测试社群', realName: '合成测试申请人', phone: '00000000000', reason: '合成测试：每周组织游戏社群活动',
  contactConsent: false, actions: { edit: true }, ...extra });
const paged = (docs: Row[]) => ({ docs, page: 1, totalPages: 1, totalDocs: docs.length, hasNextPage: false });

function harness(name: 'applications' | 'review' = 'applications', options: HarnessOptions = {}) {
  let docs: Row[] = JSON.parse(JSON.stringify(options.docs || []));
  const storage = new Map<string, unknown>(), calls: SDKRequest[] = [], callbacks: (() => void)[] = [];
  const files = { clearPrivate: vi.fn(), choose: vi.fn(async () => ['wxfile://synthetic-consent.png']),
    readImage: vi.fn(async () => qr), localImage: vi.fn(async () => 'wxfile://synthetic-saved.png') };
  const privacy = { authorize: vi.fn(async () => {}), openContract: vi.fn(async () => {}) };
  const navigation = { back: vi.fn(), login: vi.fn(), go: vi.fn(), website: vi.fn(), copy: vi.fn(), content: vi.fn() };
  const cms = { list: vi.fn(async () => ({ docs: [{ id: 9, title: '合成测试已有社群' }] })) };
  const wx = {
    getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key), pageScrollTo: vi.fn(), stopPullDownRefresh: vi.fn(),
    previewImage: vi.fn(), showModal: vi.fn((value: { success(response: { confirm: boolean }): void }) => value.success({ confirm: true })),
    request: vi.fn((request: SDKRequest) => {
      calls.push(request);
      const url = new URL(request.url);
      expect(url.origin).toBe('https://home.thuzijing.top');
      const path = url.pathname;
      if (request.method === 'POST') {
        if (options.statusError === 'network') { request.fail(); return; }
        if (typeof options.statusError === 'number') {
          request.success({ statusCode: options.statusError, data: { error: '申请已更新，请刷新回执后核对' } }); return;
        }
        const data = request.data || {};
        const previous = docs.find(value => String(value.id) === String(data.id));
        const saved = row({ ...previous, ...data, updatedAt: 'synthetic-v2',
          status: data.action === 'card' ? 'approved' : data.action === 'review' ? data.decision : 'pending', actions: {} });
        docs = [saved];
        request.success({ statusCode: 200, data: { application: saved } }); return;
      }
      if (path === '/api/miniapp/workbench') {
        request.success({ statusCode: 200, data: { reviewCommunity: options.reviewAllowed !== false } }); return;
      }
      if (path === '/api/miniapp/community/applications') {
        if (!options.deferRead) request.success({ statusCode: 200, data: paged(docs) }); return;
      }
      if (path === '/api/community-applications/17') { request.success({ statusCode: 200, data: { wechatQr: qr } }); return; }
      throw new Error('Unmocked synthetic transport path ' + path);
    }),
  };
  const cache: Record<string, { exports: unknown }> = {};
  const stubs: Record<string, unknown> = { 'lib/files.js': files, 'lib/privacy.js': privacy, 'lib/navigation.js': navigation, 'lib/cms.js': cms };
  function load(file: string): unknown {
    if (stubs[file]) return stubs[file];
    if (cache[file]) return cache[file].exports;
    const module = cache[file] = { exports: {} };
    runInNewContext(source(file), { module, wx, require: (relative: string) => load(posix.normalize(posix.join(posix.dirname(file), relative + '.js'))) });
    return module.exports;
  }
  const session = load('lib/session.js') as Session;
  const changeUser = (id: number) => session.save({ token: 'synthetic-unused-token-' + id, exp: Math.floor(Date.now() / 1000) + 3600,
    user: { id, name: '合成测试账号' + id, roles: ['member'], accountStatus: 'active' } });
  changeUser(1);
  let page!: NativePage;
  const file = 'pages/' + name + '/index.js';
  runInNewContext(source(file), { Page: (value: NativePage) => { page = value; }, wx,
    require: (relative: string) => load(posix.normalize(posix.join(posix.dirname(file), relative + '.js'))) });
  page.setData = (values, callback) => {
    for (const [key, value] of Object.entries(values)) {
      const match = /^docs\[(\d+)\]\.(\w+)$/.exec(key);
      if (match) page.data.docs[Number(match[1])][match[2]] = value;
      else page.data[key] = value;
    }
    if (callback) { if (options.deferRender) callbacks.push(callback); else callback(); }
  };
  page.onLoad({ apply: '1' });
  return { page, wx, calls, files, privacy, session, changeUser, callbacks,
    writes: () => calls.filter(call => call.method === 'POST') };
}
type Harness = ReturnType<typeof harness>;
async function filled(options: HarnessOptions = {}) {
  const h = harness('applications', options); await h.page.onShow();
  for (const [field, value] of Object.entries({ proposedGame: '合成测试新游戏', realName: '合成测试申请人', phone: '00000000000', reason: '合成测试：尚未提交的完整组织计划' })) {
    h.page.input(event({ field }, value));
  }
  await h.page.chooseQr();
  return h;
}
function draft(h: Harness) {
  return { apply: h.page.data.apply, mode: h.page.data.mode, gameIndex: h.page.data.gameIndex,
    proposedGame: h.page.data.proposedGame, realName: h.page.data.realName, phone: h.page.data.phone, reason: h.page.data.reason,
    qr: h.page.data.qr, savedQr: h.page.data.savedQr, privateQr: h.page._qr, editId: h.page.data.editId, revision: h.page.data.revision };
}

describe('明确名片展示同意：真实原生Page与http/session，合成SDK transport', () => {
  it('新建默认不代勾，两次提交均可见精确错误，保留草稿及二维码且零业务请求', async () => {
    const h = await filled(), before = draft(h), initialRequests = h.calls.length;
    expect(h.page.data.contactConsent).toBe(false);
    await h.page.submit(); await h.page.submit();
    expect(h.page.data.formError).toBe(consentError); expect(h.page.data.contactConsent).toBe(false);
    expect(h.page.data.busy).toBe(false); expect(draft(h)).toEqual(before);
    expect(h.calls).toHaveLength(initialRequests); expect(h.writes()).toHaveLength(0);
    expect(h.wx.pageScrollTo).toHaveBeenCalledWith(expect.objectContaining({ selector: '#contact-consent', duration: 0 }));
    expect(h.wx.showModal).not.toHaveBeenCalled(); expect(h.privacy.authorize).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, 'true', 1])('提交严格要求布尔true，不接受伪造值%s', async value => {
    const h = await filled(); h.page.setData({ contactConsent: value });
    await h.page.submit(); expect(h.page.data.formError).toBe(consentError); expect(h.writes()).toHaveLength(0);
  });

  it('首个回执GET慢网尚未返回时也立即显示未同意原因，不增加请求或开始业务写', async () => {
    const h = harness('applications', { deferRead: true });
    const showing = h.page.onShow(); expect(h.page.data.loading).toBe(true);
    await h.page.submit(); expect(h.page.data.formError).toBe(consentError);
    expect(h.calls).toHaveLength(1); expect(h.writes()).toHaveLength(0); expect(h.page.data.busy).toBe(false);
    h.page.consent(event({}, ['contact'])); await h.page.submit(); expect(h.writes()).toHaveLength(0);
    h.calls[0].success({ statusCode: 200, data: paged([]) }); await showing;
    expect(h.writes()).toHaveLength(0); expect(h.page.data.realName).toBe('');
  });

  it('勾选只清除同意错误，不自动提交；明确再次提交只发一份true申请', async () => {
    const h = await filled(); await h.page.submit();
    h.page.consent(event({}, 'contact')); expect(h.page.data.contactConsent).toBe(false);
    h.page.consent(event({}, ['contact']));
    expect(h.page.data.contactConsent).toBe(true); expect(h.page.data.formError).toBe(''); expect(h.writes()).toHaveLength(0);
    await h.page.submit(); expect(h.writes()).toHaveLength(1);
    expect(h.writes()[0]).toMatchObject({ method: 'POST', header: { Authorization: 'JWT synthetic-unused-token-1' },
      data: { action: 'submit', contactConsent: true, game: null, realName: '合成测试申请人', wechatQr: qr } });
    expect(Object.keys(h.writes()[0].data || {}).sort()).toEqual(['action', 'contactConsent', 'game', 'phone', 'proposedGame', 'realName', 'reason', 'wechatQr'].sort());
    expect(h.page.data.apply).toBe(false); expect(h.page.data.contactConsent).toBe(false); expect(h.page._qr).toBe('');
  });

  it.each(['returned', 'withdrawn'])('旧%s申请false准确回显；未勾选保留原编号/修改/二维码，主动勾选后原编号重提', async status => {
    const h = harness('applications', { docs: [row({ status })] }); await h.page.onShow();
    await h.page.openForm(event({ id: 17, action: 'edit' }));
    h.page.input(event({ field: 'reason' }, '合成测试：已修改但尚未勾选的组织计划'));
    const before = draft(h), initialRequests = h.calls.length;
    expect(h.page.data.contactConsent).toBe(false); await h.page.submit();
    expect(h.page.data.formError).toBe(consentError); expect(draft(h)).toEqual(before);
    expect(h.calls).toHaveLength(initialRequests); expect(h.writes()).toHaveLength(0);
    h.page.consent(event({}, ['contact'])); await h.page.submit();
    expect(h.writes()).toHaveLength(1); expect(h.writes()[0].data).toMatchObject({ action: 'edit', id: 17, revision: 'synthetic-v1',
      contactConsent: true, wechatQr: qr, reason: '合成测试：已修改但尚未勾选的组织计划' });
  });

  it('原申请stored true准确回显，填写另一份时仍回到false', async () => {
    const h = harness('applications', { docs: [row({ contactConsent: true })] }); await h.page.onShow();
    await h.page.openForm(event({ id: 17, action: 'edit' })); expect(h.page.data.contactConsent).toBe(true);
    h.page.newApplication(); expect(h.page.data.contactConsent).toBe(false); expect(h.page.data.revision).toBe('');
    await h.page.submit(); expect(h.page.data.formError).toBe(consentError); expect(h.writes()).toHaveLength(0);
  });

  it.each([true, false])('已批准名片stored=%s仍可明确保存false，且不重写申请资料', async stored => {
    const h = harness('applications', { docs: [row({ status: 'approved', contactConsent: stored, actions: { card: true } })] });
    await h.page.onShow(); await h.page.openForm(event({ id: 17, action: 'card' })); expect(h.page.data.contactConsent).toBe(stored);
    h.page.consent(event({}, [])); await h.page.submit();
    expect(h.writes()).toHaveLength(1); expect(h.writes()[0].data).toEqual({ action: 'card', id: 17, revision: 'synthetic-v1', contactConsent: false });
    expect(h.page.data.formError).toBe('');
  });

  it.each(['network', 409] as const)('明确true后%s原失败仍保留同意/输入/QR，不自动补发', async statusError => {
    const h = await filled({ statusError }); h.page.consent(event({}, ['contact'])); const before = draft(h);
    await h.page.submit(); expect(h.writes()).toHaveLength(1); expect(h.writes()[0].data?.contactConsent).toBe(true);
    expect(h.page.data.formError).toBe(statusError === 'network' ? '连接失败，请检查网络后重试' : '申请已更新，请刷新回执后核对');
    expect(h.page.data.contactConsent).toBe(true); expect(draft(h)).toEqual(before); expect(h.page.data.busy).toBe(false);
  });

  it.each(['hide', 'account', 'route', 'unload', 'consent'])('%s变化后旧渲染回调不能迟到滚动或发请求', async change => {
    const h = await filled({ deferRender: true }); await h.page.submit(); expect(h.callbacks).toHaveLength(1);
    if (change === 'hide') h.page.onHide();
    if (change === 'account') h.changeUser(2);
    if (change === 'route') h.page.onLoad({ apply: '1' });
    if (change === 'unload') h.page.onUnload();
    if (change === 'consent') h.page.consent(event({}, ['contact']));
    h.callbacks[0](); expect(h.wx.pageScrollTo).not.toHaveBeenCalled(); expect(h.writes()).toHaveLength(0);
    if (['account', 'route', 'unload'].includes(change)) expect(h.page._qr).toBe('');
  });

  it('同意不能替代服务器edit授权', async () => {
    const h = harness('applications', { docs: [row({ actions: { edit: false } })] }); await h.page.onShow();
    h.page.setData({ mode: 'edit', editId: 17, revision: 'synthetic-v1', contactConsent: true }); await h.page.submit();
    expect(h.page.data.formError).toContain('刷新回执'); expect(h.writes()).toHaveLength(0);
  });
});

describe('旧管理员申请：原生审核提示与服务器授权不扩权', () => {
  it.each([false, undefined, 'true'])('stored consent=%s不能批准，不弹确认且可按现有权限退回本人', async contactConsent => {
    const h = harness('review', { docs: [row({ status: 'pending', contactConsent, actions: { review: true } })] }); await h.page.onShow();
    await h.page.decide(event({ id: 17, decision: 'approved' }));
    expect(h.page.data.operationError).toBe(reviewConsentError); expect(h.wx.showModal).not.toHaveBeenCalled();
    expect(h.writes()).toHaveLength(0); expect(h.page.data.busy).toBe(false);
    h.page.note(event({ id: 17 }, '请本人补充名片展示同意后重新提交'));
    await h.page.decide(event({ id: 17, decision: 'returned' }));
    expect(h.writes()).toHaveLength(1); expect(h.writes()[0].data).toEqual({ action: 'review', id: 17, revision: 'synthetic-v1',
      decision: 'returned', reviewNote: '请本人补充名片展示同意后重新提交' });
  });

  it('stored true与服务器review授权同时存在时沿用原审核API和revision', async () => {
    const h = harness('review', { docs: [row({ status: 'pending', contactConsent: true, actions: { review: true } })] }); await h.page.onShow();
    await h.page.decide(event({ id: 17, decision: 'approved' }));
    expect(h.writes()).toHaveLength(1); expect(h.writes()[0].data).toMatchObject({ action: 'review', id: 17, revision: 'synthetic-v1', decision: 'approved' });
  });

  it('stored true不能替代服务器review授权', async () => {
    const h = harness('review', { docs: [row({ status: 'pending', contactConsent: true, actions: { review: false } })] }); await h.page.onShow();
    await h.page.decide(event({ id: 17, decision: 'approved' })); expect(h.writes()).toHaveLength(0); expect(h.wx.showModal).not.toHaveBeenCalled();
  });

  it('申请checkbox使用精确文本、可访问错误和定位区域，提交按钮不会因未同意禁用', () => {
    const text = source('pages/applications/index.wxml');
    expect(text).toContain('<text>' + consentLabel + '</text>'); expect(text).toContain('aria-label="' + consentLabel + '"');
    expect(text).toContain('id="contact-consent"'); expect(text).toContain('checked="{{contactConsent}}"');
    expect(text).toContain('wx:if="{{formError}}" class="error" aria-role="alert"');
    expect(text).not.toContain('（可选）'); expect(text).toContain('<privacy-consent id="privacyConsent"');
    const submit = text.match(/<button[^>]*bindtap="submit"[^>]*>/)?.[0];
    expect(submit).toBeTruthy(); expect(submit).not.toContain('contactConsent');
  });

  it('批准按钮处在服务器review权限容器，另外只向stored true展示；社群入口说明申请要求', () => {
    const text = source('pages/review/index.wxml');
    expect(text).toContain('<view class="actions" wx:if="{{item.actions.review}}">');
    expect(text).toMatch(/<button wx:if="\{\{item\.contactConsent === true\}\}"[^>]*data-decision="approved"/);
    expect(text).toContain(reviewConsentError); expect(text).not.toContain('批准后不提供成员可见名片');
    expect(source('pages/community/index.wxml')).toContain('申请和修改重提时，需要本人主动同意展示微信名片作为进群联系方式');
  });
});
