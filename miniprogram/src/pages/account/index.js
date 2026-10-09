const session = require('../../lib/session');
const http = require('../../lib/http');
const navigation = require('../../lib/navigation');
const config = require('../../config');
const { actions } = require('../../lib/page');
function profile(user) {
  return { user, initial: user ? user.name.substring(0, 1) : 'Z', review: session.reviewer(),
    role: user ? { president: '社长', vicePresident: '副社长', communityAdmin: '社群管理员', member: '社团成员' }[user.roles[0]] || '社团成员' : '' };
}
Page({
  data: { user: null, initial: 'Z', role: '', review: false, version: config.version, error: '' },
  ...actions,
  onShow() { this.refresh(); },
  async refresh() {
    const user = session.user();
    this.setData({ ...profile(user), error: '' });
    if (user) {
      try { const result = await http.request('/api/users/me', { required: true }); session.refreshUser(result.user); this.setData(profile(session.user())); }
      catch (cause) { this.setData({ ...profile(session.user()), error: cause.message }); }
    }
  },
  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()); },
  register() { navigation.go('auth', { mode: 'register' }); },
  reset() { navigation.go('auth', { mode: 'reset' }); },
  async logout() {
    const result = await new Promise(resolve => wx.showModal({ title: '退出账号', content: '确认退出当前账号？', success: resolve }));
    if (!result.confirm) return;
    try { await http.request('/api/users/logout', { method: 'POST', required: true }); }
    catch { /* Local credentials must still be removed if the network is offline. */ }
    session.clear(); this.setData(profile(null));
  },
  openAdmin() { navigation.copy(config.origin + '/admin', '后台链接已复制'); },
});
