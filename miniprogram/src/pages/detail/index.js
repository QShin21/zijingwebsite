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
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回', '‹ Back'], verified: ['已核验', 'Verified'], demo: ['演示资料', 'Demo'], start: ['开始', 'Starts'],
  eventInfo: ['活动信息', 'Event details'], eventStart: ['活动开始', 'Starts'], eventEnd: ['活动结束', 'Ends'], location: ['地点 / 方式', 'Location / format'],
  currentState: ['当前状态', 'Status'], registrationStart: ['报名开始', 'Sign-up opens'], registrationEnd: ['报名截止', 'Sign-up closes'],
  eventSignup: ['活动报名', 'Event sign-up'], signedUp: ['已提交报名，可查看本人回执。', 'Sign-up submitted. You can view your receipt.'],
  signupUnknown: ['报名状态尚未读取，进入报名页重新查询。', 'Sign-up status not loaded yet; open the sign-up page to check again.'],
  formOpensPrefix: ['问卷开放：', 'Form opens: '], formClosesPrefix: ['问卷截止：', 'Form closes: '],
  seating: ['活动选座', 'Seat selection'], seatWaiting: ['等待开放', 'Opening soon'], seatOpen: ['选座开放', 'Seat selection open'], seatClosed: ['选座关闭', 'Seat selection closed'], seatOff: ['未启用', 'Not enabled'],
  seatOpensPrefix: ['将于北京时间 ', 'Seat selection opens at '], seatOpensSuffix: [' 开放选座。', ' (Beijing time).'],
  myRequestPrefix: ['我的申请 · ', 'My request · '], seatSep: ['：', ': '], seatLoginPrefix: ['登录后', 'After signing in, you '], seatCanPrefix: ['可选 1–', 'can choose 1–'],
  seatHintSuffix: [' 个座位，提交手机号与活动参与凭证；审核通过后座位锁定。', ' seats and submit your phone number and proof of participation; seats lock once approved.'],
  seatHintCanPrefix: ['可选 1–', 'You can choose 1–'],
  seatClosedHint: ['选座已关闭，不再接收新的申请。', 'Seat selection is closed and no longer accepts requests.'],
  seatOffHint: ['本活动尚未开启选座，可在选座工作台开启。', 'Seat selection is not enabled yet; enable it in the seating workbench.'],
  viewMySeat: ['查看选座申请', 'View my seat request'], viewSeatMap: ['查看座位图', 'View seat map'], seatWorkbench: ['选座工作台', 'Seating workbench'],
  loginToJoin: ['登录参与活动', 'Sign in to take part'], participation: ['参与方式', 'How to take part'],
  qrFailed: ['报名二维码暂时无法显示，可重新加载内容或使用已公布的其他渠道。', 'The sign-up QR code cannot be shown. Reload, or use another published channel.'],
  reload: ['重新加载内容', 'Reload content'], contactPrefix: ['联系人：', 'Contact: '], channelCheckedPrefix: ['渠道核验时间：', 'Channel verified: '],
  externalLinkHint: ['复制外部报名链接后，可在浏览器打开。', 'Copy the external sign-up link to open it in a browser.'],
  copySource: ['复制公开证明来源', 'Copy public source'], coverFailed: ['封面暂时无法显示。', 'The cover cannot be shown.'],
  galleryImage: ['活动配图', 'Event image'], imageFailedReload: ['图片暂时无法显示，可重新加载内容。', 'The image cannot be shown. Reload the content.'],
  articleImage: ['文章配图', 'Article image'], teamLinks: ['队伍入口', 'Team links'], teamRecruitment: ['招新与本人队伍记录', 'Recruitment and my team records'],
  teamRecruitmentBody: ['查看选拔批次、本人申请与成员关系。', 'View trials, your applications and memberships.'],
  teamProfiles: ['公开简介与我的设置', 'Public profiles and my settings'], teamHonors: ['队伍荣誉档案', 'Team honors'],
  seasonRoster: ['赛季阵容', 'Season roster'], seasonRosterHint: ['历史公开阵容；当前成员关系请在本人队伍记录中查看。', 'Historical public roster; check current membership in your team records.'],
  positions: ['招募岗位', 'Open positions'], duties: ['职责', 'Duties'], requirements: ['要求', 'Requirements'], commitment: ['投入', 'Commitment'], arrangement: ['安排', 'Arrangement'],
  photos: ['照片', 'Photos'], previewImage: ['预览图片', 'Preview image'], imageFailed: ['图片暂时无法显示。', 'The image cannot be shown.'],
  video: ['视频', 'Video'], videoFailed: ['视频加载失败，请重试或复制链接。', 'The video failed to load. Retry or copy the link.'], copyVideo: ['复制视频链接', 'Copy video link'],
  seasonsHonors: ['赛季与荣誉', 'Seasons and honors'], honorWorkspace: ['该队荣誉投稿与审核', 'Team honor submissions and review'],
  viewReceipt: ['查看报名回执', 'View sign-up receipt'], checkSignup: ['查询报名状态', 'Check sign-up status'], fillSignup: ['查看并填写报名', 'View and sign up'],
  manageSignup: ['查看报名与问卷管理', 'View sign-ups and form management'], copyChannel: ['复制报名渠道', 'Copy sign-up channel'],
};
const socialCollections = ['community-posts', 'community-showcase'];
const seatLabels = { pending: ['待审核', 'Pending review'], confirmed: ['已确认', 'Confirmed'], rejected: ['已驳回', 'Rejected'] };
const seatLabel = value => { const parts = String(value).split('-'); return i18n.t(parts[0] + '排' + parts[1] + '座', 'Row ' + parts[0] + ' Seat ' + parts[1]); };
// Keep only what the detail entry renders: no proof ids, occupancy map or phone numbers in page data.
function seatSummary(info) {
  if (!info || !(info.enabled || info.mine || info.canReview)) return null;
  const mine = info.mine && seatLabels[info.mine.status]
    ? { status: info.mine.status, label: i18n.t(...seatLabels[info.mine.status]), seats: (info.mine.seats || []).map(seatLabel).join(i18n.t('、', ', ')) } : null;
  const rows = Array.isArray(info.rows) ? info.rows : [];
  const total = rows.reduce((sum, row) => sum + (Number(row && row.count) || 0), 0);
  return { enabled: Boolean(info.enabled), open: Boolean(info.open), scheduled: Boolean(info.scheduled), openingLabel: info.opensAt ? format.date(info.opensAt) : '', loggedIn: Boolean(info.loggedIn), canReview: Boolean(info.canReview), mine,
    layout: rows.length && total ? i18n.t(rows.length + ' 排 · ' + total + ' 座', rows.length + ' rows · ' + total + ' seats') : '', limit: Number(info.seatLimit) || 10 };
}
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, collection: '', doc: {}, nodes: [], links: [], photos: [],
    related: [], previewImages: [], presentation: null, registration: '', registrationText: '', signupStateText: '', seatInfo: null, coverImage: null, coverImageFailed: false, qr: null, qrFailed: false, videoSource: '', reading: {} },
  ...actions,
  onLoad(options) {
    i18n.bind(this, text);
    this._options = options; this._hidden = false; this._unloaded = false;
    this.setData({ collection: options.collection });
    this._unsubscribe = session.subscribe(user => {
      if (String(user && user.id) === String(this._userId)) return;
      this._ticket = (this._ticket || 0) + 1;
      this.setData({ loading: false, error: '', doc: {}, reading: {}, nodes: [], links: [], photos: [], previewImages: [], presentation: null, signupInfo: null, seatInfo: null, related: [], coverImage: null, coverImageFailed: false, qr: null, qrFailed: false, videoSource: '', videoError: false, registration: '', signupFailed: false, needsLogin: !user, registrationText: '', signupStateText: '' });
    });
  },
  onShow() { this._hidden = false; this.load(); },
  onHide() { this._hidden = true; this._ticket = (this._ticket || 0) + 1; },
  onUnload() { this._unloaded = true; this.onHide(); if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
  onLocaleChange() { if (!this._hidden && !this._unloaded) this.load(); },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const user = session.user(); this._userId = user && user.id;
    this.setData({ loading: true, error: '', needsLogin: false, user, signupInfo: null, seatInfo: null, signupFailed: false, signupStartText: '', signupEndText: '', doc: {}, reading: {}, photos: [], nodes: [], links: [], related: [], previewImages: [], presentation: null, coverImage: null, coverImageFailed: false, qr: null, qrFailed: false, videoSource: '', videoError: false, registration: '', registrationText: '', signupStateText: '' });
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
      this.setData({ registrationText: i18n.message(this.data.registration) });
      wx.setNavigationBarTitle({ title: doc.title || i18n.t('内容详情', 'Details') });
      if (collection === 'events' || (collection === 'community-posts' && doc.category === 'event')) {
        // Seat entry (public occupancy + own status only). Independent of the signup read; a
        // failure stays quiet so the detail page never blocks on seating.
        if (collection === 'events' || user) http.request('/api/activities/' + collection + '/' + doc.id + '/seating', { raw: true })
          .then(info => { if (ticket === this._ticket) this.setData({ seatInfo: seatSummary(info) }); })
          .catch(() => { /* Seating is optional on this page; the seating page reports errors. */ });
        try { const signupInfo = await http.request('/api/activities/'+collection+'/'+doc.id+'/signup', { questionnaire: true }); if(ticket===this._ticket)this.setData({signupInfo,signupStateText:i18n.message(signupInfo.state||''),registration:signupInfo.form.enabled?'':this.data.registration,registrationText:signupInfo.form.enabled?'':this.data.registrationText,
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
    navigation.copy(this.data.doc.registrationURL || this.data.doc.channelText || '', i18n.t('报名渠道已复制', 'Sign-up channel copied'));
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
  onShareAppMessage() { return { title: this.data.doc.title || i18n.t('竞在紫荆', 'Zijing Esports'), path: `/pages/detail/index?collection=${this.data.collection}&id=${this.data.doc.id}` }; },
}));
