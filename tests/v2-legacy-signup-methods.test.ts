import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from 'payload';
import { normalizeSignup } from '../src/lib/signup-schema';

// Server route baseline for miniapp-signup-methods, signup-lifecycle and the
// view-only activity case in content-flows. Those legacy tests only executed
// synthetic client requests; these assert dispatch/projection without any client files.
const mocks = vi.hoisted(() => ({ cms: vi.fn(), activity: vi.fn(), own: vi.fn(), submit: vi.fn(), update: vi.fn(), save: vi.fn() }));
vi.mock('../src/lib/content', () => ({ cms: mocks.cms }));
vi.mock('../src/lib/activity-signups', async original => ({
  ...await original<typeof import('../src/lib/activity-signups')>(),
  activity: mocks.activity, ownSignup: mocks.own, submitSignup: mocks.submit, updateSignupAnswers: mocks.update, saveSignupForm: mocks.save,
}));
import { GET, POST, PATCH } from '../src/app/(frontend)/api/activities/[kind]/[id]/signup/route';
const actor = { id: 901, roles: ['member'], accountStatus: 'active' };
const form = normalizeSignup({ enabled: true, questions: [{ id: 'note', label: '合成答案', type: 'text', required: true }] });
const receipt = { id: 811, questions: form.questions, answers: { note: '合成原稿' }, formVersion: 'synthetic-v1', updatedAt: '2026-10-12T02:00:00Z', createdAt: '2026-10-12T01:00:00Z' };
let p: { auth: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn> };
const context = (kind: string) => ({ params: Promise.resolve({ kind, id: '55' }) });
const read = (kind: string, query = '', headers: Record<string, string> = {}) => GET(new Request('http://localhost:3000/api/activities/' + kind + '/55/signup' + query, { headers }), context(kind));
const write = (kind: string, data: Record<string, unknown>, patch = false) => (patch ? PATCH : POST)(new Request('http://localhost:3000/api/activities/' + kind + '/55/signup', {
  method: patch ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json', authorization: 'JWT synthetic-token', 'x-questionnaire-version': '3' }, body: JSON.stringify(data),
}), context(kind));
beforeEach(() => {
  vi.resetAllMocks();
  p = { auth: vi.fn().mockResolvedValue({ user: actor }), find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0, page: 1, totalPages: 1 }) };
  mocks.cms.mockResolvedValue(p);
  mocks.activity.mockResolvedValue({ doc: { title: '合成活动' }, form, version: 'synthetic-v1', manager: false, canView: true, canExport: false, images: [] });
  mocks.own.mockResolvedValue(receipt); mocks.submit.mockResolvedValue(receipt); mocks.update.mockResolvedValue(receipt);
});
describe.each(['events', 'community-posts'])('V2保留：%s报名路由', kind => {
  it('POST edit仅调用修改服务，旧编号/修订/完整答案原样传入', async () => {
    const response = await write(kind, { action: 'edit', version: 'synthetic-v1', revision: receipt.updatedAt, answers: { note: '合成新稿' }, actor: { id: 999 }, context: { system: true } });
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(p, kind, 55, actor, 'synthetic-v1', receipt.updatedAt, { note: '合成新稿' });
    expect(mocks.submit).not.toHaveBeenCalled(); expect(await response.json()).toEqual({ signup: receipt, message: '作答修改已保存' });
  });
  it('普通首次POST调用原提交服务，不增加修改或修订语义', async () => {
    const response = await write(kind, { version: 'synthetic-v1', answers: { note: '合成新稿' } });
    expect(response.status).toBe(200); expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(p, kind, 55, actor, 'synthetic-v1', { note: '合成新稿' });
    expect(mocks.update).not.toHaveBeenCalled(); expect(await response.json()).toEqual({ signup: receipt, message: '报名成功，已确认报名' });
  });
  it('旧PATCH仍映射同一修改服务，兼容入口不删除', async () => {
    expect((await write(kind, { version: 'synthetic-v1', revision: receipt.updatedAt, answers: receipt.answers }, true)).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(p, kind, 55, actor, 'synthetic-v1', receipt.updatedAt, receipt.answers);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it.each([401, 403, 409])('修改服务%s保留路由状态，无自动重试或首次提交fallback', async status => {
    mocks.update.mockRejectedValue(new APIError('合成拒绝修改', status));
    const response = await write(kind, { action: 'edit', version: 'synthetic-v1', revision: receipt.updatedAt, answers: receipt.answers });
    expect(response.status).toBe(status); expect(await response.json()).toEqual({ error: '合成拒绝修改' });
    expect(mocks.update).toHaveBeenCalledTimes(1); expect(mocks.submit).not.toHaveBeenCalled(); expect(p.find).not.toHaveBeenCalled();
  });
  it('GET mode=view只投影当前能力与本人回执，名单另走entries', async () => {
    const response = await read(kind, '?mode=view'), data = await response.json();
    expect(response.status).toBe(200); expect(data).toMatchObject({ canManage: false, canViewSignups: true, canExportSignups: false, signup: receipt });
    expect(mocks.activity).toHaveBeenCalledWith(p, kind, 55, actor, true, undefined, 'view', false);
    expect(mocks.own).toHaveBeenCalledExactlyOnceWith(p, kind, 55, actor);
    expect(p.find.mock.calls.filter(([query]) => query.collection === 'event-signups')).toHaveLength(0);
    await read(kind, '?mode=entries&page=2');
    expect(p.find.mock.calls.filter(([query]) => query.collection === 'event-signups')).toEqual([[expect.objectContaining({ collection: 'event-signups', overrideAccess: false, user: actor, depth: 0, page: 2, limit: 20,
      where: { and: [{ activityType: { equals: kind } }, { activityID: { equals: 55 } }] },
      select: { memberName: true, answers: true, questions: true, createdAt: true, updatedAt: true },
    })]]);
  });
  it('已撤销名单权限403，停止私人名单及本人资料查询', async () => {
    mocks.activity.mockRejectedValue(new APIError('无权读取此活动报名', 403));
    const response = await read(kind, '?mode=entries');
    expect(response.status).toBe(403); expect(p.find).not.toHaveBeenCalled(); expect(mocks.own).not.toHaveBeenCalled();
  });
  it('JWT旧问卷协议遇16类扩展返回409，v3才能获取当前表单', async () => {
    const modern = normalizeSignup({ ...form, questions: [...form.questions, { id: 'date', label: '合成日期', type: 'date', required: true }] });
    mocks.activity.mockResolvedValue({ doc: { title: '合成活动' }, form: modern, version: 'synthetic-v2', manager: false, canView: false, canExport: false });
    expect((await read(kind, '', { authorization: 'JWT synthetic-token' })).status).toBe(409);
    const response = await read(kind, '', { authorization: 'JWT synthetic-token', 'x-questionnaire-version': '3' });
    expect(response.status).toBe(200); expect((await response.json()).form).toEqual(modern);
  });
  it('未知服务器错误500且剥离SQL、邮箱及内部细节', async () => {
    mocks.update.mockRejectedValue(new Error('SQL synthetic-private@example.invalid internal_revision_rule'));
    const response = await write(kind, { action: 'edit' });
    expect(response.status).toBe(500); expect(await response.text()).not.toMatch(/SQL|synthetic-private|internal_revision_rule/);
  });
});
