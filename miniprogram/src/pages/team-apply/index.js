const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const team = require('../../lib/team');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
const decorate = doc => ({ ...doc, actions: doc.actions || {}, statusText: team.labels[doc.status] || '状态待核对', dateText: format.date(doc.updatedAt) });
Page({
  data: { needsLogin: false, loading: false, error: '', formError: '', operationError: '', done: '', busy: false,
    docs: [], page: 1, hasMore: false, games: [], actions: {}, apply: false, editId: '', revision: '', formGameID: '', gameIndex: 0,
    gameTitle: '', title: '', reason: '', canSubmit: false, pendingEdit: '' },
  ...actions,
  onLoad(options = {}) {
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate(); this._initialEdit = options.edit || '';
    this._initialGame = options.game || options.gameID || '';
    this.setData({ apply: options.apply === '1' || Boolean(this._initialEdit), pendingEdit: this._initialEdit });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this._resumeRead = false; this.invalidate(); this.resetPrivate(); }
    });
  },
  invalidate() { this._scope = (this._scope || 0) + 1; this._operation = (this._operation || 0) + 1; },
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
    this._initialEdit = ''; this._initialGame = '';
    this.setData({ needsLogin: !session.user(), loading: false, error: '', formError: '', operationError: '', done: '', busy: Boolean(this._pendingWrite),
      docs: [], page: 1, hasMore: false, games: [], actions: {}, apply: false, editId: '', revision: '', formGameID: '', gameIndex: 0, gameTitle: '', title: '', reason: '', canSubmit: false, pendingEdit: '' });
  },
  onShow() {
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, busy: Boolean(this._pendingWrite) }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.busy) return this.load(true); },
  checkEditor() {
    const game = this.data.games.find(value => String(value.id) === String(this.data.formGameID));
    const doc = this.data.docs.find(value => String(value.id) === String(this.data.editId));
    const canSubmit = Boolean(!this._initialEdit && game && game.actions && game.actions.establish && (this.data.editId ? doc && doc.actions.edit : this.data.actions.establish));
    this.setData({ canSubmit });
  },
  async load(more = false) {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (more && (this.data.loading || !this.data.hasMore)) return;
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1, page = more ? this.data.page + 1 : 1;
    this.setData({ loading: true, error: '' });
    try {
      const result = await http.request(`/api/miniapp/team/establishments?mode=own&page=${page}`, { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      if (!result || !Array.isArray(result.docs) || !Array.isArray(result.proposalGames)) throw new Error('建队申请回执暂不可用，请重试');
      const docs = (more ? this.data.docs : []).concat(result.docs.map(decorate));
      const games = result.proposalGames, requestedGame = this._initialGame || this.data.formGameID || games[0] && games[0].id || '';
      const gameIndex = games.findIndex(game => String(game.id) === String(requestedGame));
      this._initialGame = '';
      this.setData({ loading: false, docs: docs.filter((doc, index) => docs.findIndex(value => String(value.id) === String(doc.id)) === index),
        page: result.page || page, hasMore: Boolean(result.hasNextPage), games, actions: result.actions || {}, gameIndex: Math.max(0, gameIndex),
        ...(!this.data.editId ? { formGameID: gameIndex >= 0 ? games[gameIndex].id : '', gameTitle: gameIndex >= 0 ? games[gameIndex].title : '' } : {}) });
      if (this._initialEdit) {
        const doc = this.data.docs.find(value => String(value.id) === String(this._initialEdit));
        if (doc && doc.actions.edit) { this._initialEdit = ''; this.setData({ pendingEdit: '' }); this.openForm({ currentTarget: { dataset: { id: doc.id } } }); }
        else this.setData({ formError: doc ? '此申请当前暂无可编辑操作，请查看最新回执' : result.hasNextPage ? '请继续加载本人回执查找此申请；当前不会创建新申请' : '未找到可编辑的本人申请，请返回回执重新选择' });
      }
      this.checkEditor();
    } catch (cause) {
      if (this.valid(scope) && ticket === this._loadTicket) {
        if (cause.status === 401) this.resetPrivate();
        this.setData({ loading: false, error: cause.message, ...(cause.status === 401 ? { needsLogin: true } : {}) });
      }
    }
  },
  newApplication() {
    if (this.data.busy || this.data.loading) return;
    const game = this.data.games[0];
    this._initialEdit = ''; this._initialGame = '';
    this.setData({ apply: true, editId: '', revision: '', title: '', reason: '', formError: '', done: '', gameIndex: 0, pendingEdit: '',
      formGameID: game && game.id || '', gameTitle: game && game.title || '' });
    this.checkEditor();
  },
  toggle() { if (!this.data.busy) this.setData({ apply: !this.data.apply }); },
  input(event) {
    const field = event.currentTarget.dataset.field;
    if (!this.data.busy && ['title', 'reason'].includes(field)) this.setData({ [field]: event.detail.value });
  },
  game(event) {
    if (this.data.busy || this.data.editId) return;
    const index = Number(event.detail.value), game = this.data.games[index];
    if (game) { this.setData({ gameIndex: index, formGameID: game.id, gameTitle: game.title }); this.checkEditor(); }
  },
  openForm(event) {
    if (this.data.busy || this.data.loading) return;
    const doc = this.data.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (!doc || !doc.actions.edit) return;
    this._initialEdit = ''; this.setData({ pendingEdit: '' });
    const gameIndex = this.data.games.findIndex(game => String(game.id) === String(doc.gameID));
    this.setData({ apply: true, editId: doc.id, revision: doc.updatedAt, formGameID: doc.gameID, gameIndex: Math.max(0, gameIndex),
      gameTitle: gameIndex >= 0 ? this.data.games[gameIndex].title : '原申请社群', title: doc.title, reason: doc.reason, formError: '', operationError: '', done: '' });
    this.checkEditor();
  },
  async submit() {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.busy || this.data.loading || !this.data.canSubmit) return;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, formError: '', done: '' });
    try {
      if (this.data.title.trim().length < 2 || this.data.reason.trim().length < 10) throw new Error('请填写至少 2 字的拟用队名及至少 10 字的组织与训练计划');
      const response = await team.post({ operation: 'establish', gameID: this.data.formGameID, title: this.data.title.trim(), reason: this.data.reason.trim(),
        ...(this.data.editId ? { id: this.data.editId, revision: this.data.revision } : {}) });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error('保存结果暂不可用，请刷新回执核对');
      const saved = response.result, relation = value => value && typeof value === 'object' ? value.id : value;
      const record = decorate({ id: saved.id, title: saved.title || this.data.title, reason: saved.reason || this.data.reason,
        gameID: saved.gameID || relation(saved.game) || this.data.formGameID, teamID: saved.teamID || relation(saved.team) || null,
        status: saved.status || '', createdAt: saved.createdAt, updatedAt: saved.updatedAt, reviewNote: saved.reviewNote, actions: {} });
      this.setData({ docs: [record, ...this.data.docs.filter(doc => String(doc.id) !== String(record.id))], apply: false, editId: '', revision: '', title: '', reason: '', canSubmit: false, done: '建队申请已提交，请刷新回执查看处理状态' });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ formError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
  async withdraw(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.busy || this.data.loading) return;
    const doc = this.data.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (!doc || !doc.actions.withdraw) return;
    const scope = this._scope || 0, operation = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: '撤回建队申请', content: '确认撤回这份建队申请？原记录会保留，后续操作以回执中显示的权限为准。',
        success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const response = await team.post({ operation: 'withdraw-establishment', id: doc.id, revision: doc.updatedAt });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error('撤回结果暂不可用，请刷新回执核对');
      const saved = { ...doc, actions: {} };
      for (const key of ['status', 'updatedAt', 'reviewNote']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(doc.id) ? decorate(saved) : value), done: '建队申请已撤回' });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
  review() { if (!this.data.loading && this.data.actions.reviewEstablishments) navigation.go('team-review', { mode: 'establishment' }); },
});
