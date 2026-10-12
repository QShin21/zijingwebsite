const honor = require('../../lib/team-honor');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const identity = () => String((session.user() || {}).id || '');
Page({
  data: { loading: false, error: '', needsLogin: false, team: null, records: [], previewImages: [], loaded: false },
  onLoad(options = {}) {
    if (this._unsubscribe) this._unsubscribe();
    this.invalidate(); this._team = honor.id(options.team); this._identity = identity(); this._visible = false;
    this.setData({ error: this._team ? '' : '队伍入口无效，请返回后重新进入' });
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
    if (this._identity !== identity()) { this._identity = identity(); this.invalidate(); }
    return this.load();
  },
  onHide() { this._visible = false; this.invalidate(); },
  onUnload() { this.onHide(); if (this._unsubscribe) this._unsubscribe(); },
  back: navigation.back,
  workspace() {
    if (this._visible && this._team && navigation.requireUser()) navigation.go('team-honor-workspace', { team: this._team });
  },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    if (!this._visible) return;
    if (!this._team) { this.setData({ error: '队伍入口无效，请返回后重新进入' }); return; }
    if (this.data.loading) return this._pending;
    const team = this._team, account = identity(), ticket = this._ticket = (this._ticket || 0) + 1;
    this.stopVideos();
    honor.removePictures(this._pictures || []); this._pictures = [];
    this.setData({ loading: true, error: '', team: null, records: [], previewImages: [], loaded: false });
    const pending = this._pending = (async () => {
      try {
        const archive = await honor.load(team);
        if (!this.valid(ticket, team, account)) return;
        this.setData({ loading: false, loaded: true, team: archive.team, records: archive.records.map(record => ({ ...record, images: [] })) });
        if (archive.team.title) wx.setNavigationBarTitle({ title: archive.team.title + ' · 荣誉档案' });
        const records = await Promise.all(archive.records.map(record => honor.pictures(record)));
        const paths = records.reduce((all, record) => all.concat(record.localImages.map(image => image.url)), []);
        if (!this.valid(ticket, team, account)) { honor.removePictures(paths); return; }
        this._pictures = paths;
        this.setData({ records, previewImages: paths });
      } catch (cause) {
        if (!this.valid(ticket, team, account)) return;
        if (cause && cause.status === 404) this.setData({ loading: false, loaded: true, error: '', records: [], team: null, previewImages: [] });
        else this.setData({ loading: false, loaded: false, error: cause && cause.message || '荣誉档案加载失败，请重试' });
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
      ? { ...record, videoError: '视频暂时无法加载，请重新加载档案后重试' } : record) });
  },
});
