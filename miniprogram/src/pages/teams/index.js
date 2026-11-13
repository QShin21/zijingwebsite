const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const v2 = require('../../lib/v2');
const images = require('../../lib/v2-images');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
const views = ['teams', 'honors', 'recruitment'];
const text = {
  eyebrow: ['TEAMS · 代表队中心', 'TEAMS'],
  title: ['代表队', 'Teams'],
  subtitle: ['队伍、荣誉墙与选拔中心。想上场？到选拔中心找开放批次。', 'Teams, the honor wall and tryouts. Want to play? Find an open batch in Tryouts.'],
  tabTeams: ['队伍', 'Teams'],
  tabHonors: ['荣誉墙', 'Honor wall'],
  tabRecruitment: ['选拔中心', 'Tryouts'],
  loginTitle: ['登录后查看代表队与荣誉', 'Sign in to view teams and honors'],
  loginBody: ['队员简介与荣誉档案仅向社团成员展示；选拔中心可直接浏览。', 'Member profiles and honors are visible to club members only; Tryouts are open to everyone.'],
  teamsEmptyTitle: ['还没有公开的代表队', 'No public teams yet'],
  teamsEmptyBody: ['代表队由社群管理员申请建立，审核通过后出现在这里。', 'Community admins apply to found teams; approved teams appear here.'],
  myTeamWork: ['我的代表队事务', 'My team tasks'],
  honorsEmptyTitle: ['暂无已核验的荣誉', 'No verified honors yet'],
  honorsEmptyBody: ['现任队员可以投稿比赛荣誉，经审核后上墙。', 'Current members can submit honors; approved ones go on the wall.'],
  honorWorkspace: ['我的荣誉投稿与审核', 'My honor submissions and reviews'],
  staffTitle: ['骨干招新', 'Staff recruitment'],
  staffEmptyTitle: ['当前没有骨干招新批次', 'No staff recruitment batches right now'],
  staffEmptyBody: ['新的批次发布后会出现在这里。', 'New batches will appear here once published.'],
  callsTitle: ['代表队选拔', 'Team trials'],
  callsEmptyTitle: ['当前没有开放的代表队选拔', 'No open team trials right now'],
  callsEmptyBody: ['可以先浏览代表队与往期安排。', 'Browse the teams and past schedules in the meantime.'],
  mineTitle: ['我的申请进度', 'My application progress'],
  workspace: ['入队申请与成员记录', 'Team applications and memberships'],
  staffPage: ['骨干招新与我的回执', 'Staff recruitment and my receipts'],
  loginCalls: ['登录查看代表队选拔', 'Sign in to view team trials'],
  loadingMore: ['加载中…', 'Loading…'],
  retryMore: ['重试加载更多', 'Retry loading more'],
  loadMore: ['加载更多', 'Load more'],
};

function yearGroups(items) {
  const groups = [];
  items.forEach(item => {
    let group = groups.find(entry => entry.key === item.year);
    if (!group) { group = { key: item.year, items: [] }; groups.push(group); }
    group.items.push(item);
  });
  return groups;
}

// V2 代表队中心: 队伍 (A11) · 荣誉墙 (A13) · 选拔中心 (A14).
Page(withVisualTheme({
  data: { view: 'teams', user: null, docs: [], groups: [], staff: [], calls: [], mine: [], page: 0, hasMore: false, loading: false, loadingMore: false, error: '', loadMoreError: '', img: {} },
  ...actions,
  onLoad(options) { i18n.bind(this, text); if (views.includes(options && options.view)) this.setData({ view: options.view }); },
  onShow() {
    const relocalized = (i18n.refreshIfStale ? i18n.refreshIfStale(this) : false);
    i18n.navTitle('代表队', 'Teams');
    const user = session.user();
    const campus = session.campus(user);
    this._visible = campus;
    this.setData({ campus });
    if (!campus) return navigation.go('events');
    const identity = String(user.id);
    if (this._identity === identity && this._loaded && !relocalized) return;
    this._identity = identity;
    this.setData({ user });
    return this.load();
  },
  onHide() { this._visible = false; this._ticket = (this._ticket || 0) + 1; this.setData({ loading: false, loadingMore: false }); },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.view !== 'recruitment' && this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  retry() { return this.load(); },
  register() { navigation.go('auth', { mode: 'register' }); },
  switchView(event) {
    const view = event.currentTarget.dataset.view;
    if (!views.includes(view) || view === this.data.view || this.data.loading) return;
    this.setData({ view, docs: [], groups: [], error: '', loadMoreError: '' });
    return this.load();
  },
  openWorkspace() { navigation.go('team'); },
  openStaff() { navigation.go('staff'); },
  openHonorWorkspace() { navigation.go('team-honor-workspace'); },
  async load(more) {
    const view = this.data.view;
    if (more && (this.data.loadingMore || !this.data.hasMore)) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const alive = () => ticket === this._ticket && this._visible !== false && view === this.data.view;
    if (!session.campus()) { this._loaded = true; this.setData({ loading: false, docs: [], groups: [] }); return; }
    this.setData(more ? { loadingMore: true, loadMoreError: '' } : { loading: true, error: '' });
    try {
      if (view === 'recruitment') {
        const center = await v2.get('recruitment');
        if (!alive()) return;
        this._loaded = true;
        this.setData({ loading: false, staff: center.staff.map(v2.recruitment), calls: center.teams ? center.teams.docs.map(v2.recruitment) : [], mine: center.mine ? center.mine.map(v2.application) : [] });
        return;
      }
      const page = more ? this.data.page + 1 : 1;
      const result = await v2.get(view, { page, limit: 20 }, { required: true });
      if (!alive()) return;
      const seen = more ? this.data.docs.map(doc => doc.key) : [];
      const fresh = result.docs.map(view === 'teams' ? v2.team : v2.honor).filter(doc => !seen.includes(doc.key));
      if (view === 'honors') images.attach(this, fresh, alive);
      const docs = more ? this.data.docs.concat(fresh) : fresh;
      this._loaded = true;
      this.setData({ docs, groups: view === 'honors' ? yearGroups(docs) : [], page: result.page, hasMore: result.hasNextPage, loading: false, loadingMore: false });
    } catch (cause) {
      if (!alive()) return;
      if (more) this.setData({ loadingMore: false, loadMoreError: (cause && cause.message) || i18n.t('加载更多失败', 'Could not load more') });
      else this.setData({ loading: false, error: (cause && cause.message) || i18n.t('内容暂时无法加载', 'Content could not be loaded') });
    }
  },
  onShareAppMessage() { return { title: i18n.t('紫荆代表队', 'Zijing Teams'), path: '/pages/teams/index' }; },
}));
