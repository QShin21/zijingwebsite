const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const stream = require('../../lib/stream');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
Page({
  data: { slug: '', game: 0, title: '', messages: [], body: '', image: '', status: '正在连接', error: '', busy: false,
    loading: false, hasMore: false, scrollInto: '', managed: false, needsLogin: false,
    showStickers: false, stickerQuery: '', stickers: [], stickerLoading: false },
  ...actions,
  onLoad(options) { this.setData({ slug: options.slug, game: Number(options.id), title: options.title || '社群聊天' }); wx.setNavigationBarTitle({ title: options.title || '社群聊天' }); },
  async onShow() {
    if (!protect(this)) return;
    this._active = true; this._generation = (this._generation || 0) + 1;
    this.setData({ managed: session.manages(this.data.game), error: '' });
    await this.sync(true);
    if (this._active && session.user()) this._stop = stream.subscribe(this.data.slug, () => this.sync(), value => this.setData({ status: value }));
  },
  onHide() { this.stop(); },
  onUnload() { this.stop(); },
  stop() { this._active = false; this._generation = (this._generation || 0) + 1; if (this._stop) this._stop(); this._stop = null; },
  retry() { this.sync(true); },
  onPullDownRefresh() { this.sync().finally(() => wx.stopPullDownRefresh()); },
  async sync(initial = false, older = false) {
    if (this._syncing) { if (!older) this._pending = true; return; }
    const generation = this._generation;
    this._syncing = true; this.setData({ loading: true });
    try {
      const current = this.data.messages;
      const values = { known: current.map(message => message.id).slice(-1000).join(',') };
      if (older && current.length) values.before = current[0].id;
      else if (!initial && current.length) values.after = current[current.length - 1].id;
      const result = await http.request(`/community/${encodeURIComponent(this.data.slug)}/chat/feed?${cms.query(values)}`, { required: true });
      const incoming = [];
      for (const message of result.messages || []) {
        let localImage = '';
        if (message.image) localImage = await http.download(message.image).catch(() => '');
        incoming.push({ ...message, localImage, dateText: format.date(message.createdAt) });
      }
      if (!this._active || generation !== this._generation) return;
      const messages = stream.merge(initial ? [] : current, incoming, result.removed || []);
      this.setData({ messages, error: '', ...(initial || older ? { hasMore: Boolean(result.hasMore) } : {}),
        ...(!older && messages.length ? { scrollInto: `message-${messages[messages.length - 1].id}` } : {}) });
      if (!initial && !older && result.hasMore && incoming.length) this._pending = true;
      if (messages.length >= 1000) this.setData({ hasMore: false });
    } catch (cause) { if (this._active) this.setData({ error: cause.message }); }
    finally {
      this._syncing = false;
      if (this._active) this.setData({ loading: false });
      if (this._pending && this._active) { this._pending = false; this.sync(); }
    }
  },
  history() { this.sync(false, true); },
  input(event) { this.setData({ body: event.detail.value }); },
  async chooseImage() {
    try { const paths = await files.choose(); const image = await files.readImage(paths[0], 8 * 1024 * 1024); this._imageData = image; this.setData({ image: paths[0] }); }
    catch (cause) { this.setData({ error: cause.message }); }
  },
  removeImage() { this._imageData = ''; this.setData({ image: '' }); },
  toggleStickers() { this.setData({ showStickers: !this.data.showStickers }); },
  stickerInput(event) { this.setData({ stickerQuery: event.detail.value }); },
  async searchStickers() {
    if (this.data.stickerLoading || !this.data.stickerQuery.trim()) return;
    this.setData({ stickerLoading: true, error: '', stickers: [] });
    try {
      const result = await http.request(`/community/stickers?q=${encodeURIComponent(this.data.stickerQuery.trim())}`, { required: true });
      const stickers = [];
      for (const url of (result.images || []).slice(0, 24)) {
        const path = `/community/stickers?image=${encodeURIComponent(url)}`;
        const image = await http.download(path + '&preview=1').catch(() => '');
        if (image) stickers.push({ url, image });
      }
      this.setData({ stickers });
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ stickerLoading: false }); }
  },
  async chooseSticker(event) {
    try {
      const selected = event.currentTarget.dataset.sticker;
      const result = await http.request(`/community/stickers?image=${encodeURIComponent(selected.url)}`, { required: true });
      this._imageData = result.image;
      this.setData({ image: selected.image, showStickers: false, error: '' });
    } catch (cause) { this.setData({ error: cause.message }); }
  },
  async send() {
    if (this.data.busy || (!this.data.body.trim() && !this._imageData) || !session.user()) return;
    this.setData({ busy: true, error: '' });
    try {
      await http.request('/api/community-messages', { method: 'POST', required: true, data: {
        game: this.data.game, body: this.data.body.trim(), author: session.user().id, ...(this._imageData ? { image: this._imageData } : {}) } });
      this._imageData = ''; this.setData({ body: '', image: '' }); await this.sync();
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
  async manageMessage(event) {
    if (!this.data.managed) return;
    const message = event.currentTarget.dataset.message;
    const choice = await new Promise(resolve => wx.showActionSheet({ itemList: ['隐藏这条消息', '禁言该成员'], success: resolve, fail() { resolve(null); } }));
    if (!choice) return;
    try {
      if (choice.tapIndex === 0) await http.request(`/api/community-messages/${message.id}`, { required: true, method: 'PATCH', data: { status: 'hidden' } });
      else {
        const result = await new Promise(resolve => wx.showModal({ title: '禁言成员', content: '请填写禁言原因', editable: true, placeholderText: '原因（最多 300 字）', success: resolve }));
        if (!result.confirm) return;
        await http.request('/api/community-bans', { required: true, method: 'POST', data: { game: this.data.game, member: message.member, reason: (result.content || '').slice(0, 300), active: true } });
      }
      await this.sync();
    } catch (cause) { this.setData({ error: cause.message }); }
  },
});
