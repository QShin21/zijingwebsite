const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const { render } = require('../../lib/richtext');
const format = require('../../lib/format');
const navigation = require('../../lib/navigation');
const { actions, error } = require('../../lib/page');
const socialCollections = ['forum-posts', 'community-posts'];
const commentCollections = ['events', 'announcements', 'news', 'albums', ...socialCollections];
Page({
  data: { loading: true, error: '', needsLogin: false, collection: '', doc: {}, nodes: [], links: [], photos: [],
    comments: [], comment: '', replyTo: 0, replyName: '', commentError: '', commentBusy: false, user: null,
    canComment: false, reactions: null, related: [], managed: false, previewImages: [], registration: '', coverImage: null },
  ...actions,
  onLoad(options) { this._options = options; this.setData({ collection: options.collection }); },
  onShow() { this.load(); },
  onHide() { this._ticket = (this._ticket || 0) + 1; },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    this.setData({ loading: true, error: '', needsLogin: false, user: session.user() });
    try {
      const { collection, id, slug } = this._options;
      const social = socialCollections.includes(collection);
      const doc = social ? await cms.socialDetail(collection, id) : await cms.detail(collection, id, slug);
      const rendered = typeof doc.body === 'object' ? render(doc.body) : { nodes: [], links: [] };
      const coverImage = await cms.media(doc.cover);
      const photos = [];
      for (const photo of (doc.photos || [])) {
        const image = await cms.media(photo.image);
        if (image) photos.push({ ...image, caption: photo.caption || '' });
      }
      const qr = await cms.media(doc.qrCode);
      let related = [];
      if (collection === 'teams') {
        const [seasons, honors] = await Promise.all([cms.list('seasons', { team: doc.id }), cms.list('honors', { team: doc.id })]);
        related = [...seasons.docs, ...honors.docs];
      }
      if (ticket !== this._ticket) return;
      this.setData({ loading: false, doc, social, nodes: rendered.nodes, links: rendered.links, photos, qr, coverImage,
        previewImages: photos.map(photo => photo.url), related, dateText: format.date(doc.startAt || doc.date || doc.createdAt),
        endDateText: doc.endAt ? format.date(doc.endAt) : '', managed: social && session.manages(doc.game),
        registration: ['events', 'recruitment'].includes(collection) ? format.registrationState(doc) : '',
        canComment: commentCollections.includes(collection) });
      wx.setNavigationBarTitle({ title: doc.title || '内容详情' });
      if (session.user() && commentCollections.includes(collection)) await this.loadComments();
      if (session.user() && social) await this.loadReactions();
    } catch (cause) { if (ticket === this._ticket) error(this, cause); }
  },
  async loadComments() {
    try {
      const result = await cms.social('comments', { targetType: this.data.collection, targetId: this.data.doc.id, limit: 50, sort: 'createdAt' });
      this.setData({ comments: result.docs.map(comment => ({ ...comment, dateText: format.date(comment.createdAt) })),
        commentsMore: result.hasNextPage, commentPage: 1 });
    } catch (cause) { this.setData({ commentError: cause.message }); }
  },
  async moreComments() {
    if (this.data.commentBusy) return;
    this.setData({ commentBusy: true });
    try {
      const result = await cms.social('comments', { targetType: this.data.collection, targetId: this.data.doc.id,
        limit: 50, sort: 'createdAt', page: this.data.commentPage + 1 });
      this.setData({ comments: this.data.comments.concat(result.docs.map(comment => ({ ...comment, dateText: format.date(comment.createdAt) }))),
        commentsMore: result.hasNextPage, commentPage: result.page });
    } catch (cause) { this.setData({ commentError: cause.message }); }
    finally { this.setData({ commentBusy: false }); }
  },
  commentInput(event) { this.setData({ comment: event.detail.value }); },
  reply(event) { this.setData({ replyTo: event.currentTarget.dataset.id, replyName: event.currentTarget.dataset.name }); },
  cancelReply() { this.setData({ replyTo: 0, replyName: '' }); },
  async sendComment() {
    if (!navigation.requireUser() || this.data.commentBusy || !this.data.comment.trim()) return;
    this.setData({ commentBusy: true, commentError: '' });
    try {
      await http.request('/api/comments', { method: 'POST', required: true, data: {
        targetType: this.data.collection, targetId: this.data.doc.id, body: this.data.comment.trim(),
        author: session.user().id, ...(this.data.replyTo ? { parent: this.data.replyTo } : {}) } });
      this.setData({ comment: '', replyTo: 0, replyName: '' }); await this.loadComments();
    } catch (cause) { this.setData({ commentError: cause.message }); }
    finally { this.setData({ commentBusy: false }); }
  },
  async loadReactions() {
    try { const result = await http.request(`/api/miniapp/reactions?${cms.query({ targetType: this.data.collection, targetId: this.data.doc.id })}`, { required: true }); this.setData({ reactions: result }); }
    catch { this.setData({ reactions: null }); }
  },
  async react(event) {
    if (!navigation.requireUser() || this._reacting) return;
    this._reacting = true;
    try { await http.request('/api/miniapp/reactions/toggle', { method: 'POST', required: true,
      data: { targetType: this.data.collection, targetId: this.data.doc.id, kind: event.currentTarget.dataset.kind } }); await this.loadReactions(); }
    catch (cause) { wx.showToast({ title: cause.message, icon: 'none' }); }
    finally { this._reacting = false; }
  },
  async moderate(event) {
    if (!this.data.managed) return;
    const field = event.currentTarget.dataset.field;
    const approved = await new Promise(resolve => wx.showModal({ title: '管理内容', content: field === 'status' ? '确认隐藏这条内容？' : '确认修改这条帖子的标记？', success: resolve }));
    if (!approved.confirm) return;
    try {
      await http.request(`/api/${this.data.collection}/${this.data.doc.id}`, { method: 'PATCH', required: true,
        data: { [field]: field === 'status' ? 'hidden' : !this.data.doc[field] } });
      if (field === 'status') wx.navigateBack(); else this.load();
    } catch (cause) { wx.showToast({ title: cause.message, icon: 'none' }); }
  },
  register() {
    if (this.data.registration !== '报名开放') return;
    navigation.copy(this.data.doc.registrationURL || this.data.doc.channelText || '', '报名渠道已复制');
  },
  onShareAppMessage() { return { title: this.data.doc.title || '紫荆电竞社', path: `/pages/detail/index?collection=${this.data.collection}&id=${this.data.doc.id}` }; },
});
