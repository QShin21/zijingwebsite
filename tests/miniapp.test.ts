import { createRequire } from 'node:module';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const format = require('../miniprogram/src/lib/format.js');
const richtext = require('../miniprogram/src/lib/richtext.js');
const cms = require('../miniprogram/src/lib/cms.js');
const session = require('../miniprogram/src/lib/session.js');
const http = require('../miniprogram/src/lib/http.js');
let saved: unknown;
const request = vi.fn();
beforeEach(() => {
  saved = null; request.mockReset();
  vi.stubGlobal('wx', { getStorageSync: () => saved, setStorageSync: (_: string, value: unknown) => { saved = value; },
    removeStorageSync: () => { saved = null; }, request,
    env: { USER_DATA_PATH: '/local' }, getFileSystemManager: () => ({ unlink: vi.fn(), readdir: vi.fn() }) });
});
afterEach(() => { vi.unstubAllGlobals(); });
const login = () => session.save({ token: 'fixture-token', exp: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 5, name: '测试用户', accountStatus: 'active', roles: ['member'], communities: [], salt: 'must-not-persist' } });
describe('小程序账号与网络边界', () => {
  it('账号只保存必要字段，过期与停用账号立即失效', () => {
    login(); expect(session.user()).not.toHaveProperty('salt');
    expect(session.token()).toBe('fixture-token');
    saved = { token: 'fixture-token', exp: 1, user: { id: 5 } };
    expect(session.user()).toBeNull(); expect(saved).toBeNull();
    expect(() => session.save({ token: 'fixture-token', exp: 9999999999, user: { id: 5, accountStatus: 'suspended' } })).toThrow();
  });
  it('匿名内容请求不附带已登录凭据，私有读取先检查登录', async () => {
    login(); request.mockImplementation(options => options.success({ statusCode: 200, data: { docs: [], page: 1 } }));
    await cms.list('events');
    expect(request.mock.calls[0][0].header).not.toHaveProperty('Authorization');
    session.clear(); await expect(cms.list('games')).rejects.toMatchObject({ status: 401 });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('只向固定网站发送凭据，认证失败清理登录态', async () => {
    login();
    for (const bad of ['https://untrusted.invalid', '//untrusted.invalid', '/\\untrusted.invalid', '/api/\nusers']) expect(() => http.url(bad)).toThrow();
    request.mockImplementation(options => options.success({ statusCode: 401, data: {} }));
    await expect(http.request('/api/games', { required: true })).rejects.toMatchObject({ status: 401 });
    expect(saved).toBeNull();
    expect(request.mock.calls[0][0].url).toBe('https://home.thuzijing.top/api/games');
  });
  it('内部异常与 HTML 错误页不会被当作成功业务数据', async () => {
    expect(http.message({ error: 'SQL error with secret' }, 500)).not.toContain('secret');
    request.mockImplementation(options => options.success({ statusCode: 200, data: '<!DOCTYPE html><html />' }));
    await expect(http.request('/api/miniapp/status', { auth: false })).rejects.toMatchObject({ status: 404 });
  });
});
describe('小程序内容与日期', () => {
  it('公开查询固定已发布、已核验荣誉与最小字段，拒绝任意集合', async () => {
    const query = cms.contentQuery('honors', { year: '2026', game: 1 });
    expect(query['where[_status][equals]']).toBe('published');
    expect(query['where[verified][equals]']).toBe(true);
    expect(query['select[internalNotes]']).toBeUndefined();
    expect(query['where[date][less_than]']).toBe('2027-01-01T00:00:00+08:00');
    expect(() => cms.contentQuery('users')).toThrow();
    login(); request.mockImplementation(options => options.success({ statusCode: 200, data: {
      docs: [{ id: 1, _status: 'draft', verified: true }, { id: 2, _status: 'published', verified: false },
        { id: 3, _status: 'published', verified: true, internalNotes: 'private' }], page: 1 } }));
    const result = await cms.list('honors');
    expect(result.docs.map((doc: { id: number }) => doc.id)).toEqual([3]); expect(result.docs[0]).not.toHaveProperty('internalNotes');
  });
  it('只输出已获公开授权的阵容昵称和位置', () => {
    const projected = cms.publicProjection({ id: 1, members: [
      { displayName: '允许公开', position: '上单', consent: true, email: 'private' },
      { displayName: '未获授权', consent: false }], internalNotes: 'private', submittedBy: 8 });
    expect(projected.members).toEqual([{ displayName: '允许公开', position: '上单' }]);
    expect(projected).not.toHaveProperty('submittedBy');
  });
  it('报名结束边界、人工取消与上海日期一致', () => {
    const now = Date.parse('2026-10-09T00:00:00Z');
    expect(format.registrationState({ _status: 'published', registrationURL: 'https://example.invalid/form', registrationEnd: '2026-10-09T00:00:00Z' }, now)).toBe('已截止');
    expect(format.eventState({ lifecycle: 'cancelled', endAt: '2026-10-01' }, now)).toBe('已取消');
    expect(format.date('2026-10-08T16:30:00Z')).toBe('2026.10.09 00:30');
    for (const url of ['javascript:alert(1)', 'https://user:pass@example.invalid', 'http://example.invalid', 'https://example.invalid/\n']) expect(format.safeURL(url)).toBe(false);
  });
  it('富文本保留格式，拒绝脚本与危险链接并限制递归', () => {
    const result = richtext.render({ root: { children: [
      { type: 'paragraph', children: [{ type: 'text', text: '<script>alert(1)</script>', format: 1 }] },
      { type: 'link', fields: { url: 'javascript:alert(1)' }, children: [{ type: 'text', text: '危险链接' }] },
      { type: 'link', fields: { url: 'https://example.invalid/page' }, children: [{ type: 'text', text: '外部链接' }] },
      { type: 'script', attrs: { onload: 'alert(1)' }, children: [] },
    ] } });
    expect(result.links).toEqual([{ url: 'https://example.invalid/page', label: '外部链接' }]);
    expect(result.nodes[0].children[0].name).toBe('strong');
    expect(JSON.stringify(result.nodes)).not.toContain('onload');
    expect(result.nodes[3].name).toBe('div');
    let nested: unknown = { type: 'text', text: 'too-deep' };
    for (let i = 0; i < 60; i++) nested = { type: 'paragraph', children: [nested] };
    expect(JSON.stringify(richtext.render({ root: { children: [nested] } }))).not.toContain('too-deep');
  });
});
