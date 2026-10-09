const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const navigation = require('../../lib/navigation');
const format = require('../../lib/format');
const { render } = require('../../lib/richtext');
const { actions, error, protect } = require('../../lib/page');
const areas = { updates: 'community-posts', forum: 'forum-posts', showcase: 'community-showcase' };
Page({
  data: { loading: true, error: '', needsLogin: false, game: {}, managed: false, area: 'updates', docs: [], page: 1,
    hasMore: false, loadingMore: false, contacts: [], sort: 'latest', nodes: [], contentError: '' },
  ...actions,
  onLoad(options) { this._options = options; },
  onShow() { this.load(); },
  onHide() { this._ticket = (this._ticket || 0) + 1; },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loadingMore) this.loadArea(true); },
  async load() {
    if (!protect(this)) { this.setData({ loading: false, docs: [], contacts: [] }); return; }
    const ticket = this._ticket = (this._ticket || 0) + 1;
    this.setData({ loading: true, error: '' });
    try {
      const game = await cms.detail('games', this._options.id, this._options.slug);
      if (ticket !== this._ticket) return;
      this.setData({ game, loading: false, managed: session.manages(game.id), nodes: render(game.body).nodes });
      wx.setNavigationBarTitle({ title: game.title });
      await this.loadArea();
      const contacts = await http.request(`/community/${encodeURIComponent(game.slug)}/contacts`, { required: true });
      const mapped = [];
      for (const contact of contacts) mapped.push({ name: contact.name, image: await files.localImage(contact.qr) });
      if (ticket === this._ticket) this.setData({ contacts: mapped });
    } catch (cause) { if (ticket === this._ticket) error(this, cause); }
  },
  async loadArea(more = false) {
    const ticket = this._areaTicket = (this._areaTicket || 0) + 1;
    this.setData({ loadingMore: true, contentError: '' });
    try {
      const result = await cms.social(areas[this.data.area], { game: this.data.game.id, page: more ? this.data.page + 1 : 1,
        limit: this.data.area === 'showcase' ? 4 : 15,
        sort: this.data.area === 'forum' ? (this.data.sort === 'hot' ? '-pinned,-heat,-createdAt' : '-pinned,-createdAt') : '-createdAt' });
      const docs = [];
      for (const doc of result.docs) {
        const images = [];
        for (const image of (doc.images || [])) images.push({ source: await files.localImage(image.source), caption: image.caption });
        docs.push({ ...doc, collection: areas[this.data.area], dateText: format.date(doc.createdAt), localImages: images });
      }
      if (ticket !== this._areaTicket) return;
      this.setData({ loadingMore: false, docs: more ? this.data.docs.concat(docs) : docs, page: result.page, hasMore: result.hasNextPage });
    } catch (cause) { if (ticket === this._areaTicket) this.setData({ loadingMore: false, contentError: cause.message }); }
  },
  area(event) { this.setData({ area: event.currentTarget.dataset.area, docs: [], page: 1 }); this.loadArea(); },
  sort(event) { this.setData({ sort: event.currentTarget.dataset.sort }); this.loadArea(); },
  chat() { navigation.go('chat', { slug: this.data.game.slug, id: this.data.game.id, title: this.data.game.title }); },
  compose() { navigation.go('compose', { kind: this.data.area === 'forum' ? 'forum' : this.data.area === 'showcase' ? 'showcase' : 'event', game: this.data.game.id }); },
  review() { navigation.go('review', { game: this.data.game.id, mode: 'showcase' }); },
  async manageShowcase(event) {
    if (!this.data.managed) return;
    const result = await new Promise(resolve => wx.showModal({ title: '隐藏投稿', content: '确认隐藏这条社群风采投稿？', success: resolve }));
    if (!result.confirm) return;
    try { await http.request(`/api/community-showcase/${event.currentTarget.dataset.id}`, { required: true, method: 'PATCH', data: { status: 'hidden' } }); this.loadArea(); }
    catch (cause) { wx.showToast({ title: cause.message, icon: 'none' }); }
  },
  onShareAppMessage() { return { title: this.data.game.title || '紫荆游戏社群', path: `/pages/community/index?id=${this.data.game.id}&slug=${this.data.game.slug}` }; },
});
