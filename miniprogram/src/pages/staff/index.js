const http = require('../../lib/http');
const cms = require('../../lib/cms');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { date } = require('../../lib/format');
const { labels } = require('../../lib/staff');
const { actions, error } = require('../../lib/page');
Page({
  data: { loading: true, error: '', needsLogin: false, user: null, docs: [], page: 1, hasMore: false,
    own: [], ownPage: 1, ownHasMore: false, ownLoading: false, ownError: '', legacy: [], legacyError: '', reviewStaff: false },
  ...actions,
  onLoad() {
    wx.setNavigationBarTitle({ title: '执行部 / 宣传部骨干招新' });
    this._unsubscribe = session.subscribe(user => {
      this._ownTicket = (this._ownTicket || 0) + 1;
      this.setData({ user, own: [], ownPage: 1, ownHasMore: false, ownLoading: false, reviewStaff: false });
    });
  },
  onShow() { this._hidden = false; return this.load(); },
  onHide() { this._hidden = true; this._ticket = (this._ticket || 0) + 1; this._ownTicket = (this._ownTicket || 0) + 1; },
  onUnload() { this.onHide(); if (this._unsubscribe) this._unsubscribe(); },
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
      if (!Array.isArray(result.docs)) throw new Error('批次资料暂不可用');
      const docs = result.docs.map(doc => ({ ...doc, deadlineText: date(doc.endAt) }));
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
      if (!Array.isArray(result.docs)) throw new Error('本人申请暂不可用');
      const own = result.docs.map(doc => ({ id: doc.id, batch: typeof doc.batch === 'object' ? doc.batch.id : doc.batch, batchTitle: doc.batchTitle,
        statusText: labels[doc.status] || '状态待确认', updatedText: date(doc.updatedAt) }));
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
});
