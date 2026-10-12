const flow = require('../../lib/team-honor-workflow');
const privacy = require('../../lib/privacy');
const navigation = require('../../lib/navigation');
const media = require('../../lib/honor-media');
Page({
  data: { needsLogin: false, loading: false, ready: false, busy: false, error: '', operationError: '', message: '', record: null,
    teams: [], teamIndex: 0, teamTitle: '', fields: flow.fields(flow.empty()), images: [], imageError: '', editable: false, canSave: false, canSubmit: false,
    conflict: false, uncertainCreate: false, recentDocs: [], hasSelectedVideo: false, selectedVideoSize: '', canUploadVideo: false, videoSource: '', videoError: '' },
  back: navigation.back,
  login: navigation.login,
  onLoad(options = {}) {
    this._options = { id: options.id || '', team: options.team || '', game: options.game || '' };
    flow.connect(this, JSON.stringify(this._options)); this._id = options.id ? flow.id(options.id) : null;
    this._invalidID = Boolean(options.id && !this._id);
    wx.setNavigationBarTitle({ title: this._id ? '修改荣誉投稿' : '新建荣誉投稿' });
  },
  resetPrivate() {
    this.clearMedia(); this._record = null; this._draft = flow.empty(); this._teams = []; this._team = null; this._baseRevision = null;
    this._dirty = false; this._fresh = false; this._create = false; this._conflict = false; this._uncertainCreate = false; this._loading = null;
    this.setData({ needsLogin: !flow.actor(), loading: false, ready: false, busy: flow.pending(this), error: '', operationError: '', message: '', record: null,
      teams: [], teamIndex: 0, teamTitle: '', fields: flow.fields(this._draft), images: [], imageError: '', editable: false, canSave: false, canSubmit: false,
      conflict: false, uncertainCreate: false, recentDocs: [], hasSelectedVideo: false, selectedVideoSize: '', canUploadVideo: false, videoSource: '', videoError: '' });
  },
  clearPictures() { this._mediaTurn = (this._mediaTurn || 0) + 1; flow.removePictures(this._paths || []); this._paths = []; this.setData({ images: [], imageError: '' }); },
  clearMedia() {
    this.clearPictures();
    if (this._videoReadTask && typeof this._videoReadTask.abort === 'function') this._videoReadTask.abort(); this._videoReadTask = null;
    try { if (typeof wx.createVideoContext === 'function') wx.createVideoContext('honor-own-video', this).stop(); } catch { /* Return navigation stays available. */ }
    media.removeMedia([this._videoSource, this._video && this._video.filePath].filter(Boolean)); this._videoSource = ''; this._video = null; this._videoRecord = null;
    this.setData({ hasSelectedVideo: false, selectedVideoSize: '', canUploadVideo: false, videoSource: '', videoError: '' });
  },
  onShow() { return flow.show(this); },
  onHide() { flow.hide(this); this.setData({ canSave: false, canSubmit: false, canUploadVideo: false, editable: false }); },
  onUnload() { flow.unload(this); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  project() {
    const allowed = this._fresh && !this._conflict && !this._uncertainCreate, value = this._record;
    const create = this._create && this._teams.some(team => team.id === this._team);
    this.setData({ record: value ? flow.row(value) : null, fields: flow.fields(this._draft), ready: this._fresh,
      editable: Boolean(allowed && (value ? value.actions.edit : create)), canSave: Boolean(allowed && (value ? value.actions.save : create)),
      canSubmit: Boolean(allowed && (value ? value.actions.submit : create)), canUploadVideo: Boolean(allowed && value && value.actions.save && this._video && !this._draft.removeVideo),
      conflict: this._conflict, uncertainCreate: this._uncertainCreate });
  },
  async load(reset = false) {
    if (this._disposed || !this._visible) return;
    if (flow.pending(this)) { this._resumeRead = true; return; }
    if (this._loading) return this._loading;
    if (!flow.actor()) { this.resetPrivate(); return; }
    if (this._invalidID) { this.setData({ error: '荣誉入口无效，请返回后重新进入' }); return; }
    const token = flow.capture(this); this._fresh = false; this._resumeRead = false; this.clearMedia();
    this.setData({ loading: true, ready: false, canSave: false, canSubmit: false, editable: false, error: '' });
    const reading = (async () => {
      try {
        if (this._id) {
          const value = await flow.detail(this._id);
          if (!flow.visible(this, token)) return;
          this._record = value; this._team = value.team;
          if (reset || !this._dirty) { this._draft = flow.draft(value); this._baseRevision = value.revision; this._dirty = false; this._conflict = false; }
          else if (this._baseRevision !== value.revision) {
            this._conflict = true; this.setData({ operationError: '保存记录已更新，当前未保存输入仍保留。请明确重新加载已保存资料后再修改。' });
          }
          this.setData({ teamTitle: '原投稿队伍 ' + value.team, recentDocs: [] });
        } else {
          const result = await flow.list({ view: 'mine', page: 1, team: this._options.team, game: this._options.game });
          if (!flow.visible(this, token)) return;
          this._teams = result.teams; this._create = result.actions.create;
          const selected = this._team || flow.id(this._options.team) || result.teams[0] && result.teams[0].id;
          const index = result.teams.findIndex(team => team.id === selected);
          this._team = index >= 0 ? selected : null;
          this.setData({ teams: result.teams, teamIndex: Math.max(0, index), teamTitle: index >= 0 ? result.teams[index].gameTitle + ' · ' + result.teams[index].title : '',
            recentDocs: this._uncertainCreate ? result.docs.map(value => flow.row(value)) : [] });
        }
        await this.renderImages(token);
        if (!flow.visible(this, token)) return;
        this._fresh = true; this.project(); this.setData({ loading: false, needsLogin: false });
      } catch (cause) {
        if (!flow.visible(this, token)) return;
        if ([401, 403].includes(cause.status)) this.resetPrivate();
        this.setData({ loading: false, ready: false, canSave: false, canSubmit: false, editable: false, error: cause.message || '投稿资料读取失败，请重试', needsLogin: cause.status === 401 });
      } finally { if (flow.visible(this, token)) this._loading = null; }
    })();
    this._loading = reading; return reading;
  },
  async renderImages(token) {
    this.clearPictures(); const turn = this._mediaTurn, paths = [], values = this._draft.images.map(item => ({ ...item }));
    this.setData({ images: values.map((item, index) => ({ index, caption: item.caption, path: '' })) });
    for (const item of values) {
      const path = await flow.files.localImage(item.source); paths.push(path);
      if (!flow.visible(this, token) || turn !== this._mediaTurn) { flow.removePictures(paths); return; }
    }
    this._paths = paths.filter(Boolean);
    this.setData({ images: values.map((item, index) => ({ index, caption: item.caption, path: paths[index] })), imageError: paths.some(path => !path) ? '部分图片显示失败，可重新加载查看；原证据仍保留。' : '' });
  },
  team(event) {
    if (this._id || flow.pending(this) || this.data.loading || !this.data.ready || !this._visible || this._uncertainCreate) return;
    const index = Number(event.detail.value), team = this._teams[index];
    if (!team) return; this._team = team.id;
    this.setData({ teamIndex: index, teamTitle: team.gameTitle + ' · ' + team.title }); this.project();
  },
  input(event) {
    if (flow.pending(this) || this.data.loading || !this._visible || !this.data.editable || typeof event.detail.value !== 'string') return;
    const field = event.currentTarget.dataset.field;
    if (!['title', 'competition', 'placing', 'description'].includes(field)) return;
    this._draft[field] = event.detail.value; this._dirty = true; this.setData({ fields: flow.fields(this._draft), operationError: '', message: '' });
  },
  date(event) { if (!flow.pending(this) && !this.data.loading && this._visible && this.data.editable && typeof event.detail.value === 'string') { this._draft.date = event.detail.value; this._dirty = true; this.setData({ fields: flow.fields(this._draft) }); } },
  clearDate() { if (!flow.pending(this) && !this.data.loading && this._visible && this.data.editable) { this._draft.date = ''; this._dirty = true; this.setData({ fields: flow.fields(this._draft) }); } },
  caption(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (flow.pending(this) || this.data.loading || !this._visible || !this.data.editable || !Number.isSafeInteger(index) || !this._draft.images[index] || typeof event.detail.value !== 'string') return;
    this._draft.images[index].caption = event.detail.value; this._dirty = true; this.setData({ [`images[${index}].caption`]: event.detail.value });
  },
  removeVideo(event) { if (!flow.pending(this) && !this.data.loading && this._visible && this.data.editable && typeof event.detail.value === 'boolean') { this._draft.removeVideo = event.detail.value; this._dirty = true; this.project(); } },
  async chooseImages() {
    if (flow.pending(this) || this.data.loading || !this._visible || !this.data.editable || this._draft.images.length >= 6) return;
    const token = flow.begin(this, '_file'); this.setData({ operationError: '', message: '' });
    try {
      await privacy.authorize(); if (!flow.visible(this, token)) return;
      const paths = await flow.files.choose(6 - this._draft.images.length); if (!flow.visible(this, token)) return;
      if (!paths.length) throw new Error('未选择图片，可重新选择');
      const added = [];
      for (const path of paths) { const source = await flow.files.readImage(path, 2 * 1024 * 1024); if (!flow.visible(this, token)) return; added.push({ source: flow.image(source), caption: '' }); }
      if (this._draft.images.length + added.length > 6) throw new Error('证据图片最多 6 份');
      this._draft.images = this._draft.images.concat(added); this._dirty = true;
      await this.renderImages(token);
    } catch (cause) { if (flow.visible(this, token)) this.setData({ operationError: cause.message || '图片读取失败，原证据已保留，可重试' }); }
    finally { await flow.finish(this, token); }
  },
  async removeImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (flow.pending(this) || this.data.loading || !this._visible || !this.data.editable || !Number.isSafeInteger(index) || !this._draft.images[index]) return;
    const token = flow.begin(this, '_file'); this._draft.images = this._draft.images.filter((_, item) => item !== index); this._dirty = true;
    try { await this.renderImages(token); } finally { await flow.finish(this, token); }
  },
  previewEvidence(event) { const path = event.currentTarget.dataset.path; if (this._visible && !flow.pending(this) && this._paths.includes(path)) wx.previewImage({ current: path, urls: this._paths }); },
  async openPrivacy() {
    if (!this._visible || flow.pending(this)) return;
    const token = flow.begin(this, '_modal');
    try { await privacy.openContract(); } catch (cause) { if (flow.visible(this, token)) this.setData({ operationError: cause.message }); }
    finally { await flow.finish(this, token); }
  },
  async chooseVideo() {
    if (!this._visible || flow.pending(this) || this.data.loading || !this.data.editable || !this._record || !this._record.actions.save) return;
    const token = flow.begin(this, '_file'); this.setData({ operationError: '', message: '' });
    try {
      const selected = await media.chooseVideo({ isCurrent: () => flow.visible(this, token) });
      if (!flow.visible(this, token)) { media.removeMedia([selected.filePath]); return; }
      media.removeMedia(this._video ? [this._video.filePath] : []); this._video = selected;
      this.setData({ hasSelectedVideo: true, selectedVideoSize: (selected.size / 1024 / 1024).toFixed(2) + ' MB' }); this.project();
    } catch (cause) { if (flow.visible(this, token)) this.setData({ operationError: cause.message || '视频选择失败，可重试' }); }
    finally { await flow.finish(this, token); }
  },
  async uploadVideo() {
    if (!this._visible || this._disposed || flow.pending(this) || this.data.loading || !this.data.canUploadVideo || !this._record || !this._video) return;
    let input;
    try { input = flow.input(this._draft, this._record, this._team); }
    catch (cause) { this.setData({ operationError: cause.message }); return; }
    const token = flow.begin(this, '_write'), current = this._record, video = this._video; let dispatched = false;
    this.setData({ operationError: '', message: '' });
    try {
      if (!await flow.confirm('上传视频并保存草稿', '本次上传会保存当前文字与保留的证据图片，并撤下原展示。上传后仍须明确提交审核。新增图片请先保存草稿。')) return;
      if (!flow.visible(this, token)) return;
      const response = await media.uploadVideo(current, input, video, { isCurrent: () => flow.visible(this, token), sameContext: () => flow.same(this, token),
        onTask: task => { dispatched = true; this._uploadTask = task; } });
      if (!flow.same(this, token)) return;
      const saved = flow.record(response.record, false);
      this._record = saved; this._draft = flow.draft(saved); this._baseRevision = saved.revision; this._dirty = false; this._fresh = false; this._conflict = false;
      this.clearMedia(); this.project(); this.setData({ message: '视频已上传并保存草稿；请核对后明确提交审核。' }); await this.load();
    } catch (cause) {
      if (!flow.same(this, token)) return;
      if (dispatched) { this._fresh = false; this.project(); }
      this.setData({ operationError: cause.message || '视频保存结果尚未确认，原输入已保留，请先重新读取回执' });
    } finally { media.removeMedia([video.filePath]); if (this._video === video) this._video = null; this._uploadTask = null; if (flow.same(this, token)) this.setData({ hasSelectedVideo: false, selectedVideoSize: '', canUploadVideo: false }); await flow.finish(this, token); }
  },
  async viewVideo() {
    if (!this._visible || this.data.loading || flow.pending(this) || !this._record || !this._record.videoHref) return;
    const value = this._record, token = flow.begin(this, '_file'); this.setData({ videoError: '' }); let source = '';
    try {
      source = await media.privateVideo(value, { isCurrent: () => flow.visible(this, token) && this._record && this._record.id === value.id && this._record.revision === value.revision,
        onTask: task => { this._videoReadTask = task; } });
      if (!flow.visible(this, token)) return;
      media.removeMedia(this._videoSource ? [this._videoSource] : []); this._videoSource = source; this._videoRecord = value; this.setData({ videoSource: source });
    } catch (cause) {
      if (flow.visible(this, token)) {
        this._fresh = false;
        if ([401, 403, 404, 409].includes(cause.status)) this.clearMedia();
        if (this._record) this._record = { ...this._record, actions: {} };
        this.project(); this.setData({ videoError: cause.message || '视频证据读取失败，请重新加载核对操作' });
      }
    }
    finally { if (!flow.visible(this, token)) media.removeMedia(source ? [source] : []); this._videoReadTask = null; await flow.finish(this, token); }
  },
  videoError(event) {
    if (!this._visible || !this._videoRecord || Number(event.currentTarget.dataset.id) !== this._videoRecord.id || Number(event.currentTarget.dataset.revision) !== this._videoRecord.revision) return;
    media.removeMedia(this._videoSource ? [this._videoSource] : []); this._videoSource = ''; this.setData({ videoSource: '', videoError: '视频播放失败，可重新读取本次证据；没有其他播放地址。' });
  },
  save() { return this.write('save'); },
  submit() { return this.write('submit'); },
  async write(action) {
    if (!this._visible || this._disposed || this.data.loading || flow.pending(this) || !this.data.ready || !this._fresh || this._conflict || this._uncertainCreate || !(action === 'save' ? this.data.canSave : this.data.canSubmit)) return;
    let prepared;
    try { prepared = flow.input(this._draft, this._record, this._team, action === 'submit'); }
    catch (cause) { this.setData({ operationError: cause.message }); return; }
    const token = flow.begin(this, '_write'), current = this._record; let dispatched = false;
    this.setData({ operationError: '', message: '' });
    try {
      if (!await flow.confirm(action === 'save' ? '保存荣誉草稿' : '提交荣誉审核', '保存修改会撤下当前展示。提交后由他人审核，批准后文字与证据会展示在队伍荣誉档案。')) return;
      if (!flow.visible(this, token)) return;
      dispatched = true;
      const saved = await flow.change(current, action, { draft: prepared, team: this._team });
      if (!flow.same(this, token)) return;
      this._id = saved.id; this._record = saved; this._draft = flow.draft(saved); this._baseRevision = saved.revision;
      this._dirty = false; this._fresh = false; this._conflict = false; this._uncertainCreate = false; this.clearMedia(); this.project();
      this.setData({ message: action === 'save' ? '草稿已保存；仍须提交并由他人审核后展示。' : '荣誉已提交，请查看本人回执与处理反馈。',
        images: this._draft.images.map((item, index) => ({ index, caption: item.caption, path: '' })) });
      await this.load();
    } catch (cause) {
      if (!flow.same(this, token)) return;
      if (dispatched) {
        this._fresh = false;
        if (!current && (!cause.status || cause.status >= 500)) this._uncertainCreate = true;
        this.project();
      }
      this.setData({ operationError: this._uncertainCreate ? '新建结果尚未确认，原输入已保留。请先到我的记录核对，避免重复新建。' : cause.message || '保存失败，原输入已保留，请重新读取回执后核对' });
    } finally { await flow.finish(this, token); }
  },
  async reload() {
    if (!this._visible || flow.pending(this) || this.data.loading || this._uncertainCreate) return;
    if (!this._dirty && !this._conflict) return this.load(true);
    const token = flow.begin(this, '_modal'); let reset = false;
    try { reset = await flow.confirm('重新加载已保存资料', '当前未保存的文字和图片会被已保存资料替换，请确认后重新核对。'); }
    catch (cause) { if (flow.visible(this, token)) this.setData({ operationError: cause.message }); }
    finally { await flow.finish(this, token); }
    if (reset && flow.visible(this, token)) return this.load(true);
  },
  mine() { if (this._visible && !flow.pending(this)) navigation.go('team-honor-workspace', { view: 'mine' }); },
  openRecent(event) { const id = flow.id(event.currentTarget.dataset.id); if (this._visible && !flow.pending(this) && this.data.recentDocs.some(doc => doc.id === id)) navigation.go('team-honor-edit', { id }); },
});
