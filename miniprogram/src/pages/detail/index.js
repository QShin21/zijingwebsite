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
const images = require('../../lib/v2-images');
const { actions, error } = require('../../lib/page');
const socialCollections = ['community-posts', 'community-showcase'];
const seatLabels = { pending: '待审核', confirmed: '已确认', rejected: '已驳回' };
const seatLabel = value => { const parts = String(value).split('-'); return parts[0] + '排' + parts[1] + '座'; };
// Keep only what the detail entry renders: no proof ids, occupancy map or phone numbers in page data.
function seatSummary(info) {
  if (!info || !(info.enabled || info.mine || info.canReview)) return null;
  const mine = info.mine && seatLabels[info.mine.status]
    ? { status: info.mine.status, label: seatLabels[info.mine.status], seats: (info.mine.seats || []).map(seatLabel).join('、') } : null;
  const rows = Array.isArray(info.rows) ? info.rows : [];
  const total = rows.reduce((sum, row) => sum + (Number(row && row.count) || 0), 0);
  return { enabled: Boolean(info.enabled), open: Boolean(info.open), scheduled: Boolean(info.scheduled), openingLabel: info.opensAt ? format.date(info.opensAt) : '', loggedIn: Boolean(info.loggedIn), canReview: Boolean(info.canReview), mine,
    layout: rows.length && total ? rows.length + ' 排 · ' + total + ' 座' : '', limit: Number(info.seatLimit) || 10 };
}
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, collection: '', doc: {}, nodes: [], links: [], photos: [],
    related: [], previewImages: [], presentation: null, registration: '', seatInfo: null, coverImage: null, coverImageFailed: false, qr: null, qrFailed: false, videoSource: '', reading: {} },
  ...actions,
  onLoad(options) {
    this._options = options; this._hidden = false; this._unloaded = false;
    this.setData({ collection: options.collection });
    this._unsubscribe = session.subscribe(user => {
      if (String(user && user.id) === String(this._userId)) return;
      this._ticket = (this._ticket || 0) + 1;
      this.setData({ loading: false, error: '', doc: {}, reading: {}, nodes: [], links: [], photos: [], previewImages: [], presentation: null, signupInfo: null, seatInfo: null, related: [], coverImage: null, coverImageFailed: false, qr: null, qrFailed: false, videoSource: '', videoError: false, registration: '', signupFailed: false, needsLogin: !user });
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
    this.setData({ loading: true, error: '', needsLogin: false, user, signupInfo: null, seatInfo: null, signupFailed: false, signupStartText: '', signupEndText: '', doc: {}, reading: {}, photos: [], nodes: [], links: [], related: [], previewImages: [], presentation: null, coverImage: null, coverImageFailed: false, qr: null, qrFailed: false, videoSource: '', videoError: false, registration: '' });
    try {
      const { collection, id, slug, category } = this._options;
      const social = socialCollections.includes(collection);
      const scoped = ['events', 'announcements', 'community-posts'].includes(collection);
      const detail = scoped ? await cms.publishedDetail(collection, id, slug, category) : null;
      const doc = detail ? detail.doc : social ? await cms.socialDetail(collection, id) : await cms.detail(collection, id, slug);
      const layout = detail?.presentation || (detail?.images?.length ? { mode: 'gallery', blocks: [] } : null);
      const coverPromise = detail ? images.media(detail.cover) : cms.media(doc.cover);
      const qrPromise = detail ? images.media(detail.qr) : cms.media(doc.qrCode);
      let presentation = null;
      if (layout) {
        const refs = layout.mode === 'article' ? layout.blocks.filter(block => block.type === 'image').map(block => block.image) : detail.images;
        const entries = await Promise.all([...new Set(refs.map(image => image.src))].map(async src => [src, await images.load(src)]));
        const urls = Object.fromEntries(entries);
        presentation = { mode: layout.mode, ticket, images: (detail.images || []).map((image, index) => ({ index, url: urls[image.src] || '', alt: image.alt || '' })),
          blocks: (layout.blocks || []).map((block, index) => block.type === 'image' ? { index, type: 'image', url: urls[block.image.src] || '', alt: block.image.alt || '' } : { ...block, index }) };
      }
      const rendered = typeof doc.body === 'object' ? render(doc.body) : { nodes: [], links: [] };
      const coverImage = await coverPromise;
      const photos = [];
      for (const image of (doc.images || [])) {
        const url = await files.localImage(image.source);
        if (url) photos.push({ url, caption: image.caption || '' });
      }
      for (const photo of (doc.photos || [])) {
        const image = await cms.media(photo.image);
        if (image) photos.push({ ...image, caption: photo.caption || '' });
      }
      const qr = await qrPromise;
      let related = [];
      if (collection === 'teams') {
        const [seasons, honors] = await Promise.all([cms.list('seasons', { team: doc.id }), cms.list('honors', { team: doc.id })]);
        related = [...seasons.docs, ...honors.docs].map(reading.entry);
      }
      if (ticket !== this._ticket) return;
      const article = reading.article(doc, collection);
      this.setData({ loading: false, doc, social, presentation, reading: article, nodes: reading.prose(rendered.nodes), links: rendered.links, photos, qr, coverImage,
        previewImages: photos.map(photo => photo.url), related, dateText: article.dateText,
        endDateText: doc.endAt ? format.date(doc.endAt) : '',
        registrationStartText: doc.registrationStart ? format.date(doc.registrationStart) : '', registrationEndText: doc.registrationEnd ? format.date(doc.registrationEnd) : '',
        videoSource: video.source(doc.videoURL), videoError: false,
        registration: ['events', 'recruitment'].includes(collection) ? format.registrationState(doc) : '' });
      wx.setNavigationBarTitle({ title: doc.title || '内容详情' });
      if (collection === 'events' || (collection === 'community-posts' && doc.category === 'event')) {
        // Seat entry (public occupancy + own status only). Independent of the signup read; a
        // failure stays quiet so the detail page never blocks on seating.
        if (collection === 'events' || user) http.request('/api/activities/' + collection + '/' + doc.id + '/seating', { raw: true })
          .then(info => { if (ticket === this._ticket) this.setData({ seatInfo: seatSummary(info) }); })
          .catch(() => { /* Seating is optional on this page; the seating page reports errors. */ });
        try { const signupInfo = await http.request('/api/activities/'+collection+'/'+doc.id+'/signup', { questionnaire: true }); if(ticket===this._ticket)this.setData({signupInfo,registration:signupInfo.form.enabled?'':this.data.registration,
          signupStartText: signupInfo.form.start ? format.date(signupInfo.form.start) : '', signupEndText: signupInfo.form.end ? format.date(signupInfo.form.end) : ''}); }
        catch { if(ticket===this._ticket)this.setData({signupFailed:true}); }
      }
    } catch (cause) { if (ticket === this._ticket) error(this, cause); }
  },
  signup() { if(navigation.requireUser())navigation.go('signup',{kind:this.data.collection,id:this.data.doc.id}); },
  seating(event) {
    const mode = event.currentTarget.dataset.mode === 'review' ? 'review' : undefined;
    const id = this.data.doc.id;
    if (!this.data.seatInfo || !/^[1-9]\d*$/.test(String(id))) return;
    if (mode === 'review' && (!this.data.seatInfo.canReview || !navigation.requireUser())) return;
    navigation.go('activity-seating', { kind: this.data.collection, id, mode });
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
    else if (role === 'publication-gallery' || role === 'publication-article') {
      const presentation = this.data.presentation;
      const mode = role === 'publication-gallery' ? 'gallery' : 'article';
      const field = mode === 'gallery' ? 'images' : 'blocks';
      const position = Number(index);
      const ticket = Number(event.currentTarget.dataset.ticket);
      if (!presentation || presentation.mode !== mode || ticket !== this._ticket || ticket !== presentation.ticket ||
          !Number.isInteger(position) || position < 0 || !presentation[field][position] ||
          (mode === 'article' && presentation[field][position].type !== 'image') || presentation[field][position].url !== url) return;
      const updated = presentation[field].map((item, itemIndex) => itemIndex === position ? { ...item, failed: true } : item);
      this.setData({ presentation: { ...presentation, [field]: updated } });
    }
  },
  nativeCoverError(event) {
    if (this._hidden || this._unloaded) return;
    const related = require('../../lib/native-presentation').markCoverFailure(this.data.related, event.currentTarget.dataset);
    if (related !== this.data.related) this.setData({ related });
  },
  videoError() { this.setData({ videoError: true }); },
  onShareAppMessage() { return { title: this.data.doc.title || '竞在紫荆', path: `/pages/detail/index?collection=${this.data.collection}&id=${this.data.doc.id}` }; },
}));
