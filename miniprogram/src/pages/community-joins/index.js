function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const http = require('../../lib/http');
const session = require('../../lib/session');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
const labels = { requested: '已记录意向，待联系管理员', friendReported: '本人已报告好友申请，待核实', awaitingInvite: '好友已人工确认通过，等待拉群', joined: '管理员已人工确认进群', withdrawn: '网站意向已撤回' };
Page(withVisualTheme({
  data: { title: '', needsLogin: false, allowed: false, loading: false, error: '', operationError: '', done: '',
    docs: [], page: 1, hasMore: false, busy: false },
  ...actions,
  onLoad(options = {}) {
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate(); this._game = options.id || '';
    this.setData({ title: options.title || '游戏社群' });
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
  resetPrivate() { this.setData({ needsLogin: !session.user(), allowed: false, loading: false, error: '', operationError: '', done: '', docs: [], page: 1, hasMore: false, busy: Boolean(this._pendingWrite) }); },
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
  onReachBottom() { if (this.data.hasMore && !this.data.loading) return this.load(true); },
  async load(more = false) {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (more && (this.data.loading || !this.data.hasMore)) return;
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    if (!this._game) { this.setData({ error: '请从游戏社群页进入人工进群管理', loading: false }); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1, page = more ? this.data.page + 1 : 1;
    this.setData({ loading: true, error: '' });
    try {
      const result = await http.request(`/api/miniapp/community/${encodeURIComponent(this._game)}/join?mode=manage&page=${page}`, { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      if (!result || result.canHandle !== true) { this.setData({ allowed: false, docs: [], loading: false, hasMore: false }); return; }
      if (!Array.isArray(result.docs)) throw new Error('进群管理列表暂不可用，请重试');
      const mapped = result.docs.map(doc => {
        const previous = this.data.docs.find(value => String(value.id) === String(doc.id) && value.updatedAt === doc.updatedAt);
        return { ...doc, actions: doc.actions || {}, statusText: labels[doc.status] || '进度待核对', dateText: format.date(doc.createdAt), noteDraft: previous ? previous.noteDraft || '' : '' };
      });
      const docs = (more ? this.data.docs : []).concat(mapped);
      this.setData({ allowed: true, loading: false, docs: docs.filter((doc, index) => docs.findIndex(value => String(value.id) === String(doc.id)) === index), page: result.page || page, hasMore: Boolean(result.hasNextPage) });
    } catch (cause) {
      if (this.valid(scope) && ticket === this._loadTicket) this.setData({ loading: false, error: cause.message,
        ...(cause.status === 403 ? { allowed: false, docs: [], hasMore: false } : {}) });
    }
  },
  note(event) {
    if (this.data.busy) return;
    const index = this.data.docs.findIndex(doc => String(doc.id) === String(event.currentTarget.dataset.id));
    if (index >= 0) this.setData({ [`docs[${index}].noteDraft`]: event.detail.value });
  },
  async handle(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.loading || this.data.busy || !this.data.allowed) return;
    const { id, action } = event.currentTarget.dataset;
    const doc = this.data.docs.find(value => String(value.id) === String(id));
    if (!['confirmFriend', 'confirmJoined'].includes(action) || !doc || !doc.actions[action]) return;
    const scope = this._scope || 0, operation = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: action === 'confirmFriend' ? '人工确认好友通过' : '人工确认已进群',
        content: action === 'confirmFriend' ? '请先到微信核实该成员的好友申请已经通过，再保存确认。' : '请先在微信实际完成拉群并核实该成员已进群，再保存确认。',
        success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const result = await http.request(`/api/miniapp/community/${encodeURIComponent(this._game)}/join`, { required: true, method: 'POST',
        data: { action, id: doc.id, revision: doc.updatedAt, note: doc.noteDraft || '' } });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!result || !result.record) throw new Error('处理结果暂不可用，请刷新列表核对');
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(id)
        ? { ...result.record, actions: {}, statusText: labels[result.record.status] || '进度待核对', dateText: format.date(result.record.createdAt), noteDraft: '' } : value), done: '人工确认已保存' });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
}));
