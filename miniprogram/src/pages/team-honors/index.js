function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const honor = require('../../lib/team-honor');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const identity = () => String((session.user() || {}).id || '');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回队伍', '‹ Back to team'],
  kickerPrefix: ['HALL OF FAME · ', 'HALL OF FAME · '],
  archive: ['队伍档案', 'Team archive'],
  titleFallback: ['队伍荣誉档案', 'Team honors archive'],
  lead: ['现任队员可提交荣誉。经审核的成绩按赛事日期归档。', 'Current members can submit honors. Reviewed results are archived by competition date.'],
  submit: ['提交代表队荣誉', 'Submit a team honor'],
  workspace: ['我的荣誉投稿与工作台', 'My honor submissions and workbench'],
  emptyTitle: ['暂无已公开的荣誉档案', 'No public honors yet'],
  emptyBody: ['队伍的荣誉记录核验并发布后会出现在这里。', 'Team honors appear here once verified and published.'],
  reload: ['重新加载', 'Reload'],
  yearRecords: ['赛场记录', 'Match records'],
  matchDate: ['赛事日期', 'Match date'],
  legacy: ['历史荣誉档案', 'Legacy honor record'],
  recordedByPrefix: ['记录：', 'Recorded by: '],
  loadingImages: ['正在加载公开图片…', 'Loading public images…'],
  previewImage: ['预览荣誉图片', 'Preview honor image'],
  reloadArchive: ['重新加载档案', 'Reload archive'],
  viewSource: ['查看历史荣誉原文', 'View the original record'],
  refresh: ['刷新档案', 'Refresh archive'],
};

function archiveRows(records) {
  return records.map(record => {
    const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(record.dateText || '');
    return { ...record, archiveYear: date ? date[1] : '', archiveDate: date ? date[2] + '.' + date[3] : record.dateText || i18n.t('日期待补充', 'Date to be added') };
  });
}
Page(withVisualTheme({
  data: { loading: false, error: '', needsLogin: false, team: null, records: [], previewImages: [], loaded: false, validTeam: false },
  onLoad(options = {}) {
    i18n.bind(this, text);
    if (this._unsubscribe) this._unsubscribe();
    this.invalidate(); this._team = honor.id(options.team); this._identity = identity(); this._visible = false;
    this.setData({ validTeam: Boolean(this._team), error: this._team ? '' : i18n.t('队伍入口无效，请返回后重新进入', 'Invalid team link. Go back and open it again.') });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity === identity()) return;
      this._identity = identity(); this.invalidate();
      if (this._visible) this.load();
    });
  },
  invalidate() {
    this._ticket = (this._ticket || 0) + 1;
    honor.removePictures(this._pictures || []); this._pictures = [];
    this.stopVideos();
    this.setData({ loading: false, error: '', team: null, records: [], previewImages: [], loaded: false });
  },
  stopVideos() {
    if (typeof wx.createVideoContext === 'function') this.data.records.forEach((record, index) => {
      if (record.videoSource) { try { wx.createVideoContext('honor-video-' + index, this).stop(); } catch { /* Native back remains usable. */ } }
    });
  },
  valid(ticket, team, account) {
    return this._visible && ticket === this._ticket && team === this._team && account === identity();
  },
  onShow() {
    this._visible = true;
    i18n.navTitle('队伍荣誉档案', 'Team honors');
    if (this._identity !== identity()) { this._identity = identity(); this.invalidate(); }
    return this.load();
  },
  onHide() { this._visible = false; this.invalidate(); },
  onUnload() { this.onHide(); if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
  back: navigation.back,
  submitHonor() {
    if (this._visible && this._team) navigation.go('team-honor-edit', { team: this._team });
  },
  workspace() {
    if (this._visible && this._team && navigation.requireUser()) navigation.go('team-honor-workspace', { team: this._team });
  },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    if (!this._visible) return;
    if (!this._team) { this.setData({ error: i18n.t('队伍入口无效，请返回后重新进入', 'Invalid team link. Go back and open it again.') }); return; }
    if (this.data.loading) return this._pending;
    const team = this._team, account = identity(), ticket = this._ticket = (this._ticket || 0) + 1;
    this.stopVideos();
    honor.removePictures(this._pictures || []); this._pictures = [];
    this.setData({ loading: true, error: '', team: null, records: [], previewImages: [], loaded: false });
    const pending = this._pending = (async () => {
      try {
        const archive = await honor.load(team);
        if (!this.valid(ticket, team, account)) return;
        this.setData({ loading: false, loaded: true, team: archive.team, records: archiveRows(archive.records.map(record => ({ ...record, images: [] }))) });
        if (archive.team.title) wx.setNavigationBarTitle({ title: archive.team.title + i18n.t(' · 荣誉档案', ' · Honors') });
        const records = await Promise.all(archive.records.map(record => honor.pictures(record)));
        const paths = records.reduce((all, record) => all.concat(record.localImages.map(image => image.url)), []);
        if (!this.valid(ticket, team, account)) { honor.removePictures(paths); return; }
        this._pictures = paths;
        this.setData({ records: archiveRows(records), previewImages: paths });
      } catch (cause) {
        if (!this.valid(ticket, team, account)) return;
        if (cause && cause.status === 404) this.setData({ loading: false, loaded: true, error: '', records: [], team: null, previewImages: [] });
        else this.setData({ loading: false, loaded: false, error: cause && cause.message || i18n.t('荣誉档案加载失败，请重试', 'The honors archive failed to load. Please try again.') });
      } finally { if (this.valid(ticket, team, account)) this._pending = null; }
    })();
    return pending;
  },
  preview(event) {
    const url = event.currentTarget.dataset.url;
    if (this._visible && this.data.previewImages.indexOf(url) !== -1) wx.previewImage({ current: url, urls: this.data.previewImages });
  },
  source(event) {
    if (!this._visible) return;
    const record = this.data.records.find(record => record.key === event.currentTarget.dataset.key);
    if (record && record.sourceHref) navigation.website(record.sourceHref);
  },
  videoError(event) {
    if (!this._visible) return;
    const { key, source } = event.currentTarget.dataset;
    this.setData({ records: this.data.records.map(record => record.key === key && record.videoSource === source
      ? { ...record, videoError: i18n.t('视频暂时无法加载，请重新加载档案后重试', 'The video cannot load right now. Reload the archive and try again.') } : record) });
  },
}));
