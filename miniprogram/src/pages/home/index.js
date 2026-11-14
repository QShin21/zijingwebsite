function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
// Loaded on first use so the home page registers before any business module (startup resilience).
let i18nModule = null;
function i18nLoad() {
  if (!i18nModule) { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') i18nModule = value; } catch { /* Fall back to Chinese. */ } }
  return i18nModule || { t: zh => zh, bind() {}, navTitle() {}, unbind() {} };
}
const i18n = { t: (zh, en) => i18nLoad().t(zh, en), bind: (page, dict) => i18nLoad().bind(page, dict), navTitle: (zh, en) => i18nLoad().navTitle(zh, en), unbind: page => i18nLoad().unbind(page) };
const text = {
  brand: ['竞在紫荆', 'Zijing Esports'], todayPrefix: ['今天 ', 'Today '], heroLead: ['竞在', 'Zijing '], heroAccent: ['紫荆', 'Esports'],
  heroSubtitle: ['一起玩，认真赢。', 'Play together, win for real.'], viewSchedule: ['查看日程', 'View schedule'],
  myTodo: ['我的待办', 'My to-dos'], mySignups: ['我的报名', 'My sign-ups'], login: ['登录', 'Sign in'],
  todo: ['待办', 'To-do'], signedUp: ['已报名', 'Signed up'], pending: ['待审核', 'Pending review'],
  itemsSuffix: [' 项', ' items'], eventsSuffix: [' 场', ' events'],
  spotlight: ['✦ 焦点活动', '✦ Spotlight'], joinTitle: ['注册后报名活动', 'Create an account to sign up for events'],
  register: ['注册账号', 'Create account'], loginExisting: ['已有账号，登录', 'Have an account? Sign in'],
  quiz: ['竞猜与抽奖', 'Quiz & prize draw'],
  fullSchedule: ['完整日程', 'Full schedule'], upcomingEmptyTitle: ['近期暂无安排', 'Nothing scheduled soon'],
  upcomingEmptyBody: ['活动发布后会显示在这里。', 'Events will appear here once published.'], browseCommunities: ['浏览社群', 'Browse communities'],
  trialsCenter: ['选拔中心', 'Trials center'], allAnnouncements: ['全部公告', 'All notices'],
  noticesEmpty: ['确认后的社团公告会在这里发布。', 'Confirmed club notices will be posted here.'],
  allCommunities: ['全部社群', 'All communities'], communitiesEmptyTitle: ['社群正在筹备', 'Communities in preparation'],
  communitiesEmptyBody: ['想组织新的游戏社群，可以提交组织申请。', 'Want to start a new game community? Submit an application.'],
  allNews: ['全部动态', 'All news'], aboutClub: ['了解社团', 'About the club'], footer: ['竞在紫荆 · 一起玩，认真赢。', 'Zijing Esports · Play together, win for real.'],
};
// V2 主场. Startup stays independent of business modules so failures remain visible.
Page(withVisualTheme({
  data: { loading: true, error: '', user: null, home: null, img: {}, statusBar: 20, navHeight: 44, modules: [],
    links: { about: { key: 'about' }, announcements: { collection: 'announcements' }, news: { collection: 'news' } } },
  onLoad: function () { i18n.bind(this, text); },
  onLocaleChange: function () { if (this._nativeVisible) this.load(); },
  onShow: function () { i18n.navTitle('竞在紫荆', 'Zijing Esports'); this._nativeVisible = true; return this.load(); },
  onHide: function () { this._nativeVisible = false; this._ticket = (this._ticket || 0) + 1; },
  onUnload: function () { this._nativeVisible = false; i18n.unbind(this); },
  onPullDownRefresh: function () { return this.load().then(function () { wx.stopPullDownRefresh(); }); },
  load: function () {
    this.setData({ loading: true, error: '' });
    return Promise.resolve().then(function () {
      return require('../../lib/home').load(this);
    }.bind(this)).catch(function () {
      this.setData({ loading: false, error: i18n.t('页面启动失败，请点击重试；若仍无法打开，请重新扫描最新预览码。', 'The page failed to start. Tap retry; if it still fails, scan the latest preview code again.') });
    }.bind(this));
  },
  retry: function () { return this.load(); },
  login: function () { wx.navigateTo({ url: '/pages/auth/index?mode=login' }); },
  register: function () { wx.navigateTo({ url: '/pages/auth/index?mode=register' }); },
  openQuiz: function () { wx.navigateTo({ url: '/pages/quiz/index' }); },
  openPage: function (event) { require('../../lib/navigation').go(event.currentTarget.dataset.page, event.currentTarget.dataset.params || {}); },
  openWebsite: function (event) { require('../../lib/navigation').website(event.currentTarget.dataset.url); },
  // V2 card images: one re-sign for an expired ticket, then the text fallback.
  imageError: function (event) { require('../../lib/v2-images').failed(this, event); },
  onShareAppMessage: function () { return { title: i18n.t('竞在紫荆', 'Zijing Esports'), path: '/pages/home/index' }; },
}));
