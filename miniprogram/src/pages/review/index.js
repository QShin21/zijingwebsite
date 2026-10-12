const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
const decisions = { approved: '批准', returned: '退回补充', rejected: '拒绝' };
Page({
  data: { needsLogin: false, allowed: false, loading: false, error: '', operationError: '', done: '',
    docs: [], page: 1, hasMore: false, busy: false, imageBusy: false },
  ...actions,
  onLoad() {
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate();
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this._resumeRead = false; this.invalidate(); this.resetPrivate(); }
    });
  },
  invalidate() { this._scope = (this._scope || 0) + 1; this._operation = (this._operation || 0) + 1; this._imageTicket = (this._imageTicket || 0) + 1; },
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
  resetPrivate() { this.setData({ needsLogin: !session.user(), allowed: false, loading: false, error: '', operationError: '', done: '', docs: [], page: 1, hasMore: false, busy: Boolean(this._pendingWrite), imageBusy: false }); },
  onShow() {
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, busy: Boolean(this._pendingWrite), imageBusy: false }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) return this.load(true); },
  async load(more = false) {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (more && (this.data.loading || !this.data.hasMore)) return;
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1;
    const page = more ? this.data.page + 1 : 1;
    this.setData({ loading: true, error: '' });
    try {
      const workbench = await http.request('/api/miniapp/workbench', { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      if (!workbench || workbench.reviewCommunity !== true) { this.setData({ allowed: false, loading: false, docs: [], page: 1, hasMore: false }); return; }
      this.setData({ allowed: true });
      const result = await http.request(`/api/miniapp/community/applications?mode=review&page=${page}`, { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      if (!result || !Array.isArray(result.docs)) throw new Error('审核列表暂不可用，请重试');
      const mapped = result.docs.map(doc => {
        const previous = this.data.docs.find(value => String(value.id) === String(doc.id) && value.updatedAt === doc.updatedAt);
        return { ...doc, actions: doc.actions || {}, dateText: format.date(doc.createdAt), reviewDraft: previous ? previous.reviewDraft || '' : '' };
      });
      const docs = (more ? this.data.docs : []).concat(mapped);
      this.setData({ docs: docs.filter((doc, index) => docs.findIndex(value => String(value.id) === String(doc.id)) === index),
        loading: false, page: result.page || page, hasMore: Boolean(result.hasNextPage) });
    } catch (cause) {
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      this.setData({ loading: false, error: cause.message,
        ...(cause.status === 403 ? { allowed: false, docs: [], hasMore: false } : {}) });
    }
  },
  note(event) {
    if (this.data.busy) return;
    const index = this.data.docs.findIndex(doc => String(doc.id) === String(event.currentTarget.dataset.id));
    if (index >= 0) this.setData({ [`docs[${index}].reviewDraft`]: event.detail.value });
  },
  async inspect(event) {
    if (this._disposed || this._visible === false || this._pendingWrite || this.data.busy || this.data.imageBusy) return;
    const id = event.currentTarget.dataset.id;
    if (!this.data.allowed || !this.data.docs.some(doc => String(doc.id) === String(id) && doc.actions.review)) return;
    const scope = this._scope || 0, ticket = this._imageTicket = (this._imageTicket || 0) + 1;
    this.setData({ imageBusy: true, operationError: '' });
    try {
      const doc = await http.request(`/api/community-applications/${encodeURIComponent(id)}?depth=0&select[wechatQr]=true`, { required: true });
      if (!this.valid(scope) || ticket !== this._imageTicket) return;
      const image = await files.localImage(doc.wechatQr);
      if (!this.valid(scope) || ticket !== this._imageTicket) return;
      if (!image) throw new Error('名片暂时无法显示，请重试');
      wx.previewImage({ current: image, urls: [image] });
    } catch (cause) { if (this.valid(scope) && ticket === this._imageTicket) this.setData({ operationError: cause.message }); }
    finally { if (this.valid(scope) && ticket === this._imageTicket) this.setData({ imageBusy: false }); }
  },
  async decide(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.loading || this.data.busy || this.data.imageBusy) return;
    const { id, decision } = event.currentTarget.dataset;
    const doc = this.data.docs.find(value => String(value.id) === String(id));
    if (!this.data.allowed || !doc || !doc.actions.review || !decisions[decision]) return;
    const scope = this._scope || 0, operation = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: '审核社群申请',
        content: `确认${decisions[decision]}这份申请？${decision === 'approved' ? '批准后开放社群任职，微信群仍需人工建立与拉群。' : ''}`,
        success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const result = await http.request('/api/miniapp/community/applications', { required: true, method: 'POST',
        data: { action: 'review', id: doc.id, revision: doc.updatedAt, decision, reviewNote: doc.reviewDraft || '' } });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!result || !result.application) throw new Error('处理结果暂不可用，请刷新后核对');
      const saved = { ...result.application, actions: {}, reviewDraft: '', dateText: format.date(result.application.createdAt) };
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(doc.id) ? saved : value), done: `已${decisions[result.application.status] || '处理'}该申请` });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
});
