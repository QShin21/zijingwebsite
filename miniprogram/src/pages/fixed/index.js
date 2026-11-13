function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const { render } = require('../../lib/richtext');
const { actions, error } = require('../../lib/page');
const session = require('../../lib/session');
const reading = require('../../lib/native-reading');
const names = { about: '关于紫荆', contact: '联系与合作', privacy: '隐私说明', join: '加入紫荆', 'join-members': '普通社员', 'join-teams': '代表队选拔', 'join-staff': '骨干招新' };
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, key: '', title: '', doc: null, reading: {}, nodes: [], links: [], contacts: [], batches: [], coverImage: null, coverImageFailed: false },
  ...actions,
  onLoad(options) {
    this._hidden = false; this._unloaded = false;
    const user = session.user(); this._userId = user && user.id;
    this.setData({ key: options.key, isJoin: options.key && options.key.startsWith('join-'), title: names[options.key] || '社团资料' });
    wx.setNavigationBarTitle({ title: names[options.key] || '社团资料' });
    this._unsubscribe = session.subscribe(user => {
      if (String(user && user.id) === String(this._userId)) return;
      this._userId = user && user.id; this._ticket = (this._ticket || 0) + 1;
      this.setData({ loading: false, error: '', needsLogin: this.data.isJoin && !user, doc: null, reading: {}, nodes: [], links: [], contacts: [], batches: [], coverImage: null, coverImageFailed: false });
    });
  },
  onShow() { this._hidden = false; this.load(); },
  onHide() { this._hidden = true; this._ticket = (this._ticket || 0) + 1; },
  onUnload() { this._unloaded = true; this.onHide(); if (this._unsubscribe) this._unsubscribe(); },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    if (this._hidden || this._unloaded) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const user = session.user(), userId = user && user.id; this._userId = userId;
    const current = () => { const actor = session.user(); return ticket === this._ticket && !this._hidden && !this._unloaded && String(actor && actor.id) === String(userId); };
    const cleared = { doc: null, reading: {}, nodes: [], links: [], contacts: [], batches: [], coverImage: null, coverImageFailed: false };
    if (this.data.isJoin && !session.campus(user)) {
      this.setData({ ...cleared, loading: false, error: user ? '此栏目仅面向清华账号' : '', needsLogin: !user });
      return;
    }
    this.setData({ ...cleared, loading: true, error: '', needsLogin: false });
    try {
      if (!names[this.data.key]) throw new Error('页面不存在');
      const page = await cms.fixed(this.data.key);
      if (!current()) return;
      const doc = page.updatedAt ? page : null;
      const rendered = render(doc && doc.body);
      const contacts = page.contacts || [];
      let batches = [];
      if (this.data.isJoin) {
        const kind = this.data.key.split('-')[1];
        batches = (await cms.list('recruitment', { kind, limit: 12 })).docs.map(reading.entry);
      }
      if (!current()) return;
      this.setData({ loading: false, doc, reading: doc ? reading.article(doc, 'pages') : {}, nodes: reading.prose(rendered.nodes), links: rendered.links, contacts, batches, campus: session.campus(user) });
    } catch (cause) { if (current()) error(this, cause); }
  },
  readingImageError(event) {
    if (this._hidden || this._unloaded || this.data.loading || this.data.needsLogin) return;
    if (this.data.coverImage && this.data.coverImage.url === event.currentTarget.dataset.url) this.setData({ coverImageFailed: true });
  },
  nativeCoverError(event) {
    if (this._hidden || this._unloaded) return;
    const batches = require('../../lib/native-presentation').markCoverFailure(this.data.batches, event.currentTarget.dataset);
    if (batches !== this.data.batches) this.setData({ batches });
  },
}));
