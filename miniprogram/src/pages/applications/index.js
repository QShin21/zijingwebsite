const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const privacy = require('../../lib/privacy');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const labels = { pending: '待审核', approved: '已批准并开放社群', returned: '退回补充', rejected: '已拒绝', withdrawn: '已撤回' };
const consentMessage = '由于入社流程规定，必须展示管理联系方式';
const identity = () => String((session.user() || {}).id || '');
const relation = value => value && typeof value === 'object' ? value.id : value;
const decorate = doc => ({ ...doc, actions: doc.actions || {}, dateText: format.date(doc.createdAt), statusText: labels[doc.status] || '状态待核对' });
const confirm = (title, content) => new Promise((resolve, reject) => wx.showModal({ title, content, success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，请重试')) }));

Page({
  data: { user: null, needsLogin: false, loading: false, error: '', docs: [], page: 1, hasMore: false,
    games: [{ id: '', title: '申请新游戏社群' }], gamesLoading: false, gamesError: '', gameIndex: 0,
    apply: false, mode: 'submit', editId: '', revision: '', proposedGame: '', realName: '', phone: '', reason: '',
    qr: '', savedQr: false, contactConsent: false, busy: false, imageBusy: false, formError: '', operationError: '', done: '' },
  ...actions,
  onLoad(options = {}) {
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate(); this._initialGame = options.game || '';
    this.setData({ apply: options.apply === '1' });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this._resumeRead = false; this.invalidate(); this.resetPrivate(); }
    });
  },
  onShow() {
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
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
  resetPrivate() {
    this._qr = '';
    this.setData({ user: session.user(), needsLogin: !session.user(), loading: false, error: '', docs: [], page: 1, hasMore: false,
      games: [{ id: '', title: '申请新游戏社群' }], gamesLoading: false, gamesError: '', gameIndex: 0,
      apply: false, mode: 'submit', editId: '', revision: '', proposedGame: '', realName: '', phone: '', reason: '',
      qr: '', savedQr: false, contactConsent: false, busy: Boolean(this._pendingWrite), imageBusy: false, formError: '', operationError: '', done: '' });
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, gamesLoading: false, busy: Boolean(this._pendingWrite), imageBusy: false }); },
  onUnload() { this.onHide(); this._disposed = true; this._qr = ''; if (this._unsubscribe) this._unsubscribe(); },
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
      const result = await http.request(`/api/miniapp/community/applications?page=${page}`, { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      if (!result || !Array.isArray(result.docs)) throw new Error('申请回执暂不可用，请重试');
      const docs = (more ? this.data.docs : []).concat(result.docs.map(decorate));
      this.setData({ docs: docs.filter((doc, index) => docs.findIndex(value => String(value.id) === String(doc.id)) === index),
        loading: false, page: result.page || page, hasMore: Boolean(result.hasNextPage) });
    } catch (cause) { if (this.valid(scope) && ticket === this._loadTicket) this.setData({ error: cause.message, loading: false }); }
    if (!more && this.valid(scope)) await this.loadGames();
  },
  async loadGames() {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (this.data.gamesLoading || !identity()) return;
    const scope = this._scope || 0, ticket = this._gamesTicket = (this._gamesTicket || 0) + 1;
    this.setData({ gamesLoading: true, gamesError: '' });
    try {
      const result = await cms.list('games', { limit: 50 });
      if (!this.valid(scope) || ticket !== this._gamesTicket) return;
      const games = [{ id: '', title: '申请新游戏社群' }, ...result.docs];
      const selected = this.data.games[this.data.gameIndex];
      let selectedID = this._initialGame || selected && selected.id || '';
      if (selectedID && !games.some(game => String(game.id) === String(selectedID))) {
        const game = selected && String(selected.id) === String(selectedID) ? selected : await cms.detail('games', selectedID);
        if (!this.valid(scope) || ticket !== this._gamesTicket) return;
        games.push({ id: game.id, title: game.title });
      }
      const latest = this.data.games[this.data.gameIndex];
      if (!this._initialGame && latest && String(latest.id) !== String(selectedID)) {
        selectedID = latest.id;
        if (selectedID && !games.some(game => String(game.id) === String(selectedID))) games.push(latest);
      }
      const index = games.findIndex(game => String(game.id) === String(selectedID));
      this._initialGame = '';
      this.setData({ games, gameIndex: Math.max(0, index), gamesLoading: false });
    } catch (cause) { if (this.valid(scope) && ticket === this._gamesTicket) this.setData({ gamesLoading: false, gamesError: cause.message }); }
  },
  toggle() { if (!this.data.busy && !this.data.imageBusy) this.setData({ apply: !this.data.apply, done: '' }); },
  newApplication() {
    if (this.data.busy || this.data.imageBusy) return;
    this._qr = ''; this._initialGame = '';
    this.setData({ apply: true, mode: 'submit', editId: '', revision: '', gameIndex: 0, proposedGame: '', realName: '', phone: '', reason: '',
      qr: '', savedQr: false, contactConsent: false, formError: '', operationError: '', done: '' });
  },
  input(event) {
    const field = event.currentTarget.dataset.field;
    if (!this.data.busy && ['proposedGame', 'realName', 'phone', 'reason'].includes(field)) this.setData({ [field]: event.detail.value });
  },
  consent(event) {
    if (this.data.busy) return;
    const contactConsent = Array.isArray(event.detail.value) && event.detail.value.includes('contact');
    this.setData({ contactConsent, ...(contactConsent && this.data.formError === consentMessage ? { formError: '' } : {}) });
  },
  game(event) {
    const index = Number(event.detail.value);
    if (!this.data.busy && Number.isInteger(index) && this.data.games[index]) { this._initialGame = ''; this.setData({ gameIndex: index }); }
  },
  async openContract() {
    const scope = this._scope || 0;
    try { await privacy.openContract(); }
    catch (cause) { if (this.valid(scope)) this.setData({ formError: cause.message }); }
  },
  async chooseQr() {
    if (this._disposed || this._visible === false || this._pendingWrite || this.data.busy || this.data.imageBusy || !identity()) return;
    const scope = this._scope || 0, ticket = this._imageTicket = (this._imageTicket || 0) + 1;
    this.setData({ imageBusy: true, formError: '' });
    try {
      await privacy.authorize();
      if (!this.valid(scope) || ticket !== this._imageTicket) return;
      const paths = await files.choose();
      if (!this.valid(scope) || ticket !== this._imageTicket) return;
      const qr = await files.readImage(paths[0]);
      if (!this.valid(scope) || ticket !== this._imageTicket) return;
      this._qr = qr; this.setData({ qr: paths[0], formError: '' });
    } catch (cause) { if (this.valid(scope) && ticket === this._imageTicket) this.setData({ formError: cause.message }); }
    finally { if (this.valid(scope) && ticket === this._imageTicket) this.setData({ imageBusy: false }); }
  },
  async openForm(event) {
    if (this.data.busy || this.data.imageBusy) return;
    const { id, action } = event.currentTarget.dataset;
    const doc = this.data.docs.find(value => String(value.id) === String(id));
    if (!doc || !['edit', 'card'].includes(action) || !doc.actions[action]) return;
    this._qr = ''; this._initialGame = '';
    const gameID = relation(doc.game) || '';
    const games = this.data.games.slice();
    let gameIndex = games.findIndex(game => String(game.id) === String(gameID));
    if (gameIndex < 0) { games.push({ id: gameID, title: doc.proposedGame || '已申请的游戏社群' }); gameIndex = games.length - 1; }
    this.setData({ apply: true, mode: action, editId: doc.id, revision: doc.updatedAt, games, gameIndex,
      proposedGame: doc.proposedGame || '', realName: doc.realName || '', phone: doc.phone || '', reason: doc.reason || '',
      qr: '', savedQr: true, contactConsent: doc.contactConsent === true, formError: '', operationError: '', done: '' });
    if (action === 'edit') await this.loadSavedQr(doc.id, true);
  },
  async loadSavedQr(id, forEdit = false) {
    if (this._disposed || this._visible === false || this._pendingWrite || this.data.imageBusy || !identity()) return;
    const scope = this._scope || 0, ticket = this._imageTicket = (this._imageTicket || 0) + 1;
    this.setData({ imageBusy: true });
    try {
      const doc = await http.request(`/api/community-applications/${encodeURIComponent(id)}?depth=0&select[wechatQr]=true`, { required: true });
      if (!this.valid(scope) || ticket !== this._imageTicket) return;
      const image = await files.localImage(doc.wechatQr);
      if (!this.valid(scope) || ticket !== this._imageTicket) return;
      if (!image) throw new Error('已保存名片暂时无法显示，可重试或选择新图片');
      if (forEdit && String(this.data.editId) === String(id)) { this._qr = doc.wechatQr; this.setData({ qr: image }); }
      else wx.previewImage({ current: image, urls: [image] });
    } catch (cause) {
      if (this.valid(scope) && ticket === this._imageTicket) this.setData(forEdit ? { formError: cause.message } : { operationError: cause.message });
    } finally { if (this.valid(scope) && ticket === this._imageTicket) this.setData({ imageBusy: false }); }
  },
  inspect(event) {
    const id = event.currentTarget.dataset.id;
    if (!this.data.busy && this.data.docs.some(doc => String(doc.id) === String(id))) return this.loadSavedQr(id);
  },
  inspectSaved() { if (this.data.editId) return this.loadSavedQr(this.data.editId, this.data.mode === 'edit'); },
  async submit() {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.busy || this.data.imageBusy) return;
    const mode = this.data.mode;
    if (mode !== 'card' && this.data.contactConsent !== true) {
      const scope = this._scope || 0;
      this.setData({ formError: consentMessage, operationError: '', done: '' }, () => {
        if (!this.valid(scope) || this._pendingWrite || !this.data.apply || this.data.formError !== consentMessage || this.data.mode === 'card' || this.data.contactConsent === true) return;
        if (typeof wx.pageScrollTo === 'function') wx.pageScrollTo({ selector: '#contact-consent', duration: 0, fail() {} });
      });
      return;
    }
    if (this.data.loading) return;
    if (mode !== 'submit') {
      const current = this.data.docs.find(doc => String(doc.id) === String(this.data.editId));
      if (!current || !current.actions[mode]) { this.setData({ formError: '申请已更新，请刷新回执后核对' }); return; }
    }
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, formError: '', operationError: '', done: '' });
    try {
      const data = { action: mode, contactConsent: this.data.contactConsent === true,
        ...(this._qr ? { wechatQr: this._qr } : {}), ...(mode === 'submit' ? {} : { id: this.data.editId, revision: this.data.revision }) };
      if (mode !== 'card') {
        const game = this.data.games[this.data.gameIndex];
        if (!this.data.realName.trim() || !/^\+?\d{6,20}$/.test(this.data.phone.trim()) || (!this._qr && !this.data.savedQr) || this.data.reason.trim().length < 10)
          throw new Error('请填写姓名、有效手机号、微信名片二维码和至少 10 字的申请说明');
        if (!game || !game.id && this.data.proposedGame.trim().length < 2) throw new Error('新游戏名称至少 2 字');
        Object.assign(data, { game: game.id || null, proposedGame: this.data.proposedGame.trim(), realName: this.data.realName.trim(),
          phone: this.data.phone.trim(), reason: this.data.reason.trim() });
      }
      const result = await http.request('/api/miniapp/community/applications', { method: 'POST', required: true, data });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!result || !result.application) throw new Error('保存结果暂不可用，请刷新回执核对');
      const saved = decorate({ ...result.application, actions: {} });
      this.setData({ docs: [saved, ...this.data.docs.filter(doc => String(doc.id) !== String(saved.id))] });
      this._qr = '';
      this.setData({ apply: false, mode: 'submit', editId: '', revision: '', proposedGame: '', realName: '', phone: '', reason: '', qr: '',
        savedQr: false, contactConsent: false, done: mode === 'card' ? '名片与展示设置已保存' : '申请已提交，请在回执中查看状态和处理意见' });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ formError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
  async withdraw(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.loading || this.data.busy || this.data.imageBusy) return;
    const doc = this.data.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (!doc || !doc.actions.withdraw) return;
    const scope = this._scope || 0, operation = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      if (!await confirm('撤回网站申请', '确认撤回这份申请？后续可从同一回执修改并重新提交。')) return;
      if (!this.valid(scope) || operation !== this._operation) return;
      const result = await http.request('/api/miniapp/community/applications', { method: 'POST', required: true,
        data: { action: 'withdraw', id: doc.id, revision: doc.updatedAt } });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!result || !result.application) throw new Error('撤回结果暂不可用，请刷新回执核对');
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(doc.id) ? decorate({ ...result.application, actions: {} }) : value), done: '网站申请已撤回' });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
});
