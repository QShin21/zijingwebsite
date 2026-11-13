function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const v2 = require('../../lib/v2');
const images = require('../../lib/v2-images');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
const text = {
  eyebrow: ['SCHEDULE · 日程', 'SCHEDULE'], title: ['日程', 'Schedule'],
  subtitleUser: ['查看可参与的社团和社群活动。', 'See club and community events you can join.'],
  subtitleGuest: ['浏览公开活动，登录后报名。', 'Browse public events; sign in to sign up.'],
  scopeAll: ['全部', 'All'], scopeClub: ['社团', 'Club'], scopeCommunity: ['社群', 'Communities'], scopeMine: ['已报名', 'Signed up'],
  rangeLabel: ['活动时间', 'Event time'], upcoming: ['即将开始', 'Upcoming'], past: ['已结束', 'Ended'],
  selectedSuffix: ['，已选中', ', selected'], unselectedSuffix: ['，未选中', ', not selected'],
  signupOpen: ['可报名', 'Open for sign-up'], loginToView: ['登录后查看', 'Sign in to view'],
  loadingMore: ['加载中…', 'Loading…'], retryMore: ['重试加载更多', 'Retry loading more'], loadMore: ['加载更多', 'Load more'],
  mineEmptyTitle: ['还没有报名记录', 'No sign-ups yet'], mineEmptyBody: ['报名开放的活动会标注「报名开放」。', 'Events open for sign-up are marked “Sign-up open”.'],
  mineEmptyAction: ['查看全部活动', 'View all events'],
  pastEmptyTitle: ['暂无已结束的活动', 'No past events'], upcomingEmptyTitle: ['近期暂无安排', 'Nothing scheduled soon'],
  emptyBody: ['新的活动确认后会出现在这里。', 'New events will appear here once confirmed.'],
};
const scopes = ['all', 'club', 'community', 'mine'];

// V2 日程: one timeline for club and community events (GET /api/v2/calendar).
Page(withVisualTheme({
  data: { scope: 'all', range: 'upcoming', signupOpen: false, docs: [], groups: [], page: 0, hasMore: false, loading: true, loadingMore: false, error: '', loadMoreError: '', img: {}, user: null },
  ...actions,
  onLoad() {
    i18n.bind(this, text);
    // Account change: private "已报名" results of the previous account are dropped and late replies ignored.
    this._unsubscribe = session.subscribe(user => {
      this._ticket = (this._ticket || 0) + 1;
      this._loaded = false;
      this._identity = user ? String(user.id) : '';
      this.setData({ user: user || null, scope: !user && this.data.scope === 'mine' ? 'all' : this.data.scope, docs: [], groups: [], page: 0, hasMore: false, loading: false, loadingMore: false, error: '', loadMoreError: '', img: {} });
      if (this._visible) this.load();
    });
  },
  onUnload() {
    this._visible = false;
    this._ticket = (this._ticket || 0) + 1;
    if (this._unsubscribe) this._unsubscribe();
    i18n.unbind(this);
  },
  onShow() {
    // Language changed while hidden: reload so script-built labels and translated content follow.
    const relocalized = (i18n.refreshIfStale ? i18n.refreshIfStale(this) : false);
    i18n.navTitle('活动与通知', 'Events & notices');
    this._visible = true;
    const user = session.user(), identity = user ? String(user.id) : '';
    if (this._identity !== identity || !this._loaded || relocalized) {
      this._identity = identity;
      this.setData({ user, scope: !user && this.data.scope === 'mine' ? 'all' : this.data.scope });
      return this.load();
    }
  },
  onHide() { this._visible = false; this._ticket = (this._ticket || 0) + 1; this.setData({ loading: false, loadingMore: false }); },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  retry() { return this.load(); },
  onLocaleChange() { if (this._loaded && this._visible) this.load(); },
  register() { navigation.go('auth', { mode: 'register' }); },
  async load(more) {
    if (more && (this.data.loadingMore || !this.data.hasMore)) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const alive = () => ticket === this._ticket && this._visible !== false;
    const page = more ? this.data.page + 1 : 1;
    this.setData(more ? { loadingMore: true, loadMoreError: '' } : { loading: true, error: '', loadMoreError: '' });
    try {
      // signupOpen is filtered server-side before pagination (GET /api/v2/calendar?signupOpen=1).
      const query = { scope: this.data.scope, range: this.data.range, page, limit: 20 };
      if (this.data.signupOpen) query.signupOpen = 1;
      const result = await v2.get('calendar', query, { required: this.data.scope === 'mine' });
      if (!alive()) return;
      const seen = more ? this.data.docs.map(doc => doc.key) : [];
      const fresh = result.docs.map(v2.event).filter(doc => !seen.includes(doc.key));
      images.attach(this, fresh, alive);
      const docs = more ? this.data.docs.concat(fresh) : fresh;
      this._loaded = true;
      this.setData({ docs, groups: v2.groupByDay(docs), page: result.page, hasMore: result.hasNextPage, loading: false, loadingMore: false, error: '', loadMoreError: '' });
    } catch (cause) {
      if (!alive()) return;
      const message = (cause && cause.message) || i18n.t('日程暂时无法加载', 'The schedule could not be loaded');
      if (more) this.setData({ loadingMore: false, loadMoreError: message });
      else this.setData({ loading: false, error: message, docs: [], groups: [], hasMore: false, needsLogin: cause && cause.status === 401 });
    }
  },
  setScope(event) {
    const scope = event.currentTarget.dataset.scope;
    if (!scopes.includes(scope) || scope === this.data.scope || this.data.loading) return;
    if (scope === 'mine' && !session.user()) return navigation.login();
    this.setData({ scope, docs: [], groups: [] });
    return this.load();
  },
  setRange(event) {
    const range = event.currentTarget.dataset.range;
    if (!['upcoming', 'past'].includes(range) || range === this.data.range || this.data.loading) return;
    this.setData({ range, docs: [], groups: [] });
    return this.load();
  },
  toggleSignupOpen() {
    if (this.data.loading) return;
    this.setData({ signupOpen: !this.data.signupOpen, docs: [], groups: [] });
    return this.load();
  },
  onShareAppMessage() { return { title: i18n.t('紫荆日程', 'Zijing schedule'), path: '/pages/events/index' }; },
}));
