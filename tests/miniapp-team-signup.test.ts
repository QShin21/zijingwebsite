import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { APIError, type Payload, type PayloadRequest } from 'payload';
import type { User } from '../src/payload-types';
import { formVersion } from '../src/lib/activity-signups';
import { normalizeSignup, type Answers, type SignupForm } from '../src/lib/signup-schema';

// No database, platform SDK or real account is used. Payload persistence and ACL
// responses are synthetic; the integrated core services validate each write.
vi.mock('../src/lib/workflow-transactions', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/workflow-transactions')>(),
  workflowTransaction: async <T>(payload: Payload, actor: User | null, context: Record<string, unknown>, work: (req: PayloadRequest) => Promise<T>) => {
    if (!actor) throw new APIError('合成未登录', 401);
    const user = await payload.findByID({ collection: 'users', id: actor.id, overrideAccess: true });
    if (user.accountStatus === 'suspended') throw new APIError('合成账号停用', 403);
    return work({ user: { ...user, collection: 'users' }, context, payload } as PayloadRequest);
  },
}));

type Actions = { draft: boolean; submit: boolean; edit: boolean; withdraw: boolean; review: boolean; workbench?: boolean };
type TeamReceipt = {
  id: number; status: string; teamID: number; recruitmentID: number; formVersion: string;
  formSnapshot: SignupForm; answers: Answers; reviewNote: string | null; createdAt: string; updatedAt: string;
};
type TeamDTO = Record<string, unknown> & {
  title: string; form: SignupForm; version: string; state: string; application: TeamReceipt | null; actions: Actions;
};
type RequestOptions = { method?: string; raw?: boolean; required?: boolean; questionnaire?: boolean; data?: Record<string, unknown> };
type Event = { currentTarget: { dataset: Record<string, unknown> }; detail: { value: string | string[] } };
type NativePage = {
  data: Record<string, unknown> & {
    loading: boolean; busy: boolean; error: string; message: string; needsLogin: boolean;
    info: TeamDTO | null; receipt: (TeamReceipt & { rows: unknown[] }) | null;
    confirmedReceipt: (TeamReceipt & { rows: unknown[] }) | null; confirmationMessage: string;
    form: SignupForm; answers: Answers; questions: { id: string; type: string; entries?: unknown[] }[];
    review: boolean; responseEditing: boolean; answerErrors: Record<string, string>; reviewRows: unknown[]; recoveryRows: unknown[]; entries: unknown[];
  };
  setData(value: Record<string, unknown>): void;
  onLoad(options: { kind: string; id: string }): void; onShow(): void | Promise<void>; onHide(): void; onUnload(): void;
  load(): Promise<void>; retry(): void | Promise<void>; submit(): Promise<void>; withdraw(): Promise<void>;
  saveDraft(): Promise<void>; editAnswers(): void; answer(event: Event): void; answerNext(): void; renderQuestions(): void;
  groupAnswer(event: Event): void; addEntry(event: Event): void; removeEntry(event: Event): void;
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
type DTOReader = (payload: Payload, actor: User | null, id: number) => Promise<TeamDTO>;
const actorA: User = { id: 901, name: '合成队员甲', email: 'synthetic-team-a@example.invalid',
  createdAt: '2026-10-12T01:00:00Z', updatedAt: '2026-10-12T01:00:00Z',
  roles: ['member'], accountStatus: 'active', collection: 'users', communityOffices: [] };
const actorB: User = { ...actorA, id: 902, name: '合成队员乙', email: 'synthetic-team-b@example.invalid' };
const recruitmentID = 71;
const teamID = 51;
const readPath = '/api/miniapp/team/recruitment/71';
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
const event = (id: string, value: string | string[] = '', extra: Record<string, unknown> = {}): Event => ({
  currentTarget: { dataset: { id, ...extra } }, detail: { value },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function pageHarness() {
  let page!: NativePage;
  let user: User | null = actorA;
  const listeners = new Set<(value: User | null) => void>();
  const request = vi.fn<(path: string, options?: RequestOptions) => Promise<Record<string, unknown>>>();
  request.mockRejectedValue(new Error('Unexpected synthetic API'));
  const session = { user: () => user, subscribe: (listener: (value: User | null) => void) => {
    listeners.add(listener); return () => { listeners.delete(listener); };
  } };
  const wx = { setNavigationBarTitle: vi.fn(), pageScrollTo: vi.fn(), showToast: vi.fn(),
    showModal: vi.fn<(options: { success(value: { confirm: boolean }): void; fail(): void }) => void>() };
  const navigation = { login: vi.fn(), back: vi.fn(), go: vi.fn(), content: vi.fn(), website: vi.fn(), copy: vi.fn() };
  const sharedRequire = createRequire(new URL('../miniprogram/src/lib/page.js', import.meta.url));
  const module = { exports: {} };
  runInNewContext(readFileSync('miniprogram/src/lib/page.js', 'utf8'), {
    module, wx, require: (name: string) => name === './session' ? session : name === './navigation' ? navigation : sharedRequire(name),
  });
  const teamModule = { exports: {} };
  const teamRequire = createRequire(new URL('../miniprogram/src/lib/team.js', import.meta.url));
  runInNewContext(readFileSync('miniprogram/src/lib/team.js', 'utf8'), {
    module: teamModule, wx, require: (name: string) => name === './http' ? { request } : teamRequire(name),
  });
  const dependencies: Record<string, unknown> = {
    '../../lib/http': { request }, '../../lib/session': session, '../../lib/page': module.exports, '../../lib/navigation': navigation,
    '../../lib/team': teamModule.exports,
  };
  const path = 'miniprogram/src/pages/signup/index.js';
  const localRequire = createRequire(new URL('../' + path, import.meta.url));
  runInNewContext(readFileSync(path, 'utf8'), {
    Page: (value: NativePage) => { page = value; }, wx, setTimeout, clearTimeout,
    require: (name: string) => dependencies[name] ?? localRequire(name),
  });
  page.setData = value => Object.assign(page.data, value);
  page.onLoad({ kind: 'team', id: String(recruitmentID) });
  return { page, request, wx, listeners, user: () => user,
    changeUser(value: User | null) { user = value; for (const listener of listeners) listener(value); } };
}
type Harness = ReturnType<typeof pageHarness>;
const writes = (request: Harness['request']) => request.mock.calls.filter(([, options]) => options?.method && options.method !== 'GET');
const reads = (request: Harness['request']) => request.mock.calls.filter(([, options]) => !options?.method || options.method === 'GET');
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
async function commitCoreWrite(harness: Harness, server: ReturnType<typeof memoryPayload>) {
  const service = await coreService(), data = JSON.parse(JSON.stringify(writes(harness.request).at(-1)![1]!.data)) as Record<string, unknown>;
  const result = data.operation === 'withdraw-join'
    ? await service.withdrawTeamJoinApplication(server.payload, actorA, Number(data.id), data.revision)
    : await service.saveTeamJoinApplication(server.payload, actorA, Number(data.id), {
      action: data.action as 'draft' | 'submit', version: data.version, revision: data.revision, answers: data.answers,
    });
  const receipt = service.teamJoinReceipt(result);
  if (!receipt) throw new Error('Synthetic core receipt missing');
  return { result: { ...receipt, requestKey: 'synthetic-private-confirmed-key', reviewedBy: 999 }, message: '合成服务确认成功' };
}
function connectCore(harness: Harness, server: ReturnType<typeof memoryPayload>, reader: DTOReader) {
  harness.request.mockImplementation(async (path, options = {}) => {
    if (!options.method || options.method === 'GET') {
      const id = /^\/api\/miniapp\/team\/recruitment\/([1-9]\d*)$/.exec(path)?.[1];
      if (!id) throw new Error('Unexpected native read endpoint: ' + path);
      return reader(server.payload, harness.user(), Number(id));
    }
    expect(path).toBe('/api/team-core');
    expect(options.method).toBe('POST');
    const service = await coreService(), data = JSON.parse(JSON.stringify(options.data)) as Record<string, unknown>;
    let result: Doc;
    if (data.operation === 'save-join') {
      if (data.action !== 'draft' && data.action !== 'submit') throw new APIError('合成操作无效', 400);
      result = await service.saveTeamJoinApplication(server.payload, harness.user(), Number(data.id), {
        action: data.action, version: data.version, revision: data.revision, answers: data.answers,
      });
    } else if (data.operation === 'withdraw-join') {
      result = await service.withdrawTeamJoinApplication(server.payload, harness.user(), Number(data.id), data.revision);
    } else throw new Error('Unexpected core operation');
    return { result: service.teamJoinReceipt(result), message: '合成操作已保存' };
  });
}

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
function expectReady(page: NativePage) {
  expect(page.data.loading).toBe(false);
  expect(page.data.error).toBe('');
  expect(page.data.info?.recruitmentID).toBe(recruitmentID);
  expect(page.data.info?.actions).toBeDefined();
}
async function serviceHarness(form: SignupForm = coreForm, status?: string) {
  const harness = pageHarness(), server = memoryPayload(form);
  const original = status ? seedApplication(server, status, form === fullForm ? fullAnswers : coreAnswers, form) : null;
  connectCore(harness, server, readTeam);
  await harness.page.onShow();
  expectReady(harness.page);
  return { ...harness, server, original };
}
function fill(page: NativePage, answers: Answers = coreAnswers) {
  page.setData({ answers }); page.renderQuestions(); page.answerNext();
  expect(page.data.review).toBe(true);
}
function expectPrivateCleared(page: NativePage) {
  expect(page.data.info).toBeNull(); expect(page.data.receipt).toBeNull();
  expect(page.data.confirmedReceipt).toBeNull();
  expect(page.data.answers).toEqual({}); expect(page.data.questions).toEqual([]);
  expect(page.data.reviewRows).toEqual([]); expect(page.data.entries).toEqual([]);
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

describe('原生代表队申请：实际只读 DTO 与既有核心写服务', () => {
  it('合法核心五题加扩展涵盖全部16类题型，实际Page渲染并由核心服务验证完整提交', async () => {
    const service = await coreService();
    expect(service.normalizeTeamForm(fullForm)).toEqual(fullForm);
    const { page, request, server } = await serviceHarness(fullForm);
    expect(new Set(page.data.questions.map(question => question.type)).size).toBe(16);
    fill(page, fullAnswers);
    await page.submit();
    expect(writes(request)).toHaveLength(1);
    expect(writes(request)[0][0]).toBe('/api/team-core');
    expect(writes(request)[0][1]?.data).toMatchObject({ operation: 'save-join', action: 'submit', version: formVersion(fullForm), answers: fullAnswers });
    expect(String(writes(request)[0][1]?.data?.id)).toBe(String(recruitmentID));
    expect(page.data.receipt?.status).toBe('pending');
    expect(page.data.receipt?.rows).toHaveLength(18);
    expect(server.rows('team-join-applications').size).toBe(1);
    expect(reads(request).map(([path]) => path)).toEqual([readPath, readPath]);
  });

  it('五至六人成员实际handler保留：不完整第六人不能正式提交，补齐后六人通过核心校验', async () => {
    const { page, request } = await serviceHarness(fullForm);
    page.setData({ answers: fullAnswers }); page.renderQuestions();
    page.addEntry(event('group')); page.answerNext();
    expect(page.data.review).toBe(false);
    expect(page.data.answerErrors.group).toContain('第 6 条');
    await page.submit();
    expect(writes(request)).toHaveLength(0);
    page.groupAnswer(event('group', '合成第六成员', { index: 5, field: 'name' }));
    page.addEntry(event('group'));
    expect(page.data.answers.group).toHaveLength(6);
    page.answerNext(); await page.submit();
    expect(page.data.receipt?.answers.group).toHaveLength(6);
  });

  it.each(['结束', '跳转'])('核心资料之后的复杂分支保留：%s 清理不可达扩展答案并提交真实服务', async mode => {
    expect((await coreService()).normalizeTeamForm(branchForm)).toEqual(branchForm);
    const { page } = await serviceHarness(branchForm);
    page.setData({ answers: { ...coreAnswers, mode: '组队', extensionName: '合成扩展组', group: members(5), tail: '合成尾题' } });
    page.renderQuestions(); page.answer(event('mode', mode));
    expect(page.data.answers).not.toHaveProperty('group');
    expect(page.data.answers).not.toHaveProperty('extensionName');
    if (mode === '结束') expect(page.data.answers).not.toHaveProperty('tail');
    expect(String(page.data.branchNotice)).toContain(mode === '结束' ? '提前结束' : '跳过');
    page.answerNext();
    if (mode === '跳转') {
      expect(page.data.review).toBe(false);
      expect(page.data.questions.map(question => question.id)).toEqual(['tail']);
      page.answer(event('tail', '合成跳转后的扩展说明'));
      page.answerNext();
    }
    expect(page.data.review).toBe(true); await page.submit();
    expect(page.data.receipt?.answers.mode).toBe(mode);
    expect(page.data.receipt?.answers.gameID).toBe(coreAnswers.gameID);
  });

  it('不完整草稿通过draft保存，正式提交全校验，同一申请编号转为pending并带revision', async () => {
    const { page, request, server } = await serviceHarness();
    page.answer(event('gameID', '合成仅一题草稿'));
    await page.saveDraft();
    expect(page.data.receipt?.status).toBe('draft');
    expect(page.data.receipt?.answers).toEqual({ gameID: '合成仅一题草稿' });
    const id = page.data.receipt!.id, revision = page.data.receipt!.updatedAt;
    expect(writes(request)[0][1]?.data).toMatchObject({ operation: 'save-join', action: 'draft', answers: { gameID: '合成仅一题草稿' } });
    expect(page.data.responseEditing).toBe(true);
    page.answerNext(); await page.submit();
    expect(writes(request)).toHaveLength(1);
    fill(page); await page.submit();
    expect(writes(request)[1][1]?.method).toBe('POST');
    expect(writes(request)[1][1]?.data).toMatchObject({ operation: 'save-join', action: 'submit', revision, version: formVersion(coreForm) });
    expect(page.data.receipt?.id).toBe(id);
    expect(page.data.receipt?.status).toBe('pending');
    expect(server.rows('team-join-applications').size).toBe(1);
  });

  it.each(['pending', 'returned', 'withdrawn'])('%s改稿或重提只POST既有核心服务，保留原申请编号及旧revision', async status => {
    const { page, request, original, server } = await serviceHarness(coreForm, status);
    page.editAnswers();
    expect(page.data.responseEditing).toBe(true);
    expect(page.data.answers).toEqual(coreAnswers);
    fill(page, { ...coreAnswers, availability: '合成修改训练时间' });
    await page.submit();
    expect(writes(request)).toHaveLength(1);
    expect(writes(request)[0][1]?.method).toBe('POST');
    expect(writes(request)[0][1]?.data).toMatchObject({ operation: 'save-join', action: 'submit', revision: original!.updatedAt });
    expect(String(writes(request)[0][1]?.data?.id)).toBe(String(recruitmentID));
    expect(page.data.receipt?.id).toBe(original!.id);
    expect(page.data.receipt?.status).toBe('pending');
    expect(server.rows('team-join-applications').size).toBe(1);
  });

  it('pending改稿可保存不完整draft，真实核心服务更新同一编号及修订', async () => {
    const { page, request, server, original } = await serviceHarness(coreForm, 'pending');
    page.editAnswers(); page.setData({ answers: { gameID: '合成部分改稿' } }); page.renderQuestions();
    await page.saveDraft();
    expect(page.data.receipt?.id).toBe(original!.id);
    expect(page.data.receipt?.status).toBe('draft');
    expect(page.data.receipt?.answers).toEqual({ gameID: '合成部分改稿' });
    expect(writes(request)[0][1]?.data).toMatchObject({ operation: 'save-join', action: 'draft', revision: original!.updatedAt });
    expect(server.rows('team-join-applications').size).toBe(1);
  });

  it('草稿保存与提交共用进行中的写锁，重复点击不能产生额外核心写入', async () => {
    const { page, request, server } = await serviceHarness();
    page.answer(event('gameID', '合成进行中草稿'));
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const saving = page.saveDraft();
    await page.saveDraft(); await page.submit();
    expect(page.data.busy).toBe(true);
    expect(writes(request)).toHaveLength(1);
    const service = await coreService(), data = writes(request)[0][1]!.data!;
    const committed = await service.saveTeamJoinApplication(server.payload, actorA, recruitmentID, {
      action: 'draft', version: data.version, answers: data.answers,
    });
    pending.resolve({ result: service.teamJoinReceipt(committed) });
    await saving;
    expect(page.data.busy).toBe(false);
    expect(page.data.receipt?.status).toBe('draft');
    expect(page.data.answers).toEqual({ gameID: '合成进行中草稿' });
    expect(writes(request)).toHaveLength(1);
    expect(reads(request).map(([path]) => path)).toEqual([readPath, readPath]);
  });

  it('撤回在确认框显示前锁定，确认一次才写入并刷新服务端能力', async () => {
    const { page, request, wx, original } = await serviceHarness(coreForm, 'pending');
    const withdrawing = page.withdraw();
    expect(page.data.busy).toBe(true);
    await page.withdraw(); await page.saveDraft();
    expect(wx.showModal).toHaveBeenCalledTimes(1);
    expect(writes(request)).toHaveLength(0);
    wx.showModal.mock.calls[0][0].success({ confirm: true });
    await withdrawing;
    expect(writes(request)[0][1]?.data).toEqual({ operation: 'withdraw-join', id: original!.id, revision: original!.updatedAt });
    expect(writes(request)).toHaveLength(1);
    expect(page.data.receipt?.status).toBe('withdrawn');
    expect(page.data.info?.actions).toMatchObject({ withdraw: false, draft: true, submit: true, edit: true });
    expect(page.data.busy).toBe(false);
    expect(reads(request).map(([path]) => path)).toEqual([readPath, readPath]);
  });

  it.each(['version', 'revision'])('真实核心服务拒绝过期%s，旧回执及当前未保存答案保持完整', async conflict => {
    const { page, server, request, original } = await serviceHarness(coreForm, 'returned');
    page.editAnswers(); fill(page, { ...coreAnswers, experience: '合成冲突后的本地输入' });
    if (conflict === 'version') server.seed('team-recruitments', {
      ...server.rows('team-recruitments').get(recruitmentID)!,
      signupForm: normalizeSignup({ ...coreForm, questions: [...coreForm.questions, { id: 'newField', label: '合成新增题目', type: 'text', required: true }] }),
    });
    else server.seed('team-join-applications', { ...original!, updatedAt: '2026-10-12T05:00:00Z' });
    await page.submit();
    expect(page.data.message).toContain(conflict === 'version' ? '申请表已更新' : '记录已变化');
    expect(page.data.receipt?.updatedAt).toBe(original!.updatedAt);
    expect(page.data.answers.experience).toBe('合成冲突后的本地输入');
    expect(page.data.review).toBe(true);
    expect(writes(request)).toHaveLength(1);
    expect(server.rows('team-join-applications').get(original!.id)?.answers).toEqual(coreAnswers);
  });

  it.each(['deadline', 'closed', 'archived'])('%s仅依据服务端actions关闭保存/提交，仍可按申请ID撤回', async state => {
    const { page, request, server, original, wx } = await serviceHarness(coreForm, 'pending');
    const batch = server.rows('team-recruitments').get(recruitmentID)!;
    server.seed('team-recruitments', { ...batch, ...(state === 'deadline' ? { signupForm: { ...coreForm, end: '2000-01-01T00:00:00Z' } } : { status: state }) });
    await page.retry();
    expect(page.data.info?.actions).toMatchObject({ draft: false, submit: false, edit: false, withdraw: true });
    page.editAnswers(); expect(page.data.responseEditing).toBe(false);
    fill(page); await page.saveDraft(); await page.submit();
    expect(writes(request)).toHaveLength(0);
    wx.showModal.mockImplementationOnce(options => options.success({ confirm: true }));
    await page.withdraw();
    expect(writes(request)).toHaveLength(1);
    expect(writes(request)[0][1]?.data).toEqual({ operation: 'withdraw-join', id: original!.id, revision: original!.updatedAt });
    expect(page.data.receipt?.status).toBe('withdrawn');
  });

  it.each(['approved', 'rejected'])('最终状态%s无保存/改稿/撤回能力，迟到按钮事件也不能写', async status => {
    const { page, request, wx } = await serviceHarness(coreForm, status);
    expect(page.data.info?.actions).toMatchObject({ draft: false, submit: false, edit: false, withdraw: false });
    page.editAnswers(); fill(page);
    await page.saveDraft(); await page.submit(); await page.withdraw();
    expect(writes(request)).toHaveLength(0);
    expect(wx.showModal).not.toHaveBeenCalled();
  });

  it('回执题目使用提交快照，原始私有唯一键/操作者不进入native回执', async () => {
    const { page, server } = await serviceHarness(coreForm, 'returned');
    const current = normalizeSignup({ ...coreForm, questions: coreForm.questions.map(q => q.id === 'gameID' ? { ...q, label: '合成当前新版标题' } : q) });
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, signupForm: current });
    await page.retry();
    expect(page.data.receipt?.rows).toContainEqual(expect.objectContaining({ id: 'gameID', label: '游戏 ID' }));
    expect(page.data.info?.form.questions[0].label).toBe('合成当前新版标题');
    expect(page.data.receipt).not.toHaveProperty('requestKey');
    expect(page.data.receipt).not.toHaveProperty('reviewedBy');
    expect(page.data.receipt).not.toHaveProperty('applicant');
    expect(page.data.receipt?.reviewNote).toBe('合成给本人的处理反馈');
  });

  it.each([
    { hidden: 'batch-draft', status: 403 }, { hidden: 'batch-draft', status: 404 },
    { hidden: 'team-archived', status: 403 }, { hidden: 'game-archived', status: 404 },
  ])('合成ACL$status/$hidden：实际核心与DTO只展示本人16类历史快照和反馈，全部动作关闭', async ({ hidden, status }) => {
    const h = pageHarness(), server = memoryPayload(fullForm);
    seedApplication(server, 'returned', fullAnswers, fullForm);
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, status: hidden === 'batch-draft' ? 'draft' : 'open',
      title: 'HIDDEN_CURRENT_CONFIGURATION', signupForm: { enabled: true, questions: [{ id: 'hiddenSecret', label: 'HIDDEN_CURRENT_CONFIGURATION', type: 'text' }] } });
    if (hidden === 'team-archived') server.seed('teams', { ...server.rows('teams').get(teamID)!, archived: true, teamStatus: 'archived' });
    if (hidden === 'game-archived') server.seed('games', { ...server.rows('games').get(31)!, archived: true });
    server.denyRead('team-recruitments', recruitmentID, status);
    connectCore(h, server, readTeam); await h.page.onShow();
    expectReady(h.page);
    expect(h.page.data.info).toMatchObject({ readOnly: true, readonly: true, state: '历史申请只读', version: formVersion(fullForm),
      actions: { draft: false, submit: false, edit: false, withdraw: false, review: false, workbench: false } });
    expect(h.page.data.info?.form).toMatchObject({ enabled: false, closed: true });
    expect(h.page.data.info?.form.questions).toEqual(fullForm.questions);
    expect(h.page.data.info?.historyNote).toContain('本人原提交');
    expect(h.page.data.receipt?.answers).toEqual(fullAnswers);
    expect(h.page.data.receipt?.rows).toHaveLength(18);
    expect(h.page.data.receipt?.reviewNote).toBe('合成给本人的处理反馈');
    expect(JSON.stringify(h.page.data)).not.toContain('HIDDEN_CURRENT_CONFIGURATION');
    expect(new Set(h.page.data.form.questions.map(question => question.type)).size).toBe(16);
    h.page.editAnswers(); expect(h.page.data.responseEditing).toBe(false);
    h.page.setData({ answers: fullAnswers, review: true });
    await h.page.saveDraft(); await h.page.submit(); await h.page.withdraw();
    expect(writes(h.request)).toHaveLength(0); expect(h.wx.showModal).not.toHaveBeenCalled();
    expect(server.accessReads.filter(read => read.collection === 'team-recruitments')).toEqual([{ collection: 'team-recruitments', id: recruitmentID, overrideAccess: false }]);
    expect(reads(h.request).map(([path]) => path)).toEqual([readPath]);
  });

  it.each(['no-own', 'different-actor'])('隐藏批次%s无本人历史时返回错误，不披露他人的快照或隐藏配置', async scope => {
    const h = pageHarness(), server = memoryPayload();
    if (scope === 'different-actor') { seedApplication(server, 'returned'); h.changeUser(actorB); }
    server.denyRead('team-recruitments', recruitmentID, 403); connectCore(h, server, readTeam);
    await h.page.onShow();
    expect(h.page.data.loading).toBe(false); expect(h.page.data.error).not.toBe('');
    expectPrivateCleared(h.page);
    expect(writes(h.request)).toHaveLength(0);
  });
});

describe('原生代表队申请：弱网、账号和生命周期', () => {
  it.each([401, 403, 409, 500, 'network'])('合成%s写失败且账号仍相同时保留输入，不自动重放写操作', async status => {
    const { page, request, original } = await serviceHarness(coreForm, 'returned');
    page.editAnswers(); fill(page, { ...coreAnswers, experience: '合成失败仍保留输入' });
    const error = Object.assign(new Error('合成操作失败 ' + status), typeof status === 'number' ? { status } : {});
    request.mockRejectedValueOnce(error);
    await page.submit();
    expect(page.data.answers.experience).toBe('合成失败仍保留输入');
    expect(page.data.receipt?.id).toBe(original!.id);
    expect(page.data.receipt?.updatedAt).toBe(original!.updatedAt);
    expect(page.data.review).toBe(true);
    expect(page.data.busy).toBe(false);
    expect(page.data.message).toContain('合成操作失败');
    expect(writes(request)).toHaveLength(1);
  });

  it('会话失效会清空私有输入，迟到401不恢复原账号答案', async () => {
    const { page, request, changeUser } = await serviceHarness();
    fill(page);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const sending = page.submit();
    changeUser(null);
    pending.reject(Object.assign(new Error('合成会话失效'), { status: 401 }));
    await sending;
    expectPrivateCleared(page);
    expect(page.data.needsLogin).toBe(true);
    expect(writes(request)).toHaveLength(1);
  });

  it.each([
    { scope: 'actor', outcome: 'success' }, { scope: 'actor', outcome: 'error' },
    { scope: 'route', outcome: 'success' }, { scope: 'route', outcome: 'error' },
    { scope: 'logout', outcome: 'success' }, { scope: 'logout', outcome: 'error' },
  ])('$scope切换后迟到POST$outcome不恢复旧账号或旧路由的私有状态', async ({ scope, outcome }) => {
    const { page, request, server, changeUser } = await serviceHarness();
    fill(page, { ...coreAnswers, experience: '合成旧页面未保存输入' });
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const sending = page.submit();
    let committed: Record<string, unknown> | null = null;
    if (outcome === 'success') {
      const service = await coreService(), data = writes(request)[0][1]!.data!;
      const saved = await service.saveTeamJoinApplication(server.payload, actorA, recruitmentID, {
        action: 'submit', version: data.version, answers: data.answers,
      });
      committed = { result: service.teamJoinReceipt(saved) };
    }
    if (scope === 'route') {
      server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, id: 72 });
      page.onLoad({ kind: 'team', id: '72' });
    } else changeUser(scope === 'actor' ? actorB : null);
    expectPrivateCleared(page);
    await page.onShow();
    expect(reads(request)).toHaveLength(1);
    if (committed) pending.resolve(committed);
    else pending.reject(new Error('合成旧页面迟到错误'));
    await sending;
    expect(page.data.loading).toBe(false);
    expect(page.data.busy).toBe(false);
    expect(page.data.receipt).toBeNull();
    expect(page.data.answers).toEqual({});
    expect(page.data.reviewRows).toEqual([]);
    expect(page.data.recoveryRows).toEqual([]);
    expect(page.data.message).not.toContain('合成旧页面迟到错误');
    expect(writes(request)).toHaveLength(1);
    if (scope === 'logout') {
      expectPrivateCleared(page);
      expect(page.data.needsLogin).toBe(true);
      expect(reads(request)).toHaveLength(1);
    } else {
      expect(page.data.info?.recruitmentID).toBe(scope === 'route' ? 72 : recruitmentID);
      expect(reads(request).map(([path]) => path)).toEqual([readPath, scope === 'route' ? '/api/miniapp/team/recruitment/72' : readPath]);
    }
  });

  it.each(['success', 'error'])('页面卸载后迟到POST %s不能改写已卸载页面或自动对账', async outcome => {
    const { page, request, listeners } = await serviceHarness();
    fill(page);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const sending = page.submit(); page.onUnload();
    const visible = structuredClone(page.data);
    expect(listeners.size).toBe(0);
    if (outcome === 'success') pending.resolve({ result: { id: 999, status: 'pending', answers: coreAnswers, formSnapshot: coreForm } });
    else pending.reject(new Error('合成卸载后迟到错误'));
    await sending; await page.onShow();
    expect(page.data).toEqual(visible);
    expect(reads(request)).toHaveLength(1);
    expect(writes(request)).toHaveLength(1);
  });

  it.each(['actor', 'route'])('%s改变后旧GET晚到不能恢复旧回执/答案', async scope => {
    const { page, request, server, changeUser, user } = await serviceHarness(coreForm, 'returned');
    page.editAnswers(); fill(page);
    const stale = await readTeam(server.payload, actorA, recruitmentID);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const reading = page.retry();
    if (scope === 'actor') changeUser(actorB);
    else {
      server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, id: 72 });
      page.onLoad({ kind: 'team', id: '72' });
    }
    expectPrivateCleared(page);
    await page.onShow();
    pending.resolve(stale);
    await reading;
    expect(page.data.loading).toBe(false);
    expect(page.data.receipt).toBeNull();
    expect(page.data.answers).toEqual({});
    expect(page.data.info?.recruitmentID).toBe(scope === 'actor' ? recruitmentID : 72);
    expect(user()?.id).toBe(scope === 'actor' ? actorB.id : actorA.id);
  });

  it.each([false, true])('首次/已有回执读取被hide打断后show恢复，旧GET无效（此前加载=%s）', async previouslyLoaded => {
    const server = memoryPayload(), harness = pageHarness();
    seedApplication(server); connectCore(harness, server, readTeam);
    if (previouslyLoaded) await harness.page.onShow();
    const old = await readTeam(server.payload, actorA, recruitmentID);
    const pending = deferred<Record<string, unknown>>();
    harness.request.mockImplementationOnce(() => pending.promise);
    const reading = previouslyLoaded ? harness.page.retry() : harness.page.onShow();
    harness.page.onHide();
    expect(harness.page.data.loading).toBe(false);
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, title: '合成恢复后的批次标题' });
    await harness.page.onShow();
    pending.resolve(old); await reading;
    expectReady(harness.page);
    expect(harness.page.data.info?.title).toBe('合成恢复后的批次标题');
    expect(harness.page.data.receipt?.id).toBe(811);
    expect(reads(harness.request).map(([path]) => path)).toEqual(Array(previouslyLoaded ? 3 : 2).fill(readPath));
  });

  it('对账GET失败不补写，显式retry只GET并在原记录未变且授权仍有效时恢复草稿', async () => {
    const { page, request } = await serviceHarness();
    const modified = { ...coreAnswers, experience: '合成待恢复草稿' };
    fill(page, modified);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise).mockRejectedValueOnce(new Error('合成对账读取失败'));
    const sending = page.submit(); page.onHide(); await page.onShow();
    pending.reject(new Error('合成写结果未知')); await sending;
    expect(page.data.loading).toBe(false); expect(page.data.info).toBeNull();
    expect(page.data.error).toBe('合成对账读取失败');
    await page.submit(); expect(writes(request)).toHaveLength(1);
    await page.retry();
    expectReady(page);
    expect(page.data.answers).toEqual(modified);
    expect(reads(request).map(([path]) => path)).toEqual(Array(3).fill(readPath));
    expect(writes(request)).toHaveLength(1);
  });

  it.each([
    { existing: false, outcome: 'success', showFirst: false },
    { existing: false, outcome: 'error', showFirst: false },
    { existing: false, outcome: 'success', showFirst: true },
    { existing: false, outcome: 'error', showFirst: true },
    { existing: true, outcome: 'success', showFirst: false },
    { existing: true, outcome: 'error', showFirst: false },
    { existing: true, outcome: 'success', showFirst: true },
    { existing: true, outcome: 'error', showFirst: true },
  ])('背景写$outcome，原回执=$existing，先show=$showFirst：无额外写入并以当前GET确认恢复', async ({ existing, outcome, showFirst }) => {
    const { page, request, server, original } = await serviceHarness(coreForm, existing ? 'returned' : undefined);
    if (existing) page.editAnswers();
    const modified = { ...coreAnswers, experience: '合成后台未保存修改' };
    fill(page, modified);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const sending = page.submit();
    page.onHide(); await page.submit();
    expect(page.data.busy).toBe(true);
    expect(writes(request)).toHaveLength(1);
    if (showFirst) await page.onShow();
    expect(reads(request)).toHaveLength(1);
    if (outcome === 'success') {
      const service = await coreService(), data = writes(request)[0][1]!.data!;
      const committed = await service.saveTeamJoinApplication(server.payload, actorA, recruitmentID, {
        action: 'submit', version: data.version, revision: data.revision, answers: modified,
      });
      pending.resolve({ result: service.teamJoinReceipt(committed), message: '合成后台写成功' });
    } else pending.reject(new Error('合成后台写失败'));
    await sending; await flush();
    if (!showFirst) {
      expect(reads(request)).toHaveLength(1);
      await page.submit(); expect(writes(request)).toHaveLength(1);
      await page.onShow();
    }
    expectReady(page);
    expect(page.data.busy).toBe(false);
    expect(writes(request)).toHaveLength(1);
    expect(reads(request).map(([path]) => path)).toEqual([readPath, readPath]);
    if (outcome === 'success') {
      expect(page.data.receipt?.status).toBe('pending');
      expect(page.data.receipt?.answers).toEqual(modified);
      expect(page.data.receipt?.updatedAt).not.toBe(original?.updatedAt);
      expect(page.data.answers).toEqual({});
      expect(page.data.review).toBe(false);
    } else {
      expect(page.data.answers).toEqual(modified);
      expect(page.data.receipt?.id ?? null).toBe(original?.id ?? null);
      expect(page.data.receipt?.updatedAt ?? null).toBe(original?.updatedAt ?? null);
    }
  });

  it('失败写后服务端已关闭窗口，对账不能恢复可提交草稿或自动写入', async () => {
    const { page, request, server } = await serviceHarness();
    fill(page);
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const sending = page.submit(); page.onHide(); await page.onShow();
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, status: 'closed' });
    pending.reject(new Error('合成写失败')); await sending;
    expectReady(page);
    expect(page.data.info?.actions).toMatchObject({ draft: false, submit: false, edit: false });
    expect(page.data.answers).toEqual({});
    await page.saveDraft(); await page.submit();
    expect(writes(request)).toHaveLength(1);
  });

  it('team空闲hide/show额外刷新动作，同scope同revision的未提交草稿仍保留', async () => {
    const { page, request } = await serviceHarness(coreForm, 'returned');
    page.editAnswers(); const modified = { ...coreAnswers, experience: '合成空闲草稿' }; fill(page, modified);
    page.onHide(); await page.onShow();
    expectReady(page);
    expect(page.data.answers).toEqual(modified);
    expect(page.data.receipt?.id).toBe(811);
    expect(page.data.responseEditing).toBe(true);
    expect(reads(request).map(([path]) => path)).toEqual([readPath, readPath]);
    expect(writes(request)).toHaveLength(0);
  });

  it('前台刷新发现申请修订已变时展示当前回执，不能把旧会话草稿覆盖回来', async () => {
    const { page, request, server, original } = await serviceHarness(coreForm, 'returned');
    page.editAnswers(); fill(page, { ...coreAnswers, experience: '合成本地旧草稿' });
    page.onHide();
    server.seed('team-join-applications', {
      ...original!, status: 'pending', updatedAt: '2026-10-12T06:00:00Z',
      answers: { ...coreAnswers, experience: '合成服务器当前记录' },
    });
    await page.onShow();
    expectReady(page);
    expect(page.data.receipt?.answers.experience).toBe('合成服务器当前记录');
    expect(page.data.answers).toEqual({});
    expect(page.data.recoveryRows).toEqual([]);
    expect(page.data.responseEditing).toBe(false);
    expect(writes(request)).toHaveLength(0);
  });

  it('前台刷新取得新表单版本，保留可见答案并退出旧核对状态重新校验', async () => {
    const { page, request, server } = await serviceHarness();
    fill(page);
    page.onHide();
    const changed = normalizeSignup({ ...coreForm, questions: [
      ...coreForm.questions, { id: 'extra', label: '合成新版必答项', type: 'text', required: true },
    ] });
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, signupForm: changed });
    await page.onShow();
    expectReady(page);
    expect(page.data.info?.version).toBe(formVersion(changed));
    expect(page.data.answers).toEqual(coreAnswers);
    expect(page.data.review).toBe(false);
    page.answerNext(); await page.submit();
    expect(page.data.answerErrors.extra).toBeDefined();
    expect(writes(request)).toHaveLength(0);
  });

  it.each([false, true])('前台刷新发现只读窗口，仅保存未提交内容的展示行，不允许写（已有回执=%s）', async existing => {
    const { page, request, server } = await serviceHarness(coreForm, existing ? 'returned' : undefined);
    if (existing) page.editAnswers();
    fill(page, { ...coreAnswers, experience: '合成已关闭窗口的本地输入' });
    page.onHide();
    server.seed('team-recruitments', { ...server.rows('team-recruitments').get(recruitmentID)!, status: 'closed' });
    await page.onShow();
    expectReady(page);
    expect(page.data.info?.actions).toMatchObject({ draft: false, submit: false, edit: false });
    expect(page.data.answers).toEqual({});
    expect(page.data.responseEditing).toBe(false);
    expect(page.data.review).toBe(false);
    expect(page.data.recoveryRows).toContainEqual({ id: 'experience', label: '比赛经历', answer: '合成已关闭窗口的本地输入' });
    await page.saveDraft(); await page.submit();
    expect(writes(request)).toHaveLength(0);
  });
});

describe('原生代表队申请：实际核心成功回执与只读弱网确认', () => {
  it.each([
    { operation: 'draft', showFirst: false }, { operation: 'draft', showFirst: true },
    { operation: 'submit', showFirst: false }, { operation: 'submit', showFirst: true },
    { operation: 'withdraw', showFirst: false }, { operation: 'withdraw', showFirst: true },
  ])('late $operation已确认且resume GET失败（先show=$showFirst），仅只读回执，无自动或重复写入', async ({ operation, showFirst }) => {
    const h = await serviceHarness(coreForm, operation === 'withdraw' ? 'pending' : undefined);
    if (operation === 'draft') h.page.answer(event('gameID', '合成已保存的一题草稿'));
    else if (operation === 'submit') fill(h.page, { ...coreAnswers, availability: '合成已确认提交安排' });
    else h.wx.showModal.mockImplementationOnce(value => value.success({ confirm: true }));
    const pending = deferred<Record<string, unknown>>();
    h.request.mockImplementationOnce(() => pending.promise).mockRejectedValueOnce(new Error('合成恢复读取网络失败'));
    const sending = operation === 'draft' ? h.page.saveDraft() : operation === 'submit' ? h.page.submit() : h.page.withdraw();
    await flush(); expect(writes(h.request)).toHaveLength(1);
    h.page.onHide(); if (showFirst) await h.page.onShow();
    const acknowledged = await commitCoreWrite(h, h.server); pending.resolve(acknowledged); await flush();
    let showing: void | Promise<void>;
    if (!showFirst) { await sending; expect(reads(h.request)).toHaveLength(1); showing = h.page.onShow(); }
    await sending; await showing!;
    expect(h.page.data).toMatchObject({ loading: false, busy: false, info: null, receipt: null, error: '合成恢复读取网络失败' });
    const status = operation === 'draft' ? 'draft' : operation === 'submit' ? 'pending' : 'withdrawn';
    expect(h.page.data.confirmedReceipt).toMatchObject({ id: acknowledged.result.id, status, updatedAt: acknowledged.result.updatedAt, answers: acknowledged.result.answers });
    expect(h.page.data.confirmedReceipt?.rows.length).toBe(operation === 'draft' ? 1 : 5);
    expect(h.page.data.confirmationMessage).toContain('当前状态读取失败');
    expect(h.page.data.confirmedReceipt).not.toHaveProperty('requestKey');
    expect(h.page.data.confirmedReceipt).not.toHaveProperty('reviewedBy');
    expect(h.page.data.confirmedReceipt).not.toHaveProperty('actions');
    const blocked = h.page.submit(); await h.page.saveDraft(); await h.page.withdraw(); await blocked;
    expect(writes(h.request)).toHaveLength(1);
    await h.page.retry(); expectReady(h.page);
    expect(h.page.data.receipt?.id).toBe(acknowledged.result.id); expect(h.page.data.receipt?.status).toBe(status);
    expect(h.page.data.confirmedReceipt).toBeNull();
    expect(reads(h.request).map(([path]) => path)).toEqual([readPath, readPath, readPath]);
    expect(writes(h.request)).toHaveLength(1);
  });

  it.each([500, 429])('已确认核心回执允许在%s读取失败时只读显示，成功GET才恢复当前能力', async status => {
    const h = await serviceHarness(); fill(h.page);
    const pending = deferred<Record<string, unknown>>();
    h.request.mockImplementationOnce(() => pending.promise).mockRejectedValueOnce(Object.assign(new Error('合成暂时读取失败'), { status }));
    const sending = h.page.submit(); h.page.onHide(); await h.page.onShow();
    const acknowledged = await commitCoreWrite(h, h.server); pending.resolve(acknowledged); await sending;
    expect(h.page.data.confirmedReceipt?.id).toBe(acknowledged.result.id); expect(h.page.data.info).toBeNull();
    await h.page.submit(); expect(writes(h.request)).toHaveLength(1);
    await h.page.retry(); expectReady(h.page); expect(h.page.data.confirmedReceipt).toBeNull();
  });

  it.each([401, 403, 404])('已确认回执遇到%s读拒绝即清掉确认缓存，后续网络失败也不能恢复', async status => {
    const h = await serviceHarness(); fill(h.page);
    const pending = deferred<Record<string, unknown>>();
    h.request.mockImplementationOnce(() => pending.promise)
      .mockRejectedValueOnce(Object.assign(new Error('合成读取被拒绝'), { status }))
      .mockRejectedValueOnce(new Error('合成后续网络失败'));
    const sending = h.page.submit(); h.page.onHide(); await h.page.onShow();
    pending.resolve(await commitCoreWrite(h, h.server)); await sending;
    expect(h.page.data.confirmedReceipt).toBeNull(); expect(h.page.data.confirmationMessage).toBe('');
    await h.page.retry(); expect(h.page.data.confirmedReceipt).toBeNull(); expect(h.page.data.info).toBeNull();
    await h.page.submit(); expect(writes(h.request)).toHaveLength(1);
  });

  it.each(['actor', 'route', 'logout'])('$scope切换立即清除已显示确认，旧缓存不补救新账号或新路由的失败GET', async scope => {
    const h = await serviceHarness(); fill(h.page);
    const pending = deferred<Record<string, unknown>>();
    h.request.mockImplementationOnce(() => pending.promise).mockRejectedValueOnce(new Error('合成初次读取失败'));
    const sending = h.page.submit(); h.page.onHide(); await h.page.onShow();
    pending.resolve(await commitCoreWrite(h, h.server)); await sending;
    expect(h.page.data.confirmedReceipt?.status).toBe('pending');
    if (scope === 'route') h.page.onLoad({ kind: 'team', id: '72' });
    else h.changeUser(scope === 'actor' ? actorB : null);
    expectPrivateCleared(h.page);
    h.request.mockRejectedValueOnce(new Error('合成新scope读取失败')); await h.page.onShow();
    expect(h.page.data.confirmedReceipt).toBeNull(); expect(h.page.data.confirmationMessage).toBe('');
    expect(writes(h.request)).toHaveLength(1);
  });
});
