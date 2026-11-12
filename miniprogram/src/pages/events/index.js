function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const v2 = require('../../lib/v2');
const images = require('../../lib/v2-images');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
const scopes = ['all', 'club', 'community', 'mine'];

// V2 日程: one timeline for club and community events (GET /api/v2/calendar).
Page(withVisualTheme({
  data: { scope: 'all', range: 'upcoming', signupOpen: false, docs: [], groups: [], page: 0, hasMore: false, loading: true, loadingMore: false, error: '', loadMoreError: '', img: {}, user: null },
  ...actions,
  onLoad() {
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
  },
  onShow() {
    this._visible = true;
    const user = session.user(), identity = user ? String(user.id) : '';
    if (this._identity !== identity || !this._loaded) {
      this._identity = identity;
      this.setData({ user, scope: !user && this.data.scope === 'mine' ? 'all' : this.data.scope });
      return this.load();
    }
  },
  onHide() { this._visible = false; this._ticket = (this._ticket || 0) + 1; this.setData({ loading: false, loadingMore: false }); },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  retry() { return this.load(); },
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
      const message = (cause && cause.message) || '日程暂时无法加载';
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
  onShareAppMessage() { return { title: '紫荆日程', path: '/pages/events/index' }; },
}));
