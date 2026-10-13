function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const profile = require('../../lib/team-profile');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const privacy = require('../../lib/privacy');
const files = require('../../lib/files');
const account = () => String((session.user() || {}).id || '');
const periodMessage = '入队周期已更新，请重新加载已保存资料，再确认当前周期的展示选择。';
Page(withVisualTheme({
  data: { loading: false, loaded: false, needsLogin: false, error: '', operationError: '', message: '', busy: false,
    profiles: [], eligible: false, editing: false, previewing: false, locked: false, conflict: false, confirmationPending: false,
    draft: profile.display(profile.empty()), draftAvatar: '', imageError: '' },
  back: navigation.back,
  login: navigation.login,
  onLoad(options = {}) {
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
    wx.setNavigationBarTitle({ title: '队员简介' });
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
    if (this._disposed) return; this._visible = true;
    if (this._account !== account()) { this._account = account(); this._context++; this._epoch++; this.resetPrivate(); }
    return this.load();
  },
  onHide() {
    this._visible = false; this._epoch++; this._resumeRead = false; this._loading = null; this.clearPictures();
    this.setData({ loading: false, loaded: false, profiles: [], draftAvatar: '', busy: this.pending() });
  },
  onUnload() {
    this.onHide(); this._disposed = true; this._editor = null; this._original = null; this._draft = profile.empty(); this._profiles = []; this._reconcile = null; this._acknowledged = null;
    if (this._unsubscribe) this._unsubscribe();
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
    this.setData({ locked: true, conflict: false, confirmationPending: false, draft: profile.display(this._draft), operationError: periodMessage, message: '' });
  },
  showAcknowledgement(context, actor, team) {
    const pending = this._reconcile;
    if (!pending || pending.context !== context || pending.actor !== actor || pending.team !== team || !pending.saved || pending.applied || !this._editor || pending.period !== this._editor.period) return;
    pending.applied = true; this._original = pending.saved; this._editor.revision = pending.saved.revision;
    this._draft = profile.draft(pending.saved); this._dirty = false;
    if (this._reconsent || this.data.locked) this._draft.visible = false;
    this.setData({ draft: profile.display(this._draft), previewing: true, confirmationPending: true, operationError: '',
      message: '简介已确认保存，请成功刷新资料核对当前周期后继续。' });
  },
  async load(reset = false, allow = null) {
    if (this._disposed || !this._visible) return;
    const allowed = allow && (allow === this._write && !this._file && !this._modal || allow === this._modal && !this._write && !this._file);
    if (this.pending() && !allowed) { this._resumeRead = true; return; }
    if (!account()) { this.resetPrivate(); return; }
    if (!this._team) { this.setData({ loading: false, error: '队伍入口无效，请返回后重新进入' }); return; }
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
            throw new Error('保存已确认，读取结果尚未更新，请重新读取资料核对。');
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
          if (this._reconcile.saved && (!freshRevision || freshRevision < this._reconcile.saved.revision)) throw new Error('保存已确认，读取结果尚未更新，请重新读取资料核对。');
          if (freshRevision !== this._reconcile.revision) {
            this._original = view.profile; this._editor.revision = freshRevision;
            this._draft = view.profile ? profile.draft(view.profile) : profile.empty(); this._dirty = false;
            const message = this._reconcile.foreground && this._reconcile.saved && freshRevision === this._reconcile.saved.revision
              ? this._reconcile.saved.visible ? '简介已保存并选择展示' : '简介已保存并隐藏' : '保存状态已刷新，请核对当前资料。';
            this.setData({ previewing: false, conflict: false, draft: profile.display(this._draft), message });
          }
          this._reconcile = null; this.setData({ confirmationPending: false });
        }
        await this.renderPictures();
        if (this.valid(context, epoch, actor, team)) this.setData({ loading: false });
      } catch (cause) {
        if (!this.valid(context, epoch, actor, team)) return;
        if ([401, 403, 404].includes(cause.status)) { this._draft.visible = false; this.setData({ locked: true, eligible: false, profiles: [], draft: profile.display(this._draft) }); this.clearPictures(); }
        this.setData({ loading: false, error: cause.message || '简介加载失败，请重试', needsLogin: cause.status === 401 });
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
      imageError: sources.some((source, index) => source && !paths[index]) ? '部分头像暂时无法显示，文字资料仍可查看；可刷新重试。' : '' });
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
      this.setData({ draft: profile.display(this._draft), previewing: false, message: saved.visible ? '简介已保存并选择展示' : '简介已保存并隐藏' });
      await this.load(false, id);
    } catch (cause) {
      if (!this.valid(context, epoch, actor, team)) return;
      if (cause.code === 'PROFILE_PERIOD_CHANGED') this.lockPeriod();
      else if ([401, 403, 404].includes(cause.status)) { this._draft.visible = false; this.setData({ locked: true, eligible: false, draft: profile.display(this._draft), operationError: cause.message }); }
      else this.setData({ operationError: cause.message || '保存失败，输入已保留，请重试', conflict: cause.status === 409 });
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
      const confirmed = await new Promise((resolve, reject) => wx.showModal({ title: '重新加载已保存资料', content: '当前未保存的修改会被已保存资料替换。请确认后重新核对展示选择。',
        success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，可重新加载重试')) }));
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
      if (!chosen.length) throw new Error('未选择图片，可重新选择');
      const image = await files.readImage(chosen[0], 2 * 1024 * 1024); if (!this.valid(context, epoch, actor, team)) return;
      if (!profile.avatar(image)) throw new Error('请选择 2 MB 以内的 PNG、JPEG 或 WebP 静态图片');
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
