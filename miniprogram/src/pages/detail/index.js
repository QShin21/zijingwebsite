function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const http = require('../../lib/http');
const cms = require('../../lib/cms');
const session = require('../../lib/session');
const { render } = require('../../lib/richtext');
const format = require('../../lib/format');
const navigation = require('../../lib/navigation');
const files = require('../../lib/files');
const video = require('../../lib/video');
const reading = require('../../lib/native-reading');
const { actions, error } = require('../../lib/page');
const socialCollections = ['community-posts', 'community-showcase'];
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, collection: '', doc: {}, nodes: [], links: [], photos: [],
    related: [], previewImages: [], registration: '', seatInfo: null, coverImage: null, coverImageFailed: false, qr: null, qrFailed: false, videoSource: '', reading: {} },
  ...actions,
  onLoad(options) {
    this._options = options; this._hidden = false; this._unloaded = false;
    this.setData({ collection: options.collection });
    this._unsubscribe = session.subscribe(user => {
      if (String(user && user.id) === String(this._userId)) return;
      this._ticket = (this._ticket || 0) + 1;
      this.setData({ loading: false, error: '', doc: {}, reading: {}, nodes: [], links: [], photos: [], previewImages: [], signupInfo: null, seatInfo: null, related: [], coverImage: null, coverImageFailed: false, qr: null, qrFailed: false, videoSource: '', videoError: false, registration: '', signupFailed: false, needsLogin: !user });
    });
  },
  onShow() { this._hidden = false; this.load(); },
  onHide() { this._hidden = true; this._ticket = (this._ticket || 0) + 1; },
  onUnload() { this._unloaded = true; this.onHide(); if (this._unsubscribe) this._unsubscribe(); },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const user = session.user(); this._userId = user && user.id;
    this.setData({ loading: true, error: '', needsLogin: false, user, signupInfo: null, seatInfo: null, signupFailed: false, signupStartText: '', signupEndText: '', doc: {}, reading: {}, photos: [], nodes: [], links: [], related: [], previewImages: [], coverImage: null, coverImageFailed: false, qr: null, qrFailed: false, videoSource: '', videoError: false, registration: '' });
    try {
      const { collection, id, slug } = this._options;
      const social = socialCollections.includes(collection);
      const doc = social ? await cms.socialDetail(collection, id) : await cms.detail(collection, id, slug);
      const rendered = typeof doc.body === 'object' ? render(doc.body) : { nodes: [], links: [] };
      const coverImage = await cms.media(doc.cover);
      const photos = [];
      for (const image of (doc.images || [])) {
        const url = await files.localImage(image.source);
        if (url) photos.push({ url, caption: image.caption || '' });
      }
      for (const photo of (doc.photos || [])) {
        const image = await cms.media(photo.image);
        if (image) photos.push({ ...image, caption: photo.caption || '' });
      }
      const qr = await cms.media(doc.qrCode);
      let related = [];
      if (collection === 'teams') {
        const [seasons, honors] = await Promise.all([cms.list('seasons', { team: doc.id }), cms.list('honors', { team: doc.id })]);
        related = [...seasons.docs, ...honors.docs].map(reading.entry);
      }
      if (ticket !== this._ticket) return;
      const article = reading.article(doc, collection);
      this.setData({ loading: false, doc, social, reading: article, nodes: reading.prose(rendered.nodes), links: rendered.links, photos, qr, coverImage,
        previewImages: photos.map(photo => photo.url), related, dateText: article.dateText,
        endDateText: doc.endAt ? format.date(doc.endAt) : '',
        registrationStartText: doc.registrationStart ? format.date(doc.registrationStart) : '', registrationEndText: doc.registrationEnd ? format.date(doc.registrationEnd) : '',
        videoSource: video.source(doc.videoURL), videoError: false,
        registration: ['events', 'recruitment'].includes(collection) ? format.registrationState(doc) : '' });
      wx.setNavigationBarTitle({ title: doc.title || '内容详情' });
      if (collection === 'events' || (collection === 'community-posts' && doc.category === 'event')) {
        void http.request('/api/activities/'+collection+'/'+doc.id+'/seating', { raw: true })
          .then(seatInfo => { if (ticket === this._ticket) this.setData({ seatInfo }); })
          .catch(() => {});
        try { const signupInfo = await http.request('/api/activities/'+collection+'/'+doc.id+'/signup'); if(ticket===this._ticket)this.setData({signupInfo,registration:signupInfo.form.enabled?'':this.data.registration,
          signupStartText: signupInfo.form.start ? format.date(signupInfo.form.start) : '', signupEndText: signupInfo.form.end ? format.date(signupInfo.form.end) : ''}); }
        catch { if(ticket===this._ticket)this.setData({signupFailed:true}); }
      }
    } catch (cause) { if (ticket === this._ticket) error(this, cause); }
  },
  signup() { if(navigation.requireUser())navigation.go('signup',{kind:this.data.collection,id:this.data.doc.id}); },
  seating(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode === 'review' && !navigation.requireUser()) return;
    navigation.go('activity-seating', { kind: this.data.collection, id: this.data.doc.id, mode });
  },
  teamPage(event) {
    const page = event.currentTarget.dataset.page, id = this.data.doc.id;
    if (this.data.collection === 'teams' && ['team-profiles', 'team-honors', 'team-honor-workspace'].includes(page) && /^[1-9]\d*$/.test(String(id)))
      navigation.go(page, { team: id });
  },
  register() {
    if (this.data.registration !== '报名开放') return;
    navigation.copy(this.data.doc.registrationURL || this.data.doc.channelText || '', '报名渠道已复制');
  },
  readingImageError(event) {
    if (this._hidden || this._unloaded || this.data.loading || this.data.needsLogin) return;
    const { role, url, index } = event.currentTarget.dataset;
    if (role === 'cover' && this.data.coverImage && this.data.coverImage.url === url) this.setData({ coverImageFailed: true });
    else if (role === 'qr' && this.data.qr && this.data.qr.url === url) this.setData({ qrFailed: true });
    else if (role === 'photo' && this.data.photos[index] && this.data.photos[index].url === url)
      this.setData({ photos: this.data.photos.map((photo, photoIndex) => photoIndex === Number(index) ? { ...photo, failed: true } : photo) });
  },
  nativeCoverError(event) {
    if (this._hidden || this._unloaded) return;
    const related = require('../../lib/native-presentation').markCoverFailure(this.data.related, event.currentTarget.dataset);
    if (related !== this.data.related) this.setData({ related });
  },
  videoError() { this.setData({ videoError: true }); },
  onShareAppMessage() { return { title: this.data.doc.title || '竞在紫荆', path: `/pages/detail/index?collection=${this.data.collection}&id=${this.data.doc.id}` }; },
}));
