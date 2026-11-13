const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
const decisions = { approved: '批准', returned: '退回补充', rejected: '拒绝' };
const decisionsEn = { approved: 'approve', returned: 'return for more information', rejected: 'reject' };
const doneEn = { approved: 'Application approved', returned: 'Application returned for more information', rejected: 'Application rejected' };
const statusLabels = { pending: '待审核', approved: '已批准', returned: '已退回补充', rejected: '已拒绝', withdrawn: '已撤回' };
const statusLabelsEn = { pending: 'Pending review', approved: 'Approved', returned: 'Returned for more information', rejected: 'Rejected', withdrawn: 'Withdrawn' };
const decorate = doc => ({ ...doc, dateText: format.date(doc.createdAt), statusText: statusLabels[doc.status] ? i18n.t(statusLabels[doc.status], statusLabelsEn[doc.status]) : i18n.t('状态待核对', 'Status to be checked') });
const text = {
  back: ['‹ 返回', '‹ Back'],
  kicker: ['REVIEW · 审核台', 'REVIEW'],
  heroTitle: ['管理员申请审核', 'Admin application review'],
  heroLead: ['核对社群计划、申请资料与名片展示同意，再保存审核决定。', 'Check the community plan, application details and contact-card consent, then save your decision.'],
  countSuffix: [' 条', ' records'],
  scopeNote: ['只显示当前有权处理的记录', 'Only records you may handle are shown'],
  checking: ['正在核对权限与待审申请', 'Checking permissions and pending applications'],
  noPermission: ['当前账号没有此管理权限', 'This account does not have this admin permission'],
  noPermissionBody: ['审核入口按当前账号的实际授权开放。', 'Review access follows this account’s actual permissions.'],
  recheck: ['重新核对权限', 'Check permissions again'],
  reload: ['重新加载', 'Reload'],
  doneKept: ['已确认的处理结果保留在下方，刷新后再核对最新列表。', 'Confirmed results are kept below; refresh to check the latest list.'],
  receiptsTitle: ['申请与处理回执', 'Applications and receipts'],
  pendingTitle: ['待审申请', 'Pending applications'],
  scopeNoteFull: ['只显示当前有权处理的记录。', 'Only records you may handle are shown.'],
  refresh: ['刷新核对', 'Refresh'],
  saving: ['正在确认或保存本次决定，请稍候。', 'Confirming or saving this decision, please wait.'],
  gameFallback: ['游戏社群申请', 'Game community application'],
  applicantPrefix: ['申请人 ', 'Applicant '],
  receiptPrefix: ['回执 ', 'Receipt '],
  consentYes: ['已取得本人名片展示同意', 'Consent to show contact card obtained'],
  consentNo: ['需由申请人补充名片展示同意', 'Applicant must add contact-card consent'],
  collapse: ['收起申请材料', 'Hide materials'],
  checkAndHandle: ['核对材料与处理', 'Check materials and decide'],
  viewMaterials: ['查看申请材料', 'View materials'],
  plan: ['组织计划', 'Organizing plan'],
  applicant: ['申请人', 'Applicant'],
  phone: ['手机号', 'Mobile'],
  cardConsent: ['进群名片与本人同意', 'Group contact card and consent'],
  consentAgreed: ['申请人已同意展示微信名片作为进群联系方式。', 'The applicant agreed to show their WeChat card as the group contact.'],
  consentMissing: ['申请人尚未同意展示微信名片。', 'The applicant has not agreed to show their WeChat card.'],
  consentRequired: ['申请人尚未同意展示管理联系方式，请退回由本人补充同意后重新提交。', 'The applicant has not agreed to show admin contact details. Return it so they can add consent and resubmit.'],
  readingCard: ['正在读取名片…', 'Loading contact card…'],
  viewCard: ['查看微信名片二维码', 'View WeChat QR card'],
  saveDecision: ['保存审核决定', 'Save decision'],
  decisionHint: ['意见会显示在申请人的回执中。批准后开放社群任职，微信群仍需人工建立与拉群。', 'Your note appears on the applicant’s receipt. Approval grants the community role; WeChat groups are still created and joined manually.'],
  note: ['处理意见', 'Review note'],
  notePlaceholder: ['写明需要补充的资料或处理原因', 'State what is missing or the reason'],
  noteHint: ['退回补充或拒绝时，请填写具体原因。最多 1000 字。', 'When returning or rejecting, give a specific reason. Up to 1000 characters.'],
  approve: ['批准申请', 'Approve'],
  returnIt: ['退回补充', 'Return for more info'],
  reject: ['拒绝申请', 'Reject'],
  noActions: ['当前没有可执行的审核操作。请刷新核对最新状态。', 'No review actions available. Refresh to check the latest status.'],
  emptyTitle: ['没有待审核申请', 'No pending applications'],
  emptyBody: ['新申请提交后会出现在当前授权范围内。', 'New applications within your permissions will appear here.'],
  more: ['加载更多申请', 'Load more applications'],
};
Page(withVisualTheme({
  data: { needsLogin: false, allowed: false, loading: false, error: '', operationError: '', done: '',
    docs: [], expandedId: '', page: 1, hasMore: false, busy: false, imageBusy: false },
  ...actions,
  toggleRecord(event) {
    if (this.data.busy || this.data.loading || this.data.imageBusy) return;
    const doc = this.data.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (doc) this.setData({ expandedId: this.data.expandedId === doc.id ? '' : doc.id });
  },
  onLoad() {
    i18n.bind(this, text);
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
  resetPrivate() { this.setData({ needsLogin: !session.user(), allowed: false, loading: false, error: '', operationError: '', done: '', docs: [], expandedId: '', page: 1, hasMore: false, busy: Boolean(this._pendingWrite), imageBusy: false }); },
  onShow() {
    i18n.navTitle('申请审核', 'Application Review');
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, busy: Boolean(this._pendingWrite), imageBusy: false }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
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
      if (!workbench || workbench.reviewCommunity !== true) { this.setData({ allowed: false, loading: false, docs: [], expandedId: '', page: 1, hasMore: false }); return; }
      this.setData({ allowed: true });
      const result = await http.request(`/api/miniapp/community/applications?mode=review&page=${page}`, { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      if (!result || !Array.isArray(result.docs)) throw new Error(i18n.t('审核列表暂不可用，请重试', 'The review list is unavailable. Please try again.'));
      const mapped = result.docs.map(doc => {
        const previous = this.data.docs.find(value => String(value.id) === String(doc.id) && value.updatedAt === doc.updatedAt);
        return decorate({ ...doc, actions: doc.actions || {}, reviewDraft: previous ? previous.reviewDraft || '' : '' });
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
      if (!image) throw new Error(i18n.t('名片暂时无法显示，请重试', 'The contact card cannot be shown. Please try again.'));
      wx.previewImage({ current: image, urls: [image] });
    } catch (cause) { if (this.valid(scope) && ticket === this._imageTicket) this.setData({ operationError: cause.message }); }
    finally { if (this.valid(scope) && ticket === this._imageTicket) this.setData({ imageBusy: false }); }
  },
  async decide(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.loading || this.data.busy || this.data.imageBusy) return;
    const { id, decision } = event.currentTarget.dataset;
    const doc = this.data.docs.find(value => String(value.id) === String(id));
    if (!this.data.allowed || !doc || !doc.actions.review || !decisions[decision]) return;
    if (decision === 'approved' && doc.contactConsent !== true) {
      this.setData({ operationError: i18n.t('申请人尚未同意展示管理联系方式，请退回由本人补充同意后重新提交。', 'The applicant has not agreed to show admin contact details. Return it so they can add consent and resubmit.') });
      return;
    }
    const scope = this._scope || 0, operation = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: i18n.t('审核社群申请', 'Review community application'),
        content: i18n.t(`确认${decisions[decision]}这份申请？${decision === 'approved' ? '批准后开放社群任职，微信群仍需人工建立与拉群。' : ''}`, `Confirm: ${decisionsEn[decision]} this application?${decision === 'approved' ? ' Approval grants the community role; WeChat groups are still created and joined manually.' : ''}`),
        success: value => resolve(value.confirm), fail: () => reject(new Error(i18n.message('确认未完成，请重试'))) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const result = await http.request('/api/miniapp/community/applications', { required: true, method: 'POST',
        data: { action: 'review', id: doc.id, revision: doc.updatedAt, decision, reviewNote: doc.reviewDraft || '' } });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!result || !result.application) throw new Error(i18n.message('处理结果暂不可用，请刷新后核对'));
      const saved = decorate({ ...result.application, actions: {}, reviewDraft: '' });
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(doc.id) ? saved : value), done: i18n.t(`已${decisions[result.application.status] || '处理'}该申请`, doneEn[result.application.status] || 'Application handled') });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
}));
