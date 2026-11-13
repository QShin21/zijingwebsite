function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const v2 = require('../../lib/v2');
const images = require('../../lib/v2-images');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回', '‹ Back'],
  loginTitle: ['登录后查看队伍', 'Sign in to view the team'],
  loginBody: ['队员简介与荣誉档案仅向社团成员展示。', 'Member profiles and honors are shown to club members only.'],
  publicMembers: ['公开队员', 'Public members'],
  verifiedHonors: ['已核验荣誉', 'Verified honors'],
  seasonArchives: ['赛季档案', 'Season archives'],
  applyTrial: ['报名选拔', 'Apply for trials'],
  editProfile: ['编辑我的简介', 'Edit my profile'],
  submitHonor: ['投稿荣誉', 'Submit an honor'],
  workbench: ['本队工作台', 'Team workbench'],
  leave: ['办理离队', 'Leave the team'],
  members: ['队员', 'Members'],
  noProfilesTitle: ['暂无公开的队员简介', 'No public member profiles yet'],
  noProfilesBody: ['现任队员可以编辑并选择公开本人简介。', 'Current members can edit and choose to publish their profile.'],
  honors: ['荣誉', 'Honors'],
  noHonorsTitle: ['暂无已核验的荣誉', 'No verified honors yet'],
  noHonorsBody: ['现任队员可以投稿比赛荣誉，经审核后上墙。', 'Current members can submit competition honors; they appear after review.'],
  trials: ['选拔', 'Trials'],
  positions: ['位置与要求', 'Positions and requirements'],
  dutiesPrefix: ['职责：', 'Duties: '],
  requirementsPrefix: ['要求：', 'Requirements: '],
  commitmentPrefix: ['投入：', 'Commitment: '],
  arrangementPrefix: ['安排：', 'Arrangement: '],
  relatedEvents: ['相关活动', 'Related events'],
  rosterHidden: ['本赛季阵容未公开。', 'This season\'s roster is not public.'],
};


function view(detail) {
  const card = detail.card, viewer = detail.viewer || {};
  const team = v2.team(card);
  const open = detail.recruitments.find(call => call.state === 'open');
  return {
    team, seasons: detail.seasons.length,
    roster: detail.roster.map(profile => ({ key: 'profile:' + profile.id, name: profile.displayName, position: profile.position, bio: profile.biography, initial: v2.initial(profile.displayName), coverSrc: profile.avatar ? profile.avatar.src : '' })),
    honors: detail.honors.map(v2.honor), calls: detail.recruitments.map(v2.recruitment), events: detail.events.slice(0, 6).map(v2.event),
    positions: detail.positions, open: open ? v2.recruitment(open) : null,
    seasonList: detail.seasons.map(season => ({ id: season.id, title: season.title, date: season.startAt ? v2.dateText(season.startAt) : i18n.t('时间待补', 'Date to be added'),
      members: season.members.map(member => member.position ? member.displayName + i18n.t('（', ' (') + member.position + i18n.t('）', ')') : member.displayName).join(i18n.t('、', ', ')) })),
    membership: viewer.membership ? (viewer.membership.status === 'active' ? i18n.t('你是本队现任队员', 'You are a current member of this team') : viewer.membership.status === 'left' ? i18n.t('你曾是本队队员', 'You were a member of this team') : i18n.t('你的成员关系已撤销', 'Your membership was revoked')) : '',
    canEditProfile: Boolean(viewer.canEditProfile), canSubmitHonor: Boolean(viewer.canSubmitHonor), canManage: Boolean(viewer.canManage),
  };
}

// V2 队伍页 (A12). Profiles shown here are only those the members chose to publish.
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, detail: null, img: {} },
  ...actions,
  onLoad(options) {
    i18n.bind(this, text);
    const key = String((options && (options.slug || options.id)) || '');
    this._key = /^[a-z0-9-]{1,120}$/i.test(key) ? key : '';
  },
  onShow() { this._visible = true; i18n.navTitle('代表队', 'Team'); return this.load(); },
  onLocaleChange() { if (this._visible !== false && this.data.detail) this.load(); },
  onHide() { this._visible = false; this._ticket = (this._ticket || 0) + 1; },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh()); },
  retry() { return this.load(); },
  register() { navigation.go('auth', { mode: 'register' }); },
  async load() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const alive = () => ticket === this._ticket && this._visible !== false;
    if (!this._key) { this.setData({ loading: false, error: i18n.t('队伍入口无效', 'Invalid team link') }); return; }
    if (!session.user()) { this.setData({ loading: false, needsLogin: true }); return; }
    this.setData({ loading: true, error: '', needsLogin: false });
    try {
      const detail = view(await v2.get('teams/' + encodeURIComponent(this._key), {}, { required: true }));
      if (!alive()) return;
      images.attach(this, detail.roster.concat(detail.honors, detail.events), alive);
      wx.setNavigationBarTitle({ title: detail.team.title });
      this.setData({ loading: false, detail });
    } catch (cause) {
      if (alive()) this.setData({ loading: false, error: (cause && cause.message) || i18n.t('队伍暂时无法加载', 'The team could not be loaded'), needsLogin: cause && cause.status === 401 });
    }
  },
  editProfile() { if (this.data.detail) navigation.go('team-profiles', { team: this.data.detail.team.id }); },
  submitHonor() { if (this.data.detail) navigation.go('team-honor-workspace', { team: this.data.detail.team.id }); },
  manage() { if (this.data.detail) navigation.go('team-review', { team: this.data.detail.team.id }); },
  leave() { navigation.go('team', { view: 'memberships' }); },
  onShareAppMessage() {
    const detail = this.data.detail;
    return { title: detail ? detail.team.title + i18n.t(' · 紫荆代表队', ' · Zijing Teams') : i18n.t('紫荆代表队', 'Zijing Teams'), path: '/pages/team-home/index?slug=' + encodeURIComponent(this._key || '') };
  },
}));
