// V2 主场 loader: GET /api/v2/home → presentation view. Called lazily by
// pages/home so startup failures stay visible and retryable.
const v2 = require('./v2');
const images = require('./v2-images');
const session = require('./session');

function chrome() {
  try {
    const info = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const statusBar = info.statusBarHeight || 20;
    return { statusBar, navHeight: menu && menu.height ? (menu.top - statusBar) * 2 + menu.height : 44 };
  } catch { return { statusBar: 20, navHeight: 44 }; }
}
// Server fills missing blocks (home-sections.ts); this fallback only covers an older server during rollout.
const DEFAULT_SECTIONS = [
  { kind: 'upcoming', title: '接下来的赛程' }, { kind: 'open', title: '正在招募' }, { kind: 'notices', title: '社团公告' },
  { kind: 'promoted', title: '社团精选' }, { kind: 'communities', title: '游戏社群' }, { kind: 'highlights', title: '赛场高光' }, { kind: 'about', title: '关于紫荆' },
];
function sections(value) {
  if (!Array.isArray(value)) return DEFAULT_SECTIONS.map(section => ({ kind: section.kind, title: section.title }));
  return value.filter(section => section && section.enabled !== false && DEFAULT_SECTIONS.some(entry => entry.kind === section.kind))
    .map(section => ({ kind: section.kind, title: section.title || DEFAULT_SECTIONS.find(entry => entry.kind === section.kind).title }));
}
function promoted(value) {
  const source = value || {};
  const events = (source.events || []).map(v2.event), notices = (source.notices || []).map(v2.article), showcases = (source.showcases || []).map(v2.showcase);
  return { events, notices, showcases, count: events.length + notices.length + showcases.length };
}
function view(home) {
  return {
    sections: sections(home.sections),
    promoted: promoted(home.promoted),
    today: v2.today(home.today),
    title: home.site.heroTitle || '',
    subtitle: home.site.heroSubtitle || '一起玩，认真赢。社团活动、游戏社群、代表队与骨干招新，都在这里开场。',
    spotlight: home.spotlight ? v2.event(home.spotlight) : null,
    upcoming: home.upcoming.map(v2.event),
    openSignups: home.openSignups.map(v2.event),
    calls: home.openCalls.map(v2.recruitment),
    notices: home.notices.map(v2.article),
    highlights: home.highlights ? home.highlights.map(v2.feed) : null,
    communities: home.communities ? home.communities.map(v2.community) : null,
    me: home.me, about: home.about && home.about.excerpt ? home.about.excerpt : '',
    signedIn: Boolean(home.viewer), name: home.viewer ? home.viewer.name : '', footer: home.site.footer || '',
  };
}
async function load(page) {
  const ticket = page._ticket = (page._ticket || 0) + 1;
  const alive = () => page._ticket === ticket && page._nativeVisible !== false;
  page.setData({ loading: true, error: '', user: session.user(), ...chrome() });
  try {
    const data = await v2.get('home');
    if (!alive()) return;
    const home = view(data);
    images.attach(page, [home.spotlight].concat(home.upcoming, home.openSignups, home.promoted.events, home.promoted.showcases,
      home.highlights || [], home.communities || []).filter(Boolean), alive);
    page.setData({ loading: false, home });
  } catch (cause) {
    if (alive()) page.setData({ loading: false, error: (cause && cause.message) || '主场暂时无法加载，请重试' });
  }
}
module.exports = { load, view, chrome, sections };
