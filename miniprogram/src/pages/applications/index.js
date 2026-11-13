const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const privacy = require('../../lib/privacy');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const labels = { pending: '待审核', approved: '已批准并开放社群', returned: '退回补充', rejected: '已拒绝', withdrawn: '已撤回' };
const labelsEn = { pending: 'Pending review', approved: 'Approved, community opened', returned: 'Returned for more information', rejected: 'Rejected', withdrawn: 'Withdrawn' };
const consentMessage = '由于入社流程规定，必须展示管理联系方式';
// Local and server consent errors are shown in the current language; both forms mean the same rule.
const isConsent = value => value === consentMessage || value === i18n.message(consentMessage);
const newGame = () => ({ id: '', title: i18n.t('申请新游戏社群', 'Apply for a new game community') });
const text = {
  back: ['‹ 返回', '‹ Back'],
  kicker: ['COMMUNITY · 社群管理员', 'COMMUNITY ADMIN'],
  heroTitle: ['社群管理员申请', 'Community admin application'],
  heroLead: ['组织一个游戏社群，或参与已有社群的日常管理。申请进度和负责人反馈会保留在本页。', 'Organize a game community or help run an existing one. Progress and feedback stay on this page.'],
  doneNote: ['微信群仍由管理员人工建立与拉群。', 'WeChat groups are still created and joined manually by admins.'],
  collapseForm: ['收起填写内容', 'Hide form'],
  continueCard: ['继续调整名片与展示', 'Continue card and display settings'],
  continueApply: ['继续填写申请', 'Continue application'],
  startApply: ['填写管理员申请', 'Apply to be an admin'],
  anotherApply: ['填写另一份申请', 'Start another application'],
  headCard: ['名片与展示设置', 'Contact card and display'],
  headEdit: ['修改并重新提交', 'Edit and resubmit'],
  headSubmit: ['填写申请资料', 'Application details'],
  leadCard: ['管理已批准申请的进群联系方式。', 'Manage the group contact for an approved application.'],
  leadEdit: ['根据处理意见补充资料，提交后重新进入审核。', 'Add details based on the feedback; resubmitting starts a new review.'],
  leadSubmit: ['请填写本人资料，并说明希望承担的社群工作。', 'Fill in your details and describe the community work you would like to take on.'],
  receiptPrefix: ['回执 ', 'Receipt '],
  receiptKeepSuffix: ['，本次保存沿用这份申请。', '; this save updates the same application.'],
  section1: ['① 社群与组织计划', '① Community and plan'],
  gameLabel: ['游戏社群 ', 'Game community '],
  requiredPick: ['必选', 'Required'],
  required: ['必填', 'Required'],
  gamesLoading: ['正在读取社群选项…', 'Loading communities…'],
  gamesErrorPrefix: ['社群选项加载失败：', 'Could not load communities: '],
  retryGames: ['重试社群选项', 'Retry communities'],
  newGameLabel: ['新游戏名称 ', 'New game name '],
  newGamePlaceholder: ['2–80 字', '2–80 characters'],
  reasonLabel: ['申请说明 ', 'Reason '],
  reasonPlaceholder: ['介绍组织计划、管理经验与可投入时间', 'Describe your plan, admin experience and available time'],
  reasonHint: ['10–3000 字。写清活动安排和日常管理计划，方便负责人评估。', '10–3000 characters. Describe planned activities and daily management so reviewers can assess.'],
  section2: ['② 审核联系资料', '② Contact details for review'],
  privateHint: ['姓名与手机号仅供本人及有权限的负责人审核使用。', 'Your name and mobile number are only used by you and authorized reviewers.'],
  nameLabel: ['姓名 ', 'Name '],
  namePlaceholder: ['填写本人姓名', 'Your name'],
  phoneLabel: ['手机号 ', 'Mobile '],
  phonePlaceholder: ['可含 + 国际区号', 'May include + country code'],
  contactCard: ['进群联系方式', 'Group contact'],
  contactStep: ['③ 进群联系方式', '③ Group contact'],
  contactHint: ['获批并在任期间，已授权名片用于同学联系你申请加入微信群。', 'While approved and in office, your authorized card lets members contact you to join the WeChat group.'],
  qrLabel: ['微信个人名片二维码 ', 'WeChat contact-card QR code '],
  previewCard: ['预览微信名片', 'Preview WeChat card'],
  previewFailed: ['名片预览暂时无法显示。原图片与已填资料已保留，可重试预览或重新选择图片。', 'The card preview cannot be shown. The image and your details are kept; retry or choose another image.'],
  retryPreview: ['重试名片预览', 'Retry preview'],
  savedKept: ['已保存的名片会继续保留，可主动查看或更换。', 'Your saved card is kept; you can view or replace it.'],
  readingCard: ['正在读取名片…', 'Loading card…'],
  chooseNewQr: ['选择新二维码图片', 'Choose a new QR image'],
  chooseQr: ['选择二维码图片', 'Choose QR image'],
  viewSaved: ['查看已保存名片', 'View saved card'],
  qrHint: ['PNG、JPEG 或 WebP，2 MB 以内。取消选择或拒绝授权后，已填内容保留，可再次主动选择。', 'PNG, JPEG or WebP, up to 2 MB. If you cancel or decline authorization, your input is kept and you can choose again.'],
  consentTitle: ['名片展示同意', 'Contact-card consent'],
  consentLabel: ['我同意展示我的微信名片作为进群联系方式', 'I agree to show my WeChat card as the group contact'],
  consentCardHint: ['取消勾选并保存，即关闭名片展示。', 'Uncheck and save to stop showing your card.'],
  consentHint: ['由本人主动勾选；获批后可在本回执关闭展示。', 'Check this yourself; after approval you can turn it off from this receipt.'],
  consentMessage: ['由于入社流程规定，必须展示管理联系方式', 'The joining process requires showing your contact card to the admins.'],
  privacyAuthHint: ['选择图片需另行完成微信隐私授权；完成该授权后，仍需在此主动确认名片展示。', 'Choosing an image needs WeChat privacy authorization; afterwards you still need to confirm card display here.'],
  noteCard: ['保存后，按本次勾选更新名片展示设置。', 'Saving updates your card display setting as checked.'],
  noteSubmit: ['申请资料用于审核。提交和批准均不会自动加入微信群。', 'Application details are used for review. Neither submitting nor approval adds you to a WeChat group automatically.'],
  wechatPrivacy: ['微信隐私指引', 'WeChat privacy guide'],
  clubPrivacy: ['社团隐私说明', 'Club privacy notice'],
  saving: ['正在保存…', 'Saving…'],
  saveCard: ['保存名片与展示设置', 'Save card and display'],
  saveEdit: ['保存并重新提交', 'Save and resubmit'],
  submit: ['提交申请', 'Submit application'],
  receiptsTitle: ['我的申请回执', 'My application receipts'],
  receiptsLead: ['查看处理意见，或继续原申请。', 'See feedback or continue an application.'],
  refresh: ['刷新核对', 'Refresh'],
  savedKeptBelow: ['已确认保存的回执仍保留在下方，刷新后再核对最新可用操作。', 'Confirmed receipts remain below; refresh to check the latest available actions.'],
  readingReceipts: ['正在读取回执', 'Loading receipts'],
  gameFallback: ['游戏社群申请', 'Game community application'],
  progressLabel: ['办理进度', 'Progress'],
  stepSubmitted: ['已提交', 'Submitted'],
  stepReview: ['审核中', 'In review'],
  stepRejected: ['未通过', 'Not approved'],
  stepResult: ['结果', 'Result'],
  notePending: ['等待负责人审核，处理意见会显示在这份回执中。', 'Awaiting review; feedback will appear on this receipt.'],
  noteApproved: ['申请已获批。微信群的建立和成员邀请仍需人工完成。', 'Approved. Creating the WeChat group and inviting members is still done manually.'],
  noteReturned: ['请按反馈补充资料，再从这份回执重新提交。', 'Add details per the feedback, then resubmit from this receipt.'],
  noteWithdrawn: ['网站申请已撤回，可按可用操作修改并重新提交。', 'The website application was withdrawn; you can edit and resubmit where allowed.'],
  noteRejected: ['负责人已完成审核，请查看处理意见。', 'The review is complete; see the feedback.'],
  noteUnknown: ['请刷新回执，核对最新申请状态。', 'Refresh the receipt to check the latest status.'],
  reviewerFeedback: ['负责人反馈', 'Reviewer feedback'],
  collapseDetails: ['收起申请资料', 'Hide details'],
  viewDetails: ['查看已提交资料', 'View submitted details'],
  plan: ['组织计划', 'Plan'],
  name: ['姓名', 'Name'],
  phone: ['手机号', 'Mobile'],
  cardDisplay: ['名片展示', 'Card display'],
  cardAuthorized: ['已授权在任期间展示', 'Shown while in office'],
  cardNotAuthorized: ['未授权展示', 'Not authorized'],
  viewSubmittedQr: ['查看已提交二维码', 'View submitted QR code'],
  editResubmit: ['修改并重新提交', 'Edit and resubmit'],
  updateCard: ['更新名片与授权', 'Update card and consent'],
  withdraw: ['撤回网站申请', 'Withdraw website application'],
  emptyTitle: ['尚未提交申请', 'No applications yet'],
  emptyBody: ['填写社群与组织计划后，回执会保留在这里。', 'After you submit your community plan, the receipt will stay here.'],
  more: ['加载更多回执', 'Load more receipts'],
};
const identity = () => String((session.user() || {}).id || '');
const relation = value => value && typeof value === 'object' ? value.id : value;
const decorate = doc => ({ ...doc, actions: doc.actions || {}, dateText: format.date(doc.createdAt), statusText: labels[doc.status] ? i18n.t(labels[doc.status], labelsEn[doc.status]) : i18n.t('状态待核对', 'Status to be checked') });
const confirm = (title, content) => new Promise((resolve, reject) => wx.showModal({ title, content, success: value => resolve(value.confirm), fail: () => reject(new Error(i18n.message('确认未完成，请重试'))) }));

Page(withVisualTheme({
  data: { user: null, needsLogin: false, loading: false, error: '', docs: [], expandedId: '', page: 1, hasMore: false,
    games: [newGame()], gamesLoading: false, gamesError: '', gameIndex: 0,
    apply: false, mode: 'submit', editId: '', revision: '', proposedGame: '', realName: '', phone: '', reason: '',
    qr: '', qrFailed: false, qrPreviewScope: 0, savedQr: false, contactConsent: false, busy: false, imageBusy: false, formError: '', operationError: '', done: '' },
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
    this._identity = identity(); this.resetPrivate(); this._initialGame = options.game || '';
    this.setData({ apply: options.apply === '1' });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this._resumeRead = false; this.invalidate(); this.resetPrivate(); }
    });
  },
  onShow() {
    i18n.navTitle('管理员申请', 'Admin Application');
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    this.setData({ qrPreviewScope: this._scope || 0 });
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
    this.setData({ user: session.user(), needsLogin: !session.user(), loading: false, error: '', docs: [], expandedId: '', page: 1, hasMore: false,
      games: [newGame()], gamesLoading: false, gamesError: '', gameIndex: 0,
      apply: false, mode: 'submit', editId: '', revision: '', proposedGame: '', realName: '', phone: '', reason: '',
      qr: '', qrFailed: false, qrPreviewScope: this._scope || 0, savedQr: false, contactConsent: false, busy: Boolean(this._pendingWrite), imageBusy: false, formError: '', operationError: '', done: '' });
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, gamesLoading: false, busy: Boolean(this._pendingWrite), imageBusy: false }); },
  onUnload() { this.onHide(); this._disposed = true; this._qr = ''; if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
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
      if (!result || !Array.isArray(result.docs)) throw new Error(i18n.t('申请回执暂不可用，请重试', 'Application receipts are unavailable. Please try again.'));
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
      const games = [newGame(), ...result.docs];
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
      qr: '', qrFailed: false, savedQr: false, contactConsent: false, formError: '', operationError: '', done: '' });
  },
  input(event) {
    const field = event.currentTarget.dataset.field;
    if (!this.data.busy && ['proposedGame', 'realName', 'phone', 'reason'].includes(field)) this.setData({ [field]: event.detail.value });
  },
  consent(event) {
    if (this.data.busy) return;
    const contactConsent = Array.isArray(event.detail.value) && event.detail.value.includes('contact');
    this.setData({ contactConsent, ...(contactConsent && isConsent(this.data.formError) ? { formError: '' } : {}) });
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
  qrImageError(event) {
    const { url, scope } = event.currentTarget.dataset;
    if (!url || url !== this.data.qr || !this.data.apply || !this.valid(Number(scope))) return;
    this.setData({ qrFailed: true });
  },
  retryQrPreview(event) {
    const { url, scope } = event.currentTarget.dataset;
    if (this.data.busy || this.data.imageBusy || !url || url !== this.data.qr || !this.data.apply || !this.valid(Number(scope))) return;
    this.setData({ qrFailed: false });
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
      this._qr = qr; this.setData({ qr: paths[0], qrFailed: false, qrPreviewScope: scope, formError: '' });
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
    if (gameIndex < 0) { games.push({ id: gameID, title: doc.proposedGame || i18n.t('已申请的游戏社群', 'Requested game community') }); gameIndex = games.length - 1; }
    this.setData({ apply: true, mode: action, editId: doc.id, revision: doc.updatedAt, games, gameIndex,
      proposedGame: doc.proposedGame || '', realName: doc.realName || '', phone: doc.phone || '', reason: doc.reason || '',
      qr: '', qrFailed: false, savedQr: true, contactConsent: doc.contactConsent === true, formError: '', operationError: '', done: '' });
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
      if (!image) throw new Error(i18n.t('已保存名片暂时无法显示，可重试或选择新图片', 'The saved card cannot be shown. Retry or choose a new image.'));
      if (forEdit && String(this.data.editId) === String(id)) { this._qr = doc.wechatQr; this.setData({ qr: image, qrFailed: false, qrPreviewScope: scope }); }
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
      this.setData({ formError: i18n.message(consentMessage), operationError: '', done: '' }, () => {
        if (!this.valid(scope) || this._pendingWrite || !this.data.apply || !isConsent(this.data.formError) || this.data.mode === 'card' || this.data.contactConsent === true) return;
        if (typeof wx.pageScrollTo === 'function') wx.pageScrollTo({ selector: '#contact-consent', duration: 0, fail() {} });
      });
      return;
    }
    if (this.data.loading) return;
    if (mode !== 'submit') {
      const current = this.data.docs.find(doc => String(doc.id) === String(this.data.editId));
      if (!current || !current.actions[mode]) { this.setData({ formError: i18n.t('申请已更新，请刷新回执后核对', 'The application has changed. Refresh the receipt to check.') }); return; }
    }
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, formError: '', operationError: '', done: '' });
    try {
      const data = { action: mode, contactConsent: this.data.contactConsent === true,
        ...(this._qr ? { wechatQr: this._qr } : {}), ...(mode === 'submit' ? {} : { id: this.data.editId, revision: this.data.revision }) };
      if (mode !== 'card') {
        const game = this.data.games[this.data.gameIndex];
        if (!this.data.realName.trim() || !/^\+?\d{6,20}$/.test(this.data.phone.trim()) || (!this._qr && !this.data.savedQr) || this.data.reason.trim().length < 10)
          throw new Error(i18n.t('请填写姓名、有效手机号、微信名片二维码和至少 10 字的申请说明', 'Enter your name, a valid mobile number, a WeChat card QR code and a reason of at least 10 characters.'));
        if (!game || !game.id && this.data.proposedGame.trim().length < 2) throw new Error(i18n.t('新游戏名称至少 2 字', 'The new game name needs at least 2 characters.'));
        Object.assign(data, { game: game.id || null, proposedGame: this.data.proposedGame.trim(), realName: this.data.realName.trim(),
          phone: this.data.phone.trim(), reason: this.data.reason.trim() });
      }
      const result = await http.request('/api/miniapp/community/applications', { method: 'POST', required: true, data });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!result || !result.application) throw new Error(i18n.t('保存结果暂不可用，请刷新回执核对', 'The save result is unavailable. Refresh the receipt to check.'));
      const saved = decorate({ ...result.application, actions: {} });
      this.setData({ docs: [saved, ...this.data.docs.filter(doc => String(doc.id) !== String(saved.id))] });
      this._qr = '';
      this.setData({ apply: false, mode: 'submit', editId: '', revision: '', proposedGame: '', realName: '', phone: '', reason: '', qr: '', qrFailed: false,
        savedQr: false, contactConsent: false, done: mode === 'card' ? i18n.t('名片与展示设置已保存', 'Card and display settings saved') : i18n.t('申请已提交，请在回执中查看状态和处理意见', 'Application submitted. Check the status and feedback on the receipt.') });
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
      if (!await confirm(i18n.t('撤回网站申请', 'Withdraw website application'), i18n.t('确认撤回这份申请？后续可从同一回执修改并重新提交。', 'Withdraw this application? You can edit and resubmit from the same receipt later.'))) return;
      if (!this.valid(scope) || operation !== this._operation) return;
      const result = await http.request('/api/miniapp/community/applications', { method: 'POST', required: true,
        data: { action: 'withdraw', id: doc.id, revision: doc.updatedAt } });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!result || !result.application) throw new Error(i18n.t('撤回结果暂不可用，请刷新回执核对', 'The withdrawal result is unavailable. Refresh the receipt to check.'));
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(doc.id) ? decorate({ ...result.application, actions: {} }) : value), done: i18n.t('网站申请已撤回', 'Website application withdrawn') });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
}));
