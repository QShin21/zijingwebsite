function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const v2 = require('../../lib/v2');
const images = require('../../lib/v2-images');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');

// V2 社群目录 (GET /api/v2/communities). Guests see the login wall; the
// server keeps the member-only rule regardless of this page.
Page(withVisualTheme({
  data: { user: null, needsLogin: false, q: '', input: '', docs: [], page: 0, hasMore: false, total: 0, loading: false, loadingMore: false, error: '', loadMoreError: '', img: {} },
  ...actions,
  onLoad() {
    // Account change (logout or switch): drop the previous account's directory and ignore its late replies.
    this._unsubscribe = session.subscribe(user => {
      this._ticket = (this._ticket || 0) + 1;
      this._loaded = false;
      this._identity = user ? String(user.id) : '';
      this.setData({ user: user || null, needsLogin: !user, docs: [], page: 0, hasMore: false, total: 0, loading: false, loadingMore: false, error: '', loadMoreError: '', img: {} });
      if (user && this._visible) this.load();
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
    if (this._identity === identity && this._loaded) return;
    this._identity = identity;
    this.setData({ user, needsLogin: !user, docs: [], error: '' });
    if (user) return this.load();
  },
  onHide() { this._visible = false; this._ticket = (this._ticket || 0) + 1; this.setData({ loading: false, loadingMore: false }); },
  onPullDownRefresh() { return (this.data.user ? this.load() : Promise.resolve()).then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.user && this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  retry() { return this.load(); },
  register() { navigation.go('auth', { mode: 'register' }); },
  typing(event) { this.setData({ input: String(event.detail.value || '').slice(0, 80) }); },
  search() { if (this.data.loading) return; this.setData({ q: this.data.input.trim() }); return this.load(); },
  clear() { this.setData({ q: '', input: '' }); return this.load(); },
  apply() { navigation.go('applications', { apply: 1 }); },
  async load(more) {
    if (more && (this.data.loadingMore || !this.data.hasMore)) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const alive = () => ticket === this._ticket && this._visible !== false;
    const page = more ? this.data.page + 1 : 1;
    this.setData(more ? { loadingMore: true, loadMoreError: '' } : { loading: true, error: '' });
    try {
      const result = await v2.get('communities', { q: this.data.q, page, limit: 24 }, { required: true });
      if (!alive()) return;
      const seen = more ? this.data.docs.map(doc => doc.key) : [];
      const fresh = result.docs.map(v2.community).filter(doc => !seen.includes(doc.key));
      images.attach(this, fresh, alive);
      this._loaded = true;
      this.setData({ docs: more ? this.data.docs.concat(fresh) : fresh, page: result.page, hasMore: result.hasNextPage, total: result.totalDocs, loading: false, loadingMore: false });
    } catch (cause) {
      if (!alive()) return;
      if (cause && cause.status === 401) { this.setData({ user: null, needsLogin: true, loading: false, loadingMore: false }); return; }
      if (more) this.setData({ loadingMore: false, loadMoreError: (cause && cause.message) || '加载更多失败' });
      else this.setData({ loading: false, error: (cause && cause.message) || '社群目录暂时无法加载' });
    }
  },
  onShareAppMessage() { return { title: '紫荆游戏社群', path: '/pages/communities/index' }; },
}));
