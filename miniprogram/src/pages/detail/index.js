const http = require('../../lib/http');
const cms = require('../../lib/cms');
const session = require('../../lib/session');
const { render } = require('../../lib/richtext');
const format = require('../../lib/format');
const navigation = require('../../lib/navigation');
const { actions, error } = require('../../lib/page');
const socialCollections = ['community-posts'];
Page({
  data: { loading: true, error: '', needsLogin: false, collection: '', doc: {}, nodes: [], links: [], photos: [],
    related: [], previewImages: [], registration: '', coverImage: null },
  ...actions,
  onLoad(options) { this._options = options; this.setData({ collection: options.collection }); },
  onShow() { this.load(); },
  onHide() { this._ticket = (this._ticket || 0) + 1; },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    this.setData({ loading: true, error: '', needsLogin: false, user: session.user(), signupInfo: null, signupFailed: false });
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
        endDateText: doc.endAt ? format.date(doc.endAt) : '',
        registration: ['events', 'recruitment'].includes(collection) ? format.registrationState(doc) : '' });
      wx.setNavigationBarTitle({ title: doc.title || '内容详情' });
      if (collection === 'events' || (collection === 'community-posts' && doc.category === 'event')) {
        try { const signupInfo = await http.request('/api/activities/'+collection+'/'+doc.id+'/signup'); if(ticket===this._ticket)this.setData({signupInfo,registration:signupInfo.form.enabled?'':this.data.registration}); }
        catch { if(ticket===this._ticket)this.setData({signupFailed:true}); }
      }
    } catch (cause) { if (ticket === this._ticket) error(this, cause); }
  },
  signup() { if(navigation.requireUser())navigation.go('signup',{kind:this.data.collection,id:this.data.doc.id}); },
  register() {
    if (this.data.registration !== '报名开放') return;
    navigation.copy(this.data.doc.registrationURL || this.data.doc.channelText || '', '报名渠道已复制');
  },
  onShareAppMessage() { return { title: this.data.doc.title || '竞在紫荆', path: `/pages/detail/index?collection=${this.data.collection}&id=${this.data.doc.id}` }; },
});
