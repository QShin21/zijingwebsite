function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const http = require('../../lib/http');
const session = require('../../lib/session');
const team = require('../../lib/team');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回工作台', '‹ Back to workbench'],
  currentTeam: ['当前队伍', 'Current team'],
  kickerSuffix: [' · 成员', ' · Members'],
  title: ['成员关系', 'Memberships'],
  lead: ['查看当前成员与历史关系，依据实际情况记录撤销原因。', 'Review current and past memberships and record the actual reason for any revocation.'],
  busyNote: ['本次确认或保存尚未完成，完成后会核对最新记录。', 'This confirmation or save is still in progress; the latest record will be checked when it finishes.'],
  checking: ['正在核对管理权限与成员记录', 'Checking permissions and membership records'],
  retryRead: ['重试读取记录', 'Reload records'],
  noAccessTitle: ['当前暂无此队伍的成员管理权限', 'You cannot manage this team\'s members'],
  noAccessBody: ['可刷新核对当前社群或队伍任职的授权。', 'Refresh to re-check your community or team role.'],
  recheck: ['重新核对权限', 'Re-check permissions'],
  basisLabel: ['当前资格以成员关系为准', 'Membership records determine current eligibility'],
  basisBody: ['公开简介与历史阵容单独维护。撤销后保留历史记录，仅限现任队员的权限随之停止。', 'Public profiles and past rosters are kept separately. Revocation keeps the history and ends member-only permissions.'],
  records: ['成员记录', 'Membership records'],
  refresh: ['刷新核对', 'Refresh'],
  relationPrefix: ['关系 ', 'Membership '],
  joined: ['入队', 'Joined'],
  ended: ['关系结束', 'Ended'],
  hideHandling: ['收起关系处理', 'Hide actions'],
  showHandling: ['处理这条成员关系', 'Handle this membership'],
  revokeTitle: ['撤销本队成员关系', 'Revoke membership'],
  revokeHint: ['记录会保留。微信群成员情况需另行联系管理员处理。', 'The record is kept. WeChat group membership is handled separately by admins.'],
  reasonLabel: ['具体撤销原因 · 必填', 'Reason for revocation · required'],
  reasonPlaceholder: ['请说明需要撤销的具体原因', 'Explain the specific reason'],
  reasonHint: ['最多 1000 字，保存前会再次确认。', 'Up to 1000 characters; you will confirm before saving.'],
  noAction: ['当前暂无可执行撤销操作。', 'No revocation is available right now.'],
  emptyTitle: ['暂无本队成员关系记录', 'No membership records yet'],
  emptyBody: ['录取申请后会产生对应成员记录。', 'Accepting an application creates a membership record.'],
  loadMore: ['加载更多成员记录', 'Load more records'],
};
const statusText = doc => doc.status === 'active' ? i18n.t('成员关系未撤销', 'Active membership') : doc.leftAt ? i18n.t('已离队', 'Left the team') : i18n.t('已撤销', 'Revoked');

Page(withVisualTheme({
  data: { needsLogin: false, loading: false, error: '', operationError: '', done: '', allowed: false, busy: false,
    teamDoc: null, docs: [], expandedId: '', page: 1, hasMore: false },
  ...actions,
  toggleRecord(event) {
    if (this.data.busy || this.data.loading || this.data.imageBusy) return;
    const doc = this.data.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (doc) this.setData({ expandedId: this.data.expandedId === doc.id ? '' : doc.id });
  },
  onLoad(options = {}) {
    i18n.bind(this, text);
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate(); this._teamID = options.team || options.id || '';
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
  resetPrivate() { this.setData({ needsLogin: !session.user(), loading: false, error: '', operationError: '', done: '', allowed: false, busy: Boolean(this._pendingWrite), teamDoc: null, docs: [], expandedId: '', page: 1, hasMore: false }); },
  onShow() {
    this._visible = true;
    i18n.navTitle('队伍成员管理', 'Team members');
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, busy: Boolean(this._pendingWrite) }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.busy) return this.load(true); },
  async load(more = false) {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (more && (this.data.loading || !this.data.hasMore)) return;
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    if (!this._teamID) { this.setData({ error: i18n.t('请从可管理队伍入口进入成员管理', 'Open member management from a team you manage'), loading: false }); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1, page = more ? this.data.page + 1 : 1;
    this.setData({ loading: true, error: '' });
    try {
      const result = await http.request(`/api/miniapp/team/${encodeURIComponent(this._teamID)}/workbench?page=1&membersPage=${page}&batchesPage=1&status=pending`, { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      if (!result || !result.team || String(result.team.id) !== String(this._teamID) || !result.members || !Array.isArray(result.members.docs)) throw new Error(i18n.t('成员关系记录暂不可用，请重试', 'Membership records are unavailable. Please try again.'));
      const mapped = result.members.docs.map(doc => {
        const previous = this.data.docs.find(value => String(value.id) === String(doc.id) && value.updatedAt === doc.updatedAt);
        return { ...doc, actions: doc.actions || {}, statusText: statusText(doc),
          joinedText: format.date(doc.joinedAt), endText: doc.leftAt || doc.revokedAt ? format.date(doc.leftAt || doc.revokedAt) : '', noteDraft: previous ? previous.noteDraft || '' : '' };
      });
      const docs = (more ? this.data.docs : []).concat(mapped);
      this.setData({ allowed: true, loading: false, teamDoc: result.team,
        docs: docs.filter((doc, index) => docs.findIndex(value => String(value.id) === String(doc.id)) === index),
        page: result.members.page || page, hasMore: Boolean(result.members.hasNextPage) });
    } catch (cause) {
      if (this.valid(scope) && ticket === this._loadTicket) {
        if ([401, 403].includes(cause.status)) this.resetPrivate();
        this.setData({ loading: false, error: cause.message, ...(cause.status === 401 ? { needsLogin: true } : {}) });
      }
    }
  },
  note(event) {
    if (this.data.busy) return;
    const index = this.data.docs.findIndex(doc => String(doc.id) === String(event.currentTarget.dataset.id));
    if (index >= 0) this.setData({ [`docs[${index}].noteDraft`]: event.detail.value });
  },
  async revoke(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || !this.data.allowed || this.data.loading || this.data.busy) return;
    const doc = this.data.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (!doc || !doc.actions.revoke) return;
    const scope = this._scope || 0, operation = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      if (!(doc.noteDraft || '').trim()) throw new Error(i18n.t('请填写具体的成员关系撤销原因', 'Enter the specific reason for revoking this membership'));
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: i18n.t('撤销本队成员关系', 'Revoke membership'),
        content: i18n.t('确认撤销这条队伍成员关系？记录会保留。微信群成员情况请另行联系管理员处理。', 'Revoke this team membership? The record is kept. Contact admins separately about the WeChat group.'),
        success: value => resolve(value.confirm), fail: () => reject(new Error(i18n.message('确认未完成，请重试'))) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const response = await team.post({ operation: 'revoke', id: doc.id, revision: doc.updatedAt, note: doc.noteDraft.trim() });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error(i18n.t('撤销结果暂不可用，请刷新记录核对', 'The revocation result is unavailable. Refresh to check.'));
      const saved = { ...doc, actions: {}, noteDraft: '' };
      for (const key of ['status', 'updatedAt', 'joinedAt', 'revokedAt', 'leftAt']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      saved.statusText = statusText(saved); saved.endText = saved.leftAt || saved.revokedAt ? format.date(saved.leftAt || saved.revokedAt) : '';
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(doc.id) ? saved : value), done: i18n.t('成员关系撤销已保存', 'Revocation saved') });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
}));
