const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const http = require('../../lib/http');
const session = require('../../lib/session');
const staff = require('../../lib/staff');
const cms = require('../../lib/cms');
const { actions, protect, error } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
function filterLists() {
  return { directions: [{ value: '', label: i18n.t('全部方向', 'All directions') }, { value: 'execution', label: i18n.t('执行部', 'Operations') }, { value: 'publicity', label: i18n.t('宣传部', 'Publicity') }, { value: 'both', label: i18n.t('执行/宣传均可', 'Either operations or publicity') }],
    states: [{ value: '', label: i18n.t('全部状态', 'All statuses') }, ...Object.keys(staff.labels).map(value => ({ value, label: staff.labels[value] }))] };
}
const text = {
  back: ['‹ 返回', '‹ Back'],
  kicker: ['REVIEW · 骨干招新审核', 'STAFF REVIEW'],
  heroTitle: ['骨干申请审核', 'Staff application review'],
  heroLead: ['先阅读申请答卷，再填写反馈与处理决定。录用后的任命另行处理。', 'Read the answers first, then give feedback and a decision. Appointments after acceptance are handled separately.'],
  noticeLabel: ['处理提示', 'Notice'],
  direction: ['申请方向', 'Direction'],
  status: ['处理状态', 'Status'],
  records: ['申请记录', 'Applications'],
  applicationPrefix: ['申请 ', 'Application '],
  updatedPrefix: [' · 最近更新 ', ' · Updated '],
  collapse: ['收起答卷与处理区', 'Hide answers and decision'],
  expand: ['查看答卷与处理记录', 'View answers and history'],
  answers: ['申请时提交的答卷', 'Submitted answers'],
  answersHint: ['按提交时的题目保留，请先核对申请资料。', 'Kept with the questions as submitted; check the details first.'],
  noAnswers: ['这份回执暂无可展示的答卷内容。', 'This receipt has no answers to show.'],
  existingFeedback: ['已有处理反馈', 'Existing feedback'],
  handle: ['处理这份申请', 'Handle this application'],
  handleHint: ['反馈会出现在申请人的回执中。录用不自动授予平台角色。', 'Feedback appears on the applicant’s receipt. Acceptance does not grant a platform role.'],
  decision: ['处理决定', 'Decision'],
  feedback: ['给申请人的反馈', 'Feedback to the applicant'],
  required: ['必填', 'Required'],
  feedbackPlaceholder: ['退回或未录用请说明具体原因', 'Give a specific reason when returning or declining'],
  feedbackHint: ['退回补充或未录用时，请写明具体原因与需要补充的内容。', 'When returning or declining, state the reason and what needs to be added.'],
  willSave: ['即将保存', 'Will save'],
  saving: ['正在确认或保存', 'Confirming or saving'],
  save: ['保存处理结果', 'Save decision'],
  readOnly: ['当前回执只读', 'This receipt is read-only'],
  readOnlyHint: ['可下拉刷新，核对最新状态与允许的操作。', 'Pull down to refresh and check the latest status and allowed actions.'],
  emptyTitle: ['暂无符合条件的申请', 'No matching applications'],
  emptyBody: ['可切换申请方向或处理状态查看。', 'Try another direction or status.'],
  previous: ['上一页', 'Previous'],
  next: ['下一页', 'Next'],
};
Page(withVisualTheme({
  data: { expandedId: '', loading: true, error: '', needsLogin: false, busy: false, docs: [], page: 1, pages: 1, total: 0,
    department: '', status: '', message: '', ...filterLists(), departmentIndex: 0, statusIndex: 0 },
  ...actions,
  toggleRecord(event) {
    if (this.data.busy || this.data.loading || this.data.imageBusy) return;
    const doc = this.data.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (doc) this.setData({ expandedId: this.data.expandedId === doc.id ? '' : doc.id });
  },
  onLoad(options) {
    i18n.bind(this, text); this.setData(filterLists());
    if (this._unsubscribe) this._unsubscribe();
    this._scope = (this._scope || 0) + 1; this._ticket = (this._ticket || 0) + 1; this._lifetime = (this._lifetime || 0) + 1; this._actorEpoch = (this._actorEpoch || 0) + 1;
    this._hidden = false; this._unloaded = false; this._drafts = {}; this._notice = null; this._actionsFresh = false;
    this._batch = options.id;
    this._endpoint = '/api/miniapp/staff/' + encodeURIComponent(options.id);
    this._writeEndpoint = '/api/staff/batches/' + encodeURIComponent(options.id) + '/application';
    this._userId = identity(); this._resumeRead = this.locked();
    this.setData({ loading: false, busy: this.locked(), docs: [], expandedId: '', total: 0, error: '', message: '', needsLogin: !session.user() });
    if ((i18n.refreshIfStale ? i18n.refreshIfStale(this) : false)) this.onLocaleChange();
    i18n.navTitle('骨干申请审核', 'Staff Application Review');
    this._unsubscribe = session.subscribe(user => {
      if (identity() === String(this._userId)) return;
      this._scope = (this._scope || 0) + 1; this._actorEpoch = (this._actorEpoch || 0) + 1; this._userId = identity(); this._drafts = {}; this._notice = null; this._actionsFresh = false;
      this._ticket = (this._ticket || 0) + 1;
      this._resumeRead = this.locked();
      this.setData({ loading: false, busy: this.locked(), docs: [], expandedId: '', total: 0, needsLogin: !user, error: '', message: '' });
    });
  },
  locked() { return Boolean(this._pendingWrite || this._modalLock); },
  capture() { return { actor: identity(), actorEpoch: this._actorEpoch, batch: this._batch, scope: this._scope, lifetime: this._lifetime }; },
  same(context) { return !this._unloaded && context.actor === identity() && context.actorEpoch === this._actorEpoch && context.batch === this._batch && context.lifetime === this._lifetime; },
  live(context) { return this.same(context) && !this._hidden && context.scope === this._scope; },
  draftKey(doc) { return identity() + ':' + this._batch + ':' + doc.id + ':' + doc.updatedAt; },
  disableActions() { this._actionsFresh = false; this.setData({ docs: this.data.docs.map(doc => ({ ...doc, allowed: [] })) }); },
  showNotice() { if (this._notice && this.same(this._notice) && !this._hidden) this.setData({ message: this._notice.text }); },
  onLocaleChange() { this.setData(filterLists()); },
  onShow() {
    i18n.navTitle('骨干申请审核', 'Staff Application Review');
    this._hidden = false; this.showNotice();
    if (this.locked()) { this._resumeRead = true; return; }
    this._resumeRead = false; return this.load(this.data.page);
  },
  onHide() {
    this._hidden = true; this._ticket = (this._ticket || 0) + 1; this._scope = (this._scope || 0) + 1;
    this._resumeRead = true; this.disableActions(); this.setData({ loading: false, busy: this.locked() });
  },
  onUnload() { this.onHide(); this._unloaded = true; this._lifetime = (this._lifetime || 0) + 1; this._drafts = {}; this._notice = null; this.setData({ docs: [], expandedId: '', total: 0, message: '' }); if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  retry() { return this.load(); },
  async load(page = 1) {
    if (this._unloaded || this._hidden) return;
    if (this.locked()) { this._resumeRead = true; return; }
    const context = this.capture(); this._actionsFresh = false;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    if (!protect(this)) { this._drafts = {}; this.setData({ loading: false, docs: [], expandedId: '', total: 0 }); return; }
    const user = session.user(); this._userId = user.id;
    this.setData({ loading: true, error: '', docs: [] });
    try {
      const result = await http.request(this._endpoint + '?' + cms.query({ mode: 'review', page, department: this.data.department, status: this.data.status }), { raw: true, required: true });
      if (ticket !== this._ticket || !this.live(context)) return;
      if (!Array.isArray(result.docs)) throw new Error(i18n.t('审核资料暂不可用', 'Review data is unavailable'));
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
      this.setData({ docs: [], expandedId: '', total: 0 }); error(this, cause);
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
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: i18n.t('保存骨干申请处理结果', 'Save staff application decision'), content: i18n.t('确认将此申请设为“' + decision.label + '”？录用不自动授予平台角色。', 'Set this application to “' + decision.label + '”? Acceptance does not grant a platform role.'), success: resolve, fail: () => reject(new Error(i18n.message('确认未完成，请重试'))) }));
      if (!answer.confirm || ticket !== this._ticket || !this.live(context)) return;
      operation.sent = true; this._pendingWrite = operation; this._actionsFresh = false;
      const response = await http.request(this._writeEndpoint, { raw: true, required: true, method: 'POST', data: { action: 'review', id: doc.id, revision: doc.updatedAt, status: decision.value, feedback: doc.feedbackDraft } });
      const saved = response && response.application;
      if (!saved || String(saved.id) !== String(doc.id) || typeof staff.labels[saved.status] !== 'string') throw new Error(i18n.t('处理结果暂不可确认，请刷新回执核对', 'The result cannot be confirmed yet. Refresh the receipt to check.'));
      if (this.same(context)) {
        delete this._drafts[this.draftKey(doc)];
        this._notice = { ...context, text: i18n.t('处理结果已保存：' + staff.labels[saved.status] + '；录用未授予平台角色。', 'Decision saved: ' + staff.labels[saved.status] + '. Acceptance did not grant a platform role.') };
        if (!this._hidden) { this.disableActions(); this.showNotice(); }
      }
    } catch (cause) { if (this.same(context)) {
      this._notice = { ...context, text: cause.message || i18n.t('保存未完成，请刷新后核对并重试', 'Saving did not finish. Refresh, check and try again.') };
      if (cause.status === 401 || cause.status === 403) {
        this._drafts = {}; this._actionsFresh = false;
        this.setData({ docs: [], expandedId: '', total: 0 });
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
}));
