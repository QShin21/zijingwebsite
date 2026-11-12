function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
// V2 主场. Startup stays independent of business modules so failures remain visible.
Page(withVisualTheme({
  data: { loading: true, error: '', user: null, home: null, img: {}, statusBar: 20, navHeight: 44, modules: [],
    links: { join: { key: 'join' }, about: { key: 'about' }, announcements: { collection: 'announcements' }, news: { collection: 'news' } } },
  onShow: function () { this._nativeVisible = true; return this.load(); },
  onHide: function () { this._nativeVisible = false; this._ticket = (this._ticket || 0) + 1; },
  onUnload: function () { this._nativeVisible = false; },
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
  register: function () { wx.navigateTo({ url: '/pages/auth/index?mode=register' }); },
  openPage: function (event) { require('../../lib/navigation').go(event.currentTarget.dataset.page, event.currentTarget.dataset.params || {}); },
  openWebsite: function (event) { require('../../lib/navigation').website(event.currentTarget.dataset.url); },
  // V2 card images: one re-sign for an expired ticket, then the text fallback.
  imageError: function (event) { require('../../lib/v2-images').failed(this, event); },
  onShareAppMessage: function () { return { title: '竞在紫荆', path: '/pages/home/index' }; },
}));
