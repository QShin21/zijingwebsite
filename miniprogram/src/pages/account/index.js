function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const session = require('../../lib/session');
const http = require('../../lib/http');
const v2 = require('../../lib/v2');
const navigation = require('../../lib/navigation');
const config = require('../../config');
const archive = require('../../lib/archive');
const { actions } = require('../../lib/page');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, setLocale() {}, subscribe: () => () => {} }; })();
const text = {
  mine: ["我的", "Me"],
  notSignedIn: ["还未登录", "Not signed in"],
  todo: ["待办", "To-do"],
  signups: ["报名", "Sign-ups"],
  applications: ["申请", "Applications"],
  checking: ["正在核对账号与管理权限", "Checking account and permissions"],
  reloadAccount: ["重新获取账号资料", "Reload account"],
  accountHint: ["网站与小程序使用同一紫荆账号，注册时验证邮箱。", "The website and mini program share one Zijing account; your email is verified at registration."],
  webOnlyPrefix: ["请在网页端完成 · ", "Complete on the website · "],
  todoEmpty: ["暂时没有需要处理的事项", "Nothing to do right now"],
  todoEmptyBody: ["去日程看看最近的活动吧。", "Check the schedule for upcoming events."],
  browseEvents: ["浏览日程", "Browse schedule"],
  mySchedule: ["我的赛程", "My schedule"],
  allSignups: ["全部报名", "All sign-ups"], allApplications: ["全部申请", "All applications"],
  archivedUpcomingPrefix: ["已归档 ", ""], archivedUpcomingSuffix: [" 项赛程，可在“全部报名”中查看并撤销归档。", " archived event(s). View or unarchive them in All sign-ups."],
  archivedApplicationsPrefix: ["已归档 ", ""], archivedApplicationsSuffix: [" 项申请，可在“全部申请”中查看并撤销归档。", " archived application(s). View or unarchive them in All applications."],
  allUpcomingArchived: ["近期赛程均已归档", "All upcoming events are archived"], allUpcomingArchivedBody: ["报名仍然有效，撤销归档后会重新显示在这里。", "Your sign-ups still count. Unarchive them to show them here again."],
  viewAllSignups: ["查看全部报名", "View all sign-ups"],
  allApplicationsArchived: ["申请均已归档", "All applications are archived"], allApplicationsArchivedBody: ["归档不会撤回申请，撤销归档后会重新显示在这里。", "Archiving doesn't withdraw an application. Unarchive it to show it here again."],
  viewAllApplications: ["查看全部申请", "View all applications"], browseSchedule: ["浏览全部日程 ›", "Browse full schedule ›"],
  allEvents: ["全部日程", "All events"],
  noSignups: ["还没有报名记录", "No sign-ups yet"],
  noSignupsBody: ["报名开放的活动会标注「报名开放」。", "Events open for sign-up are marked “Sign-up open”."],
  viewEvents: ["查看活动", "View events"],
  seatReceipts: ["我的选座回执", "My seat receipts"],
  seatEmpty: ["提交选座申请后可在这里查看状态与票据。", "After requesting seats, check status and tickets here."],
  seatError: ["选座记录加载失败，请刷新后重试。", "Seat records failed to load. Refresh and try again."],
  seatMore: ["查看更多选座记录", "Load more seat records"],
  progress: ["申请进度", "Application progress"],
  noApplications: ["还没有申请记录", "No applications yet"],
  noApplicationsBody: ["社群管理员、骨干招新、建队与入队申请都会记录在这里。", "Community admin, staff, new team and team applications appear here."],
  adminApplication: ["社群管理员申请", "Community admin application"],
  adminApplicationHint: ["处理结果与名片授权", "Results and contact card consent"],
  staffApplication: ["骨干招新申请", "Staff application"],
  staffApplicationHint: ["继续填写与查看回执", "Continue or view receipt"],
  teamApplication: ["入队申请", "Team application"],
  teamApplicationHint: ["选拔进度与退回意见", "Trial progress and feedback"],
  honorSubmission: ["荣誉投稿", "Honor submissions"],
  honorSubmissionHint: ["草稿、材料与审核结果", "Drafts, evidence and review results"],
  myTeams: ["我的队伍", "My teams"],
  editProfile: ["编辑我的简介", "Edit my profile"],
  submitHonor: ["投稿荣誉", "Submit honor"],
  leaveTeam: ["办理离队", "Leave team"],
  noTeams: ["暂无代表队成员记录", "No team memberships"],
  noTeamsBody: ["入队由社群管理员人工选拔，录取不授予管理权限。", "Community admins select members by hand; acceptance grants no admin rights."],
  viewTrials: ["查看选拔中心", "View trials"],
  console: ["管理台", "Management"],
  consoleHint: ["按当前任职核对可处理的社群、队伍与对象。", "Communities, teams and items you can handle with your current roles."],
  allDone: ["已全部处理", "All handled"],
  activityForms: ["活动问卷与报名", "Activity forms and sign-ups"],
  activityFormsHint: ["名单查看与统计", "Lists and statistics"],
  managedTeams: ["我可管理的队伍", "Teams I manage"],
  managedTeamsHint: ["招新、成员与审核", "Recruitment, members and reviews"],
  appearance: ["外观", "Appearance"],
  appearanceHint: ["选择首页风格", "Choose a home page style"],
  selectedSuffix: ["，已选择", ", selected"],
  language: ["语言", "Language"],
  languageLabel: ["切换语言：中文 / English", "Switch language: 中文 / English"],
  privacy: ["隐私说明", "Privacy"],
  contact: ["联系与合作", "Contact"],
  resetPassword: ["重设密码", "Reset password"],
  admin: ["内容管理后台", "Content admin"],
  copyWebLink: ["复制网页链接", "Copy web link"],
  logout: ["退出账号", "Sign out"],
  brand: ["竞在紫荆", "Zijing Esports"]
};
const roleLabelsEn = { president: 'President', vicePresident: 'Vice president', backbone: 'Club staff', communityAdmin: 'Community admin', honoraryBackbone: 'Honorary staff', member: 'Club member' };
const affiliationsEn = { tsinghua: 'Tsinghua user', peer: 'Partner-school student', external: 'External' };
const seatStatusEn = { pending: 'Pending', confirmed: 'Confirmed', rejected: 'Rejected', cancelled: 'Cancelled', revoked: 'Revoked' };
const seatName = seat => i18n.locale() === 'en' ? 'Row ' + String(seat).split('-').join(' Seat ') : String(seat).split('-').join('排') + '座';
const roleLabels = { president: '社长', vicePresident: '副社长', backbone: '社团骨干', communityAdmin: '社群管理员', honoraryBackbone: '荣誉骨干', member: '社团成员' };

const affiliations = { tsinghua: '清华用户', peer: '友校学生', external: '校外人士' };
const seatStatusLabels = { pending: '待审核', confirmed: '已确认', rejected: '已驳回', cancelled: '已取消', revoked: '已撤销' };
function seatReceipt(item) {
  const request=item.request;
  return { key:item.key, title:item.title, kind:item.kind, id:item.activityID,
    summary:request ? (seatStatusLabels[request.status] ? i18n.t(seatStatusLabels[request.status], seatStatusEn[request.status]) : i18n.t('处理中','Processing'))+' · '+(request.seats.length ? request.seats.map(seatName).join(i18n.t('、',', ')) : request.requestedCount+i18n.t(' 个座位',' seat(s)')) : i18n.t('活动暂不可访问','Activity unavailable') };
}

function profile(user) {
  return { user, campus: session.campus(user), affiliation: user ? i18n.t(affiliations[user.affiliation || 'tsinghua'], affiliationsEn[user.affiliation || 'tsinghua']) : '', initial: user ? v2.initial(user.name) : 'Z',
    role: user ? (user.roles.length ? user.roles : ['member']).map(role => roleLabels[role] ? i18n.t(roleLabels[role], roleLabelsEn[role]) : role).join(i18n.t('、', ', ')) : '' };
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
    teamApplicationParams: { view: 'ownApplications' }, membershipParams: { view: 'memberships' }, managedTeamParams: { view: 'managedTeams' },
    signupRecordParams: { mode: 'signups' }, applicationRecordParams: { mode: 'applications' } },
  ...actions,
  onLoad() { i18n.bind(this, text); },
  onShow() { i18n.navTitle('我的紫荆', 'My Zijing'); this.refresh(); },
  // Interface language switch; the reload re-reads server-localized content.
  switchLocale() {
    i18n.setLocale(i18n.locale() === 'en' ? 'zh' : 'en');
    i18n.navTitle('我的紫荆', 'My Zijing');
    this.refresh();
  },
  onHide() { this._ticket = (this._ticket || 0) + 1; this.setData({ refreshing: false }); },
  async refresh() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const user = session.user();
    // A different (or no) account ends the previous session's archive write.
    if (!user || !this.data.user || String(this.data.user.id) !== String(user.id)) this._write = null;
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
        me: { todo: me.todo.map(todoView), upcoming: this.pendingWrite(me.upcoming.map(v2.event)), applications: this.pendingWrite(me.applications.map(v2.application)), counts: me.counts,
          memberships: me.memberships.map(item => ({ id: item.id, title: item.team.title, slug: item.team.slug, teamID: item.team.id, status: item.status === 'active' ? i18n.t('在队', 'Active') : item.status === 'left' ? i18n.t('已离队', 'Left') : i18n.t('已撤销', 'Revoked'), active: item.status === 'active', actions: item.actions })),
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
  // Rows of an archive write still in flight stay locked after a refresh.
  pendingWrite(list) {
    const write = this._write, user = session.user();
    return write && user && String(user.id) === write.userId ? archive.mark(list, write.target, { archiving: true }) : list;
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
      const result = await new Promise(resolve => wx.showModal({ title: i18n.t('退出账号', 'Sign out'), content: i18n.t('确认退出当前账号？', 'Sign out of this account?'), ...(i18n.locale() === 'en' ? { confirmText: 'Sign out', cancelText: 'Cancel' } : {}), success: resolve }));
      if (!result.confirm) return;
      try { await http.request('/api/users/logout', { method: 'POST', required: true }); }
      catch { /* Local credentials must still be removed if the network is offline. */ }
      this._ticket = (this._ticket || 0) + 1; this._write = null; session.clear(); this.setData({ ...profile(null), me: null, queues: [], seatReceipts: [], seatHasNext: false });
    } finally { this._loggingOut = false; }
  },
  // 归档仅从总览隐藏本人记录。写入有独立令牌，与读取票据分离：下拉刷新或离页不会作废已成功的写入，
  // 只有换账号/退出才丢弃结果；锁只由持有令牌的写入释放。
  async setArchive(event) {
    const { target, archived } = event.currentTarget.dataset;
    if (this._write || !archive.valid(target) || !this.data.me) return;
    const user = session.user();
    if (!user) return navigation.login();
    const next = archived !== true;
    const token = this._write = { target, userId: String(user.id), credential: session.token() };
    // Session boundary: logout or an account change clears _write, so an old session's reply never writes back.
    const same = () => this._write === token && session.token() === token.credential && this.data.me && String(session.user() && session.user().id) === token.userId && this.data.user && String(this.data.user.id) === token.userId;
    const mark = patch => ({ 'me.upcoming': archive.mark(this.data.me.upcoming, target, patch), 'me.applications': archive.mark(this.data.me.applications, target, patch) });
    this.setData(mark({ archiving: true }));
    try {
      const result = await archive.set(target, next);
      if (!same()) return;
      const archivedNow = result && typeof result.archived === 'boolean' ? result.archived : next;
      if (archivedNow) {
        // The overview never lists archived records: hide it now, even if the follow-up refresh fails.
        const upcoming = this.data.me.upcoming.filter(item => item.archiveTarget !== target), applications = this.data.me.applications.filter(item => item.archiveTarget !== target);
        const counts = Object.assign({}, this.data.me.counts, {
          archivedUpcoming: (this.data.me.counts.archivedUpcoming || 0) + this.data.me.upcoming.length - upcoming.length,
          archivedApplications: (this.data.me.counts.archivedApplications || 0) + this.data.me.applications.length - applications.length });
        this.setData({ 'me.upcoming': upcoming, 'me.applications': applications, 'me.counts': counts });
      } else this.setData(mark({ archiving: false, archived: false }));
      wx.showToast({ title: archivedNow ? i18n.t('已归档', 'Archived') : i18n.t('已撤销归档', 'Unarchived'), icon: 'none' });
      if (this._write === token) this._write = null;
      await this.refresh();
    } catch (cause) {
      if (same()) {
        this.setData(mark({ archiving: false }));
        wx.showToast({ title: (cause && cause.message && i18n.message(cause.message)) || (next ? i18n.t('归档失败，请稍后重试', "Couldn't archive. Please try again later.") : i18n.t('撤销归档失败，请稍后重试', "Couldn't unarchive. Please try again later.")), icon: 'none' });
      }
    } finally { if (this._write === token) this._write = null; }
  },
  openAdmin() { navigation.copy(config.origin + '/admin', i18n.t('后台链接已复制', 'Admin link copied')); },
}));
