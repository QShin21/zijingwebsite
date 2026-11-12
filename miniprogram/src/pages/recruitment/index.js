function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const v2 = require('../../lib/v2');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');

// V2 选拔中心 (A14): open staff batches for everyone; team calls and the
// viewer's own applications only for signed-in members (server-enforced).
Page(withVisualTheme({
  data: { loading: true, error: '', user: null, staff: [], calls: [], mine: [] },
  ...actions,
  onShow() { this._visible = true; return this.load(); },
  onHide() { this._visible = false; this._ticket = (this._ticket || 0) + 1; },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh()); },
  retry() { return this.load(); },
  register() { navigation.go('auth', { mode: 'register' }); },
  workspace() { navigation.go('team'); },
  staffPage() { navigation.go('staff'); },
  async load() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const alive = () => ticket === this._ticket && this._visible !== false;
    this.setData({ loading: true, error: '', user: session.user() });
    try {
      const center = await v2.get('recruitment');
      if (!alive()) return;
      this.setData({ loading: false, staff: center.staff.map(v2.recruitment), calls: center.teams ? center.teams.docs.map(v2.recruitment) : [], mine: center.mine ? center.mine.map(v2.application) : [] });
    } catch (cause) {
      if (alive()) this.setData({ loading: false, error: (cause && cause.message) || '选拔中心暂时无法加载' });
    }
  },
  onShareAppMessage() { return { title: '紫荆选拔中心', path: '/pages/recruitment/index' }; },
}));
