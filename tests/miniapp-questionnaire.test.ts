import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { normalizeSignup, validateAnswers, type Answers, type SignupForm } from '../src/lib/signup-schema';
import { questionRoute } from '../src/lib/questionnaire-flow';
import { formatAnswer } from '../src/lib/questionnaire-model';

const require = createRequire(import.meta.url);
const native = require('../miniprogram/src/lib/questionnaire.js');
const runtime = require('../miniprogram/src/lib/questionnaire-runtime.js');
const teamForm = normalizeSignup(JSON.parse(readFileSync('tests/fixtures/questionnaire-team-draft.json', 'utf8')));
const members = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `演示成员${i + 1}`, student: `202600${i + 1}`, game: `演示ID${i + 1}`, position: '上单' }));
const teamAnswers = { mode: '团队报名', teamName: '本地演示队', team: members(5), contact: '13800138000' };

it('native runtime works without TextEncoder or recent Object/Array methods and preserves UTF-8 bounds', () => {
  for (const text of ['ASCII', '报名😀', '\ud800', '\udc00', 'a\ud800b']) expect(runtime.utf8Length(text)).toBe(Buffer.byteLength(text));
  expect(native.normalizeSignup(teamForm)).toEqual(teamForm);
  const source = readFileSync('miniprogram/src/lib/generated/signup-schema.js', 'utf8') + readFileSync('miniprogram/src/lib/generated/questionnaire-model.js', 'utf8');
  expect(source).not.toMatch(/TextEncoder|Object\.hasOwn\(|Object\.fromEntries\(|\.at\(/);
  expect(() => native.normalizeSignup({ ...teamForm, intro: '大'.repeat(70000) })).toThrow('200 KB');
});
it('all 16 question types render and validate the same accepted answers in both clients', () => {
  const form = normalizeSignup({ enabled: true, pageSize: 20, questions: [
    { id: 'text', type: 'text', format: 'email' }, { id: 'textarea', type: 'textarea' },
    { id: 'single', type: 'single', options: ['A', 'B'] }, { id: 'multiple', type: 'multiple', options: ['A', 'B'] },
    { id: 'select', type: 'select', options: ['A', 'B'] }, { id: 'number', type: 'number', min: -2, max: 2, step: 0.5 },
    { id: 'date', type: 'date' }, { id: 'time', type: 'time' }, { id: 'rating', type: 'rating' }, { id: 'nps', type: 'nps' },
    { id: 'ranking', type: 'ranking', options: ['A', 'B'] },
    { id: 'matrix', type: 'matrix', rows: ['行1', '行2'], options: ['A', 'B'] },
    { id: 'matrixMultiple', type: 'matrixMultiple', rows: ['行1'], options: ['A', 'B'] },
    { id: 'blanks', type: 'blanks', rows: ['子题'] },
    { id: 'group', type: 'group', minEntries: 1, maxEntries: 2, fields: [{ id: 'name', label: '姓名', type: 'text', required: true, options: [] }] },
    { id: 'description', type: 'description' },
  ].map(q => ({ label: q.id, required: true, options: [], ...q })) });
  const answers: Answers = { text: 'test@example.invalid', textarea: '演示说明', single: 'B', multiple: ['A', 'B'], select: 'A', number: '-1.5', date: '2024-02-29', time: '23:59', rating: '5', nps: '0', ranking: ['B', 'A'], matrix: { 行1: 'A', 行2: 'B' }, matrixMultiple: { 行1: ['A', 'B'] }, blanks: { 子题: '填写内容' }, group: [{ name: '演示成员' }] };
  expect(native.validateAnswers(form, answers)).toEqual(validateAnswers(form, answers));
  const view = native.presentation(form, answers, 0, 'stable');
  expect(view.questions).toHaveLength(16);
  expect(view.completed).toBe(15);
  expect(view.questions.find((q: { type: string }) => q.type === 'group').entries[0].fields[0].value).toBe('演示成员');
  expect(native.receipt({ questions: form.questions, answers }).rows.find((q: { id: string }) => q.id === 'matrix').answer).toBe(formatAnswer(answers.matrix, form.questions[11]));
  for (const id of Object.keys(answers)) {
    expect(() => native.validateAnswers(form, { ...answers, [id]: undefined })).toThrow();
  }
});
it('team bounds, incomplete sixth member and hidden-answer clearing agree with the server', () => {
  expect(native.validateAnswers(teamForm, teamAnswers)).toEqual(validateAnswers(teamForm, teamAnswers));
  for (const count of [4, 7]) expect(() => native.validateAnswers(teamForm, { ...teamAnswers, team: members(count) })).toThrow();
  expect(() => native.validateAnswers(teamForm, { ...teamAnswers, team: [...members(5), {}] })).toThrow('第 6 条');
  const switched = native.changeAnswer(teamForm, teamAnswers, 'mode', '个人报名');
  expect(switched).not.toHaveProperty('team');
  expect(switched).not.toHaveProperty('teamName');
  expect(native.presentation(teamForm, teamAnswers, 0, 'stable').questions.find((q: { id: string }) => q.id === 'team').entries).toHaveLength(5);
  expect(native.initialAnswers(teamForm, { ...teamAnswers, unknown: 'discard' })).toEqual(teamAnswers);
});
it('native compound jumps, early ending and pagination use the current answer path', () => {
  const form = normalizeSignup({ enabled: true, pageSize: 2, questions: [
    { id: 'mode', label: '分支', type: 'single', required: true, options: ['结束', '跳转', '继续'], jumps: [{ when: { mode: 'all', rules: [{ questionId: 'mode', operator: 'equals', value: '结束' }] }, target: '$end' }, { when: { mode: 'any', rules: [{ questionId: 'mode', operator: 'equals', value: '跳转' }] }, target: 'last' }] },
    { id: 'detail', label: '明细', type: 'text', required: true, options: [] },
    { id: 'last', label: '最后', type: 'text', required: true, options: [] },
  ] });
  for (const mode of ['结束', '跳转', '继续']) expect(native.questionRoute(form, { mode })).toEqual(questionRoute(form, { mode }));
  const ending = native.changeAnswer(form, { mode: '继续', detail: '旧内容', last: '旧内容' }, 'mode', '结束');
  expect(ending).toEqual({ mode: '结束' });
  expect(native.presentation(form, ending, 10, 'stable')).toMatchObject({ step: 0, answerPages: 1, answerTotal: 1 });
  expect(native.presentation(form, { mode: '跳转' }, 0, 'stable').branchNotice).toContain('跳过中间 1 题');
});

type Receipt = { id: number; createdAt: string; updatedAt: string; formVersion: string; questions: SignupForm['questions']; answers: Answers };
type Event = { currentTarget: { dataset: Record<string, string | number> }; detail: { value: string | string[] } };
type MiniPage = {
  data: { [key: string]: unknown; form: SignupForm; answers: Answers; receipt: Receipt; questions: { id: string; entries?: unknown[] }[]; review: boolean; responseEditing: boolean; message: string; answerErrors: Record<string, string> };
  setData(data: unknown): void; onLoad(options: unknown): void; load(): Promise<void>;
  editAnswers(): void; answer(event: Event): void; answerNext(): void;
  addEntry(event: Event): void; removeEntry(event: Event): void; groupAnswer(event: Event): void; submit(): Promise<void>;
};
function pageHarness(form: SignupForm, saved: Receipt | null) {
  let page!: MiniPage;
  const request = vi.fn().mockResolvedValue({ title: '本地演示', form, version: 'form-v1', state: '报名开放', canManage: false, loggedIn: true, signup: saved });
  const actualRequire = createRequire(new URL('../miniprogram/src/pages/signup/index.js', import.meta.url));
  runInNewContext(readFileSync('miniprogram/src/pages/signup/index.js', 'utf8'), {
    Page: (value: MiniPage) => { page = value; },
    require: (name: string) => name.endsWith('/http') ? { request } : name.endsWith('/session') ? { user: () => ({ id: 5 }) } : name.endsWith('/page') ? { actions: {}, protect: () => true, error: (p: MiniPage, e: Error) => p.setData({ loading: false, error: e.message }) } : actualRequire(name),
    wx: { setNavigationBarTitle: vi.fn(), pageScrollTo: vi.fn() },
  });
  page.setData = data => Object.assign(page.data, data);
  page.onLoad({ kind: 'events', id: '55' });
  return { page, request };
}
const event = (id: string, value: string | string[] = '', extra: Record<string, string | number> = {}): Event => ({ currentTarget: { dataset: { id, ...extra } }, detail: { value } });
it('native edit starts from the saved roster, leaves the receipt intact and failed resubmission keeps changes', async () => {
  const saved: Receipt = { id: 12, createdAt: '2026-10-11T01:00:00Z', updatedAt: '2026-10-11T01:00:00Z', formVersion: 'form-v1', questions: teamForm.questions, answers: teamAnswers };
  const { page, request } = pageHarness(teamForm, saved);
  await page.load();
  expect(request).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ questionnaire: true }));
  page.editAnswers();
  expect(page.data.answers).toEqual(teamAnswers);
  page.groupAnswer(event('team', '修改后的成员', { index: 0, field: 'name' }));
  expect(page.data.receipt.answers).toEqual(teamAnswers);
  expect(request).toHaveBeenCalledTimes(1);
  page.addEntry(event('team'));
  page.answerNext();
  expect(page.data.review).toBe(false);
  expect(page.data.answerErrors.team).toContain('第 6 条');
  page.removeEntry(event('team', '', { index: 5 }));
  page.answerNext();
  expect(page.data.review).toBe(true);
  request.mockRejectedValueOnce(new Error('连接失败，请重试'));
  await page.submit();
  expect(page.data.message).toContain('连接失败');
  expect(page.data.responseEditing).toBe(true);
  expect((page.data.answers.team as { name: string }[])[0].name).toBe('修改后的成员');
  expect(page.data.receipt.answers).toEqual(teamAnswers);
  const updated = { ...saved, updatedAt: '2026-10-11T02:00:00Z', answers: page.data.answers };
  request.mockResolvedValueOnce({ signup: updated, message: '作答修改已保存' });
  await page.submit();
  expect(request).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ method: 'PATCH', questionnaire: true, data: expect.objectContaining({ revision: saved.updatedAt }) }));
  expect(page.data.responseEditing).toBe(false);
  expect(page.data.receipt.answers).toEqual(updated.answers);
});
