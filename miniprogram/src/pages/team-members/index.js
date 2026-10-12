const http = require('../../lib/http');
const session = require('../../lib/session');
const team = require('../../lib/team');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
Page({
  data: { needsLogin: false, loading: false, error: '', operationError: '', done: '', allowed: false, busy: false,
    teamDoc: null, docs: [], page: 1, hasMore: false },
  ...actions,
  onLoad(options = {}) {
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
  resetPrivate() { this.setData({ needsLogin: !session.user(), loading: false, error: '', operationError: '', done: '', allowed: false, busy: Boolean(this._pendingWrite), teamDoc: null, docs: [], page: 1, hasMore: false }); },
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
  async load(more = false) {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (more && (this.data.loading || !this.data.hasMore)) return;
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    if (!this._teamID) { this.setData({ error: '请从可管理队伍入口进入成员管理', loading: false }); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1, page = more ? this.data.page + 1 : 1;
    this.setData({ loading: true, error: '' });
    try {
      const result = await http.request(`/api/miniapp/team/${encodeURIComponent(this._teamID)}/workbench?page=1&membersPage=${page}&batchesPage=1&status=pending`, { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      if (!result || !result.team || String(result.team.id) !== String(this._teamID) || !result.members || !Array.isArray(result.members.docs)) throw new Error('成员关系记录暂不可用，请重试');
      const mapped = result.members.docs.map(doc => {
        const previous = this.data.docs.find(value => String(value.id) === String(doc.id) && value.updatedAt === doc.updatedAt);
        return { ...doc, actions: doc.actions || {}, statusText: doc.status === 'active' ? '成员关系未撤销' : doc.leftAt ? '已离队' : '已撤销',
          joinedText: format.date(doc.joinedAt), endText: format.date(doc.leftAt || doc.revokedAt), noteDraft: previous ? previous.noteDraft || '' : '' };
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
      if (!(doc.noteDraft || '').trim()) throw new Error('请填写具体的成员关系撤销原因');
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: '撤销本队成员关系',
        content: '确认撤销这条队伍成员关系？记录会保留。微信群成员情况请另行联系管理员处理。',
        success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const response = await team.post({ operation: 'revoke', id: doc.id, revision: doc.updatedAt, note: doc.noteDraft.trim() });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error('撤销结果暂不可用，请刷新记录核对');
      const saved = { ...doc, actions: {}, noteDraft: '' };
      for (const key of ['status', 'updatedAt', 'joinedAt', 'revokedAt', 'leftAt']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      saved.statusText = saved.status === 'active' ? '成员关系未撤销' : saved.leftAt ? '已离队' : '已撤销'; saved.endText = format.date(saved.leftAt || saved.revokedAt);
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(doc.id) ? saved : value), done: '成员关系撤销已保存' });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
});
