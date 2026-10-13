function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const club = require('../../lib/club');
const session = require('../../lib/session');
const { actions, error, labels } = require('../../lib/page');
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, collection: '', title: '', docs: [], page: 1, hasMore: false,
    loadingMore: false, search: '', years: ['全部年份'], year: '全部年份', kinds: ['全部', '普通社员', '代表队选拔', '骨干招新'], kind: '全部', games: [{ id: '', title: '全部项目' }], gameIndex: 0 },
  ...actions,
  onLoad(options) {
    this.setData({ collection: options.collection, title: labels[options.collection] || '栏目' });
    wx.setNavigationBarTitle({ title: labels[options.collection] || '栏目' });
    const now = new Date().getFullYear();
    this.setData({ years: ['全部年份', ...Array.from({ length: 15 }, (_, i) => String(now - i))] });
    this._unsubscribe = session.subscribe(user => { this._ticket = (this._ticket || 0) + 1; this.setData({ loading: false, docs: [], games: [{ id: '', title: '全部项目' }], needsLogin: !user }); });
  },
  onShow() { this.load(); if (require('../../lib/session').user()) this.loadGames(); },
  onHide() { this._ticket = (this._ticket || 0) + 1; },
  onUnload() { this.onHide(); if (this._unsubscribe) this._unsubscribe(); },
  async loadGames() { try { const result = await cms.list('games', { limit: 50 }); this.setData({ games: [{ id: '', title: '全部项目' }, ...result.docs] }); } catch { /* Main query presents authentication errors. */ } },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  input(event) { this.setData({ search: event.detail.value }); },
  search() { this.load(); },
  changeYear(event) { this.setData({ year: this.data.years[Number(event.detail.value)] }); this.load(); },
  changeGame(event) { this.setData({ gameIndex: Number(event.detail.value) }); this.load(); },
  changeKind(event) { this.setData({ kind: event.currentTarget.dataset.kind }); this.load(); },
  retry() { this.load(); },
  async load(more = false) {
    if (more && (this.data.loading || this.data.loadingMore)) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    this.setData(more ? { loadingMore: true } : { loading: true, error: '', needsLogin: false, docs: [] });
    try {
      if (this.data.collection === 'club-showcase') {
        const value = await club.load();
        if (ticket === this._ticket) this.setData({ loading: false, loadingMore: false, docs: value.promotions.showcase || [], page: 1, hasMore: false });
        return;
      }
      const kind = { '普通社员': 'members', '代表队选拔': 'teams', '骨干招新': 'staff' }[this.data.kind];
      const result = await cms.list(this.data.collection, { page: more ? this.data.page + 1 : 1,
        search: this.data.search, kind,
        game: this.data.games[this.data.gameIndex] && this.data.games[this.data.gameIndex].id,
        year: this.data.collection === 'honors' && this.data.year !== '全部年份' ? this.data.year : undefined });
      const docs = await cms.decorate(result.docs);
      if (ticket !== this._ticket) return;
      this.setData({ loading: false, loadingMore: false, docs: more ? this.data.docs.concat(docs) : docs, page: result.page, hasMore: result.hasNextPage });
    } catch (cause) { if (ticket === this._ticket) { error(this, cause); this.setData({ loadingMore: false }); } }
  },
  onShareAppMessage() { return { title: `竞在紫荆 · ${this.data.title}`, path: `/pages/list/index?collection=${this.data.collection}` }; },
}));
