const cms = require('../../lib/cms');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions, error, labels } = require('../../lib/page');
const defaults = ['events', 'teams', 'honors', 'news', 'albums'];
Page({
  data: { loading: true, error: '', site: {}, user: null, modules: [], announcements: [] },
  ...actions,
  onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const user = session.user();
    this.setData({ loading: true, error: '', user });
    try {
      const site = await cms.site();
      const kinds = user ? (site.modules.length ? site.modules.filter(module => module.enabled).map(module => module.kind) : defaults)
        : ['events'];
      const modules = await Promise.all(kinds.filter(kind => labels[kind]).map(async kind => {
        const configured = site.modules.find(module => module.kind === kind);
        try {
          let result = await cms.list(kind, { limit: 3 });
          const featured = kind === 'events' ? site.featuredEvents : kind === 'honors' ? site.featuredHonors : [];
          if (featured.length) {
            const selected = await Promise.all(featured.slice(0, 3).map(id => cms.detail(kind, typeof id === 'object' ? id.id : id).catch(() => null)));
            const valid = selected.filter(Boolean);
            if (valid.length) result = { docs: valid };
          }
          return { kind, title: configured && configured.title || labels[kind], docs: await cms.decorate(result.docs) };
        } catch (cause) { return { kind, title: labels[kind], docs: [], error: cause.message }; }
      }));
      const notices = await cms.list('announcements', { limit: 2 });
      const hero = await cms.media(site.heroImage);
      if (ticket !== this._ticket) return;
      this.setData({ loading: false, site, modules, hero, announcements: notices.docs,
        showJoin: user && (!site.modules.length || site.modules.some(module => module.kind === 'join' && module.enabled)),
        showAbout: user && (!site.modules.length || site.modules.some(module => module.kind === 'about' && module.enabled)) });
    } catch (cause) { if (ticket === this._ticket) error(this, cause); }
  },
  retry() { this.load(); },
  openModule(event) { navigation.go('list', { collection: event.currentTarget.dataset.kind }); },
  onShareAppMessage() { return { title: this.data.site.name || '紫荆电竞社', path: '/pages/home/index' }; },
});
