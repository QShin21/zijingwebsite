import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const questionnaire = require('../miniprogram/src/lib/questionnaire.js');
const format = require('../miniprogram/src/lib/format.js');
const source = (path: string) => readFileSync('miniprogram/src/' + path, 'utf8');
type Actions = Record<string, boolean | string[]>;
type Row = { id: number; title: string; status: string; updatedAt: string; actions: Actions; [key: string]: unknown };
type ResultPage = { docs: Row[]; page: number; hasNextPage: boolean; totalPages: number; totalDocs: number };
type Data = { docs: Row[]; actions: Actions; teamActions: Actions; allowed: boolean; loading: boolean; busy: boolean; needsLogin: boolean;
  canSubmit: boolean; editId: number | string; revision: string; formGameID: number | string; title: string; reason: string;
  page: number; batchesPage: number; status: string; formError: string; error: string; operationError: string; pendingEdit: string;
  teamDoc: Row | null; ownApplications: ResultPage; memberships: ResultPage; managedTeams: ResultPage; [key: string]: unknown };
type Event = { currentTarget: { dataset: Record<string, unknown> }; detail: { value?: unknown } };
type NativePage = { data: Data; setData(values: Record<string, unknown>): void; onLoad(options?: Record<string, string>): void;
  onShow(): Promise<unknown>; onHide(): void; onUnload(): void; load(more?: boolean | string): Promise<unknown>;
  tab(event: Event): void; apply(): void; openRecruitment(event: Event): void; workbench(event: Event): void; members(event?: Event): void;
  submit(): Promise<void>; withdraw(event: Event): Promise<void>; operate(event: Event): Promise<void>; revoke(event: Event): Promise<void>;
  decide(event: Event): Promise<void>; newApplication(): void; openForm(event: Event): void; game(event: Event): void; note(event: Event): void;
  status(event: Event): Promise<void>; websiteWorkbench(event: Event): void; [key: string]: unknown };
type RequestOptions = { required?: boolean; raw?: boolean; questionnaire?: boolean; method?: string; data?: Record<string, unknown> };
type RequestCall = { path: string; options: RequestOptions };
type ModalOptions = { title: string; content: string; success(value: { confirm: boolean }): void; fail(): void };
type HarnessOptions = { request?: (path: string, options: RequestOptions) => unknown | Promise<unknown>;
  modalAuto?: boolean; route?: Record<string, string>; roles?: string[]; loggedOut?: boolean };
const event = (dataset: Record<string, unknown>, value?: unknown): Event => ({ currentTarget: { dataset }, detail: { value } });
const row = (extra: Record<string, unknown> = {}): Row => ({ id: 17, title: '合成测试申请', status: 'pending', updatedAt: 'synthetic-v1', actions: {}, ...extra });
const paged = (docs: Row[] = [], page = 1, hasNextPage = false): ResultPage => ({ docs, page, hasNextPage, totalPages: hasNextPage ? page + 1 : page, totalDocs: docs.length });
const proposal = { id: 9, title: '合成测试社群', actions: { establish: true } };
const establishment = (extra: Record<string, unknown> = {}) => row({ gameID: 9, reason: '合成测试：共同组织比赛和训练', actions: { edit: false, withdraw: true, reviewDecisions: [] }, ...extra });
const recruitment = (extra: Record<string, unknown> = {}) => row({ id: 21, title: '合成测试招新', teamID: 9, gameID: 9, status: 'open', state: '招新开放', actions: { view: true, apply: true, workbench: false }, ...extra });
const membership = (extra: Record<string, unknown> = {}) => row({ id: 23, title: '合成测试成员', teamID: 9, gameID: 9, status: 'active', joinedAt: 'synthetic-joined', leftAt: null, revokedAt: null, actions: { leave: true, revoke: true }, ...extra });
const teamRow = row({ id: 9, title: '合成测试队伍', gameID: 9, teamStatus: 'active', actions: { workbench: true } });
const snapshot = { enabled: true, questions: [{ id: 'gameID', label: '合成游戏ID', type: 'text', options: [], required: true }] };
const join = (extra: Record<string, unknown> = {}) => row({ teamID: 9, recruitmentID: 21, formSnapshot: snapshot, formVersion: 'synthetic-form-v1', answers: { gameID: '合成测试ID' }, reviewNote: null,
  actions: { view: true, edit: false, withdraw: true, reviewDecisions: ['approved', 'returned', 'rejected'] }, ...extra });
const hub = (extra: Record<string, unknown> = {}) => ({ recruitments: paged([recruitment()]), ownApplications: paged([join()]), memberships: paged([membership()]),
  managedTeams: paged([teamRow]), proposalGames: [proposal], actions: { establish: true, reviewEstablishments: true }, ...extra });
const ownEstablishments = (extra: Record<string, unknown> = {}) => ({ ...paged([establishment()]), proposalGames: [proposal], actions: { establish: true, reviewEstablishments: true }, ...extra });
const reviewEstablishments = (extra: Record<string, unknown> = {}) => ownEstablishments({ docs: [establishment({ actions: { reviewDecisions: ['approved', 'returned', 'rejected'] } })], ...extra });
const workspace = (extra: Record<string, unknown> = {}) => ({ team: teamRow, actions: { createRecruitment: true, lifecycleStatuses: ['resting', 'archived'] },
  recruitments: paged([recruitment({ actions: { view: true, edit: true, close: true, archive: true } })]), applications: paged([join()]), members: paged([membership()]), ...extra });
function response(path: string, options: RequestOptions = {}) {
  if (options.method === 'POST') return { result: { id: options.data?.id || 99 }, message: '合成保存成功' };
  if (path.includes('establishments?mode=review')) return reviewEstablishments();
  if (path.includes('establishments?mode=own')) return ownEstablishments();
  if (path.includes('/workbench?')) return workspace();
  if (path.startsWith('/api/miniapp/team?')) return hub();
  throw new Error('Unexpected synthetic API: ' + path);
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function harness(name: string, options: HarnessOptions = {}) {
  let actor: { id: number; roles: string[] } | null = options.loggedOut ? null : { id: 1, roles: options.roles || ['member'] };
  let listeners: ((user: typeof actor) => void)[] = [];
  const calls: RequestCall[] = [], modals: ModalOptions[] = [];
  const http = { request: vi.fn(async (path: string, requestOptions: RequestOptions = {}) => {
    calls.push({ path, options: requestOptions }); return options.request ? options.request(path, requestOptions) : response(path, requestOptions);
  }) };
  const session = { user: () => actor, subscribe: (callback: (user: typeof actor) => void) => {
    listeners.push(callback); return () => { listeners = listeners.filter(value => value !== callback); };
  }, manages: () => { throw new Error('Do not guess current team scope from cached roles'); }, reviewer: () => { throw new Error('Do not guess current review authority from cached roles'); } };
  const navigation = { go: vi.fn(), back: vi.fn(), login: vi.fn(), copy: vi.fn(), content: vi.fn(), website: vi.fn() };
  const wx = { stopPullDownRefresh: vi.fn(), previewImage: vi.fn(), showModal: vi.fn((value: ModalOptions) => {
    modals.push(value); if (options.modalAuto !== false) value.success({ confirm: true });
  }) };
  const teamModule = { exports: {} };
  runInNewContext(source('lib/team.js'), { module: teamModule, require: (path: string) => ({ './http': http, './questionnaire': questionnaire, './format': format })[path] });
  const pageModule = { exports: {} };
  runInNewContext(source('lib/page.js'), { module: pageModule, wx, require: (path: string) => path === './navigation' ? navigation : session });
  const modules: Record<string, unknown> = { http, session, navigation, config: { origin: 'https://home.thuzijing.top' }, team: teamModule.exports, format, page: pageModule.exports };
  let native!: NativePage;
  runInNewContext(source('pages/' + name + '/index.js'), { wx, Page: (value: NativePage) => { native = value; }, require: (path: string) => {
    const value = modules[path.split('/').pop() || '']; if (!value) throw new Error('Unexpected module ' + path); return value;
  } });
  native.setData = (values: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(values)) {
      const match = /^docs\[(\d+)\]\.(\w+)$/.exec(key);
      if (match) native.data.docs[Number(match[1])][match[2]] = value;
      else native.data[key] = value;
    }
  };
  native.onLoad(options.route || (['team-review', 'team-members'].includes(name) ? { team: '9' } : {}));
  return { page: native, calls, http, navigation, wx, modals, changeUser(id: number | null) { actor = id ? { id, roles: ['member'] } : null; listeners.slice().forEach(callback => callback(actor)); } };
}
const writes = (h: ReturnType<typeof harness>) => h.calls.filter(call => call.options.method === 'POST');

describe('Native team hub and membership actions — synthetic VM', () => {
  it('uses server actions rather than stored roles for all navigation and keeps the recruitment ID separate from the application ID', async () => {
    const h = harness('team', { roles: ['member'] }); await h.page.onShow(); h.page.apply(); h.page.workbench(event({ id: 9 })); h.page.members(event({ id: 9 }));
    h.page.openRecruitment(event({ id: 17, own: true }));
    expect(h.navigation.go).toHaveBeenCalledWith('team-apply'); expect(h.navigation.go).toHaveBeenCalledWith('team-review', { team: 9 });
    expect(h.navigation.go).toHaveBeenCalledWith('team-members', { team: 9 }); expect(h.navigation.go).toHaveBeenCalledWith('signup', { kind: 'team', id: 21 });
    const denied = harness('team', { roles: ['president'], request: () => hub({ actions: { establish: false }, managedTeams: paged([row({ id: 9, actions: {} })]) }) });
    await denied.page.onShow(); denied.page.apply(); denied.page.workbench(event({ id: 9 })); expect(denied.navigation.go).not.toHaveBeenCalled();
  });

  it('keeps historical own records without reading hidden batch configuration', async () => {
    const h = harness('team', { request: () => hub({ recruitments: paged([]), ownApplications: paged([join({ actions: { view: true, edit: false, withdraw: true } })]) }) });
    await h.page.onShow(); h.page.tab(event({ view: 'ownApplications' })); expect(h.page.data.docs[0].id).toBe(17);
    h.page.openRecruitment(event({ id: 17, own: true })); expect(h.navigation.go).toHaveBeenCalledWith('signup', { kind: 'team', id: 21 });
    expect(h.calls).toHaveLength(1); expect(h.calls[0].path).toMatch(/^\/api\/miniapp\/team\?/);
  });

  it.each(['leave', 'withdraw-join'])('performs only the permitted %s action and locks before the modal', async operation => {
    const h = harness('team', { modalAuto: false }); await h.page.onShow(); const id = operation === 'leave' ? 23 : 17;
    const first = h.page.operate(event({ operation, id })); await h.page.operate(event({ operation, id }));
    expect(h.wx.showModal).toHaveBeenCalledTimes(1); expect(writes(h)).toHaveLength(0); h.modals[0].success({ confirm: true }); await first;
    expect(writes(h)).toHaveLength(1); expect(writes(h)[0]).toMatchObject({ path: '/api/team-core', options: { raw: true, required: true, questionnaire: true,
      data: { operation, id, revision: 'synthetic-v1' } } });
    if (operation === 'leave') expect(writes(h)[0].options.data?.note).toBe('');
  });

  it('does not infer leave permission from an active status and still accepts leave for an archived team when the server permits it', async () => {
    const denied = harness('team', { request: () => hub({ memberships: paged([membership({ actions: { leave: false } })]) }) });
    await denied.page.onShow(); await denied.page.operate(event({ operation: 'leave', id: 23 })); expect(writes(denied)).toHaveLength(0); expect(denied.modals).toHaveLength(0);
    const archived = harness('team', { request: (path, options) => options.method === 'POST' ? response(path, options) : hub({ managedTeams: paged([row({ ...teamRow, teamStatus: 'archived' })]) }) });
    await archived.page.onShow(); await archived.page.operate(event({ operation: 'leave', id: 23 })); expect(writes(archived)[0].options.data?.operation).toBe('leave');
  });

  it('paginates each hub section independently and retries the same page after failure', async () => {
    let second = deferred<unknown>();
    const h = harness('team', { request: path => path.includes('ownPage=2') ? second.promise : hub({ ownApplications: paged([join()], 1, true) }) });
    await h.page.onShow(); h.page.tab(event({ view: 'ownApplications' })); const first = h.page.load(true); await h.page.load(true);
    expect(h.calls.filter(call => call.path.includes('ownPage=2'))).toHaveLength(1); expect(h.page.data.ownApplications.page).toBe(1);
    second.reject(new Error('合成断网')); await first; expect(h.page.data.page).toBe(1);
    second = deferred<unknown>(); const retry = h.page.load(true); second.resolve(hub({ ownApplications: paged([join({ id: 18 })], 2) })); await retry;
    expect(h.page.data.docs.map(doc => doc.id)).toEqual([17, 18]); expect(h.page.data.page).toBe(2);
    expect(h.calls.at(-1)?.path).toContain('page=1&ownPage=2&membersPage=1&teamsPage=1');
    h.page.tab(event({ view: 'memberships' })); expect(h.page.data.page).toBe(1); expect(h.page.data.docs[0].id).toBe(23);
  });
});

describe('Native team establishment — synthetic VM', () => {
  it('submits only actual establishment fields and retains a failed form', async () => {
    let fail = true;
    const h = harness('team-apply', { request: (path, options) => { if (options.method === 'POST' && fail) throw new Error('合成断网'); return response(path, options); } });
    await h.page.onShow(); h.page.newApplication(); h.page.setData({ title: '合成测试代表队', reason: '合成测试：组织每周训练与校内比赛' });
    await h.page.submit(); expect(h.page.data.title).toBe('合成测试代表队'); expect(h.page.data.reason).toContain('每周训练'); expect(h.page.data.formError).toBe('合成断网');
    fail = false; await h.page.submit(); expect(writes(h).at(-1)?.options.data).toEqual({ operation: 'establish', gameID: 9, title: '合成测试代表队', reason: '合成测试：组织每周训练与校内比赛' });
  });

  it.each(['returned', 'withdrawn'])('resubmits a %s application using its original community, id and revision', async status => {
    const h = harness('team-apply', { request: (path, options) => options.method === 'POST' ? response(path, options)
      : ownEstablishments({ docs: [establishment({ status, actions: { edit: true, withdraw: true } })], proposalGames: [proposal, { ...proposal, id: 10 }] }) });
    await h.page.onShow(); h.page.openForm(event({ id: 17 })); h.page.game(event({}, 1));
    h.page.setData({ reason: '合成测试：补充组织与训练计划' }); await h.page.submit();
    expect(writes(h)[0].options.data).toMatchObject({ operation: 'establish', id: 17, revision: 'synthetic-v1', gameID: 9, reason: '合成测试：补充组织与训练计划' });
    expect(writes(h)[0].options.data).not.toHaveProperty('status'); expect(writes(h)[0].options.data).not.toHaveProperty('applicant');
  });

  it('supports an editable deep link but never turns an unknown or unauthorized edit ID into a new submission', async () => {
    const own = harness('team-apply', { route: { edit: '17' }, request: () => ownEstablishments({ docs: [establishment({ status: 'returned', actions: { edit: true } })] }) });
    await own.page.onShow(); expect(own.page.data.editId).toBe(17); expect(own.page.data.pendingEdit).toBe(''); expect(own.page.data.canSubmit).toBe(true);
    const missing = harness('team-apply', { route: { edit: '991' } }); await missing.page.onShow(); await missing.page.submit();
    expect(missing.page.data.canSubmit).toBe(false); expect(missing.page.data.pendingEdit).toBe('991'); expect(writes(missing)).toHaveLength(0);
    const blocked = harness('team-apply', { route: { edit: '17' } }); await blocked.page.onShow(); await blocked.page.submit();
    expect(blocked.page.data.canSubmit).toBe(false); expect(blocked.page.data.formError).toContain('暂无可编辑'); expect(writes(blocked)).toHaveLength(0);
  });

  it('finds a deep-link edit in later authorized own pages', async () => {
    const h = harness('team-apply', { route: { edit: '18' }, request: path => path.endsWith('page=2')
      ? ownEstablishments({ ...paged([establishment({ id: 18, status: 'withdrawn', actions: { edit: true } })], 2) })
      : ownEstablishments({ ...paged([establishment()], 1, true) }) });
    await h.page.onShow(); expect(h.page.data.canSubmit).toBe(false); await h.page.load(true);
    expect(h.page.data.editId).toBe(18); expect(h.page.data.revision).toBe('synthetic-v1'); expect(h.page.data.canSubmit).toBe(true);
  });

  it('keeps unsaved establishment edits after a 409 and after hide/show refresh', async () => {
    const h = harness('team-apply', { request: (_path, options) => {
      if (options.method === 'POST') throw Object.assign(new Error('记录已变化，请刷新后核对'), { status: 409 });
      return ownEstablishments({ docs: [establishment({ status: 'returned', actions: { edit: true } })] });
    } });
    await h.page.onShow(); h.page.openForm(event({ id: 17 })); h.page.setData({ reason: '合成测试：正在编辑尚未提交的计划' }); await h.page.submit();
    expect(h.page.data.reason).toContain('尚未提交'); expect(h.page.data.formError).toContain('刷新'); h.page.onHide(); await h.page.onShow();
    expect(h.page.data.reason).toContain('尚未提交'); expect(h.page.data.editId).toBe(17); expect(h.page.data.revision).toBe('synthetic-v1');
  });

  it('uses server withdraw permission and the establishment ID', async () => {
    const h = harness('team-apply', { modalAuto: false }); await h.page.onShow(); const first = h.page.withdraw(event({ id: 17 })); await h.page.withdraw(event({ id: 17 }));
    expect(h.modals).toHaveLength(1); h.modals[0].success({ confirm: true }); await first;
    expect(writes(h)[0].options.data).toEqual({ operation: 'withdraw-establishment', id: 17, revision: 'synthetic-v1' });
  });
});

describe('Native authorized team workspaces — synthetic VM', () => {
  it.each(['join', 'establishment'])('renders only server-provided %s review decisions and posts the actual operation', async mode => {
    const h = harness('team-review', { modalAuto: false, route: mode === 'join' ? { team: '9' } : {}, request: (path, options) => options.method === 'POST' ? response(path, options)
      : mode === 'join' ? workspace({ applications: paged([join({ actions: { reviewDecisions: ['returned'] } })]) })
        : reviewEstablishments({ docs: [establishment({ actions: { reviewDecisions: ['returned'] } })] }) });
    await h.page.onShow(); await h.page.decide(event({ id: 17, decision: 'approved' })); expect(h.modals).toHaveLength(0);
    h.page.note(event({ id: 17 }, '合成测试：请补充训练安排')); const first = h.page.decide(event({ id: 17, decision: 'returned' })); await h.page.decide(event({ id: 17, decision: 'returned' }));
    expect(h.modals).toHaveLength(1); h.modals[0].success({ confirm: true }); await first;
    expect(writes(h)).toHaveLength(1); expect(writes(h)[0].options.data).toEqual({ operation: mode === 'join' ? 'decide-join' : 'decide-establishment', id: 17, revision: 'synthetic-v1', decision: 'returned', note: '合成测试：请补充训练安排' });
  });

  it('uses the submitted form snapshot for every questionnaire type and preserves a 5-person group in review', async () => {
    const extensions = [
      { type: 'text' }, { type: 'textarea' }, { type: 'single', options: ['A', 'B'] }, { type: 'multiple', options: ['A', 'B'] }, { type: 'select', options: ['A', 'B'] },
      { type: 'number' }, { type: 'date' }, { type: 'time' }, { type: 'rating' }, { type: 'nps' }, { type: 'ranking', options: ['A', 'B'] },
      { type: 'matrix', rows: ['合成行'], options: ['A', 'B'] }, { type: 'matrixMultiple', rows: ['合成行'], options: ['A', 'B'] }, { type: 'blanks', rows: ['合成子题'] },
      { type: 'group', minEntries: 5, maxEntries: 6, fields: [{ id: 'name', label: '合成姓名', type: 'text', required: true, options: [] }] }, { type: 'description' },
    ].map(question => ({ id: 'q_' + question.type, label: '合成题型 ' + question.type, required: true, options: [], ...question }));
    const core = ['gameID', 'position', 'experience', 'availability', 'contact'].map(id => ({ id, label: '合成核心 ' + id, type: 'text', required: true, options: [] }));
    const form = questionnaire.normalizeSignup({ enabled: true, questions: [...core, ...extensions] });
    const answers = { gameID: '合成ID', position: '合成位置', experience: '合成经历', availability: '合成时间', contact: 'synthetic@example.invalid',
      q_text: '合成文本', q_textarea: '合成长文本', q_single: 'A', q_multiple: ['A', 'B'], q_select: 'A', q_number: '1', q_date: '2026-10-12', q_time: '12:00',
      q_rating: '5', q_nps: '8', q_ranking: ['B', 'A'], q_matrix: { 合成行: 'B' }, q_matrixMultiple: { 合成行: ['A', 'B'] }, q_blanks: { 合成子题: '合成内容' },
      q_group: Array.from({ length: 5 }, (_, i) => ({ name: '合成成员' + (i + 1) })) };
    expect(questionnaire.validateAnswers(form, answers)).toEqual(answers);
    const h = harness('team-review', { request: () => workspace({ applications: paged([join({ formSnapshot: form, answers })]) }) });
    await h.page.onShow(); const rows = h.page.data.docs[0].rows as { id: string; answer: string }[];
    expect(rows).toHaveLength(20); expect(rows.find(answer => answer.id === 'q_matrixMultiple')?.answer).toContain('A');
    expect(rows.find(answer => answer.id === 'q_group')?.answer).toContain('合成成员5'); expect(h.page.data.docs[0].receiptError).toBeUndefined();
  });

  it('rejects guessed management authority and clears cached private rows on 403, then recovers on retry', async () => {
    let denied = true;
    const h = harness('team-review', { roles: ['president'], request: () => { if (denied) throw Object.assign(new Error('无权管理此代表队'), { status: 403 }); return workspace(); } });
    h.page.setData({ docs: [join()] }); await h.page.onShow(); expect(h.page.data.docs).toHaveLength(0); expect(h.page.data.allowed).toBe(false);
    denied = false; await h.page.load(); expect(h.page.data.allowed).toBe(true); expect(h.page.data.docs).toHaveLength(1);
  });

  it('retains review notes after a stale revision and excludes draft from status navigation', async () => {
    const h = harness('team-review', { request: (path, options) => { if (options.method === 'POST') throw Object.assign(new Error('记录已变化，请刷新'), { status: 409 }); return response(path, options); } });
    await h.page.onShow(); h.page.note(event({ id: 17 }, '合成测试：等待核对')); await h.page.decide(event({ id: 17, decision: 'returned' }));
    expect(h.page.data.docs[0].noteDraft).toBe('合成测试：等待核对'); expect(h.page.data.operationError).toContain('刷新');
    await h.page.status(event({}, 5)); expect(h.page.data.status).toBe('pending'); await h.page.status(event({}, 1)); expect(h.calls.at(-1)?.path).toContain('status=returned');
    expect(h.calls.some(call => call.path.includes('status=draft'))).toBe(false);
  });

  it('copies the actual advanced website editor address only on the permitted user action', async () => {
    const h = harness('team-review'); await h.page.onShow(); expect(h.navigation.copy).not.toHaveBeenCalled();
    h.page.websiteWorkbench(event({ id: 21 })); h.page.websiteWorkbench(event({ create: true })); h.page.websiteWorkbench(event({ id: 999 }));
    expect(h.navigation.copy).toHaveBeenCalledTimes(2); expect(h.navigation.copy).toHaveBeenCalledWith('https://home.thuzijing.top/teams/manage/9?edit=21', expect.any(String));
    expect(h.navigation.copy).toHaveBeenCalledWith('https://home.thuzijing.top/teams/manage/9?create=1', expect.any(String)); expect(writes(h)).toHaveLength(0);
  });

  it.each([{ operation: 'lifecycle', status: 'resting', id: 9 }, { operation: 'close-recruitment', status: 'closed', id: 21 }, { operation: 'close-recruitment', status: 'archived', id: 21 }])('uses the existing $operation write with current revision for $status', async action => {
    const h = harness('team-review'); await h.page.onShow(); await h.page.operate(event(action));
    expect(writes(h)[0].options.data).toEqual({ operation: action.operation, status: action.status, id: action.id, revision: 'synthetic-v1' });
  });

  it('paginates workbench batches without advancing the application queue', async () => {
    const second = deferred<unknown>(); const h = harness('team-review', { request: path => path.includes('batchesPage=2') ? second.promise : workspace({ recruitments: paged([recruitment()], 1, true) }) });
    await h.page.onShow(); const first = h.page.load('batches'); await h.page.load('batches'); expect(h.calls.filter(call => call.path.includes('batchesPage=2'))).toHaveLength(1);
    second.resolve(workspace({ recruitments: paged([recruitment({ id: 22 })], 2) })); await first;
    expect(h.page.data.batchesPage).toBe(2); expect(h.page.data.page).toBe(1); expect(h.page.data.docs[0].id).toBe(17);
  });

  it('requires a revoke reason, obeys the server flag, and keeps the reason after failed writes', async () => {
    const h = harness('team-members', { modalAuto: false, request: (path, options) => { if (options.method === 'POST') throw new Error('合成断网'); return response(path, options); } });
    await h.page.onShow(); await h.page.revoke(event({ id: 23 })); expect(h.modals).toHaveLength(0); expect(h.page.data.operationError).toContain('原因');
    h.page.note(event({ id: 23 }, '合成测试：成员主动结束训练')); const first = h.page.revoke(event({ id: 23 })); await h.page.revoke(event({ id: 23 }));
    expect(h.modals).toHaveLength(1); h.modals[0].success({ confirm: true }); await first;
    expect(writes(h)[0].options.data).toEqual({ operation: 'revoke', id: 23, revision: 'synthetic-v1', note: '合成测试：成员主动结束训练' });
    expect(h.page.data.docs[0].noteDraft).toContain('主动结束训练');
    const denied = harness('team-members', { request: () => workspace({ members: paged([membership({ actions: { revoke: false } })]) }) });
    await denied.page.onShow(); denied.page.note(event({ id: 23 }, '合成说明')); await denied.page.revoke(event({ id: 23 })); expect(writes(denied)).toHaveLength(0);
  });

  it('shows membership end dates only when the loaded relationship includes a real end timestamp', async () => {
    const records = [membership({ joinedAt: '2026-09-10T08:00:00.000Z' }),
      membership({ id: 24, status: 'revoked', leftAt: '2026-10-01T08:00:00.000Z', actions: {} }),
      membership({ id: 25, status: 'revoked', revokedAt: '2026-10-02T08:30:00.000Z', actions: {} }),
      membership({ id: 26, status: 'revoked', actions: {} })];
    const h = harness('team-members', { request: () => workspace({ members: paged(records) }) });
    await h.page.onShow();
    expect(h.page.data.docs.map(doc => doc.endText)).toEqual(['', '2026.10.01 16:00', '2026.10.02 16:30', '']);
    expect(h.page.data.docs[0]).toMatchObject({ status: 'active', statusText: '成员关系未撤销', joinedText: '2026.09.10 16:00', leftAt: null, revokedAt: null });
    expect(h.page.data.docs[1]).toMatchObject({ statusText: '已离队', leftAt: records[1].leftAt });
    expect(h.page.data.docs[2]).toMatchObject({ statusText: '已撤销', revokedAt: records[2].revokedAt });
    expect(writes(h)).toHaveLength(0);
  });

  it.each([
    { label: 'without an end timestamp', leftAt: null, revokedAt: null, expected: '' },
    { label: 'with a leave timestamp', leftAt: '2026-10-01T08:00:00.000Z', revokedAt: null, expected: '2026.10.01 16:00' },
    { label: 'with a revoke timestamp', leftAt: null, revokedAt: '2026-10-02T08:30:00.000Z', expected: '2026.10.02 16:30' },
  ])('retains a confirmed membership result $label when the following read fails', async ({ leftAt, revokedAt, expected }) => {
    let reads = 0;
    const saved = membership({ status: 'revoked', updatedAt: '2026-10-15T08:30:00.000Z', leftAt, revokedAt });
    const h = harness('team-members', { request: (path, options) => {
      if (options.method === 'POST') return { result: saved };
      if (++reads > 1) throw new Error('合成写后读取断网');
      return response(path, options);
    } });
    await h.page.onShow(); h.page.note(event({ id: 23 }, '合成测试：已核对关系结束安排')); await h.page.revoke(event({ id: 23 }));
    expect(h.page.data.docs[0]).toMatchObject({ id: 23, status: 'revoked', leftAt, revokedAt, endText: expected, actions: {} });
    expect(h.page.data.done).toBe('成员关系撤销已保存'); expect(h.page.data.error).toBe('合成写后读取断网');
    expect(writes(h)).toHaveLength(1); expect(reads).toBe(2);
  });

  it('paginates membership records independently and does not store unrelated private answers', async () => {
    const second = deferred<unknown>(); const h = harness('team-members', { request: path => path.includes('membersPage=2') ? second.promise : workspace({ members: paged([membership()], 1, true) }) });
    await h.page.onShow(); expect(h.page.data).not.toHaveProperty('applications'); const first = h.page.load(true); await h.page.load(true);
    expect(h.calls.filter(call => call.path.includes('membersPage=2'))).toHaveLength(1); expect(h.page.data.page).toBe(1);
    second.resolve(workspace({ members: paged([membership({ id: 24 })], 2) })); await first;
    expect(h.page.data.docs.map(doc => doc.id)).toEqual([23, 24]); expect(h.page.data.page).toBe(2);
  });
});

describe('Team private lifecycle and native event binding — synthetic VM', () => {
  const pages = ['team', 'team-apply', 'team-review', 'team-members'];
  it.each(pages)('clears %s private state immediately on an account change and ignores late responses', async name => {
    const pending = deferred<unknown>(); const h = harness(name, { request: () => pending.promise });
    const loading = h.page.onShow(); await flush(); h.page.setData({ docs: [join()], title: '合成旧账号草稿', reason: '合成旧账号计划' }); h.changeUser(2);
    expect(h.page.data.docs).toHaveLength(0); if (name === 'team-apply') { expect(h.page.data.title).toBe(''); expect(h.page.data.reason).toBe(''); }
    pending.resolve(name === 'team' ? hub() : name === 'team-apply' ? ownEstablishments() : workspace()); await loading;
    expect(h.page.data.docs).toHaveLength(0); expect(h.page.data.loading).toBe(false); h.page.onUnload();
  });

  it.each(pages)('recovers %s foreground loading while an old request is unresolved and ignores its later reply', async name => {
    const pending = deferred<unknown>(); let reads = 0;
    const h = harness(name, { request: (path, options) => ++reads === 1 ? pending.promise : response(path, options) });
    const oldLoad = h.page.onShow(); await flush(); h.page.onHide(); await h.page.onShow();
    const visibleIDs = h.page.data.docs.map(doc => doc.id); expect(h.page.data.loading).toBe(false); expect(visibleIDs.length).toBeGreaterThan(0);
    pending.resolve(name === 'team' ? hub({ recruitments: paged([recruitment({ id: 999 })]) }) : name === 'team-apply' ? ownEstablishments({ docs: [establishment({ id: 999 })] }) : workspace({ applications: paged([join({ id: 999 })]), members: paged([membership({ id: 999 })]) }));
    await oldLoad; expect(h.page.data.docs.map(doc => doc.id)).toEqual(visibleIDs);
  });

  it.each(pages)('displays %s login requirements after an explicit 401 without keeping private records', async name => {
    const h = harness(name, { request: () => { throw Object.assign(new Error('请先登录可用账号'), { status: 401 }); } });
    h.page.setData({ docs: [join()] }); await h.page.onShow(); expect(h.page.data.needsLogin).toBe(true); expect(h.page.data.docs).toHaveLength(0);
  });

  it.each(pages)('has a real handler for every %s WXML event binding', name => {
    const h = harness(name); const bindings = Array.from(source('pages/' + name + '/index.wxml').matchAll(/bind(?:tap|input|change|error)="([^"]+)"/g), match => match[1]);
    for (const binding of bindings) expect(typeof h.page[binding], binding).toBe('function');
  });

  it('does not post a stale modal confirmation after logout', async () => {
    const h = harness('team-members', { modalAuto: false }); await h.page.onShow(); h.page.note(event({ id: 23 }, '合成测试撤销原因'));
    const pending = h.page.revoke(event({ id: 23 })); h.changeUser(null); h.modals[0].success({ confirm: true }); await pending;
    expect(writes(h)).toHaveLength(0); expect(h.page.data.docs).toHaveLength(0); expect(h.page.data.needsLogin).toBe(true);
  });
});

describe('Deferred team POST lifecycle regression — synthetic VM', () => {
  const pages = ['team', 'team-apply', 'team-review', 'team-members'];
  function prepare(h: ReturnType<typeof harness>, name: string) {
    if (name === 'team-apply') { h.page.newApplication(); h.page.setData({ title: '合成测试新代表队', reason: '合成测试：未提交的组织与训练计划' }); }
    if (name === 'team-review') h.page.note(event({ id: 17 }, '合成测试：请补充训练计划'));
    if (name === 'team-members') h.page.note(event({ id: 23 }, '合成测试：核实成员主动离队'));
  }
  function act(h: ReturnType<typeof harness>, name: string) {
    if (name === 'team') return h.page.operate(event({ operation: 'leave', id: 23 }));
    if (name === 'team-apply') return h.page.submit();
    if (name === 'team-review') return h.page.decide(event({ id: 17, decision: 'returned' }));
    return h.page.revoke(event({ id: 23 }));
  }
  const saved = (name: string) => name === 'team-apply' ? establishment({ id: 99, status: 'pending', updatedAt: 'synthetic-v2' })
    : name === 'team-review' ? join({ status: 'returned', updatedAt: 'synthetic-v2' }) : membership({ status: 'revoked', updatedAt: 'synthetic-v2', leftAt: 'synthetic-left' });

  it.each(pages)('holds %s write lock across hide/show until a deferred POST ends, then uses only GET recovery', async name => {
    const pending = deferred<unknown>(); let reads = 0;
    const h = harness(name, { request: (path, options) => { if (options.method === 'POST') return pending.promise; reads++; return response(path, options); } });
    await h.page.onShow(); prepare(h, name); const writing = act(h, name); await flush(); expect(writes(h)).toHaveLength(1);
    h.page.onHide(); await h.page.onShow(); const duplicate = act(h, name); await flush();
    expect(writes(h)).toHaveLength(1); expect(h.page.data.busy).toBe(true); expect(reads).toBe(1);
    pending.resolve({ result: saved(name), message: '合成保存成功' }); await writing; await duplicate; await flush();
    expect(writes(h)).toHaveLength(1); expect(reads).toBe(2); expect(h.page.data.busy).toBe(false);
  });

  it.each(pages)('does no hidden recovery GET when %s POST settles before returning to foreground', async name => {
    const pending = deferred<unknown>(); let reads = 0;
    const h = harness(name, { request: (path, options) => { if (options.method === 'POST') return pending.promise; reads++; return response(path, options); } });
    await h.page.onShow(); prepare(h, name); const writing = act(h, name); await flush(); h.page.onHide();
    expect(h.page.data.busy).toBe(true); pending.resolve({ result: saved(name), message: '合成保存成功' }); await writing; await flush();
    expect(reads).toBe(1); expect(h.page.data.busy).toBe(false); await h.page.onShow(); expect(reads).toBe(2); expect(writes(h)).toHaveLength(1);
  });

  it.each(pages.flatMap(name => [false, true].map(hidden => ({ name, hidden }))))('recovers only by GET after a failed $name POST (settles hidden=$hidden) and preserves its draft', async ({ name, hidden }) => {
    const pending = deferred<unknown>(); let reads = 0;
    const h = harness(name, { request: (path, options) => { if (options.method === 'POST') return pending.promise; reads++; return response(path, options); } });
    await h.page.onShow(); prepare(h, name); const writing = act(h, name); await flush(); h.page.onHide();
    if (!hidden) { await h.page.onShow(); const duplicate = act(h, name); await flush(); expect(writes(h)).toHaveLength(1); await duplicate; }
    pending.reject(new Error('合成写入结果未确认')); await writing; await flush();
    expect(reads).toBe(hidden ? 1 : 2); expect(writes(h)).toHaveLength(1); expect(h.page.data.busy).toBe(false);
    if (hidden) { await act(h, name); expect(writes(h)).toHaveLength(1); await h.page.onShow(); }
    expect(reads).toBe(2);
    if (name === 'team-apply') expect(h.page.data.reason).toBe('合成测试：未提交的组织与训练计划');
    if (name === 'team-review') expect(h.page.data.docs[0].noteDraft).toBe('合成测试：请补充训练计划');
    if (name === 'team-members') expect(h.page.data.docs[0].noteDraft).toBe('合成测试：核实成员主动离队');
  });

  it.each(pages)('keeps the %s pending write lock on account change and reads only the current account after it ends', async name => {
    const pending = deferred<unknown>(); let reads = 0;
    const h = harness(name, { request: (path, options) => {
      if (options.method === 'POST') return pending.promise; reads++;
      const value = response(path, options);
      return value;
    } });
    await h.page.onShow(); prepare(h, name); const writing = act(h, name); await flush(); h.changeUser(2);
    expect(h.page.data.docs).toHaveLength(0); expect(h.page.data.busy).toBe(true); await h.page.onShow(); await act(h, name);
    expect(reads).toBe(1); expect(writes(h)).toHaveLength(1);
    pending.resolve({ result: saved(name), message: '合成旧账号保存' }); await writing; await flush();
    expect(reads).toBe(2); expect(writes(h)).toHaveLength(1); expect(h.page.data.done).toBe('');
    if (name === 'team-apply') expect(h.page.data.reason).toBe('');
  });

  it.each(['team-review', 'team-members'])('keeps the %s pending write lock on same-account route changes and discards the old result', async name => {
    const pending = deferred<unknown>(); const h = harness(name, { request: (path, options) => {
      if (options.method === 'POST') return pending.promise;
      return path.includes('/team/10/') ? workspace({ team: row({ ...teamRow, id: 10 }) }) : response(path, options);
    } });
    await h.page.onShow(); prepare(h, name); const writing = act(h, name); await flush(); h.page.onLoad({ team: '10' });
    expect(h.page.data.docs).toHaveLength(0); expect(h.page.data.busy).toBe(true); await h.page.onShow(); await act(h, name);
    expect(h.calls.filter(call => call.options.method !== 'POST')).toHaveLength(1); expect(writes(h)).toHaveLength(1);
    pending.resolve({ result: saved(name), message: '合成旧路由保存' }); await writing; await flush();
    expect(h.page.data.teamDoc?.id).toBe(10); expect(h.page.data.done).toBe(''); expect(writes(h)).toHaveLength(1);
    expect(h.calls.at(-1)?.path).toContain('/team/10/workbench');
  });

  it.each(pages)('retains confirmed %s POST result as read-only when the following GET fails', async name => {
    let reads = 0;
    const h = harness(name, { request: (path, options) => {
      if (options.method === 'POST') return { result: saved(name), message: '合成保存成功' };
      if (++reads > 1) throw new Error('合成写后读取断网'); return response(path, options);
    } });
    await h.page.onShow(); prepare(h, name); await act(h, name);
    const result = name === 'team' ? h.page.data.memberships.docs[0] : h.page.data.docs[0];
    expect(result).toMatchObject({ id: saved(name).id, status: saved(name).status, updatedAt: 'synthetic-v2', actions: {} });
    expect(h.page.data.error).toBe('合成写后读取断网'); expect(writes(h)).toHaveLength(1);
  });

  it.each([
    { operation: 'lifecycle', status: 'archived', id: 9 },
    { operation: 'lifecycle', status: 'resting', id: 9 },
    { operation: 'close-recruitment', status: 'archived', id: 21 },
  ])('clears all review actions after confirmed $operation=$status until a fresh workbench GET succeeds', async action => {
    const pendingGet = deferred<unknown>(); let reads = 0;
    const confirmed = action.operation === 'lifecycle' ? { id: 9, teamStatus: action.status, updatedAt: 'synthetic-v2' }
      : { id: 21, status: action.status, updatedAt: 'synthetic-v2' };
    const records = [join(), join({ id: 18 })];
    const fresh = () => workspace({
      team: action.operation === 'lifecycle' ? { ...teamRow, ...confirmed } : teamRow,
      recruitments: paged([recruitment({ ...(action.operation === 'close-recruitment' ? confirmed : {}), actions: {} })]),
      applications: paged(records.map(doc => ({ ...doc, actions: { reviewDecisions: ['returned'] } }))),
    });
    const h = harness('team-review', { request: (_path, options) => {
      if (options.method === 'POST') return { result: confirmed, message: '合成运营状态已保存' };
      if (++reads === 2) return pendingGet.promise;
      return reads === 1 ? workspace({ applications: paged(records) }) : fresh();
    } });
    await h.page.onShow();
    h.page.note(event({ id: 17 }, '合成测试：待核对训练安排'));
    h.page.note(event({ id: 18 }, '合成测试：另一份未提交审核意见'));
    const writing = h.page.operate(event(action)); await flush(); await flush();
    const duringRead = h.page.data.docs.map(doc => ({ actions: doc.actions, decisions: doc.decisions, noteDraft: doc.noteDraft }));
    expect(reads).toBe(2); expect(h.page.data.loading).toBe(true);
    pendingGet.reject(new Error('合成运营状态保存后的读取失败')); await writing;
    for (const doc of duringRead) { expect(doc.actions).toEqual({}); expect(doc.decisions).toEqual([]); }
    expect(h.page.data.docs.map(doc => doc.noteDraft)).toEqual(['合成测试：待核对训练安排', '合成测试：另一份未提交审核意见']);
    for (const doc of h.page.data.docs) { expect(doc.actions).toEqual({}); expect(doc.decisions).toEqual([]); }
    const result = action.operation === 'lifecycle' ? h.page.data.teamDoc : (h.page.data.recruitments as Row[])[0];
    expect(result).toMatchObject(confirmed); expect(h.page.data.error).toBe('合成运营状态保存后的读取失败');
    await h.page.decide(event({ id: 17, decision: 'approved' })); await h.page.decide(event({ id: 18, decision: 'returned' }));
    expect(writes(h)).toHaveLength(1);
    await h.page.load();
    expect(reads).toBe(3); expect(writes(h)).toHaveLength(1); expect(h.page.data.error).toBe('');
    for (const doc of h.page.data.docs) {
      expect(doc.actions).toEqual({ reviewDecisions: ['returned'] }); expect(doc.decisions).toEqual([{ value: 'returned', label: '退回补充' }]);
    }
    expect(h.page.data.docs.map(doc => doc.noteDraft)).toEqual(['合成测试：待核对训练安排', '合成测试：另一份未提交审核意见']);
  });

  it.each(['team-review', 'team-members'])('ignores late %s old-route GET between a same-account new onLoad and onShow', async name => {
    const pending = deferred<unknown>(); const h = harness(name, { request: path => path.includes('/team/9/') ? pending.promise : workspace({ team: row({ ...teamRow, id: 10 }) }) });
    const oldLoad = h.page.onShow(); await flush(); h.page.onLoad({ team: '10' });
    pending.resolve(workspace()); await oldLoad; expect(h.page.data.docs).toHaveLength(0); expect(h.page.data.error).toBe(''); expect(h.page.data.teamDoc).toBeNull();
    await h.page.onShow(); expect(h.page.data.teamDoc?.id).toBe(10);
  });
});
