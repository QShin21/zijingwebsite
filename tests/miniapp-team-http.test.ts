import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getPayload, type Payload } from 'payload';
import config from '../src/payload.config';
import type { User } from '../src/payload-types';
import { defaultTeamForm, submitTeamEstablishment, decideTeamEstablishment, saveTeamRecruitment } from '../src/lib/team-core';

// Real route handlers, JWT authentication, ACLs and core writes on a guarded
// disposable loopback database. The CMS locator and unrelated registration
// action exports are replaced; team/auth/ACL/database behavior stays real.
const locator = vi.hoisted(() => ({ cms: vi.fn() }));
vi.mock('../src/lib/content', () => ({ cms: locator.cms }));
vi.mock('../src/app/(frontend)/account/actions', () => ({ beginRegistrationAction: vi.fn(), registerAction: vi.fn() }));
import { GET as nativeGET } from '../src/app/(frontend)/api/miniapp/[...path]/route';
import { GET as coreGET, POST as corePOST } from '../src/app/(frontend)/api/team-core/route';

let p: Payload, leader: User, manager: User, candidate: User, outsider: User;
let gameID: number, teamID: number, batchID: number, applicationID: number, applicationRevision: string;
const users: number[] = [], suffix = randomBytes(5).toString('hex');
const password = 'Synthetic-Miniapp-Route-Only-482!';
const tokens = new Map<number, string>();
const answers = { gameID: '合成游戏ID', position: '合成位置', experience: '合成经历', availability: '合成训练时间', contact: 'synthetic-private-contact@example.invalid' };
async function createUser(label: string, roles: User['roles']) {
  const user = await p.create({ collection: 'users', overrideAccess: true, context: { system: true },
    data: { name: label + suffix, email: suffix + '-' + users.length + '@example.invalid', password, roles } });
  users.push(user.id);
  return user;
}
async function read(path: string, actor: User | null) {
  return nativeGET(new Request('http://localhost:3000/api/miniapp/' + path, {
    headers: actor ? { authorization: 'JWT ' + tokens.get(actor.id) } : {},
  }), { params: Promise.resolve({ path: path.split('?')[0].split('/') }) });
}
async function write(actor: User, data: Record<string, unknown>, origin?: string) {
  return corePOST(new Request('http://localhost:3000/api/team-core', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'JWT ' + tokens.get(actor.id), ...(origin ? { origin } : {}) },
    body: JSON.stringify(data) }));
}
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (process.env.APP_ENV !== 'development' || process.env.DB_PUSH !== 'false' || !['127.0.0.1', 'localhost'].includes(url.hostname))
    throw new Error('Explicit synthetic loopback database and DB_PUSH=false required');
  p = await getPayload({ config }); locator.cms.mockResolvedValue(p);
  leader = await createUser('小程序合成负责人', ['president']);
  manager = await createUser('小程序合成管理者', ['member']);
  candidate = await createUser('小程序合成候选人', ['member']);
  outsider = await createUser('小程序合成旁观者', ['backbone']);
  gameID = (await p.create({ collection: 'games', overrideAccess: true, context: { system: true },
    data: { title: '合成小程序队伍社群', slug: 'miniapp-team-http-' + suffix, _status: 'published' } })).id;
  manager = await p.update({ collection: 'users', id: manager.id, user: leader, overrideAccess: false,
    data: { communityOffices: [{ game: gameID, status: 'active', publishContent: true, handleJoins: true }] } });
  const proposal = await submitTeamEstablishment(p, manager, { gameID, title: '合成小程序代表队' + suffix, reason: '合成固定训练与人工选拔计划。' });
  const approved = await decideTeamEstablishment(p, leader, proposal.id, 'approved', '', proposal.updatedAt);
  teamID = Number(approved.team);
  batchID = (await saveTeamRecruitment(p, manager, { teamID, title: '合成小程序队伍批次' + suffix, status: 'open',
    form: { ...defaultTeamForm, end: new Date(Date.now() + 86400000).toISOString() } })).id;
  for (const actor of [leader, manager, candidate, outsider]) {
    const login = await p.login({ collection: 'users', data: { email: actor.email, password } });
    if (!login.token) throw new Error('Synthetic route login failed');
    tokens.set(actor.id, login.token);
  }
}, 30000);
afterAll(async () => {
  if (!p) return;
  // Only this file's random synthetic fixtures, never production evidence.
  if (gameID) for (const collection of ['team-memberships', 'team-join-applications', 'team-recruitments', 'team-establishment-applications', 'teams'] as const)
    await p.delete({ collection, overrideAccess: true, where: { game: { equals: gameID } } });
  for (const id of users) await p.delete({ collection: 'users', id, overrideAccess: true, context: { system: true } });
  if (gameID) await p.delete({ collection: 'games', id: gameID, overrideAccess: true });
  await p.destroy();
});

describe('小程序队伍合同真实路由与合成数据库', () => {
  it('部分草稿与正式提交走原HTTP写接口、保留同一编号，并接受相同网络重试', async () => {
    const metadata = await read('team/recruitment/' + batchID, candidate);
    expect(metadata.status).toBe(200);
    expect(metadata.headers.get('cache-control')).toBe('private, no-store');
    const info = await metadata.json();
    expect(info.actions).toMatchObject({ draft: true, submit: true, review: false });
    const draftResponse = await write(candidate, { operation: 'save-join', id: batchID, action: 'draft', version: info.version, answers: { gameID: answers.gameID } });
    expect(draftResponse.status).toBe(200);
    const draft = (await draftResponse.json()).result;
    expect(draft.status).toBe('draft');
    const input = { operation: 'save-join', id: batchID, action: 'submit', version: info.version, revision: draft.updatedAt, answers };
    const submitted = await write(candidate, input);
    expect(submitted.status).toBe(200);
    const receipt = (await submitted.json()).result;
    applicationID = receipt.id; applicationRevision = receipt.updatedAt;
    expect(receipt.id).toBe(draft.id); expect(receipt.status).toBe('pending');
    const retry = await write(candidate, input);
    expect(retry.status).toBe(200); expect((await retry.json()).result.id).toBe(applicationID);
    const own = await (await read('team/recruitment/' + batchID, candidate)).json();
    expect(own.application.answers).toEqual(answers);
    expect(own.application).not.toHaveProperty('requestKey');
    expect(own.actions).toMatchObject({ edit: true, withdraw: true });
  });
  it('本人答案只给本人或当前授权队伍管理员，骨干无任职不能取得私有队列', async () => {
    const foreign = await (await read('team/recruitment/' + batchID, outsider)).json();
    expect(foreign.application).toBeNull();
    expect(JSON.stringify(foreign)).not.toContain(answers.contact);
    const forbidden = await read('team/' + teamID + '/workbench', outsider);
    expect(forbidden.status).toBe(403); expect(await forbidden.text()).not.toContain(answers.contact);
    const managed = await read('team/' + teamID + '/workbench', manager);
    expect(managed.status).toBe(200);
    const queue = await managed.json();
    expect(queue.applications.docs.find((doc: { id: number }) => doc.id === applicationID).answers).toEqual(answers);
    expect(JSON.stringify(queue)).not.toContain('requestKey');
    const staff = await (await read('workbench', manager)).json();
    expect(staff.reviewStaff).toBe(false);
    expect(p.collections).toHaveProperty('staff-batches'); expect(p.collections).toHaveProperty('staff-applications');
  });
  it('录取只建立权威成员关系，本人离队后重复批准不会复活资格或授予任职', async () => {
    const decided = await write(manager, { operation: 'decide-join', id: applicationID, revision: applicationRevision, decision: 'approved', note: '' });
    expect(decided.status).toBe(200);
    const approved = (await decided.json()).result;
    let hub = await (await read('team', candidate)).json();
    const membership = hub.memberships.docs.find((doc: { teamID: number }) => doc.teamID === teamID);
    expect(membership.actions.leave).toBe(true); expect(membership).not.toHaveProperty('memberID'); expect(membership).not.toHaveProperty('membershipKey');
    const actor = await p.findByID({ collection: 'users', id: candidate.id, overrideAccess: true, depth: 0 });
    expect(actor.roles).toEqual(['member']); expect(actor.communityOffices || []).toEqual([]);
    const left = await write(candidate, { operation: 'leave', id: membership.id, revision: membership.updatedAt, note: '' });
    expect(left.status).toBe(200); expect((await left.json()).result.status).toBe('revoked');
    const repeatApproval = await write(manager, { operation: 'decide-join', id: applicationID, revision: approved.updatedAt, decision: 'approved', note: '' });
    expect(repeatApproval.status).toBe(200);
    hub = await (await read('team', candidate)).json();
    expect(hub.memberships.docs.find((doc: { id: number }) => doc.id === membership.id)).toMatchObject({ status: 'revoked', actions: { leave: false } });
  });
  it('撤销任职后旧JWT立即失去私有队伍能力，跨站写入及匿名读取被拒绝', async () => {
    await p.update({ collection: 'users', id: manager.id, user: leader, overrideAccess: false,
      data: { communityOffices: [{ game: gameID, status: 'revoked', publishContent: true, handleJoins: true }] } });
    const revoked = await read('team/' + teamID + '/workbench', manager);
    expect(revoked.status).toBe(403); expect(await revoked.text()).not.toContain(answers.contact);
    const hub = await (await read('team', manager)).json();
    expect(hub.managedTeams.docs).toEqual([]); expect(hub.actions.establish).toBe(false);
    const denied = await write(manager, { operation: 'decide-join', id: applicationID, revision: applicationRevision, decision: 'approved' });
    // The core's record ACL can conceal this now-private record with 404.
    expect([403, 404]).toContain(denied.status);
    expect(await denied.json()).not.toHaveProperty('result');
    const current = await (await read('team', candidate)).json();
    expect(current.memberships.docs.find((doc: { teamID: number }) => doc.teamID === teamID).status).toBe('revoked');
    expect((await write(candidate, { operation: 'leave', id: 1 }, 'https://example.invalid')).status).toBe(403);
    expect((await read('team', null)).status).toBe(401);
    expect((await read('team/recruitment/true', candidate)).status).toBe(404);
  });
  it('隐藏批次后的本人回执只取旧快照与反馈，小程序关闭所有申请写动作', async () => {
    const info = await (await read('team/recruitment/' + batchID, outsider)).json();
    const submission = await write(outsider, { operation: 'save-join', id: batchID, action: 'submit', version: info.version, answers });
    expect(submission.status).toBe(200);
    const submitted = (await submission.json()).result;
    const returnedResponse = await write(leader, { operation: 'decide-join', id: submitted.id, revision: submitted.updatedAt,
      decision: 'returned', note: '合成原申请反馈：请补充训练时间' });
    expect(returnedResponse.status).toBe(200);
    const returned = (await returnedResponse.json()).result;
    const batch = await p.findByID({ collection: 'team-recruitments', id: batchID, overrideAccess: true, depth: 0 });
    const hiddenMarker = 'synthetic-hidden-current-question-should-never-leak';
    const hiddenForm = { ...defaultTeamForm, questions: [...defaultTeamForm.questions, { id: 'hiddenOnly', type: 'text', label: hiddenMarker, required: false }] };
    await saveTeamRecruitment(p, leader, { id: batchID, teamID, revision: batch.updatedAt, title: batch.title, status: 'draft', form: hiddenForm });
    const core = await coreGET(new Request('http://localhost:3000/api/team-core?mode=recruitment&id=' + batchID,
      { headers: { authorization: 'JWT ' + tokens.get(outsider.id) } }));
    expect(core.status).toBe(200); expect(core.headers.get('cache-control')).toBe('private, no-store');
    const historical = await core.json();
    expect(historical.readOnly).toBe(true); expect(historical.application.id).toBe(returned.id);
    expect(historical.application.answers).toEqual(answers); expect(historical.application.reviewNote).toBe(returned.reviewNote);
    expect(historical.form).toMatchObject({ enabled: false, closed: true });
    expect(JSON.stringify(historical)).not.toContain(hiddenMarker);
    const native = await (await read('team/recruitment/' + batchID, outsider)).json();
    expect(native.readonly).toBe(true); expect(native.historyNote).toBeTruthy();
    expect(native.actions).toEqual({ draft: false, submit: false, edit: false, withdraw: false, review: false, workbench: false });
    expect(native.application.answers).toEqual(answers); expect(JSON.stringify(native)).not.toContain(hiddenMarker);
    const hub = await (await read('team', outsider)).json();
    expect(hub.ownApplications.docs.find((doc: { id: number }) => doc.id === returned.id).actions).toMatchObject({ view: true, edit: false, withdraw: false });
    expect((await read('team/recruitment/' + batchID, manager)).status).toBe(404);
    for (const action of ['draft', 'submit']) {
      const denied = await write(outsider, { operation: 'save-join', id: batchID, action, version: historical.version, revision: returned.updatedAt, answers });
      expect([403, 404, 409]).toContain(denied.status); expect(await denied.json()).not.toHaveProperty('result');
    }
  });
  it('小程序凭当前工作台修订发布选拔问卷，过期时间和无权写入被拒绝', async () => {
    const created = await write(leader, { operation: 'save-recruitment', teamID, title: '合成待发布招新', status: 'draft',
      form: { ...defaultTeamForm, enabled: false, closed: true } });
    expect(created.status).toBe(200);
    const draft = (await created.json()).result;
    const workbench = await (await read('team/' + teamID + '/workbench', leader)).json();
    const row = workbench.recruitments.docs.find((value: { id: number }) => value.id === draft.id);
    expect(row).toMatchObject({ status: 'draft', actions: { edit: true } });
    const detail = await (await read('team/recruitment/' + draft.id, leader)).json();
    expect(detail).toMatchObject({ recruitmentID: draft.id, teamID, actions: { workbench: true } });
    expect((await read('team/recruitment/' + draft.id, candidate)).status).toBe(404);
    const publish = { operation: 'save-recruitment', id: row.id, revision: row.updatedAt, teamID, title: detail.title,
      status: 'open', form: { ...detail.form, enabled: true, closed: false, end: new Date(Date.now() + 86400000).toISOString() } };
    expect((await write(candidate, publish)).status).toBe(403);
    expect((await write(leader, { ...publish, form: { ...publish.form, end: '2000-01-01T00:00:00.000Z' } })).status).toBe(400);
    const opened = await write(leader, publish);
    expect(opened.status).toBe(200);
    expect((await opened.json()).result).toMatchObject({ id: draft.id, status: 'open', signupForm: publish.form });
    expect((await write(leader, publish)).status).toBe(409);
    const applicant = await (await read('team/recruitment/' + draft.id, candidate)).json();
    expect(applicant).toMatchObject({ state: '招新开放', actions: { submit: true }, form: publish.form });
  });
  it('队伍归档后的旧回执继续只读，当前隐藏问卷与申请写动作都不恢复', async () => {
    const current = await p.findByID({ collection: 'teams', id: teamID, overrideAccess: true, depth: 0 });
    const archive = await write(leader, { operation: 'lifecycle', id: teamID, status: 'archived', revision: current.updatedAt });
    expect(archive.status).toBe(200); expect((await archive.json()).result).toMatchObject({ archived: true, teamStatus: 'archived' });
    const info = await (await read('team/recruitment/' + batchID, outsider)).json();
    expect(info).toMatchObject({ readonly: true, state: '历史申请只读', actions: { draft: false, submit: false, edit: false, withdraw: false } });
    expect(info.application.answers).toEqual(answers); expect(info.application.reviewNote).toContain('合成原申请反馈');
    expect(JSON.stringify(info)).not.toContain('synthetic-hidden-current-question-should-never-leak');
    expect((await read('team/recruitment/' + batchID, manager)).status).toBe(404);
  });
});
