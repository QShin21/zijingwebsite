import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve('miniprogram/src');
type Wx = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- CommonJS mini program modules are untyped.
type Mod = Record<string, any>;

// Loads native CommonJS modules in one sandbox that shares a synthetic `wx`.
function sandbox(storage = new Map<string, unknown>(), extra: Wx = {}) {
  const wx: Wx = {
    getStorageSync: (key: string) => storage.get(key) ?? '',
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
    removeStorageSync: (key: string) => { storage.delete(key); },
    setNavigationBarTitle: vi.fn(),
    ...extra,
  };
  const cache = new Map<string, Mod>();
  function load(file: string): Mod {
    const resolved = file.endsWith('.js') ? file : file + '.js';
    if (cache.has(resolved)) return cache.get(resolved)!.exports;
    const module = { exports: {} as Mod };
    cache.set(resolved, module);
    runInNewContext(readFileSync(resolved, 'utf8'), {
      module, exports: module.exports, wx, console, setTimeout, clearTimeout,
      require: (name: string) => load(path.resolve(path.dirname(resolved), name)),
    }, { filename: resolved });
    return module.exports;
  }
  return { wx, storage, load: (relative: string) => load(path.join(root, relative)) };
}

describe('mini program locale core', () => {
  it('defaults to Chinese, persists English and falls back to Chinese text', () => {
    const first = sandbox();
    const i18n = first.load('lib/i18n');
    expect(i18n.locale()).toBe('zh');
    expect(i18n.t('报名', 'Sign-up')).toBe('报名');
    const seen: string[] = [];
    const off = i18n.subscribe((value: string) => seen.push(value));
    expect(i18n.setLocale('en')).toMatchObject({ locale: 'en', persisted: true });
    off();
    i18n.setLocale('zh');
    expect(seen).toEqual(['en']);
    i18n.setLocale('en');
    expect(first.storage.get('zijing_locale')).toBe('en');

    const restarted = sandbox(first.storage).load('lib/i18n');
    expect(restarted.locale()).toBe('en');
    expect(restarted.t('报名', 'Sign-up')).toBe('Sign-up');
    expect(restarted.t('报名', '')).toBe('报名');
    expect(restarted.t('报名')).toBe('报名');
    expect(restarted.text({ a: ['甲', 'A'], b: ['乙'] })).toEqual({ a: 'A', b: '乙' });
    expect(restarted.message('请先登录可用账号')).toBe('Please sign in with an active account.');
    expect(restarted.message('昵称：请输入有效邮箱地址')).toBe('昵称: Enter a valid email address.');
    expect(restarted.message('未知的服务端提示')).toBe('未知的服务端提示');
  });

  it('ignores invalid stored values and storage failures', () => {
    expect(sandbox(new Map([['zijing_locale', 'fr']]))
      .load('lib/i18n').locale()).toBe('zh');
    const broken = sandbox(new Map(), { getStorageSync: () => { throw new Error('synthetic'); }, setStorageSync: () => { throw new Error('synthetic'); } });
    const i18n = broken.load('lib/i18n');
    expect(i18n.locale()).toBe('zh');
    expect(i18n.setLocale('en')).toMatchObject({ locale: 'en', persisted: false });
    expect(i18n.locale()).toBe('en');
  });

  it('binds page text, re-applies on change and unbinds', () => {
    const i18n = sandbox().load('lib/i18n');
    const page = { data: {} as Mod, setData(value: Record<string, unknown>) { Object.assign(this.data, value); } };
    i18n.bind(page, { hello: ['你好', 'Hello'] });
    expect(page.data.t.hello).toBe('你好');
    expect(page.data.t.cRetry).toBe('重新加载');
    i18n.setLocale('en');
    expect(page.data).toMatchObject({ locale: 'en', t: { hello: 'Hello', cRetry: 'Reload' } });
    i18n.unbind(page);
    i18n.setLocale('zh');
    expect(page.data.t.hello).toBe('Hello');
  });
});

describe('locale header on native requests', () => {
  it.each(['zh', 'en'])('sends x-zijing-locale=%s on requests and uploads', async locale => {
    const request = vi.fn((_options: Mod) => {}), uploadFile = vi.fn((_options: Mod) => ({}));
    const box = sandbox(new Map<string, unknown>([['zijing_locale', locale], ['zijing-miniapp-session-v1', {
      token: 'synthetic-token', exp: Math.floor(Date.now() / 1000) + 3600, user: { id: 1, name: '合成用户', roles: [] } }]]), { request, uploadFile });
    const http = box.load('lib/http');
    const pending = http.request('/api/v2/events', { required: true });
    const sent = request.mock.calls[0][0];
    expect(sent.header).toMatchObject({ 'x-zijing-locale': locale, Authorization: 'JWT synthetic-token' });
    sent.success({ statusCode: 200, data: { ok: true } });
    await expect(pending).resolves.toEqual({ ok: true });
    http.upload('/api/media', 'wxfile://synthetic.png').catch(() => {});
    expect(uploadFile.mock.calls[0][0].header).toMatchObject({ 'x-zijing-locale': locale });
  });

  it('keeps Chinese errors in Chinese mode and translates them in English mode', async () => {
    for (const [locale, expected] of [['zh', '请先登录'], ['en', 'Please sign in first.']]) {
      const http = sandbox(new Map([['zijing_locale', locale]]), { request: vi.fn() }).load('lib/http');
      await expect(http.request('/api/me', { required: true })).rejects.toThrow(expected);
    }
    const request = vi.fn((_options: Mod) => {});
    const http = sandbox(new Map([['zijing_locale', 'en']]), { request }).load('lib/http');
    const pending = http.request('/api/x', { auth: false });
    request.mock.calls[0][0].fail();
    await expect(pending).rejects.toThrow('Connection failed. Check your network and try again.');
  });
});

describe('questionnaire display labels keep canonical answer values', () => {
  const raw = {
    enabled: true, closed: false, start: '', end: '', intro: '说明', pageSize: 10,
    questions: [
      { id: 'pick', label: '常用位置', type: 'single', required: true, randomize: true, options: ['上单', '打野', '中路', '辅助'] },
      { id: 'many', label: '可参加时段', type: 'multiple', required: false, options: ['周六', '周日'] },
      { id: 'grid', label: '熟练度', type: 'matrix', required: true, rows: ['对线', '团战'], options: ['一般', '熟练'] },
      { id: 'crew', label: '队友', type: 'group', required: true, minEntries: 1, maxEntries: 3,
        fields: [{ id: 'role', label: '角色', type: 'select', required: true, options: ['队长', '队员'] }, { id: 'name', label: '昵称', type: 'text', required: true }] },
    ],
  };
  const display = {
    locale: 'en', title: 'Trial', intro: 'Intro',
    questions: {
      pick: { label: 'Main role', options: [['辅助', 'Support'], ['上单', 'Top'], ['打野', 'Jungle']] },
      many: { label: 'Days', options: [['周日', 'Sunday']] },
      grid: { label: 'Skill', rows: [['团战', 'Teamfight'], ['对线', 'Laning']], options: [['熟练', 'Skilled'], ['一般', 'Average']] },
      crew: { label: 'Teammates', fields: { role: { label: 'Role', options: [['队员', 'Member'], ['队长', 'Captain']] } } },
    },
  };
  function setup(locale: string) {
    const box = sandbox(new Map([['zijing_locale', locale]]));
    const q = box.load('lib/questionnaire');
    return { q, form: q.normalizeSignup(raw) };
  }

  it('shows English labels by canonical value, including shuffled options', () => {
    const { q, form } = setup('en');
    for (const seed of ['seed-a', 'seed-b', 'seed-c']) {
      const view = q.presentation(form, {}, 0, seed, {}, display);
      const pick = view.questions.find((item: Mod) => item.id === 'pick');
      expect(pick.label).toBe('Main role');
      const byValue = Object.fromEntries(pick.choices.map((choice: Mod) => [choice.value, choice.label]));
      expect(byValue).toEqual({ 上单: 'Top', 打野: 'Jungle', 中路: '中路', 辅助: 'Support' });
      expect([...pick.choices.map((choice: Mod) => choice.value)].sort()).toEqual([...form.questions[0].options].sort());
    }
    const view = q.presentation(form, {}, 0, 'seed', {}, display);
    const grid = view.questions.find((item: Mod) => item.id === 'grid');
    expect(grid.matrixRows.map((row: Mod) => [row.key, row.label])).toEqual([['对线', 'Laning'], ['团战', 'Teamfight']]);
    expect(grid.matrixRows[0].choices.map((choice: Mod) => [choice.value, choice.label])).toEqual([['一般', 'Average'], ['熟练', 'Skilled']]);
    const crew = view.questions.find((item: Mod) => item.id === 'crew');
    const role = crew.entries[0].fields.find((field: Mod) => field.id === 'role');
    expect(role.label).toBe('Role');
    expect(role.pickerValues).toEqual(['', '队长', '队员']);
    expect(role.pickerLabels).toEqual(['Choose', 'Captain', 'Member']);
  });

  it('submits and validates the original Chinese values and renders English receipts', () => {
    const { q, form } = setup('en');
    let answers = q.changeAnswer(form, {}, 'pick', '辅助');
    answers = q.changeAnswer(form, answers, 'many', ['周日']);
    answers = q.changeAnswer(form, answers, 'grid', { 对线: '熟练', 团战: '一般' });
    answers = q.changeAnswer(form, answers, 'crew', [{ role: '队长', name: '合成昵称' }]);
    const submitted = q.validateAnswers(form, answers);
    expect(submitted).toEqual({ pick: '辅助', many: ['周日'], grid: { 对线: '熟练', 团战: '一般' }, crew: [{ role: '队长', name: '合成昵称' }] });
    const rows = q.receipt({ questions: form.questions, answers: submitted }, display).rows;
    expect(rows.map((row: Mod) => [row.label, row.answer])).toEqual([
      ['Main role', 'Support'], ['Days', 'Sunday'], ['Skill', 'Laning: Skilled\nTeamfight: Average'], ['Teammates', 'Entry 1: Role: Captain; 昵称: 合成昵称'],
    ]);
    const errors = q.presentation(form, {}, 0, 's', q.answerErrors(form, {}), display).questions.find((item: Mod) => item.id === 'pick').error;
    expect(errors).toBe('Main role: Check required answers, length or options.');
  });

  it('keeps Chinese output unchanged and ignores English display in Chinese mode', () => {
    const { q, form } = setup('zh');
    const view = q.presentation(form, {}, 0, 'seed', {}, display);
    const pick = view.questions.find((item: Mod) => item.id === 'pick');
    expect(pick.label).toBe('常用位置');
    expect(pick.choices.every((choice: Mod) => choice.label === choice.value)).toBe(true);
    const rows = q.receipt({ questions: form.questions, answers: { pick: '辅助', grid: { 对线: '熟练', 团战: '一般' } } }, display).rows;
    expect(rows.map((row: Mod) => row.answer)).toEqual(['辅助', '对线：熟练\n团战：一般']);
    expect(q.receipt({ questions: form.questions, answers: { pick: '辅助' } }, 0).rows[0]).toMatchObject({ label: '常用位置', answer: '辅助' });
  });
});

// Every `t.key` in a WXML file must exist in both languages so no raw key or empty text renders.
function literal(source: string, marker: RegExp): Record<string, unknown> | null {
  const match = marker.exec(source);
  if (!match) return null;
  let depth = 0, quote = '', i = match.index + match[0].length - 1;
  const start = i;
  for (; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '\'' || c === '"' || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return new Function('return ' + source.slice(start, i + 1))();
}
function keys(wxml: string) { return [...new Set([...wxml.matchAll(/\bt\.([A-Za-z_]\w*)/g)].map(m => m[1]))]; }
function checkDict(name: string, dict: Record<string, unknown>) {
  for (const [key, pair] of Object.entries(dict)) {
    expect(Array.isArray(pair), `${name} ${key}`).toBe(true);
    const [zh, en] = pair as unknown[];
    expect(typeof zh === 'string' && zh.length > 0, `${name} ${key} zh`).toBe(true);
    expect(typeof en, `${name} ${key} en`).toBe('string');
    if (!en) expect(key, `${name} ${key} may only be empty as an affix`).toMatch(/(Prefix|Suffix)$/);
  }
}

describe('WXML text keys exist in both languages', () => {
  const common = sandbox().load('lib/i18n').common as Record<string, unknown>;
  it('shared template keys are defined in i18n.common', () => {
    checkDict('common', common);
    for (const file of readdirSync(path.join(root, 'templates')).filter(name => name.endsWith('.wxml'))) {
      for (const key of keys(readFileSync(path.join(root, 'templates', file), 'utf8'))) expect(common, `${file} t.${key}`).toHaveProperty(key);
    }
  });
  const pages = readdirSync(path.join(root, 'pages'));
  it.each(pages)('page %s', page => {
    const directory = path.join(root, 'pages', page);
    const wxml = readFileSync(path.join(directory, 'index.wxml'), 'utf8');
    const js = readFileSync(path.join(directory, 'index.js'), 'utf8');
    const dict = literal(js, /const\s+text\s*=\s*\{/);
    expect(dict, `${page} has a text dictionary`).not.toBeNull();
    expect(js).toMatch(/i18n\.bind\(this,\s*text\)/);
    checkDict(page, dict!);
    for (const key of keys(wxml)) expect({ ...common, ...dict }, `${page} t.${key}`).toHaveProperty(key);
  });
  it('privacy consent component keys', () => {
    const directory = path.join(root, 'components', 'privacy-consent');
    if (!existsSync(path.join(directory, 'index.wxml'))) return;
    const dict = literal(readFileSync(path.join(directory, 'index.js'), 'utf8'), /const\s+text\s*=\s*\{/);
    expect(dict).not.toBeNull();
    checkDict('privacy-consent', dict!);
    for (const key of keys(readFileSync(path.join(directory, 'index.wxml'), 'utf8'))) expect(dict, key).toHaveProperty(key);
  });
});
