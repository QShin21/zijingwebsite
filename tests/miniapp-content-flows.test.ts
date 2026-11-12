import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { normalizeSignup } from '../src/lib/signup-schema';

type Data = Record<string, unknown>;
type NativePage = { data: Data; setData(next: Data): void; onLoad?(options: Data): void; load(): Promise<void>; [key: string]: unknown };
function page(name: string, dependencies: Record<string, unknown>, wx: Data = {}) {
  const filename = 'miniprogram/src/pages/' + name + '/index.js';
  const require = createRequire(new URL('../' + filename, import.meta.url));
  let result!: NativePage;
  runInNewContext(readFileSync(filename, 'utf8'), { Page: (value: NativePage) => { result = value; },
    require: (key: string) => key in dependencies ? dependencies[key] : require(key), wx, clearInterval });
  result.setData = values => Object.assign(result.data, values);
  return result;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
const frame = { actions: {}, protect: () => true, error: (target: NativePage, cause: Error) => target.setData({ loading: false, error: cause.message }) };
/** Page double whose setData applies WeChat dotted path keys ('img.key' → data.img.key). */
function pathTarget(data: Data): NativePage {
  const target = { data } as NativePage;
  target.setData = (next: Data) => {
    for (const [key, value] of Object.entries(next)) {
      const parts = key.split('.');
      let node = target.data;
      for (const part of parts.slice(0, -1)) node = (node[part] && typeof node[part] === 'object' ? node[part] : (node[part] = {})) as Data;
      node[parts[parts.length - 1]] = value;
    }
  };
  return target;
}
type ImagesModule = {
  attach(page: NativePage, views: Data[], alive?: () => boolean): Data[]; load(src: string): Promise<string>; failed(page: NativePage, event: Data): void;
};
const imageSrc = (id: number) => `/api/v2/images/showcase/${id}/0?v=${'a'.repeat(16)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
/**
 * Real lib/v2-images.js with a synthetic signing transport (POST /api/v2/images/sign),
 * a controllable clock, and spies proving tickets are never persisted or logged.
 */
function imagesHarness() {
  let clock = Date.parse('2026-11-12T00:00:00.000Z'), token: string | null = 'synthetic-jwt';
  const listeners: (() => void)[] = [];
  const replies: { resolve(value: Data): void; reject(error: Error): void }[] = [];
  const http = { download: vi.fn(), request: vi.fn((_path: string, _options: Data) => new Promise<Data>((resolve, reject) => { replies.push({ resolve, reject }); })) };
  const logs = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const wx = { setStorageSync: vi.fn(), setStorage: vi.fn() };
  const module = { exports: {} as ImagesModule };
  runInNewContext(readFileSync('miniprogram/src/lib/v2-images.js', 'utf8'), { module, console: logs, wx,
    Date: { now: () => clock, parse: (value: string) => Date.parse(value) },
    require: (key: string) => ({ '../config': { origin: 'https://synthetic.invalid' }, './http': http,
      './session': { token: () => token, subscribe: (fn: () => void) => { listeners.push(fn); return () => undefined; } } } as Data)[key] });
  const ticketURL = (source: string) => source + '&ticket=synthetic' + clock + '.' + 'x'.repeat(43);
  const expires = () => new Date(clock + 60_000).toISOString();
  return { images: module.exports, http, replies, logs, wx, ticketURL, expires,
    signed: (sources: string[]) => ({ images: sources.map(src => ({ src, url: ticketURL(src), expiresAt: expires() })), expiresAt: expires() }),
    advance(ms: number) { clock += ms; },
    switchAccount() { token = 'synthetic-other-jwt'; listeners.forEach(fn => fn()); },
    logout() { token = null; listeners.forEach(fn => fn()); } };
}
/** Real V2 projections (lib/v2.js) with a mocked transport; synthetic data only. */
function v2Api() {
  const module = { exports: {} as Data };
  runInNewContext(readFileSync('miniprogram/src/lib/v2.js', 'utf8'), { module, require: (key: string) => { if (key === './http') return { request: vi.fn() }; throw new Error('unexpected ' + key); } });
  return { ...module.exports, get: vi.fn(), post: vi.fn() } as Data & { get: ReturnType<typeof vi.fn> };
}
function eventCard(id: number, source: 'club' | 'community' = 'club'): Data {
  return { key: source + ':' + id, ref: source === 'club' ? { type: 'event', source, id, slug: 'synthetic-' + id } : { type: 'event', source, id, community: 'synthetic-game' },
    href: '/events/synthetic-' + id, title: '合成活动 ' + id, summary: null, cover: null, community: source === 'club' ? null : { id: 11, slug: 'synthetic-game', title: '合成社群', hue: 67 },
    team: null, category: '比赛', startAt: '2026-11-14T10:30:00.000Z', endAt: '2026-11-14T13:00:00.000Z', location: '合成场地', state: 'upcoming', stateLabel: '即将开始',
    signup: { mode: 'form', state: 'open', label: '报名开放', opensAt: null, deadline: '2026-11-13T15:59:00.000Z', viewerSubmitted: null }, promoted: false, demo: false, archived: false, publishedAt: null };
}
function homeFixture(): Data {
  return { viewer: null, site: { name: '合成社团', heroTitle: null, heroSubtitle: null, heroImage: null, heroAction: null, footer: null }, today: '2026-11-11',
    spotlight: { ...eventCard(31), ref: { type: 'event', source: 'club', id: 31, slug: 'synthetic-spotlight' }, title: '合成焦点活动' },
    upcoming: [eventCard(32)], openSignups: [], openCalls: [],
    notices: [{ key: 'announcement:4', kind: 'announcement', ref: { type: 'announcement', id: 4, slug: 'synthetic-notice' }, href: '/announcements/synthetic-notice', label: '公告', title: '合成公告', summary: null, cover: null, community: null, publishedAt: '2026-11-10T02:00:00.000Z', promoted: false, demo: false }],
    highlights: null, communities: null, me: null, about: null };
}
const form = normalizeSignup({ enabled: true, questions: [{ id: 'name', label: '合成姓名', type: 'text', required: true, options: [] }] });

describe('原生社团展示与既有活动权限合同', () => {
  it('V2 主场：读取失败可见可重试，成功后投影视图且隐藏后迟到结果不写回', async () => {
    const api = v2Api();
    const attach = vi.fn((_page: NativePage, views: Data[]) => views);
    const module = { exports: {} as { load(page: NativePage): Promise<void> } };
    const dependencies: Data = { './v2': api, './v2-images': { attach }, './session': { user: () => null } };
    runInNewContext(readFileSync('miniprogram/src/lib/home.js', 'utf8'), { module, require: (key: string) => dependencies[key], wx: { getWindowInfo: () => ({ statusBarHeight: 20 }), getMenuButtonBoundingClientRect: () => ({ top: 24, height: 32 }) } });
    const target = { data: {}, setData(next: Data) { Object.assign(this.data, next); } } as NativePage;
    api.get.mockRejectedValueOnce(new Error('合成弱网'));
    await module.exports.load(target);
    expect(target.data).toMatchObject({ loading: false, error: '合成弱网' });
    api.get.mockResolvedValueOnce(homeFixture());
    await module.exports.load(target);
    expect(api.get).toHaveBeenLastCalledWith('home');
    expect(target.data).toMatchObject({ loading: false, error: '', home: { title: '', spotlight: { title: '合成焦点活动', club: true, page: 'detail', params: { collection: 'events', id: 31, slug: 'synthetic-spotlight' } } } });
    expect((target.data.home as Data).notices).toMatchObject([{ title: '合成公告', page: 'detail' }]);
    expect(attach).toHaveBeenCalledTimes(1);
    const late = deferred<Data>(); api.get.mockReturnValueOnce(late.promise);
    const pending = module.exports.load(target); (target as unknown as { _nativeVisible: boolean })._nativeVisible = false;
    late.resolve({ ...homeFixture(), spotlight: null }); await pending;
    expect((target.data.home as Data).spotlight).toMatchObject({ title: '合成焦点活动' });
  });

  it('V2 日程：切换范围后旧请求迟到不能覆盖；已报名范围未登录时转登录', async () => {
    const api = v2Api(), login = vi.fn();
    const target = page('events', { '../../lib/v2': api, '../../lib/v2-images': { attach: (_p: NativePage, views: Data[]) => views },
      '../../lib/session': { user: () => null }, '../../lib/navigation': { login, go: vi.fn() }, '../../lib/page': frame });
    const late = deferred<Data>(); api.get.mockReturnValueOnce(late.promise);
    const first = (target.onShow as () => Promise<void>)();
    api.get.mockResolvedValueOnce({ docs: [eventCard(2, 'community')], page: 1, hasNextPage: false });
    target.setData({ loading: false });
    await (target.setScope as (event: Data) => Promise<void>)({ currentTarget: { dataset: { scope: 'community' } } });
    late.resolve({ docs: [eventCard(1)], page: 1, hasNextPage: false }); await first;
    expect((target.data.docs as Data[]).map(doc => doc.key)).toEqual(['community:2']);
    expect(api.get.mock.calls[1]).toEqual(['calendar', { scope: 'community', range: 'upcoming', page: 1, limit: 20 }, { required: false }]);
    await (target.setScope as (event: Data) => Promise<void>)({ currentTarget: { dataset: { scope: 'mine' } } });
    expect(login).toHaveBeenCalledOnce(); expect(target.data.scope).toBe('community');
  });

  it('V2 日程「可报名」交给服务端 signupOpen 先筛后分页，切换时重新读取第一页', async () => {
    const api = v2Api();
    api.get.mockResolvedValue({ docs: [eventCard(1)], page: 1, hasNextPage: false });
    const target = page('events', { '../../lib/v2': api, '../../lib/v2-images': { attach: (_p: NativePage, views: Data[]) => views },
      '../../lib/session': { user: () => null }, '../../lib/navigation': { login: vi.fn() }, '../../lib/page': frame });
    await (target.onShow as () => Promise<void>)();
    await (target.toggleSignupOpen as () => Promise<void>)();
    expect(target.data.signupOpen).toBe(true);
    expect(api.get).toHaveBeenLastCalledWith('calendar', { scope: 'all', range: 'upcoming', page: 1, limit: 20, signupOpen: 1 }, { required: false });
    await (target.toggleSignupOpen as () => Promise<void>)();
    expect(api.get.mock.calls.at(-1)?.[1]).not.toHaveProperty('signupOpen');
  });

  it('V2 主场按服务端 sections 的顺序、标题与显隐投影，社团精选独立于赛程前六', () => {
    const api = v2Api(), module = { exports: {} as { view(home: Data): Data } };
    runInNewContext(readFileSync('miniprogram/src/lib/home.js', 'utf8'), { module, wx: {},
      require: (key: string) => ({ './v2': api, './v2-images': { attach: vi.fn() }, './session': { user: () => null } } as Data)[key] });
    const promotedEvent = { ...eventCard(41, 'community'), promoted: true, startAt: null, endAt: null };
    const view = module.exports.view({ ...homeFixture(),
      sections: [{ kind: 'promoted', enabled: true, title: '合成精选' }, { kind: 'upcoming', enabled: true, title: '合成赛程' }, { kind: 'notices', enabled: false, title: '社团公告' }],
      promoted: { events: [promotedEvent], notices: [], showcases: null } });
    expect(view.sections).toEqual([{ kind: 'promoted', title: '合成精选' }, { kind: 'upcoming', title: '合成赛程' }]);
    expect(view.promoted).toMatchObject({ count: 1, notices: [], showcases: [], events: [{ title: '合成活动 41' }] });
    // An older server without sections falls back to the seven default blocks in order.
    expect((module.exports.view(homeFixture()).sections as Data[]).map(section => section.kind))
      .toEqual(['upcoming', 'open', 'notices', 'promoted', 'communities', 'highlights', 'about']);
  });

  it('V2 日程第二页失败保留第一页和页码，重试原页且重复点击不追加重复记录', async () => {
    const retry = deferred<Data>(), api = v2Api();
    api.get.mockResolvedValueOnce({ docs: [eventCard(1)], page: 1, hasNextPage: true })
      .mockRejectedValueOnce(new Error('合成第二页读取失败')).mockReturnValueOnce(retry.promise);
    const target = page('events', { '../../lib/v2': api, '../../lib/v2-images': { attach: (_p: NativePage, views: Data[]) => views },
      '../../lib/session': { user: () => null }, '../../lib/navigation': { login: vi.fn() }, '../../lib/page': frame });
    const more = target.onReachBottom as () => Promise<void>;
    await (target.onShow as () => Promise<void>)(); await more.call(target);
    expect(target.data).toMatchObject({ error: '', loadMoreError: '合成第二页读取失败', page: 1, hasMore: true, loading: false, loadingMore: false });
    expect((target.data.docs as Data[]).map(doc => doc.key)).toEqual(['club:1']);
    const pending = more.call(target); await more.call(target);
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(api.get.mock.calls.map(call => (call[1] as Data).page)).toEqual([1, 2, 2]);
    retry.resolve({ docs: [eventCard(1), eventCard(2)], page: 2, hasNextPage: false }); await pending;
    expect(target.data).toMatchObject({ error: '', loadMoreError: '', page: 2, hasMore: false, loadingMore: false });
    expect((target.data.docs as Data[]).map(doc => doc.key)).toEqual(['club:1', 'club:2']);
    expect((target.data.groups as Data[]).length).toBeGreaterThan(0);
    const markup = readFileSync('miniprogram/src/pages/events/index.wxml', 'utf8');
    expect(markup).toContain('loadMoreError && !loading');
    expect(markup).toContain("loadMoreError ? '重试加载更多' : '加载更多'");
  });

  it('V2 图片：受控图按 ≤20 批量换取短时签名，公开媒体直连；隐藏后迟到回复不写回，签名不持久化不打印', async () => {
    const h = imagesHarness(), target = pathTarget({ img: {} });
    let visible = true;
    const controlled = Array.from({ length: 25 }, (_, index) => ({ coverSrc: imageSrc(index + 1) }));
    const views = h.images.attach(target, [...controlled, { coverSrc: '/api/media/file/public.webp' }, { coverSrc: imageSrc(1) }], () => visible);
    expect(views[0].coverKey).toMatch(/^i[\w]+$/);
    await vi.waitFor(() => expect(h.http.request).toHaveBeenCalledTimes(2));
    const batches = h.http.request.mock.calls.map(call => (call[1] as { data: { sources: string[] } }).data.sources);
    // Duplicates collapse and every batch respects the server limit of 20 sources.
    expect(batches.map(batch => batch.length)).toEqual([20, 5]);
    expect(new Set(batches.flat()).size).toBe(25);
    expect(h.http.request.mock.calls[0]).toEqual(['/api/v2/images/sign', { method: 'POST', data: { sources: batches[0] }, required: true }]);
    expect(h.http.download).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(Object.values(target.data.img as Data)).toContain('https://synthetic.invalid/api/media/file/public.webp'));
    h.replies[0].resolve(h.signed(batches[0]));
    await vi.waitFor(() => expect(Object.values(target.data.img as Data)).toContain('https://synthetic.invalid' + h.ticketURL(batches[0][0])));
    visible = false;
    h.replies[1].resolve(h.signed(batches[1])); await settle();
    // The memory cache serves the hidden page's late result later, but the hidden page is not written.
    expect(await h.images.load(batches[1][0])).toBe('https://synthetic.invalid' + h.ticketURL(batches[1][0]));
    expect(Object.values(target.data.img as Data).some(value => String(value).includes(batches[1][0]))).toBe(false);
    expect(h.http.request).toHaveBeenCalledTimes(2);
    expect(h.wx.setStorageSync).not.toHaveBeenCalled(); expect(h.wx.setStorage).not.toHaveBeenCalled();
    for (const method of Object.values(h.logs)) expect(method).not.toHaveBeenCalled();
    expect(await h.images.load('//cross-origin.invalid/x')).toBe('');
  });

  it('V2 图片：临近过期重新批量申请；拒收非本图票据；换号或退出清空缓存且旧账号迟到签名不被采用', async () => {
    const h = imagesHarness();
    const first = h.images.load(imageSrc(7));
    await vi.waitFor(() => expect(h.replies).toHaveLength(1));
    h.replies[0].resolve(h.signed([imageSrc(7)]));
    expect(await first).toBe('https://synthetic.invalid' + h.ticketURL(imageSrc(7)));
    expect(await h.images.load(imageSrc(7))).toContain('&ticket='); expect(h.http.request).toHaveBeenCalledTimes(1);
    h.advance(56_000); // inside the 5 s refresh margin of a 60 s ticket
    const refreshed = h.images.load(imageSrc(7));
    await vi.waitFor(() => expect(h.replies).toHaveLength(2));
    h.replies[1].resolve(h.signed([imageSrc(7)])); expect(await refreshed).toBe('https://synthetic.invalid' + h.ticketURL(imageSrc(7)));
    // A reply that is not this source's ticketed path is never used.
    const forged = h.images.load(imageSrc(9));
    await vi.waitFor(() => expect(h.replies).toHaveLength(3));
    h.replies[2].resolve({ images: [{ src: imageSrc(9), url: 'https://evil.invalid/x', expiresAt: h.expires() }], expiresAt: h.expires() });
    expect(await forged).toBe('');
    // Signing failure degrades to the text crest without throwing.
    const failed = h.images.load(imageSrc(10));
    await vi.waitFor(() => expect(h.replies).toHaveLength(4));
    h.replies[3].reject(Object.assign(new Error('合成签名失败'), { status: 404 })); expect(await failed).toBe('');
    // Account switch: cached tickets are dropped; an in-flight reply for the old account is ignored.
    const pending = h.images.load(imageSrc(8));
    await vi.waitFor(() => expect(h.replies).toHaveLength(5));
    h.switchAccount();
    h.replies[4].resolve(h.signed([imageSrc(8)])); expect(await pending).toBe('');
    const again = h.images.load(imageSrc(7));
    await vi.waitFor(() => expect(h.replies).toHaveLength(6));
    h.replies[5].resolve(h.signed([imageSrc(7)])); expect(await again).toContain('&ticket=');
    // Logout: controlled sources fall back to the plain URL that the server authorizes for guests.
    h.logout();
    expect(await h.images.load(imageSrc(7))).toBe('https://synthetic.invalid' + imageSrc(7));
    expect(h.http.request).toHaveBeenCalledTimes(6);
  });

  it('V2 图片：加载失败只重新签名一次，再失败显示文字封面；隐藏页或旧地址的错误事件不写回', async () => {
    const h = imagesHarness(), target = pathTarget({ img: {} });
    let visible = true;
    const [view] = h.images.attach(target, [{ coverSrc: imageSrc(3) }], () => visible);
    await vi.waitFor(() => expect(h.replies).toHaveLength(1));
    h.replies[0].resolve(h.signed([imageSrc(3)]));
    const key = view.coverKey as string, img = () => (target.data.img as Data)[key] as string;
    await vi.waitFor(() => expect(img()).toContain('&ticket='));
    const shown = img(), errorEvent = (url: string) => ({ currentTarget: { dataset: { key, url } }, detail: { errMsg: 'synthetic' } });
    h.images.failed(target, errorEvent('https://synthetic.invalid/old-url'));
    expect(h.http.request).toHaveBeenCalledTimes(1);
    h.images.failed(target, errorEvent(shown));
    await vi.waitFor(() => expect(h.replies).toHaveLength(2));
    h.advance(1_000); h.replies[1].resolve(h.signed([imageSrc(3)]));
    await vi.waitFor(() => expect(img()).not.toBe(shown));
    const resigned = img(); expect(resigned).toContain('&ticket=');
    h.images.failed(target, errorEvent(resigned));
    expect(img()).toBe(''); expect(h.http.request).toHaveBeenCalledTimes(2);
    target.setData({ ['img.' + key]: resigned }); visible = false;
    h.images.failed(target, errorEvent(resigned));
    expect(img()).toBe(resigned);
  });

  it('只有名单查看权限时进入现有 view 合同，并由服务端元数据限制编辑与名单动作', async () => {
    const request = vi.fn().mockResolvedValueOnce({ title: '合成活动', form, version: 'v3', state: '报名开放', signup: null, canManage: false, canViewSignups: true })
      .mockResolvedValueOnce({ docs: [{ id: 4, questions: form.questions, answers: { name: '合成报名者' } }], page: 1, totalPages: 1, totalDocs: 1 });
    const target = page('signup', { '../../lib/http': { request }, '../../lib/session': { user: () => ({ id: 1 }) }, '../../lib/page': frame }, { setNavigationBarTitle: vi.fn() });
    target.onLoad!({ kind: 'community-posts', id: '5', mode: 'view' });
    await target.load();
    expect(request).toHaveBeenNthCalledWith(1, '/api/activities/community-posts/5/signup?mode=view', expect.objectContaining({ required: true, questionnaire: true }));
    expect(request).toHaveBeenNthCalledWith(2, '/api/activities/community-posts/5/signup?mode=entries&page=1', expect.objectContaining({ required: true, questionnaire: true }));
    expect(target.data.tab).toBe('entries'); expect(target.data.entries).toHaveLength(1);
    await (target.save as () => Promise<void>)(); expect(request).toHaveBeenCalledTimes(2);
    (target.tab as (event: Data) => void)({ currentTarget: { dataset: { tab: 'edit' } } }); expect(target.data.tab).toBe('entries');
    target.setData({ info: { canManage: false, canViewSignups: false } });
    await (target.loadEntries as (page: number) => Promise<void>)(2); expect(request).toHaveBeenCalledTimes(2);
  });

  it('工作台行没有服务端能力时不导航；仅名单权限使用view', () => {
    const go = vi.fn();
    const target = page('activity-manage', { '../../lib/http': {}, '../../lib/navigation': { go }, '../../lib/page': frame });
    target.setData({ docs: [{ id: 7, canManage: false, canViewSignups: true }, { id: 8, canManage: false, canViewSignups: false }] });
    const open = (target.open as (event: Data) => void).bind(target);
    open({ currentTarget: { dataset: { id: 8 } } }); expect(go).not.toHaveBeenCalled();
    open({ currentTarget: { dataset: { id: 7 } } }); expect(go).toHaveBeenCalledWith('signup', { kind: 'community-posts', id: 7, mode: 'view' });
  });

  it('活动工作台加载中退出账号时清空名单和加载态，旧账号迟到数据不会恢复', async () => {
    let user: { id: number } | null = { id: 1 }, notify!: () => void;
    const late = deferred<Data>(), request = vi.fn().mockReturnValue(late.promise);
    const session = { user: () => user, subscribe: (listener: () => void) => { notify = listener; return () => {}; } };
    const target = page('activity-manage', { '../../lib/http': { request }, '../../lib/session': session,
      '../../lib/page': { ...frame, protect: () => Boolean(user) } });
    target.onLoad!({}); target.setData({ docs: [{ id: 3, title: '合成旧账号私有活动' }] });
    const pending = target.load(); expect(target.data.loading).toBe(true);
    user = null; notify();
    expect(target.data.loading).toBe(false); expect(target.data.docs).toEqual([]); expect(target.data.needsLogin).toBe(true);
    late.resolve({ docs: [{ id: 3, title: '迟到私有活动' }], page: 1, hasNextPage: false }); await pending;
    expect(target.data.docs).toEqual([]); await target.load(); expect(request).toHaveBeenCalledTimes(1);
  });

  it('从已审批风采链接打开原文时保留图片和原生视频，不读取队伍或名单', async () => {
    const cms = { socialDetail: vi.fn().mockResolvedValue({ id: 12, title: '合成社群风采', body: '合成公开记录', status: 'visible',
      images: [{ source: 'synthetic-image', caption: '合成图片' }], videoURL: '/api/showcase-videos/12345678-1234-1234-1234-123456789abc.mp4' }), media: async () => null, list: vi.fn() };
    const target = page('detail', { '../../lib/cms': cms, '../../lib/session': { user: () => ({ id: 1 }), subscribe: () => () => {} },
      '../../lib/files': { localImage: async () => '/synthetic/photo.png' }, '../../lib/page': frame }, { setNavigationBarTitle: vi.fn() });
    target.onLoad!({ collection: 'community-showcase', id: '12' }); await target.load();
    expect(cms.socialDetail).toHaveBeenCalledWith('community-showcase', '12');
    expect(target.data.photos).toEqual([{ url: '/synthetic/photo.png', caption: '合成图片' }]);
    expect(target.data.videoSource).toBe('https://home.thuzijing.top/api/showcase-videos/12345678-1234-1234-1234-123456789abc.mp4');
    expect(cms.list).not.toHaveBeenCalled();
  });

  it.each(['gallery', 'article'])('社群活动原生详情读取%s内容与受控图片', async mode => {
    const src = '/api/v2/images/community-post/12/0?v=0123456789abcdef';
    const detail = { presentation: { mode, blocks: mode === 'article' ? [{ type: 'text', text: '合成段落' }, { type: 'image', image: { src, alt: '合成配图' } }] : [] }, images: [{ src, alt: '合成配图' }] };
    const cms = { socialDetail: vi.fn().mockResolvedValue({ id: 12, title: '合成活动', body: '合成段落', status: 'visible', category: 'event', startAt: '2099-03-25T12:30:00.000Z', location: '合成地点' }), media: async () => null, list: vi.fn() };
    const http = { request: vi.fn().mockResolvedValue({ form: { enabled: false } }), download: vi.fn().mockResolvedValue('/synthetic/download.webp') };
    const api = { get: vi.fn().mockResolvedValue(detail) };
    const target = page('detail', { '../../lib/cms': cms, '../../lib/http': http, '../../lib/v2': api,
      '../../lib/session': { user: () => ({ id: 1 }), subscribe: () => () => {} }, '../../lib/page': frame }, { setNavigationBarTitle: vi.fn() });
    target.onLoad!({ collection: 'community-posts', id: '12' }); await target.load();
    expect(api.get).toHaveBeenCalledWith('events/community/12', {}, { required: true });
    expect(http.download).toHaveBeenCalledWith(src);
    expect(target.data.presentation).toMatchObject({ mode, images: [{ url: '/synthetic/download.webp', alt: '合成配图' }] });
    if (mode === 'article') expect(target.data.presentation).toMatchObject({ blocks: [{ type: 'text', text: '合成段落' }, { type: 'image', url: '/synthetic/download.webp' }] });
    expect(target.data.doc).toMatchObject({ location: '合成地点' });
  });
});

it('退出后迟到的私有图片写入会删除文件，不向新账号恢复旧图片路径', async () => {
  let success!: () => void;
  const unlink = vi.fn(), fs = { writeFile: (options: { success(): void }) => { success = options.success; }, unlink, readdir: vi.fn() };
  const module = { exports: {} as { localImage(value: string): Promise<string>; clearPrivate(): void } };
  runInNewContext(readFileSync('miniprogram/src/lib/files.js', 'utf8'), { module, wx: { env: { USER_DATA_PATH: '/synthetic' }, getFileSystemManager: () => fs } });
  const pending = module.exports.localImage('data:image/png;base64,c3ludGhldGlj');
  module.exports.clearPrivate(); success();
  expect(await pending).toBe(''); expect(unlink).toHaveBeenCalledTimes(1);
  expect(unlink.mock.calls[0][0].filePath).toMatch(/^\/synthetic\/zijing-private-/);
});

describe('原生登录读取服务器具体能力', () => {
  it.each([1, 2, 3])('兼容能力接口版本%s，保留昵称登录与邮箱验证', async version => {
    const request = vi.fn().mockResolvedValue({ version, authentication: ['email', 'nickname'], registration: true });
    const target = page('auth', { '../../lib/http': { request }, '../../lib/session': {}, '../../lib/page': frame });
    await (target.retryBridge as () => Promise<void>)();
    expect(target.data.bridge).toBe(true);
    expect(request).toHaveBeenCalledWith('/api/miniapp/status', { auth: false });
  });
  it('只返回版本号无法冒充所需能力，旧邮箱REST兼容入口仍可用', async () => {
    const request = vi.fn().mockResolvedValue({ version: 1 });
    const target = page('auth', { '../../lib/http': { request }, '../../lib/session': {}, '../../lib/page': frame });
    await (target.retryBridge as () => Promise<void>)(); expect(target.data.bridge).toBe(false);
  });
  it('网络失败后可单独重试能力，不清空正在填写的登录内容', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('合成弱网')).mockResolvedValue({ version: 2, authentication: ['email', 'nickname'], registration: true });
    const target = page('auth', { '../../lib/http': { request }, '../../lib/session': {}, '../../lib/page': frame });
    target.setData({ identifier: '合成昵称', password: 'synthetic-not-a-real-credential' });
    await (target.retryBridge as () => Promise<void>)(); expect(target.data.bridge).toBe(false);
    await (target.retryBridge as () => Promise<void>)();
    expect(target.data.bridge).toBe(true); expect(target.data.identifier).toBe('合成昵称');
    expect(target.data.password).toBe('synthetic-not-a-real-credential');
  });
  it('离开登录页清空输入凭据，忽略迟到的能力响应', async () => {
    const late = deferred<Data>(), request = vi.fn().mockReturnValue(late.promise);
    const target = page('auth', { '../../lib/http': { request }, '../../lib/session': {}, '../../lib/page': frame });
    target.setData({ bridge: false, password: 'synthetic', confirm: 'synthetic', code: '111111' });
    const pending = (target.retryBridge as () => Promise<void>)();
    (target.onUnload as () => void)(); late.resolve({ version: 2, authentication: ['email', 'nickname'], registration: true }); await pending;
    expect(target.data.bridge).toBe(false); expect(target.data.password).toBe(''); expect(target.data.confirm).toBe(''); expect(target.data.code).toBe('');
  });
});
