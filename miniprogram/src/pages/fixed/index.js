function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const { render } = require('../../lib/richtext');
const { actions, error } = require('../../lib/page');
const session = require('../../lib/session');
const reading = require('../../lib/native-reading');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const names = { about: '关于紫荆', contact: '联系与合作', privacy: '隐私说明', join: '加入紫荆', 'join-members': '普通社员', 'join-teams': '代表队选拔', 'join-staff': '骨干招新' };
const namesEn = { about: 'About Zijing', contact: 'Contact', privacy: 'Privacy', join: 'Join Zijing', 'join-members': 'Members', 'join-teams': 'Team trials', 'join-staff': 'Staff recruitment' };
const pageTitle = key => names[key] ? i18n.t(names[key], namesEn[key]) : i18n.t('社团资料', 'Club information');
const text = { back: ['‹ 返回', '‹ Back'], kickerJoin: ['JOIN · 加入紫荆', 'JOIN · Join Zijing'], kickerPrivacy: ['PRIVACY · 隐私说明', 'PRIVACY · Privacy'], kickerContact: ['CONTACT · 联系', 'CONTACT · Contact'], kickerAbout: ['ABOUT · 关于紫荆', 'ABOUT · About Zijing'],
  publishedPrefix: ['发布于 ', 'Published '], coverFailed: ['封面暂时无法显示。', 'The cover cannot be shown.'], reloadContent: ['重新加载内容', 'Reload content'],
  pathCommunities: ['寻找游戏社群', 'Find a game community'], pathCommunitiesBody: ['联系管理员，申请加入微信群。', 'Contact an admin to join the WeChat group.'], pathCommunitiesAction: ['查看游戏社群', 'View game communities'],
  pathTeams: ['参加代表队选拔', 'Try out for a team'], pathTeamsBody: ['了解队伍招新与参与条件。', 'See team recruitment and requirements.'], pathTeamsAction: ['查看代表队选拔', 'View team trials'],
  pathStaff: ['参与社团工作', 'Work with the club'], pathStaffBody: ['查看执行部与宣传部骨干招新。', 'See staff recruitment for operations and publicity.'], pathStaffAction: ['查看骨干招新', 'View staff recruitment'],
  copyContact: ['复制联系方式', 'Copy contact'], pendingTitle: ['资料待发布', 'Not published yet'], pendingBody: ['经确认的资料发布后会出现在这里。', 'Confirmed information will appear here once published.'],
  batches: ['相关招新批次', 'Related recruitment'], batchesEmpty: ['暂无已发布的招新批次', 'No recruitment published yet'], batchesEmptyHint: ['新批次发布后会出现在这里，可稍后下拉刷新。', 'New batches will appear here. Pull down to refresh later.'] };
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, key: '', title: '', doc: null, reading: {}, nodes: [], links: [], contacts: [], batches: [], coverImage: null, coverImageFailed: false },
  ...actions,
  onLoad(options) {
    i18n.bind(this, text);
    this._hidden = false; this._unloaded = false;
    const user = session.user(); this._userId = user && user.id;
    this.setData({ key: options.key, isJoin: options.key && options.key.startsWith('join-'), title: pageTitle(options.key) });
    i18n.navTitle(names[options.key] || '社团资料', names[options.key] ? namesEn[options.key] : 'Club information');
    this._unsubscribe = session.subscribe(user => {
      if (String(user && user.id) === String(this._userId)) return;
      this._userId = user && user.id; this._ticket = (this._ticket || 0) + 1;
      this.setData({ loading: false, error: '', needsLogin: this.data.isJoin && !user, doc: null, reading: {}, nodes: [], links: [], contacts: [], batches: [], coverImage: null, coverImageFailed: false });
    });
  },
  onShow() { if ((i18n.refreshIfStale ? i18n.refreshIfStale(this) : false)) this.onLocaleChange(); i18n.navTitle(names[this.data.key] || '社团资料', names[this.data.key] ? namesEn[this.data.key] : 'Club information'); this._hidden = false; this.load(); },
  onLocaleChange() { this.setData({ title: pageTitle(this.data.key) }); },
  onHide() { this._hidden = true; this._ticket = (this._ticket || 0) + 1; },
  onUnload() { this._unloaded = true; this.onHide(); i18n.unbind(this); if (this._unsubscribe) this._unsubscribe(); },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    if (this._hidden || this._unloaded) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const user = session.user(), userId = user && user.id; this._userId = userId;
    const current = () => { const actor = session.user(); return ticket === this._ticket && !this._hidden && !this._unloaded && String(actor && actor.id) === String(userId); };
    const cleared = { doc: null, reading: {}, nodes: [], links: [], contacts: [], batches: [], coverImage: null, coverImageFailed: false };
    if (this.data.isJoin && !session.campus(user)) {
      this.setData({ ...cleared, loading: false, error: user ? i18n.t('此栏目仅面向清华账号', 'This section is for Tsinghua accounts only') : '', needsLogin: !user });
      return;
    }
    this.setData({ ...cleared, loading: true, error: '', needsLogin: false });
    try {
      if (!names[this.data.key]) throw new Error(i18n.t('页面不存在', 'Page not found'));
      const page = await cms.fixed(this.data.key);
      if (!current()) return;
      const doc = page.updatedAt ? page : null;
      const rendered = render(doc && doc.body);
      const contacts = page.contacts || [];
      let batches = [];
      if (this.data.isJoin) {
        const kind = this.data.key.split('-')[1];
        batches = (await cms.list('recruitment', { kind, limit: 12 })).docs.map(reading.entry);
      }
      if (!current()) return;
      this.setData({ loading: false, doc, reading: doc ? reading.article(doc, 'pages') : {}, nodes: reading.prose(rendered.nodes), links: rendered.links, contacts, batches, campus: session.campus(user) });
    } catch (cause) { if (current()) error(this, cause); }
  },
  readingImageError(event) {
    if (this._hidden || this._unloaded || this.data.loading || this.data.needsLogin) return;
    if (this.data.coverImage && this.data.coverImage.url === event.currentTarget.dataset.url) this.setData({ coverImageFailed: true });
  },
  nativeCoverError(event) {
    if (this._hidden || this._unloaded) return;
    const batches = require('../../lib/native-presentation').markCoverFailure(this.data.batches, event.currentTarget.dataset);
    if (batches !== this.data.batches) this.setData({ batches });
  },
}));
