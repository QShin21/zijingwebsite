import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

/*
 * Language switching on pages that are not in the foreground: labels update at once,
 * script-built text and translated questionnaire labels refresh when the page is shown
 * again, without losing unsubmitted answers, repeating writes or adding subscriptions.
 */
const root = path.resolve('miniprogram/src');
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- CommonJS mini program modules are untyped.
type Mod = Record<string, any>;

function harness(overrides: Record<string, Mod> = {}) {
  const storage = new Map<string, unknown>();
  const stack: Mod[] = [];
  const wx = {
    getStorageSync: (key: string) => storage.get(key) ?? '', setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
    removeStorageSync: (key: string) => { storage.delete(key); }, setNavigationBarTitle: vi.fn(), showToast: vi.fn(),
    getSystemInfoSync: () => ({ theme: 'light' }), onThemeChange: vi.fn(), getAppBaseInfo: () => ({ theme: 'light' }),
  };
  const cache = new Map<string, { exports: Mod }>();
  let definition: Mod | null = null;
  function load(file: string): Mod {
    const resolved = file.endsWith('.js') ? file : file + '.js';
    const key = path.relative(root, resolved).split(path.sep).join('/');
    if (overrides[key]) return overrides[key];
    if (cache.has(resolved)) return cache.get(resolved)!.exports;
    const module = { exports: {} as Mod };
    cache.set(resolved, module);
    runInNewContext(readFileSync(resolved, 'utf8'), {
      module, exports: module.exports, wx, console, setTimeout, clearTimeout,
      getCurrentPages: () => stack.slice(), getApp: () => ({ globalData: {} }),
      Page: (value: Mod) => { definition = value; },
      require: (name: string) => load(path.resolve(path.dirname(resolved), name)),
    }, { filename: resolved });
    return module.exports;
  }
  function page(relative: string) {
    load(path.join(root, relative));
    const value = { ...definition!, data: JSON.parse(JSON.stringify(definition!.data)) } as Mod;
    value.setData = (patch: Record<string, unknown>) => {
      for (const [field, item] of Object.entries(patch)) {
        if (!field.includes('.')) { value.data[field] = item; continue; }
        const parts = field.split('.'); let target = value.data;
        for (const part of parts.slice(0, -1)) target = target[part] ??= {};
        target[parts.at(-1)!] = item;
      }
    };
    return value;
  }
  return { wx, stack, load: (relative: string) => load(path.join(root, relative)), page };
}

describe('locale core: visible and hidden pages', () => {
  it('runs onLocaleChange only on the foreground page and marks hidden pages once', () => {
    const h = harness();
    const i18n = h.load('lib/i18n');
    const make = () => ({ data: {} as Mod, setData(value: Mod) { Object.assign(this.data, value); }, onLocaleChange: vi.fn() });
    const shown = make(), hidden = make();
    i18n.bind(shown, { hello: ['你好', 'Hello'] });
    i18n.bind(hidden, { hello: ['你好', 'Hello'] });
    i18n.bind(hidden, { hello: ['你好', 'Hello'] }); // re-binding replaces, never duplicates
    h.stack.push(hidden, shown);
    i18n.setLocale('en');
    expect(shown.onLocaleChange).toHaveBeenCalledTimes(1);
    expect(hidden.onLocaleChange).not.toHaveBeenCalled();
    expect(hidden.data.t.hello).toBe('Hello'); // static labels follow at once
    expect(i18n.refreshIfStale(shown)).toBe(false);
    expect(i18n.refreshIfStale(hidden)).toBe(true);
    expect(i18n.refreshIfStale(hidden)).toBe(false);
    i18n.unbind(hidden);
    i18n.setLocale('zh');
    expect(i18n.refreshIfStale(hidden)).toBe(false);
    expect(shown.onLocaleChange).toHaveBeenCalledTimes(2);
  });
});

describe('signup page keeps answers across language switches', () => {
  const form = { enabled: true, questions: [{ id: 'sport', label: '喜欢的运动', type: 'single', required: true, options: ['足球', '篮球'] }] };
  const display = { locale: 'en', title: 'Synthetic form', questions: { sport: { label: 'Favorite sport', options: [['足球', 'Football'], ['篮球', 'Basketball']] } } };
  function setup() {
    let user: Mod | null = { id: 7, name: '合成用户', affiliation: 'tsinghua', roles: ['member'] };
    const listeners: ((value: Mod | null) => void)[] = [];
    const session = { user: () => user, token: () => (user ? 'synthetic-token' : ''), campus: () => true,
      subscribe: (fn: (value: Mod | null) => void) => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); } };
    const requests: { path: string; locale: string; method: string }[] = [];
    let release: (() => void) | null = null, gate = false;
    const locale = { current: (): string => 'zh' };
    const http = {
      request: async (pathName: string, options: Mod = {}) => {
        const current = locale.current();
        requests.push({ path: pathName, locale: current, method: options.method || 'GET' });
        if (gate) await new Promise<void>((resolve) => { release = resolve; });
        if (pathName.includes('seat')) return { receipt: null };
        return { title: current === 'en' ? 'Synthetic event' : '合成活动', form, version: 'v1', state: '报名开放', canManage: false, loggedIn: true,
          signup: null, ...(current === 'en' ? { display } : {}) };
      },
    };
    const h = harness({ 'lib/http.js': http, 'lib/session.js': session, 'lib/theme.js': { page: (value: Mod) => value } });
    const i18n = h.load('lib/i18n');
    locale.current = () => i18n.locale();
    const page = h.page('pages/signup/index.js');
    const switchUser = (value: Mod | null) => { user = value; listeners.slice().forEach((fn) => fn(value)); };
    return { h, i18n, page, requests, switchUser, hold: () => { gate = true; }, open: () => { gate = false; release?.(); } };
  }
  const shown = (page: Mod) => JSON.stringify(page.data.questions);
  const reads = (requests: { path: string; locale: string; method: string }[]) => requests.filter((item) => item.method === 'GET' && item.path.endsWith('/signup'));

  it('hidden switch to English: labels by canonical value on return, same answers, one read, no write', async () => {
    const { h, i18n, page, requests } = setup();
    h.stack.push(page);
    page.onLoad({ kind: 'events', id: '9' });
    await page.onShow();
    expect(shown(page)).toContain('足球');
    page.change('sport', '篮球');
    expect(page.data.answers).toEqual({ sport: '篮球' });
    // Leave for the account page and switch language there.
    page.onHide(); h.stack.push({ data: {} });
    i18n.setLocale('en');
    expect(reads(requests)).toHaveLength(1);
    expect(page.data.t.cRetry).toBe('Reload'); // static labels already English
    h.stack.pop();
    await page.onShow();
    await vi.waitFor(() => expect(shown(page)).toContain('Football'));
    expect(shown(page)).toContain('Basketball');
    expect(page.data.answers).toEqual({ sport: '篮球' }); // canonical value kept
    expect(reads(requests)).toHaveLength(2);
    expect(reads(requests)[1].locale).toBe('en');
    expect(requests.some((item) => item.method !== 'GET')).toBe(false);
    // Returning again without another switch does not read again.
    page.onHide(); await page.onShow();
    expect(reads(requests)).toHaveLength(2);
  });

  it('visible switch back to Chinese relabels at once without a read', async () => {
    const { h, i18n, page, requests } = setup();
    i18n.setLocale('en');
    h.stack.push(page);
    page.onLoad({ kind: 'events', id: '9' });
    await page.onShow();
    expect(shown(page)).toContain('Football');
    page.change('sport', '足球');
    const before = reads(requests).length;
    i18n.setLocale('zh');
    expect(shown(page)).toContain('足球');
    expect(shown(page)).not.toContain('Football');
    expect(page.data.answers).toEqual({ sport: '足球' });
    expect(reads(requests)).toHaveLength(before);
  });

  it('an account change during the language read discards the late reply', async () => {
    const { h, i18n, page, requests, switchUser, hold, open } = setup();
    h.stack.push(page);
    page.onLoad({ kind: 'events', id: '9' });
    await page.onShow();
    page.onHide(); h.stack.push({ data: {} });
    i18n.setLocale('en');
    h.stack.pop();
    hold();
    const showing = page.onShow();
    await vi.waitFor(() => expect(reads(requests)).toHaveLength(2));
    switchUser({ id: 8, name: '另一合成用户', affiliation: 'tsinghua', roles: ['member'] });
    open();
    await showing;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(page.data.info).toBeNull();
    expect(page.data.answers).toEqual({});
    expect(JSON.stringify(page.data)).not.toContain('Football');
  });
});

describe('tab pages that skip reloading on show', () => {
  it('events reloads once after a hidden language switch, not on every return', async () => {
    const session = { user: () => null, token: () => '', campus: () => false, subscribe: () => () => {} };
    const get = vi.fn(async () => ({ docs: [], page: 1, hasNextPage: false }));
    const h = harness({ 'lib/session.js': session, 'lib/theme.js': { page: (value: Mod) => value },
      'lib/v2.js': { get, groupByDay: () => [], event: (doc: Mod) => doc }, 'lib/v2-images.js': { attach: () => {} } });
    const i18n = h.load('lib/i18n');
    const page = h.page('pages/events/index.js');
    h.stack.push(page);
    page.onLoad();
    await page.onShow();
    expect(get).toHaveBeenCalledTimes(1);
    page.onHide(); await page.onShow();
    expect(get).toHaveBeenCalledTimes(1);
    page.onHide(); h.stack.push({ data: {} });
    i18n.setLocale('en');
    expect(get).toHaveBeenCalledTimes(1);
    h.stack.pop();
    await page.onShow();
    expect(get).toHaveBeenCalledTimes(2);
    expect(page.data.t.title).toBe('Schedule');
    page.onHide(); await page.onShow();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
