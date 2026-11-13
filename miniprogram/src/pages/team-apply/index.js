function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const team = require('../../lib/team');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回', '‹ Back'],
  kicker: ['TEAMS · 建队', 'TEAMS · NEW TEAM'],
  title: ['建队申请', 'Team founding application'],
  lead: ['由有建队权限的社群管理员提交组织与训练计划，负责人批准后成立。', 'Community admins with founding rights submit an organisation and training plan; the team is founded once approved.'],
  busyNote: ['本次确认或保存尚未完成，完成后会核对最新记录。', 'This confirmation or save is still in progress; the latest record will be checked when it finishes.'],
  checking: ['正在核对权限与回执', 'Checking permissions and receipts'],
  retryRead: ['重试读取', 'Try again'],
  newApplication: ['填写建队申请', 'Start a founding application'],
  continueApplication: ['继续填写建队申请', 'Continue the founding application'],
  collapse: ['收起填写内容', 'Hide the form'],
  reviewEntry: ['建队申请审核', 'Review founding applications'],
  applicationPrefix: ['申请 ', 'Application '],
  ownPlan: ['本人建队计划', 'My team plan'],
  findOwn: ['查找本人申请', 'Find my application'],
  resubmitTitle: ['补充计划，重新提交', 'Revise the plan and resubmit'],
  newTitle: ['组织一支代表队', 'Organise a team'],
  editHint: ['沿用原社群与申请编号，补充内容后重新交给负责人审核。', 'Keeps the original community and application number; revised content goes back for review.'],
  findingPrefix: ['正在查找申请 ', 'Looking for application '],
  findingSuffix: ['。可继续加载下方本人记录，找到可编辑的回执后带入改稿。', '. Load more of your records below; an editable receipt opens in the form once found.'],
  refreshReceipts: ['刷新回执核对', 'Refresh receipts'],
  gameLabel: ['所属游戏社群 · 必选', 'Game community · required'],
  pickGame: ['请选择可申请的社群', 'Choose an eligible community'],
  gameLocked: ['修改时沿用原申请所属社群。', 'Edits keep the original community.'],
  nameLabel: ['拟用队名 · 必填', 'Proposed team name · required'],
  namePlaceholder: ['填写拟用队名', 'Enter a team name'],
  nameHint: ['2–80 字，便于负责人识别这支队伍。', '2–80 characters, so reviewers can identify the team.'],
  planLabel: ['组织与训练计划 · 必填', 'Organisation and training plan · required'],
  planHint: ['说明组队目的、队员组织方式与日常训练安排。', 'Describe the purpose, how members are organised and the regular training schedule.'],
  planPlaceholder: ['填写计划说明，10–3000 字', 'Describe the plan, 10–3000 characters'],
  privacyNote: ['提交内容仅供本人及有权限的审批负责人查看。批准后可安排招新与人工选拔。', 'Only you and authorised reviewers can see this. After approval you can arrange recruitment and trials.'],
  readPrivacy: ['阅读社团隐私说明', 'Read the club privacy notice'],
  noPermission: ['当前暂无可提交权限，请刷新回执及社群选项；已填内容会保留。', 'You cannot submit right now. Refresh receipts and community options; your input is kept.'],
  saveResubmit: ['保存并重新提交', 'Save and resubmit'],
  submit: ['提交建队申请', 'Submit founding application'],
  mine: ['我的建队申请', 'My founding applications'],
  refresh: ['刷新核对', 'Refresh'],
  noGames: ['暂无可申请建队的社群，本人历史回执仍可查看。', 'No community currently accepts founding applications; your past receipts remain available.'],
  updatedPrefix: ['更新于 ', 'Updated '],
  reviewerFeedback: ['负责人反馈', 'Reviewer feedback'],
  hidePlan: ['收起组织与训练计划', 'Hide the plan'],
  showPlan: ['查看已提交计划', 'View submitted plan'],
  editResubmit: ['修改并重新提交', 'Edit and resubmit'],
  withdraw: ['撤回建队申请', 'Withdraw application'],
  emptyTitle: ['暂无本人建队申请', 'No founding applications yet'],
  emptyBody: ['申请提交后，可在这里查看处理进度。', 'After you submit, track its progress here.'],
  loadMore: ['加载更多回执', 'Load more receipts'],
};

const decorate = doc => ({ ...doc, actions: doc.actions || {}, statusText: team.labels[doc.status] || i18n.t('状态待核对', 'Status pending'), dateText: format.date(doc.updatedAt) });
Page(withVisualTheme({
  data: { needsLogin: false, loading: false, error: '', formError: '', operationError: '', done: '', busy: false,
    docs: [], expandedId: '', page: 1, hasMore: false, games: [], actions: {}, apply: false, editId: '', revision: '', formGameID: '', gameIndex: 0,
    gameTitle: '', title: '', reason: '', canSubmit: false, pendingEdit: '' },
  ...actions,
  toggleRecord(event) {
    if (this.data.busy || this.data.loading || this.data.imageBusy) return;
    const doc = this.data.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (doc) this.setData({ expandedId: this.data.expandedId === doc.id ? '' : doc.id });
  },
  onLoad(options = {}) {
    i18n.bind(this, text);
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
      docs: [], expandedId: '', page: 1, hasMore: false, games: [], actions: {}, apply: false, editId: '', revision: '', formGameID: '', gameIndex: 0, gameTitle: '', title: '', reason: '', canSubmit: false, pendingEdit: '' });
  },
  onShow() {
    this._visible = true;
    i18n.navTitle('建立代表队申请', 'Team founding application');
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, busy: Boolean(this._pendingWrite) }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
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
      if (!result || !Array.isArray(result.docs) || !Array.isArray(result.proposalGames)) throw new Error(i18n.t('建队申请回执暂不可用，请重试', 'Founding receipts are unavailable. Please try again.'));
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
        else this.setData({ formError: doc ? i18n.t('此申请当前暂无可编辑操作，请查看最新回执', 'This application cannot be edited now; check the latest receipt.') : result.hasNextPage ? i18n.t('请继续加载本人回执查找此申请；当前不会创建新申请', 'Load more of your receipts to find this application; no new application will be created.') : i18n.t('未找到可编辑的本人申请，请返回回执重新选择', 'No editable application of yours was found; go back to your receipts and choose again.') });
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
      gameTitle: gameIndex >= 0 ? this.data.games[gameIndex].title : i18n.t('原申请社群', 'Original community'), title: doc.title, reason: doc.reason, formError: '', operationError: '', done: '' });
    this.checkEditor();
  },
  async submit() {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || this.data.busy || this.data.loading || !this.data.canSubmit) return;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, formError: '', done: '' });
    try {
      if (this.data.title.trim().length < 2 || this.data.reason.trim().length < 10) throw new Error(i18n.t('请填写至少 2 字的拟用队名及至少 10 字的组织与训练计划', 'Enter a team name of at least 2 characters and a plan of at least 10 characters.'));
      const response = await team.post({ operation: 'establish', gameID: this.data.formGameID, title: this.data.title.trim(), reason: this.data.reason.trim(),
        ...(this.data.editId ? { id: this.data.editId, revision: this.data.revision } : {}) });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error(i18n.t('保存结果暂不可用，请刷新回执核对', 'The save result is unavailable. Refresh your receipts to check.'));
      const saved = response.result, relation = value => value && typeof value === 'object' ? value.id : value;
      const record = decorate({ id: saved.id, title: saved.title || this.data.title, reason: saved.reason || this.data.reason,
        gameID: saved.gameID || relation(saved.game) || this.data.formGameID, teamID: saved.teamID || relation(saved.team) || null,
        status: saved.status || '', createdAt: saved.createdAt, updatedAt: saved.updatedAt, reviewNote: saved.reviewNote, actions: {} });
      this.setData({ docs: [record, ...this.data.docs.filter(doc => String(doc.id) !== String(record.id))], apply: false, editId: '', revision: '', title: '', reason: '', canSubmit: false, done: i18n.t('建队申请已提交，请刷新回执查看处理状态', 'Founding application submitted. Refresh your receipts to see its status.') });
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
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: i18n.t('撤回建队申请', 'Withdraw application'), content: i18n.t('确认撤回这份建队申请？原记录会保留，后续操作以回执中显示的权限为准。', 'Withdraw this founding application? The record is kept; later actions follow the permissions shown on the receipt.'),
        success: value => resolve(value.confirm), fail: () => reject(new Error(i18n.message('确认未完成，请重试'))) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const response = await team.post({ operation: 'withdraw-establishment', id: doc.id, revision: doc.updatedAt });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error(i18n.t('撤回结果暂不可用，请刷新回执核对', 'The withdrawal result is unavailable. Refresh your receipts to check.'));
      const saved = { ...doc, actions: {} };
      for (const key of ['status', 'updatedAt', 'reviewNote']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(doc.id) ? decorate(saved) : value), done: i18n.t('建队申请已撤回', 'Founding application withdrawn') });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
  review() { if (!this.data.loading && this.data.actions.reviewEstablishments) navigation.go('team-review', { mode: 'establishment' }); },
}));
