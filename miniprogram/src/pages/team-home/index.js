function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const v2 = require('../../lib/v2');
const images = require('../../lib/v2-images');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');

function view(detail) {
  const card = detail.card, viewer = detail.viewer || {};
  const team = v2.team(card);
  const open = detail.recruitments.find(call => call.state === 'open');
  return {
    team, seasons: detail.seasons.length,
    roster: detail.roster.map(profile => ({ key: 'profile:' + profile.id, name: profile.displayName, position: profile.position, bio: profile.biography, initial: v2.initial(profile.displayName), coverSrc: profile.avatar ? profile.avatar.src : '' })),
    honors: detail.honors.map(v2.honor), calls: detail.recruitments.map(v2.recruitment), events: detail.events.slice(0, 6).map(v2.event),
    positions: detail.positions, open: open ? v2.recruitment(open) : null,
    seasonList: detail.seasons.map(season => ({ id: season.id, title: season.title, date: season.startAt ? v2.dateText(season.startAt) : '时间待补',
      members: season.members.map(member => member.position ? member.displayName + '（' + member.position + '）' : member.displayName).join('、') })),
    membership: viewer.membership ? (viewer.membership.status === 'active' ? '你是本队现任队员' : viewer.membership.status === 'left' ? '你曾是本队队员' : '你的成员关系已撤销') : '',
    canEditProfile: Boolean(viewer.canEditProfile), canSubmitHonor: Boolean(viewer.canSubmitHonor), canManage: Boolean(viewer.canManage),
  };
}

// V2 队伍页 (A12). Profiles shown here are only those the members chose to publish.
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, detail: null, img: {} },
  ...actions,
  onLoad(options) {
    const key = String((options && (options.slug || options.id)) || '');
    this._key = /^[a-z0-9-]{1,120}$/i.test(key) ? key : '';
  },
  onShow() { this._visible = true; return this.load(); },
  onHide() { this._visible = false; this._ticket = (this._ticket || 0) + 1; },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh()); },
  retry() { return this.load(); },
  register() { navigation.go('auth', { mode: 'register' }); },
  async load() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const alive = () => ticket === this._ticket && this._visible !== false;
    if (!this._key) { this.setData({ loading: false, error: '队伍入口无效' }); return; }
    if (!session.user()) { this.setData({ loading: false, needsLogin: true }); return; }
    this.setData({ loading: true, error: '', needsLogin: false });
    try {
      const detail = view(await v2.get('teams/' + encodeURIComponent(this._key), {}, { required: true }));
      if (!alive()) return;
      images.attach(this, detail.roster.concat(detail.honors, detail.events), alive);
      wx.setNavigationBarTitle({ title: detail.team.title });
      this.setData({ loading: false, detail });
    } catch (cause) {
      if (alive()) this.setData({ loading: false, error: (cause && cause.message) || '队伍暂时无法加载', needsLogin: cause && cause.status === 401 });
    }
  },
  editProfile() { if (this.data.detail) navigation.go('team-profiles', { team: this.data.detail.team.id }); },
  submitHonor() { if (this.data.detail) navigation.go('team-honor-workspace', { team: this.data.detail.team.id }); },
  manage() { if (this.data.detail) navigation.go('team-review', { team: this.data.detail.team.id }); },
  leave() { navigation.go('team', { view: 'memberships' }); },
  onShareAppMessage() {
    const detail = this.data.detail;
    return { title: detail ? detail.team.title + ' · 紫荆代表队' : '紫荆代表队', path: '/pages/team-home/index?slug=' + encodeURIComponent(this._key || '') };
  },
}));
