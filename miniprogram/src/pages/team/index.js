const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const team = require('../../lib/team');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
const fields = { recruitments: 'page', ownApplications: 'ownPage', memberships: 'membersPage', managedTeams: 'teamsPage' };
const empty = () => ({ docs: [], page: 1, hasNextPage: false, totalPages: 1, totalDocs: 0 });
const lifecycle = { active: '活跃', resting: '休整', archived: '已归档', unestablished: '尚未批准成立' };
const lifecycleEn = { active: 'Active', resting: 'Resting', archived: 'Archived', unestablished: 'Not yet approved' };
const text = {
  back: ['‹ 返回', '‹ Back'],
  kicker: ['TEAMS · 代表队事务', 'TEAM AFFAIRS'],
  heroTitle: ['代表队事务', 'Team affairs'],
  heroLead: ['了解招新安排，继续本人申请，查看队伍与成员记录。', 'See recruitment plans, continue your applications, and view team and membership records.'],
  busyNote: ['本次确认或保存尚未完成，完成后会核对最新记录。', 'This confirmation or save has not finished; the latest records will be checked afterwards.'],
  tabRecruitments: ['招新批次', 'Recruitment'],
  tabOwn: ['我的申请', 'My applications'],
  tabMemberships: ['我的队伍', 'My teams'],
  tabManaged: ['管理队伍', 'Managed teams'],
  introRecruitments: ['找到想加入的队伍', 'Find a team to join'],
  introOwn: ['申请进度与反馈', 'Progress and feedback'],
  introMemberships: ['本人成员关系', 'My memberships'],
  introManaged: ['当前可管理的队伍', 'Teams you can manage'],
  leadRecruitments: ['先看条件与时间安排，再填写入队申请。', 'Check requirements and schedule first, then apply.'],
  leadOwn: ['查看完整回执；允许修改时，可继续补充原申请。', 'View full receipts; when allowed, you can update the original application.'],
  leadMemberships: ['成员关系、公开简介与历史阵容分别记录。', 'Membership, public profiles and past rosters are recorded separately.'],
  leadManaged: ['操作范围由当前社群或队伍任职决定。', 'What you can do depends on your current community or team role.'],
  loadingLabel: ['正在读取代表队记录', 'Loading team records'],
  retryRead: ['重试读取记录', 'Retry loading records'],
  totalPrefix: ['共 ', 'Total '],
  loadedPrefix: [' 条，已加载 ', ', loaded '],
  loadedSuffix: [' 条', ''],
  refresh: ['刷新', 'Refresh'],
  applicationPrefix: ['申请 ', 'Application '],
  membershipPrefix: ['成员记录 ', 'Membership '],
  start: ['开始', 'Starts'],
  end: ['截止', 'Closes'],
  viewAndApply: ['查看条件并申请', 'View requirements and apply'],
  viewStatus: ['查看批次与申请状态', 'View batch and application status'],
  updatedPrefix: ['更新于 ', 'Updated '],
  reviewNote: ['处理意见', 'Review note'],
  viewAndEdit: ['查看回执并修改', 'View receipt and edit'],
  viewReceipt: ['查看已提交回执', 'View submitted receipt'],
  withdraw: ['撤回入队申请', 'Withdraw application'],
  profileNote: ['公开简介由本人另行确认。历史记录会继续保留。', 'Your public profile is confirmed separately. History records are kept.'],
  leave: ['办理本人离队', 'Leave the team'],
  workbench: ['队伍工作台', 'Team workbench'],
  members: ['成员管理', 'Members'],
  collapseLinks: ['收起队伍资料与荣誉入口', 'Hide team profile and honor links'],
  expandLinks: ['展开队伍资料与荣誉入口', 'Show team profile and honor links'],
  linksTitle: ['队伍资料与荣誉', 'Team profile and honors'],
  profiles: ['公开简介与我的展示设置', 'Public profiles and my display settings'],
  honors: ['已核验荣誉档案', 'Verified honors'],
  honorWorkspace: ['该队荣誉投稿与审核', 'Team honor submissions and reviews'],
  emptyRecruitments: ['暂无可查看的招新批次', 'No recruitment batches to view'],
  emptyOwn: ['尚未提交入队申请', 'No team applications yet'],
  emptyMemberships: ['暂无本人成员关系记录', 'No membership records'],
  emptyManaged: ['暂无当前可管理队伍', 'No teams to manage'],
  emptyOwnHint: ['可先了解各队安排，选择合适的招新批次。', 'Learn about each team first, then choose a recruitment batch.'],
  emptyHint: ['下拉刷新可查看最新记录。', 'Pull down to refresh.'],
  viewRecruitments: ['查看招新批次', 'View recruitment'],
  loadMore: ['加载更多', 'Load more'],
  orgTitle: ['建队与组织事务', 'Founding and organization'],
  orgNote: ['建队计划单独提交，处理进度留在本人回执中。', 'Team founding plans are submitted separately; progress stays on your receipt.'],
  myEstablishments: ['我的建队申请', 'My founding applications'],
  establish: ['申请建立代表队', 'Apply to found a team'],
  reviewEstablishments: ['建队申请审核', 'Review founding applications'],
  honorEntry: ['我的荣誉投稿与当前审核入口', 'My honor submissions and reviews'],
  bottomNote: ['入队录取与成员关系分别记录。社群任职、平台角色及简介公开授权由各自流程维护。', 'Admission and membership are recorded separately. Community roles, platform roles and profile publishing are handled by their own processes.'],
};
const unique = docs => docs.filter((doc, index) => docs.findIndex(value => String(value.id) === String(doc.id)) === index);
function decorate(doc, section) {
  return { ...doc, actions: doc.actions || {}, dateText: format.date(doc.updatedAt), startText: format.date(doc.startAt), endText: format.date(doc.endAt),
    stateText: i18n.message(doc.state),
    statusText: section === 'memberships' ? doc.status === 'active' ? i18n.t('成员关系未撤销', 'Active member') : doc.leftAt ? i18n.t('已离队', 'Left the team') : i18n.t('已撤销', 'Revoked')
      : section === 'managedTeams' ? (lifecycle[doc.teamStatus] ? i18n.t(lifecycle[doc.teamStatus], lifecycleEn[doc.teamStatus]) : i18n.t('状态待核对', 'Status to be checked')) : team.labels[doc.status] || i18n.message(doc.state) || i18n.t('状态待核对', 'Status to be checked') };
}
Page(withVisualTheme({
  data: { needsLogin: false, loading: false, error: '', operationError: '', done: '', busy: false, actions: {},
    view: 'recruitments', docs: [], page: 1, hasMore: false, total: 0, expandedRecord: null, recruitments: empty(), ownApplications: empty(), memberships: empty(), managedTeams: empty() },
  ...actions,
  onLoad(options = {}) {
    i18n.bind(this, text);
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate(); this.setData({ view: fields[options.view] ? options.view : 'recruitments' });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this._resumeRead = false; this.invalidate(); this.resetPrivate(); }
    });
  },
  invalidate() { this._scope = (this._scope || 0) + 1; this._operation = (this._operation || 0) + 1; },
  valid(scope) { return !this._disposed && this._visible !== false && scope === (this._scope || 0) && this._identity === identity() && Boolean(identity()); },
  beginWrite() { this._pendingWrite = true; return this._writeID = (this._writeID || 0) + 1; },
  writeValid(context, actor, writeID) { return !this._disposed && context === this._context && actor === identity() && writeID === this._writeID; },
  async finishWrite(writeID) {
    if (writeID !== this._writeID) return;
    this._pendingWrite = false;
    if (this._disposed) return;
    this.setData({ busy: false });
    if (this._visible && this._resumeRead) { this._resumeRead = false; await this.load(); }
  },
  resetPrivate() { this.setData({ needsLogin: !session.user(), loading: false, error: '', operationError: '', done: '', busy: Boolean(this._pendingWrite), actions: {},
    docs: [], page: 1, hasMore: false, total: 0, expandedRecord: null, recruitments: empty(), ownApplications: empty(), memberships: empty(), managedTeams: empty() }); },
  onShow() {
    i18n.navTitle('代表队招新与记录', 'Team Recruitment and Records');
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, busy: Boolean(this._pendingWrite) }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.busy) return this.load(true); },
  project() {
    const result = this.data[this.data.view];
    this.setData({ docs: result.docs, page: result.page, hasMore: Boolean(result.hasNextPage), total: result.totalDocs || 0 });
  },
  tab(event) {
    const view = event.currentTarget.dataset.view;
    if (!fields[view] || this.data.busy || view === this.data.view) return;
    this.setData({ view, expandedRecord: null }); this.project();
  },
  toggleRecord(event) {
    const record = this.data.docs.find(doc => String(doc.id) === String(event.currentTarget.dataset.id));
    if (record) this.setData({ expandedRecord: this.data.expandedRecord === record.id ? null : record.id });
  },
  async load(more = false) {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (more && (this.data.loading || !this.data.hasMore)) return;
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1, view = this.data.view;
    const query = Object.keys(fields).map(key => `${fields[key]}=${more ? this.data[key].page + (key === view ? 1 : 0) : 1}`).join('&');
    this.setData({ loading: true, error: '' });
    try {
      const result = await http.request('/api/miniapp/team?' + query, { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      const values = { loading: false, actions: result.actions || {} };
      for (const key of Object.keys(fields)) {
        if (!result[key] || !Array.isArray(result[key].docs)) throw new Error(i18n.t('代表队记录暂不可用，请重试', 'Team records are unavailable. Please try again.'));
        if (more && key !== view) continue;
        const docs = result[key].docs.map(doc => decorate(doc, key));
        values[key] = { ...result[key], docs: unique((more ? this.data[key].docs : []).concat(docs)) };
      }
      this.setData(values); this.project();
    } catch (cause) {
      if (this.valid(scope) && ticket === this._loadTicket) {
        if ([401, 403].includes(cause.status)) this.resetPrivate();
        this.setData({ loading: false, error: cause.message, ...(cause.status === 401 ? { needsLogin: true } : {}) });
      }
    }
  },
  openRecruitment(event) {
    if (this.data.loading || this.data.busy) return;
    const { id, own } = event.currentTarget.dataset;
    const section = own ? 'ownApplications' : 'recruitments';
    const doc = this.data[section].docs.find(value => String(value.id) === String(id));
    if (doc && doc.actions.view) navigation.go('signup', { kind: 'team', id: own ? doc.recruitmentID : doc.id });
  },
  apply() { if (!this.data.loading && this.data.actions.establish) navigation.go('team-apply'); },
  applications() { navigation.go('team-apply'); },
  reviewEstablishments() { if (!this.data.loading && this.data.actions.reviewEstablishments) navigation.go('team-review', { mode: 'establishment' }); },
  workbench(event) {
    const doc = this.data.managedTeams.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (doc && doc.actions.workbench && !this.data.loading && !this.data.busy) navigation.go('team-review', { team: doc.id });
  },
  members(event) {
    const doc = this.data.managedTeams.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (doc && doc.actions.workbench && !this.data.loading && !this.data.busy) navigation.go('team-members', { team: doc.id });
  },
  teamPage(event) {
    if (this.data.loading || this.data.busy) return;
    const { id, page } = event.currentTarget.dataset;
    if (!['team-profiles', 'team-honors', 'team-honor-workspace'].includes(page)) return;
    const doc = this.data.docs.find(value => String(value.id) === String(id));
    const teamID = doc && (this.data.view === 'managedTeams' ? doc.id : doc.teamID);
    if (/^[1-9]\d*$/.test(String(teamID))) navigation.go(page, { team: teamID });
  },
  async operate(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.loading || this.data.busy) return;
    const { id, operation } = event.currentTarget.dataset;
    const section = operation === 'leave' ? 'memberships' : operation === 'withdraw-join' ? 'ownApplications' : '';
    if (!section) return;
    const doc = this.data[section].docs.find(value => String(value.id) === String(id));
    if (!doc || !doc.actions[operation === 'leave' ? 'leave' : 'withdraw']) return;
    const scope = this._scope || 0, operationTicket = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: operation === 'leave' ? i18n.t('办理本人离队', 'Leave the team') : i18n.t('撤回入队申请', 'Withdraw application'),
        content: operation === 'leave' ? i18n.t('确认办理本人离队？保存后该成员关系将结束；微信群成员情况请另行联系管理员。', 'Leave this team? Your membership ends once saved; contact an admin about WeChat group membership.') : i18n.t('确认撤回这份入队申请？原申请记录会保留。', 'Withdraw this team application? The original record is kept.'),
        success: value => resolve(value.confirm), fail: () => reject(new Error(i18n.message('确认未完成，请重试'))) }));
      if (!answer || !this.valid(scope) || operationTicket !== this._operation) return;
      const response = await team.post({ operation, id: doc.id, revision: doc.updatedAt, ...(operation === 'leave' ? { note: '' } : {}) });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error(i18n.t('保存结果暂不可用，请刷新记录核对', 'The save result is unavailable. Refresh the records to check.'));
      const saved = { ...doc, actions: {} };
      for (const key of ['status', 'updatedAt', 'reviewNote', 'joinedAt', 'revokedAt', 'leftAt']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      this.setData({ [section]: { ...this.data[section], docs: this.data[section].docs.map(value => String(value.id) === String(id) ? decorate(saved, section) : value) },
        done: operation === 'leave' ? i18n.t('本人离队已保存，请查看最新成员记录', 'You have left the team. See the latest membership record.') : i18n.t('入队申请已撤回，请查看最新回执', 'Application withdrawn. See the latest receipt.') });
      this.project(); await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
}));
