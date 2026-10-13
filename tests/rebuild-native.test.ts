import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const root = 'miniprogram/src/';
const read = (name: string) => readFileSync(root + name, 'utf8');
const app = JSON.parse(read('app.json')) as { pages: string[]; tabBar: { list: { pagePath: string }[] } };

function navigationHarness(depth = 1) {
  const wx = { switchTab: vi.fn(), navigateTo: vi.fn(), navigateBack: vi.fn(), setClipboardData: vi.fn() };
  const module = { exports: {} as { back(): void; website(path: string): void } };
  runInNewContext(read('lib/navigation.js'), { module, wx, getCurrentPages: () => Array.from({ length: depth }, () => ({})), require: (name: string) => name === './session' ? { user: () => null } : { safeURL: () => false } });
  return { navigation: module.exports, wx };
}

describe('Native rebuild: route and rendering contracts, not an official WeChat compiler', () => {
  it('keeps every existing native route and the five native tabs', () => {
    expect(app.pages).toHaveLength(25);
    expect(app.tabBar.list.map(tab => tab.pagePath)).toEqual(['home', 'events', 'communities', 'explore', 'account'].map(name => 'pages/' + name + '/index'));
    for (const route of app.pages) {
      const markup = read(route + '.wxml');
      expect(markup).toContain('<page-meta page-style="{{themePageStyle}}"');
      expect(markup).toContain('page mini-page');
      expect(read(route + '.js')).toContain('Page(withVisualTheme(');
      expect(markup).not.toMatch(/<web-view|zijing-stage\.webp|zijing-stage-light\.webp/);
    }
  });
  it('keeps native markup tags balanced after the structural rewrite', () => {
    const files = [...app.pages.map(route => route + '.wxml'), ...readdirSync(root + 'templates').filter(name => name.endsWith('.wxml')).map(name => 'templates/' + name), 'components/privacy-consent/index.wxml'];
    for (const file of files) {
      const stack: string[] = [];
      for (const match of read(file).matchAll(/<!--[\s\S]*?-->|<\/?([\w-]+)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)) {
        const [tag, name] = match;
        if (!name || tag.endsWith('/>')) continue;
        if (tag.startsWith('</')) expect(stack.pop(), file + ': ' + tag).toBe(name);
        else stack.push(name);
      }
      expect(stack, file).toEqual([]);
    }
  });
  it('uses shared tokens and native control spacing across all editable pages', () => {
    expect(read('lib/theme.js')).toContain("require('./design-tokens')");
    expect(read('lib/theme.js')).not.toMatch(/page: '#|primary: '#/);
    expect(read('app.wxss')).toContain('min-height: 44px');
    expect(read('app.wxss')).toContain('env(safe-area-inset-bottom)');
    for (const route of app.pages) {
      for (const input of read(route + '.wxml').matchAll(/<(input|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)) expect(input[0], route).toContain('cursor-spacing="24"');
    }
    expect(read('templates/questionnaire.wxml')).toContain('themePrimary');
    expect(read('pages/signup/index.wxml')).toContain('question,busy,theme,themePrimary,themeMuted');
  });
  it('returns to home when a native detail is opened alone or back fails', () => {
    const single = navigationHarness(); single.navigation.back();
    expect(single.wx.switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
    const stack = navigationHarness(2); stack.navigation.back();
    expect(stack.wx.navigateBack).toHaveBeenCalledWith(expect.objectContaining({ delta: 1, fail: expect.any(Function) }));
    stack.wx.navigateBack.mock.calls[0][0].fail();
    expect(stack.wx.switchTab).toHaveBeenCalledWith({ url: '/pages/home/index' });
  });
  it.each([
    ['/community/synthetic-game/join', '/pages/community/index?slug=synthetic-game&area=contacts'],
    ['/community/synthetic-game/updates', '/pages/community/index?slug=synthetic-game&area=updates'],
    ['/community/synthetic-game/showcase', '/pages/community/index?slug=synthetic-game&area=showcase'],
    ['/community/synthetic-game/showcase/team-honors/52', '/pages/team-honors/index?team=52'],
    ['/teams/honors?view=review&team=52&game=11', '/pages/team-honor-workspace/index?view=review&team=52&game=11'],
  ])('maps the existing website deep link %s to its native flow', (path, url) => {
    const h = navigationHarness(); h.navigation.website(path); expect(h.wx.navigateTo).toHaveBeenCalledWith({ url });
  });
});

type Pin = { id: number; title: string; count: number; latestTitle: string; latestDate: string };
function pinHarness(options: { empty?: boolean; fail?: number } = {}) {
  const cms = { list: vi.fn(async (_collection: string, { page }: { page: number }) => ({ docs: options.empty ? [] : page === 1 ? [{ id: 51 }] : [{ id: 52 }, { id: 53 }], hasNextPage: !options.empty && page === 1 })) };
  const honor = {
    id: (value: unknown) => typeof value === 'number' && value > 0 ? value : null,
    load: vi.fn(async (team: number) => {
      if (options.fail) throw Object.assign(new Error('synthetic read failure'), { status: options.fail });
      if (team === 53) throw Object.assign(new Error('No public archive'), { status: 404 });
      return { team: { id: team, title: '合成测试队伍 ' + team }, records: [{ title: '合成测试赛事荣誉', dateText: '2026-10-12', images: [{ source: 'synthetic-public-evidence', caption: 'evidence' }], videoHref: '/synthetic-evidence', author: 8001, reviewNote: 'must-not-project' }] };
    }),
  };
  const module = { exports: {} as { load(game: unknown, current?: () => boolean): Promise<Pin[]> } };
  runInNewContext(read('lib/community-honors.js'), { module, require: (name: string) => name === './cms' ? cms : honor });
  return { api: module.exports, cms, honor };
}
describe('Native community honor pins: existing public APIs, synthetic data only', () => {
  it('loads all published team pages and projects only public summary fields', async () => {
    const h = pinHarness(); const pins = await h.api.load(11);
    expect(h.cms.list.mock.calls).toEqual([['teams', { game: 11, limit: 50, page: 1 }], ['teams', { game: 11, limit: 50, page: 2 }]]);
    expect(pins.map(pin => pin.id)).toEqual([51, 52]);
    expect(pins[0]).toEqual({ id: 51, title: '合成测试队伍 51', count: 1, latestTitle: '合成测试赛事荣誉', latestDate: '2026-10-12' });
    expect(JSON.stringify(pins)).not.toMatch(/images|source|video|reviewNote|author|evidence|must-not-project/);
  });
  it('does not treat a weak network or access failure as an empty archive', async () => {
    for (const status of [401, 403, 500]) await expect(pinHarness({ fail: status }).api.load(11)).rejects.toMatchObject({ status });
    expect(await pinHarness({ fail: 404 }).api.load(11)).toEqual([]);
    expect(await pinHarness({ empty: true }).api.load(11)).toEqual([]);
  });
  it('does not start or continue reads for an expired page or account', async () => {
    const h = pinHarness(); expect(await h.api.load(11, () => false)).toEqual([]); expect(h.cms.list).not.toHaveBeenCalled();
    let active = true; h.cms.list.mockImplementation(async () => { active = false; return { docs: [{ id: 51 }], hasNextPage: true }; });
    expect(await h.api.load(11, () => active)).toEqual([]); expect(h.honor.load).not.toHaveBeenCalled();
    await expect(h.api.load('../11')).rejects.toThrow('社群入口无效');
  });
});
