const session = require('../../lib/session');
const http = require('../../lib/http');
const navigation = require('../../lib/navigation');
const config = require('../../config');
const { actions } = require('../../lib/page');
function profile(user) {
  return { user, initial: user ? user.name.substring(0, 1) : 'Z',
    role: user ? { president: '社长', vicePresident: '副社长', backbone: '社团骨干', communityAdmin: '社群管理员', member: '社团成员' }[user.roles[0]] || '社团成员' : '' };
}
Page({
  data: { user: null, initial: 'Z', role: '', reviewCommunity: false, reviewStaff: false, version: config.version, error: '', refreshing: false },
  ...actions,
  onShow() { this.refresh(); },
  onHide() { this._ticket = (this._ticket || 0) + 1; this.setData({ refreshing: false }); },
  async refresh() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const user = session.user();
    this.setData({ ...profile(user), error: '', refreshing: Boolean(user), reviewCommunity: false, reviewStaff: false });
    if (user) {
      try {
        const result = await http.request('/api/users/me', { required: true });
        if (ticket !== this._ticket || String(session.user() && session.user().id) !== String(user.id)) return;
        session.refreshUser(result.user); this.setData(profile(session.user()));
        const workbench = await http.request('/api/miniapp/workbench', { required: true });
        if (ticket === this._ticket && String(session.user() && session.user().id) === String(user.id)) this.setData({ reviewCommunity: workbench.reviewCommunity === true, reviewStaff: workbench.reviewStaff === true });
      }
      catch (cause) { if (ticket === this._ticket) this.setData({ ...profile(session.user()), error: cause.message, reviewCommunity: false, reviewStaff: false }); }
      finally { if (ticket === this._ticket) this.setData({ refreshing: false }); }
    }
  },
  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()); },
  register() { navigation.go('auth', { mode: 'register' }); },
  reset() { navigation.go('auth', { mode: 'reset' }); },
  async logout() {
    if (this._loggingOut) return;
    this._loggingOut = true;
    try {
    const result = await new Promise(resolve => wx.showModal({ title: '退出账号', content: '确认退出当前账号？', success: resolve }));
    if (!result.confirm) return;
    try { await http.request('/api/users/logout', { method: 'POST', required: true }); }
    catch { /* Local credentials must still be removed if the network is offline. */ }
    this._ticket = (this._ticket || 0) + 1; session.clear(); this.setData({ ...profile(null), reviewCommunity: false, reviewStaff: false });
    } finally { this._loggingOut = false; }
  },
  openAdmin() { navigation.copy(config.origin + '/admin', '后台链接已复制'); },
});
