import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type Data = Record<string, unknown>;
type Draft = { displayName: string; position: string; biography: string; avatar: string | null; visible: boolean };
type Own = Draft & { revision: number };
type DTO = { profiles: Data[]; own: { eligible: boolean; membershipVersion: string | null; profile: Own | null } };
type Event = { currentTarget: { dataset: { field?: string } }; detail: { value: string | boolean } };
type NativePage = {
  data: { loading: boolean; loaded: boolean; needsLogin: boolean; error: string; operationError: string; message: string; busy: boolean;
    profiles: Data[]; eligible: boolean; editing: boolean; previewing: boolean; locked: boolean; conflict: boolean; confirmationPending: boolean;
    draft: Omit<Draft, 'avatar'> & { hasAvatar: boolean }; draftAvatar: string; imageError: string };
  setData(value: Data): void; onLoad(options: { team: string; edit?: string }): void; onShow(): Promise<void>;
  onHide(): void; onUnload(): void; retry(): Promise<void>; load(): Promise<void>; reload(): Promise<void>;
  edit(): void; input(event: Event): void; consent(event: Event): void; preview(): void; returnToEdit(): void;
  save(): Promise<void>; cancel(): Promise<void>; chooseAvatar(): Promise<void>; removeAvatar(): Promise<void>;
  openPrivacy(): Promise<void>; login(): void; back(): void;
};
type RequestOptions = { url: string; method: string; header: Record<string, string>; data?: Data;
  success(value: { statusCode: number; data: unknown }): void; fail(): void };
type Callback = { success(): void; fail(): void };
type PrivacyRequest = { start(needAuthorization: boolean): void };
type FileWrite = Callback & { filePath: string; data: string; encoding: string };
type FileRead = { filePath: string; success(result: { data: ArrayBuffer }): void; fail(): void };
type Modal = { success(value: { confirm: boolean }): void; fail(): void };
type Selection = { count: number; mediaType: string[]; success(value: { tempFiles: { tempFilePath: string }[] }): void; fail(): void };
type Consumer = { view(value: unknown): unknown; avatar(value: unknown): string | null; id(value: unknown): number | null };
const origin = 'https://home.thuzijing.top';
const endpoint = origin + '/api/team-profiles/51';
const periodOne = 'synthetic-period-one', periodTwo = 'synthetic-period-two';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlYQAAAAASUVORK5CYII=';
const original: Own = { displayName: '合成公开昵称', position: '合成位置', biography: '合成简短介绍', avatar: null, visible: true, revision: 3 };
const input = (field: string, value: string | boolean): Event => ({ currentTarget: { dataset: { field } }, detail: { value } });
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
function view(profile: Own | null = original, period: string | null = periodOne, eligible = true): DTO {
  return { profiles: [{ id: 201, displayName: '紫荆电竞 · 合成服务原文', position: '合成公开位置', biography: '合成已授权介绍', avatar: null,
    user: 999, membership: 801, answers: { private: 'synthetic-private-answer' } }],
    own: { eligible, membershipVersion: period, profile } };
}
function harness(options: { loggedIn?: boolean; autoWrite?: boolean; autoRead?: boolean } = {}) {
  let saved: unknown = options.loggedIn === false ? null : { token: 'synthetic-profile-token', exp: 9999999999,
    user: { id: 7, name: '合成账号', roles: ['member'], accountStatus: 'active' } };
  const requests: RequestOptions[] = [], writes: FileWrite[] = [], fileReads: FileRead[] = [], patches: Data[] = [];
  const authorizations: Callback[] = [], contracts: Callback[] = [], selections: Selection[] = [], modals: Modal[] = [];
  const unlink = vi.fn();
  const imageBytes = Buffer.from(png.split(',')[1], 'base64');
  const bytes = () => imageBytes.buffer.slice(imageBytes.byteOffset, imageBytes.byteOffset + imageBytes.byteLength) as ArrayBuffer;
  const fs = {
    readFile(value: FileRead) { fileReads.push(value); if (options.autoRead !== false) value.success({ data: bytes() }); },
    writeFile(value: FileWrite) { writes.push(value); if (options.autoWrite !== false) value.success(); },
    unlink,
    readdir(value: { success(result: { files: string[] }): void }) { value.success({ files: [] }); },
  };
  // Published policy/first agreement are tested by the real consent component.
  const policy = { loaded: true, text: '合成已发布网站隐私正文：用户主动选择后读取头像。' };
  const dialog = { available: () => policy.loaded && Boolean(policy.text.trim()),
    present: (request: PrivacyRequest) => request.start(false), close: vi.fn() };
  const currentPages = [{}, { selectComponent: (selector: string) => selector === '#privacyConsent' ? dialog : null }];
  const wx = {
    request: vi.fn((value: RequestOptions) => requests.push(value)), env: { USER_DATA_PATH: '/synthetic' }, getFileSystemManager: () => fs,
    getStorageSync: () => saved, setStorageSync: (_key: string, value: unknown) => { saved = value; }, removeStorageSync: () => { saved = null; },
    requirePrivacyAuthorize: vi.fn((value: Callback) => authorizations.push(value)), openPrivacyContract: vi.fn((value: Callback) => contracts.push(value)),
    onNeedPrivacyAuthorization: vi.fn(), getPrivacySetting: vi.fn(),
    chooseMedia: vi.fn((value: Selection) => selections.push(value)), showModal: vi.fn((value: Modal) => modals.push(value)),
    arrayBufferToBase64: (value: ArrayBuffer) => Buffer.from(value).toString('base64'),
    setNavigationBarTitle: vi.fn(), stopPullDownRefresh: vi.fn(), navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(),
    requestSubscribeMessage: vi.fn(), setClipboardData: vi.fn(), uploadFile: vi.fn(), downloadFile: vi.fn(),
  };
  const modules = new Map<string, { exports: unknown }>();
  function load(filename: string): unknown {
    filename = resolve(filename);
    if (modules.has(filename)) return modules.get(filename)!.exports;
    const module = { exports: {} as unknown }; modules.set(filename, module);
    runInNewContext(readFileSync(filename, 'utf8'), { module, wx, getCurrentPages: () => currentPages,
      require: (name: string) => load(resolve(dirname(filename), name + '.js')) });
    return module.exports;
  }
  const consumer = load('miniprogram/src/lib/team-profile.js') as Consumer;
  const session = load('miniprogram/src/lib/session.js') as { save(value: unknown): void; clear(): void; user(): { id: number } | null };
  let page!: NativePage;
  const filename = resolve('miniprogram/src/pages/team-profiles/index.js');
  runInNewContext(readFileSync(filename, 'utf8'), { wx, Page: (value: NativePage) => { page = value; },
    require: (name: string) => load(resolve(dirname(filename), name + '.js')) });
  page.setData = value => { patches.push(value); Object.assign(page.data, value); };
  const reply = (index: number, value: unknown, status = 200) => requests[index].success({ statusCode: status, data: value });
  return { page, wx, session, consumer, requests, writes, fileReads, patches, authorizations, contracts, selections, modals, unlink, bytes, reply };
}
type Harness = ReturnType<typeof harness>;
const reads = (h: Harness) => h.requests.filter(request => request.method === 'GET');
const puts = (h: Harness) => h.requests.filter(request => request.method === 'PUT');
async function ready(profile: Own | null = original, period: string | null = periodOne, eligible = true) {
  const h = harness(); h.page.onLoad({ team: '51' });
  const reading = h.page.onShow(); h.reply(0, view(profile, period, eligible)); await reading;
  expect(h.page.data).toMatchObject({ loading: false, loaded: true, error: '', eligible });
  return h;
}
function edit(h: Harness, checked = true) {
  h.page.edit(); h.page.input(input('displayName', '合成未保存昵称')); h.page.input(input('biography', '合成待保存介绍'));
  h.page.consent(input('', checked)); h.page.preview();
  expect(h.page.data.previewing).toBe(true);
}
function noPrivate(h: Harness) {
  expect(h.page.data.profiles).toEqual([]); expect(h.page.data.draft.displayName).toBe('');
  expect(h.page.data.draftAvatar).toBe(''); expect(h.page.data.editing).toBe(false);
  expect(JSON.stringify(h.patches)).not.toMatch(/membershipVersion|synthetic-period|synthetic-private-answer|"membership"|"user"/);
}

describe('原生简介真实Page/HTTP：周期凭据与本人展示选择', () => {
  it('读取使用网站JWT且保持原文字；setData只取白名单，不显示或持久化周期凭据/关系/答案', async () => {
    const h = await ready();
    expect(h.requests[0]).toMatchObject({ url: endpoint, method: 'GET', header: { Authorization: 'JWT synthetic-profile-token' } });
    expect(h.requests[0].header).not.toHaveProperty('Origin');
    expect(h.page.data.profiles).toEqual([{ id: 201, displayName: '紫荆电竞 · 合成服务原文', position: '合成公开位置', biography: '合成已授权介绍', avatarPath: '' }]);
    expect(JSON.stringify(h.patches)).not.toMatch(/membershipVersion|synthetic-period|synthetic-private-answer|"membership"|"user"|"revision"/);
    expect(h.wx.chooseMedia).not.toHaveBeenCalled(); expect(h.wx.requirePrivacyAuthorize).not.toHaveBeenCalled();
    expect(h.wx.requestSubscribeMessage).not.toHaveBeenCalled();
  });

  it('首次简介revision必须为null，精确五字段通过既有PUT保存，保存后GET刷新', async () => {
    const h = await ready(null); edit(h);
    const sending = h.page.save();
    expect(puts(h)[0]).toMatchObject({ url: endpoint, header: { Origin: origin, Authorization: 'JWT synthetic-profile-token' },
      data: { revision: null, membershipVersion: periodOne, profile: { displayName: '合成未保存昵称', position: '', biography: '合成待保存介绍', avatar: null, visible: true } } });
    expect(Object.keys(puts(h)[0].data!).sort()).toEqual(['membershipVersion', 'profile', 'revision']);
    expect(Object.keys(puts(h)[0].data!.profile as Data).sort()).toEqual(['avatar', 'biography', 'displayName', 'position', 'visible']);
    const saved: Own = { ...original, displayName: '合成未保存昵称', position: '', biography: '合成待保存介绍', revision: 1 };
    h.reply(1, { profile: saved }); await flush();
    expect(reads(h)).toHaveLength(2);
    h.reply(2, view(saved)); await sending;
    expect(h.page.data).toMatchObject({ busy: false, locked: false, previewing: false, message: '简介已保存并选择展示' });
  });

  it('late-save成功后freshGET发现新周期，旧checked输入被锁且visible=false，明确reload才取得新凭据', async () => {
    const h = await ready(); edit(h);
    const sending = h.page.save(); const saved: Own = { ...original, displayName: '合成未保存昵称', biography: '合成待保存介绍', revision: 4 };
    h.reply(1, { profile: saved }); await flush();
    h.reply(2, view({ ...saved, visible: false }, periodTwo)); await sending;
    expect(h.page.data).toMatchObject({ locked: true, busy: false, draft: { visible: false } });
    expect(h.page.data.operationError).toContain('入队周期已更新');
    h.page.preview(); await h.page.save(); expect(puts(h)).toHaveLength(1);
    const reloading = h.page.reload(); expect(h.page.data.busy).toBe(true);
    h.modals[0].success({ confirm: true }); await flush();
    h.reply(3, view({ ...saved, visible: true }, periodTwo)); await reloading;
    expect(h.page.data).toMatchObject({ locked: false, draft: { visible: false } });
    h.page.edit(); h.page.preview(); const hiding = h.page.save();
    expect(puts(h)[1].data).toMatchObject({ revision: 4, membershipVersion: periodTwo, profile: { visible: false } });
    h.reply(4, { profile: { ...saved, visible: false, revision: 5 } }); await flush(); h.reply(5, view({ ...saved, visible: false, revision: 5 }, periodTwo)); await hiding;
    expect(h.page.data.draft.visible).toBe(false);
    expect(JSON.stringify(h.patches)).not.toContain('synthetic-period');
  });

  it('409 PROFILE_PERIOD_CHANGED锁旧周期；重载默认隐藏，用户主动再勾选才可公开新周期', async () => {
    const h = await ready(); edit(h);
    const sending = h.page.save(); h.reply(1, { error: '合成周期变化', code: 'PROFILE_PERIOD_CHANGED' }, 409); await sending;
    expect(h.page.data).toMatchObject({ locked: true, draft: { visible: false, displayName: '合成未保存昵称' } });
    h.page.preview(); expect(h.page.data.previewing).toBe(true); await h.page.save(); expect(puts(h)).toHaveLength(1);
    const reloading = h.page.reload(); h.modals[0].success({ confirm: true }); await flush(); h.reply(2, view({ ...original, visible: false }, periodTwo)); await reloading;
    h.page.edit(); expect(h.page.data.draft.visible).toBe(false);
    h.page.consent(input('', true)); h.page.preview(); const next = h.page.save();
    expect(puts(h)[1].data).toMatchObject({ revision: 3, membershipVersion: periodTwo, profile: { visible: true } });
    h.reply(3, { profile: { ...original, revision: 4 } }); await flush(); h.reply(4, view({ ...original, revision: 4 }, periodTwo)); await next;
    expect(h.page.data.locked).toBe(false);
  });

  it('普通后台GET不能把旧checked草稿换绑新周期；空资料也受相同保护', async () => {
    const h = await ready(null); edit(h);
    h.page.onHide(); const reading = h.page.onShow(); h.reply(1, view(null, periodTwo)); await reading;
    expect(h.page.data).toMatchObject({ locked: true, draft: { visible: false, displayName: '合成未保存昵称' } });
    h.page.preview(); await h.page.save(); expect(puts(h)).toHaveLength(0);
    expect(h.page.data.previewing).toBe(true);
  });

  it('同周期后台GET不替换首次editor revision；普通409保留输入与预览，需重新核对', async () => {
    const h = await ready(); edit(h);
    const reading = h.page.retry(); h.reply(1, view({ ...original, revision: 4 })); await reading;
    expect(h.page.data.draft.displayName).toBe('合成未保存昵称');
    const sending = h.page.save(); expect(puts(h)[0].data).toMatchObject({ revision: 3, membershipVersion: periodOne });
    h.reply(2, { error: '简介已在其他页面更新，请重新加载后核对', code: 'UNKNOWN_UNTRUSTED_CODE' }, 409); await sending;
    expect(h.page.data).toMatchObject({ locked: false, conflict: true, previewing: true, draft: { displayName: '合成未保存昵称', visible: true } });
    await h.page.save(); expect(puts(h)).toHaveLength(1);
    expect(h.page.data.operationError).toContain('重新加载后核对');
  });

  it('尚未收到周期变化提示时明确reload新周期，同样默认隐藏并丢弃旧checked草稿', async () => {
    const h = await ready(); edit(h); const reloading = h.page.reload();
    h.modals[0].success({ confirm: true }); await flush(); h.reply(1, view({ ...original, visible: true }, periodTwo)); await reloading;
    expect(h.page.data).toMatchObject({ locked: false, previewing: false, draft: { visible: false, displayName: original.displayName } });
    expect(puts(h)).toHaveLength(0);
  });

  it('仅服务端eligible授编辑能力，平台角色或普通社群管理员标签不会授予简介写权限', async () => {
    const h = await ready(null, null, false);
    h.session.save({ token: 'synthetic-same-account', exp: 9999999999, user: { id: 7, name: '合成管理员', roles: ['president', 'communityAdmin'], accountStatus: 'active' } });
    h.page.edit(); h.page.input(input('displayName', '合成无权编辑')); h.page.preview(); await h.page.save(); await h.page.chooseAvatar();
    expect(h.page.data.editing).toBe(false); expect(h.page.data.draft.displayName).toBe(''); expect(puts(h)).toHaveLength(0);
    expect(h.wx.requirePrivacyAuthorize).not.toHaveBeenCalled();
  });

  it('取消展示经用户预览和确认保存原PUT隐藏，不发额外名单或成员操作', async () => {
    const h = await ready(); h.page.edit(); h.page.consent(input('', false)); h.page.preview();
    const sending = h.page.save(); expect(puts(h)[0].data).toMatchObject({ revision: 3, profile: { visible: false } });
    h.reply(1, { profile: { ...original, visible: false, revision: 4 } }); await flush(); h.reply(2, view({ ...original, visible: false, revision: 4 })); await sending;
    expect(h.page.data.message).toBe('简介已保存并隐藏');
    expect(h.requests.every(request => request.url === endpoint && ['GET', 'PUT'].includes(request.method))).toBe(true);
  });
});

describe('原生简介真实Page/SDK：弱网和独立操作锁', () => {
  it.each([
    { existing: false, outcome: 'success', showFirst: false }, { existing: false, outcome: 'error', showFirst: false },
    { existing: false, outcome: 'success', showFirst: true }, { existing: false, outcome: 'error', showFirst: true },
    { existing: true, outcome: 'success', showFirst: false }, { existing: true, outcome: 'error', showFirst: false },
    { existing: true, outcome: 'success', showFirst: true }, { existing: true, outcome: 'error', showFirst: true },
  ])('后台PUT $outcome，已有=$existing，先show=$showFirst：写锁跨hide，无自动重试，只用GET确认', async ({ existing, outcome, showFirst }) => {
    const h = await ready(existing ? original : null); edit(h);
    const sending = h.page.save(); h.page.onHide();
    await h.page.save(); expect(puts(h)).toHaveLength(1); expect(h.page.data.busy).toBe(true);
    if (showFirst) await h.page.onShow();
    expect(reads(h)).toHaveLength(1);
    const saved: Own = { ...original, displayName: '合成未保存昵称', biography: '合成待保存介绍', position: existing ? original.position : '', revision: existing ? 4 : 1 };
    h.reply(1, outcome === 'success' ? { profile: saved } : { error: 'SQL synthetic-server-detail' }, outcome === 'success' ? 200 : 500);
    await flush();
    let showing: Promise<void> | undefined;
    if (!showFirst) {
      await sending; expect(reads(h)).toHaveLength(1); expect(h.page.data.busy).toBe(false);
      await h.page.save(); expect(puts(h)).toHaveLength(1); showing = h.page.onShow();
    }
    expect(reads(h)).toHaveLength(2);
    h.reply(2, view(outcome === 'success' ? saved : existing ? original : null)); await sending; await showing;
    expect(h.page.data).toMatchObject({ loading: false, busy: false, locked: false, draft: { displayName: '合成未保存昵称', visible: true } });
    expect(h.page.data.previewing).toBe(outcome === 'error');
    expect(puts(h)).toHaveLength(1);
    expect(h.requests.map(request => request.method)).toEqual(['GET', 'PUT', 'GET']);
    expect(JSON.stringify(h.patches)).not.toContain('synthetic-server-detail');
  });

  it('网络写失败保留草稿，重复点击只一条PUT，明确再点保存才重试原周期/修订', async () => {
    const h = await ready(); edit(h);
    const sending = h.page.save(); await h.page.save(); await h.page.reload(); await h.page.chooseAvatar();
    expect(puts(h)).toHaveLength(1); expect(h.wx.showModal).not.toHaveBeenCalled(); expect(h.wx.chooseMedia).not.toHaveBeenCalled();
    h.requests[1].fail(); await sending;
    expect(h.page.data).toMatchObject({ busy: false, previewing: true, draft: { displayName: '合成未保存昵称' } });
    expect(h.page.data.operationError).toContain('连接失败');
    const retry = h.page.save(); expect(puts(h)[1].data).toMatchObject({ revision: 3, membershipVersion: periodOne });
    h.requests[2].fail(); await retry; expect(puts(h)).toHaveLength(2);
  });

  it('后台对账GET失败保留草稿，显式retry只读取原周期，不自动PUT', async () => {
    const h = await ready(); edit(h);
    const sending = h.page.save(); h.page.onHide(); await h.page.onShow();
    h.requests[1].fail(); await flush(); h.requests[2].fail(); await sending;
    expect(h.page.data).toMatchObject({ busy: false, loading: false, draft: { displayName: '合成未保存昵称', visible: true }, previewing: true });
    const retry = h.page.retry(); h.reply(3, view()); await retry;
    expect(h.page.data.draft.displayName).toBe('合成未保存昵称');
    expect(puts(h)).toHaveLength(1); expect(reads(h)).toHaveLength(3);
  });

  it.each([false, true])('背景完成后新周期GET使输入隐藏并锁住，无凭据换绑（先show=%s）', async showFirst => {
    const h = await ready(); edit(h);
    const sending = h.page.save(); h.page.onHide();
    if (showFirst) await h.page.onShow();
    const saved = { ...original, displayName: '合成未保存昵称', biography: '合成待保存介绍', revision: 4 };
    h.reply(1, { profile: saved }); await flush();
    let showing: Promise<void> | undefined;
    if (!showFirst) { await sending; expect(reads(h)).toHaveLength(1); showing = h.page.onShow(); }
    h.reply(2, view({ ...saved, visible: false }, periodTwo)); await sending; await showing;
    expect(h.page.data).toMatchObject({ locked: true, busy: false, draft: { visible: false, displayName: '合成未保存昵称' } });
    h.page.preview(); await h.page.save(); expect(puts(h)).toHaveLength(1);
  });

  it('当前资格撤销后只读但本页输入仍可预览，按钮事件不授予写入权限', async () => {
    const h = await ready(); edit(h);
    const reading = h.page.retry(); h.reply(1, view(null, null, false)); await reading;
    expect(h.page.data).toMatchObject({ eligible: false, locked: true, draft: { visible: false, displayName: '合成未保存昵称' } });
    h.page.preview(); expect(h.page.data.previewing).toBe(true);
    await h.page.save(); await h.page.chooseAvatar(); expect(puts(h)).toHaveLength(0); expect(h.wx.chooseMedia).not.toHaveBeenCalled();
  });

  it('500冒充周期code不能换绑或锁住草稿，HTTP错误过滤服务器细节', async () => {
    const h = await ready(); edit(h); const sending = h.page.save();
    h.reply(1, { error: 'SQL synthetic-private-server-message', code: 'PROFILE_PERIOD_CHANGED' }, 500); await sending;
    expect(h.page.data).toMatchObject({ locked: false, conflict: false, previewing: true, draft: { visible: true, displayName: '合成未保存昵称' } });
    expect(h.page.data.operationError).toBe('服务暂时不可用，请稍后重试'); expect(JSON.stringify(h.patches)).not.toContain('synthetic-private-server-message');
  });
});

describe('原生简介实际SDK：恢复读取失败后的保存确认', () => {
  it.each([
    { showFirst: false, nextPeriod: 'unchanged' }, { showFirst: true, nextPeriod: 'unchanged' },
    { showFirst: false, nextPeriod: 'changed' }, { showFirst: true, nextPeriod: 'changed' },
  ])('late ACK后恢复GET失败（先show=$showFirst，retry周期=$nextPeriod）：保留确认回执但禁止旧保存', async ({ showFirst, nextPeriod }) => {
    const h = await ready(); edit(h); h.page.input(input('position', '  合成服务器确认位置  ')); h.page.preview();
    const sending = h.page.save(); h.page.onHide(); if (showFirst) await h.page.onShow();
    const saved: Own = { ...original, displayName: '合成未保存昵称', position: '合成服务器确认位置', biography: '合成待保存介绍', revision: 4 };
    h.reply(1, { profile: saved }); await flush();
    let showing: Promise<void> | undefined;
    if (!showFirst) { await sending; expect(reads(h)).toHaveLength(1); showing = h.page.onShow(); }
    h.requests[2].fail(); await sending; await showing;
    expect(h.page.data).toMatchObject({ loading: false, busy: false, draft: { position: saved.position, displayName: saved.displayName } });
    expect(h.page.data.message).toContain('已确认保存');
    expect(h.page.data.error).toContain('连接失败');
    h.page.preview(); const blocked = h.page.save(); expect(puts(h)).toHaveLength(1); await blocked;
    await h.page.chooseAvatar(); expect(h.authorizations).toHaveLength(0);
    const retry = h.page.retry(); h.reply(3, view({ ...saved, visible: nextPeriod === 'unchanged' }, nextPeriod === 'changed' ? periodTwo : periodOne)); await retry;
    expect(h.page.data.loading).toBe(false);
    if (nextPeriod === 'changed') {
      expect(h.page.data).toMatchObject({ locked: true, draft: { visible: false, position: saved.position } });
      h.page.preview(); await h.page.save(); expect(puts(h)).toHaveLength(1);
    } else {
      expect(h.page.data.locked).toBe(false); h.page.preview(); const next = h.page.save();
      expect(puts(h)[1].data).toMatchObject({ revision: 4, membershipVersion: periodOne, profile: { position: saved.position } });
      h.requests[4].fail(); await next;
    }
    expect(JSON.stringify(h.patches)).not.toContain('synthetic-period');
  });

  it('late-error恢复GET失败保留原输入但先读确认，unchanged-period读取成功才恢复保存', async () => {
    const h = await ready(); edit(h); const sending = h.page.save(); h.page.onHide(); await h.page.onShow();
    h.requests[1].fail(); await flush(); h.requests[2].fail(); await sending;
    expect(h.page.data.draft.displayName).toBe('合成未保存昵称');
    h.page.preview(); const blocked = h.page.save(); expect(puts(h)).toHaveLength(1); await blocked;
    const retry = h.page.retry(); h.reply(3, view()); await retry;
    expect(h.page.data).toMatchObject({ locked: false, previewing: true, draft: { displayName: '合成未保存昵称', visible: true } });
    const next = h.page.save(); expect(puts(h)[1].data).toMatchObject({ revision: 3, membershipVersion: periodOne });
    h.requests[4].fail(); await next;
  });
});

describe('原生简介真实Page/HTTP：入口与可重试状态', () => {
  it('匿名不发简介读取，登录/返回继续使用原生导航', async () => {
    const h = harness({ loggedIn: false }); h.page.onLoad({ team: '51' }); await h.page.onShow();
    expect(h.requests).toHaveLength(0); expect(h.page.data).toMatchObject({ needsLogin: true, loading: false, profiles: [] });
    h.page.login(); expect(h.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/auth/index?mode=login' });
    h.page.back(); expect(h.wx.navigateBack).toHaveBeenCalledWith({ delta: 1 });
  });

  it.each([401, 403, 404, 500, 'network'])('%s读取失败显示可重试状态，不猜权限或请求成员/原始集合', async failure => {
    const h = harness(); h.page.onLoad({ team: '51' }); const reading = h.page.onShow();
    if (failure === 'network') h.requests[0].fail();
    else h.reply(0, { error: 'SQL synthetic-private-read-detail' }, Number(failure));
    await reading;
    expect(h.page.data.loading).toBe(false); expect(h.page.data.profiles).toEqual([]);
    if (failure === 401) expect(h.page.data.needsLogin).toBe(true);
    else expect(h.page.data.error).not.toBe('');
    expect(JSON.stringify(h.patches)).not.toContain('synthetic-private-read-detail');
    expect(h.page.data.needsLogin).toBe(failure === 401);
    if (failure === 401) h.session.save({ token: 'synthetic-restored-token', exp: 9999999999, user: { id: 7, name: '合成恢复账号', roles: ['member'], accountStatus: 'active' } });
    const retry = h.page.retry(); h.reply(1, view()); await retry; await flush();
    expect(h.page.data.loading).toBe(false); expect(h.page.data.error).toBe('');
    expect(h.requests.every(request => request.url === endpoint && request.method === 'GET')).toBe(true);
    expect(h.wx.requirePrivacyAuthorize).not.toHaveBeenCalled();
  });

  it('慢GET重复刷新共用一条请求；无效标识/格式响应关闭能力并可重试', async () => {
    const h = harness(); h.page.onLoad({ team: '51' }); const first = h.page.onShow(), same = h.page.retry();
    expect(h.requests).toHaveLength(1); h.reply(0, { profiles: [], own: { eligible: true, membershipVersion: null, profile: null } }); await first; await same;
    expect(h.page.data.error).toContain('简介列表暂不可用'); expect(h.page.data.eligible).toBe(false);
    for (const invalid of ['../51', '001', '0', '51?overrideAccess=true', Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(h.consumer.id(invalid)).toBeNull();
    h.page.onLoad({ team: '../51' }); await h.page.onShow(); expect(h.requests).toHaveLength(1); expect(h.page.data.error).toContain('入口无效');
  });
});

describe('原生简介真实Page/SDK：身份、路由与迟到回调', () => {
  it.each([
    { scope: 'actor', outcome: 'success' }, { scope: 'actor', outcome: 'error' },
    { scope: 'route', outcome: 'success' }, { scope: 'route', outcome: 'error' },
    { scope: 'hide', outcome: 'success' }, { scope: 'hide', outcome: 'error' },
    { scope: 'unload', outcome: 'success' }, { scope: 'unload', outcome: 'error' },
  ])('$scope后旧GET $outcome不覆盖当前页面或恢复私有资料', async ({ scope, outcome }) => {
    const h = harness(); h.page.onLoad({ team: '51' }); const reading = h.page.onShow();
    let showing: Promise<void> | undefined;
    if (scope === 'actor') h.session.save({ token: 'synthetic-new-profile-token', exp: 9999999999, user: { id: 8, name: '合成新账号', roles: ['member'], accountStatus: 'active' } });
    else if (scope === 'route') { h.page.onLoad({ team: '52' }); showing = h.page.onShow(); }
    else if (scope === 'hide') { h.page.onHide(); showing = h.page.onShow(); }
    else h.page.onUnload();
    if (scope !== 'unload') {
      const fresh = view(null, 'synthetic-current-period'); fresh.profiles = [];
      h.reply(1, fresh); await showing; await flush();
    }
    h.reply(0, outcome === 'success' ? view() : { error: '合成旧请求迟到错误' }, outcome === 'success' ? 200 : 500); await reading;
    expect(h.page.data.profiles).toEqual([]);
    expect(h.page.data.draft.displayName).toBe('');
    expect(h.page.data.error).not.toContain('合成旧请求迟到错误');
    expect(h.page.data.loading).toBe(false);
    if (scope === 'route') expect(h.requests[1].url).toBe(origin + '/api/team-profiles/52');
    if (scope === 'actor') expect(h.requests[1].header.Authorization).toBe('JWT synthetic-new-profile-token');
    expect(puts(h)).toHaveLength(0);
  });

  it.each([
    { scope: 'actor', outcome: 'success' }, { scope: 'actor', outcome: 'error' },
    { scope: 'route', outcome: 'success' }, { scope: 'route', outcome: 'error' },
    { scope: 'logout', outcome: 'success' }, { scope: 'logout', outcome: 'error' },
  ])('$scope时保留旧写锁到finally，迟到PUT $outcome只触发当前scope GET', async ({ scope, outcome }) => {
    const h = await ready(); edit(h);
    const sending = h.page.save();
    if (scope === 'actor') h.session.save({ token: 'synthetic-new-profile-token', exp: 9999999999, user: { id: 8, name: '合成新账号', roles: ['member'], accountStatus: 'active' } });
    else if (scope === 'route') { h.page.onLoad({ team: '52' }); await h.page.onShow(); }
    else h.session.clear();
    noPrivate(h); expect(h.page.data.busy).toBe(true);
    await h.page.save(); await h.page.reload(); expect(h.requests).toHaveLength(2);
    h.reply(1, outcome === 'success' ? { profile: { ...original, revision: 4 } } : { error: '合成旧写迟到错误' }, outcome === 'success' ? 200 : 500);
    await flush();
    if (scope !== 'logout') {
      const fresh = view(null, 'synthetic-current-period'); fresh.profiles = [];
      expect(h.requests).toHaveLength(3); h.reply(2, fresh);
    }
    await sending;
    expect(h.page.data.busy).toBe(false); noPrivate(h);
    expect(h.page.data.operationError).not.toContain('合成旧写迟到错误');
    expect(puts(h)).toHaveLength(1);
    if (scope === 'logout') expect(h.page.data.needsLogin).toBe(true);
    if (scope === 'actor') expect(h.requests[2].header.Authorization).toBe('JWT synthetic-new-profile-token');
    if (scope === 'route') expect(h.requests[2].url).toBe(origin + '/api/team-profiles/52');
  });

  it('旧账号请求迟到401不能清掉后来登录的新账号或其凭据', async () => {
    const h = await ready(); edit(h); const sending = h.page.save();
    h.session.save({ token: 'synthetic-new-profile-token', exp: 9999999999, user: { id: 8, name: '合成新账号', roles: ['member'], accountStatus: 'active' } });
    h.reply(1, { error: '旧会话失效' }, 401); await flush();
    expect(h.session.user()?.id).toBe(8);
    expect(h.requests[2].header.Authorization).toBe('JWT synthetic-new-profile-token');
    h.reply(2, view(null, 'synthetic-current-period')); await sending;
  });

  it('卸载后迟到PUT不修改Page、不重新读或重放保存', async () => {
    const h = await ready(); edit(h); const sending = h.page.save(); h.page.onUnload();
    const visible = structuredClone(h.page.data);
    h.reply(1, { profile: { ...original, revision: 4 } }); await sending; await h.page.onShow();
    expect(h.page.data).toEqual(visible); expect(h.requests).toHaveLength(2);
  });

  it.each(['cancel', 'fail', 'hide', 'actor'])('reload确认框%s不换周期凭据，不重复弹窗或发PUT', async outcome => {
    const h = await ready(); edit(h); const reloading = h.page.reload();
    await h.page.reload(); await h.page.save(); await h.page.chooseAvatar();
    expect(h.modals).toHaveLength(1); expect(h.requests).toHaveLength(1); expect(h.page.data.busy).toBe(true);
    if (outcome === 'hide') { h.page.onHide(); await h.page.onShow(); }
    if (outcome === 'actor') h.session.save({ token: 'synthetic-new-profile-token', exp: 9999999999, user: { id: 8, name: '合成新账号', roles: ['member'], accountStatus: 'active' } });
    if (outcome === 'fail') h.modals[0].fail(); else h.modals[0].success({ confirm: outcome !== 'cancel' });
    await flush();
    if (['hide', 'actor'].includes(outcome)) h.reply(1, outcome === 'actor' ? view(null, 'synthetic-current-period') : view());
    await reloading; expect(h.page.data.busy).toBe(false); expect(puts(h)).toHaveLength(0);
    if (outcome === 'cancel' || outcome === 'fail') expect(h.page.data.draft.displayName).toBe('合成未保存昵称');
    if (outcome === 'actor') expect(h.page.data.draft.displayName).toBe('');
  });
});

describe('原生简介真实Page/SDK：主动隐私和受控图片', () => {
  it('主动选头像先请求隐私授权，拒绝可重试；实际readImage只读2MiB以内PNG并用私有本地路径预览', async () => {
    const h = await ready(); h.page.edit();
    const denied = h.page.chooseAvatar(); expect(h.authorizations).toHaveLength(1);
    expect(h.selections).toHaveLength(0); h.authorizations[0].fail(); await denied;
    expect(h.page.data.busy).toBe(false); expect(h.page.data.operationError).toContain('隐私授权未完成'); expect(h.fileReads).toHaveLength(0);
    const choosing = h.page.chooseAvatar(); h.authorizations[1].success(); await flush();
    expect(h.selections[0]).toMatchObject({ count: 1, mediaType: ['image'] });
    h.selections[0].success({ tempFiles: [{ tempFilePath: '/synthetic-picked/avatar.png' }] }); await choosing;
    expect(h.fileReads[0].filePath).toBe('/synthetic-picked/avatar.png'); expect(h.page.data.draft.hasAvatar).toBe(true);
    expect(h.page.data.draftAvatar).toMatch(/^\/synthetic\/zijing-private-.*\.png$/);
    expect(JSON.stringify(h.patches)).not.toContain('data:image');
    h.page.preview(); const sending = h.page.save(); expect((puts(h)[0].data!.profile as Draft).avatar).toBe(png);
    h.reply(1, { profile: { ...original, avatar: png, revision: 4 } }); await flush(); h.reply(2, view({ ...original, avatar: png, revision: 4 })); await sending;
    expect(h.wx.uploadFile).not.toHaveBeenCalled(); expect(h.wx.downloadFile).not.toHaveBeenCalled();
  });

  it.each(['oversize', 'gif', 'read-error'])('%s读取失败不覆盖原头像，不自动保存且允许重选', async failure => {
    const h = harness({ autoRead: false }); h.page.onLoad({ team: '51' }); const reading = h.page.onShow(); h.reply(0, view()); await reading; h.page.edit();
    const choosing = h.page.chooseAvatar(); h.authorizations[0].success(); await flush(); h.selections[0].success({ tempFiles: [{ tempFilePath: '/synthetic-picked/image' }] }); await flush();
    if (failure === 'read-error') h.fileReads[0].fail();
    else {
      const bytes = new Uint8Array(failure === 'oversize' ? 2 * 1024 * 1024 + 1 : 32);
      bytes.set(failure === 'gif' ? [0x47, 0x49, 0x46] : [0x89, 0x50, 0x4e, 0x47]);
      h.fileReads[0].success({ data: bytes.buffer });
    }
    await choosing; expect(h.page.data.busy).toBe(false); expect(h.page.data.draft.hasAvatar).toBe(false); expect(h.page.data.operationError).not.toBe('');
    expect(puts(h)).toHaveLength(0); expect(h.writes).toHaveLength(0);
  });

  it.each(['privacy', 'choose', 'read'])('hide/show打断%s时保留file锁，迟到选择不进入草稿，仅GET重新核对当前页面', async stage => {
    const h = harness({ autoRead: false }); h.page.onLoad({ team: '51' }); const reading = h.page.onShow(); h.reply(0, view()); await reading; h.page.edit();
    const choosing = h.page.chooseAvatar();
    if (stage !== 'privacy') { h.authorizations[0].success(); await flush(); }
    if (stage === 'read') { h.selections[0].success({ tempFiles: [{ tempFilePath: '/synthetic-picked/old.png' }] }); await flush(); }
    h.page.onHide(); await h.page.onShow(); await h.page.chooseAvatar(); await h.page.save();
    expect(h.page.data.busy).toBe(true); expect(h.authorizations).toHaveLength(1); expect(h.requests).toHaveLength(1);
    if (stage === 'privacy') h.authorizations[0].success();
    else if (stage === 'choose') h.selections[0].success({ tempFiles: [{ tempFilePath: '/synthetic-picked/old.png' }] });
    else h.fileReads[0].success({ data: h.bytes() });
    await flush(); expect(h.requests).toHaveLength(2); h.reply(1, view()); await choosing;
    expect(h.page.data.busy).toBe(false); expect(h.page.data.draft.hasAvatar).toBe(false); expect(h.writes).toHaveLength(0); expect(puts(h)).toHaveLength(0);
  });

  it.each(['hide', 'route', 'logout'])('%s后本地图片写入晚到，真实files和Page仅清理受控临时文件', async scope => {
    const h = harness({ autoWrite: false }); h.page.onLoad({ team: '51' }); const reading = h.page.onShow(); h.reply(0, view({ ...original, avatar: png })); await flush();
    expect(h.writes).toHaveLength(1);
    if (scope === 'hide') h.page.onHide();
    else if (scope === 'route') h.page.onLoad({ team: '52' });
    else h.session.clear();
    h.writes[0].success(); await reading; await flush();
    expect(h.page.data.draftAvatar).toBe(''); expect(h.page.data.profiles).toEqual([]);
    expect(h.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: h.writes[0].filePath }));
    expect(h.unlink.mock.calls.every(([arg]) => arg.filePath.startsWith('/synthetic/zijing-private-') && /\.(png|jpeg|webp)$/.test(arg.filePath))).toBe(true);
  });

  it('隐私指引只在明确点击时打开，失败可重试，初始化和预览不请求权限或订阅', async () => {
    const h = await ready(); h.page.edit(); h.page.preview();
    expect(h.contracts).toHaveLength(0); expect(h.authorizations).toHaveLength(0);
    const first = h.page.openPrivacy(); h.contracts[0].fail(); await first;
    expect(h.page.data.operationError).toContain('隐私指引暂不可用'); expect(h.page.data.busy).toBe(false);
    const retry = h.page.openPrivacy(); h.contracts[1].success(); await retry;
    expect(h.contracts).toHaveLength(2); expect(h.wx.requestSubscribeMessage).not.toHaveBeenCalled(); expect(h.page.data.operationError).toBe('');
  });

  it.each(['requirePrivacyAuthorize', 'openPrivacyContract'])('实际隐私辅助接口%s缺失时显示升级提示并释放操作锁', async name => {
    const h = await ready(); h.page.edit(); Reflect.deleteProperty(h.wx, name);
    if (name === 'requirePrivacyAuthorize') await h.page.chooseAvatar(); else await h.page.openPrivacy();
    expect(h.page.data.operationError).toContain('升级微信后重试'); expect(h.page.data.busy).toBe(false);
    expect(h.selections).toHaveLength(0); expect(h.fileReads).toHaveLength(0); expect(puts(h)).toHaveLength(0);
  });

  it('avatar只接收受控图片dataURI，外链/SVG/原始关系不进入Page；移除头像可预览和取消', async () => {
    const h = harness();
    for (const invalid of ['https://evil.invalid/avatar.jpg', '//evil.invalid/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/gif;base64,R0lG', png + '\n', 'data:image/png;base64,' + 'A'.repeat(2800000)]) expect(h.consumer.avatar(invalid)).toBeNull();
    h.page.onLoad({ team: '51' }); const reading = h.page.onShow(); const dto = view({ ...original, avatar: png }); dto.profiles[0].avatar = 'https://evil.invalid/avatar.jpg';
    h.reply(0, dto); await reading;
    expect(h.page.data.profiles[0].avatarPath).toBe(''); expect(JSON.stringify(h.patches)).not.toContain('evil.invalid');
    h.page.edit(); await h.page.removeAvatar(); expect(h.page.data.draft.hasAvatar).toBe(false); h.page.preview(); expect(h.page.data.previewing).toBe(true);
    await h.page.cancel(); expect(h.page.data.editing).toBe(false); expect(h.page.data.draft.hasAvatar).toBe(true);
  });

  it('本地头像写入失败保留文字与头像草稿，刷新后可恢复展示路径', async () => {
    const h = harness({ autoWrite: false }); h.page.onLoad({ team: '51' }); const reading = h.page.onShow();
    const dto = view({ ...original, avatar: png }); dto.profiles[0].avatar = png;
    h.reply(0, dto); await flush(); expect(h.writes).toHaveLength(2); h.writes[0].fail(); h.writes[1].fail(); await reading;
    expect(h.page.data.loading).toBe(false); expect(h.page.data.profiles[0].displayName).toBe('紫荆电竞 · 合成服务原文');
    expect(h.page.data.draft.hasAvatar).toBe(true); expect(h.page.data.imageError).toContain('部分头像暂时无法显示');
    const retry = h.page.retry(); h.reply(1, dto); await flush(); h.writes[2].success(); h.writes[3].success(); await retry;
    expect(h.page.data.imageError).toBe(''); expect(h.page.data.draftAvatar).toBe(h.writes[3].filePath); expect(puts(h)).toHaveLength(0);
  });
});

describe('原生简介前台ACK最低修订：实际Page/HTTP补充回归', () => {
  const confirmed: Own = { ...original, displayName: '合成服务端已确认昵称', biography: '合成服务端已确认介绍', revision: 4 };
  async function foreground(outcome: '500' | 'network' | 'missing' | 'older' = 'network') {
    const h = await ready(); edit(h); const sending = h.page.save();
    h.reply(1, { profile: confirmed }); await flush(); expect(reads(h)).toHaveLength(2);
    if (outcome === '500') h.reply(2, { error: 'SQL synthetic-after-ACK-error' }, 500);
    else if (outcome === 'network') h.requests[2].fail();
    else h.reply(2, view(outcome === 'missing' ? null : original));
    await sending; return h;
  }
  async function noSecondPut(h: Harness) {
    h.page.preview(); const saving = h.page.save(); await flush();
    // Finish an unexpected synthetic PUT so a failed assertion never waits on a live request.
    if (puts(h).length > 1 && h.requests.at(-1)?.method === 'PUT') h.requests.at(-1)!.fail();
    await saving; expect(puts(h)).toHaveLength(1);
  }
  function startRead(h: Harness, method: 'retry' | 'reload') {
    const dialogs = h.modals.length, reading = h.page[method]();
    if (h.modals.length > dialogs) h.modals.at(-1)!.success({ confirm: true });
    return reading;
  }

  it.each(['500', 'network', 'missing', 'older'] as const)('前台PUT已确认rev4，后GET %s保持实际回执并禁止重复PUT；fresh retry才恢复', async outcome => {
    const h = await foreground(outcome);
    expect(h.page.data.draft).toMatchObject({ displayName: confirmed.displayName, biography: confirmed.biography });
    await noSecondPut(h); expect(h.page.data.confirmationPending).toBe(true);
    const retry = h.page.retry(); h.reply(3, view(confirmed)); await retry;
    expect(h.page.data.confirmationPending).toBe(false); expect(h.page.data.draft.displayName).toBe(confirmed.displayName);
    h.page.edit(); h.page.input(input('biography', '合成成功核对后新的修改')); h.page.preview();
    const next = h.page.save(); expect(puts(h)[1].data).toMatchObject({ revision: 4, membershipVersion: periodOne, profile: { biography: '合成成功核对后新的修改' } });
    h.reply(4, { profile: { ...confirmed, revision: 5, biography: '合成成功核对后新的修改' } }); await flush();
    h.reply(5, view({ ...confirmed, revision: 5, biography: '合成成功核对后新的修改' })); await next; expect(puts(h)).toHaveLength(2);
  });

  it.each((['retry', 'reload'] as const).flatMap(method => ['missing', 'older'].map(snapshot => ({ method, snapshot }))))('$method不能用同周期$snapshot结果绕过ACK最低rev4，真实rev4恢复后才解锁', async ({ method, snapshot }) => {
    const h = await foreground(); const reading = startRead(h, method); await flush();
    expect(reads(h)).toHaveLength(3); h.reply(3, view(snapshot === 'missing' ? null : original)); await reading;
    expect(h.page.data.draft).toMatchObject({ displayName: confirmed.displayName, biography: confirmed.biography });
    await noSecondPut(h); expect(h.page.data.confirmationPending).toBe(true);
    const fresh = startRead(h, method); await flush(); h.reply(4, view(confirmed)); await fresh;
    expect(h.page.data.confirmationPending).toBe(false); expect(h.page.data.draft.displayName).toBe(confirmed.displayName); expect(puts(h)).toHaveLength(1);
  });

  it('取消修改不能清掉已确认ACK最低修订，reload读取旧rev3仍只读', async () => {
    const h = await foreground(); await h.page.cancel(); h.page.edit(); await noSecondPut(h);
    const reloading = startRead(h, 'reload'); await flush(); h.reply(3, view(original)); await reloading;
    h.page.edit(); await noSecondPut(h); expect(h.page.data.confirmationPending).toBe(true);
    const fresh = h.page.retry(); h.reply(4, view(confirmed)); await fresh; expect(h.page.data.confirmationPending).toBe(false);
  });

  it.each(['older', '500', 'network'] as const)('前台ACK后hide/show，对账旧GET迟到%s不能覆盖确认结果或提前释放写锁', async late => {
    const h = await ready(); edit(h); const sending = h.page.save(); h.reply(1, { profile: confirmed }); await flush();
    h.page.onHide(); await h.page.onShow(); await h.page.save(); expect(puts(h)).toHaveLength(1); expect(h.page.data.busy).toBe(true); expect(reads(h)).toHaveLength(2);
    if (late === 'network') h.requests[2].fail(); else h.reply(2, late === '500' ? { error: '合成旧读取迟到错误' } : view(original), late === '500' ? 500 : 200);
    await flush(); expect(reads(h)).toHaveLength(3); h.reply(3, view(original)); await sending;
    expect(h.page.data.busy).toBe(false); expect(h.page.data.draft.displayName).toBe(confirmed.displayName); await noSecondPut(h);
    const fresh = h.page.retry(); h.reply(4, view(confirmed)); await fresh; expect(h.page.data.confirmationPending).toBe(false);
  });

  it.each(['older', '500'] as const)('fresh GET确认rev4后旧前台retry晚到%s不能倒退资料或恢复ACK阻塞', async late => {
    const h = await foreground(); const stale = h.page.retry(); h.page.onHide(); const fresh = h.page.onShow();
    h.reply(4, view(confirmed)); await fresh; expect(h.page.data.confirmationPending).toBe(false);
    h.reply(3, late === '500' ? { error: '合成已过期读取错误' } : view(original), late === '500' ? 500 : 200); await stale;
    expect(h.page.data.draft.displayName).toBe(confirmed.displayName); expect(h.page.data.error).toBe(''); expect(h.page.data.confirmationPending).toBe(false); expect(puts(h)).toHaveLength(1);
  });

  it.each(['actor_roundtrip', 'route'] as const)('未结束PUT在$scope期间保持锁，旧ACK最低修订不能进入新scope', async scope => {
    const h = await ready(); edit(h); const sending = h.page.save();
    if (scope === 'actor_roundtrip') {
      h.session.save({ token: 'synthetic-roundtrip-b', exp: 9999999999, user: { id: 8, name: '合成账号乙', roles: ['member'], accountStatus: 'active' } });
      h.session.save({ token: 'synthetic-roundtrip-new-a', exp: 9999999999, user: { id: 7, name: '合成账号甲新会话', roles: ['member'], accountStatus: 'active' } });
    } else { h.page.onLoad({ team: '52' }); await h.page.onShow(); }
    noPrivate(h); expect(h.page.data.busy).toBe(true); await h.page.save(); expect(puts(h)).toHaveLength(1);
    h.reply(1, { profile: confirmed }); await flush(); noPrivate(h); expect(reads(h)).toHaveLength(2);
    const current = view(null, 'synthetic-new-scope-period'); current.profiles = []; h.reply(2, current); await sending;
    noPrivate(h); expect(h.page.data.confirmationPending).toBe(false); expect(h.page.data.busy).toBe(false); expect(puts(h)).toHaveLength(1);
    if (scope === 'actor_roundtrip') expect(h.requests[2].header.Authorization).toBe('JWT synthetic-roundtrip-new-a'); else expect(h.requests[2].url).toBe(origin + '/api/team-profiles/52');
  });

  it('前台ACK后卸载，未结束确认GET不恢复资料、不再GET也不再次PUT', async () => {
    const h = await ready(); edit(h); const sending = h.page.save(); h.reply(1, { profile: confirmed }); await flush(); h.page.onUnload();
    const unloaded = structuredClone(h.page.data); h.reply(2, view(original)); await sending; await h.page.onShow();
    expect(h.page.data).toEqual(unloaded); expect(reads(h)).toHaveLength(2); expect(puts(h)).toHaveLength(1);
  });

  it('前台ACK后发现新周期仍默认hidden，明确reload及新的主动consent才可公开保存', async () => {
    const h = await foreground(); const reading = h.page.retry(); h.reply(3, view({ ...confirmed, visible: true }, periodTwo)); await reading;
    expect(h.page.data.locked).toBe(true); expect(h.page.data.draft.visible).toBe(false); await noSecondPut(h);
    const reloading = startRead(h, 'reload'); await flush(); h.reply(4, view({ ...confirmed, visible: true }, periodTwo)); await reloading;
    expect(h.page.data.locked).toBe(false); expect(h.page.data.confirmationPending).toBe(false); expect(h.page.data.draft.visible).toBe(false); expect(puts(h)).toHaveLength(1);
    h.page.edit(); h.page.consent(input('', true)); h.page.preview(); const saving = h.page.save();
    expect(puts(h)[1].data).toMatchObject({ revision: 4, membershipVersion: periodTwo, profile: { visible: true } });
    h.reply(5, { profile: { ...confirmed, revision: 5, visible: true } }); await flush(); h.reply(6, view({ ...confirmed, revision: 5, visible: true }, periodTwo)); await saving;
    expect(puts(h)).toHaveLength(2);
  });

  it.each(['missing', 'older'])('ACK4经freshGET4确认后，reload/reset的$snapshot仍不得清除当前周期最低修订', async snapshot => {
    const h = await ready(); edit(h); const sending = h.page.save(); h.reply(1, { profile: confirmed }); await flush(); h.reply(2, view(confirmed)); await sending;
    expect(h.page.data.confirmationPending).toBe(false);
    const reloading = startRead(h, 'reload'); await flush(); h.reply(3, view(snapshot === 'missing' ? null : original)); await reloading;
    expect(h.page.data.draft.displayName).toBe(confirmed.displayName); await noSecondPut(h);
    const fresh = h.page.retry(); h.reply(4, view(confirmed)); await fresh;
    expect(h.page.data.confirmationPending).toBe(false); expect(h.page.data.draft.displayName).toBe(confirmed.displayName); expect(puts(h)).toHaveLength(1);
  });

  it('ACK4后新周期锁hidden，头像render中hide/show及恢复GET失败均不能复活旧checked ACK', async () => {
    const h = harness({ autoWrite: false }); h.page.onLoad({ team: '51' }); const initial = h.page.onShow(); h.reply(0, view()); await initial; edit(h);
    const saved = { ...confirmed, avatar: png, visible: true }, sending = h.page.save(); h.reply(1, { profile: saved }); await flush();
    h.reply(2, view({ ...saved, visible: false }, periodTwo)); await flush();
    expect(h.page.data.locked).toBe(true); expect(h.page.data.draft.visible).toBe(false); expect(h.writes).toHaveLength(1);
    h.page.onHide(); await h.page.onShow(); expect(h.page.data.busy).toBe(true); expect(reads(h)).toHaveLength(2);
    h.writes[0].success(); await flush(); expect(reads(h)).toHaveLength(3);
    h.requests[3].fail(); await sending;
    expect(h.page.data.locked).toBe(true); expect(h.page.data.draft.visible).toBe(false); expect(h.page.data.draft.displayName).toBe(confirmed.displayName);
    h.page.preview(); await h.page.save(); expect(puts(h)).toHaveLength(1); expect(h.page.data.busy).toBe(false);
  });
});
