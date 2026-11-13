import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const root = 'miniprogram/src/';
const read = (name: string) => readFileSync(root + name, 'utf8');
const app = JSON.parse(read('app.json')) as { pages: string[]; tabBar: { list: { pagePath: string }[] } };

function navigationHarness(depth = 1) {
  const wx = { switchTab: vi.fn(), navigateTo: vi.fn(), navigateBack: vi.fn(), setClipboardData: vi.fn() };
  const module = { exports: {} as { back(): void; website(path: string): void; open(path: string, webOnly: boolean): void } };
  runInNewContext(read('lib/navigation.js'), { module, wx, getCurrentPages: () => Array.from({ length: depth }, () => ({})),
    require: (name: string) => name === './session' ? { user: () => null } : name === '../config' ? { origin: 'https://synthetic.invalid' } : { safeURL: () => false } });
  return { navigation: module.exports, wx };
}

describe('Native rebuild: route and rendering contracts, not an official WeChat compiler', () => {
  it('keeps every existing native route (explore as a redirect) and the five V2 tabs', () => {
    // 28 V2 routes plus the native activity seating page (member map + reviewer workbench).
    expect(app.pages).toHaveLength(29);
    for (const route of ['detail', 'list', 'fixed', 'community', 'signup', 'team', 'team-honors', 'staff', 'explore'])
      expect(app.pages).toContain('pages/' + route + '/index');
    for (const route of ['teams', 'team-home', 'recruitment', 'showcase-new', 'activity-seating']) expect(app.pages).toContain('pages/' + route + '/index');
    expect(app.tabBar.list.map(tab => tab.pagePath)).toEqual(['home', 'events', 'communities', 'teams', 'account'].map(name => 'pages/' + name + '/index'));
    expect(app.tabBar.list.map(tab => (tab as unknown as { text: string }).text)).toEqual(['主场', '日程', '社群', '代表队', '我的']);
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
    expect(read('lib/theme.js')).toContain('...generated.tokens');
    expect(read('app.wxss')).toContain('min-height: 44px');
    expect(read('app.wxss')).toContain('env(safe-area-inset-bottom)');
    for (const route of app.pages) {
      for (const input of read(route + '.wxml').matchAll(/<(input|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)) expect(input[0], route).toContain('cursor-spacing="24"');
    }
    expect(read('templates/questionnaire.wxml')).toContain('themePrimary');
    expect(read('pages/signup/index.wxml')).toContain('question,busy,theme,themePrimary,themeMuted');
  });
  it('V2 tab pages use the shared API and bundled homepage art', () => {
    for (const route of ['home', 'events', 'communities', 'teams', 'account']) {
      expect(read('pages/' + route + '/index.wxml'), route).toContain('<import src="../../templates/v2.wxml" />');
    }
    expect(read('lib/home.js')).toContain("v2.get('home')");
    expect(read('pages/events/index.js')).toContain("v2.get('calendar'");
    expect(read('pages/communities/index.js')).toContain("v2.get('communities'");
    expect(read('pages/account/index.js')).toContain("v2.get('me'");
    expect(app.tabBar).toMatchObject({ custom: true });
    expect(read('pages/home/index.wxml')).toContain('src="{{scene}}"');
    expect(JSON.parse(read('pages/home/index.json'))).toMatchObject({ navigationStyle: 'custom' });
  });
  it('rebuilt inner pages use the V2 hero frame and no longer use the retired thin-line page classes', () => {
    const inner = ['detail', 'list', 'fixed', 'auth', 'community', 'signup', 'applications', 'review', 'staff', 'staff-review', 'activity-manage',
      'team', 'team-apply', 'team-review', 'team-members', 'team-honors', 'team-profiles', 'team-honor-workspace', 'team-honor-edit', 'showcase-new', 'activity-seating'];
    for (const route of inner) {
      const markup = read('pages/' + route + '/index.wxml');
      expect(markup, route).toMatch(/class="zj-hero[" ]/);
      expect(markup, route).not.toMatch(/class="page mini-page native-page|business-page native-page|class="plain back"/);
    }
    for (const template of ['common', 'native', 'native-content', 'club']) expect(read('templates/' + template + '.wxml'), template).toContain('zj-');
  });
  it('maps V2 website paths to the new native destinations', () => {
    const h = navigationHarness();
    h.navigation.website('/teams'); expect(h.wx.switchTab).toHaveBeenCalledWith({ url: '/pages/teams/index' });
    h.navigation.website('/teams/recruitment'); expect(h.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/recruitment/index' });
    h.navigation.website('/teams/synthetic-team'); expect(h.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/team-home/index?slug=synthetic-team' });
    h.navigation.website('/community/synthetic-game/showcase/new'); expect(h.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/showcase-new/index?slug=synthetic-game' });
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
    ['/activities/events/31/seating', '/pages/activity-seating/index?kind=events&id=31&mode=review'],
    ['/activities/community-posts/47/seating', '/pages/activity-seating/index?kind=community-posts&id=47&mode=review'],
    ['/community/synthetic-game/updates/47#activity-seating', '/pages/activity-seating/index?kind=community-posts&id=47'],
    ['/events/synthetic-event#activity-seating', '/pages/detail/index?collection=events&slug=synthetic-event'],
  ])('maps the existing website deep link %s to its native flow', (path, url) => {
    const h = navigationHarness(); h.navigation.website(path); expect(h.wx.navigateTo).toHaveBeenCalledWith({ url });
  });
  it.each([
    ['/teams/apply#team-applications-title', '/pages/team-apply/index'],
    ['/teams/apply#my-establishment-applications', '/pages/team-apply/index'],
    ['/community/apply#my-applications-title', '/pages/applications/index'],
    ['/community/apply#my-applications', '/pages/applications/index'],
    ['/community/apply#application-form-title', '/pages/applications/index?apply=1'],
  ])('normalizes the historical receipt anchor %s (ApplicationItem.href) to its native apply page', (path, url) => {
    const h = navigationHarness(); h.navigation.website(path);
    expect(h.wx.navigateTo).toHaveBeenCalledWith({ url }); expect(h.wx.setClipboardData).not.toHaveBeenCalled();
  });
  it('decides web-only destinations from the server webOnly field; unmapped site paths still offer the web link', () => {
    const h = navigationHarness();
    h.navigation.open('/community/promotions?view=review', true);
    expect(h.wx.setClipboardData).toHaveBeenLastCalledWith(expect.objectContaining({ data: 'https://synthetic.invalid/community/promotions?view=review' }));
    // webOnly:false follows the native mapping (no client-side path whitelist).
    h.navigation.open('/teams/apply#team-applications-title', false);
    expect(h.wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/team-apply/index' });
    // Old share links without a native page keep working by copying the web link.
    for (const path of ['/activities', '/admin', '/community/promotions']) {
      h.navigation.website(path);
      expect(h.wx.setClipboardData).toHaveBeenLastCalledWith(expect.objectContaining({ data: 'https://synthetic.invalid' + path }));
    }
    // Static /community segments are never treated as community slugs.
    expect(h.wx.navigateTo).not.toHaveBeenCalledWith({ url: '/pages/community/index?slug=promotions' });
    h.navigation.open('//cross-origin.invalid/x', true);
    expect(h.wx.setClipboardData).toHaveBeenCalledTimes(4);
  });
  it('native queues, todos and applications take webOnly from the server contract (no key or path whitelist)', () => {
    const account = read('pages/account/index.js');
    expect(account).toContain('queue.webOnly === true'); expect(account).toContain('item.webOnly === true');
    expect(account).not.toContain("['promotions', 'activities', 'cms']");
    expect(read('lib/navigation.js')).not.toContain('activities|admin|community\\/promotions');
    expect(read('lib/v2.js')).toContain('web: item.webOnly === true');
    expect(read('templates/v2.wxml')).toMatch(/class="zj-application"[^>]*bindtap="openTarget"[^>]*data-web="\{\{item\.web\}\}"/);
    expect(read('pages/account/index.wxml')).toMatch(/bindtap="openTodo"[^>]*data-web="\{\{item\.web\}\}"/);
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
