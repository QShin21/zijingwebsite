import { describe, expect, it, vi } from 'vitest';
import { APIError, type Payload, type PayloadRequest } from 'payload';
import type { User } from '../src/payload-types';
import { formVersion } from '../src/lib/activity-signups';
import { normalizeSignup, type Answers, type SignupForm } from '../src/lib/signup-schema';

// Backend-only preservation of miniapp-team-signup. The synthetic persistence
// and transaction boundary match the legacy harness; real core/DTO/HTTP code runs.
// This file never reads or imports client implementation files.
vi.mock('../src/lib/workflow-transactions', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/workflow-transactions')>(),
  workflowTransaction: async <T>(payload: Payload, actor: User | null, context: Record<string, unknown>, work: (req: PayloadRequest) => Promise<T>) => {
    if (!actor) throw new APIError('合成未登录', 401);
    const user = await payload.findByID({ collection: 'users', id: actor.id, overrideAccess: true });
    if (user.accountStatus === 'suspended') throw new APIError('合成账号停用', 403);
    return work({ user: { ...user, collection: 'users' }, context, payload } as PayloadRequest);
  },
}));

const locator = vi.hoisted(() => ({ cms: vi.fn() }));
vi.mock('../src/lib/content', () => ({ cms: locator.cms }));
import { GET, POST } from '../src/app/(frontend)/api/team-core/route';

type Actions = { draft: boolean; submit: boolean; edit: boolean; withdraw: boolean; review: boolean; workbench?: boolean };
type TeamReceipt = {
  id: number; status: string; teamID: number; recruitmentID: number; formVersion: string;
  formSnapshot: SignupForm; answers: Answers; reviewNote: string | null; createdAt: string; updatedAt: string;
};
type TeamDTO = Record<string, unknown> & {
  title: string; form: SignupForm; version: string; state: string; application: TeamReceipt | null; actions: Actions;
};
type CoreServices = {
  normalizeTeamForm(value: unknown): SignupForm;
  saveTeamJoinApplication(payload: Payload, actor: User | null, id: number, input: {
    action: 'draft' | 'submit'; version: unknown; revision?: unknown; answers: unknown;
  }): Promise<Doc>;
  withdrawTeamJoinApplication(payload: Payload, actor: User | null, id: number, revision: unknown): Promise<Doc>;
  teamJoinReceipt(value: Doc | null): TeamReceipt | null;
};
type Doc = Record<string, unknown> & { id: number; createdAt?: string; updatedAt?: string };
type Query = { collection: string; id?: number | string; where?: Record<string, unknown>; select?: Record<string, boolean>; data?: Record<string, unknown>; overrideAccess?: boolean };
const actorA: User = { id: 901, name: '合成队员甲', email: 'synthetic-team-a@example.invalid',
  createdAt: '2026-10-12T01:00:00Z', updatedAt: '2026-10-12T01:00:00Z',
  roles: ['member'], accountStatus: 'active', collection: 'users', communityOffices: [] };
const actorB: User = { ...actorA, id: 902, name: '合成队员乙', email: 'synthetic-team-b@example.invalid' };
const recruitmentID = 71;
const teamID = 51;
const coreAnswers: Answers = {
  gameID: '合成游戏ID', position: '合成位置', experience: '合成比赛经历',
  availability: '合成训练时间', contact: 'synthetic@example.invalid',
};
const coreForm = normalizeSignup({ enabled: true, pageSize: 20, questions: [
  { id: 'gameID', label: '游戏 ID', type: 'text', required: true },
  { id: 'position', label: '擅长位置', type: 'text', required: true },
  { id: 'experience', label: '比赛经历', type: 'textarea', required: true },
  { id: 'availability', label: '训练时间', type: 'textarea', required: true },
  { id: 'contact', label: '一种联系方式', type: 'text', required: true },
] });
const fullForm = normalizeSignup({ ...coreForm, questions: [
  ...coreForm.questions,
  { id: 'single', label: '单选', type: 'single', required: true, options: ['A', 'B'] },
  { id: 'multiple', label: '多选', type: 'multiple', required: true, options: ['A', 'B'] },
  { id: 'select', label: '下拉', type: 'select', required: true, options: ['A', 'B'] },
  { id: 'number', label: '数值', type: 'number', required: true, min: -2, max: 2, step: 0.5 },
  { id: 'date', label: '日期', type: 'date', required: true },
  { id: 'time', label: '时间', type: 'time', required: true },
  { id: 'rating', label: '评分', type: 'rating', required: true },
  { id: 'nps', label: '推荐值', type: 'nps', required: true },
  { id: 'ranking', label: '排序', type: 'ranking', required: true, options: ['A', 'B'] },
  { id: 'matrix', label: '矩阵单选', type: 'matrix', required: true, rows: ['行1'], options: ['A', 'B'] },
  { id: 'matrixMultiple', label: '矩阵多选', type: 'matrixMultiple', required: true, rows: ['行1'], options: ['A', 'B'] },
  { id: 'blanks', label: '多项填空', type: 'blanks', required: true, rows: ['子题'] },
  { id: 'group', label: '合成五至六人成员组', type: 'group', required: true, minEntries: 5, maxEntries: 6,
    fields: [{ id: 'name', label: '成员名', type: 'text', required: true, options: [] }] },
  { id: 'description', label: '段落说明', type: 'description' },
] });
const members = (count: number) => Array.from({ length: count }, (_, i) => ({ name: '合成成员' + (i + 1) }));
const fullAnswers: Answers = {
  ...coreAnswers, single: 'A', multiple: ['A', 'B'], select: 'B', number: '-1.5',
  date: '2026-10-12', time: '23:59', rating: '5', nps: '0', ranking: ['B', 'A'],
  matrix: { 行1: 'B' }, matrixMultiple: { 行1: ['A', 'B'] }, blanks: { 子题: '合成扩展答案' }, group: members(5),
};
function match(doc: Doc, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([field, value]) => {
    if (field === 'and') return (value as Record<string, unknown>[]).every(part => match(doc, part));
    if (field === 'or') return (value as Record<string, unknown>[]).some(part => match(doc, part));
    const condition = value as Record<string, unknown>, current = doc[field];
    if ('equals' in condition) return String(current) === String(condition.equals);
    if ('not_equals' in condition) return String(current) !== String(condition.not_equals);
    if ('in' in condition) return (condition.in as unknown[]).map(String).includes(String(current));
    throw new Error('Unsupported synthetic query operator');
  });
}
function memoryPayload(form: SignupForm = coreForm) {
  const collections = new Map<string, Map<number, Doc>>();
  const deniedReads = new Map<string, number>();
  const accessReads: Pick<Query, 'collection' | 'id' | 'overrideAccess'>[] = [];
  let tick = 0, nextID = 811;
  const rows = (collection: string) => {
    if (!collections.has(collection)) collections.set(collection, new Map());
    return collections.get(collection)!;
  };
  const seed = (collection: string, doc: Doc) => {
    if (collection === 'team-join-applications') nextID = Math.max(nextID, doc.id + 1);
    rows(collection).set(doc.id, structuredClone(doc));
  };
  for (const actor of [actorA, actorB]) seed('users', { ...actor });
  seed('games', { id: 31, _status: 'published', archived: false });
  seed('teams', { id: teamID, title: '合成代表队', game: 31, _status: 'published', teamStatus: 'active', archived: false, establishmentApplication: 501 });
  seed('team-establishment-applications', { id: 501, status: 'approved', team: teamID, game: 31 });
  seed('team-recruitments', { id: recruitmentID, title: '合成入队批次', status: 'open', team: teamID, game: 31, signupForm: form });
  const stamp = () => new Date(Date.UTC(2026, 9, 12, 4, 0, ++tick)).toISOString();
  const fake = {
    async auth({ headers }: { headers: Headers }) {
      const id = /^JWT synthetic-(\d+)$/.exec(headers.get('Authorization') || '')?.[1];
      return { user: id ? structuredClone(rows('users').get(Number(id)) ?? null) : null };
    },
    async findByID(query: Query) {
      accessReads.push({ collection: query.collection, id: query.id, overrideAccess: query.overrideAccess });
      const denied = deniedReads.get(query.collection + ':' + query.id);
      if (denied && query.overrideAccess === false) throw new APIError('合成集合访问被拒绝', denied);
      const doc = rows(query.collection).get(Number(query.id));
      if (!doc) throw new APIError('合成记录不存在', 404);
      return structuredClone(doc);
    },
    async find(query: Query) {
      const docs = Array.from(rows(query.collection).values()).filter(doc => match(doc, query.where));
      return { docs: structuredClone(docs), page: 1, totalPages: 1, totalDocs: docs.length, hasNextPage: false };
    },
    async create(query: Query) {
      const at = stamp(), doc = { ...query.data, id: nextID++, createdAt: at, updatedAt: at };
      seed(query.collection, doc);
      return structuredClone(doc);
    },
    async update(query: Query) {
      const previous = await fake.findByID(query);
      const doc = { ...previous, ...query.data, updatedAt: stamp() };
      seed(query.collection, doc);
      return structuredClone(doc);
    },
  };
  return { payload: fake as unknown as Payload, rows, seed, accessReads,
    denyRead(collection: string, id: number, status: number) { deniedReads.set(collection + ':' + id, status); } };
}
async function coreService() { return vi.importActual<CoreServices>('../src/lib/team-core'); }
async function readTeam(payload: Payload, actor: User | null, id: number): Promise<TeamDTO> {
  const bridge = await vi.importActual<{ miniappTeamGET(payload: Payload, request: Request, path: string): Promise<TeamDTO> }>('../src/lib/miniapp-team');
  return bridge.miniappTeamGET(payload, new Request('https://synthetic.invalid/api/miniapp/team/recruitment/' + id, {
    headers: actor ? { Authorization: 'JWT synthetic-' + actor.id } : {},
  }), 'team/recruitment/' + id);
}
function seedApplication(server: ReturnType<typeof memoryPayload>, status = 'pending', answers: Answers = coreAnswers, form: SignupForm = coreForm) {
  const doc: Doc = { id: 811, title: '合成本人入队申请', team: teamID, game: 31, recruitment: recruitmentID, applicant: actorA.id,
    status, formVersion: formVersion(form), formSnapshot: form, answers, reviewNote: '合成给本人的处理反馈',
    requestKey: 'synthetic-private-key', reviewedBy: 999, reviewedAt: '2026-10-12T02:00:00Z',
    createdAt: '2026-10-12T01:00:00Z', updatedAt: '2026-10-12T02:00:00Z' };
  server.seed('team-join-applications', doc);
  return doc;
}
const branchForm = normalizeSignup({ ...coreForm, questions: [
  ...coreForm.questions,
  { id: 'mode', label: '扩展分支', type: 'single', required: true, options: ['结束', '跳转', '组队', '个人'], jumps: [
    { when: { mode: 'all', rules: [{ questionId: 'mode', operator: 'equals', value: '结束' }] }, target: '$end' },
    { when: { mode: 'all', rules: [{ questionId: 'mode', operator: 'equals', value: '跳转' },
      { questionId: 'gameID', operator: 'equals', value: '合成游戏ID' }] }, target: 'tail' },
  ] },
  { id: 'extensionName', label: '扩展组名称', type: 'text', required: true, showWhen: { questionId: 'mode', option: '组队' } },
  { id: 'group', label: '合成扩展成员组', type: 'group', required: true, minEntries: 5, maxEntries: 6,
    display: { mode: 'all', rules: [{ questionId: 'mode', operator: 'equals', value: '组队' }] },
    fields: [{ id: 'name', label: '成员名', type: 'text', required: true, options: [] }] },
  { id: 'tail', label: '扩展说明', type: 'textarea', required: true },
] });

const save = async (server: ReturnType<typeof memoryPayload>, action: 'draft' | 'submit', answers: Answers, revision?: string, version = formVersion(coreForm), actor: User | null = actorA) =>
  (await coreService()).saveTeamJoinApplication(server.payload, actor, recruitmentID, { action, version, revision, answers });
async function write(server: ReturnType<typeof memoryPayload>, data: Record<string, unknown>, actor: User | null = actorA, headers: Record<string, string> = {}) {
  locator.cms.mockResolvedValue(server.payload);
  return POST(new Request('http://localhost:3000/api/team-core', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(actor ? { Authorization: 'JWT synthetic-' + actor.id } : {}), ...headers }, body: JSON.stringify(data),
  }));
}
const submit = (answers: Answers = coreAnswers, extra: Record<string, unknown> = {}) => ({ operation: 'save-join', id: recruitmentID, action: 'submit', version: formVersion(coreForm), answers, ...extra });
const safeReceipt = (receipt: unknown) => {
  for (const key of ['requestKey', 'reviewedBy', 'reviewedAt', 'applicant', 'game', 'membershipKey']) expect(receipt).not.toHaveProperty(key);
};

describe('V2保留：代表队真实核心写服务与只读DTO', () => {
  it('五项核心与16类题型通过真实核心全量提交，单条pending回执', async () => {
    const server = memoryPayload(fullForm), service = await coreService();
    expect(service.normalizeTeamForm(fullForm)).toEqual(fullForm);
    expect(new Set(fullForm.questions.map(question => question.type)).size).toBe(16);
    const saved = await save(server, 'submit', fullAnswers, undefined, formVersion(fullForm));
    expect(saved).toMatchObject({ status: 'pending', answers: fullAnswers, formVersion: formVersion(fullForm), formSnapshot: fullForm });
    expect(server.rows('team-join-applications').size).toBe(1);
    const dto = await readTeam(server.payload, actorA, recruitmentID);
    expect(dto.application).toMatchObject({ id: saved.id, status: 'pending', answers: fullAnswers });
    safeReceipt(dto.application);
  });

  it('第六人成员不完整被服务端400拒绝，补齐后六人通过', async () => {
    const server = memoryPayload(fullForm);
    await expect(save(server, 'submit', { ...fullAnswers, group: [...members(5), {}] }, undefined, formVersion(fullForm)))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('第 6 条') });
    expect(server.rows('team-join-applications').size).toBe(0);
    const saved = await save(server, 'submit', { ...fullAnswers, group: members(6) }, undefined, formVersion(fullForm));
    expect((saved.answers as Answers).group).toHaveLength(6);
  });

  it.each(['结束', '跳转'])('核心之后%s分支服务端清除不可达答案并保留核心', async mode => {
    const server = memoryPayload(branchForm), service = await coreService();
    expect(service.normalizeTeamForm(branchForm)).toEqual(branchForm);
    const saved = await save(server, 'submit', { ...coreAnswers, mode, extensionName: '不应保存', group: members(5), tail: '合成尾题' }, undefined, formVersion(branchForm));
    expect(saved.answers).toMatchObject({ ...coreAnswers, mode });
    expect(saved.answers).not.toHaveProperty('group'); expect(saved.answers).not.toHaveProperty('extensionName');
    if (mode === '结束') expect(saved.answers).not.toHaveProperty('tail');
    else expect(saved.answers).toHaveProperty('tail', '合成尾题');
  });

  it('不完整草稿可保存，正式提交须全校验，同一编号带新修订转pending', async () => {
    const server = memoryPayload();
    const draft = await save(server, 'draft', { gameID: '合成仅一题草稿' });
    expect(draft).toMatchObject({ status: 'draft', answers: { gameID: '合成仅一题草稿' } });
    await expect(save(server, 'submit', { gameID: '合成仅一题草稿' }, draft.updatedAt)).rejects.toMatchObject({ status: 400 });
    expect(server.rows('team-join-applications').get(draft.id)).toEqual(draft);
    const saved = await save(server, 'submit', coreAnswers, draft.updatedAt);
    expect(saved).toMatchObject({ id: draft.id, status: 'pending', answers: coreAnswers });
    expect(saved.updatedAt).not.toBe(draft.updatedAt); expect(server.rows('team-join-applications').size).toBe(1);
  });

  it.each(['pending', 'returned', 'withdrawn'])('%s改稿/重提沿用原编号与修订，不新增申请', async status => {
    const server = memoryPayload(), original = seedApplication(server, status);
    const saved = await save(server, 'submit', { ...coreAnswers, availability: '合成修改训练时间' }, original.updatedAt);
    expect(saved).toMatchObject({ id: original.id, status: 'pending', answers: { ...coreAnswers, availability: '合成修改训练时间' } });
    expect(saved.updatedAt).not.toBe(original.updatedAt); expect(server.rows('team-join-applications').size).toBe(1);
  });

  it('pending可保存不完整改稿，更新同一编号和修订', async () => {
    const server = memoryPayload(), original = seedApplication(server);
    const saved = await save(server, 'draft', { gameID: '合成部分改稿' }, original.updatedAt);
    expect(saved).toMatchObject({ id: original.id, status: 'draft', answers: { gameID: '合成部分改稿' } });
    expect(saved.updatedAt).not.toBe(original.updatedAt); expect(server.rows('team-join-applications').size).toBe(1);
  });

  it.each(['draft', 'submit'] as const)('%s确认后相同网络重试返回同一回执，不产生新修订', async action => {
    const server = memoryPayload(), answers = action === 'draft' ? { gameID: '合成一题' } : coreAnswers;
    const first = await save(server, action, answers), repeated = await save(server, action, answers);
    expect(repeated).toEqual(first); expect(server.rows('team-join-applications').size).toBe(1);
    expect((await readTeam(server.payload, actorA, recruitmentID)).application).toMatchObject({ id: first.id, status: first.status, updatedAt: first.updatedAt, answers });
  });

  it('撤回真实核心记录并刷新当前动作，不会重新开放招新', async () => {
    const server = memoryPayload(), original = seedApplication(server), service = await coreService();
    const result = await service.withdrawTeamJoinApplication(server.payload, actorA, original.id, original.updatedAt);
    expect(result).toMatchObject({ id: original.id, status: 'withdrawn' });
    expect((await readTeam(server.payload, actorA, recruitmentID)).actions).toMatchObject({ withdraw: false, draft: true, submit: true, edit: true });
    expect(await service.withdrawTeamJoinApplication(server.payload, actorA, original.id, original.updatedAt)).toEqual(result);
  });

  it.each(['version', 'revision'])('过期%s返回409且服务器原答案不变', async conflict => {
    const server = memoryPayload(), original = seedApplication(server, 'returned');
    if (conflict === 'version') server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!,
      signupForm: normalizeSignup({ ...coreForm, questions: [...coreForm.questions, { id: 'newField', label: '合成新增题目', type: 'text', required: true }] }) });
    else server.seed('team-join-applications', { ...original, updatedAt: '2026-10-12T05:00:00Z' });
    const response = await write(server, submit({ ...coreAnswers, experience: '合成冲突后输入' }, { revision: original.updatedAt }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: expect.stringContaining(conflict === 'version' ? '申请表已更新' : '记录已变化') });
    expect(server.rows('team-join-applications').get(original.id)?.answers).toEqual(coreAnswers);
  });

  it.each(['deadline', 'closed', 'archived'])('%s窗口关闭全部写入能力，原申请仍可按ID撤回', async state => {
    const server = memoryPayload(), original = seedApplication(server);
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!,
      ...(state === 'deadline' ? { signupForm: { ...coreForm, end: '2000-01-01T00:00:00Z' } } : { status: state }) });
    const dto = await readTeam(server.payload, actorA, recruitmentID);
    expect(dto.actions).toMatchObject({ draft: false, submit: false, edit: false, withdraw: true });
    for (const action of ['draft', 'submit'] as const) await expect(save(server, action, coreAnswers, original.updatedAt)).rejects.toMatchObject({ status: 409 });
    const response = await write(server, { operation: 'withdraw-join', id: original.id, revision: original.updatedAt });
    expect(response.status).toBe(200); expect((await response.json()).result.status).toBe('withdrawn');
    expect(server.rows('team-recruitments').get(recruitmentID)?.status).toBe(state === 'deadline' ? 'open' : state);
  });

  it.each(['approved', 'rejected'])('最终%s关闭保存/改稿/撤回且实际核心拒绝', async status => {
    const server = memoryPayload(), original = seedApplication(server, status);
    expect((await readTeam(server.payload, actorA, recruitmentID)).actions).toMatchObject({ draft: false, submit: false, edit: false, withdraw: false });
    for (const action of ['draft', 'submit'] as const) await expect(save(server, action, coreAnswers, original.updatedAt)).rejects.toMatchObject({ status: 409 });
    await expect((await coreService()).withdrawTeamJoinApplication(server.payload, actorA, original.id, original.updatedAt)).rejects.toMatchObject({ status: 409 });
    expect(server.rows('team-join-applications').get(original.id)).toEqual(original);
  });

  it('本人回执保留原题快照和公开反馈，当前表单与私有原始字段隔离', async () => {
    const server = memoryPayload(), original = seedApplication(server, 'returned');
    const current = normalizeSignup({ ...coreForm, questions: coreForm.questions.map(q => q.id === 'gameID' ? { ...q, label: '合成当前新版标题' } : q) });
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, signupForm: current });
    const dto = await readTeam(server.payload, actorA, recruitmentID);
    expect(dto.application?.formSnapshot.questions[0].label).toBe('游戏 ID');
    expect(dto.form.questions[0].label).toBe('合成当前新版标题');
    expect(dto.application).toMatchObject({ id: original.id, answers: coreAnswers, reviewNote: '合成给本人的处理反馈' });
    safeReceipt(dto.application);
  });

  it.each([{ hidden: 'batch-draft', status: 403 }, { hidden: 'batch-draft', status: 404 },
    { hidden: 'team-archived', status: 403 }, { hidden: 'game-archived', status: 404 }])('ACL$status/$hidden只读本人16类快照，禁止特权重读隐藏配置', async ({ hidden, status }) => {
    const server = memoryPayload(fullForm); seedApplication(server, 'returned', fullAnswers, fullForm);
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, status: hidden === 'batch-draft' ? 'draft' : 'open',
      title: 'HIDDEN_CURRENT_CONFIGURATION', signupForm: { enabled: true, questions: [{ id: 'hiddenSecret', label: 'HIDDEN_CURRENT_CONFIGURATION', type: 'text' }] } });
    if (hidden === 'team-archived') server.seed('teams', { ...server.rows('teams').get(teamID)!, archived: true, teamStatus: 'archived' });
    if (hidden === 'game-archived') server.seed('games', { ...server.rows('games').get(31)!, archived: true });
    server.denyRead('team-recruitments', recruitmentID, status);
    const dto = await readTeam(server.payload, actorA, recruitmentID);
    expect(dto).toMatchObject({ readOnly: true, readonly: true, state: '历史申请只读', version: formVersion(fullForm),
      actions: { draft: false, submit: false, edit: false, withdraw: false, review: false, workbench: false } });
    expect(dto.form).toMatchObject({ enabled: false, closed: true }); expect(dto.form.questions).toEqual(fullForm.questions);
    expect(dto.historyNote).toEqual(expect.stringContaining('本人原提交'));
    expect(dto.application).toMatchObject({ answers: fullAnswers, reviewNote: '合成给本人的处理反馈' });
    expect(new Set(dto.form.questions.map(q => q.type)).size).toBe(16);
    expect(JSON.stringify(dto)).not.toContain('HIDDEN_CURRENT_CONFIGURATION'); safeReceipt(dto.application);
    expect(server.accessReads.filter(read => read.collection === 'team-recruitments')).toEqual([{ collection: 'team-recruitments', id: recruitmentID, overrideAccess: false }]);
  });

  it.each(['no-own', 'different-actor'])('隐藏批次%s缺少本人历史时404，不披露别人快照', async scope => {
    const server = memoryPayload(); if (scope === 'different-actor') seedApplication(server, 'returned');
    server.denyRead('team-recruitments', recruitmentID, 403);
    await expect(readTeam(server.payload, scope === 'different-actor' ? actorB : actorA, recruitmentID)).rejects.toMatchObject({ status: 404 });
  });

  it('账号或批次改变后重新读取不返回旧本人答案和反馈', async () => {
    const server = memoryPayload(); seedApplication(server, 'returned');
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, id: 72 });
    for (const dto of [await readTeam(server.payload, actorB, recruitmentID), await readTeam(server.payload, actorA, 72)]) {
      expect(dto.application).toBeNull(); expect(JSON.stringify(dto)).not.toContain('合成给本人的处理反馈');
      expect(JSON.stringify(dto)).not.toContain(coreAnswers.contact);
    }
  });

  it('刷新反映服务器新修订及新表单版本，不把读取转换为写入', async () => {
    const server = memoryPayload(), original = seedApplication(server, 'returned');
    const changed = normalizeSignup({ ...coreForm, questions: [...coreForm.questions, { id: 'extra', label: '合成新版必答项', type: 'text', required: true }] });
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, signupForm: changed });
    server.seed('team-join-applications', { ...original, status: 'pending', updatedAt: '2026-10-12T06:00:00Z', answers: { ...coreAnswers, experience: '合成服务器当前记录' } });
    const dto = await readTeam(server.payload, actorA, recruitmentID);
    expect(dto.version).toBe(formVersion(changed)); expect(dto.form).toEqual(changed);
    expect(dto.application).toMatchObject({ updatedAt: '2026-10-12T06:00:00Z', answers: { ...coreAnswers, experience: '合成服务器当前记录' } });
    await expect(save(server, 'submit', coreAnswers, dto.application!.updatedAt, dto.version)).rejects.toMatchObject({ status: 400 });
    expect(server.rows('team-join-applications').size).toBe(1);
  });
});

describe('V2保留：代表队HTTP鉴权/错误/缓存边界', () => {
  it('匿名或停用HTTP401，私有DTO停用403，当前身份校验生效', async () => {
    const server = memoryPayload();
    expect((await write(server, submit(), null)).status).toBe(401);
    server.seed('users', { ...actorA, accountStatus: 'suspended' });
    expect((await write(server, submit())).status).toBe(401);
    await expect(readTeam(server.payload, actorA, recruitmentID)).rejects.toMatchObject({ status: 403 });
    expect(server.rows('team-join-applications').size).toBe(0);
  });
  it('跨站403拒绝，正常POST返回仅回执字段及私有禁缓存头', async () => {
    const server = memoryPayload();
    expect((await write(server, submit(), actorA, { Origin: 'https://untrusted.example.invalid' })).status).toBe(403);
    const response = await write(server, submit());
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const result = await response.json(); expect(result.result).toMatchObject({ status: 'pending', answers: coreAnswers }); safeReceipt(result.result);
    locator.cms.mockResolvedValue(server.payload);
    const read = await GET(new Request('http://localhost:3000/api/team-core?mode=recruitment&id=' + recruitmentID, { headers: { Authorization: 'JWT synthetic-' + actorA.id } }));
    expect(read.status).toBe(200); expect(read.headers.get('Cache-Control')).toBe('private, no-store'); safeReceipt((await read.json()).application);
  });
  it('他人不能撤回原申请，过期修订409且原记录完整', async () => {
    const server = memoryPayload(), original = seedApplication(server);
    expect((await write(server, { operation: 'withdraw-join', id: original.id, revision: original.updatedAt }, actorB)).status).toBe(403);
    expect((await write(server, { operation: 'withdraw-join', id: original.id, revision: 'stale' })).status).toBe(409);
    expect(server.rows('team-join-applications').get(original.id)).toEqual(original);
  });
});
