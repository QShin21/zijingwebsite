import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { evaluateWxmlExpression } from '../scripts/wxml-preview-expression.mjs';

type Data = Record<string, unknown>;
type Picture = Data & { index: number; url?: string; failed?: boolean; type?: string };
type Page = {
  data: Data & { presentation: { ticket: number; images: Picture[]; blocks: Picture[] }; kinds: string[]; loading: boolean };
  setData(next: Data): void;
  onLoad(options: Data): void;
  onHide(): void;
  load(): Promise<void>;
  retry(): void;
  readingImageError(event: Data): void;
  setRange(event: Data): Promise<void>;
  changeKind(event: Data): void;
  clearFilters(): Promise<void>;
};

function makePage(name: string, dependencies: Data) {
  const filename = `miniprogram/src/pages/${name}/index.js`;
  const nativeRequire = createRequire(new URL('../' + filename, import.meta.url));
  let page!: Page;
  runInNewContext(readFileSync(filename, 'utf8'), {
    Page: (definition: Page) => { page = definition; },
    require: (key: string) => key in dependencies ? dependencies[key] : nativeRequire(key),
    wx: { setNavigationBarTitle: vi.fn() },
  });
  page.setData = next => Object.assign(page.data, next);
  return page;
}

const theme = { page: (page: Page) => page };
const frame = { actions: {}, labels: {}, error: (page: Page, cause: Error) => page.setData({ loading: false, error: cause.message }) };
const session = { user: () => null, subscribe: () => () => {}, campus: () => false };
const source = (name: string) => readFileSync(`miniprogram/src/pages/${name}/index.wxml`, 'utf8');
const attribute = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  if (!match) throw new Error(`Missing ${name} in ${tag}`);
  return match[1];
};
const rendered = (value: string, data: Data) => value.replace(/\{\{([\s\S]*?)\}\}/g, (_match, expression) => String(evaluateWxmlExpression(expression, data)));
const evaluate = (value: string, data: Data) => evaluateWxmlExpression(value.slice(2, -2), data);

function detail(mode: 'gallery' | 'article') {
  const images = [{ src: '/synthetic/a', alt: '合成甲' }, { src: '/synthetic/b', alt: '合成乙' }, { src: '/synthetic/a', alt: '重复甲' }];
  const publishedDetail = vi.fn().mockResolvedValue({ doc: { id: 10, title: '合成通知', body: '正文' }, images,
    presentation: { mode, blocks: [{ type: 'text', text: '正文' }, ...images.map(image => ({ type: 'image', image }))] } });
  const load = vi.fn(async (src: string) => src);
  const page = makePage('detail', { '../../lib/theme': theme, '../../lib/page': frame, '../../lib/session': session,
    '../../lib/cms': { publishedDetail }, '../../lib/v2-images': { media: async () => null, load } });
  page.onLoad({ collection: 'announcements', id: '10' });
  const fail = (role: string, index: number, url: string, ticket = page.data.presentation.ticket) =>
    page.readingImageError({ currentTarget: { dataset: { role, index, url, ticket } }, detail: { errMsg: 'synthetic decode failure' } });
  return { page, fail, load };
}

describe('详情配图失败与重新加载', () => {
  it.each(['gallery', 'article'] as const)('逐张隔离 %s 失败，并在重载后忽略同 URL 的旧回调', async mode => {
    const { page, fail, load } = detail(mode);
    await page.load();
    const field = mode === 'gallery' ? 'images' : 'blocks';
    const role = mode === 'gallery' ? 'publication-gallery' : 'publication-article';
    const offset = mode === 'gallery' ? 0 : 1;
    const original = page.data.presentation[field];
    const ticket = page.data.presentation.ticket;
    expect(original.map((item: Data) => item.index)).toEqual(mode === 'gallery' ? [0, 1, 2] : [0, 1, 2, 3]);
    fail(role, offset + 1, '/synthetic/old', ticket);
    expect(page.data.presentation[field]).toEqual(original);
    fail(role, offset + 1, '/synthetic/b', ticket);
    expect(page.data.presentation[field][offset + 1].failed).toBe(true);
    expect(page.data.presentation[field][offset].failed).toBeUndefined();
    expect(page.data.presentation[field][offset + 2].failed).toBeUndefined();
    fail(role, offset, '/synthetic/a', ticket);
    expect(page.data.presentation[field][offset].failed).toBe(true);
    expect(page.data.presentation[field][offset + 2].failed).toBeUndefined();

    page.retry();
    await vi.waitFor(() => expect(page.data.presentation?.ticket).toBeGreaterThan(ticket));
    const reloaded = page.data.presentation;
    expect(reloaded[field].every((item: Data) => !item.failed)).toBe(true);
    expect(load).toHaveBeenCalledTimes(4); // repeated source is loaded once per read
    fail(role, offset, '/synthetic/a', ticket);
    expect(page.data.presentation).toEqual(reloaded);
    page.onHide();
    fail(role, offset, '/synthetic/a', reloaded.ticket);
    expect(page.data.presentation).toEqual(reloaded);
  });

  it('配图绑定保留轮播位置，失败与空 URL 都展示可重载的文字反馈', () => {
    const wxml = source('detail');
    for (const role of ['publication-gallery', 'publication-article']) {
      const tag = wxml.match(new RegExp(`<image\\b[^>]*data-role="${role}"[^>]*/>`))?.[0];
      expect(tag).toBeTruthy();
      expect(attribute(tag!, 'binderror')).toBe('readingImageError');
      expect(attribute(tag!, 'data-index')).toBe('{{index}}');
      expect(attribute(tag!, 'data-ticket')).toBe('{{presentation.ticket}}');
      const condition = attribute(tag!, role === 'publication-gallery' ? 'wx:if' : 'wx:elif');
      expect(evaluate(condition, { item: { url: '/synthetic/a' } })).toBe(true);
      expect(evaluate(condition, { item: { url: '/synthetic/a', failed: true } })).toBe(false);
      expect(evaluate(condition, { item: { url: '' } })).toBeFalsy();
    }
    expect(wxml).toMatch(/swiper-item wx:for="\{\{presentation\.images\}\}" wx:key="index"/);
    expect(wxml.match(/\{\{t\.imageFailedReload\}\}/g)).toHaveLength(2);
    expect(wxml.match(/aria-role="alert"><text class="zj-small">\{\{t\.imageFailedReload\}\}<\/text><button class="secondary" bindtap="retry"/g)).toHaveLength(2);
    expect(readFileSync('miniprogram/src/pages/detail/index.js', 'utf8')).toContain("imageFailedReload: ['图片暂时无法显示，可重新加载内容。'");
  });
});

describe('单选筛选的读屏状态', () => {
  it('日程范围切换后同步两个选项的选中状态', async () => {
    const get = vi.fn().mockResolvedValue({ docs: [], page: 1, hasNextPage: false });
    const page = makePage('events', { '../../lib/theme': theme, '../../lib/page': frame, '../../lib/session': session,
      '../../lib/v2': { get, groupByDay: () => [] }, '../../lib/v2-images': { attach: () => {} } });
    page.onLoad({}); // binds the interface dictionary (Chinese by default)
    page.setData({ loading: false });
    const wxml = source('events');
    const tags = ['upcoming', 'past'].map(value => wxml.match(new RegExp(`<button\\b[^>]*data-range="${value}"[^>]*>`))![0]);
    const states = () => tags.map(tag => ({ role: attribute(tag, 'aria-role'), checked: evaluate(attribute(tag, 'aria-checked'), page.data),
      label: rendered(attribute(tag, 'aria-label'), page.data) }));
    expect(wxml).toContain('aria-role="radiogroup" aria-label="{{t.rangeLabel}}"');
    expect(rendered('{{t.rangeLabel}}', page.data)).toBe('活动时间');
    expect(states()).toEqual([{ role: 'radio', checked: true, label: '即将开始，已选中' }, { role: 'radio', checked: false, label: '已结束，未选中' }]);
    await page.setRange({ currentTarget: { dataset: { range: 'past' } } });
    expect(states()).toEqual([{ role: 'radio', checked: false, label: '即将开始，未选中' }, { role: 'radio', checked: true, label: '已结束，已选中' }]);
    expect(get).toHaveBeenCalledWith('calendar', expect.objectContaining({ range: 'past' }), expect.anything());
  });

  it('招新分类切换及清除筛选后，文字与选中状态保持一致', async () => {
    const cms = { list: vi.fn().mockResolvedValue({ docs: [], page: 1, hasNextPage: false }), decorate: async (docs: Data[]) => docs };
    const page = makePage('list', { '../../lib/theme': theme, '../../lib/page': frame, '../../lib/session': session, '../../lib/cms': cms });
    page.onLoad({ collection: 'recruitment' });
    const wxml = source('list');
    const tag = wxml.match(/<button\b[^>]*bindtap="changeKind"[^>]*>/)![0];
    // wx:for supplies both item and index (labels are localized per index).
    const states = () => page.data.kinds.map((item: string, index: number) => ({ item, checked: evaluate(attribute(tag, 'aria-checked'), { ...page.data, item, index }),
      label: rendered(attribute(tag, 'aria-label'), { ...page.data, item, index }) }));
    expect(wxml).toContain('aria-role="radiogroup" aria-label="{{t.kindAria}}"');
    expect(rendered('{{t.kindAria}}', page.data)).toBe('招新分类');
    expect(attribute(tag, 'aria-role')).toBe('radio');
    expect(states().filter((state: Data) => state.checked).map((state: Data) => state.item)).toEqual(['全部']);
    page.changeKind({ currentTarget: { dataset: { kind: '骨干招新' } } });
    await vi.waitFor(() => expect(page.data.loading).toBe(false));
    expect(cms.list).toHaveBeenCalledWith('recruitment', expect.objectContaining({ kind: 'staff' }));
    expect(states().filter((state: Data) => state.checked)).toEqual([{ item: '骨干招新', checked: true, label: '骨干招新，已选中' }]);
    await page.clearFilters();
    expect(states().filter((state: Data) => state.checked)).toEqual([{ item: '全部', checked: true, label: '全部，已选中' }]);
  });
});
