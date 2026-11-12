import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeSignup, validateAnswers, type Answers } from '../src/lib/signup-schema';
import { questionRoute } from '../src/lib/questionnaire-flow';
import { formatAnswer, sanitizeDraft } from '../src/lib/questionnaire-model';

// Preserves the server half of miniapp-questionnaire. Only the immutable
// synthetic questionnaire fixture is read; no client runtime is imported.
const teamForm = normalizeSignup(JSON.parse(readFileSync('tests/fixtures/questionnaire-team-draft.json', 'utf8')));
const members = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `演示成员${i + 1}`, student: `202600${i + 1}`, game: `演示ID${i + 1}`, position: '上单' }));
const teamAnswers = { mode: '团队报名', teamName: '本地演示队', team: members(5), contact: '13800138000' };


describe('V2保留：服务端16题型、名单边界与条件路径', () => {
  it('服务端表单限制200KB且合成表单可规范化往返', () => {
    expect(normalizeSignup(teamForm)).toEqual(teamForm);
    expect(() => normalizeSignup({ ...teamForm, intro: '大'.repeat(70000) })).toThrow('200 KB');
  });
  it('全部16题型接受合成答案，任一必填答案缺失均拒绝', () => {
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
    expect(new Set(form.questions.map(q => q.type)).size).toBe(16);
    expect(validateAnswers(form, answers)).toEqual(answers);
    expect(formatAnswer(answers.matrix, form.questions[11])).toBe('行1：A\n行2：B');
    for (const id of Object.keys(answers)) expect(() => validateAnswers(form, { ...answers, [id]: undefined })).toThrow();
  });
  it('五至六人名单全量验证，第六人缺失字段和四/七人越界均拒绝', () => {
    expect(validateAnswers(teamForm, teamAnswers)).toEqual(teamAnswers);
    expect(validateAnswers(teamForm, { ...teamAnswers, team: members(6) }).team).toHaveLength(6);
    for (const count of [4, 7]) expect(() => validateAnswers(teamForm, { ...teamAnswers, team: members(count) })).toThrow();
    expect(() => validateAnswers(teamForm, { ...teamAnswers, team: [...members(5), {}] })).toThrow('第 6 条');
    expect(sanitizeDraft(teamForm, { ...teamAnswers, unknown: 'discard' })).toEqual(teamAnswers);
  });
  it('切换个人报名时不保存隐藏的队伍名称/名单或未知答案', () => {
    const personal = { ...teamAnswers, mode: '个人报名', name: '合成个人', student: '20260101', game: '合成ID', position: '上单', unknown: 'discard' };
    expect(() => validateAnswers(teamForm, personal)).toThrow('报名表已变化');
    const saved = validateAnswers(teamForm, sanitizeDraft(teamForm, personal));
    expect(saved).not.toHaveProperty('team'); expect(saved).not.toHaveProperty('teamName'); expect(saved).not.toHaveProperty('unknown');
    expect(saved).toMatchObject({ mode: '个人报名', name: '合成个人', position: '上单' });
  });
  it('复合跳转与提前结束只验证并返回当前可达路径', () => {
  const form = normalizeSignup({ enabled: true, pageSize: 2, questions: [
    { id: 'mode', label: '分支', type: 'single', required: true, options: ['结束', '跳转', '继续'], jumps: [{ when: { mode: 'all', rules: [{ questionId: 'mode', operator: 'equals', value: '结束' }] }, target: '$end' }, { when: { mode: 'any', rules: [{ questionId: 'mode', operator: 'equals', value: '跳转' }] }, target: 'last' }] },
    { id: 'detail', label: '明细', type: 'text', required: true, options: [] },
    { id: 'last', label: '最后', type: 'text', required: true, options: [] },
  ] });
    const expected = { 结束: ['mode'], 跳转: ['mode', 'last'], 继续: ['mode', 'detail', 'last'] };
    for (const mode of ['结束', '跳转', '继续'] as const) {
      const route = questionRoute(form, { mode });
      expect(route.questions.map(q => q.id)).toEqual(expected[mode]);
    }
    expect(validateAnswers(form, { mode: '结束', detail: '旧内容', last: '旧内容' })).toEqual({ mode: '结束' });
    expect(validateAnswers(form, { mode: '跳转', detail: '旧内容', last: '合成尾题' })).toEqual({ mode: '跳转', last: '合成尾题' });
    expect(questionRoute(form, { mode: '跳转' }).jumps).toMatchObject([{ from: 'mode', target: 'last', skipped: 1 }]);
  });
});
