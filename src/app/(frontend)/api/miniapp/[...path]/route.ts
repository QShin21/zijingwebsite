import { cms } from '@/lib/content';
import { miniappLogin } from '@/lib/miniapp-auth';
import { beginRegistrationAction, registerAction } from '@/app/(frontend)/account/actions';
import { canParticipate } from '@/lib/rules';
import { schoolEmail, validPassword, issueCode, consumeCode } from '@/lib/verification';
import type { Payload, Where } from 'payload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });
type Context = { params: Promise<{ path: string[] }> };
const text = (value: unknown) => typeof value === 'string' ? value : '';
async function json(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Invalid request');
  if (Number(request.headers.get('content-length')) > 32_768) throw new Error('Invalid request');
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 32_768) throw new Error('Invalid request');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request');
  return value as Record<string, unknown>;
}
async function member(p: Payload, request: Request) {
  // This JSON bridge uses explicit credentials; ambient browser cookies cannot authorize writes.
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^(JWT|Bearer) [A-Za-z0-9._-]+$/.test(authorization)) return null;
  const result = await p.auth({ headers: new Headers({ authorization }) });
  return result.user && canParticipate(result.user) ? result.user : null;
}
function reactionTarget(data: Record<string, unknown>) {
  const collection: 'forum-posts' | 'community-posts' | null = data.targetType === 'forum-posts' ? 'forum-posts'
    : data.targetType === 'community-posts' ? 'community-posts' : null;
  const id = Number(data.targetId);
  if (!collection || !Number.isSafeInteger(id) || id < 1) return null;
  return { collection, id };
}
export async function GET(request: Request, context: Context) {
  const path = (await context.params).path.join('/');
  if (path === 'status') return reply({ version: 1, authentication: ['email', 'nickname'], registration: true });
  if (path !== 'reactions') return reply({ error: '接口不存在' }, 404);
  try {
    const p = await cms(); const user = await member(p, request);
    if (!user) return reply({ error: '请先登录' }, 401);
    const target = reactionTarget(Object.fromEntries(new URL(request.url).searchParams));
    if (!target) return reply({ error: '互动对象无效' }, 400);
    const doc = await p.findByID({ collection: target.collection, id: target.id,
      overrideAccess: false, user: null, depth: 0, select: { status: true } }).catch(() => null);
    if (!doc || doc.status !== 'visible') return reply({ error: '内容暂不可用' }, 404);
    const where: Where = { targetType: { equals: target.collection }, targetId: { equals: target.id } };
    const [likes, attends, own] = await Promise.all([
      p.count({ collection: 'community-reactions', overrideAccess: false, user: null, where: { ...where, kind: { equals: 'like' } } }),
      p.count({ collection: 'community-reactions', overrideAccess: false, user: null, where: { ...where, kind: { equals: 'attend' } } }),
      p.find({ collection: 'community-reactions', overrideAccess: false, user, context: { ownReactions: true },
        where, depth: 0, limit: 2, select: { kind: true } }),
    ]);
    return reply({ likes: likes.totalDocs, attends: attends.totalDocs,
      liked: own.docs.some(value => value.kind === 'like'), attending: own.docs.some(value => value.kind === 'attend') });
  } catch { return reply({ error: '暂时无法读取互动状态' }, 503); }
}
export async function POST(request: Request, context: Context) {
  const path = (await context.params).path.join('/');
  let data: Record<string, unknown>;
  try { data = await json(request); } catch { return reply({ error: '请求格式不正确' }, 400); }
  if (path === 'auth/login') {
    try {
      return reply(await miniappLogin(await cms(), text(data.identifier), text(data.password)));
    } catch { return reply({ error: '昵称、邮箱或密码错误，或账号暂不可用' }, 400); }
  }
  if (path === 'auth/register/begin' || path === 'auth/register/complete') {
    const form = new FormData();
    for (const field of ['emailPrefix', 'emailDomain', 'name', 'password', 'confirm', 'code']) form.set(field, text(data[field]));
    const result = path.endsWith('/begin') ? await beginRegistrationAction(form) : await registerAction(form);
    return reply(result, 'error' in result ? 400 : 200);
  }
  if (path === 'auth/password/code' || path === 'auth/password/reset') {
    const email = schoolEmail(data.email);
    if (!email) return reply({ error: '请使用清华师生或校友邮箱' }, 400);
    try {
      const p = await cms();
      if (path.endsWith('/reset') && (!validPassword(data.password) || data.password !== data.confirm))
        return reply({ error: '密码至少 8 位，两次输入需一致' }, 400);
      if (path.endsWith('/reset') && !(await consumeCode(email, 'password', text(data.code))))
        return reply({ error: '验证码错误、过期或尝试次数过多' }, 400);
      const found = await p.find({ collection: 'users', overrideAccess: true,
        where: { email: { equals: email } }, limit: 1, depth: 0, select: { email: true } });
      if (found.docs[0]) {
        if (path.endsWith('/code')) await issueCode(p, email, 'password', request.headers.get('x-real-ip') || 'unknown');
        else await p.update({ collection: 'users', id: found.docs[0].id, overrideAccess: true,
          context: { verifiedPasswordChange: true }, data: { password: text(data.password) } });
      }
      return reply({ success: true });
    } catch (cause) {
      const message = cause instanceof Error && /频繁|60 秒/.test(cause.message) ? cause.message : '邮件验证暂不可用，请稍后联系管理员';
      return reply({ error: message }, 400);
    }
  }
  if (path === 'reactions/toggle') {
    try {
      const p = await cms(); const user = await member(p, request);
      if (!user) return reply({ error: '请先登录' }, 401);
      const target = reactionTarget(data);
      if (!target || !['like', 'attend'].includes(text(data.kind))) return reply({ error: '互动对象无效' }, 400);
      const kind = data.kind as 'like' | 'attend';
      const doc = await p.findByID({ collection: target.collection, id: target.id,
        overrideAccess: false, user: null, depth: 0, select: { status: true } }).catch(() => null);
      if (!doc || doc.status !== 'visible') return reply({ error: '内容暂不可用' }, 404);
      const result = await p.find({ collection: 'community-reactions', overrideAccess: false, user,
        context: { ownReactions: true }, depth: 0, limit: 1,
        where: { targetType: { equals: target.collection }, targetId: { equals: target.id }, kind: { equals: kind } } });
      if (result.docs[0]) await p.delete({ collection: 'community-reactions', id: result.docs[0].id, overrideAccess: false, user });
      else await p.create({ collection: 'community-reactions', overrideAccess: false, user,
        data: { targetType: target.collection, targetId: target.id, kind, author: user.id, key: 'server-derived' } });
      return reply({ active: !result.docs[0] });
    } catch { return reply({ error: '互动未完成，请检查权限后重试' }, 400); }
  }
  return reply({ error: '接口不存在' }, 404);
}
