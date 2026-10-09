const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const labels = { pending: '审核中', approved: '已通过', rejected: '未通过' };
Page({
  data: { user: null, needsLogin: false, loading: false, error: '', docs: [], page: 1, hasMore: false,
    apply: false, games: [{ id: '', title: '申请新游戏社群' }], gameIndex: 0, proposedGame: '', realName: '', phone: '', reason: '', qr: '', busy: false, done: false },
  ...actions,
  onLoad(options) { this.setData({ apply: options.apply === '1' }); },
  onShow() { this.load(); },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(true); },
  async load(more = false) {
    if (!protect(this)) return;
    this.setData({ loading: true, error: '' });
    try {
      const result = await http.request(`/api/community-applications?${cms.query({ depth: 0, limit: 15, page: more ? this.data.page + 1 : 1,
        sort: '-createdAt', 'where[applicant][equals]': session.user().id,
        ...cms.selection(['proposedGame', 'game', 'status', 'createdAt', 'reason', 'realName', 'phone']) })}`, { required: true });
      this.setData({ docs: (more ? this.data.docs : []).concat(result.docs.map(doc => ({ ...doc, dateText: format.date(doc.createdAt), statusText: labels[doc.status] }))),
        loading: false, page: result.page, hasMore: result.hasNextPage });
      const games = await cms.list('games', { limit: 50 });
      this.setData({ games: [{ id: '', title: '申请新游戏社群' }, ...games.docs] });
    } catch (cause) { this.setData({ error: cause.message, loading: false }); }
  },
  toggle() { this.setData({ apply: !this.data.apply, done: false }); },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  game(event) { this.setData({ gameIndex: Number(event.detail.value) }); },
  async chooseQr() {
    try { const paths = await files.choose(); this._qr = await files.readImage(paths[0]); this.setData({ qr: paths[0], error: '' }); }
    catch (cause) { this.setData({ error: cause.message }); }
  },
  async submit() {
    if (!session.user() || this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const game = this.data.games[this.data.gameIndex];
      if (!this.data.realName.trim() || !/^\+?\d{6,20}$/.test(this.data.phone.trim()) || !this._qr || this.data.reason.trim().length < 10)
        throw new Error('请填写姓名、有效手机号、微信名片二维码和至少 10 字的申请说明');
      if (!game.id && this.data.proposedGame.trim().length < 2) throw new Error('新游戏名称至少 2 字');
      await http.request('/api/community-applications', { method: 'POST', required: true, data: {
        applicant: session.user().id, ...(game.id ? { game: game.id } : {}), proposedGame: this.data.proposedGame.trim(),
        realName: this.data.realName.trim(), phone: this.data.phone.trim(), reason: this.data.reason.trim(), wechatQr: this._qr } });
      this._qr = ''; this.setData({ apply: false, done: true, proposedGame: '', realName: '', phone: '', reason: '', qr: '' });
      await this.load();
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
  async inspect(event) {
    try {
      const doc = await http.request(`/api/community-applications/${event.currentTarget.dataset.id}?depth=0&select[wechatQr]=true`, { required: true });
      const image = await files.localImage(doc.wechatQr); if (image) wx.previewImage({ urls: [image] });
    } catch (cause) { this.setData({ error: cause.message }); }
  },
});
