// Keep startup independent of compiled business modules so errors remain visible.
Page({
  data: { loading: true, error: '', site: {}, user: null, modules: [], announcements: [] },
  onShow: function () { return this.load(); },
  onHide: function () { this._ticket = (this._ticket || 0) + 1; },
  onPullDownRefresh: function () { return this.load().then(function () { wx.stopPullDownRefresh(); }); },
  load: function () {
    this.setData({ loading: true, error: '' });
    return Promise.resolve().then(function () {
      return require('../../lib/home').load(this);
    }.bind(this)).catch(function () {
      this.setData({ loading: false, error: '页面启动失败，请点击重试；若仍无法打开，请重新扫描最新预览码。' });
    }.bind(this));
  },
  retry: function () { return this.load(); },
  login: function () { wx.navigateTo({ url: '/pages/auth/index?mode=login' }); },
  openWebsite: function (event) { require('../../lib/navigation').website(event.currentTarget.dataset.url); },
  openContent: function (event) { require('../../lib/navigation').content(event.currentTarget.dataset.doc); },
  openModule: function (event) { require('../../lib/navigation').go('list', { collection: event.currentTarget.dataset.kind }); },
  openPage: function (event) { require('../../lib/navigation').go(event.currentTarget.dataset.page, event.currentTarget.dataset.params || {}); },
  retryClub: function () { return require('../../lib/home').loadClub(this); },
  onShareAppMessage: function () { return { title: '竞在紫荆', path: '/pages/home/index' }; },
});
