import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { normalizeSignup, type Answers, type SignupForm } from '../src/lib/signup-schema';

// These tests execute the native handlers with synthetic API responses. They
// neither connect to WeChat nor exercise a production account or application.
type User = { id: number; name: string; roles: string[] };
type Event = { currentTarget: { dataset: Record<string, unknown> }; detail: { value: string | string[] } };
type RequestOptions = { method?: string; auth?: boolean; raw?: boolean; required?: boolean; questionnaire?: boolean; data?: Record<string, unknown> };
type Application = {
  id: number; status: string; createdAt: string; updatedAt: string; formVersion: string;
  questions: SignupForm['questions']; answers: Answers; feedback?: string;
};
type StaffInfo = Record<string, unknown> & {
  title: string; form: SignupForm | null; version: string; state: string;
  application: Application | null;
  actions: Partial<Record<'submit' | 'edit' | 'withdraw' | 'review', boolean>>;
};
type BasePage = {
  data: Record<string, unknown>; setData(data: Record<string, unknown>): void;
  onLoad?(options: Record<string, string>): void;
  onShow?(): void | Promise<void>; onHide?(): void; onUnload?(): void;
};
type SignupPage = BasePage & {
  data: Record<string, unknown> & {
    info: StaffInfo | null; form: SignupForm; receipt: Application | null;
    answers: Answers; questions: { id: string; type: string; entries?: unknown[] }[];
    answerErrors: Record<string, string>; reviewRows: unknown[]; entries: unknown[];
    busy: boolean; responseEditing: boolean; review: boolean; message: string;
  };
  load(): Promise<void>; submit(): Promise<void>; withdraw(): Promise<void>;
  editAnswers(): void; answer(event: Event): void; answerNext(): void;
  groupAnswer(event: Event): void; addEntry(event: Event): void;
  staffReview(): void;
};
type StaffPage = BasePage & {
  data: Record<string, unknown> & { docs: Record<string, unknown>[]; own: Record<string, unknown>[]; reviewStaff: boolean };
  load(): Promise<void>; loadOwn(): Promise<void>;
  openBatch(event: Event): void; reviewBatch(event: Event): void;
};
type ReviewDoc = Application & {
  allowed: { value: string; label: string }[]; decisionIndex: number; feedbackDraft: string;
};
type ReviewPage = BasePage & {
  data: Record<string, unknown> & {
    docs: ReviewDoc[]; total: number; page: number; department: string; status: string;
    busy: boolean; loading: boolean; message: string; error: string;
  };
  load(page?: number): Promise<void>; field(event: Event): void; decide(event: Event): Promise<void>;
};
type ApplicationsPage = BasePage & {
  data: Record<string, unknown> & { qr: string; imageBusy: boolean; formError: string };
  chooseQr(): Promise<void>; openContract(): Promise<void>;
};
type ModalOptions = { success(value: { confirm: boolean }): void; fail(): void };
type CallbackOptions = { success(): void; fail(): void };
type Navigation = { website(path: string): void; go(page: string, values?: Record<string, string>): void };
type Privacy = { authorize(): Promise<void>; openContract(): Promise<void> };

const firstUser: User = { id: 501, name: '合成申请人甲', roles: ['member'] };
const secondUser: User = { id: 502, name: '合成申请人乙', roles: ['member'] };
const form = normalizeSignup({ enabled: true, questions: [
  { id: 'motivation', label: '合成申请说明', type: 'text', required: true, options: [] },
] });
const saved = (status = 'returned', answers: Answers = { motivation: '合成原申请' }): Application => ({
  id: 811, status, createdAt: '2026-10-12T01:00:00Z', updatedAt: '2026-10-12T02:00:00Z',
  formVersion: 'synthetic-v1', questions: form.questions, answers, feedback: '合成公开反馈',
});
const info = (overrides: Partial<StaffInfo> = {}): StaffInfo => ({
  title: '合成骨干招新', form, version: 'synthetic-v1', state: '申请开放',
  application: null, actions: { submit: true }, ...overrides,
});
const event = (id: string, value: string | string[] = '', extra: Record<string, unknown> = {}): Event => ({
  currentTarget: { dataset: { id, ...extra } }, detail: { value },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function commonJS<T>(path: string, wx: Record<string, unknown>, dependencies: Record<string, unknown> = {}): T {
  const localRequire = createRequire(new URL('../' + path, import.meta.url));
  const module = { exports: {} };
  const isPrivacy = path === 'miniprogram/src/lib/privacy.js';
  // Standalone privacy consumers start with published text and prior agreement.
  const policy = { loaded: true, text: '合成已发布网站隐私正文：主动选择后读取名片。' };
  const dialog = { available: () => policy.loaded && Boolean(policy.text.trim()),
    present: (request: { start(needAuthorization: boolean): void }) => request.start(false), close: vi.fn() };
  const pages = isPrivacy ? [{ selectComponent: (selector: string) => selector === '#privacyConsent' ? dialog : null }] : [];
  const modules = isPrivacy ? { './session': { user: () => firstUser, subscribe: () => () => {} }, ...dependencies } : dependencies;
  runInNewContext(readFileSync(path, 'utf8'), {
    module, wx: isPrivacy ? { onNeedPrivacyAuthorization: vi.fn(), getPrivacySetting: vi.fn(), ...wx } : wx,
    require: (name: string) => modules[name] ?? localRequire(name),
    getCurrentPages: () => pages,
  });
  return module.exports as T;
}
function pageHarness<T extends BasePage>(name: string, options: Record<string, string> = {}, extra: Record<string, unknown> = {}) {
  let page!: T;
  let user: User | null = firstUser;
  const listeners = new Set<(value: User | null) => void>();
  const request = vi.fn<(path: string, options?: RequestOptions) => Promise<Record<string, unknown>>>();
  const navigateTo = vi.fn();
  const wx = {
    navigateTo, switchTab: vi.fn(), navigateBack: vi.fn(), setClipboardData: vi.fn(),
    setNavigationBarTitle: vi.fn(), pageScrollTo: vi.fn(), stopPullDownRefresh: vi.fn(),
    showModal: vi.fn<(options: ModalOptions) => void>(),
  };
  const session = {
    user: () => user,
    subscribe: (listener: (value: User | null) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  const navigation = commonJS<Navigation>('miniprogram/src/lib/navigation.js', wx, { './session': session });
  const pageModule = commonJS('miniprogram/src/lib/page.js', wx, { './navigation': navigation, './session': session });
  const path = 'miniprogram/src/pages/' + name + '/index.js';
  const localRequire = createRequire(new URL('../' + path, import.meta.url));
  const dependencies: Record<string, unknown> = {
    '../../lib/http': { request }, '../../lib/session': session,
    '../../lib/navigation': navigation, '../../lib/page': pageModule, ...extra,
  };
  const privacyFactory = extra['../../lib/privacy'];
  if (typeof privacyFactory === 'function') dependencies['../../lib/privacy'] = privacyFactory(session);
  runInNewContext(readFileSync(path, 'utf8'), {
    Page: (value: T) => { page = value; },
    require: (name: string) => dependencies[name] ?? localRequire(name), wx,
  });
  page.setData = value => {
    for (const [key, next] of Object.entries(value)) {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target = page.data;
      for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
      target[parts[parts.length - 1]] = next;
    }
  };
  page.onLoad?.(options);
  return {
    page, request, wx, navigation, listeners,
    changeUser(value: User | null) { user = value; for (const listener of listeners) listener(value); },
  };
}
function cmsStub() {
  const localRequire = createRequire(import.meta.url);
  const cms = localRequire('../miniprogram/src/lib/cms.js');
  return { query: cms.query, selection: cms.selection, list: vi.fn().mockResolvedValue({ docs: [] }) };
}
async function signupHarness(response: StaffInfo) {
  const harness = pageHarness<SignupPage>('signup', { kind: 'staff', id: '71' });
  harness.request.mockResolvedValue(response);
  await harness.page.load();
  return harness;
}
const writes = (request: ReturnType<typeof pageHarness>['request']) =>
  request.mock.calls.filter(([, options]) => options?.method && options.method !== 'GET');
function visibleGuard(path: string, marker: string, data: Record<string, unknown>) {
  const tags = readFileSync(path, 'utf8').match(/<(?:button|block)\b[^>]*>/g) || [];
  const tag = tags.find(value => value.includes(marker));
  expect(tag, 'Missing native template guard for ' + marker).toBeDefined();
  const expression = tag?.match(/wx:if="\{\{(.*?)\}\}"/)?.[1];
  expect(expression, 'Missing native condition for ' + marker).toBeDefined();
  return Boolean(runInNewContext(expression!, data));
}

describe('原生骨干申请：服务端动作和本人回执', () => {
  it('撤下批次的空表单仍显示本人原题目回执，不能恢复填答或发送写请求', async () => {
    const original = saved('submitted');
    const { page, request } = await signupHarness(info({ form: null, state: '批次已撤下，仅可查看回执', application: original, actions: {} }));
    expect(page.data.info?.state).toBe('批次已撤下，仅可查看回执');
    expect(page.data.receipt).toMatchObject({ id: original.id, answers: original.answers });
    expect(page.data.form.enabled).toBe(false); expect(page.data.form.questions).toEqual([]);
    expect(page.data.error).toBe(''); expect(page.data.loading).toBe(false);
    page.editAnswers(); page.setData({ review: true }); await page.submit(); await page.withdraw();
    expect(page.data.responseEditing).toBe(false); expect(writes(request)).toHaveLength(0);
    expect(visibleGuard('miniprogram/src/pages/signup/index.wxml', 'form.enabled && (team ?', page.data)).toBe(false);
  });
  it.each([
    { state: '已截止', status: 'submitted' },
    { state: '申请开放', status: 'accepted' },
    { state: '申请开放', status: 'rejected' },
  ])('没有服务端动作时 $state / $status 的回执只读，迟到按钮事件也不能写', async ({ state, status }) => {
    const { page, request, wx } = await signupHarness(info({ state, application: saved(status), actions: {} }));
    page.editAnswers();
    expect(page.data.responseEditing).toBe(false);
    page.setData({ answers: { motivation: '模拟迟到点击' }, review: true });
    await page.submit();
    await page.withdraw();
    expect(writes(request)).toHaveLength(0);
    expect(wx.showModal).not.toHaveBeenCalled();
    expect(visibleGuard('miniprogram/src/pages/signup/index.wxml', 'bindtap="editAnswers"', page.data)).toBe(false);
    expect(visibleGuard('miniprogram/src/pages/signup/index.wxml', 'bindtap="withdraw"', page.data)).toBe(false);
    expect(visibleGuard('miniprogram/src/pages/signup/index.wxml', 'form.enabled && (team ?', page.data)).toBe(false);
  });

  it('returned 修改沿用申请编号，通过 POST edit 与旧 revision 写入，再从 helper 获取新能力', async () => {
    const original = saved();
    const { page, request } = await signupHarness(info({ state: '服务端提示补充资料', application: original, actions: { edit: true, withdraw: true } }));
    page.editAnswers();
    page.answer(event('motivation', '合成修改后的说明'));
    expect(page.data.receipt?.answers).toEqual(original.answers);
    page.answerNext();
    const updated = { ...original, status: 'submitted', updatedAt: '2026-10-12T03:00:00Z', answers: page.data.answers };
    request.mockResolvedValueOnce({ application: updated }).mockResolvedValueOnce(info({ application: updated, actions: { withdraw: true } }));
    await page.submit();
    expect(writes(request)).toEqual([[
      '/api/staff/batches/71/application',
      expect.objectContaining({ method: 'POST', required: true, questionnaire: true, data: {
        action: 'edit', version: 'synthetic-v1', revision: original.updatedAt, answers: updated.answers,
      } }),
    ]]);
    expect(request).toHaveBeenLastCalledWith('/api/miniapp/staff/71', expect.objectContaining({ required: true }));
    expect(page.data.receipt?.id).toBe(original.id);
    expect(page.data.receipt?.answers).toEqual(updated.answers);
    expect(page.data.info?.actions).toEqual({ withdraw: true });
    expect(page.data.responseEditing).toBe(false);
  });

  it('withdrawn 重提使用 POST 与旧 revision，并保留同一申请编号', async () => {
    const original = saved('withdrawn');
    const { page, request } = await signupHarness(info({ application: original, actions: { edit: true, submit: true } }));
    page.editAnswers();
    page.answer(event('motivation', '合成重提说明'));
    page.answerNext();
    const updated = { ...original, status: 'submitted', updatedAt: '2026-10-12T03:00:00Z', answers: page.data.answers };
    request.mockResolvedValueOnce({ application: updated }).mockResolvedValueOnce(info({ application: updated, actions: { edit: true, withdraw: true } }));
    await page.submit();
    expect(writes(request)[0]).toEqual([
      '/api/staff/batches/71/application',
      expect.objectContaining({ method: 'POST', data: { version: 'synthetic-v1', revision: original.updatedAt, answers: updated.answers } }),
    ]);
    expect(page.data.receipt?.id).toBe(original.id);
  });

  it('首次 POST 弱网失败保留核对页和答案，连续点击只有一个在途写请求，之后可重试', async () => {
    const { page, request } = await signupHarness(info());
    page.answer(event('motivation', '合成首次申请'));
    page.answerNext();
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const sending = page.submit();
    await page.submit();
    expect(page.data.busy).toBe(true);
    expect(writes(request)).toHaveLength(1);
    pending.reject(new Error('合成连接失败'));
    await sending;
    expect(page.data.busy).toBe(false);
    expect(page.data.answers).toEqual({ motivation: '合成首次申请' });
    expect(page.data.review).toBe(true);
    expect(page.data.receipt).toBeNull();
    const submitted = saved('submitted', page.data.answers);
    request.mockResolvedValueOnce({ application: submitted }).mockResolvedValueOnce(info({ application: submitted, actions: { edit: true } }));
    await page.submit();
    expect(writes(request)).toHaveLength(2);
    expect(writes(request)[0][1]?.data).not.toHaveProperty('revision');
    expect(page.data.receipt?.id).toBe(submitted.id);
    expect(page.data.answers).toEqual({});
  });

  it('撤回先锁住确认框，确认后只写一次，再读取服务端重提能力', async () => {
    const original = saved('submitted');
    const { page, request, wx } = await signupHarness(info({ application: original, actions: { edit: true, withdraw: true } }));
    let modal!: ModalOptions;
    wx.showModal.mockImplementation(options => { modal = options; });
    const withdrawing = page.withdraw();
    await page.withdraw();
    expect(wx.showModal).toHaveBeenCalledTimes(1);
    expect(page.data.busy).toBe(true);
    expect(writes(request)).toHaveLength(0);
    const withdrawn = { ...original, status: 'withdrawn', updatedAt: '2026-10-12T04:00:00Z' };
    request.mockResolvedValueOnce({ application: withdrawn }).mockResolvedValueOnce(info({ application: withdrawn, actions: { edit: true, submit: true } }));
    modal.success({ confirm: true });
    await withdrawing;
    expect(writes(request)[0]).toEqual([
      '/api/staff/batches/71/application',
      expect.objectContaining({ method: 'POST', data: { action: 'withdraw', revision: original.updatedAt } }),
    ]);
    expect(writes(request)).toHaveLength(1);
    expect(request).toHaveBeenLastCalledWith('/api/miniapp/staff/71', expect.objectContaining({ required: true }));
    expect(page.data.receipt?.status).toBe('withdrawn');
    expect(page.data.info?.actions).toEqual({ edit: true, submit: true });
    expect(page.data.busy).toBe(false);
  });

  it('撤回刷新取得新版题干和新增必填题，重提须按新版重新核对后 POST 同一申请', async () => {
    const original = saved('submitted');
    const nextForm = normalizeSignup({ enabled: true, questions: [
      { ...form.questions[0], label: '合成新版申请说明' },
      { id: 'availability', label: '合成新版必填时段', type: 'text', required: true, options: [] },
    ] });
    const { page, request, wx } = await signupHarness(info({ application: original, actions: { edit: true, withdraw: true } }));
    page.editAnswers(); page.answerNext();
    expect(page.data.review).toBe(true);
    const withdrawn = { ...original, status: 'withdrawn', updatedAt: '2026-10-12T04:00:00Z' };
    const nextInfo = info({ form: nextForm, version: 'synthetic-v2', application: withdrawn, actions: { edit: true, submit: true } });
    wx.showModal.mockImplementationOnce(options => options.success({ confirm: true }));
    request.mockResolvedValueOnce({ application: withdrawn }).mockResolvedValueOnce(nextInfo);
    await page.withdraw();
    expect(page.data.info?.version).toBe('synthetic-v2');
    expect(page.data.form).toEqual(nextForm);
    expect(page.data.questions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'motivation', label: '合成新版申请说明' }),
      expect.objectContaining({ id: 'availability', label: '合成新版必填时段' }),
    ]));
    expect(page.data.receipt?.answers).toEqual(original.answers);
    expect(page.data.review).toBe(false); expect(page.data.reviewRows).toEqual([]);
    page.editAnswers(); page.answerNext();
    expect(page.data.answers.motivation).toBe(original.answers.motivation);
    expect(page.data.review).toBe(false); expect(page.data.answerErrors.availability).toBeTruthy();
    await page.submit(); expect(writes(request)).toHaveLength(1);
    page.answer(event('availability', '合成新版可参与时段'));
    await page.submit(); expect(writes(request)).toHaveLength(1);
    page.answerNext();
    expect(page.data.review).toBe(true);
    expect(page.data.reviewRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'motivation', label: '合成新版申请说明' }),
      expect.objectContaining({ id: 'availability', label: '合成新版必填时段', answer: '合成新版可参与时段' }),
    ]));
    const updated = { ...withdrawn, status: 'submitted', updatedAt: '2026-10-12T05:00:00Z',
      formVersion: 'synthetic-v2', questions: nextForm.questions, answers: page.data.answers };
    request.mockResolvedValueOnce({ application: updated }).mockResolvedValueOnce({ ...nextInfo, application: updated, actions: { withdraw: true } });
    await page.submit();
    expect(writes(request)).toHaveLength(2);
    expect(writes(request)[1]).toEqual([
      '/api/staff/batches/71/application',
      expect.objectContaining({ method: 'POST', data: { version: 'synthetic-v2', revision: withdrawn.updatedAt, answers: updated.answers } }),
    ]);
    expect(page.data.receipt?.id).toBe(original.id);
  });

  it('撤回后的刷新返回空表单时禁用问卷，仍保留原题目回执且不能重提', async () => {
    const original = saved('submitted');
    const { page, request, wx } = await signupHarness(info({ application: original, actions: { withdraw: true } }));
    const withdrawn = { ...original, status: 'withdrawn', updatedAt: '2026-10-12T04:00:00Z' };
    wx.showModal.mockImplementationOnce(options => options.success({ confirm: true }));
    request.mockResolvedValueOnce({ application: withdrawn }).mockResolvedValueOnce(info({
      form: null, state: '批次已撤下，仅可查看回执', application: withdrawn, actions: {},
    }));
    await page.withdraw();
    expect(page.data.form.enabled).toBe(false); expect(page.data.form.questions).toEqual([]);
    expect(page.data.receipt).toMatchObject({ id: original.id, answers: original.answers });
    expect(page.data.error).toBe(''); expect(page.data.message).toBe('申请已撤回');
    page.editAnswers(); page.setData({ review: true }); await page.submit();
    expect(page.data.responseEditing).toBe(false); expect(writes(request)).toHaveLength(1);
  });

  it('取消撤回无写入；撤回后的能力刷新失败则关闭动作并允许重新读取', async () => {
    const original = saved('submitted');
    const { page, request, wx } = await signupHarness(info({ application: original, actions: { withdraw: true } }));
    wx.showModal.mockImplementationOnce(options => options.success({ confirm: false }));
    await page.withdraw();
    expect(writes(request)).toHaveLength(0);
    expect(page.data.receipt?.status).toBe('submitted');
    wx.showModal.mockImplementationOnce(options => options.success({ confirm: true }));
    const withdrawn = { ...original, status: 'withdrawn', updatedAt: '2026-10-12T04:00:00Z' };
    request.mockResolvedValueOnce({ application: withdrawn }).mockRejectedValueOnce(new Error('合成刷新失败'));
    await page.withdraw();
    expect(page.data.info?.actions).toEqual({});
    expect(page.data.message).toContain('刷新失败');
    page.editAnswers();
    expect(page.data.responseEditing).toBe(false);
    request.mockResolvedValueOnce(info({ application: withdrawn, actions: { edit: true, submit: true } }));
    await page.load();
    expect(page.data.info?.actions).toEqual({ edit: true, submit: true });
  });

  it.each([null, secondUser])('账号退出或切换立即清空私有资料，并丢弃旧账号的迟到 GET（%j）', async nextUser => {
    const { page, request, changeUser, listeners } = await signupHarness(info({ application: saved(), actions: { edit: true } }));
    page.editAnswers();
    page.answerNext();
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const loading = page.load();
    changeUser(nextUser);
    expect(page.data.receipt).toBeNull();
    expect(page.data.answers).toEqual({});
    expect(page.data.questions).toEqual([]);
    expect(page.data.reviewRows).toEqual([]);
    pending.resolve(info({ application: saved(), actions: { edit: true } }));
    await loading;
    expect(page.data.info).toBeNull();
    expect(page.data.receipt).toBeNull();
    expect(page.data.answers).toEqual({});
    page.onUnload?.();
    expect(listeners.size).toBe(0);
  });

  it('旧账号在途 POST edit 成功后不会向切换后的账号恢复回执或答案', async () => {
    const { page, request, changeUser } = await signupHarness(info({ application: saved(), actions: { edit: true } }));
    page.editAnswers();
    page.answer(event('motivation', '合成甲账号私有修改'));
    page.answerNext();
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const sending = page.submit();
    changeUser(secondUser);
    pending.resolve({ application: saved('submitted', { motivation: '合成甲账号私有修改' }) });
    await sending;
    expect(page.data.info).toBeNull();
    expect(page.data.receipt).toBeNull();
    expect(page.data.answers).toEqual({});
    expect(page.data.message).not.toContain('已保存');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('骨干页面保留既有五至六人成员 handler，非法第六条阻止写入', async () => {
    const teamForm = normalizeSignup(JSON.parse(readFileSync('tests/fixtures/questionnaire-team-draft.json', 'utf8')));
    const members = Array.from({ length: 5 }, (_, i) => ({
      name: '合成成员' + (i + 1), student: '202600' + (i + 1), game: '合成ID' + (i + 1), position: '上单',
    }));
    const answers: Answers = { mode: '团队报名', teamName: '合成队伍', team: members, contact: '13800138000' };
    const { page, request } = await signupHarness(info({ form: teamForm }));
    page.setData({ answers });
    page.addEntry(event('team'));
    page.answerNext();
    expect(page.data.review).toBe(false);
    expect(page.data.answerErrors.team).toContain('第 6 条');
    await page.submit();
    expect(writes(request)).toHaveLength(0);
    const group = teamForm.questions.find(question => question.id === 'team')!;
    expect(group.fields).toBeDefined();
    for (const [field, value] of Object.entries(members[0])) {
      const definition = group.fields!.find(item => item.id === field)!;
      page.groupAnswer(event('team', definition.type === 'select' ? String(definition.options.indexOf(value) + 1) : value, { index: 5, field }));
    }
    page.answerNext();
    expect(page.data.review).toBe(true);
    expect((page.data.answers.team as unknown[])).toHaveLength(6);
  });
});

describe('原生骨干批次列表与工作台入口', () => {
  it('游客只读取公开批次，未登录的申请入口进入登录页', async () => {
    const { page, request, changeUser, wx } = pageHarness<StaffPage>('staff', {}, { '../../lib/cms': cmsStub() });
    changeUser(null);
    request.mockResolvedValue({ docs: [{ id: 71, title: '合成公开批次', endAt: '2026-11-01T00:00:00Z' }], page: 1, hasNextPage: false });
    await page.load();
    expect(request.mock.calls).toEqual([['/api/miniapp/staff?page=1', { auth: false }]]);
    expect(page.data.own).toEqual([]);
    expect(page.data.reviewStaff).toBe(false);
    page.openBatch(event('unused', '', { id: 71 }));
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/auth/index?mode=login' });
  });

  it('本人列表只选择状态元数据，审核入口依工作台能力，平台角色不能代替授权', async () => {
    const { page, request, changeUser, wx } = pageHarness<StaffPage>('staff', {}, { '../../lib/cms': cmsStub() });
    changeUser({ ...firstUser, roles: ['president'] });
    let reviewStaff = false;
    request.mockImplementation(async path => {
      if (path === '/api/miniapp/staff?page=1') return { docs: [{ id: 71 }], page: 1, hasNextPage: false };
      if (path.startsWith('/api/staff-applications?')) return { docs: [{
        id: 811, batch: { id: 71 }, batchTitle: '合成公开批次', status: 'returned',
        updatedAt: '2026-10-12T02:00:00Z', answers: { motivation: '禁止进入列表' }, internalNote: '禁止进入列表',
      }], page: 1, hasNextPage: false };
      if (path === '/api/miniapp/workbench') return { reviewStaff };
      throw new Error('Unexpected synthetic API: ' + path);
    });
    await page.load();
    const ownRequest = request.mock.calls.find(([path]) => path.startsWith('/api/staff-applications?'))!;
    const query = new URL(ownRequest[0], 'https://synthetic.invalid').searchParams;
    expect(query.get('where[applicant][equals]')).toBe(String(firstUser.id));
    expect([...query.keys()].filter(key => key.startsWith('select['))).toEqual([
      'select[batch]', 'select[batchTitle]', 'select[status]', 'select[updatedAt]',
    ]);
    expect(ownRequest[1]).toEqual({ required: true });
    expect(page.data.own[0]).not.toHaveProperty('answers');
    expect(page.data.own[0]).not.toHaveProperty('internalNote');
    expect(page.data.reviewStaff).toBe(false);
    page.reviewBatch(event('unused', '', { id: 71 }));
    expect(wx.navigateTo).not.toHaveBeenCalled();
    reviewStaff = true;
    await page.loadOwn();
    page.reviewBatch(event('unused', '', { id: 71 }));
    expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/staff-review/index?id=71' });
    page.openBatch(event('unused', '', { id: 71 }));
    expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/signup/index?kind=staff&id=71' });
    expect(request.mock.calls.some(([path]) => path.includes('/teams'))).toBe(false);
  });

  it('切换账号立即清空本人列表，并丢弃旧账号迟到的本人列表及工作台能力', async () => {
    const { page, request, changeUser } = pageHarness<StaffPage>('staff', {}, { '../../lib/cms': cmsStub() });
    page.setData({ own: [{ id: 811, batch: 71 }], reviewStaff: true });
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise).mockResolvedValueOnce({ reviewStaff: true });
    const loading = page.loadOwn();
    changeUser(secondUser);
    expect(page.data.own).toEqual([]);
    expect(page.data.reviewStaff).toBe(false);
    pending.resolve({ docs: [{ id: 811, batch: 71, batchTitle: '合成甲账号申请' }], page: 1 });
    await loading;
    expect(page.data.own).toEqual([]);
    expect(page.data.reviewStaff).toBe(false);
  });
});

const reviewResult = (statuses: string[] = ['returned', 'accepted']) => ({
  docs: [{ ...saved('reviewing'), memberName: '合成申请人甲',
    actions: { reviewStatuses: statuses }, internalNote: '合成内部备注', history: ['合成历史'], requestKey: 'synthetic-key',
  }],
  page: 1, totalPages: 1, totalDocs: 1,
});
async function reviewHarness(statuses?: string[]) {
  const harness = pageHarness<ReviewPage>('staff-review', { id: '71' }, { '../../lib/cms': cmsStub() });
  harness.request.mockResolvedValue(reviewResult(statuses));
  await harness.page.load();
  return harness;
}
describe('原生骨干审核：授权 GET 与服务端允许的决定', () => {
  it('审核读取仅用 helper 的 GET，选项保留服务端 status value，拒绝无效 picker 索引', async () => {
    const { page, request } = await reviewHarness(['returned', 'accepted']);
    const [path, options] = request.mock.calls[0];
    const url = new URL(path, 'https://synthetic.invalid');
    expect(url.pathname).toBe('/api/miniapp/staff/71');
    expect(url.searchParams.get('mode')).toBe('review');
    expect(options?.method ?? 'GET').toBe('GET');
    expect(options?.required).toBe(true);
    expect(page.data.docs[0].allowed.map(choice => choice.value)).toEqual(['returned', 'accepted']);
    expect(page.data.docs[0]).not.toHaveProperty('internalNote');
    expect(page.data.docs[0]).not.toHaveProperty('history');
    expect(page.data.docs[0]).not.toHaveProperty('requestKey');
    page.field(event('unused', '99', { index: 0, key: 'decisionIndex' }));
    expect(page.data.docs[0].decisionIndex).toBe(0);
    page.setData({ department: 'execution', status: 'returned' });
    await page.load(3);
    const filter = new URL(request.mock.calls[1][0], 'https://synthetic.invalid').searchParams;
    expect(filter.get('page')).toBe('3');
    expect(filter.get('department')).toBe('execution');
    expect(filter.get('status')).toBe('returned');
  });

  it('没有 reviewStatuses 的记录只能查看，无法通过按钮事件写入', async () => {
    const { page, request, wx } = await reviewHarness([]);
    expect(visibleGuard('miniprogram/src/pages/staff-review/index.wxml', 'item.allowed.length', { item: page.data.docs[0] })).toBe(false);
    await page.decide(event('unused', '', { index: 0 }));
    expect(wx.showModal).not.toHaveBeenCalled();
    expect(writes(request)).toHaveLength(0);
  });

  it('审核确认框前加锁，只提交允许的 status/id/revision 与已核对反馈，重复点击不重复写', async () => {
    const { page, request, wx } = await reviewHarness();
    page.field(event('unused', '1', { index: 0, key: 'decisionIndex' }));
    page.field(event('unused', '合成审核反馈', { index: 0, key: 'feedbackDraft' }));
    let modal!: ModalOptions;
    wx.showModal.mockImplementation(options => { modal = options; });
    const saving = page.decide(event('unused', '', { index: 0 }));
    await page.decide(event('unused', '', { index: 0 }));
    page.field(event('unused', '锁定期间不修改', { index: 0, key: 'feedbackDraft' }));
    expect(wx.showModal).toHaveBeenCalledTimes(1);
    expect(page.data.busy).toBe(true);
    expect(page.data.docs[0].feedbackDraft).toBe('合成审核反馈');
    expect(writes(request)).toHaveLength(0);
    request.mockResolvedValueOnce({}).mockResolvedValueOnce(reviewResult([]));
    modal.success({ confirm: true });
    await saving;
    expect(writes(request)).toEqual([[
      '/api/staff/batches/71/application',
      expect.objectContaining({ method: 'POST', required: true, data: {
        action: 'review', id: 811, revision: '2026-10-12T02:00:00Z', status: 'accepted', feedback: '合成审核反馈',
      } }),
    ]]);
    expect(page.data.busy).toBe(false);
    expect(page.data.docs[0].allowed).toEqual([]);
  });

  it('审核 helper 返回 403 后清空私有答案与总数，保留可重试错误状态', async () => {
    const { page, request } = await reviewHarness();
    expect(page.data.docs).toHaveLength(1);
    request.mockRejectedValueOnce(Object.assign(new Error('合成无权限'), { status: 403 }));
    await page.load();
    expect(page.data.docs).toEqual([]);
    expect(page.data.total).toBe(0);
    expect(page.data.loading).toBe(false);
    expect(page.data.error).toBe('合成无权限');
    expect(writes(request)).toHaveLength(0);
  });

  it('审核确认期间账号退出会清空答案，之后确认也不写入', async () => {
    const { page, request, wx, changeUser } = await reviewHarness();
    let modal!: ModalOptions;
    wx.showModal.mockImplementation(options => { modal = options; });
    const saving = page.decide(event('unused', '', { index: 0 }));
    changeUser(null);
    expect(page.data.docs).toEqual([]);
    expect(page.data.total).toBe(0);
    modal.success({ confirm: true });
    await saving;
    expect(writes(request)).toHaveLength(0);
    expect(page.data.busy).toBe(false);
  });

  it('切换账号丢弃迟到的审核 GET，且取消监听后不恢复私有资料', async () => {
    const { page, request, changeUser, listeners } = await reviewHarness();
    const pending = deferred<Record<string, unknown>>();
    request.mockImplementationOnce(() => pending.promise);
    const loading = page.load();
    changeUser(secondUser);
    pending.resolve(reviewResult());
    await loading;
    expect(page.data.docs).toEqual([]);
    expect(page.data.total).toBe(0);
    page.onUnload?.();
    expect(listeners.size).toBe(0);
  });
});

describe('原生导航、私有字段投影和隐私辅助接口', () => {
  it('骨干 URL 始终进入同一个 kind/id 的申请页，导航不请求队伍 API', () => {
    const { navigation, wx, request } = pageHarness<SignupPage>('signup', { kind: 'staff', id: '71' });
    navigation.website('/join/staff');
    navigation.website('/join/staff/batches/71');
    navigation.website('/join/staff/batches/71');
    expect(wx.navigateTo.mock.calls.map(([value]) => value.url)).toEqual([
      '/pages/staff/index', '/pages/signup/index?kind=staff&id=71', '/pages/signup/index?kind=staff&id=71',
    ]);
    expect(request).not.toHaveBeenCalled();
  });

  it('骨干回执显示公开反馈，内部审核备注、历史和请求键不进入页面数据', () => {
    const staff = commonJS<{ receipt(value: unknown): Record<string, unknown> }>('miniprogram/src/lib/staff.js', {});
    const projected = staff.receipt({ ...saved(), internalNote: '合成内部备注', history: ['合成审核历史'], requestKey: 'synthetic-key' });
    expect(projected.feedback).toBe('合成公开反馈');
    expect(projected).not.toHaveProperty('internalNote');
    expect(projected).not.toHaveProperty('history');
    expect(projected).not.toHaveProperty('requestKey');
  });

  it('主页与社群页面的实际共享导航进入同一个骨干批次申请页', () => {
    type LinkedPage = BasePage & { openWebsite(value: Event): void };
    const home = pageHarness<LinkedPage>('home');
    const community = pageHarness<LinkedPage>('community', { id: '31', slug: 'synthetic-game' });
    const link = event('unused', '', { url: '/join/staff/batches/71' });
    home.page.openWebsite(link);
    community.page.openWebsite(link);
    expect(home.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/signup/index?kind=staff&id=71' });
    expect(community.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/signup/index?kind=staff&id=71' });
    expect(home.request).not.toHaveBeenCalled();
    expect(community.request).not.toHaveBeenCalled();
  });

  it('隐私 helper 加载无授权副作用，拒绝后显式重试可成功，查看指引单独触发', async () => {
    const requirePrivacyAuthorize = vi.fn<(options: CallbackOptions) => void>();
    const openPrivacyContract = vi.fn<(options: CallbackOptions) => void>();
    const privacy = commonJS<Privacy>('miniprogram/src/lib/privacy.js', { requirePrivacyAuthorize, openPrivacyContract });
    expect(requirePrivacyAuthorize).not.toHaveBeenCalled();
    expect(openPrivacyContract).not.toHaveBeenCalled();
    requirePrivacyAuthorize.mockImplementationOnce(options => options.fail()).mockImplementationOnce(options => options.success());
    await expect(privacy.authorize()).rejects.toThrow('图片未读取');
    expect(openPrivacyContract).not.toHaveBeenCalled();
    await expect(privacy.authorize()).resolves.toBeUndefined();
    expect(requirePrivacyAuthorize).toHaveBeenCalledTimes(2);
    openPrivacyContract.mockImplementationOnce(options => options.fail()).mockImplementationOnce(options => options.success());
    await expect(privacy.openContract()).rejects.toThrow('稍后重试');
    await expect(privacy.openContract()).resolves.toBeUndefined();
    expect(openPrivacyContract).toHaveBeenCalledTimes(2);
  });

  it('旧微信缺少隐私接口时明确失败，不把未授权当作成功', async () => {
    const privacy = commonJS<Privacy>('miniprogram/src/lib/privacy.js', {});
    await expect(privacy.authorize()).rejects.toThrow('升级微信');
    await expect(privacy.openContract()).rejects.toThrow('升级微信');
  });

  it('申请页面启动不索取隐私授权，显式选图拒绝后不读取图片并可重试', async () => {
    const requirePrivacyAuthorize = vi.fn<(options: CallbackOptions) => void>();
    const openPrivacyContract = vi.fn<(options: CallbackOptions) => void>();
    const privacy = (session: { user(): User | null; subscribe(listener: (value: User | null) => void): () => void }) =>
      commonJS<Privacy>('miniprogram/src/lib/privacy.js', { requirePrivacyAuthorize, openPrivacyContract }, { './session': session });
    const files = { choose: vi.fn().mockResolvedValue(['/synthetic/qr.png']), readImage: vi.fn().mockResolvedValue('data:image/png;base64,c3ludGhldGlj') };
    const { page, request } = pageHarness<ApplicationsPage>('applications', { apply: '1' }, {
      '../../lib/privacy': privacy, '../../lib/files': files, '../../lib/cms': cmsStub(),
    });
    request.mockResolvedValue({ docs: [], page: 1, hasNextPage: false });
    await page.onShow?.();
    expect(requirePrivacyAuthorize).not.toHaveBeenCalled();
    expect(openPrivacyContract).not.toHaveBeenCalled();
    requirePrivacyAuthorize.mockImplementationOnce(options => options.fail());
    await page.chooseQr();
    expect(files.choose).not.toHaveBeenCalled();
    expect(files.readImage).not.toHaveBeenCalled();
    expect(page.data.imageBusy).toBe(false);
    expect(page.data.formError).toContain('图片未读取');
    requirePrivacyAuthorize.mockImplementationOnce(options => options.success());
    await page.chooseQr();
    expect(files.choose).toHaveBeenCalledTimes(1);
    expect(page.data.qr).toBe('/synthetic/qr.png');
    expect(openPrivacyContract).not.toHaveBeenCalled();
    openPrivacyContract.mockImplementationOnce(options => options.success());
    await page.openContract();
    expect(openPrivacyContract).toHaveBeenCalledTimes(1);
    expect(requirePrivacyAuthorize).toHaveBeenCalledTimes(2);
  });

  it('授权等待期间重复选图不会重复申请，切换账号后的迟到授权不会读取图片', async () => {
    let authorization!: CallbackOptions;
    const requirePrivacyAuthorize = vi.fn<(options: CallbackOptions) => void>(options => { authorization = options; });
    const privacy = (session: { user(): User | null; subscribe(listener: (value: User | null) => void): () => void }) =>
      commonJS<Privacy>('miniprogram/src/lib/privacy.js', { requirePrivacyAuthorize, openPrivacyContract: vi.fn() }, { './session': session });
    const files = { choose: vi.fn(), readImage: vi.fn() };
    const { page, request, changeUser } = pageHarness<ApplicationsPage>('applications', { apply: '1' }, {
      '../../lib/privacy': privacy, '../../lib/files': files, '../../lib/cms': cmsStub(),
    });
    request.mockResolvedValue({ docs: [], page: 1, totalPages: 1, hasNextPage: false });
    await page.onShow?.();
    const choosing = page.chooseQr();
    await page.chooseQr();
    expect(requirePrivacyAuthorize).toHaveBeenCalledTimes(1);
    expect(page.data.imageBusy).toBe(true);
    changeUser(secondUser);
    authorization.success();
    await choosing;
    expect(files.choose).not.toHaveBeenCalled();
    expect(files.readImage).not.toHaveBeenCalled();
    expect(page.data.qr).toBe('');
    expect(page.data.imageBusy).toBe(false);
  });
});
