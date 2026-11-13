function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const session = require('../../lib/session');
const http = require('../../lib/http');
const v2 = require('../../lib/v2');
const navigation = require('../../lib/navigation');
const config = require('../../config');
const { actions } = require('../../lib/page');
const roleLabels = { president: '社长', vicePresident: '副社长', backbone: '社团骨干', communityAdmin: '社群管理员', honoraryBackbone: '荣誉骨干', member: '社团成员' };

const affiliations = { tsinghua: '清华用户', peer: '友校学生', external: '校外人士' };
const seatStatusLabels = { pending: '待审核', confirmed: '已确认', rejected: '已驳回', cancelled: '已取消', revoked: '已撤销' };
function seatReceipt(item) {
  const request=item.request;
  return { key:item.key, title:item.title, kind:item.kind, id:item.activityID,
    summary:request ? (seatStatusLabels[request.status]||'处理中')+' · '+(request.seats.length ? request.seats.map(seat=>String(seat).split('-').join('排')+'座').join('、') : request.requestedCount+' 个座位') : '活动暂不可访问' };
}

function profile(user) {
  return { user, campus: session.campus(user), affiliation: user ? affiliations[user.affiliation || 'tsinghua'] : '', initial: user ? v2.initial(user.name) : 'Z',
    role: user ? (user.roles.length ? user.roles : ['member']).map(role => roleLabels[role] || role).join('、') : '' };
}
// webOnly is declared by the server per capability (ManageQueue/TodoItem); the client keeps no path whitelist.
function queueView(queue) {
  return { key: queue.key, title: queue.title, scope: queue.scope, pending: queue.pending, href: queue.href, web: queue.webOnly === true };
}
function todoView(item) {
  return { key: item.key, kind: item.kind, title: item.title, detail: item.detail, count: item.count, href: item.href, web: item.webOnly === true };
}

// V2 我的: 身份卡 · 待办 · 我的赛程 · 申请进度 · 我的队伍 · 管理台 · 外观与账号.
Page(withVisualTheme({
  data: { user: null, initial: 'Z', role: '', me: null, queues: [], seatReceipts: [], seatPage: 1, seatHasNext: false, seatError: false, seatLoading: false, version: config.version, error: '', refreshing: false, img: {},
    teamApplicationParams: { view: 'ownApplications' }, membershipParams: { view: 'memberships' }, managedTeamParams: { view: 'managedTeams' } },
  ...actions,
  onShow() { this.refresh(); },
  onHide() { this._ticket = (this._ticket || 0) + 1; this.setData({ refreshing: false }); },
  async refresh() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const user = session.user();
    const current = () => ticket === this._ticket && String(session.user() && session.user().id) === String(user && user.id);
    this.setData({ ...profile(user), error: '', refreshing: Boolean(user), me: user && this.data.user?.id === user.id ? this.data.me : null, queues: session.campus(user) && this.data.user?.id === user.id ? this.data.queues : [], seatReceipts: [], seatPage: 1, seatHasNext: false, seatError: false, seatLoading: false });
    if (!user) return;
    try {
      const result = await http.request('/api/users/me', { required: true });
      if (!current()) return;
      session.refreshUser(result.user); this.setData(profile(session.user()));
      const [me, manage, seats] = await Promise.all([v2.get('me', {}, { required: true }), v2.get('manage', {}, { required: true }).catch(() => ({ queues: [] })), v2.get('me/seat-requests', {page:1,limit:20}, {required:true}).catch(() => null)]);
      if (!current()) return;
      this.setData({
        me: { todo: me.todo.map(todoView), upcoming: me.upcoming.map(v2.event), applications: me.applications.map(v2.application), counts: me.counts,
          memberships: me.memberships.map(item => ({ id: item.id, title: item.team.title, slug: item.team.slug, teamID: item.team.id, status: item.status === 'active' ? '在队' : item.status === 'left' ? '已离队' : '已撤销', active: item.status === 'active', actions: item.actions })),
          communities: me.viewer.capabilities.communities.map(office => office.community.title) },
        // The native activity workbench entry is always listed below, so skip its duplicate queue.
        queues: manage.queues.filter(queue => queue.key !== 'activities').map(queueView),
        seatReceipts: seats ? seats.docs.map(seatReceipt) : [], seatPage: 1, seatHasNext: Boolean(seats && seats.hasNextPage), seatError: !seats,
      });
    } catch (cause) {
      if (ticket === this._ticket) this.setData({ ...profile(session.user()), error: cause.message });
    } finally {
      if (ticket === this._ticket) this.setData({ refreshing: false });
    }
  },
  onPullDownRefresh() { this.refresh().finally(() => wx.stopPullDownRefresh()); },
  register() { navigation.go('auth', { mode: 'register' }); },
  reset() { navigation.go('auth', { mode: 'reset' }); },
  openTodo(event) { const { url, web } = event.currentTarget.dataset; navigation.open(url, web === true); },
  openQueue(event) { const { url, web } = event.currentTarget.dataset; navigation.open(url, web === true); },
  openTeam(event) { navigation.go('team-home', { slug: event.currentTarget.dataset.slug }); },
  openSeatReceipt(event) { const {kind,id}=event.currentTarget.dataset; if(['events','community-posts'].includes(kind)&&id)navigation.go('signup',{kind,id}); },
  async moreSeatReceipts() {
    if(this.data.seatLoading||!this.data.seatHasNext)return;
    const ticket=this._ticket,user=session.user(),page=this.data.seatPage+1;
    this.setData({seatLoading:true,seatError:false});
    try {
      const result=await v2.get('me/seat-requests',{page,limit:20},{required:true});
      if(ticket!==this._ticket||String(session.user()&&session.user().id)!==String(user&&user.id))return;
      this.setData({seatReceipts:[...this.data.seatReceipts,...result.docs.map(seatReceipt)],seatPage:page,seatHasNext:result.hasNextPage});
    } catch { if(ticket===this._ticket)this.setData({seatError:true}); }
    finally { if(ticket===this._ticket)this.setData({seatLoading:false}); }
  },
  openTeamPage(event) {
    const { page, team } = event.currentTarget.dataset;
    if (['team-profiles', 'team-honor-workspace'].includes(page) && /^[1-9]\d*$/.test(String(team))) navigation.go(page, { team });
  },
  async logout() {
    if (this._loggingOut) return;
    this._loggingOut = true;
    try {
      const result = await new Promise(resolve => wx.showModal({ title: '退出账号', content: '确认退出当前账号？', success: resolve }));
      if (!result.confirm) return;
      try { await http.request('/api/users/logout', { method: 'POST', required: true }); }
      catch { /* Local credentials must still be removed if the network is offline. */ }
      this._ticket = (this._ticket || 0) + 1; session.clear(); this.setData({ ...profile(null), me: null, queues: [], seatReceipts: [], seatHasNext: false });
    } finally { this._loggingOut = false; }
  },
  openAdmin() { navigation.copy(config.origin + '/admin', '后台链接已复制'); },
}));
