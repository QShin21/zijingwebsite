const flow = require('../../lib/team-honor-workflow');
const navigation = require('../../lib/navigation');
const config = require('../../config');
const media = require('../../lib/honor-media');
Page({
  data: { needsLogin: false, loading: false, ready: false, busy: false, error: '', operationError: '', message: '', view: 'mine',
    actions: {}, teams: [], docs: [], page: 1, totalPages: 0, totalDocs: 0, hasMore: false, detail: null, detailImages: [], imageError: '', videoSource: '', videoError: '' },
  back: navigation.back,
  login: navigation.login,
  onLoad(options = {}) {
    this._query = { view: options.view === 'review' ? 'review' : 'mine', team: options.team || '', game: options.game || '' };
    flow.connect(this, JSON.stringify(this._query)); this.setData({ view: this._query.view });
    wx.setNavigationBarTitle({ title: this._query.view === 'review' ? '荣誉审核工作台' : '我的荣誉投稿' });
  },
  resetPrivate() {
    this.clearMedia(); this._records = new Map(); this._loading = null; this._fresh = false;
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
  onShow() { return flow.show(this); },
  onHide() { flow.hide(this); this.setData({ actions: {}, docs: this.data.docs.map(doc => ({ ...doc, actions: {}, decisions: [] })) }); },
  onUnload() { flow.unload(this); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.busy && this.data.ready) return this.load(true); },
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
          this.resetPrivate(); this.setData({ error: '当前暂无荣誉审核入口，请返回本人记录或重新核对权限' }); return;
        }
        const records = more ? new Map(this._records) : new Map();
        for (const value of result.docs) records.set(value.id, flow.metadata(value));
        const docs = (more ? previous.filter(doc => !result.docs.some(value => value.id === doc.id)) : []).concat(result.docs.map(value => flow.row(value, previous.find(doc => doc.id === value.id))));
        this._records = records; this._fresh = true;
        this.setData({ loading: false, ready: true, needsLogin: false, docs, teams: result.teams, actions: result.actions,
          page: result.page, totalPages: result.totalPages, totalDocs: result.totalDocs, hasMore: result.page < result.totalPages });
      } catch (cause) {
        if (!flow.visible(this, token)) return;
        if ([401, 403].includes(cause.status)) this.resetPrivate();
        this.setData({ loading: false, ready: false, error: cause.message || '荣誉读取失败，请重试', needsLogin: cause.status === 401,
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
  async inspect(event) {
    const id = flow.id(event.currentTarget.dataset.id);
    if (!id || !this._records.has(id) || !this._visible || this.data.loading || flow.pending(this)) return;
    const token = flow.begin(this, '_file'); this.clearMedia(); const turn = this._mediaTurn;
    this.setData({ operationError: '', message: '' });
    const paths = [];
    try {
      const value = await flow.detail(id);
      if (!flow.visible(this, token)) return;
      this._records.set(id, flow.metadata(value)); this._detail = value;
      this.setData({ detail: flow.row(value), docs: this.data.docs.map(doc => doc.id === id ? flow.row(value, doc) : doc) });
      for (const item of value.images) {
        const path = await flow.files.localImage(item.source); paths.push(path);
        if (!flow.visible(this, token) || turn !== this._mediaTurn) return;
      }
      this._paths = paths.filter(Boolean);
      this.setData({ detailImages: value.images.map((item, index) => ({ index, caption: item.caption, path: paths[index] })),
        imageError: paths.some(path => !path) ? '部分图片暂时无法显示，文字与审核说明仍可查看；可再次查看证据重试。' : '' });
    } catch (cause) { if (flow.visible(this, token)) this.setData({ operationError: cause.message || '证据读取失败，请重试' }); }
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
    if (this._visible && !flow.pending(this) && this._detail) navigation.copy(config.origin + '/teams/honors/' + this._detail.id, '工作台地址已复制，可在浏览器登录后查看');
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
    } catch (cause) { if (flow.visible(this, token)) this.setData({ videoError: cause.message || '视频证据读取失败，可重试' }); }
    finally { if (!flow.visible(this, token)) media.removeMedia(source ? [source] : []); this._videoReadTask = null; await flow.finish(this, token); }
  },
  videoError(event) {
    if (!this._visible || !this._videoRecord || Number(event.currentTarget.dataset.id) !== this._videoRecord.id || Number(event.currentTarget.dataset.revision) !== this._videoRecord.revision) return;
    media.removeMedia(this._videoSource ? [this._videoSource] : []); this._videoSource = ''; this.setData({ videoSource: '', videoError: '视频播放失败，可重新读取本次证据；没有其他播放地址。' });
  },
  async perform(event) {
    const { id, action } = event.currentTarget.dataset, value = this._records.get(Number(id)), row = this.data.docs.find(doc => doc.id === Number(id));
    if (!this._visible || this._disposed || this.data.loading || flow.pending(this) || !this.data.ready || !this._fresh || !value || !row || !flow.allowed(value, action)) return;
    const token = flow.begin(this, '_write'); let dispatched = false; this.setData({ operationError: '', message: '' });
    try {
      const note = row.noteDraft || '';
      if (['return', 'reject', 'hide'].includes(action) && !note.trim()) throw new Error('请填写具体的处理说明');
      const labels = { approve: '批准荣誉', return: '退回修改', reject: '拒绝荣誉', withdraw: '撤回投稿', hide: '隐藏荣誉' };
      if (!await flow.confirm(labels[action], action === 'approve' ? '确认已核对本次提交的文字和证据，批准后会展示在队伍荣誉档案。' : '确认保存此操作？处理说明会显示在本人的回执中。')) return;
      if (!flow.visible(this, token)) return;
      dispatched = true;
      const saved = await flow.change(value, action, { note });
      if (!flow.same(this, token)) return;
      this._records.set(saved.id, flow.metadata(saved)); this._fresh = false;
      this.setData({ ready: false, actions: {}, docs: this.data.docs.map(doc => doc.id === saved.id ? flow.row(saved) : { ...doc, actions: {}, decisions: [] }),
        message: '荣誉操作已保存，请核对最新回执', ...(this._detail && this._detail.id === saved.id ? { detail: flow.row(saved) } : {}) });
      this.clearMedia(); await this.load();
    } catch (cause) {
      if (!flow.same(this, token)) return;
      if (dispatched) { this._fresh = false; this.setData({ ready: false, actions: {}, docs: this.data.docs.map(doc => ({ ...doc, actions: {}, decisions: [] })) }); }
      this.setData({ operationError: cause.message || '保存失败，处理意见已保留，请先重新加载核对' });
    } finally { await flow.finish(this, token); }
  },
});
