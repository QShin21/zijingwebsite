function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const { actions, protect } = require('../../lib/page');
const navigation = require('../../lib/navigation');
Page(withVisualTheme({
  data: { user: null, needsLogin: false, groups: [
    { title: '社团日常', items: [{ title: '社团动态', subtitle: '回顾、故事与已发布消息', collection: 'news' }, { title: '影像记录', subtitle: '活动相册与照片说明', collection: 'albums' }, { title: '社群风采', subtitle: '来自各游戏社群的已审批记录', collection: 'club-showcase' }] },
    { title: '更多参与方式', items: [{ title: '招新资料', subtitle: '现有招新批次与参与条件', collection: 'recruitment' }] },
  ] },
  ...actions,
  onShow() { protect(this); },
  openCollection(event) { if (navigation.requireUser()) navigation.go('list', { collection: event.currentTarget.dataset.collection }); },
  retry() { protect(this); },
  onPullDownRefresh() { protect(this); wx.stopPullDownRefresh(); },
}));
