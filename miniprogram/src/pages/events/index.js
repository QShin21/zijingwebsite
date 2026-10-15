function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const club = require('../../lib/club');
const native = require('../../lib/native-presentation');
const { actions, error } = require('../../lib/page');
Page(withVisualTheme({
  data: { loading: true, error: '', mode: 'events', types: ['全部', '比赛', '观赛', '交流', '训练', '其他'], type: '全部', search: '', docs: [], page: 1, hasMore: false, loadingMore: false, promoted: [], clubError: '' },
  ...actions,
  onShow() { return this.load(); },
  onHide() { this._ticket = (this._ticket || 0) + 1; this._promotionTicket = (this._promotionTicket || 0) + 1; },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  retry() { this.load(); },
  changeMode(event) { this.setData({ mode: event.currentTarget.dataset.mode }); this.load(); },
  changeType(event) { this.setData({ type: event.currentTarget.dataset.type }); this.load(); },
  input(event) { this.setData({ search: event.detail.value }); },
  search() { this.load(); },
  async load(more = false) {
    if (more && (this.data.loading || this.data.loadingMore)) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    this.setData(more ? { loadingMore: true } : { loading: true, error: '', docs: [] });
    try {
      const result = await cms.list(this.data.mode, { page: more ? this.data.page + 1 : 1, search: this.data.search,
        type: this.data.mode === 'events' && this.data.type !== '全部' ? this.data.type : undefined });
      const docs = (await cms.decorate(result.docs)).map(native.content);
      if (ticket !== this._ticket) return;
      this.setData({ loading: false, loadingMore: false, docs: more ? this.data.docs.concat(docs) : docs, page: result.page, hasMore: result.hasNextPage });
      if (!more) await this.loadPromoted();
    } catch (cause) { if (ticket === this._ticket) { error(this, cause); this.setData({ loadingMore: false }); } }
  },
  retryClub() { return this.loadPromoted(); },
  async loadPromoted() {
    const ticket = this._promotionTicket = (this._promotionTicket || 0) + 1, mode = this.data.mode;
    this.setData({ promoted: [], clubError: '' });
    try {
      const value = await club.load();
      if (ticket === this._promotionTicket && mode === this.data.mode) this.setData({ promoted: value.promotions[mode === 'events' ? 'event' : 'notice'] || [] });
    } catch (cause) { if (ticket === this._promotionTicket && mode === this.data.mode) this.setData({ clubError: cause.message }); }
  },
  onShareAppMessage() { return { title: '竞在紫荆 · 活动与通知', path: '/pages/events/index' }; },
}));
