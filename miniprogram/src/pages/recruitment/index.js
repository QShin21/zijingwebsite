const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const v2 = require('../../lib/v2');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
const text = {
  eyebrow: ['TRYOUTS · 选拔中心', 'TRYOUTS'],
  title: ['选拔中心', 'Tryouts'],
  subtitle: ['代表队选拔与骨干招新。提交后可随时查看本人回执，由管理员人工处理。', 'Team trials and staff recruitment. After submitting you can check your receipt anytime; admins review each application.'],
  staffTitle: ['骨干招新', 'Staff recruitment'],
  staffEmptyTitle: ['当前没有骨干招新批次', 'No staff recruitment batches right now'],
  staffEmptyBody: ['新的批次发布后会出现在这里。', 'New batches will appear here once published.'],
  callsTitle: ['代表队选拔', 'Team trials'],
  callsLoginTitle: ['登录后查看代表队选拔', 'Sign in to view team trials'],
  callsLoginBody: ['代表队招新批次与本人申请仅向社团成员展示。', 'Team recruitment batches and your applications are visible to club members only.'],
  callsEmptyTitle: ['当前没有开放的代表队选拔', 'No open team trials right now'],
  callsEmptyBody: ['可以先浏览代表队与往期安排。', 'Browse the teams and past schedules in the meantime.'],
  browseTeams: ['浏览代表队', 'Browse teams'],
  mineTitle: ['我的申请进度', 'My application progress'],
  workspace: ['入队申请与成员记录（含撤回、离队）', 'Team applications and memberships (withdraw, leave)'],
  staffPage: ['骨干招新与我的回执', 'Staff recruitment and my receipts'],
};

// V2 选拔中心 (A14): open staff batches for everyone; team calls and the
// viewer's own applications only for signed-in members (server-enforced).
Page(withVisualTheme({
  data: { loading: true, error: '', user: null, staff: [], calls: [], mine: [] },
  ...actions,
  onLoad() { i18n.bind(this, text); },
  onShow() { i18n.navTitle('选拔中心', 'Tryouts'); this._visible = true; return this.load(); },
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
      if (alive()) this.setData({ loading: false, error: (cause && cause.message) || i18n.t('选拔中心暂时无法加载', 'Tryouts could not be loaded') });
    }
  },
  onShareAppMessage() { return { title: i18n.t('紫荆选拔中心', 'Zijing Tryouts'), path: '/pages/recruitment/index' }; },
}));
