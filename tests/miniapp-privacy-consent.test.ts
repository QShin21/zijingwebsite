import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Setting = { needAuthorization: boolean; privacyContractName: string };
type Callback = { success(value?: unknown): void; fail(): void };
type SettingCallback = { success(value: Setting): void; fail(): void };
type Resolution = { event: string; buttonId?: string };
type Doc = { id: number; _status: string; title: string; summary?: string; body?: unknown; sections?: unknown[] };
type RequestCallback = { url: string; method: string; header: Record<string, string>; data: unknown;
  success(value: { statusCode: number; data: unknown }): void; fail(): void };
type DialogData = { shown: boolean; loading: boolean; error: string; title: string; nodes: unknown[]; sections: unknown[]; links: unknown[];
  docReady: boolean; sdkReady: boolean; contractName: string; contractOpening: boolean; contractOpened: boolean };
type Dialog = { data: DialogData; setData(value: Partial<DialogData>): void; available(): boolean; stop(): void;
  present(request: unknown): Promise<void>; close(request: unknown): void; cancel(cause?: Error): void; deny(): void;
  retry(): Promise<void>; load(): Promise<void>; waitForAgreement(request: unknown): void; openPlatform(): Promise<void>;
  agree(value: { currentTarget: { id: string } }): void };
type Definition = { data: DialogData; methods: Omit<Dialog, 'data' | 'setData'>;
  lifetimes: { attached(this: Dialog): void; detached(this: Dialog): void };
  pageLifetimes: { show(this: Dialog): void; hide(this: Dialog): void } };
type Privacy = { setup(): boolean; authorize(): Promise<void>; setting(): Promise<Setting>; openContract(): Promise<void> };
type Session = { save(value: unknown): void; clear(): void };
const textBody = (text = '合成测试隐私正文：图片和视频仅由用户主动选择。') => ({ root: { children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] } });
const policy = (): Doc => ({ id: 77, _status: 'published', title: '合成测试网站隐私说明', body: textBody() });
const flush = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
const caught = (pending: Promise<void>) => pending.then(() => null, cause => cause as Error);
function harness(options: { docs?: Doc[]; needAuthorization?: boolean; autoCMS?: boolean; autoSDK?: boolean; delayNeed?: boolean; setting?: Partial<Setting> } = {}) {
  let saved: unknown = { token: 'synthetic-only-privacy-token', exp: 9999999999,
    user: { id: 7, roles: ['member'], accountStatus: 'active', name: '合成账号' } };
  let needHandler: ((resolve: (value: Resolution) => void) => void) | undefined;
  let top: unknown;
  let buttonClicked = false;
  const requests: RequestCallback[] = [], authorizations: Callback[] = [], contracts: Callback[] = [], settings: SettingCallback[] = [];
  const resolutions: Resolution[] = [];
  const docs = options.docs || [policy()];
  function need(index = authorizations.length - 1) {
    const value = authorizations[index];
    needHandler?.(result => {
      resolutions.push(result);
      if (result.event === 'agree') {
        if (!buttonClicked || result.buttonId !== 'zijing-privacy-agree') throw new Error('synthetic SDK: official button was not clicked');
        if (options.autoSDK !== false) value.success();
      } else if (result.event === 'disagree' && options.autoSDK !== false) value.fail();
    });
  }
  function cmsReply(index = requests.length - 1, values = docs, statusCode = 200) {
    const published = values.find(doc => doc._status === 'published');
    const data = statusCode === 200
      ? { ...published, key: 'privacy', updatedAt: published ? '2026-11-12T00:00:00.000Z' : null }
      : { error: '合成读取失败' };
    requests[index].success({ statusCode, data });
  }
  const wx = {
    getStorageSync: () => saved, setStorageSync: (_key: string, value: unknown) => { saved = value; }, removeStorageSync: () => { saved = null; },
    env: { USER_DATA_PATH: '/synthetic-privacy' },
    getFileSystemManager: () => ({ readdir: (value: { success(data: { files: string[] }): void }) => value.success({ files: [] }) }),
    chooseMedia: vi.fn(), readFile: vi.fn(), uploadFile: vi.fn(), downloadFile: vi.fn(), requestSubscribeMessage: vi.fn(),
    request: vi.fn((value: RequestCallback) => { requests.push(value); if (options.autoCMS !== false) cmsReply(); return { abort: vi.fn() }; }),
    onNeedPrivacyAuthorization: vi.fn((listener: typeof needHandler) => { needHandler = listener; }),
    getPrivacySetting: vi.fn((value: SettingCallback) => {
      settings.push(value); value.success({ needAuthorization: options.needAuthorization !== false, privacyContractName: '合成测试微信平台隐私指引', ...options.setting });
    }),
    requirePrivacyAuthorize: vi.fn((value: Callback) => {
      authorizations.push(value);
      if (options.needAuthorization === false) { if (options.autoSDK !== false) value.success(); return; }
      if (!options.delayNeed) need();
    }),
    openPrivacyContract: vi.fn((value: Callback) => contracts.push(value)),
  };
  let definition!: Definition;
  const modules = new Map<string, { exports: unknown }>();
  function load(filename: string): unknown {
    filename = resolve(filename);
    if (modules.has(filename)) return modules.get(filename)!.exports;
    const module = { exports: {} as unknown }; modules.set(filename, module);
    runInNewContext(readFileSync(filename, 'utf8'), { module, wx, setTimeout, clearTimeout,
      Component: (value: Definition) => { definition = value; }, getCurrentPages: () => top ? [top] : [],
      require: (name: string) => load(resolve(dirname(filename), name + '.js')) });
    return module.exports;
  }
  load('miniprogram/src/components/privacy-consent/index.js');
  const dialog = { ...definition.methods, data: structuredClone(definition.data), setData(value: Partial<DialogData>) { Object.assign(this.data, value); } } as Dialog;
  definition.lifetimes.attached.call(dialog);
  const page = { selectComponent: (selector: string) => selector === '#privacyConsent' ? dialog : null };
  top = page;
  const privacy = load('miniprogram/src/lib/privacy.js') as Privacy;
  const session = load('miniprogram/src/lib/session.js') as Session;
  function account() { session.save({ token: 'synthetic-only-other-token', exp: 9999999999, user: { id: 8, roles: ['member'], accountStatus: 'active' } }); }
  function hide() { definition.pageLifetimes.hide.call(dialog); }
  function show() { definition.pageLifetimes.show.call(dialog); }
  function unload() { definition.lifetimes.detached.call(dialog); }
  function agree(id = 'zijing-privacy-agree') { buttonClicked = true; dialog.agree({ currentTarget: { id } }); }
  function unprompted() { const resolve = vi.fn(); needHandler?.(resolve); return resolve; }
  function noMedia() {
    expect(wx.chooseMedia).not.toHaveBeenCalled(); expect(wx.readFile).not.toHaveBeenCalled();
    expect(wx.uploadFile).not.toHaveBeenCalled(); expect(wx.downloadFile).not.toHaveBeenCalled(); expect(wx.requestSubscribeMessage).not.toHaveBeenCalled();
    expect(requests.every(value => value.method === 'GET' && !value.header.Authorization)).toBe(true);
  }
  return { privacy, dialog, wx, session, account, hide, show, unload, agree, unprompted, noMedia, requests, authorizations, resolutions, contracts,
    settings, docs, cmsReply, need, load, route: () => { top = {}; }, restore: () => { top = page; } };
}
function videoConsumer(h: ReturnType<typeof harness>) {
  const bytes = Buffer.alloc(64); bytes.writeUInt32BE(24, 0); bytes.write('ftypisom', 4); bytes.write('iso2mp41', 16);
  const paths = new Map<string, Buffer>([['/synthetic-picked/video.mp4', bytes]]);
  const stat = vi.fn((value: { path: string; success(result: unknown): void }) => value.success({ stats: { size: paths.get(value.path)!.length, isFile: () => true } }));
  const readFile = vi.fn((value: { filePath: string; position: number; length: number; success(result: { data: ArrayBuffer }): void }) => {
    const data = paths.get(value.filePath)!.subarray(value.position, value.position + value.length);
    value.success({ data: Uint8Array.from(data).buffer });
  });
  const copyFile = vi.fn((value: { srcPath: string; destPath: string; success(): void }) => { paths.set(value.destPath, paths.get(value.srcPath)!); value.success(); });
  const fs = { stat, readFile, copyFile, unlink: vi.fn(), readdir: (value: { success(result: { files: string[] }): void }) => value.success({ files: [] }) };
  Object.assign(h.wx, { getFileSystemManager: () => fs });
  h.wx.chooseMedia.mockImplementation((value: { success(result: unknown): void }) => value.success({ tempFiles: [{ tempFilePath: '/synthetic-picked/video.mp4', size: 64, fileType: 'video' }] }));
  const media = h.load('miniprogram/src/lib/honor-media.js') as { chooseVideo(options: { isCurrent(): boolean }): Promise<{ filePath: string; size: number }> };
  return { media, stat, readFile, copyFile };
}
afterEach(() => vi.useRealTimers());

describe('native published privacy content + official consent lifecycle (synthetic SDK, no WeChat runtime)', () => {
  it('loads actual modules without network/media/privacy prompts; setup only registers once', () => {
    const h = harness(); expect(h.requests).toHaveLength(0); expect(h.authorizations).toHaveLength(0); h.noMedia();
    expect(h.privacy.setup()).toBe(true); expect(h.privacy.setup()).toBe(true); expect(h.wx.onNeedPrivacyAuthorization).toHaveBeenCalledTimes(1);
    expect(h.requests).toHaveLength(0); expect(h.contracts).toHaveLength(0);
    expect(h.unprompted()).toHaveBeenCalledWith({ event: 'disagree' });
  });
  it('first use loads an anonymous published website body, opens a separate platform contract, then requires the official button', async () => {
    const h = harness(); const pending = h.privacy.authorize();
    expect(h.dialog.data.loading).toBe(true); expect(h.authorizations).toHaveLength(0); h.agree(); expect(h.resolutions).toHaveLength(0);
    await flush();
    expect(h.requests).toHaveLength(1); const url = new URL(h.requests[0].url);
    expect(url.pathname).toBe('/api/v2/pages/privacy');
    expect(h.requests[0].header.Authorization).toBeUndefined();
    expect(h.dialog.data).toMatchObject({ shown: true, docReady: true, sdkReady: true, contractOpened: false, contractName: '合成测试微信平台隐私指引' });
    expect(h.dialog.data.nodes.length).toBeGreaterThan(0);
    h.agree(); expect(h.resolutions).toHaveLength(0); // website content alone is insufficient
    const opened = h.dialog.openPlatform(); expect(h.contracts).toHaveLength(1); h.agree(); expect(h.resolutions).toHaveLength(0);
    h.contracts[0].success(); await opened; expect(h.dialog.data.contractOpened).toBe(true); expect(h.resolutions).toHaveLength(0);
    h.agree('other-button'); expect(h.resolutions).toHaveLength(0);
    h.agree(); await pending;
    expect(h.resolutions).toEqual([{ event: 'agree', buttonId: 'zijing-privacy-agree' }]); expect(h.dialog.data.shown).toBe(false); h.noMedia();
  });
  it('actual honor-media consumer reaches chooser/read/copy only after the loaded document and real component agreement', async () => {
    const h = harness(), consumer = videoConsumer(h); const pending = consumer.media.chooseVideo({ isCurrent: () => true }); await flush();
    expect(h.wx.chooseMedia).not.toHaveBeenCalled(); expect(consumer.readFile).not.toHaveBeenCalled();
    const opened = h.dialog.openPlatform(); h.contracts[0].success(); await opened;
    expect(h.wx.chooseMedia).not.toHaveBeenCalled(); h.agree(); const video = await pending;
    expect(video).toMatchObject({ size: 64, filePath: expect.stringContaining('/zijing-private-honor-') });
    expect(h.wx.chooseMedia).toHaveBeenCalledTimes(1); expect(consumer.copyFile).toHaveBeenCalledTimes(1);
    expect(consumer.stat).toHaveBeenCalledTimes(2); expect(consumer.readFile).toHaveBeenCalledTimes(2);
    expect(h.wx.uploadFile).not.toHaveBeenCalled(); expect(h.wx.requestSubscribeMessage).not.toHaveBeenCalled();
  });
  it('actual consumer preserves its page context guard when reading the platform contract hides the form', async () => {
    const h = harness(), consumer = videoConsumer(h); let current = true;
    const pending = consumer.media.chooseVideo({ isCurrent: () => current }).catch(cause => cause as Error); await flush();
    const opened = h.dialog.openPlatform(); h.contracts[0].success(); await opened;
    current = false; h.hide(); h.show(); h.agree(); expect((await pending as Error).message).toContain('页面或账号');
    expect(h.wx.chooseMedia).not.toHaveBeenCalled(); expect(consumer.readFile).not.toHaveBeenCalled(); expect(consumer.copyFile).not.toHaveBeenCalled();
  });
  it('already-authorized SDK users still load a nonempty website policy before auxiliary success', async () => {
    const h = harness({ needAuthorization: false, autoCMS: false }); const pending = h.privacy.authorize();
    expect(h.authorizations).toHaveLength(0); h.cmsReply(); await pending;
    expect(h.authorizations).toHaveLength(1); expect(h.resolutions).toHaveLength(0); expect(h.contracts).toHaveLength(0); h.noMedia();
  });
  it('privacy operator and contact text is preserved exactly rather than rewritten by client branding', async () => {
    const original = '合成示例运营主体：清华大学学生紫荆电竞社；合成联系渠道：紫荆电竞社。';
    const h = harness({ docs: [{ ...policy(), title: '紫荆电竞社隐私说明', body: textBody(original) }] });
    const pending = caught(h.privacy.authorize()); await flush();
    expect(h.dialog.data.title).toBe('紫荆电竞社隐私说明'); expect(JSON.stringify(h.dialog.data.nodes)).toContain(original);
    h.dialog.deny(); await pending; h.noMedia();
  });
  const empty: [string, Doc[]][] = [
    ['absent', []], ['draft', [{ ...policy(), _status: 'draft' }]], ['empty body', [{ ...policy(), body: textBody('') }]],
    ['whitespace and invisible chars', [{ ...policy(), body: textBody(' \n\u200b\ufeff') }]],
    ['summary only', [{ id: 77, _status: 'published', title: '合成标题', summary: '摘要不能替代隐私正文' }]],
    ['empty sections', [{ ...policy(), body: null, sections: [{ heading: '合成空章节', text: ' \n ' }] }]],
    ['invisible sections', [{ ...policy(), body: null, sections: [{ heading: '合成空章节', text: '\u200b\ufeff' }] }]],
    ['image only', [{ ...policy(), body: { root: { children: [{ type: 'upload', value: { url: '/synthetic.png' } }] } } }]],
  ];
  it.each(empty)('%s cannot start SDK authorization or agree, including already-authorized users', async (_label, docs) => {
    const h = harness({ docs, needAuthorization: false }); const pending = caught(h.privacy.authorize()); await flush();
    expect(h.dialog.data).toMatchObject({ shown: true, loading: false, docReady: false, sdkReady: false });
    expect(h.dialog.data.error).toContain('正文'); expect(h.authorizations).toHaveLength(0); h.agree(); expect(h.resolutions).toHaveLength(0);
    h.dialog.deny(); expect((await pending)?.message).toContain('未读取'); h.noMedia();
  });
  it('text sections are usable published body and cannot be confused with platform content', async () => {
    const h = harness({ docs: [{ ...policy(), body: null, sections: [{ heading: '测试章节', text: '合成非空隐私正文。' }] }] });
    const pending = caught(h.privacy.authorize()); await flush();
    expect(h.dialog.data.docReady).toBe(true); expect(h.dialog.data.sections).toEqual([{ heading: '测试章节', text: '合成非空隐私正文。' }]);
    h.dialog.deny(); await pending; h.noMedia();
  });
  it('denial settles the SDK once, blocks late success, and permits a new explicit attempt', async () => {
    const h = harness({ autoSDK: false }); const pending = caught(h.privacy.authorize()); await flush();
    h.dialog.deny(); h.dialog.deny(); h.authorizations[0].success(); expect((await pending)?.message).toContain('未读取');
    expect(h.resolutions).toEqual([{ event: 'disagree' }]); expect(h.dialog.data.shown).toBe(false);
    const retry = caught(h.privacy.authorize()); await flush(); expect(h.authorizations).toHaveLength(2); h.dialog.deny(); await retry; h.noMedia();
  });
  it('weak-network cancellation blocks a late policy response and is repeatable', async () => {
    const h = harness({ autoCMS: false }); const pending = caught(h.privacy.authorize());
    h.dialog.deny(); h.cmsReply(); await flush(); expect((await pending)?.message).toContain('未读取');
    expect(h.authorizations).toHaveLength(0); expect(h.dialog.data.shown).toBe(false);
    const retry = caught(h.privacy.authorize()); h.cmsReply(); await flush(); expect(h.authorizations).toHaveLength(1); h.dialog.deny(); await retry; h.noMedia();
  });
  it('CMS network failure offers explicit retry without SDK/media calls', async () => {
    const h = harness({ autoCMS: false }); const pending = caught(h.privacy.authorize()); h.requests[0].fail(); await flush();
    expect(h.dialog.data.error.length).toBeGreaterThan(0); expect(h.authorizations).toHaveLength(0);
    const retry = h.dialog.retry(); expect(h.requests).toHaveLength(2); h.cmsReply(); await retry;
    expect(h.dialog.data.docReady).toBe(true); expect(h.authorizations).toHaveLength(1); h.dialog.deny(); await pending; h.noMedia();
  });
  it('empty content can be explicitly reloaded after publication and never auto retries', async () => {
    const h = harness({ docs: [] }); const pending = caught(h.privacy.authorize()); await flush();
    expect(h.requests).toHaveLength(1); h.docs.push(policy()); await h.dialog.retry();
    expect(h.requests).toHaveLength(2); expect(h.authorizations).toHaveLength(1); h.dialog.deny(); await pending;
  });
  it('double clicks and retries during loading produce one read and one auxiliary request', async () => {
    const h = harness({ autoCMS: false }); const pending = caught(h.privacy.authorize());
    expect((await caught(h.privacy.authorize()))?.message).toContain('正在处理'); await h.dialog.retry(); expect(h.requests).toHaveLength(1);
    h.cmsReply(); await flush(); await h.dialog.retry(); expect(h.authorizations).toHaveLength(1); expect(h.requests).toHaveLength(1);
    const first = h.dialog.openPlatform(); const second = h.dialog.openPlatform(); expect(h.contracts).toHaveLength(1);
    h.contracts[0].success(); await Promise.all([first, second]); h.agree(); h.agree(); await pending;
    expect(h.resolutions).toHaveLength(1); h.noMedia();
  });
  it.each(['hide', 'unload', 'account', 'logout'])('%s cancels pending SDK and ignores late replies/agree', async reason => {
    const h = harness({ autoSDK: false }); const pending = caught(h.privacy.authorize()); await flush();
    if (reason === 'hide') h.hide(); if (reason === 'unload') h.unload(); if (reason === 'account') h.account(); if (reason === 'logout') h.session.clear();
    h.show(); h.agree(); h.authorizations[0].success(); expect((await pending)?.message).toContain('页面或账号');
    expect(h.resolutions).toEqual([{ event: 'disagree' }]);
    if (reason === 'unload') expect(h.dialog.available()).toBe(false); else expect(h.dialog.data.docReady).toBe(false);
    h.noMedia();
  });
  it('route changes cannot resolve agreement; unload settles the suspended attempt', async () => {
    const h = harness({ autoSDK: false }); const pending = caught(h.privacy.authorize()); await flush();
    const opened = h.dialog.openPlatform(); h.contracts[0].success(); await opened;
    h.route(); h.agree(); expect(h.resolutions).toHaveLength(0); h.unload(); expect((await pending)?.message).toContain('页面或账号');
    h.restore(); h.authorizations[0].success(); expect(h.resolutions).toEqual([{ event: 'disagree' }]); h.noMedia();
  });
  it('owned platform navigation does not agree on open or while hidden; return still requires the official button', async () => {
    const h = harness(); const pending = h.privacy.authorize(); await flush();
    const opened = h.dialog.openPlatform(); h.hide(); h.contracts[0].success(); await opened;
    h.agree(); expect(h.resolutions).toHaveLength(0); h.show(); h.agree(); await pending;
    expect(h.resolutions).toEqual([{ event: 'agree', buttonId: 'zijing-privacy-agree' }]); h.noMedia();
  });
  it('platform success before hide keeps only its owned visit until return, with no automatic agreement', async () => {
    const h = harness(); const pending = h.privacy.authorize(); await flush();
    const opened = h.dialog.openPlatform(); h.contracts[0].success(); await opened;
    h.hide(); h.agree(); expect(h.resolutions).toHaveLength(0); h.show(); h.agree(); await pending;
    expect(h.resolutions).toEqual([{ event: 'agree', buttonId: 'zijing-privacy-agree' }]); h.noMedia();
  });
  it('a second hide cannot reuse a platform visit to retain authorization', async () => {
    const h = harness(); const pending = caught(h.privacy.authorize()); await flush();
    const opened = h.dialog.openPlatform(); h.contracts[0].success(); await opened;
    h.hide(); h.hide(); h.show(); h.agree(); expect((await pending)?.message).toContain('页面或账号');
    expect(h.resolutions).toEqual([{ event: 'disagree' }]); h.noMedia();
  });
  it('route navigation cannot borrow a previously opened platform visit', async () => {
    const h = harness(); const pending = caught(h.privacy.authorize()); await flush();
    const opened = h.dialog.openPlatform(); h.contracts[0].success(); await opened;
    h.route(); h.hide(); h.restore(); h.show(); h.agree(); expect((await pending)?.message).toContain('页面或账号');
    expect(h.resolutions).toEqual([{ event: 'disagree' }]); h.noMedia();
  });
  it('failed platform contract opening prevents agreement and permits explicit reopen', async () => {
    const h = harness(); const pending = h.privacy.authorize(); await flush();
    const opened = h.dialog.openPlatform(); h.contracts[0].fail(); await opened;
    expect(h.dialog.data.contractOpened).toBe(false); h.agree(); expect(h.resolutions).toHaveLength(0);
    const retry = h.dialog.openPlatform(); h.contracts[1].success(); await retry; h.agree(); await pending; h.noMedia();
  });
  it('account change while the platform contract opens blocks its late success', async () => {
    const h = harness(); const pending = caught(h.privacy.authorize()); await flush();
    const opened = h.dialog.openPlatform(); h.account(); h.contracts[0].success(); await opened;
    h.agree(); expect((await pending)?.message).toContain('账号'); expect(h.dialog.data.contractOpened).toBe(false);
    expect(h.resolutions).toEqual([{ event: 'disagree' }]); h.noMedia();
  });
  it('an unexpected SDK success before a required click cannot authorize file selection', async () => {
    const h = harness({ autoSDK: false }); const pending = caught(h.privacy.authorize()); await flush(); h.authorizations[0].success();
    expect((await pending)?.message).toContain('隐私授权状态'); expect(h.resolutions).toEqual([{ event: 'disagree' }]); h.noMedia();
  });
  it('old SDK callbacks do not settle a later explicit authorization attempt', async () => {
    const h = harness({ autoSDK: false }); const first = caught(h.privacy.authorize()); await flush(); h.dialog.deny(); await first;
    expect((await caught(h.privacy.authorize()))?.message).toContain('正在结束'); h.authorizations[0].fail();
    const second = caught(h.privacy.authorize()); await flush(); h.authorizations[0].success(); h.authorizations[0].fail();
    expect(h.dialog.data.shown).toBe(true); expect(h.dialog.data.sdkReady).toBe(true); h.dialog.deny(); await second;
    expect(h.resolutions).toEqual([{ event: 'disagree' }, { event: 'disagree' }]); h.noMedia();
  });
  it('cancelled auxiliary calls retain SDK ownership: delayed old onNeed is denied before any new attempt can start', async () => {
    const h = harness({ delayNeed: true, autoSDK: false }); const first = caught(h.privacy.authorize()); await flush();
    expect(h.authorizations).toHaveLength(1); expect(h.dialog.data.sdkReady).toBe(false);
    h.dialog.deny(); expect((await first)?.message).toContain('未读取');
    expect((await caught(h.privacy.authorize()))?.message).toContain('正在结束'); expect(h.authorizations).toHaveLength(1);
    h.need(0); expect(h.resolutions).toEqual([{ event: 'disagree' }]);
    expect((await caught(h.privacy.authorize()))?.message).toContain('正在结束'); h.authorizations[0].fail();
    const second = caught(h.privacy.authorize()); await flush(); expect(h.authorizations).toHaveLength(2); h.need(1);
    expect(h.dialog.data.sdkReady).toBe(true); const opened = h.dialog.openPlatform(); h.contracts[0].success(); await opened;
    h.agree(); expect(h.resolutions).toEqual([{ event: 'disagree' }, { event: 'agree', buttonId: 'zijing-privacy-agree' }]);
    h.authorizations[0].success(); expect(h.dialog.data.shown).toBe(true); h.authorizations[1].success(); expect(await second).toBeNull(); h.noMedia();
  });
  it('missing platform contract name stays closed even when needAuthorization is false', async () => {
    const h = harness({ needAuthorization: false, setting: { privacyContractName: '' } }); const pending = caught(h.privacy.authorize()); await flush();
    expect(h.dialog.data.error).toContain('尚未配置'); expect(h.authorizations).toHaveLength(0); h.dialog.deny(); await pending; h.noMedia();
  });
  it('platform settings timeout remains retryable and never starts the auxiliary request', async () => {
    vi.useFakeTimers(); const h = harness(); h.wx.getPrivacySetting.mockImplementation(value => { h.settings.push(value); });
    const pending = caught(h.privacy.authorize()); await vi.advanceTimersByTimeAsync(15000); await flush();
    expect(h.dialog.data.error).toContain('超时'); expect(h.authorizations).toHaveLength(0); h.dialog.deny(); await pending; h.noMedia();
  });
  it.each(['requirePrivacyAuthorize', 'onNeedPrivacyAuthorization', 'getPrivacySetting', 'openPrivacyContract'])('unsupported %s fails before the document, chooser or SDK', async name => {
    const h = harness(); Object.assign(h.wx, { [name]: undefined });
    expect((await caught(h.privacy.authorize()))?.message).toContain('升级微信'); expect(h.requests).toHaveLength(0); h.noMedia();
  });
  it('all media-entry pages register the real component and the official agreement button is only rendered after document gates', () => {
    for (const page of ['applications', 'team-profiles', 'team-honor-edit']) {
      const config = JSON.parse(readFileSync(`miniprogram/src/pages/${page}/index.json`, 'utf8'));
      expect(config.usingComponents['privacy-consent']).toBe('/components/privacy-consent/index');
      expect(readFileSync(`miniprogram/src/pages/${page}/index.wxml`, 'utf8')).toContain('<privacy-consent id="privacyConsent" />');
    }
    const wxml = readFileSync('miniprogram/src/components/privacy-consent/index.wxml', 'utf8');
    const button = wxml.split('\n').find(line => line.includes('open-type="agreePrivacyAuthorization"'))!;
    expect(button).toContain('wx:if="{{docReady && sdkReady && contractOpened && !contractOpening}}"');
    expect(button).toContain('bindagreeprivacyauthorization="agree"'); expect(button).not.toContain('bindtap=');
  });
});
