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
const unique = docs => docs.filter((doc, index) => docs.findIndex(value => String(value.id) === String(doc.id)) === index);
function decorate(doc, section) {
  return { ...doc, actions: doc.actions || {}, dateText: format.date(doc.updatedAt), startText: format.date(doc.startAt), endText: format.date(doc.endAt),
    statusText: section === 'memberships' ? doc.status === 'active' ? '成员关系未撤销' : doc.leftAt ? '已离队' : '已撤销'
      : section === 'managedTeams' ? lifecycle[doc.teamStatus] || '状态待核对' : team.labels[doc.status] || doc.state || '状态待核对' };
}
Page({
  data: { needsLogin: false, loading: false, error: '', operationError: '', done: '', busy: false, actions: {},
    view: 'recruitments', docs: [], page: 1, hasMore: false, total: 0, recruitments: empty(), ownApplications: empty(), memberships: empty(), managedTeams: empty() },
  ...actions,
  onLoad(options = {}) {
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
    docs: [], page: 1, hasMore: false, total: 0, recruitments: empty(), ownApplications: empty(), memberships: empty(), managedTeams: empty() }); },
  onShow() {
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, busy: Boolean(this._pendingWrite) }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); },
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
    this.setData({ view }); this.project();
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
        if (!result[key] || !Array.isArray(result[key].docs)) throw new Error('代表队记录暂不可用，请重试');
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
    if (!['team-profiles', 'team-honors'].includes(page)) return;
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
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: operation === 'leave' ? '办理本人离队' : '撤回入队申请',
        content: operation === 'leave' ? '确认办理本人离队？保存后该成员关系将结束；微信群成员情况请另行联系管理员。' : '确认撤回这份入队申请？原申请记录会保留。',
        success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer || !this.valid(scope) || operationTicket !== this._operation) return;
      const response = await team.post({ operation, id: doc.id, revision: doc.updatedAt, ...(operation === 'leave' ? { note: '' } : {}) });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error('保存结果暂不可用，请刷新记录核对');
      const saved = { ...doc, actions: {} };
      for (const key of ['status', 'updatedAt', 'reviewNote', 'joinedAt', 'revokedAt', 'leftAt']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      this.setData({ [section]: { ...this.data[section], docs: this.data[section].docs.map(value => String(value.id) === String(id) ? decorate(saved, section) : value) },
        done: operation === 'leave' ? '本人离队已保存，请查看最新成员记录' : '入队申请已撤回，请查看最新回执' });
      this.project(); await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
});
