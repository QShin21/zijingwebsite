const http = require('../../lib/http');
const session = require('../../lib/session');
const staff = require('../../lib/staff');
const cms = require('../../lib/cms');
const { actions, protect, error } = require('../../lib/page');
Page({
  data: { loading: true, error: '', needsLogin: false, busy: false, docs: [], page: 1, pages: 1, total: 0,
    department: '', status: '', message: '', directions: [{ value: '', label: '全部方向' }, { value: 'execution', label: '执行部' }, { value: 'publicity', label: '宣传部' }, { value: 'both', label: '执行/宣传均可' }],
    states: [{ value: '', label: '全部状态' }, ...Object.keys(staff.labels).map(value => ({ value, label: staff.labels[value] }))], departmentIndex: 0, statusIndex: 0 },
  ...actions,
  onLoad(options) {
    this._batch = options.id;
    this._endpoint = '/api/miniapp/staff/' + encodeURIComponent(options.id);
    this._writeEndpoint = '/api/staff/batches/' + encodeURIComponent(options.id) + '/application';
    wx.setNavigationBarTitle({ title: '骨干申请审核' });
    this._unsubscribe = session.subscribe(user => {
      if (String(user && user.id) === String(this._userId)) return;
      this._ticket = (this._ticket || 0) + 1;
      this.setData({ loading: false, docs: [], total: 0, needsLogin: !user, error: '', message: '' });
    });
  },
  onShow() { this._hidden = false; if (!this.data.busy) return this.load(); },
  onHide() { this._hidden = true; this._ticket = (this._ticket || 0) + 1; },
  onUnload() { this.onHide(); if (this._unsubscribe) this._unsubscribe(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  retry() { return this.load(); },
  async load(page = 1) {
    if (this.data.busy) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    if (!protect(this)) { this.setData({ loading: false, docs: [], total: 0 }); return; }
    const user = session.user(); this._userId = user.id;
    this.setData({ loading: true, error: '', docs: [] });
    try {
      const result = await http.request(this._endpoint + '?' + cms.query({ mode: 'review', page, department: this.data.department, status: this.data.status }), { raw: true, required: true });
      if (ticket !== this._ticket || String(session.user() && session.user().id) !== String(user.id)) return;
      if (!Array.isArray(result.docs)) throw new Error('审核资料暂不可用');
      this.setData({ loading: false, docs: result.docs.map(doc => ({ ...staff.receipt(doc),
        allowed: (doc.actions && doc.actions.reviewStatuses || []).map(value => ({ value, label: staff.labels[value] || value })), decisionIndex: 0, feedbackDraft: doc.feedback || '' })),
        page: result.page, pages: result.totalPages, total: result.totalDocs });
    } catch (cause) { if (ticket === this._ticket) { this.setData({ docs: [], total: 0 }); error(this, cause); } }
  },
  direction(event) { if (this.data.busy) return; const index = Number(event.detail.value), value = this.data.directions[index]; if (value) { this.setData({ departmentIndex: index, department: value.value }); return this.load(); } },
  state(event) { if (this.data.busy) return; const index = Number(event.detail.value), value = this.data.states[index]; if (value) { this.setData({ statusIndex: index, status: value.value }); return this.load(); } },
  field(event) {
    if (this.data.busy) return;
    const index = Number(event.currentTarget.dataset.index), key = event.currentTarget.dataset.key, doc = this.data.docs[index];
    if (!doc || !['feedbackDraft', 'decisionIndex'].includes(key)) return;
    const value = key === 'decisionIndex' ? Number(event.detail.value) : event.detail.value;
    if (key === 'decisionIndex' && !doc.allowed[value]) return;
    this.setData({ [`docs[${index}].${key}`]: value });
  },
  async decide(event) {
    if (this.data.busy || this.data.loading || !session.user()) return;
    const doc = this.data.docs[Number(event.currentTarget.dataset.index)], userId = this._userId, ticket = this._ticket;
    const decision = doc && doc.allowed[doc.decisionIndex];
    if (!decision || String(session.user().id) !== String(userId)) return;
    this.setData({ busy: true, message: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: '保存骨干申请处理结果', content: '确认将此申请设为“' + decision.label + '”？录用不自动授予平台角色。', success: resolve, fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer.confirm || ticket !== this._ticket || String(session.user() && session.user().id) !== String(userId)) return;
      await http.request(this._writeEndpoint, { raw: true, required: true, method: 'POST', data: { action: 'review', id: doc.id, revision: doc.updatedAt, status: decision.value, feedback: doc.feedbackDraft } });
      if (ticket !== this._ticket || String(session.user() && session.user().id) !== String(userId)) return;
      this.setData({ message: '处理结果已保存；录用未授予平台角色。', busy: false });
      await this.load(this.data.page);
    } catch (cause) { if (ticket === this._ticket) this.setData({ message: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
  previous() { if (this.data.page > 1) return this.load(this.data.page - 1); },
  next() { if (this.data.page < this.data.pages) return this.load(this.data.page + 1); },
});
