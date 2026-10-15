function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
// Keep startup independent of compiled business modules so errors remain visible.
Page(withVisualTheme({
  data: { loading: true, error: '', site: {}, user: null, modules: [], announcements: [], heroErrorURL: '' },
  onShow: function () { this._nativeVisible = true; return this.load(); },
  onHide: function () { this._nativeVisible = false; this._ticket = (this._ticket || 0) + 1; },
  onUnload: function () { this._nativeVisible = false; },
  onPullDownRefresh: function () { return this.load().then(function () { wx.stopPullDownRefresh(); }); },
  load: function () {
    this.setData({ loading: true, error: '', heroErrorURL: '' });
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
  nativeCoverError: function (event) {
    if (!this._nativeVisible) return;
    const mark = require('../../lib/native-presentation').markCoverFailure;
    let changed = false;
    const modules = this.data.modules.map(function (module) {
      const docs = mark(module.docs, event.currentTarget.dataset);
      if (docs === module.docs) return module;
      changed = true; return { ...module, docs };
    });
    if (changed) this.setData({ modules });
  },
  homeHeroError: function (event) {
    const url = event.currentTarget.dataset.url;
    if (this._nativeVisible && url && this.data.hero && this.data.hero.url === url) this.setData({ heroErrorURL: url });
  },
  onShareAppMessage: function () { return { title: '竞在紫荆', path: '/pages/home/index' }; },
}));
