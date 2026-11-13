const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();
const navigation = require('./navigation');
const session = require('./session');
const labelsZh = { events: '活动', announcements: '通知', teams: '代表队', honors: '荣誉档案', news: '社团动态', albums: '影像', recruitment: '招新批次', seasons: '赛季阵容', 'club-showcase': '社群风采 · 社团展示' };
const labelsEn = { events: 'Events', announcements: 'Notices', teams: 'Teams', honors: 'Honors', news: 'Club news', albums: 'Gallery', recruitment: 'Recruitment', seasons: 'Season rosters', 'club-showcase': 'Community showcase · Club display' };
// Read at access time so the current language applies.
const labels = {};
Object.keys(labelsZh).forEach(key => Object.defineProperty(labels, key, { enumerable: true, get: () => i18n.t(labelsZh[key], labelsEn[key]) }));
function error(page, cause) {
  page.setData({ loading: false, error: cause && cause.message || i18n.t('加载失败，请重试', 'Failed to load. Please try again.'), needsLogin: cause && cause.status === 401 });
}
const actions = {
  login: navigation.login,
  back: navigation.back,
  openContent(event) { navigation.content(event.currentTarget.dataset.doc); },
  openPage(event) { navigation.go(event.currentTarget.dataset.page, event.currentTarget.dataset.params || {}); },
  openWebsite(event) { navigation.website(event.currentTarget.dataset.url); },
  // Server-declared destinations: data-web carries ApplicationItem/TodoItem/ManageQueue.webOnly.
  openTarget(event) { const { url, web } = event.currentTarget.dataset; navigation.open(url, web === true); },
  copy(event) { navigation.copy(event.currentTarget.dataset.value); },
  previewImage(event) {
    const url = event.currentTarget.dataset.url;
    if (url) wx.previewImage({ current: url, urls: this.data.previewImages || [url] });
  },
  // V2 card images: one re-sign for an expired ticket, then the text fallback.
  imageError(event) { require('./v2-images').failed(this, event); },
};
function protect(page) {
  const user = session.user();
  page.setData({ user, needsLogin: !user });
  return user;
}
module.exports = { error, actions, protect, labels };
