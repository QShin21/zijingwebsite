const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const http = require('../../lib/http');
const cms = require('../../lib/cms');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { date } = require('../../lib/format');
const { labels } = require('../../lib/staff');
const { actions, error } = require('../../lib/page');
const text = {
  back: ['‹ 返回', '‹ Back'],
  kicker: ['STAFF · 骨干招新', 'STAFF RECRUITMENT'],
  heroTitle: ['一起做好社团的事', 'Help run the club'],
  heroLead: ['执行部与宣传部骨干招新。先了解这次的工作与安排，再选择合适的方向。', 'Staff recruitment for the operations and publicity teams. Learn about the work first, then pick a direction that suits you.'],
  processLabel: ['申请顺序：岗位批次、填写申请、核对提交、查看回执', 'Steps: choose a batch, fill in, review and submit, view receipt'],
  step1: ['岗位批次', 'Batch'],
  step2: ['填写申请', 'Apply'],
  step3: ['核对提交', 'Review'],
  step4: ['查看回执', 'Receipt'],
  ownTitle: ['我的骨干申请', 'My staff applications'],
  ownLead: ['继续查看进度与处理反馈。', 'Check progress and feedback.'],
  refreshOwn: ['刷新回执', 'Refresh receipts'],
  ownLoading: ['正在读取本人回执…', 'Loading your receipts…'],
  applicationPrefix: ['申请 ', 'Application '],
  updatedPrefix: ['最近更新 ', 'Updated '],
  viewProgress: ['查看进度与反馈', 'View progress and feedback'],
  moreOwn: ['加载更多本人申请', 'Load more of my applications'],
  chooseBatch: ['选择招新批次', 'Choose a batch'],
  chooseBatchLead: ['查看岗位说明与截止时间。各处入口共用同一份申请与回执。', 'See the role descriptions and deadlines. All entry points share the same application and receipt.'],
  staffKind: ['骨干招新', 'Staff recruitment'],
  deadline: ['报名截止', 'Deadline'],
  deadlineFallback: ['以批次说明为准', 'See batch details'],
  openBatch: ['查看批次与本人申请', 'View batch and my application'],
  reviewBatch: ['审核该批次申请 ›', 'Review this batch ›'],
  emptyTitle: ['暂无已发布骨干批次', 'No staff batches published'],
  emptyBody: ['新一轮招新发布后会出现在这里。', 'The next recruitment round will appear here.'],
  findCommunities: ['寻找游戏社群', 'Find game communities'],
  moreBatches: ['加载更多批次', 'Load more batches'],
  ownEmpty: ['尚无骨干申请。选择一个已发布批次，填写后可在这里继续查看。', 'No staff applications yet. Choose a published batch; after applying you can follow it here.'],
  ownLogin: ['登录后查看本人申请、处理反馈与历史回执。', 'Sign in to see your applications, feedback and past receipts.'],
  loginOwn: ['登录查看我的申请', 'Sign in to view my applications'],
  legacyTitle: ['外部招新与历史资料', 'External recruitment and archives'],
  legacyLead: ['保留既有批次的报名详情。', 'Sign-up details of earlier batches.'],
  legacyLabel: ['历史骨干招新', 'Past staff recruitment'],
};
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, user: null, docs: [], page: 1, hasMore: false,
    own: [], ownPage: 1, ownHasMore: false, ownLoading: false, ownError: '', legacy: [], legacyError: '', reviewStaff: false },
  ...actions,
  onLoad() {
    i18n.bind(this, text);
    i18n.navTitle('执行部 / 宣传部骨干招新', 'Staff Recruitment');
    this._unsubscribe = session.subscribe(user => {
      this._ownTicket = (this._ownTicket || 0) + 1;
      this.setData({ user, own: [], ownPage: 1, ownHasMore: false, ownLoading: false, reviewStaff: false });
    });
  },
  onShow() { i18n.navTitle('执行部 / 宣传部骨干招新', 'Staff Recruitment'); this._hidden = false; return this.load(); },
  onHide() { this._hidden = true; this._ticket = (this._ticket || 0) + 1; this._ownTicket = (this._ownTicket || 0) + 1; },
  onUnload() { this.onHide(); if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  retry() { return this.load(); },
  retryOwn() { return this.loadOwn(); },
  moreOwn() { if (this.data.ownHasMore && !this.data.ownLoading) return this.loadOwn(true); },
  apply() { navigation.go('applications', { apply: 1 }); },
  more() { if (this.data.hasMore && !this.data.loading) return this.load(true); },
  async load(more = false) {
    if (more && this.data.loading) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const user = session.user();
    this.setData({ loading: true, error: '', needsLogin: false, user });
    try {
      const result = await http.request('/api/miniapp/staff?page=' + (more ? this.data.page + 1 : 1), { auth: false });
      if (ticket !== this._ticket) return;
      if (!Array.isArray(result.docs)) throw new Error(i18n.t('批次资料暂不可用', 'Batch details are unavailable'));
      const docs = result.docs.map(doc => ({ ...doc, deadlineText: date(doc.endAt), stateText: i18n.message(doc.state) }));
      this.setData({ loading: false, docs: more ? this.data.docs.concat(docs) : docs, page: result.page, hasMore: result.hasNextPage });
    } catch (cause) { if (ticket === this._ticket) error(this, cause); }
    if (!more && ticket === this._ticket) {
      await Promise.all([this.loadOwn(), this.loadLegacy()]);
    }
  },
  async loadOwn(more = false) {
    if (more && this.data.ownLoading) return;
    const user = session.user(), ticket = this._ownTicket = (this._ownTicket || 0) + 1;
    if (!user) { this.setData({ own: [], ownHasMore: false, ownLoading: false, reviewStaff: false }); return; }
    this.setData({ ownLoading: true, ownError: '', reviewStaff: false });
    try {
      const [result, workbench] = await Promise.all([
        http.request('/api/staff-applications?' + cms.query({ depth: 0, limit: 12, page: more ? this.data.ownPage + 1 : 1, sort: '-updatedAt',
          'where[applicant][equals]': user.id, ...cms.selection(['batch', 'batchTitle', 'status', 'updatedAt']) }), { required: true }),
        http.request('/api/miniapp/workbench', { required: true }),
      ]);
      if (ticket !== this._ownTicket || this._hidden || String(session.user() && session.user().id) !== String(user.id)) return;
      if (!Array.isArray(result.docs)) throw new Error(i18n.t('本人申请暂不可用', 'Your applications are unavailable'));
      const own = result.docs.map(doc => ({ id: doc.id, batch: typeof doc.batch === 'object' ? doc.batch.id : doc.batch, batchTitle: doc.batchTitle,
        statusText: labels[doc.status] || i18n.t('状态待确认', 'Status pending'), updatedText: date(doc.updatedAt) }));
      this.setData({ ownLoading: false, own: more ? this.data.own.concat(own) : own, ownPage: result.page, ownHasMore: result.hasNextPage, reviewStaff: workbench.reviewStaff === true });
    } catch (cause) { if (ticket === this._ownTicket) this.setData({ ownLoading: false, ownError: cause.message, own: more ? this.data.own : [] }); }
  },
  async loadLegacy() {
    const ticket = this._ticket, user = session.user();
    this.setData({ legacy: [], legacyError: '' });
    if (!user) return;
    try {
      const result = await cms.list('recruitment', { kind: 'staff', limit: 12 });
      if (ticket === this._ticket && String(session.user() && session.user().id) === String(user.id)) this.setData({ legacy: result.docs });
    } catch (cause) { if (ticket === this._ticket) this.setData({ legacyError: cause.message }); }
  },
  openBatch(event) { if (navigation.requireUser()) navigation.go('signup', { kind: 'staff', id: event.currentTarget.dataset.id }); },
  reviewBatch(event) { if (this.data.reviewStaff) navigation.go('staff-review', { id: event.currentTarget.dataset.id }); },
}));
