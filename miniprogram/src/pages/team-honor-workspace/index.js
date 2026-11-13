function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const flow = require('../../lib/team-honor-workflow');
const navigation = require('../../lib/navigation');
const config = require('../../config');
const media = require('../../lib/honor-media');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回', '‹ Back'],
  kickerReview: ['社群管理 · 荣誉审核', 'Community admin · Honor review'],
  kickerMine: ['队伍成果 · 本人记录', 'Team achievements · My records'],
  titleReview: ['荣誉审核工作台', 'Honor review workbench'],
  titleMine: ['我的荣誉投稿', 'My honor submissions'],
  leadReview: ['核对本次文字与成果材料，再决定是否进入公开档案。', 'Check the text and evidence before deciding whether it enters the public archive.'],
  leadMine: ['继续草稿、查看审核反馈，记录队伍的共同成果。', 'Continue drafts, read review feedback and record team achievements.'],
  tabMine: ['我的记录', 'My records'],
  tabReview: ['社群审核', 'Community review'],
  create: ['＋ 新建荣誉投稿', '＋ New honor submission'],
  createHint: ['现任队员可投稿，由本社群其他有权限的管理员审核。', 'Current members can submit; other authorised admins of this community review.'],
  noTeams: ['当前暂无可投稿的有效队伍，本人历史记录仍保留。', 'No eligible team to submit for right now; your past records are kept.'],
  busyNote: ['本次确认、读取或保存尚未结束，请稍候。', 'A confirmation, read or save is still in progress. Please wait.'],
  checking: ['正在核对荣誉与操作权限…', 'Checking honors and permissions…'],
  reload: ['重新加载', 'Reload'],
  scopeRecords: ['当前授权范围的记录', 'Records in your scope'],
  receipts: ['投稿回执', 'Submission receipts'],
  totalPrefix: ['共 ', ''],
  totalMiddle: [' 条，已加载至第 ', ' records, loaded through page '],
  totalSuffix: [' 页', ''],
  refresh: ['刷新核对', 'Refresh'],
  placingPending: ['奖项待补充', 'Placing to be added'],
  datePending: ['日期待补充', 'Date to be added'],
  competitionPending: ['赛事待补充', 'Competition to be added'],
  teamPrefix: ['队伍 ', 'Team '],
  submissionPrefix: ['投稿 ', 'Submission '],
  revisionPrefix: ['修订 ', 'Revision '],
  authorPrefix: ['投稿人：', 'Submitted by: '],
  feedback: ['处理反馈', 'Feedback'],
  inspect: ['查看文字与本次证据', 'View text and evidence'],
  materials: ['本次审核材料', 'Review materials'],
  collapse: ['收起', 'Collapse'],
  materialsHint: ['批准前仅本人及当前有权审核者可读；获批材料随荣誉档案公开。', 'Before approval only you and authorised reviewers can read this; approved material is published with the archive.'],
  imagesPrefix: ['图片 ', 'Images: '],
  imagesSuffix: [' 份', ''],
  withVideo: ['，含视频', ', with video'],
  evidenceImage: ['荣誉证据图片', 'Honor evidence image'],
  readVideo: ['读取本次视频证据', 'Load video evidence'],
  videoLabel: ['本次荣誉视频证据', 'Honor video evidence'],
  copyWebsite: ['复制网站证据页地址', 'Copy website evidence link'],
  decide: ['处理这份荣誉', 'Decide on this honor'],
  decideHint: ['请核对本修订的材料与公开范围。批准后进入队伍荣誉档案，并显示在对应社群的荣誉索引中。', 'Check this revision\'s material and visibility. Once approved it enters the team archive and the community honors index.'],
  noteLabel: ['处理说明', 'Note'],
  notePlaceholder: ['退回、拒绝或隐藏须说明原因', 'A reason is required to return, reject or hide'],
  hide: ['隐藏荣誉', 'Hide honor'],
  continueDraft: ['继续编辑草稿', 'Continue draft'],
  editResubmit: ['修改 / 重新提交', 'Edit / resubmit'],
  withdraw: ['撤回投稿', 'Withdraw submission'],
  readOnly: ['当前回执只读，请重新加载核对操作。', 'This receipt is read-only. Reload to check available actions.'],
  emptyReview: ['当前范围暂无荣誉记录', 'No honor records in your scope'],
  emptyMine: ['尚无本人荣誉投稿', 'No honor submissions yet'],
  emptyReviewHint: ['可刷新核对最新投稿与权限。', 'Refresh to check new submissions and permissions.'],
  emptyMineHint: ['有可投稿的队伍时，可从上方新建一份荣誉。', 'When you have an eligible team, create a submission above.'],
  loadMore: ['加载更多记录', 'Load more records'],
};
const title = view => view === 'review' ? i18n.t('荣誉审核工作台', 'Honor review workbench') : i18n.t('我的荣誉投稿', 'My honor submissions');

Page(withVisualTheme({
  data: { needsLogin: false, loading: false, ready: false, busy: false, error: '', operationError: '', message: '', view: 'mine',
    actions: {}, teams: [], docs: [], page: 1, totalPages: 0, totalDocs: 0, hasMore: false, detail: null, detailImages: [], imageError: '', videoSource: '', videoError: '' },
  back: navigation.back,
  login: navigation.login,
  onLoad(options = {}) {
    i18n.bind(this, text);
    this._query = { view: options.view === 'review' ? 'review' : 'mine', team: options.team || '', game: options.game || '' };
    flow.connect(this, JSON.stringify(this._query)); this.setData({ view: this._query.view });
    wx.setNavigationBarTitle({ title: title(this._query.view) });
  },
  resetPrivate() {
    this.clearMedia(); this._records = new Map(); this._acknowledged = new Map(); this._loading = null; this._fresh = false;
    this.setData({ needsLogin: !flow.actor(), loading: false, ready: false, busy: flow.pending(this), error: '', operationError: '', message: '',
      actions: {}, teams: [], docs: [], page: 1, totalPages: 0, totalDocs: 0, hasMore: false, detail: null, detailImages: [], imageError: '', videoSource: '', videoError: '' });
  },
  clearMedia() {
    if (this._videoReadTask && typeof this._videoReadTask.abort === 'function') this._videoReadTask.abort(); this._videoReadTask = null;
    try { if (typeof wx.createVideoContext === 'function') wx.createVideoContext('honor-evidence', this).stop(); } catch { /* Return navigation stays available. */ }
    media.removeMedia(this._videoSource ? [this._videoSource] : []); this._videoSource = ''; this._videoRecord = null;
    this._mediaTurn = (this._mediaTurn || 0) + 1; flow.removePictures(this._paths || []); this._paths = []; this._detail = null;
    this.setData({ detail: null, detailImages: [], imageError: '', videoSource: '', videoError: '' });
  },
  onShow() { if (this._query) wx.setNavigationBarTitle({ title: title(this._query.view) }); return flow.show(this); },
  onHide() { flow.hide(this); this.setData({ actions: {}, docs: this.data.docs.map(doc => ({ ...doc, actions: {}, decisions: [] })) }); },
  onUnload() { flow.unload(this); i18n.unbind(this); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.busy && this.data.ready) return this.load(true); },
  checkConfirmed(records, more = true) {
    for (const [id, acknowledgement] of this._acknowledged) {
      const value = records.find(record => record.id === id);
      if (value ? value.revision < acknowledgement.minimum : !more && acknowledgement.pending)
        throw new Error(i18n.t('操作已确认，读取结果尚未更新，请重新加载核对已保存回执。', 'The action was confirmed, but the read result is not updated yet. Reload to check the saved receipt.'));
    }
    for (const value of records) {
      const acknowledgement = this._acknowledged.get(value.id);
      if (acknowledgement) { acknowledgement.minimum = Math.max(acknowledgement.minimum, value.revision); acknowledgement.pending = false; }
    }
  },
  async load(more = false) {
    if (this._disposed || !this._visible) return;
    if (flow.pending(this)) { this._resumeRead = true; return; }
    if (this._loading) return this._loading;
    if (!flow.actor()) { this.resetPrivate(); return; }
    if (more && (!this.data.hasMore || !this.data.ready)) return;
    const token = flow.capture(this), page = more ? this.data.page + 1 : 1, previous = this.data.docs;
    this._fresh = false; this._resumeRead = false; this.clearMedia(); this.setData({ loading: true, ready: false, error: '' });
    const reading = (async () => {
      try {
        const result = await flow.list({ ...this._query, page });
        if (!flow.visible(this, token)) return;
        if (this._query.view === 'review' && !result.actions.review) {
          this.resetPrivate(); this.setData({ error: i18n.t('当前暂无荣誉审核入口，请返回本人记录或重新核对权限', 'No honor review access right now. Return to your records or re-check permissions.') }); return;
        }
        this.checkConfirmed(result.docs, more);
        const records = more ? new Map(this._records) : new Map();
        for (const value of result.docs) records.set(value.id, flow.metadata(value));
        const docs = (more ? previous.filter(doc => !result.docs.some(value => value.id === doc.id)) : []).concat(result.docs.map(value => flow.row(value, previous.find(doc => doc.id === value.id))));
        this._records = records; this._fresh = true;
        this.setData({ loading: false, ready: true, needsLogin: false, docs, teams: result.teams, actions: result.actions,
          page: result.page, totalPages: result.totalPages, totalDocs: result.totalDocs, hasMore: result.page < result.totalPages });
      } catch (cause) {
        if (!flow.visible(this, token)) return;
        if ([401, 403].includes(cause.status)) this.resetPrivate();
        this.setData({ loading: false, ready: false, error: cause.message || i18n.t('荣誉读取失败，请重试', 'Honors failed to load. Please try again.'), needsLogin: cause.status === 401,
          actions: {}, docs: this.data.docs.map(doc => ({ ...doc, actions: {}, decisions: [] })) });
      } finally { if (flow.visible(this, token)) this._loading = null; }
    })();
    this._loading = reading; return reading;
  },
  view(event) {
    const view = event.currentTarget.dataset.view;
    if (flow.pending(this) || this.data.loading || !this._visible || !['mine', 'review'].includes(view) || view === this.data.view || view === 'review' && (!this.data.ready || !this.data.actions.review)) return;
    this.onLoad({ ...this._query, view }); return this.onShow();
  },
  create() {
    if (!this._visible || this.data.loading || flow.pending(this) || !this.data.ready || !this.data.actions.create || !this.data.teams.length) return;
    navigation.go('team-honor-edit', { ...(this._query.team ? { team: this._query.team } : {}), ...(this._query.game ? { game: this._query.game } : {}) });
  },
  edit(event) {
    const value = this._records.get(Number(event.currentTarget.dataset.id));
    if (!this._visible || this.data.loading || flow.pending(this) || !this.data.ready || !value || !value.actions.edit) return;
    navigation.go('team-honor-edit', { id: value.id });
  },
  note(event) {
    if (!this._visible || flow.pending(this) || this.data.loading || !this.data.ready || typeof event.detail.value !== 'string') return;
    const index = this.data.docs.findIndex(doc => doc.id === Number(event.currentTarget.dataset.id));
    if (index >= 0) this.setData({ [`docs[${index}].noteDraft`]: event.detail.value });
  },
  readFailed(id, cause, field) {
    this._fresh = false;
    const denied = [401, 403, 404, 409].includes(cause.status);
    if (denied || field === 'operationError') this.clearMedia();
    if (denied) this._records.delete(id);
    this._records = new Map(Array.from(this._records, ([key, value]) => [key, { ...value, actions: {} }]));
    this.setData({ ready: false, actions: {}, docs: this.data.docs.map(doc => ({ ...doc, actions: {}, decisions: [] })),
      [field]: cause.message || i18n.t('本次证据读取失败，请重新加载核对操作', 'The evidence failed to load. Reload to check available actions.') });
  },
  async inspect(event) {
    const id = flow.id(event.currentTarget.dataset.id);
    if (!id || !this._records.has(id) || !this._visible || this.data.loading || flow.pending(this)) return;
    const token = flow.begin(this, '_file'); this.clearMedia(); const turn = this._mediaTurn;
    this.setData({ operationError: '', message: '' });
    const paths = [];
    try {
      const value = await flow.detail(id);
      if (!flow.visible(this, token)) return;
      this.checkConfirmed([value]);
      this._records.set(id, flow.metadata(value)); this._detail = value;
      this.setData({ detail: flow.row(value), docs: this.data.docs.map(doc => doc.id === id ? flow.row(value, doc) : doc) });
      for (const item of value.images) {
        const path = await flow.files.localImage(item.source); paths.push(path);
        if (!flow.visible(this, token) || turn !== this._mediaTurn) return;
      }
      this._paths = paths.filter(Boolean);
      this.setData({ detailImages: value.images.map((item, index) => ({ index, caption: item.caption, path: paths[index] })),
        imageError: paths.some(path => !path) ? i18n.t('部分图片暂时无法显示，文字与审核说明仍可查看；可再次查看证据重试。', 'Some images cannot be shown; text and review notes remain available. View the evidence again to retry.') : '' });
    } catch (cause) { if (flow.visible(this, token)) this.readFailed(id, cause, 'operationError'); }
    finally {
      if (!flow.visible(this, token) || turn !== this._mediaTurn) flow.removePictures(paths);
      await flow.finish(this, token);
    }
  },
  closeDetail() { if (!flow.pending(this)) this.clearMedia(); },
  previewEvidence(event) {
    const path = event.currentTarget.dataset.path;
    if (this._visible && !flow.pending(this) && this._detail && this._paths.includes(path)) wx.previewImage({ current: path, urls: this._paths });
  },
  websiteEvidence() {
    if (this._visible && !flow.pending(this) && this._detail) navigation.copy(config.origin + '/teams/honors/' + this._detail.id, i18n.t('工作台地址已复制，可在浏览器登录后查看', 'Workbench link copied; sign in from a browser to view it'));
  },
  async viewVideo() {
    if (!this._visible || this.data.loading || flow.pending(this) || !this._detail || !this._detail.videoHref) return;
    const value = this._detail, token = flow.begin(this, '_file'); this.setData({ videoError: '' }); let source = '';
    try {
      source = await media.privateVideo(value, { isCurrent: () => flow.visible(this, token) && this._detail && this._detail.id === value.id && this._detail.revision === value.revision,
        onTask: task => { this._videoReadTask = task; } });
      if (!flow.visible(this, token)) return;
      media.removeMedia(this._videoSource ? [this._videoSource] : []); this._videoSource = source; this._videoRecord = value;
      this.setData({ videoSource: source });
    } catch (cause) { if (flow.visible(this, token)) this.readFailed(value.id, cause, 'videoError'); }
    finally { if (!flow.visible(this, token)) media.removeMedia(source ? [source] : []); this._videoReadTask = null; await flow.finish(this, token); }
  },
  videoError(event) {
    if (!this._visible || !this._videoRecord || Number(event.currentTarget.dataset.id) !== this._videoRecord.id || Number(event.currentTarget.dataset.revision) !== this._videoRecord.revision) return;
    media.removeMedia(this._videoSource ? [this._videoSource] : []); this._videoSource = ''; this.setData({ videoSource: '', videoError: i18n.t('视频播放失败，可重新读取本次证据；没有其他播放地址。', 'Video playback failed. Load the evidence again; there is no other playback address.') });
  },
  async perform(event) {
    const { id, action } = event.currentTarget.dataset, value = this._records.get(Number(id)), row = this.data.docs.find(doc => doc.id === Number(id));
    if (!this._visible || this._disposed || this.data.loading || flow.pending(this) || !this.data.ready || !this._fresh || !value || !row || !flow.allowed(value, action)) return;
    const token = flow.begin(this, '_write'); let dispatched = false; this.setData({ operationError: '', message: '' });
    try {
      const note = row.noteDraft || '';
      if (['return', 'reject', 'hide'].includes(action) && !note.trim()) throw new Error(i18n.t('请填写具体的处理说明', 'Enter a specific note'));
      const labels = { approve: i18n.t('批准荣誉', 'Approve honor'), return: i18n.t('退回修改', 'Return for changes'), reject: i18n.t('拒绝荣誉', 'Reject honor'), withdraw: i18n.t('撤回投稿', 'Withdraw submission'), hide: i18n.t('隐藏荣誉', 'Hide honor') };
      if (!await flow.confirm(labels[action], action === 'approve' ? i18n.t('确认已核对本次提交的文字和证据，批准后会展示在队伍荣誉档案。', 'Confirm you checked the text and evidence. Once approved it appears in the team honors archive.') : i18n.t('确认保存此操作？处理说明会显示在本人的回执中。', 'Save this action? The note will appear on the submitter\'s receipt.'))) return;
      if (!flow.visible(this, token)) return;
      dispatched = true;
      const saved = await flow.change(value, action, { note });
      if (!flow.same(this, token)) return;
      this._acknowledged.set(saved.id, { minimum: saved.revision, pending: true });
      this._records.set(saved.id, flow.metadata(saved)); this._fresh = false;
      this.setData({ ready: false, actions: {}, docs: this.data.docs.map(doc => doc.id === saved.id ? flow.row(saved) : { ...doc, actions: {}, decisions: [] }),
        message: i18n.t('荣誉操作已保存，请核对最新回执', 'Honor action saved. Check the latest receipt.'), ...(this._detail && this._detail.id === saved.id ? { detail: flow.row(saved) } : {}) });
      this.clearMedia(); await this.load();
    } catch (cause) {
      if (!flow.same(this, token)) return;
      if (dispatched) { this._fresh = false; this.setData({ ready: false, actions: {}, docs: this.data.docs.map(doc => ({ ...doc, actions: {}, decisions: [] })) }); }
      this.setData({ operationError: cause.message || i18n.t('保存失败，处理意见已保留，请先重新加载核对', 'Save failed; your note is kept. Reload to check first.') });
    } finally { await flow.finish(this, token); }
  },
}));
