import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync('miniprogram/src/lib/theme.js', 'utf8');
type Mode = 'light' | 'dark';
type ThemePage = { data: Record<string, unknown>; setData(value: Record<string, unknown>): void; onLoad(...args: unknown[]): unknown; onShow(): unknown; onHide(): unknown; onUnload(): unknown; setVisualTheme(event: unknown): void };
type Theme = { KEY: string; get(): Mode; init(): Mode; set(value: string): { ok: boolean; persisted: boolean }; style(mode: Mode): string; page(definition: Record<string, unknown>): Record<string, unknown>; tokens: Record<Mode, Record<string, string>> };
function harness(storage = new Map<string, unknown>(), options: { readFails?: boolean; writeFails?: boolean; chromeFails?: boolean; itemFails?: boolean } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let systemReads = 0;
  const wx: Record<string, unknown> = {
    getStorageSync: (key: string) => { if (options.readFails) throw new Error('synthetic read failure'); return storage.get(key); },
    setStorageSync: (key: string, value: unknown) => { if (options.writeFails) throw new Error('synthetic write failure'); storage.set(key, value); },
    getSystemInfoSync: () => { systemReads++; return { theme: 'dark' }; },
    onThemeChange: () => { systemReads++; },
  };
  for (const name of ['setNavigationBarColor', 'setBackgroundColor', 'setBackgroundTextStyle', 'setTabBarStyle', 'setTabBarItem']) {
    wx[name] = (args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (options.chromeFails) throw new Error('synthetic native failure');
      if (name === 'setTabBarItem' && options.itemFails) { (args.fail as () => void)(); return; }
      (args.success as (() => void) | undefined)?.();
    };
  }
  const module = { exports: {} as Theme };
  runInNewContext(source, { module, wx });
  return { theme: module.exports, storage, calls, systemReads: () => systemReads };
}
function nativePage(theme: Theme, definition: Record<string, unknown> = {}) {
  const page = theme.page({ data: {}, ...definition }) as unknown as ThemePage;
  page.setData = update => Object.assign(page.data, update);
  return page;
}
describe('Explicit native light/dark appearance', () => {
  it('defaults to light without reading or subscribing to system dark mode', () => {
    const h = harness();
    expect(h.theme.init()).toBe('light');
    expect(h.systemReads()).toBe(0);
    expect(h.storage.size).toBe(0);
    expect(h.calls.find(c => c.name === 'setNavigationBarColor')?.args).toMatchObject({ frontColor: '#000000', backgroundColor: '#fffdf8', animation: { duration: 0 } });
  });
  it.each(['auto', 'system', '', null, { theme: 'dark' }])('ignores invalid stored preference %j and uses light', value => {
    const h = harness(new Map([['zijing_theme', value]]));
    expect(h.theme.get()).toBe('light');
    expect(h.systemReads()).toBe(0);
  });
  it('restores explicit dark and light after independent process starts', () => {
    const storage = new Map<string, unknown>();
    const first = harness(storage);
    expect(first.theme.set('dark')).toMatchObject({ ok: true, persisted: true });
    const restartedDark = harness(storage);
    expect(restartedDark.theme.init()).toBe('dark');
    expect(restartedDark.calls.find(c => c.name === 'setTabBarStyle')?.args).toMatchObject({ backgroundColor: '#17151c', selectedColor: '#cdb2fa' });
    restartedDark.theme.set('light');
    expect(harness(storage).theme.init()).toBe('light');
  });
  it('persists theme separately from account and privacy state', () => {
    const storage = new Map<string, unknown>([['synthetic-account', { id: 900001 }], ['synthetic-privacy', false]]);
    const h = harness(storage);
    h.theme.set('dark');
    expect(storage.get('synthetic-account')).toEqual({ id: 900001 });
    expect(storage.get('synthetic-privacy')).toBe(false);
    storage.delete('synthetic-account');
    expect(harness(storage).theme.get()).toBe('dark');
  });
  it('retains draft, consent, busy lock and request ticket across live switching and refresh', () => {
    const h = harness();
    const draft = { name: '合成修改', visible: false };
    let refreshes = 0;
    const page = nativePage(h.theme, { data: { draft, busy: true, contactConsent: false, error: '合成业务错误' }, onShow() { refreshes++; return 'original-result'; } });
    Object.assign(page, { _ticket: 44 });
    page.onLoad(); expect(page.onShow()).toBe('original-result');
    page.setVisualTheme({ currentTarget: { dataset: { theme: 'dark' } } });
    expect(page.data).toMatchObject({ theme: 'dark', busy: true, contactConsent: false, error: '合成业务错误' });
    expect(page.data.draft).toBe(draft);
    expect((page as unknown as { _ticket: number })._ticket).toBe(44);
    expect(page.onShow()).toBe('original-result');
    expect(refreshes).toBe(2);
    expect(page.data.theme).toBe('dark');
  });
  it('updates existing pages, initializes the next page, and detaches unloaded pages', () => {
    const h = harness();
    let unloads = 0;
    const first = nativePage(h.theme, { onUnload() { unloads++; } });
    const second = nativePage(h.theme);
    first.onLoad(); second.onLoad(); first.onUnload();
    h.theme.set('dark');
    expect(first.data.theme).toBe('light');
    expect(second.data.theme).toBe('dark');
    expect(nativePage(h.theme).data.theme).toBe('dark');
    expect(unloads).toBe(1);
  });
  it('shows a truthful save failure while keeping the current theme usable', () => {
    const h = harness(new Map(), { writeFails: true });
    const page = nativePage(h.theme);
    page.onLoad(); page.setVisualTheme({ currentTarget: { dataset: { theme: 'dark' } } });
    expect(page.data.theme).toBe('dark');
    expect(page.data.themeError).toContain('暂无法保存偏好');
    expect(page.data.themeNotice).toBe('');
    expect(harness(h.storage).theme.get()).toBe('light');
  });
  it('survives unavailable storage and native chrome APIs', () => {
    const h = harness(new Map(), { readFails: true, chromeFails: true });
    expect(h.theme.init()).toBe('light');
    const page = nativePage(h.theme);
    expect(() => page.onLoad()).not.toThrow();
    expect(() => page.onShow()).not.toThrow();
  });
  it('retries tab icon paint when the native tab bar was not ready', () => {
    const h = harness(new Map([['zijing_theme', 'dark']]), { itemFails: true });
    h.theme.init();
    const page = nativePage(h.theme); page.onLoad(); page.onShow();
    expect(h.calls.filter(c => c.name === 'setTabBarItem')).toHaveLength(15);
    expect(h.calls.find(c => c.name === 'setTabBarItem')?.args.selectedIconPath).toBe('/assets/home-dark-active.png');
  });
  it('rejects unrecognized modes and never writes a guessed preference', () => {
    const h = harness();
    expect(h.theme.set('system')).toMatchObject({ ok: false, persisted: false });
    expect(h.theme.get()).toBe('light');
    expect(h.storage.size).toBe(0);
  });
});
