const cms = require('../../lib/cms');
const http = require('../../lib/http');
const files = require('../../lib/files');
const format = require('../../lib/format');
const { render } = require('../../lib/richtext');
const { actions, error, protect } = require('../../lib/page');
const video = require('../../lib/video');
const areas = { updates: 'community-posts', showcase: 'community-showcase' };
Page({
  data: { loading: true, error: '', needsLogin: false, game: {}, area: 'contacts', docs: [], page: 1,
    hasMore: false, loadingMore: false, contacts: [], nodes: [], contentError: '' },
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
      this.setData({ game, loading: false, nodes: render(game.body).nodes });
      wx.setNavigationBarTitle({ title: game.title });
      await this.loadArea();
      const contacts = await http.request(`/community/${encodeURIComponent(game.slug)}/contacts`, { required: true });
      const mapped = [];
      for (const contact of contacts) mapped.push({ name: contact.name, image: await files.localImage(contact.qr) });
      if (ticket === this._ticket) this.setData({ contacts: mapped });
    } catch (cause) { if (ticket === this._ticket) error(this, cause); }
  },
  async loadArea(more = false) {
    if (this.data.area === 'contacts') { this._areaTicket = (this._areaTicket || 0) + 1; this.setData({ loadingMore: false, hasMore: false, contentError: '' }); return; }
    const ticket = this._areaTicket = (this._areaTicket || 0) + 1;
    this.setData({ loadingMore: true, contentError: '' });
    try {
      const result = await cms.social(areas[this.data.area], { game: this.data.game.id, page: more ? this.data.page + 1 : 1,
        limit: this.data.area === 'showcase' ? 4 : 15,
        sort: '-createdAt' });
      const docs = [];
      for (const doc of result.docs) {
        const images = [];
        for (const image of (doc.images || [])) images.push({ source: await files.localImage(image.source), caption: image.caption });
        docs.push({ ...doc, collection: areas[this.data.area], dateText: format.date(doc.createdAt), localImages: images, videoSource: video.source(doc.videoURL), videoError: false });
      }
      if (ticket !== this._areaTicket) return;
      this.setData({ loadingMore: false, docs: more ? this.data.docs.concat(docs) : docs, page: result.page, hasMore: result.hasNextPage });
    } catch (cause) { if (ticket === this._areaTicket) this.setData({ loadingMore: false, contentError: cause.message }); }
  },
  area(event) { if (event.currentTarget.dataset.area !== 'contacts' && !areas[event.currentTarget.dataset.area]) return; this.setData({ area: event.currentTarget.dataset.area, docs: [], page: 1 }); this.loadArea(); },
  videoError(event) { const index = Number(event.currentTarget.dataset.index); this.setData({ [`docs[${index}].videoError`]: true }); },
  onShareAppMessage() { return { title: this.data.game.title || '紫荆游戏社群', path: `/pages/community/index?id=${this.data.game.id}&slug=${this.data.game.slug}` }; },
});
