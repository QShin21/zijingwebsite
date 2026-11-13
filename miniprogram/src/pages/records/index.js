function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const session = require('../../lib/session');
const v2 = require('../../lib/v2');
const archive = require('../../lib/archive');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();

const identity = user => user && user.id != null ? String(user.id) : '';
const modes = {
  signups: { title: ['全部报名', 'All sign-ups'], path: 'me/signups', hint: ['归档仅从“我的赛程”隐藏该活动，不会取消报名；已归档的活动可在此撤销归档。', "Archiving only hides the event from My schedule and doesn't cancel your sign-up. You can unarchive it here."] },
  applications: { title: ['全部申请', 'All applications'], path: 'me/applications', hint: ['归档仅从“申请进度”隐藏该申请，不会撤回申请或改变审核状态；已归档的申请可在此撤销归档。', "Archiving only hides the application from Application progress. It isn't withdrawn and its review status stays the same. You can unarchive it here."] },
};
const text = {
  back: ['‹ 返回', '‹ Back'], kicker: ['MY RECORDS · 我的记录', 'MY RECORDS'],
  loginTitle: ['请先登录', 'Please sign in'], loginBody: ['登录后查看本人报名与申请记录。', 'Sign in to see your sign-ups and applications.'], loginAction: ['登录账号', 'Sign in'],
  reload: ['重新读取', 'Reload'], submittedPrefix: ['提交于 ', 'Submitted '], updatedPrefix: [' · 更新于 ', ' · Updated '], listSep: ['，', ', '],
  noSignups: ['还没有报名记录', 'No sign-ups yet'], noSignupsBody: ['报名开放的活动会标注「报名开放」。', 'Events open for sign-up are marked “Sign-up open”.'], viewEvents: ['查看活动', 'View events'],
  noApplications: ['还没有申请记录', 'No applications yet'], noApplicationsBody: ['社群管理员、骨干招新、建队与入队申请都会记录在这里。', 'Community admin, staff, new team and team applications appear here.'],
  retryMore: ['重试加载更多', 'Retry loading more'], loadMore: ['加载更多', 'Load more'], allShown: ['— 已展示全部记录 —', '— All records shown —'],
};
const pair = value => i18n.t(value[0], value[1]);

// 全部报名 / 全部申请：消费本人分页接口，展示已归档标识并可撤销归档。
Page(withVisualTheme({
  data: { mode: 'signups', title: '', hint: '', docs: [], page: 0, totalDocs: 0, hasMore: false, loading: false, loadingMore: false,
    error: '', loadMoreError: '', needsLogin: false, campus: false },
  ...actions,
  onLoad(options) {
    const mode = modes[options && options.mode] ? options.mode : 'signups';
    i18n.bind(this, text);
    this.setData({ mode, title: pair(modes[mode].title), hint: pair(modes[mode].hint) });
    i18n.navTitle(modes[mode].title[0], modes[mode].title[1]);
    this._identity = identity(session.user());
    this._unsubscribe = session.subscribe(user => {
      // Same-account profile refreshes keep the list; only a different identity resets it.
      if (identity(user) === this._identity) return;
      this._identity = identity(user);
      // Switching account invalidates every in-flight read and archive write.
      this._ticket = (this._ticket || 0) + 1; this._write = null; this._confirmed = {};
      this.setData({ docs: [], page: 0, totalDocs: 0, hasMore: false, loading: false, loadingMore: false, error: '', loadMoreError: '', needsLogin: !user });
      if (user && !this._hidden && !this._unloaded) this.load();
    });
  },
  onShow() { this._hidden = false; this.load(); },
  onHide() { this._hidden = true; this._ticket = (this._ticket || 0) + 1; this.setData({ loading: false, loadingMore: false }); },
  onUnload() { this._unloaded = true; this.onHide(); if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  loadMore() { return this.onReachBottom(); },
  retry() { return this.load(); },
  async load(more = false) {
    const user = session.user();
    if (!user) { this.setData({ needsLogin: true, docs: [], hasMore: false }); return; }
    const campus = session.campus(user);
    if (this.data.mode === 'applications' && !campus) { this.setData({ needsLogin: false, campus, docs: [], hasMore: false, error: i18n.t('申请记录仅面向清华账号。', 'Application records are for Tsinghua accounts only.') }); return; }
    const ticket = this._ticket = (this._ticket || 0) + 1, since = this._writeSeq || 0;
    const current = () => ticket === this._ticket && !this._hidden && String(session.user() && session.user().id) === String(user.id);
    this.setData(more ? { loadingMore: true, loadMoreError: '' } : { loading: true, error: '', loadMoreError: '', needsLogin: false, campus });
    try {
      const page = more ? this.data.page + 1 : 1;
      const result = await v2.get(modes[this.data.mode].path, { page, limit: 20 }, { required: true });
      if (!current()) return;
      let docs = result.docs.map(this.data.mode === 'signups' ? v2.receipt : v2.application);
      // A write confirmed after this read started wins over the read's (possibly older) snapshot.
      const confirmed = this._confirmed || {};
      Object.keys(confirmed).forEach(target => { if (confirmed[target].seq > since) docs = archive.mark(docs, target, { archived: confirmed[target].archived }); });
      if (this._write && this._write.identity === this._identity) docs = archive.mark(docs, this._write.target, { archiving: true });
      this.setData({ docs: more ? this.data.docs.concat(docs) : docs, page: result.page, totalDocs: result.totalDocs, hasMore: result.hasNextPage, loading: false, loadingMore: false });
    } catch (cause) {
      if (ticket !== this._ticket) return;
      const message = (cause && cause.message && i18n.message(cause.message)) || i18n.t('记录暂时未能读取，请重试。', "Couldn't load records. Please try again.");
      if (cause && cause.status === 401) this.setData({ needsLogin: true, loading: false, loadingMore: false, docs: [], hasMore: false });
      else this.setData(more ? { loadingMore: false, loadMoreError: message } : { loading: false, error: message });
    }
  },
  login() { navigation.login(); },
  openReceipt(event) {
    const { page, params } = event.currentTarget.dataset;
    if (page) navigation.go(page, params || {});
  },
  // 设置明确值：已归档→撤销归档，未归档→归档。写入令牌独立于读取票据：加载下一页或离页不作废写入结果，
  // 成功后按目标更新当前列表中的行（保留分页位置）；只有换账号或页面卸载才丢弃。锁只由持有令牌的写入释放。
  async setArchive(event) {
    const { target, archived } = event.currentTarget.dataset;
    if (this._write || !archive.valid(target)) return;
    const user = session.user();
    if (!user) return navigation.login();
    const next = archived !== true;
    const token = this._write = { target, identity: this._identity, credential: session.token() };
    // The token must still be current: any identity change (logout, other account, even re-login as the same one) clears _write.
    const same = () => this._write === token && !this._unloaded && this._identity === token.identity && identity(session.user()) === token.identity && session.token() === token.credential;
    this.setData({ docs: archive.mark(this.data.docs, target, { archiving: true }) });
    try {
      const result = await archive.set(target, next);
      if (!same()) return;
      const archivedNow = result && typeof result.archived === 'boolean' ? result.archived : next;
      this._writeSeq = (this._writeSeq || 0) + 1;
      this._confirmed = Object.assign({}, this._confirmed, { [target]: { archived: archivedNow, seq: this._writeSeq } });
      this.setData({ docs: archive.mark(this.data.docs, target, { archiving: false, archived: archivedNow }) });
      wx.showToast({ title: next ? i18n.t('已归档', 'Archived') : i18n.t('已撤销归档', 'Unarchived'), icon: 'none' });
    } catch (cause) {
      if (!same()) return;
      this.setData({ docs: archive.mark(this.data.docs, target, { archiving: false }) });
      wx.showToast({ title: (cause && cause.message && i18n.message(cause.message)) || (next ? i18n.t('归档失败，请稍后重试', "Couldn't archive. Please try again later.") : i18n.t('撤销归档失败，请稍后重试', "Couldn't unarchive. Please try again later.")), icon: 'none' });
    } finally { if (this._write === token) this._write = null; }
  },
}));
