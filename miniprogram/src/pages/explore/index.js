const { actions, protect } = require('../../lib/page');
const navigation = require('../../lib/navigation');
Page({
  data: { user: null, needsLogin: false, groups: [
    { title: '赛场与记录', items: [{ title: '代表队', subtitle: '队伍与赛季阵容', collection: 'teams', mark: '01' }, { title: '荣誉档案', subtitle: '经核验的赛事与成绩', collection: 'honors', mark: '02' }] },
    { title: '社团生活', items: [{ title: '社团动态', subtitle: '公告、回顾与故事', collection: 'news', mark: '03' }, { title: '影像', subtitle: '那些值得记住的现场', collection: 'albums', mark: '04' }, { title: '招新批次', subtitle: '查看当期参与条件与安排', collection: 'recruitment', mark: '05' }] },
  ] },
  ...actions,
  onShow() { protect(this); },
  openCollection(event) { if (navigation.requireUser()) navigation.go('list', { collection: event.currentTarget.dataset.collection }); },
  retry() { protect(this); },
  onPullDownRefresh() { protect(this); wx.stopPullDownRefresh(); },
});
