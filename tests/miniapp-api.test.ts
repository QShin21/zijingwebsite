import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payload } from 'payload';
import type { User } from '../src/payload-types';
import { miniappLogin, miniappUser } from '../src/lib/miniapp-auth';
const mocked = vi.hoisted(() => ({ cms: vi.fn(), begin: vi.fn(), register: vi.fn(), consume: vi.fn(), issue: vi.fn() }));
vi.mock('../src/lib/content', () => ({ cms: mocked.cms }));
vi.mock('../src/app/(frontend)/account/actions', () => ({ beginRegistrationAction: mocked.begin, registerAction: mocked.register }));
vi.mock('../src/lib/verification', () => ({
  schoolEmail: (email: unknown) => typeof email === 'string' && /^[^@]+@mails\.tsinghua\.edu\.cn$/.test(email) ? email : null,
  validPassword: (password: unknown) => typeof password === 'string' && password.length >= 8,
  consumeCode: mocked.consume, issueCode: mocked.issue,
}));
import { GET, POST } from '../src/app/(frontend)/api/miniapp/[...path]/route';
let p: Record<string, ReturnType<typeof vi.fn>>;
const user = { id: 5, email: 'fixture@mails.tsinghua.edu.cn', name: '测试用户', roles: ['member'], accountStatus: 'active', communities: [], password: 'never-return', nameKey: 'private' };
const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
const req = (data: unknown, headers: Record<string, string> = {}) => new Request('https://home.thuzijing.top/api/miniapp/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
});
beforeEach(() => {
  p = { find: vi.fn().mockResolvedValue({ docs: [] }), findByID: vi.fn(), login: vi.fn(), auth: vi.fn(),
    update: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn().mockResolvedValue({ totalDocs: 0 }) };
  mocked.cms.mockResolvedValue(p); mocked.begin.mockResolvedValue({ email: 'fixture@mails.tsinghua.edu.cn' });
  mocked.register.mockResolvedValue({ success: true }); mocked.consume.mockResolvedValue(false);
});
afterEach(() => { vi.clearAllMocks(); });
describe('小程序 JSON 身份接口', () => {
  it('昵称解析在服务端完成，响应只含当前用户最小字段', async () => {
    p.find.mockResolvedValue({ docs: [{ id: 5, email: user.email }] });
    p.login.mockResolvedValue({ user, token: 'fixture-token', exp: 9999999999 });
    const result = await miniappLogin(p as unknown as Payload, ' 测试用户 ', 'fixture-password');
    expect(p.find.mock.calls[0][0]).toMatchObject({ where: { nameKey: { equals: '测试用户' } }, select: { email: true } });
    expect(p.login.mock.calls[0][0].data.email).toBe(user.email);
    expect(result.user).not.toHaveProperty('password'); expect(result.user).not.toHaveProperty('nameKey');
    expect(miniappUser(user as unknown as User)).not.toHaveProperty('salt');
  });
  it('停用账号及错误昵称只返回统一错误，不返回令牌或邮箱映射', async () => {
    p.login.mockResolvedValue({ user: { ...user, accountStatus: 'suspended' }, token: 'must-not-leak' });
    const response = await POST(req({ identifier: user.email, password: 'fixture' }), context('auth/login'));
    expect(response.status).toBe(400); expect(await response.text()).not.toContain('must-not-leak');
    await expect(miniappLogin(p as unknown as Payload, 'missing-nickname', 'fixture')).rejects.toThrow();
  });
  it('注册复用已有邮箱验证码动作，忽略客户端角色和系统上下文', async () => {
    const response = await POST(req({ emailPrefix: 'fixture', emailDomain: 'mails.tsinghua.edu.cn', name: '测试用户', password: 'fixture-password', confirm: 'fixture-password', roles: ['president'], context: { system: true } }), context('auth/register/begin'));
    expect(response.status).toBe(200);
    const form = mocked.begin.mock.calls[0][0] as FormData;
    expect(form.get('roles')).toBeNull(); expect(form.get('context')).toBeNull();
    expect(form.get('emailDomain')).toBe('mails.tsinghua.edu.cn');
  });
  it('验证码无效时拒绝密码更新，过大或非 JSON 请求不访问数据库', async () => {
    const response = await POST(req({ email: user.email, password: 'fixture-password', confirm: 'fixture-password', code: '000000' }), context('auth/password/reset'));
    expect(response.status).toBe(400); expect(p.update).not.toHaveBeenCalled();
    mocked.cms.mockClear();
    const huge = await POST(req({ payload: 'x'.repeat(40000) }), context('auth/login'));
    expect(huge.status).toBe(400); expect(mocked.cms).not.toHaveBeenCalled();
    const malformed = await POST(new Request('https://home.thuzijing.top/api/miniapp/auth/login', { method: 'POST', body: '{}' }), context('auth/login'));
    expect(malformed.status).toBe(400);
  });
});
describe('小程序互动与对象权限', () => {
  it('浏览器 Cookie 与客户端伪造用户均不能授权互动', async () => {
    const response = await POST(req({ targetType: 'forum-posts', targetId: 1, kind: 'like', user, context: { system: true } }, { cookie: 'payload-token=fixture' }), context('reactions/toggle'));
    expect(response.status).toBe(401); expect(p.auth).not.toHaveBeenCalled(); expect(p.create).not.toHaveBeenCalled();
  });
  it('公开读取仍关闭 overrideAccess、匿名、最小字段，自己的点赞使用服务端上下文', async () => {
    p.auth.mockResolvedValue({ user }); p.findByID.mockResolvedValue({ id: 1, status: 'visible' });
    p.find.mockResolvedValue({ docs: [{ id: 10, kind: 'like' }] });
    const response = await GET(new Request('https://home.thuzijing.top/api/miniapp/reactions?targetType=forum-posts&targetId=1', { headers: { authorization: 'JWT fixture-token' } }), context('reactions'));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ liked: true, attending: false });
    expect(p.findByID.mock.calls[0][0]).toMatchObject({ overrideAccess: false, user: null, depth: 0, select: { status: true } });
    expect(p.find.mock.calls[0][0]).toMatchObject({ overrideAccess: false, context: { ownReactions: true }, user });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('隐藏内容和任意目标类型不能触发创建或删除', async () => {
    p.auth.mockResolvedValue({ user }); p.findByID.mockResolvedValue({ id: 1, status: 'hidden' });
    const response = await POST(req({ targetType: 'forum-posts', targetId: 1, kind: 'like' }, { authorization: 'Bearer fixture-token' }), context('reactions/toggle'));
    expect(response.status).toBe(404); expect(p.delete).not.toHaveBeenCalled(); expect(p.create).not.toHaveBeenCalled();
    const invalid = await POST(req({ targetType: 'users', targetId: 5, kind: 'like' }, { authorization: 'Bearer fixture-token' }), context('reactions/toggle'));
    expect(invalid.status).toBe(400);
  });
});
