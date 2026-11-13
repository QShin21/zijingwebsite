function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const http = require('../../lib/http');
const v2 = require('../../lib/v2');
const images = require('../../lib/v2-images');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const files = require('../../lib/files');
const format = require('../../lib/format');
const { render } = require('../../lib/richtext');
const { actions, protect } = require('../../lib/page');
const video = require('../../lib/video');
const { hasContactImage } = require('../../lib/native-presentation');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回', '‹ Back'], crestFallback: ['紫', 'Z'], kicker: ['游戏社群', 'Game community'],
  readingContacts: ['正在读取名片', 'Loading contact cards'], retryContacts: ['重试管理员名片', 'Retry admin cards'], contactAdmins: ['联系管理员', 'Contact admins'],
  refreshContacts: ['刷新管理员名片', 'Refresh admin cards'], introClose: ['收起社群介绍', 'Hide introduction'], introOpen: ['完整社群介绍', 'Full introduction'],
  contactsErrorNote: ['暂时无法读取联系方式，重试后再联系管理员。', 'Contact details could not be loaded. Retry before contacting an admin.'],
  contactsImageNote: ['名片图片暂不可用，请刷新后联系管理员。', 'Card images are unavailable. Refresh, then contact an admin.'],
  contactsNoneNote: ['暂无授权名片，当前没有可展示的联系方式。可稍后刷新。', 'No authorized cards yet, so there is no contact to show. Refresh later.'],
  intro: ['社群介绍', 'Introduction'], selectedSuffix: ['，已选择', ', selected'], updates: ['活动与通知', 'Events & notices'], showcase: ['社群风采', 'Showcase'],
  contactsHint: ['微信名片由在任管理员本人授权展示。点按预览，按微信提供的图片菜单操作。', 'WeChat cards are shown with each serving admin’s consent. Tap to preview and use WeChat’s image menu.'],
  refreshCards: ['刷新名片', 'Refresh cards'], readingAuthorizedCards: ['正在读取授权名片', 'Loading authorized cards'],
  noCardsTitle: ['暂无授权名片', 'No authorized cards'], noCardsBody: ['当前没有可展示的管理员联系方式。可稍后刷新，也可申请参与社群组织。', 'No admin contact can be shown right now. Refresh later, or apply to help run the community.'],
  adminAuthorized: ['在任管理员 · 已授权展示', 'Serving admin · display authorized'], previewPrefix: ['预览', 'Preview '], cardSuffix: ['的微信名片', '’s WeChat card'],
  cardFailed: ['名片图片加载失败，请刷新重试。', 'The card image failed to load. Refresh to retry.'], cardUnavailable: ['名片图片暂时无法显示，请刷新重试。', 'The card image cannot be shown. Refresh to retry.'],
  tapPreview: ['点按预览微信名片', 'Tap to preview the WeChat card'],
  addFriendHint: ['添加好友时，请备注昵称和游戏项目。由管理员人工邀请进群；查看或保存名片不代表已入群。', 'When adding a friend, note your nickname and game. Admins invite you to the group manually; viewing or saving a card does not mean you have joined.'],
  organizeTitle: ['参与组织这个社群', 'Help run this community'],
  organizeBody: ['申请和修改重提时，需要本人主动同意展示微信名片作为进群联系方式；默认不勾选，获批后仍可关闭展示。', 'When applying or resubmitting, you must opt in to show your WeChat card as the joining contact; it is off by default and can be turned off after approval.'],
  applyAdmin: ['申请社群管理员', 'Apply to be a community admin'], recentUpdates: ['社群近况', 'Recent updates'], sharedMoments: ['共同经历', 'Shared moments'], refresh: ['刷新', 'Refresh'],
  newShowcase: ['＋ 投稿风采', '＋ Submit a highlight'], teamHonors: ['代表队荣誉', 'Team honors'], refreshArchive: ['刷新档案', 'Refresh records'],
  honorsHint: ['社群风采中的置顶档案，按现有公开记录展示。', 'Pinned records in the showcase, based on existing public records.'],
  readingHonors: ['正在读取已核验档案…', 'Loading verified records…'], retryHonors: ['重试荣誉档案', 'Retry honor records'], itemsSuffix: [' 项', ' items'],
  noHonors: ['该社群暂无已公开的代表队荣誉。', 'This community has no public team honors yet.'], retryContent: ['重试社群内容', 'Retry community content'],
  readingContent: ['正在读取社群内容…', 'Loading community content…'], viewDetails: ['查看详情', 'View details'], andSignupSuffix: ['与报名', ' and sign up'],
  highlight: ['风采', 'Highlight'], previewImage: ['预览图片', 'Preview image'], photoFailed: ['这张图片暂时无法显示，可刷新社群内容重试。', 'This image cannot be shown. Refresh the community content to retry.'],
  videoFailed: ['视频暂时无法播放，请检查网络或使用下方链接。', 'The video cannot play. Check your network or use the link below.'],
  externalVideo: ['此内容使用外部视频页面，可复制链接到浏览器打开。', 'This uses an external video page; copy the link to open it in a browser.'], copyVideo: ['复制视频链接', 'Copy video link'],
  emptyTitle: ['该社群还没有公开内容', 'No public content yet'], emptyBody: ['新的活动、通知与风采发布后会出现在这里。', 'New events, notices and highlights will appear here.'], loadMore: ['加载更多', 'Load more'],
  playTogether: ['一起上场', 'Play together'], teamTrials: ['代表队选拔', 'Team trials'], teamRecruitment: ['代表队招新与本人记录', 'Team recruitment and my records'],
  teamRecruitmentBody: ['查看队伍选拔、入队申请及成员关系。', 'View trials, join applications and memberships.'], honorWorkspace: ['本社群荣誉投稿与审核', 'Community honor submissions and review'],
  staffTitle: ['社团骨干招新', 'Club staff recruitment'], staffHint: ['各社群入口使用同一批次申请与回执。', 'All community entries share the same batch applications and receipts.'],
  staffMore: ['批次与我的申请 ›', 'Batches and my applications ›'], staffKind: ['骨干招新', 'Staff recruitment'], recommended: ['社群推荐', 'Recommended'],
  readingClub: ['正在读取招新与推荐…', 'Loading recruitment and recommendations…'], retryClub: ['重试社团信息', 'Retry club info'],
};
const areas = { updates: 'community-posts', showcase: 'community-showcase' };
const identity = () => String((session.user() || {}).id || '');
// These five server-prepared defaults have a padded 512px transparent canvas.
const isDefaultIcon = src => typeof src === 'string' && /^\/api\/game-icons\/default\/(honor-of-kings|cs2|stardew-valley|eggy-party|league-of-legends)(?:\?.*)?$/.test(src);
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, game: {}, iconKey: '', iconIsDefault: false, img: {}, area: 'contacts', introOpen: false, docs: [], page: 1,
    hasMore: false, loadingMore: false, nodes: [], contentError: '', contacts: [], contactAvailable: false, contactsLoading: false, contactsError: '',
    clubLoading: false, clubError: '', staffBatches: [], promotions: [], honorPins: [], honorsLoading: false, honorsError: '' },
  ...actions,
  onLoad(options = {}) {
    i18n.bind(this, text);
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate(); this._options = options;
    this.setData({ area: options.area === 'showcase' || options.area === 'updates' ? options.area : 'contacts',
      showcaseParams: /^[a-z0-9-]{1,120}$/.test(String(options.slug || '')) ? { slug: String(options.slug) } : {} });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this._resumeRead = false; this.invalidate(); this.resetPrivate(); }
    });
  },
  invalidate() { this._scope = (this._scope || 0) + 1; },
  valid(scope) { return !this._disposed && this._visible !== false && scope === (this._scope || 0) && this._identity === identity() && Boolean(identity()); },
  resetPrivate() { this.setData({ needsLogin: !session.user(), loading: false, error: '', game: {}, iconKey: '', iconIsDefault: false, img: {}, introOpen: false, docs: [], nodes: [], page: 1,
    hasMore: false, loadingMore: false, contentError: '', contacts: [], contactAvailable: false, contactsLoading: false, contactsError: '',
    clubLoading: false, clubError: '', staffBatches: [], promotions: [], honorPins: [], honorsLoading: false, honorsError: '' }); },
  onShow() {
    if (!this.data.game || !this.data.game.title) i18n.navTitle('社群空间', 'Community');
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, loadingMore: false, contactsLoading: false, clubLoading: false, honorPins: [], honorsLoading: false, honorsError: '' }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
  onLocaleChange() { if (this._visible && !this._disposed) this.load(); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loadingMore) return this.loadArea(true); },
  async load() {
    if (this._disposed || this._visible === false) return;
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1;
    const current = () => this.valid(scope) && ticket === this._loadTicket;
    this.setData({ loading: true, error: '' });
    try {
      const options = this._options || {};
      const game = await cms.detail('games', options.id, options.slug);
      if (!current()) return;
      this.setData({ game, loading: false, nodes: render(game.body).nodes, iconKey: '', iconIsDefault: false, img: {} });
      wx.setNavigationBarTitle({ title: game.title });
      await Promise.all([
        this.loadIcon(game.slug, current), this.loadArea(), this.retryContacts(), this.retryClub(),
        this.data.area === 'showcase' ? this.loadHonorPins() : Promise.resolve(),
      ]);
    } catch (cause) { if (current()) this.setData({ loading: false, error: cause.message }); }
  },
  async loadIcon(slug, current) {
    if (!slug) return;
    let header;
    try {
      header = await v2.get('communities/' + encodeURIComponent(slug) + '/header', {}, { required: true });
    } catch { return; }
    if (!current()) return;
    const icon = { coverSrc: header?.card?.cover?.src };
    images.attach(this, [icon], current);
    this.setData({ iconKey: icon.coverKey || '', iconIsDefault: isDefaultIcon(icon.coverSrc) });
    // English: the community name and introduction come from the V2 read (cached English);
    // the REST record above stays the source for ids, slugs and everything else.
    if (i18n.locale() === 'en' && header?.card?.community?.title && this.data.game) {
      this.setData({ 'game.title': header.card.community.title, 'game.summary': header.card.summary || this.data.game.summary });
      wx.setNavigationBarTitle({ title: header.card.community.title });
      try {
        const detail = await v2.get('communities/' + encodeURIComponent(slug), {}, { required: true });
        if (current() && detail && detail.body) this.setData({ nodes: render(detail.body).nodes });
      } catch { /* The Chinese introduction stays. */ }
    }
  },
  async retryContacts() {
    if (this._disposed || this._visible === false) return;
    if (!identity() || !this.data.game.id || this.data.contactsLoading) return;
    const scope = this._scope || 0, game = this.data.game, ticket = this._contactsTicket = (this._contactsTicket || 0) + 1;
    this.setData({ contactsLoading: true, contactsError: '' });
    try {
      const contacts = await http.request(`/community/${encodeURIComponent(game.slug)}/contacts`, { required: true });
      if (!this.valid(scope) || ticket !== this._contactsTicket) return;
      if (!Array.isArray(contacts)) throw new Error(i18n.t('管理员名片暂不可用，请重试', 'Admin cards are unavailable. Please retry.'));
      const mapped = [];
      for (const contact of contacts) {
        const image = await files.localImage(contact.qr);
        if (!this.valid(scope) || ticket !== this._contactsTicket) return;
        mapped.push({ id: contact.id, name: contact.name, image });
      }
      if (this.valid(scope) && ticket === this._contactsTicket) this.setData({ contacts: mapped, contactAvailable: hasContactImage(mapped), contactsLoading: false });
    } catch (cause) { if (this.valid(scope) && ticket === this._contactsTicket) this.setData({ contactsLoading: false, contactsError: cause.message }); }
  },
  async retryClub() {
    if (this._disposed || this._visible === false) return;
    if (!identity() || this.data.clubLoading) return;
    const scope = this._scope || 0, ticket = this._clubTicket = (this._clubTicket || 0) + 1;
    this.setData({ clubLoading: true, clubError: '' });
    try {
      const result = await http.request('/api/miniapp/club', { auth: false });
      if (!this.valid(scope) || ticket !== this._clubTicket) return;
      const promotions = [];
      for (const kind of ['event', 'notice', 'showcase']) for (const doc of result.promotions && result.promotions[kind] || [])
        promotions.push({ ...doc, kindText: kind === 'event' ? i18n.t('社团活动', 'Club event') : kind === 'notice' ? i18n.t('社团通知', 'Club notice') : i18n.t('社团风采', 'Club showcase') });
      this.setData({ staffBatches: (result.staffBatches || []).map(batch => ({ ...batch, stateText: i18n.message(batch.state) })), promotions, clubLoading: false });
    } catch (cause) { if (this.valid(scope) && ticket === this._clubTicket) this.setData({ clubLoading: false, clubError: cause.message }); }
  },
  async loadArea(more = false) {
    if (this._disposed || this._visible === false) return;
    if (!identity() || !this.data.game.id || more && (this.data.loadingMore || !this.data.hasMore)) return;
    if (this.data.area === 'contacts') { this._areaTicket = (this._areaTicket || 0) + 1; this.setData({ loadingMore: false, hasMore: false, contentError: '' }); return; }
    const scope = this._scope || 0, ticket = this._areaTicket = (this._areaTicket || 0) + 1;
    const area = this.data.area, game = this.data.game.id, page = more ? this.data.page + 1 : 1;
    this.setData({ loadingMore: true, contentError: '' });
    try {
      const result = await cms.social(areas[area], { game, page, limit: area === 'showcase' ? 4 : 15, sort: '-createdAt' });
      if (!this.valid(scope) || ticket !== this._areaTicket) return;
      if (!result || !Array.isArray(result.docs)) throw new Error(i18n.t('社群内容暂不可用，请重试', 'Community content is unavailable. Please retry.'));
      // English mode: titles (and showcase text) from the same-permission V2 community reads.
      const overlay = require('../../lib/english-overlay');
      const listed = area === 'showcase' ? await overlay.showcase(this.data.game.slug, result.docs) : await overlay.posts(this.data.game.slug, result.docs);
      if (!this.valid(scope) || ticket !== this._areaTicket) return;
      const docs = [];
      for (const doc of listed) {
        const images = [];
        for (const image of doc.images || []) {
          images.push({ source: await files.localImage(image.source), caption: image.caption });
          if (!this.valid(scope) || ticket !== this._areaTicket) return;
        }
        docs.push({ ...doc, collection: areas[area], kindText: area === 'showcase' ? i18n.t('社群风采', 'Showcase') : doc.category === 'event' ? i18n.t('社群活动', 'Community event') : i18n.t('社群通知', 'Community notice'),
          dateText: format.date(doc.createdAt), localImages: images, videoSource: video.source(doc.videoURL), videoError: false });
      }
      if (!this.valid(scope) || ticket !== this._areaTicket) return;
      const combined = (more ? this.data.docs : []).concat(docs);
      this.setData({ loadingMore: false, docs: combined.filter((doc, index) => combined.findIndex(value => String(value.id) === String(doc.id)) === index),
        page: result.page || page, hasMore: Boolean(result.hasNextPage) });
    } catch (cause) { if (this.valid(scope) && ticket === this._areaTicket) this.setData({ loadingMore: false, contentError: cause.message }); }
  },
  async loadHonorPins() {
    if (this._disposed || this._visible === false || !identity() || !this.data.game.id || this.data.honorsLoading) return;
    const scope = this._scope || 0, ticket = this._honorsTicket = (this._honorsTicket || 0) + 1;
    const current = () => this.valid(scope) && ticket === this._honorsTicket;
    this.setData({ honorsLoading: true, honorsError: '' });
    try {
      const honorPins = await require('../../lib/community-honors').load(this.data.game.id, current);
      if (current()) this.setData({ honorPins, honorsLoading: false });
    } catch (cause) { if (current()) this.setData({ honorPins: [], honorsLoading: false, honorsError: cause.message || i18n.t('荣誉档案暂不可用，请重试', 'Honor records are unavailable. Please retry.') }); }
  },
  openHonorArchive(event) {
    const id = event.currentTarget.dataset.id;
    if (this._visible && !this._disposed && this.data.honorPins.some(pin => String(pin.id) === String(id))) navigation.go('team-honors', { team: id });
  },
  retryContent() { return this.loadArea(); },
  toggleIntro() { this.setData({ introOpen: !this.data.introOpen }); },
  contactImageError(event) {
    if (!this.valid(this._scope || 0)) return;
    const source = event.currentTarget.dataset;
    let changed = false;
    const contacts = this.data.contacts.map(contact => {
      if (String(contact.id) !== String(source.id) || !source.url || contact.image !== source.url || contact.imageError) return contact;
      changed = true; return { ...contact, imageError: true };
    });
    if (changed) this.setData({ contacts, contactAvailable: hasContactImage(contacts) });
  },
  showcaseImageError(event) {
    if (!this.valid(this._scope || 0)) return;
    const source = event.currentTarget.dataset;
    let changed = false;
    const docs = this.data.docs.map(doc => {
      if (String(doc.id) !== String(source.id)) return doc;
      const localImages = (doc.localImages || []).map(photo => {
        if (!source.url || photo.source !== source.url || photo.imageError) return photo;
        changed = true; return { ...photo, imageError: true };
      });
      return { ...doc, localImages };
    });
    if (changed) this.setData({ docs });
  },
  contactAdmins() {
    if (!this._visible || this._disposed || !this.data.game.id) return;
    this.area({ currentTarget: { dataset: { area: 'contacts' } } });
    wx.nextTick(() => {
      if (this._visible && !this._disposed && this.data.area === 'contacts')
        wx.pageScrollTo({ selector: '#community-contacts', duration: 0 });
    });
  },
  honorWorkspace() {
    if (this._visible && !this._disposed && !this.data.loading && this.data.game.id)
      navigation.go('team-honor-workspace', { game: this.data.game.id });
  },
  area(event) {
    const area = event.currentTarget.dataset.area;
    if (area === this.data.area || area !== 'contacts' && !areas[area]) return;
    this._areaTicket = (this._areaTicket || 0) + 1;
    this.setData({ area, docs: [], page: 1, hasMore: false, loadingMore: false, contentError: '' });
    return Promise.all([this.loadArea(), area === 'showcase' ? this.loadHonorPins() : Promise.resolve()]);
  },
  apply() { if (navigation.requireUser()) navigation.go('applications', { apply: 1, game: this.data.game.id }); },
  staff() { navigation.go('staff'); },
  applyStaff(event) { navigation.go('signup', { kind: 'staff', id: event.currentTarget.dataset.id }); },
  videoError(event) { const index = Number(event.currentTarget.dataset.index); if (this.data.docs[index]) this.setData({ [`docs[${index}].videoError`]: true }); },
  onShareAppMessage() { return { title: this.data.game.title || i18n.t('竞在紫荆游戏社群', 'Zijing Esports game community'), path: `/pages/community/index?id=${this.data.game.id || ''}&slug=${this.data.game.slug || ''}` }; },
}));
