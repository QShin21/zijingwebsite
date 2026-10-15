import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type Data = Record<string, unknown>;
type Page = { data: Data; setData(next: Data): void; [key: string]: unknown };
const nativeRequire = createRequire(import.meta.url);
const frame = nativeRequire('../miniprogram/src/lib/page.js');
const invoke = (page: Page, method: string, ...args: unknown[]) => (page[method] as (...values: unknown[]) => unknown).apply(page, args);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function setup(name: 'fixed' | 'list' | 'detail', options: Data, userId: number | null = 1) {
  let user: { id: number } | null = userId === null ? null : { id: userId };
  let listener: (value: typeof user) => void = () => {};
  const unsubscribe = vi.fn();
  const session = { user: () => user, subscribe: (callback: typeof listener) => { listener = callback; return unsubscribe; } };
  const cms = { list: vi.fn().mockResolvedValue({ docs: [], page: 1, hasNextPage: false }), detail: vi.fn(),
    decorate: vi.fn(async (docs: Data[]) => docs), media: vi.fn().mockResolvedValue(null), site: vi.fn().mockResolvedValue({ contacts: [] }) };
  const filename = 'miniprogram/src/pages/' + name + '/index.js';
  const require = createRequire(new URL('../' + filename, import.meta.url));
  const dependencies: Data = { '../../lib/theme': { page: (definition: Page) => definition }, '../../lib/cms': cms,
    '../../lib/session': session, '../../lib/page': frame, '../../lib/club': { load: async () => ({ promotions: { showcase: [] } }) } };
  let page!: Page;
  runInNewContext(readFileSync(filename, 'utf8'), { Page: (definition: Page) => { page = definition; },
    require: (key: string) => key in dependencies ? dependencies[key] : require(key), wx: { setNavigationBarTitle: vi.fn() } });
  page.setData = next => Object.assign(page.data, next);
  invoke(page, 'onLoad', options);
  return { page, cms, unsubscribe, setUser(id: number | null, notify = true) { user = id === null ? null : { id }; if (notify) listener(user); } };
}

describe('B阶段固定阅读页的账号与离页读取边界', () => {
  it('换号立即清空正文和封面，旧账号迟到响应不能恢复', async () => {
    const { page, cms, setUser } = setup('fixed', { key: 'about' });
    const pending = deferred<Data>(); cms.list.mockReturnValueOnce(pending.promise);
    page.setData({ doc: { id: 5 }, nodes: [{ type: 'text', text: '旧账号资料' }], coverImage: { url: '/synthetic/old' }, contacts: [{ text: '旧资料' }] });
    const load = invoke(page, 'load'); setUser(2);
    expect(page.data).toMatchObject({ doc: null, nodes: [], coverImage: null, contacts: [], loading: false, needsLogin: false });
    pending.resolve({ docs: [{ id: 6, title: '迟到资料', cover: 77 }] }); await load;
    expect(page.data.doc).toBeNull(); expect(cms.media).not.toHaveBeenCalled();
  });
  it.each(['onHide', 'onUnload'])('%s之后的招新响应不能写回；卸载取消会话订阅', async lifecycle => {
    const { page, cms, unsubscribe } = setup('fixed', { key: 'join-members' });
    const pending = deferred<Data>();
    cms.list.mockResolvedValueOnce({ docs: [{ id: 5, title: '合成加入说明' }] }).mockReturnValueOnce(pending.promise);
    const load = invoke(page, 'load'); await vi.waitFor(() => expect(cms.list).toHaveBeenCalledTimes(2));
    invoke(page, lifecycle); pending.resolve({ docs: [{ id: 7, title: '迟到招新', collection: 'recruitment' }] }); await load;
    expect(page.data.doc).toBeNull(); expect(page.data.batches).toEqual([]);
    if (lifecycle === 'onUnload') expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it('公开联系说明迟到时再次核对账号，不能依赖订阅通知及时送达', async () => {
    const { page, cms, setUser } = setup('fixed', { key: 'contact' });
    const pending = deferred<Data>(); cms.list.mockResolvedValue({ docs: [{ id: 5 }] }); cms.site.mockReturnValue(pending.promise);
    const load = invoke(page, 'load'); await vi.waitFor(() => expect(cms.site).toHaveBeenCalledOnce());
    setUser(2, false); pending.resolve({ contacts: [{ label: '合成旧读取', text: '旧资料' }] }); await load;
    expect(page.data.contacts).toEqual([]); expect(page.data.doc).toBeNull();
  });
  it('匿名隐私正文仍可读取，其他受限固定页不发请求', async () => {
    const privacy = setup('fixed', { key: 'privacy' }, null);
    privacy.cms.list.mockResolvedValue({ docs: [{ id: 8, title: '合成隐私说明' }] });
    await invoke(privacy.page, 'load');
    expect(privacy.cms.list).toHaveBeenCalledWith('pages', { key: 'privacy', limit: 1 });
    expect(privacy.page.data).toMatchObject({ needsLogin: false, doc: { id: 8 } });
    const restricted = setup('fixed', { key: 'about' }, null); await invoke(restricted.page, 'load');
    expect(restricted.cms.list).not.toHaveBeenCalled(); expect(restricted.page.data.needsLogin).toBe(true);
  });
});

describe('B阶段列表分页与独立项目筛选读取', () => {
  it('项目筛选读取不被正常主列表查询取消，但旧的项目响应不能覆盖新结果', async () => {
    const { page, cms } = setup('list', { collection: 'honors' });
    const old = deferred<Data>(), current = deferred<Data>();
    cms.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise).mockResolvedValueOnce({ docs: [], page: 1, hasNextPage: false });
    const first = invoke(page, 'loadGames'), second = invoke(page, 'loadGames'); await invoke(page, 'load');
    current.resolve({ docs: [{ id: 20, title: '合成当前项目' }] }); await second;
    old.resolve({ docs: [{ id: 10, title: '合成旧项目' }] }); await first;
    expect(page.data.games).toEqual([{ id: '', title: '全部项目' }, { id: 20, title: '合成当前项目' }]);
  });
  it.each(['hide', 'unload', 'switch', 'silent-switch'])('项目读取在%s后不得恢复旧账号列表', async event => {
    const { page, cms, setUser } = setup('list', { collection: 'honors' });
    const pending = deferred<Data>(); cms.list.mockReturnValueOnce(pending.promise);
    const load = invoke(page, 'loadGames');
    if (event === 'hide') invoke(page, 'onHide');
    else if (event === 'unload') invoke(page, 'onUnload');
    else setUser(2, event !== 'silent-switch');
    pending.resolve({ docs: [{ id: 10, title: '合成旧项目' }] }); await load;
    expect(page.data.games).toEqual([{ id: '', title: '全部项目' }]);
  });
  it('下一页失败重试原页，401仍清空受限内容并显示登录反馈', async () => {
    const { page, cms } = setup('list', { collection: 'news' });
    cms.list.mockResolvedValueOnce({ docs: [{ id: 1, collection: 'news' }], page: 1, hasNextPage: true })
      .mockRejectedValueOnce(new Error('合成弱网')).mockResolvedValueOnce({ docs: [{ id: 2, collection: 'news' }], page: 2, hasNextPage: true })
      .mockRejectedValueOnce(Object.assign(new Error('合成会话失效'), { status: 401 }));
    await invoke(page, 'load'); await invoke(page, 'onReachBottom');
    expect(page.data).toMatchObject({ error: '', loadMoreError: '合成弱网', page: 1, hasMore: true, docs: [{ id: 1 }] });
    await invoke(page, 'onReachBottom');
    expect(cms.list.mock.calls.map(call => call[1].page)).toEqual([1, 2, 2]);
    expect((page.data.docs as Data[]).map(doc => doc.id)).toEqual([1, 2]);
    await invoke(page, 'onReachBottom');
    expect(page.data).toMatchObject({ docs: [], hasMore: false, needsLogin: true, error: '合成会话失效', loadingMore: false });
  });
});

describe('阅读媒体原生错误回调', () => {
  it('详情的损坏封面与照片显示失败态，旧URL和隐藏回调不修改新内容', () => {
    const { page } = setup('detail', { collection: 'albums', id: '1' });
    const coverImage = { url: '/synthetic/current-cover' }, photos = [{ url: '/synthetic/current-photo', caption: '合成图注' }];
    page.setData({ loading: false, coverImage, photos });
    const fail = (role: string, url: string) => invoke(page, 'readingImageError', { currentTarget: { dataset: { role, url, index: 0 } }, detail: { errMsg: 'synthetic 404 / decode error' } });
    fail('cover', '/synthetic/old'); expect(page.data.coverImageFailed).toBe(false);
    fail('cover', coverImage.url); fail('photo', photos[0].url);
    expect(page.data.coverImageFailed).toBe(true); expect(page.data.photos).toEqual([{ ...photos[0], failed: true }]);
    page.setData({ coverImageFailed: false }); invoke(page, 'onHide'); fail('cover', coverImage.url);
    expect(page.data.coverImageFailed).toBe(false);
  });
  it('固定页损坏封面仍保留来源，离页后不写回', () => {
    const { page } = setup('fixed', { key: 'about' });
    const coverImage = { url: '/synthetic/current-cover', credit: '合成来源' };
    page.setData({ loading: false, coverImage });
    const event = { currentTarget: { dataset: { url: coverImage.url } } };
    invoke(page, 'readingImageError', event);
    expect(page.data).toMatchObject({ coverImage, coverImageFailed: true });
    page.setData({ coverImageFailed: false }); invoke(page, 'onUnload'); invoke(page, 'readingImageError', event);
    expect(page.data.coverImageFailed).toBe(false);
  });
});
