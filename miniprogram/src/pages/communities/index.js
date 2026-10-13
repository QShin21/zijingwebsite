function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
Page(withVisualTheme({
  data: { loading: false, error: '', needsLogin: false, user: null, docs: [], page: 1, hasMore: false,
    clubLoading: false, clubError: '', staffBatches: [], promotions: [] },
  ...actions,
  onLoad() {
    this._visible = true; this._identity = identity(); wx.setNavigationBarTitle({ title: '加入我们' });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this.invalidate(); this.resetPrivate(); }
    });
  },
  invalidate() { this._scope = (this._scope || 0) + 1; },
  valid(scope, required = true) { return this._visible !== false && scope === (this._scope || 0) && this._identity === identity() && (!required || Boolean(identity())); },
  resetPrivate() { this.setData({ user: session.user(), needsLogin: !session.user(), docs: [], page: 1, hasMore: false, loading: false, error: '', clubLoading: false }); },
  onShow() {
    this._visible = true;
    if (this._identity !== identity()) { this._identity = identity(); this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this.invalidate(); this.setData({ loading: false, clubLoading: false }); },
  onUnload() { this.onHide(); if (this._unsubscribe) this._unsubscribe(); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) return this.load(true); },
  load(more = false) { return more ? this.loadGames(true) : Promise.all([this.loadGames(), this.retryClub()]); },
  async loadGames(more = false) {
    if (more && (this.data.loading || !this.data.hasMore)) return;
    if (!protect(this)) { this.resetPrivate(); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1, page = more ? this.data.page + 1 : 1;
    this.setData({ loading: true, error: '' });
    try {
      const result = await cms.list('games', { page, limit: 24 });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      const docs = await cms.decorate(result.docs);
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      const combined = (more ? this.data.docs : []).concat(docs);
      this.setData({ loading: false, docs: combined.filter((doc, index) => combined.findIndex(value => String(value.id) === String(doc.id)) === index), page: result.page || page, hasMore: Boolean(result.hasNextPage) });
    } catch (cause) { if (this.valid(scope) && ticket === this._loadTicket) this.setData({ loading: false, error: cause.message }); }
  },
  async retryClub() {
    if (this.data.clubLoading) return;
    const scope = this._scope || 0, ticket = this._clubTicket = (this._clubTicket || 0) + 1;
    this.setData({ clubLoading: true, clubError: '' });
    try {
      const result = await http.request('/api/miniapp/club', { auth: false });
      if (!this.valid(scope, false) || ticket !== this._clubTicket) return;
      const promotions = [];
      for (const kind of ['event', 'notice', 'showcase']) for (const doc of result.promotions && result.promotions[kind] || [])
        promotions.push({ ...doc, kindText: kind === 'event' ? '社团活动' : kind === 'notice' ? '社团通知' : '社团风采' });
      this.setData({ staffBatches: result.staffBatches || [], promotions, clubLoading: false });
    } catch (cause) { if (this.valid(scope, false) && ticket === this._clubTicket) this.setData({ clubLoading: false, clubError: cause.message }); }
  },
  openCommunity(event) { const doc = event.currentTarget.dataset.doc; if (doc && navigation.requireUser()) navigation.go('community', { id: doc.id, slug: doc.slug }); },
  apply() { if (navigation.requireUser()) navigation.go('applications', { apply: 1 }); },
  applications() { if (navigation.requireUser()) navigation.go('applications'); },
  staff() { navigation.go('staff'); },
  applyStaff(event) { navigation.go('signup', { kind: 'staff', id: event.currentTarget.dataset.id }); },
}));
