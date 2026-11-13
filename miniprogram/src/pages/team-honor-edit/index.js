function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const flow = require('../../lib/team-honor-workflow');
const privacy = require('../../lib/privacy');
const navigation = require('../../lib/navigation');
const media = require('../../lib/honor-media');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回', '‹ Back'],
  kicker: ['队伍成果 · 投稿', 'Team achievements · Submit'],
  titleRecord: ['荣誉投稿与回执', 'Honor submission and receipt'],
  titleNew: ['记录一份队伍荣誉', 'Record a team honor'],
  lead: ['填写成果与可公开材料，送交本社群管理员审核后进入荣誉档案。', 'Enter the result and shareable evidence; it enters the archive after community admins review it.'],
  checking: ['正在核对投稿资料与操作权限…', 'Checking the submission and permissions…'],
  busyNote: ['本次确认、选图或保存尚未结束，请稍候。', 'A confirmation, image selection or save is still in progress. Please wait.'],
  rereadReceipt: ['重新读取回执', 'Reload receipt'],
  currentStatus: ['当前投稿状态', 'Submission status'],
  revisionPrefix: [' · 修订 ', ' · Revision '],
  seasonPrefix: [' · 原赛季 ', ' · Original season '],
  reviewFeedback: ['审核反馈', 'Review feedback'],
  stateApproved: ['本修订已批准。保存修改会撤下当前展示，重新提交审核后方可恢复。', 'This revision is approved. Saving changes removes it from display until it is approved again.'],
  statePending: ['已进入审核队列，请在回执中查看后续反馈。', 'In the review queue; check the receipt for feedback.'],
  stateDraft: ['草稿与补充材料保留在同一投稿，提交后由他人审核。', 'Drafts and extra material stay in this submission; someone else reviews it after you submit.'],
  viewArchive: ['查看队伍公开荣誉档案', 'View the team\'s public honors'],
  checkCreate: ['先核对这次新建结果', 'Check this creation result first'],
  checkCreateBody: ['原输入已保留，请先查看本人记录。同名记录需逐份核对，本页不会自动认领或重复新建。', 'Your input is kept. Check your records first; records with the same title need checking one by one. This page will not claim or re-create automatically.'],
  viewMine: ['查看我的投稿记录', 'View my submissions'],
  submissionPrefix: ['投稿 ', 'Submission '],
  teamMiddle: [' · 队伍 ', ' · Team '],
  checkReceipt: ['核对这份本人回执', 'Check this receipt'],
  needMemberTitle: ['投稿需要当前有效队员身份', 'Submitting requires current team membership'],
  needMemberBody: ['当前范围内暂无你可以投稿的代表队。', 'There is no team you can submit for right now.'],
  viewRecruitment: ['查看代表队招新与本人记录', 'View team recruitment and my records'],
  stepInfo: ['① 成果信息', '① Achievement details'],
  stepInfoHint: ['先写清哪场赛事、获得什么成绩。标题为草稿必填；其余信息在提交审核前补齐。', 'State the competition and the result. A title is required for drafts; complete the rest before submitting.'],
  teamLabel: ['所属有效代表队 · 必选', 'Team · required'],
  noTeam: ['暂无可投稿的有效队伍', 'No eligible team'],
  readOnly: ['当前资料只读，可重新读取回执核对允许的操作。', 'Read-only; reload the receipt to check available actions.'],
  titleLabel: ['荣誉标题 · 必填', 'Honor title · required'],
  titleHint: ['最多 120 字，作为荣誉档案中的标题。', 'Up to 120 characters; used as the archive title.'],
  competitionLabel: ['赛事名称 · 提交时必填', 'Competition · required to submit'],
  placingLabel: ['奖项或名次 · 提交时必填', 'Award or placing · required to submit'],
  dateLabel: ['赛事日期 · 提交时必填', 'Competition date · required to submit'],
  pickDate: ['请选择赛事日期', 'Choose the competition date'],
  clearDate: ['清空日期', 'Clear date'],
  descriptionLabel: ['获奖说明 · 提交时必填', 'Description · required to submit'],
  descriptionHint: ['描述队伍参与与获奖情况，最多 5000 字。', 'Describe the team\'s participation and result, up to 5000 characters.'],
  stepMaterials: ['② 成果材料与公开范围', '② Evidence and visibility'],
  publicOnly: ['请仅上传获准公开的材料', 'Only upload material cleared for publication'],
  publicOnlyBody: ['审核前仅本人及当前有权审核者可读；批准后，文字和以下证据随荣誉档案公开。这里没有单独保留私密凭证的上传区。', 'Before review only you and authorised reviewers can read it; after approval the text and evidence below are published with the archive. There is no separate private upload area.'],
  images: ['图片材料', 'Images'],
  imagesHint: ['每份 2 MB 以内，支持 PNG、JPEG 或 WebP。提交时逐份说明材料内容。', 'Up to 2 MB each, PNG, JPEG or WebP. Describe each item before submitting.'],
  materialPrefix: ['材料 ', 'Item '],
  removeImage: ['移除此图', 'Remove image'],
  evidenceImage: ['荣誉证据图片', 'Honor evidence image'],
  captionLabel: ['材料说明 · 提交时必填', 'Caption · required to submit'],
  addImages: ['＋ 添加证据图片', '＋ Add evidence images'],
  addImagesHint: ['主动选择后读取图片。取消或读取失败会保留原材料，移除后须保存才更改投稿。', 'Images are read only after you choose them. Cancelling or a read failure keeps the original; removals take effect after saving.'],
  privacyGuide: ['查看微信隐私指引', 'View the WeChat privacy guide'],
  stepVideo: ['③ 视频材料（可选）', '③ Video (optional)'],
  videoHint: ['MP4，10 MB 以内。先保存图片草稿，再上传视频；上传会同时保存当前文字与保留的图片为草稿。', 'MP4 up to 10 MB. Save the draft with images first, then upload the video; uploading also saves the current text and kept images as a draft.'],
  savedVideo: ['已保存视频', 'Saved video'],
  readSavedVideo: ['读取已保存视频证据', 'Load saved video evidence'],
  savedVideoLabel: ['已保存荣誉视频证据', 'Saved honor video evidence'],
  removeVideoLabel: ['保存时移除原视频', 'Remove the saved video on save'],
  removeVideoHint: ['不勾选时保留已保存视频。', 'Leave off to keep the saved video.'],
  videoAfterDraft: ['保存草稿取得回执后，可选择视频。', 'Save a draft to get a receipt, then choose a video.'],
  rechooseVideo: ['重新选择 MP4 视频', 'Choose another MP4 video'],
  chooseVideo: ['选择 MP4 视频', 'Choose an MP4 video'],
  pendingVideo: ['待上传视频', 'Video to upload'],
  pendingVideoSuffix: ['，尚未保存到投稿。', ', not yet saved to the submission.'],
  uploadVideo: ['上传视频并保存草稿', 'Upload video and save draft'],
  discardVideo: ['移除待上传视频', 'Remove pending video'],
  uploading: ['视频上传中', 'Uploading video'],
  confirming: ['文件已传送，正在确认保存', 'File sent; confirming the save'],
  uploadWait: ['请等待服务器回执，确认前不会重复上传。', 'Wait for the server receipt; nothing is re-uploaded before confirmation.'],
  submitNote: ['提交时须完整填写成果信息，并至少保留一份图片或已保存视频。批准后公开归档，并显示在对应社群荣誉索引中。保存草稿后仍需提交；审核结果与补充要求显示在本页回执。', 'To submit, complete the details and keep at least one image or saved video. Approved honors are archived publicly and shown in the community honors index. Drafts still need submitting; review results appear on this receipt.'],
  approvedWarning: ['本次保存修改将撤下当前公开展示，重新审核通过后恢复。', 'Saving these changes removes the public display until it is approved again.'],
  saveDraft: ['保存草稿', 'Save draft'],
  submit: ['提交审核', 'Submit for review'],
  rereadState: ['重新读取当前状态', 'Reload current status'],
  reloadSaved: ['重新加载已保存资料', 'Reload saved data'],
  viewMyHonors: ['查看我的荣誉投稿', 'View my honor submissions'],
};
const title = id => id ? i18n.t('修改荣誉投稿', 'Edit honor submission') : i18n.t('新建荣誉投稿', 'New honor submission');

Page(withVisualTheme({
  data: { needsLogin: false, loading: false, ready: false, busy: false, error: '', operationError: '', message: '', record: null,
    teams: [], teamIndex: 0, teamTitle: '', fields: flow.fields(flow.empty()), images: [], imageError: '', editable: false, canSave: false, canSubmit: false,
    conflict: false, uncertainCreate: false, recentDocs: [], hasSelectedVideo: false, selectedVideoSize: '', videoUploading: false, videoProgress: 0, canUploadVideo: false, videoSource: '', videoError: '' },
  back: navigation.back,
  login: navigation.login,
  recruitments() { navigation.go('team'); },
  onLoad(options = {}) {
    i18n.bind(this, text);
    this._options = { id: options.id || '', team: options.team || '', game: options.game || '' };
    flow.connect(this, JSON.stringify(this._options)); this._id = options.id ? flow.id(options.id) : null;
    this._invalidID = Boolean(options.id && !this._id);
    wx.setNavigationBarTitle({ title: title(this._id) });
  },
  resetPrivate() {
    this.clearMedia(); this._record = null; this._draft = flow.empty(); this._teams = []; this._team = null; this._baseRevision = null;
    this._dirty = false; this._fresh = false; this._create = false; this._conflict = false; this._uncertainCreate = false; this._loading = null; this._acknowledged = null;
    this.setData({ needsLogin: !flow.actor(), loading: false, ready: false, busy: flow.pending(this), error: '', operationError: '', message: '', record: null,
      teams: [], teamIndex: 0, teamTitle: '', fields: flow.fields(this._draft), images: [], imageError: '', editable: false, canSave: false, canSubmit: false,
      conflict: false, uncertainCreate: false, recentDocs: [], hasSelectedVideo: false, selectedVideoSize: '', videoUploading: false, videoProgress: 0, canUploadVideo: false, videoSource: '', videoError: '' });
  },
  clearPictures() { this._mediaTurn = (this._mediaTurn || 0) + 1; flow.removePictures(this._paths || []); this._paths = []; this.setData({ images: [], imageError: '' }); },
  clearMedia() {
    this.clearPictures();
    if (this._videoReadTask && typeof this._videoReadTask.abort === 'function') this._videoReadTask.abort(); this._videoReadTask = null;
    try { if (typeof wx.createVideoContext === 'function') wx.createVideoContext('honor-own-video', this).stop(); } catch { /* Return navigation stays available. */ }
    media.removeMedia([this._videoSource, this._video && this._video.filePath].filter(Boolean)); this._videoSource = ''; this._video = null; this._videoRecord = null;
    this.setData({ hasSelectedVideo: false, selectedVideoSize: '', videoUploading: false, videoProgress: 0, canUploadVideo: false, videoSource: '', videoError: '' });
  },
  onShow() { if (this._options) wx.setNavigationBarTitle({ title: title(this._id) }); return flow.show(this); },
  onHide() { flow.hide(this); this.setData({ canSave: false, canSubmit: false, canUploadVideo: false, editable: false }); },
  onUnload() { flow.unload(this); i18n.unbind(this); },
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
    if (this._invalidID) { this.setData({ error: i18n.t('荣誉入口无效，请返回后重新进入', 'Invalid honor link. Go back and open it again.') }); return; }
    const token = flow.capture(this); this._fresh = false; this._resumeRead = false; this.clearMedia();
    this.setData({ loading: true, ready: false, canSave: false, canSubmit: false, editable: false, error: '' });
    const reading = (async () => {
      try {
        if (this._id) {
          const value = await flow.detail(this._id);
          if (!flow.visible(this, token)) return;
          if (this._acknowledged && this._acknowledged.id === value.id) {
            if (value.revision < this._acknowledged.minimum) throw new Error(i18n.t('保存已确认，读取结果尚未更新，请重新读取回执核对。', 'Save confirmed, but the read result is not updated yet. Reload the receipt to check.'));
            this._acknowledged.minimum = Math.max(this._acknowledged.minimum, value.revision);
          }
          this._record = value; this._team = value.team;
          if (reset || !this._dirty) { this._draft = flow.draft(value); this._baseRevision = value.revision; this._dirty = false; this._conflict = false; }
          else if (this._baseRevision !== value.revision) {
            this._conflict = true; this.setData({ operationError: i18n.t('保存记录已更新，当前未保存输入仍保留。请明确重新加载已保存资料后再修改。', 'The saved record changed; your unsaved input is kept. Reload the saved data before editing.') });
          }
          this.setData({ teamTitle: i18n.t('原投稿队伍 ', 'Original team ') + value.team, recentDocs: [] });
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
        this.setData({ loading: false, ready: false, canSave: false, canSubmit: false, editable: false, error: cause.message || i18n.t('投稿资料读取失败，请重试', 'The submission failed to load. Please try again.'), needsLogin: cause.status === 401 });
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
    this.setData({ images: values.map((item, index) => ({ index, caption: item.caption, path: paths[index] })), imageError: paths.some(path => !path) ? i18n.t('部分图片显示失败，可重新加载查看；原证据仍保留。', 'Some images failed to display; reload to view. The original evidence is kept.') : '' });
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
      if (!paths.length) throw new Error(i18n.t('未选择图片，可重新选择', 'No image selected; you can choose again.'));
      const added = [];
      for (const path of paths) { const source = await flow.files.readImage(path, 2 * 1024 * 1024); if (!flow.visible(this, token)) return; added.push({ source: flow.image(source), caption: '' }); }
      if (this._draft.images.length + added.length > 6) throw new Error(i18n.t('证据图片最多 6 份', 'Up to 6 evidence images'));
      this._draft.images = this._draft.images.concat(added); this._dirty = true;
      await this.renderImages(token);
    } catch (cause) { if (flow.visible(this, token)) this.setData({ operationError: cause.message || i18n.t('图片读取失败，原证据已保留，可重试', 'Image reading failed; the original evidence is kept. Try again.') }); }
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
    } catch (cause) { if (flow.visible(this, token)) this.setData({ operationError: cause.message || i18n.t('视频选择失败，可重试', 'Video selection failed. Try again.') }); }
    finally { await flow.finish(this, token); }
  },
  discardVideo() {
    if (!this._visible || this._disposed || flow.pending(this) || this.data.loading || !this._video) return;
    const selected = this._video;
    this._video = null;
    media.removeMedia([selected.filePath]);
    this.setData({ hasSelectedVideo: false, selectedVideoSize: '', videoUploading: false, videoProgress: 0 });
    this.project();
  },
  async uploadVideo() {
    if (!this._visible || this._disposed || flow.pending(this) || this.data.loading || !this.data.canUploadVideo || !this._record || !this._video) return;
    let input;
    try { input = flow.input(this._draft, this._record, this._team); }
    catch (cause) { this.setData({ operationError: cause.message }); return; }
    const token = flow.begin(this, '_write'), current = this._record, video = this._video; let dispatched = false;
    this.setData({ operationError: '', message: '' });
    try {
      if (!await flow.confirm(i18n.t('上传视频并保存草稿', 'Upload video and save draft'), i18n.t('本次上传会保存当前文字与保留的证据图片，并撤下原展示。上传后仍须明确提交审核。新增图片请先保存草稿。', 'This upload saves the current text and kept images and removes the current display. You still need to submit for review afterwards. Save a draft first for newly added images.'))) return;
      if (!flow.visible(this, token)) return;
      const response = await media.uploadVideo(current, input, video, { isCurrent: () => flow.visible(this, token), sameContext: () => flow.same(this, token),
        onTask: task => {
          dispatched = true; this._uploadTask = task;
          if (flow.visible(this, token)) this.setData({ videoUploading: true, videoProgress: 0 });
        },
        onProgress: progress => {
          if (!flow.visible(this, token)) return;
          const value = Number(progress && progress.progress);
          if (Number.isFinite(value)) this.setData({ videoProgress: Math.max(0, Math.min(100, Math.round(value))) });
        } });
      if (!flow.same(this, token)) return;
      const saved = flow.record(response.record, false);
      this._acknowledged = { id: saved.id, minimum: saved.revision };
      this._record = saved; this._draft = flow.draft(saved); this._baseRevision = saved.revision; this._dirty = false; this._fresh = false; this._conflict = false;
      this.clearMedia(); this.project(); this.setData({ message: i18n.t('视频已上传并保存草稿；请核对后明确提交审核。', 'Video uploaded and draft saved; check it, then submit for review.') }); await this.load();
    } catch (cause) {
      if (!flow.same(this, token)) return;
      if (dispatched) { this._fresh = false; this.project(); }
      this.setData({ operationError: cause.message || i18n.t('视频保存结果尚未确认，原输入已保留，请先重新读取回执', 'The video save is unconfirmed; your input is kept. Reload the receipt first.') });
    } finally { media.removeMedia([video.filePath]); if (this._video === video) this._video = null; this._uploadTask = null; if (flow.same(this, token)) this.setData({ hasSelectedVideo: false, selectedVideoSize: '', videoUploading: false, videoProgress: 0, canUploadVideo: false }); await flow.finish(this, token); }
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
        this.project(); this.setData({ videoError: cause.message || i18n.t('视频证据读取失败，请重新加载核对操作', 'Video evidence failed to load. Reload to check available actions.') });
      }
    }
    finally { if (!flow.visible(this, token)) media.removeMedia(source ? [source] : []); this._videoReadTask = null; await flow.finish(this, token); }
  },
  videoError(event) {
    if (!this._visible || !this._videoRecord || Number(event.currentTarget.dataset.id) !== this._videoRecord.id || Number(event.currentTarget.dataset.revision) !== this._videoRecord.revision) return;
    media.removeMedia(this._videoSource ? [this._videoSource] : []); this._videoSource = ''; this.setData({ videoSource: '', videoError: i18n.t('视频播放失败，可重新读取本次证据；没有其他播放地址。', 'Video playback failed. Load the evidence again; there is no other playback address.') });
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
      if (!await flow.confirm(action === 'save' ? i18n.t('保存荣誉草稿', 'Save honor draft') : i18n.t('提交荣誉审核', 'Submit honor for review'), i18n.t('保存修改会撤下当前展示。提交后由他人审核，批准后文字与证据会展示在队伍荣誉档案。', 'Saving changes removes the current display. After submission someone else reviews it; once approved the text and evidence appear in the team honors archive.'))) return;
      if (!flow.visible(this, token)) return;
      dispatched = true;
      const saved = await flow.change(current, action, { draft: prepared, team: this._team });
      if (!flow.same(this, token)) return;
      this._acknowledged = { id: saved.id, minimum: saved.revision };
      this._id = saved.id; this._record = saved; this._draft = flow.draft(saved); this._baseRevision = saved.revision;
      this._dirty = false; this._fresh = false; this._conflict = false; this._uncertainCreate = false; this.clearMedia(); this.project();
      this.setData({ message: action === 'save' ? i18n.t('草稿已保存；仍须提交并由他人审核后展示。', 'Draft saved; it still needs submitting and review before display.') : i18n.t('荣誉已提交，请查看本人回执与处理反馈。', 'Honor submitted. Check your receipt and feedback.'),
        images: this._draft.images.map((item, index) => ({ index, caption: item.caption, path: '' })) });
      await this.load();
    } catch (cause) {
      if (!flow.same(this, token)) return;
      if (dispatched) {
        this._fresh = false;
        if (!current && (!cause.status || cause.status >= 500)) this._uncertainCreate = true;
        this.project();
      }
      this.setData({ operationError: this._uncertainCreate ? i18n.t('新建结果尚未确认，原输入已保留。请先到我的记录核对，避免重复新建。', 'The creation is unconfirmed; your input is kept. Check your records first to avoid duplicates.') : cause.message || i18n.t('保存失败，原输入已保留，请重新读取回执后核对', 'Save failed; your input is kept. Reload the receipt to check.') });
    } finally { await flow.finish(this, token); }
  },
  async reload() {
    if (!this._visible || flow.pending(this) || this.data.loading || this._uncertainCreate) return;
    if (!this._dirty && !this._conflict) return this.load(true);
    const token = flow.begin(this, '_modal'); let reset = false;
    try { reset = await flow.confirm(i18n.t('重新加载已保存资料', 'Reload saved data'), i18n.t('当前未保存的文字和图片会被已保存资料替换，请确认后重新核对。', 'Unsaved text and images will be replaced by the saved data. Confirm, then check again.')); }
    catch (cause) { if (flow.visible(this, token)) this.setData({ operationError: cause.message }); }
    finally { await flow.finish(this, token); }
    if (reset && flow.visible(this, token)) return this.load(true);
  },
  archive() {
    if (this._visible && !flow.pending(this) && !this.data.loading && this._record && this._record.state === 'approved') navigation.go('team-honors', { team: this._record.team });
  },
  mine() { if (this._visible && !flow.pending(this)) navigation.go('team-honor-workspace', { view: 'mine' }); },
  openRecent(event) { const id = flow.id(event.currentTarget.dataset.id); if (this._visible && !flow.pending(this) && this.data.recentDocs.some(doc => doc.id === id)) navigation.go('team-honor-edit', { id }); },
}));
