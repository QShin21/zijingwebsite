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
const form = normalizeSignup({ enabled: true, questions: [{ id: 'name', label: '合成姓名', type: 'text', required: true, options: [] }] });

describe('原生社团展示与既有活动权限合同', () => {
  it('主页的投影读取失败保持已加载活动可见，并可单独重试同一服务投影', async () => {
    const module = { exports: {} as { load(page: NativePage): Promise<void>; loadClub(page: NativePage): Promise<void> } };
    const promoted = { sourceKey: 'community-posts:6', href: '/community/synthetic/updates/6', snapshot: { title: '合成已审批活动' } };
    const cms = { site: vi.fn().mockResolvedValue({ modules: [], featuredEvents: [], featuredHonors: [] }),
      list: vi.fn().mockResolvedValue({ docs: [{ id: 4, title: '合成站点活动' }] }), decorate: (docs: Data[]) => docs, media: async () => null };
    const club = { load: vi.fn().mockRejectedValueOnce(new Error('合成弱网')).mockResolvedValue({ staffBatches: [{ id: 9, title: '合成骨干批次' }], promotions: { event: [promoted] } }) };
    const nativePresentation = createRequire(import.meta.url)('../miniprogram/src/lib/native-presentation.js');
    const dependencies: Data = { './cms': cms, './session': { user: () => null }, './club': club, './native-presentation': nativePresentation, './page': { error: frame.error, labels: { events: '活动' } } };
    runInNewContext(readFileSync('miniprogram/src/lib/home.js', 'utf8'), { module, require: (key: string) => dependencies[key] });
    const target = { data: {}, setData(next: Data) { Object.assign(this.data, next); } } as NativePage;
    await module.exports.load(target);
    expect(target.data.loading).toBe(false); expect(target.data.error).toBe(''); expect(target.data.clubError).toBe('合成弱网');
    expect(target.data.modules).toMatchObject([{ kind: 'events', docs: [{ id: 4 }] }]);
    await module.exports.loadClub(target);
    expect(target.data.promotions).toEqual({ event: [promoted] });
    expect(target.data.staffBatches).toMatchObject([{ id: 9, params: { kind: 'staff', id: 9 } }]);
    expect(cms.list).toHaveBeenCalledTimes(2);
  });

  it('活动翻页不会丢弃尚未返回的社团投影，切换为通知后旧活动投影不能覆盖', async () => {
    const late = deferred<Data>(), cms = { list: vi.fn().mockResolvedValue({ docs: [{ id: 1 }], page: 1, hasNextPage: true }), decorate: (docs: Data[]) => docs };
    const club = { load: vi.fn().mockReturnValueOnce(late.promise).mockResolvedValue({ promotions: { notice: [{ sourceKey: 'community-posts:8' }] } }) };
    const target = page('events', { '../../lib/cms': cms, '../../lib/club': club, '../../lib/page': frame });
    const first = target.load(); await vi.waitFor(() => expect(club.load).toHaveBeenCalledTimes(1));
    cms.list.mockResolvedValueOnce({ docs: [{ id: 2 }], page: 2, hasNextPage: false });
    await (target.load as (more: boolean) => Promise<void>)(true);
    late.resolve({ promotions: { event: [{ sourceKey: 'community-posts:7' }] } }); await first;
    expect(target.data.docs).toHaveLength(2); expect(target.data.promoted).toEqual([{ sourceKey: 'community-posts:7' }]);
    const obsolete = deferred<Data>(); club.load.mockReturnValueOnce(obsolete.promise);
    const previous = (target.retryClub as () => Promise<void>)();
    target.setData({ mode: 'announcements' }); await target.load();
    obsolete.resolve({ promotions: { event: [{ sourceKey: 'obsolete' }] } }); await previous;
    expect(target.data.promoted).toEqual([{ sourceKey: 'community-posts:8' }]);
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
