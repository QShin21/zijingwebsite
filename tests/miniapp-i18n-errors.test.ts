import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// Stable English for uncommon server errors in the mini program (display only; contract unchanged).
function load() {
  const root = path.resolve('miniprogram/src/lib'), storage = new Map<string, unknown>(), cache = new Map<string, { exports: Record<string, unknown> }>();
  const wx = { getStorageSync: (key: string) => storage.get(key) ?? '', setStorageSync: (key: string, value: unknown) => storage.set(key, value), setNavigationBarTitle() {} };
  function require(file: string): Record<string, unknown> {
    const resolved = path.resolve(root, file.endsWith('.js') ? file : file + '.js');
    if (cache.has(resolved)) return cache.get(resolved)!.exports;
    const module = { exports: {} as Record<string, unknown> };
    cache.set(resolved, module);
    runInNewContext(readFileSync(resolved, 'utf8'), { module, exports: module.exports, wx, console, require: (name: string) => require(path.resolve(path.dirname(resolved), name)) });
    return module.exports;
  }
  return require('i18n') as { setLocale: (value: string) => void; error: (message: string, status: number) => string };
}

describe('mini program error display', () => {
  it('keeps Chinese mode unchanged and gives English a stable sentence with the original detail', () => {
    const i18n = load();
    expect(i18n.error('某个少见的业务提示', 409)).toBe('某个少见的业务提示');
    i18n.setLocale('en');
    expect(i18n.error('请先登录可用账号', 401)).toBe('Please sign in with an active account.');
    expect(i18n.error('某个少见的业务提示', 409)).toBe('The content was updated or already handled. Refresh and try again. (某个少见的业务提示)');
    expect(i18n.error('某个少见的业务提示', 503)).toBe('The service is temporarily unavailable. Please try again later. (某个少见的业务提示)');
    expect(i18n.error('Plain English', 400)).toBe('Plain English');
  });
});
