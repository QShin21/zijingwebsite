import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Mini program REST pages in English: text comes from the V2 read by id; nothing is added.
function load(locale: string, get: (path: string, query: Record<string, unknown>) => Promise<unknown>) {
  const file = path.resolve('miniprogram/src/lib/english-overlay.js');
  const module = { exports: {} as Record<string, (...args: unknown[]) => Promise<unknown>> };
  runInNewContext(readFileSync(file, 'utf8'), { module, exports: module.exports,
    require: (name: string) => name === './v2' ? { get } : name === './i18n' ? { t: (zh: string) => zh, locale: () => locale } : {} });
  return module.exports;
}
const rest = [{ id: 1, title: '合成新闻一', summary: '摘要一', slug: 'a' }, { id: 2, title: '合成新闻二', summary: '摘要二', slug: 'b' }];

describe('mini program English overlay', () => {
  it('makes no request in Chinese mode', async () => {
    const get = vi.fn();
    expect(await load('zh', get).list('news', rest)).toBe(rest);
    expect(await load('zh', get).detail('albums', rest[0])).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
  it('replaces only records already on the page, by id, keeping every other field', async () => {
    const get = vi.fn(async () => ({ hasNextPage: false, docs: [
      { kind: 'article', item: { ref: { type: 'news', id: 2 }, title: 'News two', summary: 'Summary two' } },
      { kind: 'article', item: { ref: { type: 'news', id: 99 }, title: 'Not on this page', summary: null } },
      { kind: 'showcase', item: { ref: { type: 'showcase', id: 1 }, title: 'Wrong type' } },
    ] }));
    const out = await load('en', get).list('news', rest) as typeof rest;
    expect(out).toEqual([rest[0], { ...rest[1], title: 'News two', summary: 'Summary two' }]);
    expect(get).toHaveBeenCalledWith('feed', { kind: 'news', page: 1, limit: 50 }, { required: true });
  });
  it('reads at most three V2 pages and falls back to Chinese on failure', async () => {
    const get = vi.fn(async () => ({ hasNextPage: true, docs: [] }));
    const out = await load('en', get).list('teams', rest);
    expect(out).toEqual(rest);
    expect(get).toHaveBeenCalledTimes(3);
    const failing = vi.fn(async () => { throw new Error('network'); });
    expect(await load('en', failing).list('games', rest)).toEqual(rest);
  });
  it('detail views take English title, summary and body from the matching V2 detail', async () => {
    const body = { root: { type: 'root', children: [] } };
    const get = vi.fn(async (pathName: string) => pathName.startsWith('articles/album/')
      ? { article: { title: 'Album', summary: 'Album summary' }, body }
      : { card: { team: { title: 'Team one' }, summary: 'Team summary' }, body });
    const overlay = load('en', get);
    expect(await overlay.detail('albums', { id: 3, slug: 'gallery-3', title: '合成影像' })).toEqual({ title: 'Album', summary: 'Album summary', body });
    expect(get).toHaveBeenLastCalledWith('articles/album/gallery-3', {}, { required: true });
    expect(await overlay.detail('teams', { id: 8, slug: 'team-8', title: '合成一队' })).toEqual({ title: 'Team one', summary: 'Team summary', body });
    expect(await overlay.detail('honors', { id: 1 })).toBeNull();
  });
});
