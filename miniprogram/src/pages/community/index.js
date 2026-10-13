function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const files = require('../../lib/files');
const format = require('../../lib/format');
const { render } = require('../../lib/richtext');
const { actions, protect } = require('../../lib/page');
const video = require('../../lib/video');
const areas = { updates: 'community-posts', showcase: 'community-showcase' };
const identity = () => String((session.user() || {}).id || '');
const joinLabels = { requested: '已记录加入意向，请联系管理员', friendReported: '已报告发送好友申请，待管理员确认',
  awaitingInvite: '管理员已确认好友通过，等待人工拉群', joined: '管理员已人工确认进群', withdrawn: '网站意向已撤回' };
const receipt = record => record ? { ...record, statusText: joinLabels[record.status] || '进度待核对', confirmedText: format.date(record.confirmedAt) } : null;
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, game: {}, area: 'contacts', docs: [], page: 1,
    hasMore: false, loadingMore: false, nodes: [], contentError: '', contacts: [], contactsLoading: false, contactsError: '',
    join: null, joinActions: {}, joinLoading: false, joinError: '', joinBusy: false, joinDone: '', canHandle: false,
    clubLoading: false, clubError: '', staffBatches: [], promotions: [] },
  ...actions,
  onLoad(options = {}) {
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate(); this._options = options;
    this.setData({ area: options.area === 'showcase' || options.area === 'updates' ? options.area : 'contacts' });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this._resumeRead = false; this.invalidate(); this.resetPrivate(); }
    });
  },
  invalidate() { this._scope = (this._scope || 0) + 1; this._joinOperation = (this._joinOperation || 0) + 1; },
  valid(scope) { return !this._disposed && this._visible !== false && scope === (this._scope || 0) && this._identity === identity() && Boolean(identity()); },
  beginWrite() { this._pendingWrite = true; return this._writeID = (this._writeID || 0) + 1; },
  writeValid(context, actor, writeID) { return !this._disposed && context === this._context && actor === identity() && writeID === this._writeID; },
  async finishWrite(writeID) {
    if (writeID !== this._writeID) return;
    this._pendingWrite = false;
    if (this._disposed) return;
    this.setData({ joinBusy: false });
    if (this._visible && this._resumeRead) { this._resumeRead = false; await this.load(); }
  },
  resetPrivate() { this.setData({ needsLogin: !session.user(), loading: false, error: '', game: {}, docs: [], nodes: [], page: 1,
    hasMore: false, loadingMore: false, contentError: '', contacts: [], contactsLoading: false, contactsError: '',
    join: null, joinActions: {}, joinLoading: false, joinError: '', joinBusy: Boolean(this._pendingWrite), joinDone: '', canHandle: false,
    clubLoading: false, clubError: '', staffBatches: [], promotions: [] }); },
  onShow() {
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, loadingMore: false, contactsLoading: false, joinLoading: false, joinBusy: Boolean(this._pendingWrite), clubLoading: false }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loadingMore) return this.loadArea(true); },
  async load() {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1;
    this.setData({ loading: true, error: '' });
    try {
      const options = this._options || {};
      const game = await cms.detail('games', options.id, options.slug);
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      this.setData({ game, loading: false, nodes: render(game.body).nodes });
      wx.setNavigationBarTitle({ title: game.title });
      await Promise.all([this.loadArea(), this.retryContacts(), this.retryJoin(), this.retryClub()]);
    } catch (cause) { if (this.valid(scope) && ticket === this._loadTicket) this.setData({ loading: false, error: cause.message }); }
  },
  async retryContacts() {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (!identity() || !this.data.game.id || this.data.contactsLoading) return;
    const scope = this._scope || 0, game = this.data.game, ticket = this._contactsTicket = (this._contactsTicket || 0) + 1;
    this.setData({ contactsLoading: true, contactsError: '' });
    try {
      const contacts = await http.request(`/community/${encodeURIComponent(game.slug)}/contacts`, { required: true });
      if (!this.valid(scope) || ticket !== this._contactsTicket) return;
      if (!Array.isArray(contacts)) throw new Error('管理员名片暂不可用，请重试');
      const mapped = [];
      for (const contact of contacts) {
        const image = await files.localImage(contact.qr);
        if (!this.valid(scope) || ticket !== this._contactsTicket) return;
        mapped.push({ id: contact.id, name: contact.name, image });
      }
      if (this.valid(scope) && ticket === this._contactsTicket) this.setData({ contacts: mapped, contactsLoading: false });
    } catch (cause) { if (this.valid(scope) && ticket === this._contactsTicket) this.setData({ contactsLoading: false, contactsError: cause.message }); }
  },
  async retryJoin() {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (!identity() || !this.data.game.id || this.data.joinLoading) return;
    const scope = this._scope || 0, ticket = this._joinTicket = (this._joinTicket || 0) + 1;
    this.setData({ joinLoading: true, joinError: '' });
    try {
      const result = await http.request(`/api/miniapp/community/${encodeURIComponent(this.data.game.id)}/join`, { required: true });
      if (!this.valid(scope) || ticket !== this._joinTicket) return;
      if (!result || !result.actions) throw new Error('进群进度暂不可用，请重试');
      this.setData({ join: receipt(result.record), joinActions: result.actions, canHandle: result.canHandle === true, joinLoading: false });
    } catch (cause) { if (this.valid(scope) && ticket === this._joinTicket) this.setData({ joinLoading: false, joinError: cause.message, ...(cause.status === 403 ? { joinActions: {}, canHandle: false, join: null } : {}) }); }
  },
  async retryClub() {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (!identity() || this.data.clubLoading) return;
    const scope = this._scope || 0, ticket = this._clubTicket = (this._clubTicket || 0) + 1;
    this.setData({ clubLoading: true, clubError: '' });
    try {
      const result = await http.request('/api/miniapp/club', { auth: false });
      if (!this.valid(scope) || ticket !== this._clubTicket) return;
      const promotions = [];
      for (const kind of ['event', 'notice', 'showcase']) for (const doc of result.promotions && result.promotions[kind] || [])
        promotions.push({ ...doc, kindText: kind === 'event' ? '社团活动' : kind === 'notice' ? '社团通知' : '社团风采' });
      this.setData({ staffBatches: result.staffBatches || [], promotions, clubLoading: false });
    } catch (cause) { if (this.valid(scope) && ticket === this._clubTicket) this.setData({ clubLoading: false, clubError: cause.message }); }
  },
  async loadArea(more = false) {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (!identity() || !this.data.game.id || more && (this.data.loadingMore || !this.data.hasMore)) return;
    if (this.data.area === 'contacts') { this._areaTicket = (this._areaTicket || 0) + 1; this.setData({ loadingMore: false, hasMore: false, contentError: '' }); return; }
    const scope = this._scope || 0, ticket = this._areaTicket = (this._areaTicket || 0) + 1;
    const area = this.data.area, game = this.data.game.id, page = more ? this.data.page + 1 : 1;
    this.setData({ loadingMore: true, contentError: '' });
    try {
      const result = await cms.social(areas[area], { game, page, limit: area === 'showcase' ? 4 : 15, sort: '-createdAt' });
      if (!this.valid(scope) || ticket !== this._areaTicket) return;
      if (!result || !Array.isArray(result.docs)) throw new Error('社群内容暂不可用，请重试');
      const docs = [];
      for (const doc of result.docs) {
        const images = [];
        for (const image of doc.images || []) {
          images.push({ source: await files.localImage(image.source), caption: image.caption });
          if (!this.valid(scope) || ticket !== this._areaTicket) return;
        }
        docs.push({ ...doc, collection: areas[area], kindText: area === 'showcase' ? '社群风采' : doc.category === 'event' ? '社群活动' : '社群通知',
          dateText: format.date(doc.createdAt), localImages: images, videoSource: video.source(doc.videoURL), videoError: false });
      }
      if (!this.valid(scope) || ticket !== this._areaTicket) return;
      const combined = (more ? this.data.docs : []).concat(docs);
      this.setData({ loadingMore: false, docs: combined.filter((doc, index) => combined.findIndex(value => String(value.id) === String(doc.id)) === index),
        page: result.page || page, hasMore: Boolean(result.hasNextPage) });
    } catch (cause) { if (this.valid(scope) && ticket === this._areaTicket) this.setData({ loadingMore: false, contentError: cause.message }); }
  },
  retryContent() { return this.loadArea(); },
  honorWorkspace() {
    if (this._visible && !this._disposed && !this._pendingWrite && !this.data.loading && this.data.game.id)
      navigation.go('team-honor-workspace', { game: this.data.game.id });
  },
  area(event) {
    const area = event.currentTarget.dataset.area;
    if (area === this.data.area || area !== 'contacts' && !areas[area]) return;
    this._areaTicket = (this._areaTicket || 0) + 1;
    this.setData({ area, docs: [], page: 1, hasMore: false, loadingMore: false, contentError: '' });
    return this.loadArea();
  },
  async joinAction(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.loading || this.data.joinBusy || this.data.joinLoading) return;
    const { action, contact } = event.currentTarget.dataset;
    if (!['request', 'reportFriend', 'withdraw'].includes(action) || !this.data.joinActions[action]) return;
    if (action === 'request' && !this.data.contacts.some(doc => String(doc.id) === String(contact) && doc.image)) return;
    const scope = this._scope || 0, operation = this._joinOperation = (this._joinOperation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    const messages = { request: '记录站内加入意向后，请主动到微信添加管理员好友并等待人工拉群。',
      reportFriend: '仅在你已经到微信发送好友申请后报告。管理员还需核实好友并人工拉群。',
      withdraw: '确认撤回网站意向？微信好友或群成员情况需要到微信联系管理员处理。' };
    const record = this.data.join;
    this.setData({ joinBusy: true, joinError: '', joinDone: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: action === 'request' ? '记录加入意向' : action === 'reportFriend' ? '报告好友申请' : '撤回网站意向',
        content: messages[action], success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer || !this.valid(scope) || operation !== this._joinOperation) return;
      const result = await http.request(`/api/miniapp/community/${encodeURIComponent(this.data.game.id)}/join`, { required: true, method: 'POST', data: {
        action, ...(record ? { id: record.id, revision: record.updatedAt } : {}), ...(action === 'request' ? { contact } : {}) } });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!result || !result.record) throw new Error('保存结果暂不可用，请刷新进度核对');
      this.setData({ join: receipt({ ...result.record, actions: {} }), joinActions: {}, canHandle: false, joinDone: action === 'request' ? '加入意向已保存，请主动到微信联系管理员' : action === 'reportFriend' ? '好友申请报告已保存' : '网站意向已撤回' });
      await this.retryJoin();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ joinError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
  manageJoins() { if (this.data.canHandle && this.data.game.id) navigation.go('community-joins', { id: this.data.game.id, title: this.data.game.title }); },
  apply() { if (navigation.requireUser()) navigation.go('applications', { apply: 1, game: this.data.game.id }); },
  staff() { navigation.go('staff'); },
  applyStaff(event) { navigation.go('signup', { kind: 'staff', id: event.currentTarget.dataset.id }); },
  videoError(event) { const index = Number(event.currentTarget.dataset.index); if (this.data.docs[index]) this.setData({ [`docs[${index}].videoError`]: true }); },
  onShareAppMessage() { return { title: this.data.game.title || '竞在紫荆游戏社群', path: `/pages/community/index?id=${this.data.game.id || ''}&slug=${this.data.game.slug || ''}` }; },
}));
