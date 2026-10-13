function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const { render } = require('../../lib/richtext');
const { actions, error } = require('../../lib/page');
const session = require('../../lib/session');
const names = { about: '关于紫荆', contact: '联系与合作', privacy: '隐私说明', join: '加入紫荆', 'join-members': '普通社员', 'join-teams': '代表队选拔', 'join-staff': '骨干招新' };
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, key: '', title: '', doc: null, nodes: [], links: [], contacts: [], batches: [] },
  ...actions,
  onLoad(options) { this.setData({ key: options.key, isJoin: options.key && options.key.startsWith('join'), title: names[options.key] || '社团资料' }); wx.setNavigationBarTitle({ title: names[options.key] || '社团资料' }); },
  onShow() { this.load(); },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    if (this.data.key !== 'privacy' && !session.user()) { this.setData({ loading: false, needsLogin: true }); return; }
    this.setData({ loading: true, error: '', needsLogin: false });
    try {
      if (!names[this.data.key]) throw new Error('页面不存在');
      const result = await cms.list('pages', { key: this.data.key, limit: 1 });
      const doc = result.docs[0] || null;
      const rendered = render(doc && doc.body);
      let contacts = []; let batches = [];
      if (this.data.key === 'contact') contacts = (await cms.site()).contacts;
      if (this.data.key.startsWith('join')) {
        const kind = this.data.key.split('-')[1];
        batches = (await cms.list('recruitment', { kind, limit: 12 })).docs;
      }
      this.setData({ loading: false, doc, nodes: rendered.nodes, links: rendered.links, contacts, batches });
    } catch (cause) { error(this, cause); }
  },
}));
