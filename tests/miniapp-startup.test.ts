import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const source = (file: string) => readFileSync(`miniprogram/src/${file}`, 'utf8');
type StartupPage = { data: { loading: boolean; error: string; modules: unknown[] }; setData(data: unknown): void; onShow(): Promise<void>; load(): Promise<void>; retry(): Promise<void>; onShareAppMessage(): { title: string } };
type StartupApp = { onLaunch(): void };
describe('Mini Program startup resilience', () => {
  it('registers the home page before loading business modules and displays initialization failures', async () => {
    let page!: StartupPage; let imports = 0;
    runInNewContext(source('pages/home/index.js'), { Page: (value: StartupPage) => { page = value; }, Promise,
      require: (name: string) => { if (name.endsWith('/theme')) return { page: (value: StartupPage) => value }; imports++; throw new Error('compiled module unavailable'); } });
    expect(imports).toBe(0);
    page.setData = (data: unknown) => Object.assign(page.data, data);
    await page.onShow();
    expect(page.data.loading).toBe(false);
    expect(page.data.error).toContain('页面启动失败');
    expect(page.onShareAppMessage().title).toBe('竞在紫荆');
  });
  it('supports recovery by retrying module loading', async () => {
    let page!: StartupPage; let failed = true;
    runInNewContext(source('pages/home/index.js'), { Page: (value: StartupPage) => { page = value; }, Promise,
      require: (name: string) => { if (name.endsWith('/theme')) return { page: (value: StartupPage) => value }; if (failed) throw new Error('unavailable'); return { load: (target: StartupPage) => target.setData({ loading: false, modules: [{ kind: 'events' }] }) }; } });
    page.setData = (data: unknown) => Object.assign(page.data, data);
    await page.load(); failed = false; await page.retry();
    expect(page.data.error).toBe(''); expect(page.data.modules).toHaveLength(1);
  });
  it('does not stop application startup if session storage and file cleanup fail', () => {
    let app!: StartupApp;
    runInNewContext(source('app.js'), { App: (value: StartupApp) => { app = value; }, console: { warn() {} }, require: () => { throw new Error('storage unavailable'); } });
    expect(() => app!.onLaunch()).not.toThrow();
  });
  it('normalizes nested CMS text without changing URLs, credentials or the original response', () => {
    const module = { exports: {} as { display: (value: Record<string, unknown>) => { name: string; body: { text: string }[]; url: string; token: string; wechatQr: string } } }; runInNewContext(source('lib/brand.js'), { module });
    const raw = { name: '清华大学学生紫荆电竞社', body: [{ text: '紫荆电竞社通知' }], url: 'https://example.org/紫荆电竞社', token: '紫荆电竞社', wechatQr: 'data:image/png;base64,xxx' };
    const result = module.exports.display(raw);
    expect(result.name).toBe('竞在紫荆'); expect(result.body[0].text).toBe('竞在紫荆通知');
    expect(result.url).toBe(raw.url); expect(result.token).toBe(raw.token); expect(result.wechatQr).toBe(raw.wechatQr);
    expect(raw.name).toBe('清华大学学生紫荆电竞社');
  });
});
