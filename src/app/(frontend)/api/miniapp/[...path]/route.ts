import { cms } from '@/lib/content';
import { miniappLogin } from '@/lib/miniapp-auth';
import { beginRegistrationAction, registerAction } from '@/app/(frontend)/account/actions';
import { schoolEmail, validPassword, issueCode, consumeCode } from '@/lib/verification';
import { miniappClubGET, miniappClubPOST, miniappClubReadPath, miniappClubWritePath } from '@/lib/miniapp-club';
import { applicationError } from '@/lib/application-error';
import { miniappTeamGET, miniappTeamReadPath } from '@/lib/miniapp-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });
type Context = { params: Promise<{ path: string[] }> };
const text = (value: unknown) => typeof value === 'string' ? value : '';
async function json(request: Request, limit = 32_768): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Invalid request');
  if (Number(request.headers.get('content-length')) > limit) throw new Error('Invalid request');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid request');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('Invalid request'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const raw = Buffer.concat(chunks).toString('utf8');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request');
  return value as Record<string, unknown>;
}
async function clubReply(operation: () => Promise<unknown>) {
  try { return reply(await operation()); }
  catch (error) {
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' &&
      Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
    return reply({ error: applicationError(error) }, status);
  }
}
export async function GET(request: Request, context: Context) {
  const path = (await context.params).path.join('/');
  if (path === 'status') return reply({ version: 2, authentication: ['email', 'nickname'], registration: true, questionnaireVersion: 3, responseEditing: true, operationsVersion: 1, platformRoles: ['member', 'backbone', 'vicePresident', 'president'], communityOffices: true, manualWechatJoin: false });
  if (miniappTeamReadPath(path)) return clubReply(async () => miniappTeamGET(await cms(), request, path));
  if (miniappClubReadPath(path)) return clubReply(async () => miniappClubGET(await cms(), request, path));
  return reply({ error: '接口不存在' }, 404);
}
export async function POST(request: Request, context: Context) {
  const path = (await context.params).path.join('/');
  let data: Record<string, unknown>;
  try { data = await json(request, path === 'community/applications' ? 3 * 1024 * 1024 : 32_768); } catch { return reply({ error: '请求格式不正确' }, 400); }
  if (miniappClubWritePath(path)) return clubReply(async () => miniappClubPOST(await cms(), request, path, data));
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
  return reply({ error: '接口不存在' }, 404);
}
