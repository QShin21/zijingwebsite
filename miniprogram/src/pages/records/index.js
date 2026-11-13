function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const session = require('../../lib/session');
const v2 = require('../../lib/v2');
const archive = require('../../lib/archive');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');

const identity = user => user && user.id != null ? String(user.id) : '';
const modes = {
  signups: { title: '全部报名', path: 'me/signups', hint: '归档仅从“我的赛程”隐藏该活动，不会取消报名；已归档的活动可在此撤销归档。' },
  applications: { title: '全部申请', path: 'me/applications', hint: '归档仅从“申请进度”隐藏该申请，不会撤回申请或改变审核状态；已归档的申请可在此撤销归档。' },
};

// 全部报名 / 全部申请：消费本人分页接口，展示已归档标识并可撤销归档。
Page(withVisualTheme({
  data: { mode: 'signups', title: '', hint: '', docs: [], page: 0, totalDocs: 0, hasMore: false, loading: false, loadingMore: false,
    error: '', loadMoreError: '', needsLogin: false, campus: false },
  ...actions,
  onLoad(options) {
    const mode = modes[options && options.mode] ? options.mode : 'signups';
    this.setData({ mode, title: modes[mode].title, hint: modes[mode].hint });
    wx.setNavigationBarTitle({ title: modes[mode].title });
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
  onUnload() { this._unloaded = true; this.onHide(); if (this._unsubscribe) this._unsubscribe(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  loadMore() { return this.onReachBottom(); },
  retry() { return this.load(); },
  async load(more = false) {
    const user = session.user();
    if (!user) { this.setData({ needsLogin: true, docs: [], hasMore: false }); return; }
    const campus = session.campus(user);
    if (this.data.mode === 'applications' && !campus) { this.setData({ needsLogin: false, campus, docs: [], hasMore: false, error: '申请记录仅面向清华账号。' }); return; }
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
      const message = (cause && cause.message) || '记录暂时未能读取，请重试。';
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
      wx.showToast({ title: next ? '已归档' : '已撤销归档', icon: 'none' });
    } catch (cause) {
      if (!same()) return;
      this.setData({ docs: archive.mark(this.data.docs, target, { archiving: false }) });
      wx.showToast({ title: (cause && cause.message) || (next ? '归档失败，请稍后重试' : '撤销归档失败，请稍后重试'), icon: 'none' });
    } finally { if (this._write === token) this._write = null; }
  },
}));
