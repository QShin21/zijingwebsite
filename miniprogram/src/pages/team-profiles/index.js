function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const profile = require('../../lib/team-profile');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const privacy = require('../../lib/privacy');
const files = require('../../lib/files');
const account = () => String((session.user() || {}).id || '');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回队伍', '‹ Back to team'],
  kicker: ['本人选择 · 队内展示', 'Your choice · Team display'],
  title: ['队员简介', 'Member profiles'],
  lead: ['用公开昵称介绍自己，由本人选择是否在本代表队展示。', 'Introduce yourself with a public nickname and choose whether to show it on this team.'],
  locked: ['编辑已锁定，保留的输入可继续预览。重新加载后需再次主动选择展示。', 'Editing is locked; your kept input can still be previewed. After reloading, choose display again.'],
  conflict: ['当前输入可继续预览，请重新加载已保存资料后核对修改。', 'You can still preview your input. Reload the saved profile and check your changes.'],
  pending: ['保存结果待核对，本页内容可预览。成功刷新当前周期前不会再次保存。', 'The save result needs checking; content can be previewed. Saving is paused until a refresh succeeds.'],
  refreshSave: ['刷新核对保存状态', 'Refresh save status'],
  reloadSaved: ['重新加载已保存资料', 'Reload saved profile'],
  mine: ['我的展示资料', 'My profile'],
  showing: ['当前展示中', 'Shown'],
  hidden: ['当前未展示', 'Not shown'],
  showingHint: ['你已选择展示自己的简介，可编辑或关闭展示。', 'You chose to show your profile. You can edit it or hide it.'],
  hiddenHint: ['你的简介当前未选择展示。填写、预览并确认保存后生效。', 'Your profile is not shown. Fill it in, preview and save to show it.'],
  ineligible: ['入队审核通过且仍在队后，可以填写自己的队内简介。', 'Once accepted and still on the team, you can write your team profile.'],
  edit: ['编辑我的队内简介', 'Edit my team profile'],
  stepEdit: ['1 编辑', '1 Edit'],
  stepReview: ['2 保存前核对', '2 Review before saving'],
  publicOnly: ['只填写愿意公开的内容，无需填写真实姓名、学号、联系方式或报名答案。', 'Only enter what you are happy to share; no real name, student ID, contact details or application answers needed.'],
  nickname: ['公开昵称', 'Public nickname'],
  nicknameLabel: ['昵称 · 必填', 'Nickname · required'],
  nicknameHint: ['最多 40 字，展示时用于识别你的简介。', 'Up to 40 characters; identifies your profile.'],
  extra: ['选择补充介绍', 'Optional details'],
  extraHint: ['以下内容均为选填，填写后会随简介一起展示；不希望展示的字段请留空。', 'All optional; anything filled in is shown with your profile. Leave blank what you do not want shown.'],
  position: ['位置 / 游戏角色（可选公开）', 'Position / role (optional, public)'],
  bio: ['简短介绍（可选公开）', 'Short bio (optional, public)'],
  bioHint: ['最多 400 字，可介绍擅长的位置与共同游戏的习惯。', 'Up to 400 characters, e.g. favourite positions and play habits.'],
  avatar: ['头像（可选公开）', 'Avatar (optional, public)'],
  avatarPreview: ['本人简介头像预览', 'Profile avatar preview'],
  changeAvatar: ['更换头像', 'Change avatar'],
  chooseAvatar: ['选择头像', 'Choose avatar'],
  removeAvatar: ['移除头像', 'Remove avatar'],
  avatarHint: ['2 MB 以内的 PNG、JPEG 或 WebP 静态图片。保存时清除图片元数据；取消选择不会清空文字。', 'A still PNG, JPEG or WebP image up to 2 MB. Metadata is removed on save; cancelling keeps your text.'],
  privacyGuide: ['查看微信隐私指引', 'View the WeChat privacy guide'],
  displayChoice: ['本人展示选择', 'Display choice'],
  consentLabel: ['在本代表队页面展示我的简介', 'Show my profile on this team page'],
  consentHint: ['公开昵称及以上主动填写的介绍、头像一并展示。', 'Your nickname plus any details and avatar you added are shown.'],
  consentNote: ['取消展示后预览并保存即可隐藏。离队或资格撤销后退出简介名单；重新入队需再次确认。', 'Turn off, preview and save to hide. Leaving or revocation removes you from the list; rejoining needs a new confirmation.'],
  previewAction: ['预览简介与展示选择', 'Preview profile and display choice'],
  cancel: ['取消修改', 'Cancel changes'],
  previewAvatar: ['简介预览头像', 'Profile preview avatar'],
  savedChoice: ['本次保存的展示选择', 'Display choice to save'],
  showProfile: ['展示简介', 'Show profile'],
  hideProfile: ['隐藏简介', 'Hide profile'],
  pendingNote: ['保存结果尚需刷新核对当前周期，当前不能再次保存。', 'The save result needs a refresh for this period; you cannot save again yet.'],
  showNote: ['确认保存后，上方昵称与已填写内容将展示在本代表队简介页。', 'After saving, the nickname and details above appear on this team\'s profile page.'],
  hideNote: ['确认保存后，这份简介将从展示名单隐藏。', 'After saving, this profile is hidden from the list.'],
  backToEdit: ['返回修改', 'Back to edit'],
  save: ['确认保存简介', 'Save profile'],
  publicProfiles: ['本队公开简介', 'Public team profiles'],
  publicHint: ['仅展示仍在队且本人选择公开的资料。', 'Only current members who chose to share are shown.'],
  refresh: ['刷新资料', 'Refresh'],
  emptyTitle: ['暂无选择展示的队员简介', 'No shared profiles yet'],
  emptyBody: ['本人保存并选择展示后，会出现在这里。', 'Profiles appear here once members save and choose to show them.'],
  avatarOfSuffix: ['的头像', '\'s avatar'],
};

const periodMessage = () => i18n.t('入队周期已更新，请重新加载已保存资料，再确认当前周期的展示选择。', 'Your membership period changed. Reload the saved profile and confirm the display choice for the current period.');
Page(withVisualTheme({
  data: { loading: false, loaded: false, needsLogin: false, error: '', operationError: '', message: '', busy: false,
    profiles: [], eligible: false, editing: false, previewing: false, locked: false, conflict: false, confirmationPending: false,
    draft: profile.display(profile.empty()), draftAvatar: '', imageError: '' },
  back: navigation.back,
  login: navigation.login,
  onLoad(options = {}) {
    i18n.bind(this, text);
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false;
    this._context = (this._context || 0) + 1; this._epoch = (this._epoch || 0) + 1;
    this._team = profile.id(options.team); this._account = account(); this.resetPrivate();
    this._startEditing = options.edit === '1';
    this._unsubscribe = session.subscribe(() => {
      if (this._account === account()) return;
      this._account = account(); this._context++; this._epoch++; this._resumeRead = false; this.resetPrivate();
      if (this._visible) this.load();
    });
    i18n.navTitle('队员简介', 'Member profiles');
  },
  pending() { return Boolean(this._write || this._file || this._modal); },
  syncBusy() { if (!this._disposed) this.setData({ busy: this.pending() }); },
  resetPrivate() {
    this.clearPictures(); this._loading = null; this._editor = null; this._original = null; this._draft = profile.empty();
    this._profiles = []; this._viewPeriod = null; this._reconcile = null; this._acknowledged = null; this._dirty = false; this._reconsent = false;
    this.setData({ loading: false, loaded: false, needsLogin: !account(), error: '', operationError: '', message: '', busy: this.pending(),
      profiles: [], eligible: false, editing: false, previewing: false, locked: false, conflict: false, confirmationPending: false,
      draft: profile.display(this._draft), draftAvatar: '', imageError: '' });
  },
  clearPictures() {
    this._pictureEpoch = (this._pictureEpoch || 0) + 1;
    profile.removePictures(this._pictures || []); this._pictures = [];
  },
  valid(context, epoch, actor, team) {
    return !this._disposed && this._visible && context === this._context && epoch === this._epoch && actor === account() && Boolean(actor) && team === this._team;
  },
  sameScope(context, actor, team) { return !this._disposed && context === this._context && actor === account() && Boolean(actor) && team === this._team; },
  begin(slot) { const id = this._operation = (this._operation || 0) + 1; this[slot] = id; this.syncBusy(); return id; },
  async finish(slot, id) {
    if (this[slot] !== id) return;
    this[slot] = null; this.syncBusy();
    if (!this._disposed && this._visible && !this.pending() && this._resumeRead) { this._resumeRead = false; await this.load(); }
  },
  onShow() {
    if (this._disposed) return; this._visible = true; i18n.navTitle('队员简介', 'Member profiles');
    if (this._account !== account()) { this._account = account(); this._context++; this._epoch++; this.resetPrivate(); }
    return this.load();
  },
  onHide() {
    this._visible = false; this._epoch++; this._resumeRead = false; this._loading = null; this.clearPictures();
    this.setData({ loading: false, loaded: false, profiles: [], draftAvatar: '', busy: this.pending() });
  },
  onUnload() {
    this.onHide(); this._disposed = true; this._editor = null; this._original = null; this._draft = profile.empty(); this._profiles = []; this._reconcile = null; this._acknowledged = null;
    if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this);
  },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  initialize(view) {
    if (this._acknowledged && this._acknowledged.period !== view.period) this._acknowledged = null;
    this._editor = view.eligible && view.period ? { period: view.period, revision: view.profile ? view.profile.revision : null } : null;
    this._original = view.profile; this._draft = view.profile ? profile.draft(view.profile) : profile.empty();
    if (this._reconsent) this._draft.visible = false;
    this._dirty = false; this._reconcile = null;
    this.setData({ locked: false, conflict: false, confirmationPending: false, previewing: false, editing: Boolean(this._startEditing && this._editor), draft: profile.display(this._draft) });
    this._startEditing = false;
  },
  lockPeriod() {
    this._draft.visible = false; this._reconsent = true; this._reconcile = null;
    this.setData({ locked: true, conflict: false, confirmationPending: false, draft: profile.display(this._draft), operationError: periodMessage(), message: '' });
  },
  showAcknowledgement(context, actor, team) {
    const pending = this._reconcile;
    if (!pending || pending.context !== context || pending.actor !== actor || pending.team !== team || !pending.saved || pending.applied || !this._editor || pending.period !== this._editor.period) return;
    pending.applied = true; this._original = pending.saved; this._editor.revision = pending.saved.revision;
    this._draft = profile.draft(pending.saved); this._dirty = false;
    if (this._reconsent || this.data.locked) this._draft.visible = false;
    this.setData({ draft: profile.display(this._draft), previewing: true, confirmationPending: true, operationError: '',
      message: i18n.t('简介已确认保存，请成功刷新资料核对当前周期后继续。', 'Profile save confirmed. Refresh successfully to check the current period before continuing.') });
  },
  async load(reset = false, allow = null) {
    if (this._disposed || !this._visible) return;
    const allowed = allow && (allow === this._write && !this._file && !this._modal || allow === this._modal && !this._write && !this._file);
    if (this.pending() && !allowed) { this._resumeRead = true; return; }
    if (!account()) { this.resetPrivate(); return; }
    if (!this._team) { this.setData({ loading: false, error: i18n.t('队伍入口无效，请返回后重新进入', 'Invalid team link. Go back and open it again.') }); return; }
    if (this._loading) return this._loading;
    const context = this._context, epoch = this._epoch, actor = account(), team = this._team;
    this.showAcknowledgement(context, actor, team);
    this._resumeRead = false; this.setData({ loading: true, error: '', needsLogin: false });
    const reading = (async () => {
      try {
        const view = await profile.load(team);
        if (!this.valid(context, epoch, actor, team)) return;
        const pending = this._reconcile;
        const acknowledged = this._acknowledged;
        const sameAcknowledgement = acknowledged && acknowledged.context === context && acknowledged.actor === actor && acknowledged.team === team;
        // A successful PUT establishes a revision floor for this identity and period, including explicit reloads.
        if (sameAcknowledgement && view.eligible && view.period === acknowledged.period) {
          if (!view.profile || view.profile.revision < acknowledged.minimum) {
            this._reconcile = pending || acknowledged; this.setData({ confirmationPending: true });
            throw new Error(i18n.t('保存已确认，读取结果尚未更新，请重新读取资料核对。', 'Save confirmed, but the read result is not updated yet. Reload to check.'));
          }
          acknowledged.minimum = Math.max(acknowledged.minimum, view.profile.revision);
        }
        this._profiles = view.profiles; this._viewPeriod = view.period;
        this.setData({ loaded: true, eligible: view.eligible });
        if (pending && (!view.eligible || view.period !== pending.period)) this.lockPeriod();
        else if (reset || !this._editor && !this.data.locked) {
          if (reset && this._editor && view.period !== this._editor.period) this._reconsent = true;
          this.initialize(view); this.setData({ operationError: '', message: '' });
        }
        else if (!this._editor || !view.eligible || view.period !== this._editor.period) this.lockPeriod();
        else if (this._reconcile && this._reconcile.context === context && this._reconcile.actor === actor && this._reconcile.team === team) {
          const freshRevision = view.profile ? view.profile.revision : null;
          if (this._reconcile.saved && (!freshRevision || freshRevision < this._reconcile.saved.revision)) throw new Error(i18n.t('保存已确认，读取结果尚未更新，请重新读取资料核对。', 'Save confirmed, but the read result is not updated yet. Reload to check.'));
          if (freshRevision !== this._reconcile.revision) {
            this._original = view.profile; this._editor.revision = freshRevision;
            this._draft = view.profile ? profile.draft(view.profile) : profile.empty(); this._dirty = false;
            const message = this._reconcile.foreground && this._reconcile.saved && freshRevision === this._reconcile.saved.revision
              ? this._reconcile.saved.visible ? i18n.t('简介已保存并选择展示', 'Profile saved and shown') : i18n.t('简介已保存并隐藏', 'Profile saved and hidden') : i18n.t('保存状态已刷新，请核对当前资料。', 'Save status refreshed. Check the current profile.');
            this.setData({ previewing: false, conflict: false, draft: profile.display(this._draft), message });
          }
          this._reconcile = null; this.setData({ confirmationPending: false });
        }
        await this.renderPictures();
        if (this.valid(context, epoch, actor, team)) this.setData({ loading: false });
      } catch (cause) {
        if (!this.valid(context, epoch, actor, team)) return;
        if ([401, 403, 404].includes(cause.status)) { this._draft.visible = false; this.setData({ locked: true, eligible: false, profiles: [], draft: profile.display(this._draft) }); this.clearPictures(); }
        this.setData({ loading: false, error: cause.message || i18n.t('简介加载失败，请重试', 'Profiles failed to load. Please try again.'), needsLogin: cause.status === 401 });
      } finally { if (this.valid(context, epoch, actor, team)) this._loading = null; }
    })();
    this._loading = reading; return reading;
  },
  async renderPictures() {
    this.clearPictures();
    const context = this._context, epoch = this._epoch, actor = account(), team = this._team, turn = this._pictureEpoch;
    const rows = this._profiles.map(value => ({ id: value.id, displayName: value.displayName, position: value.position, biography: value.biography, avatarPath: '' }));
    this.setData({ profiles: rows, draftAvatar: '', imageError: '' });
    const sources = this._profiles.map(value => value.avatar).concat(this._draft.avatar);
    const paths = await profile.pictures(sources);
    if (!this.valid(context, epoch, actor, team) || turn !== this._pictureEpoch) { profile.removePictures(paths); return; }
    this._pictures = paths.filter(Boolean);
    this.setData({ profiles: rows.map((row, index) => ({ ...row, avatarPath: paths[index] })), draftAvatar: paths[rows.length],
      imageError: sources.some((source, index) => source && !paths[index]) ? i18n.t('部分头像暂时无法显示，文字资料仍可查看；可刷新重试。', 'Some avatars cannot be shown; text is still available. Refresh to retry.') : '' });
  },
  edit() {
    if (this.pending() || this.data.loading || this.data.confirmationPending || !this._visible || !this.data.eligible || this.data.locked || !this._editor) return;
    this.setData({ editing: true, previewing: false, operationError: '', message: '' });
  },
  input(event) {
    if (this.pending() || this.data.loading || this.data.confirmationPending || this.data.locked || !this.data.editing || !this._visible) return;
    const key = event.currentTarget.dataset.field;
    if (!['displayName', 'position', 'biography'].includes(key) || typeof event.detail.value !== 'string') return;
    this._draft[key] = event.detail.value; this._dirty = true;
    this.setData({ draft: profile.display(this._draft), previewing: false, operationError: '', message: '' });
  },
  consent(event) {
    if (this.pending() || this.data.loading || this.data.confirmationPending || this.data.locked || !this.data.editing || !this._visible || typeof event.detail.value !== 'boolean') return;
    this._draft.visible = event.detail.value; this._dirty = true; this._reconsent = false;
    this.setData({ draft: profile.display(this._draft), previewing: false, operationError: '', message: '' });
  },
  preview() {
    if (this.pending() || !this._visible || !this.data.editing) return;
    try { profile.validate(this._draft); this.setData({ previewing: true, operationError: '', message: this.data.confirmationPending ? this.data.message : '' }); }
    catch (cause) { this.setData({ operationError: cause.message }); }
  },
  returnToEdit() { if (!this.pending() && this._visible) this.setData({ previewing: false }); },
  cancel() {
    if (this.pending() || !this._visible) return;
    this._draft = this._original ? profile.draft(this._original) : profile.empty();
    if (this._reconsent || this.data.locked) this._draft.visible = false;
    this._dirty = false; this.setData({ editing: false, previewing: false, draft: profile.display(this._draft), operationError: '', message: '' });
    return this.renderPictures();
  },
  async save() {
    if (this.pending() || this.data.loading || this.data.confirmationPending || this._reconcile || !this._visible || this._disposed || !account() || !this.data.eligible || this.data.locked || this.data.conflict || !this.data.previewing || !this._editor) return;
    const context = this._context, epoch = this._epoch, actor = account(), team = this._team;
    const period = this._editor.period, revision = this._editor.revision, value = { ...this._draft }, id = this.begin('_write');
    let acknowledgement = null;
    this.setData({ operationError: '', message: '' });
    try {
      const saved = await profile.save(team, revision, period, value);
      if (this.sameScope(context, actor, team) && this._editor && this._editor.period === period) {
        acknowledgement = saved;
        this._reconcile = { context, actor, team, revision, period, saved, minimum: saved.revision, foreground: this.valid(context, epoch, actor, team) };
        this._acknowledged = this._reconcile; this.setData({ confirmationPending: true });
      }
      if (!this.valid(context, epoch, actor, team)) return;
      this._original = saved; this._editor.revision = saved.revision; this._draft = profile.draft(saved); this._dirty = false;
      this._reconcile.applied = true;
      this.setData({ draft: profile.display(this._draft), previewing: false, message: saved.visible ? i18n.t('简介已保存并选择展示', 'Profile saved and shown') : i18n.t('简介已保存并隐藏', 'Profile saved and hidden') });
      await this.load(false, id);
    } catch (cause) {
      if (!this.valid(context, epoch, actor, team)) return;
      if (cause.code === 'PROFILE_PERIOD_CHANGED') this.lockPeriod();
      else if ([401, 403, 404].includes(cause.status)) { this._draft.visible = false; this.setData({ locked: true, eligible: false, draft: profile.display(this._draft), operationError: cause.message }); }
      else this.setData({ operationError: cause.message || i18n.t('保存失败，输入已保留，请重试', 'Save failed; your input is kept. Please try again.'), conflict: cause.status === 409 });
    } finally {
      if (!acknowledgement && !this._reconcile && !this.data.locked && !this.valid(context, epoch, actor, team) && this.sameScope(context, actor, team)) {
        this._reconcile = { context, actor, team, revision, period, saved: acknowledgement };
        this.setData({ confirmationPending: true });
      }
      await this.finish('_write', id);
    }
  },
  async reload() {
    if (this.pending() || this.data.loading || !this._visible || this._disposed) return;
    if (!this._dirty && !this.data.locked && !this.data.conflict) return this.load(true);
    const context = this._context, epoch = this._epoch, actor = account(), team = this._team, id = this.begin('_modal');
    try {
      const confirmed = await new Promise((resolve, reject) => wx.showModal({ title: i18n.t('重新加载已保存资料', 'Reload saved profile'), content: i18n.t('当前未保存的修改会被已保存资料替换。请确认后重新核对展示选择。', 'Unsaved changes will be replaced by the saved profile. Confirm, then re-check the display choice.'),
        success: value => resolve(value.confirm), fail: () => reject(new Error(i18n.t('确认未完成，可重新加载重试', 'Confirmation was not completed; reload to try again.'))) }));
      if (confirmed && this.valid(context, epoch, actor, team)) await this.load(true, id);
    } catch (cause) { if (this.valid(context, epoch, actor, team)) this.setData({ operationError: cause.message }); }
    finally { await this.finish('_modal', id); }
  },
  async chooseAvatar() {
    if (this.pending() || this.data.loading || this.data.confirmationPending || !this._visible || this._disposed || !this.data.editing || !this.data.eligible || this.data.locked) return;
    const context = this._context, epoch = this._epoch, actor = account(), team = this._team, id = this.begin('_file');
    this.setData({ operationError: '', message: '' });
    try {
      await privacy.authorize(); if (!this.valid(context, epoch, actor, team)) return;
      const chosen = await files.choose(1); if (!this.valid(context, epoch, actor, team)) return;
      if (!chosen.length) throw new Error(i18n.t('未选择图片，可重新选择', 'No image selected; you can choose again.'));
      const image = await files.readImage(chosen[0], 2 * 1024 * 1024); if (!this.valid(context, epoch, actor, team)) return;
      if (!profile.avatar(image)) throw new Error(i18n.t('请选择 2 MB 以内的 PNG、JPEG 或 WebP 静态图片', 'Choose a still PNG, JPEG or WebP image up to 2 MB'));
      this._draft.avatar = image; this._dirty = true; this.setData({ draft: profile.display(this._draft), previewing: false });
      await this.renderPictures();
    } catch (cause) { if (this.valid(context, epoch, actor, team)) this.setData({ operationError: cause.message }); }
    finally { await this.finish('_file', id); }
  },
  removeAvatar() {
    if (this.pending() || this.data.loading || this.data.confirmationPending || this.data.locked || !this._visible || !this.data.editing) return;
    this._draft.avatar = null; this._dirty = true; this.setData({ draft: profile.display(this._draft), previewing: false }); return this.renderPictures();
  },
  async openPrivacy() {
    if (this.pending() || !this._visible || this._disposed) return;
    const context = this._context, epoch = this._epoch, actor = account(), team = this._team, id = this.begin('_modal');
    this.setData({ operationError: '' });
    try { await privacy.openContract(); }
    catch (cause) { if (this.valid(context, epoch, actor, team)) this.setData({ operationError: cause.message }); }
    finally { await this.finish('_modal', id); }
  },
}));
