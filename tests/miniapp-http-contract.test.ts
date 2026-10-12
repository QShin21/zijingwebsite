import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const path = 'miniprogram/src/lib/http.js';
const localRequire = createRequire(new URL('../' + path, import.meta.url));
type Options = { method?: string; required?: boolean; auth?: boolean; raw?: boolean; siteWrite?: boolean; data?: unknown; header?: Record<string, string> };
type NativeRequest = { url: string; method: string; header: Record<string, string>; success(response: { statusCode: number; data: unknown }): void; fail(): void };
function harness(credential = 'synthetic-token') {
  const native = vi.fn<(options: NativeRequest) => void>(), clear = vi.fn(), module = { exports: {} };
  runInNewContext(readFileSync(path, 'utf8'), { module, wx: { request: native }, require: (name: string) => name === './session'
    ? { token: () => credential, clear } : localRequire(name) });
  return { native, clear, setCredential(value: string) { credential = value; }, request: (module.exports as { request(path: string, options?: Options): Promise<unknown> }).request };
}
const error = (promise: Promise<unknown>) => promise.catch(cause => cause as Error & { status?: number; code?: string });
describe('原生HTTP传输的简介周期契约', () => {
  it('明确认证PUT以固定本站Origin兼容既有来源检查，正文保留两项并发凭据', async () => {
    const { request, native } = harness();
    const body = { revision: null, membershipVersion: 'synthetic-original-period', profile: { displayName: '合成昵称', position: '', biography: '', avatar: null, visible: false } };
    const pending = request('/api/team-profiles/11', { method: 'PUT', required: true, raw: true, siteWrite: true, data: body });
    const sent = native.mock.calls[0][0];
    expect(sent.url).toBe('https://home.thuzijing.top/api/team-profiles/11');
    expect(sent.header).toMatchObject({ Origin: 'https://home.thuzijing.top', Authorization: 'JWT synthetic-token' });
    expect(sent).toMatchObject({ data: body }); expect(sent.header).not.toHaveProperty('Referer');
    sent.success({ statusCode: 200, data: { profile: { ...body.profile, revision: 1 } } });
    await expect(pending).resolves.toMatchObject({ profile: { revision: 1, visible: false } });
  });
  it.each([{ method: 'GET', required: true, siteWrite: true }, { method: 'POST', required: true }, { method: 'PUT', auth: false, siteWrite: true }])('普通/匿名请求不会附带本站写入Origin：%j', async options => {
    const { request, native } = harness();
    const pending = request('/api/miniapp/status', options);
    const sent = native.mock.calls[0][0]; expect(sent.header).not.toHaveProperty('Origin');
    sent.success({ statusCode: 200, data: {} }); await pending;
  });
  it('缺少登录凭据时拒绝写入，不能用Origin代替身份', async () => {
    const { request, native } = harness('');
    await expect(request('/api/team-profiles/11', { method: 'PUT', required: true, siteWrite: true })).rejects.toMatchObject({ status: 401 });
    expect(native).not.toHaveBeenCalled();
  });
  it('409的已知周期变化码原样保留，其他码和私有错误数据不流入页面', async () => {
    const { request, native } = harness();
    const pending = error(request('/api/team-profiles/11', { method: 'PUT', required: true }));
    native.mock.calls[0][0].success({ statusCode: 409, data: { error: '入队周期变化，请重新加载', code: 'PROFILE_PERIOD_CHANGED', membership: 999, debug: 'private-detail' } });
    await expect(pending).resolves.toMatchObject({ status: 409, code: 'PROFILE_PERIOD_CHANGED' });
    expect(await pending).not.toHaveProperty('membership'); expect(await pending).not.toHaveProperty('debug');
    const unknown = error(request('/api/team-profiles/11', { method: 'PUT', required: true }));
    native.mock.calls[1][0].success({ statusCode: 409, data: { code: 'unknown-private-code' } });
    expect(await unknown).not.toHaveProperty('code');
    const failure = error(request('/api/team-profiles/11', { method: 'PUT', required: true }));
    native.mock.calls[2][0].success({ statusCode: 500, data: { code: 'PROFILE_PERIOD_CHANGED', error: 'SQL password private' } });
    expect(await failure).toMatchObject({ message: '服务暂时不可用，请稍后重试', status: 500 });
    expect(await failure).not.toHaveProperty('code');
  });
  it('401继续清除失效会话，调用方不能保留旧身份重放', async () => {
    const { request, native, clear } = harness();
    const pending = error(request('/api/team-profiles/11', { required: true }));
    native.mock.calls[0][0].success({ statusCode: 401, data: { error: '旧会话不可用' } });
    expect(await pending).toMatchObject({ status: 401 }); expect(clear).toHaveBeenCalledOnce();
  });
  it.each(['synthetic-new-account-token', 'synthetic-refreshed-same-account-token'])('旧请求迟到401不清掉后来有效的凭据：%s', async current => {
    const { request, native, clear, setCredential } = harness();
    const pending = error(request('/api/team-profiles/11', { required: true }));
    expect(native.mock.calls[0][0].header.Authorization).toBe('JWT synthetic-token');
    setCredential(current);
    native.mock.calls[0][0].success({ statusCode: 401, data: { error: '旧会话失效' } });
    expect(await pending).toMatchObject({ status: 401 }); expect(clear).not.toHaveBeenCalled();
    const fresh = request('/api/miniapp/team', { required: true });
    expect(native.mock.calls[1][0].header.Authorization).toBe('JWT ' + current);
    native.mock.calls[1][0].success({ statusCode: 200, data: {} }); await fresh;
  });
});

describe('微信request method边界：未支持方式在调用SDK前拒绝', () => {
  it.each(['PATCH', 'patch', 'MERGE', 'post', '', 'POST '])('本地拒绝%s，不向SDK发送或自动fallback', async method => {
    const { request, native } = harness();
    native.mockImplementation(options => options.fail());
    await expect(request('/api/miniapp/status', { method, required: true, siteWrite: true })).rejects.toThrow('请求方式不受小程序支持');
    expect(native).not.toHaveBeenCalled();
  });
  it.each([undefined, 'OPTIONS', 'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'TRACE', 'CONNECT'])('保留官方允许的%s，Origin仅加入明确本站写入', async method => {
    const { request, native } = harness();
    const pending = request('/api/miniapp/status', { method, required: true, siteWrite: true });
    const sent = native.mock.calls[0][0];
    expect(sent.method).toBe(method ?? 'GET');
    if (method && ['POST', 'PUT', 'DELETE'].includes(method)) expect(sent.header.Origin).toBe('https://home.thuzijing.top');
    else expect(sent.header).not.toHaveProperty('Origin');
    sent.success({ statusCode: 200, data: {} }); await pending;
    expect(native).toHaveBeenCalledOnce();
  });
});
