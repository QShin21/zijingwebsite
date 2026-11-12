function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
// The former 档案 tab now lives in 代表队中心. Old shared links land here and continue.
Page(withVisualTheme({
  data: {},
  onLoad() { this.go(); },
  go() { wx.switchTab({ url: '/pages/teams/index' }); },
  onShareAppMessage() { return { title: '紫荆代表队', path: '/pages/teams/index' }; },
}));
