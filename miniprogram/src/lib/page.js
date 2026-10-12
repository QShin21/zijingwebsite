const navigation = require('./navigation');
const session = require('./session');
const labels = { events: '活动', announcements: '通知', teams: '代表队', honors: '荣誉档案', news: '社团动态', albums: '影像', recruitment: '招新批次', seasons: '赛季阵容', 'club-showcase': '社群风采 · 社团展示' };
function error(page, cause) {
  page.setData({ loading: false, error: cause && cause.message || '加载失败，请重试', needsLogin: cause && cause.status === 401 });
}
const actions = {
  login: navigation.login,
  back: navigation.back,
  openContent(event) { navigation.content(event.currentTarget.dataset.doc); },
  openPage(event) { navigation.go(event.currentTarget.dataset.page, event.currentTarget.dataset.params || {}); },
  openWebsite(event) { navigation.website(event.currentTarget.dataset.url); },
  copy(event) { navigation.copy(event.currentTarget.dataset.value); },
  previewImage(event) {
    const url = event.currentTarget.dataset.url;
    if (url) wx.previewImage({ current: url, urls: this.data.previewImages || [url] });
  },
};
function protect(page) {
  const user = session.user();
  page.setData({ user, needsLogin: !user });
  return user;
}
module.exports = { error, actions, protect, labels };
