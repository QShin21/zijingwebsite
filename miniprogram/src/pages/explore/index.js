function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
// The former 档案 tab now lives in 代表队中心. Old shared links land here and continue.
const text = { title: ['档案已并入代表队中心', 'Archives are now part of Teams'], body: ['队伍、荣誉墙与选拔中心都在「代表队」标签里。', 'Teams, the honor wall and trials are all under the Teams tab.'], go: ['前往代表队', 'Go to Teams'] };
Page(withVisualTheme({
  data: {},
  onLoad() { i18n.bind(this, text); this.go(); },
  onShow() { i18n.navTitle('发现紫荆', 'Discover Zijing'); },
  go() { wx.switchTab({ url: '/pages/teams/index' }); },
  onShareAppMessage() { return { title: i18n.t('紫荆代表队', 'Zijing Teams'), path: '/pages/teams/index' }; },
}));
