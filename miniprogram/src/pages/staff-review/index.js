const http = require('../../lib/http');
const session = require('../../lib/session');
const staff = require('../../lib/staff');
const cms = require('../../lib/cms');
const { actions, protect, error } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
Page({
  data: { loading: true, error: '', needsLogin: false, busy: false, docs: [], page: 1, pages: 1, total: 0,
    department: '', status: '', message: '', directions: [{ value: '', label: '全部方向' }, { value: 'execution', label: '执行部' }, { value: 'publicity', label: '宣传部' }, { value: 'both', label: '执行/宣传均可' }],
    states: [{ value: '', label: '全部状态' }, ...Object.keys(staff.labels).map(value => ({ value, label: staff.labels[value] }))], departmentIndex: 0, statusIndex: 0 },
  ...actions,
  onLoad(options) {
    if (this._unsubscribe) this._unsubscribe();
    this._scope = (this._scope || 0) + 1; this._ticket = (this._ticket || 0) + 1; this._lifetime = (this._lifetime || 0) + 1; this._actorEpoch = (this._actorEpoch || 0) + 1;
    this._hidden = false; this._unloaded = false; this._drafts = {}; this._notice = null; this._actionsFresh = false;
    this._batch = options.id;
    this._endpoint = '/api/miniapp/staff/' + encodeURIComponent(options.id);
    this._writeEndpoint = '/api/staff/batches/' + encodeURIComponent(options.id) + '/application';
    this._userId = identity(); this._resumeRead = this.locked();
    this.setData({ loading: false, busy: this.locked(), docs: [], total: 0, error: '', message: '', needsLogin: !session.user() });
    wx.setNavigationBarTitle({ title: '骨干申请审核' });
    this._unsubscribe = session.subscribe(user => {
      if (identity() === String(this._userId)) return;
      this._scope = (this._scope || 0) + 1; this._actorEpoch = (this._actorEpoch || 0) + 1; this._userId = identity(); this._drafts = {}; this._notice = null; this._actionsFresh = false;
      this._ticket = (this._ticket || 0) + 1;
      this._resumeRead = this.locked();
      this.setData({ loading: false, busy: this.locked(), docs: [], total: 0, needsLogin: !user, error: '', message: '' });
    });
  },
  locked() { return Boolean(this._pendingWrite || this._modalLock); },
  capture() { return { actor: identity(), actorEpoch: this._actorEpoch, batch: this._batch, scope: this._scope, lifetime: this._lifetime }; },
  same(context) { return !this._unloaded && context.actor === identity() && context.actorEpoch === this._actorEpoch && context.batch === this._batch && context.lifetime === this._lifetime; },
  live(context) { return this.same(context) && !this._hidden && context.scope === this._scope; },
  draftKey(doc) { return identity() + ':' + this._batch + ':' + doc.id + ':' + doc.updatedAt; },
  disableActions() { this._actionsFresh = false; this.setData({ docs: this.data.docs.map(doc => ({ ...doc, allowed: [] })) }); },
  showNotice() { if (this._notice && this.same(this._notice) && !this._hidden) this.setData({ message: this._notice.text }); },
  onShow() {
    this._hidden = false; this.showNotice();
    if (this.locked()) { this._resumeRead = true; return; }
    this._resumeRead = false; return this.load(this.data.page);
  },
  onHide() {
    this._hidden = true; this._ticket = (this._ticket || 0) + 1; this._scope = (this._scope || 0) + 1;
    this._resumeRead = true; this.disableActions(); this.setData({ loading: false, busy: this.locked() });
  },
  onUnload() { this.onHide(); this._unloaded = true; this._lifetime = (this._lifetime || 0) + 1; this._drafts = {}; this._notice = null; this.setData({ docs: [], total: 0, message: '' }); if (this._unsubscribe) this._unsubscribe(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  retry() { return this.load(); },
  async load(page = 1) {
    if (this._unloaded || this._hidden) return;
    if (this.locked()) { this._resumeRead = true; return; }
    const context = this.capture(); this._actionsFresh = false;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    if (!protect(this)) { this._drafts = {}; this.setData({ loading: false, docs: [], total: 0 }); return; }
    const user = session.user(); this._userId = user.id;
    this.setData({ loading: true, error: '', docs: [] });
    try {
      const result = await http.request(this._endpoint + '?' + cms.query({ mode: 'review', page, department: this.data.department, status: this.data.status }), { raw: true, required: true });
      if (ticket !== this._ticket || !this.live(context)) return;
      if (!Array.isArray(result.docs)) throw new Error('审核资料暂不可用');
      const docs = result.docs.map(doc => {
        const allowed = (doc.actions && doc.actions.reviewStatuses || []).filter(value => typeof value === 'string').map(value => ({ value, label: staff.labels[value] || value }));
        const draft = this._drafts[this.draftKey(doc)], chosen = draft ? allowed.findIndex(choice => choice.value === draft.decision) : -1;
        return { ...staff.receipt(doc), allowed, decisionIndex: chosen >= 0 ? chosen : 0, feedbackDraft: draft ? draft.feedback : doc.feedback || '' };
      });
      this._actionsFresh = true;
      this.setData({ loading: false, docs,
        page: result.page, pages: result.totalPages, total: result.totalDocs });
    } catch (cause) { if (ticket === this._ticket && this.live(context)) {
      this._actionsFresh = false; if (cause.status === 401 || cause.status === 403) this._drafts = {};
      this.setData({ docs: [], total: 0 }); error(this, cause);
    } }
  },
  direction(event) { if (this.locked() || this._hidden || this._unloaded) return; const index = Number(event.detail.value), value = this.data.directions[index]; if (value) { this.setData({ departmentIndex: index, department: value.value }); return this.load(); } },
  state(event) { if (this.locked() || this._hidden || this._unloaded) return; const index = Number(event.detail.value), value = this.data.states[index]; if (value) { this.setData({ statusIndex: index, status: value.value }); return this.load(); } },
  field(event) {
    if (this.locked() || !this._actionsFresh || this._hidden || this._unloaded) return;
    const index = Number(event.currentTarget.dataset.index), key = event.currentTarget.dataset.key, doc = this.data.docs[index];
    if (!doc || !doc.allowed.length || !['feedbackDraft', 'decisionIndex'].includes(key)) return;
    const value = key === 'decisionIndex' ? Number(event.detail.value) : event.detail.value;
    if (key === 'decisionIndex' && !doc.allowed[value]) return;
    this._drafts[this.draftKey(doc)] = { feedback: key === 'feedbackDraft' ? value : doc.feedbackDraft,
      decision: doc.allowed[key === 'decisionIndex' ? value : doc.decisionIndex].value };
    this.setData({ [`docs[${index}].${key}`]: value });
  },
  async decide(event) {
    if (this.locked() || !this._actionsFresh || this.data.loading || this._hidden || this._unloaded || !session.user()) return;
    const doc = this.data.docs[Number(event.currentTarget.dataset.index)], context = this.capture(), ticket = this._ticket;
    const decision = doc && doc.allowed[doc.decisionIndex];
    if (!decision || identity() !== String(this._userId)) return;
    const operation = { ...context, sent: false }; this._modalLock = operation;
    this.setData({ busy: true, message: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: '保存骨干申请处理结果', content: '确认将此申请设为“' + decision.label + '”？录用不自动授予平台角色。', success: resolve, fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer.confirm || ticket !== this._ticket || !this.live(context)) return;
      operation.sent = true; this._pendingWrite = operation; this._actionsFresh = false;
      const response = await http.request(this._writeEndpoint, { raw: true, required: true, method: 'POST', data: { action: 'review', id: doc.id, revision: doc.updatedAt, status: decision.value, feedback: doc.feedbackDraft } });
      const saved = response && response.application;
      if (!saved || String(saved.id) !== String(doc.id) || typeof staff.labels[saved.status] !== 'string') throw new Error('处理结果暂不可确认，请刷新回执核对');
      if (this.same(context)) {
        delete this._drafts[this.draftKey(doc)];
        this._notice = { ...context, text: '处理结果已保存：' + staff.labels[saved.status] + '；录用未授予平台角色。' };
        if (!this._hidden) { this.disableActions(); this.showNotice(); }
      }
    } catch (cause) { if (this.same(context)) {
      this._notice = { ...context, text: cause.message || '保存未完成，请刷新后核对并重试' };
      if (cause.status === 401 || cause.status === 403) {
        this._drafts = {}; this._actionsFresh = false;
        this.setData({ docs: [], total: 0 });
      }
      if (!this._hidden) { if (operation.sent) this.disableActions(); this.showNotice(); }
    } }
    finally {
      if (this._pendingWrite === operation) this._pendingWrite = null;
      if (this._modalLock === operation) this._modalLock = null;
      this._resumeRead = this._resumeRead || operation.sent;
      if (!this._unloaded) {
        this.setData({ busy: this.locked() });
        if (!this._hidden && this._resumeRead && !this.locked()) { this._resumeRead = false; await this.load(this.data.page); }
      }
    }
  },
  previous() { if (this.data.page > 1) return this.load(this.data.page - 1); },
  next() { if (this.data.page < this.data.pages) return this.load(this.data.page + 1); },
});
