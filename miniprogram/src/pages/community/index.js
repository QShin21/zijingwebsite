function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const files = require('../../lib/files');
const format = require('../../lib/format');
const { render } = require('../../lib/richtext');
const { actions, protect } = require('../../lib/page');
const video = require('../../lib/video');
const { hasContactImage } = require('../../lib/native-presentation');
const areas = { updates: 'community-posts', showcase: 'community-showcase' };
const identity = () => String((session.user() || {}).id || '');
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, game: {}, area: 'contacts', introOpen: false, docs: [], page: 1,
    hasMore: false, loadingMore: false, nodes: [], contentError: '', contacts: [], contactAvailable: false, contactsLoading: false, contactsError: '',
    clubLoading: false, clubError: '', staffBatches: [], promotions: [], honorPins: [], honorsLoading: false, honorsError: '' },
  ...actions,
  onLoad(options = {}) {
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate(); this._options = options;
    this.setData({ area: options.area === 'showcase' || options.area === 'updates' ? options.area : 'contacts' });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this._resumeRead = false; this.invalidate(); this.resetPrivate(); }
    });
  },
  invalidate() { this._scope = (this._scope || 0) + 1; },
  valid(scope) { return !this._disposed && this._visible !== false && scope === (this._scope || 0) && this._identity === identity() && Boolean(identity()); },
  resetPrivate() { this.setData({ needsLogin: !session.user(), loading: false, error: '', game: {}, introOpen: false, docs: [], nodes: [], page: 1,
    hasMore: false, loadingMore: false, contentError: '', contacts: [], contactAvailable: false, contactsLoading: false, contactsError: '',
    clubLoading: false, clubError: '', staffBatches: [], promotions: [], honorPins: [], honorsLoading: false, honorsError: '' }); },
  onShow() {
    this._visible = true;
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, loadingMore: false, contactsLoading: false, clubLoading: false, honorPins: [], honorsLoading: false, honorsError: '' }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loadingMore) return this.loadArea(true); },
  async load() {
    if (this._disposed || this._visible === false) return;
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1;
    this.setData({ loading: true, error: '' });
    try {
      const options = this._options || {};
      const game = await cms.detail('games', options.id, options.slug);
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      this.setData({ game, loading: false, nodes: render(game.body).nodes });
      wx.setNavigationBarTitle({ title: game.title });
      await Promise.all([this.loadArea(), this.retryContacts(), this.retryClub(), this.data.area === 'showcase' ? this.loadHonorPins() : Promise.resolve()]);
    } catch (cause) { if (this.valid(scope) && ticket === this._loadTicket) this.setData({ loading: false, error: cause.message }); }
  },
  async retryContacts() {
    if (this._disposed || this._visible === false) return;
    if (!identity() || !this.data.game.id || this.data.contactsLoading) return;
    const scope = this._scope || 0, game = this.data.game, ticket = this._contactsTicket = (this._contactsTicket || 0) + 1;
    this.setData({ contactsLoading: true, contactsError: '' });
    try {
      const contacts = await http.request(`/community/${encodeURIComponent(game.slug)}/contacts`, { required: true });
      if (!this.valid(scope) || ticket !== this._contactsTicket) return;
      if (!Array.isArray(contacts)) throw new Error('管理员名片暂不可用，请重试');
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
        promotions.push({ ...doc, kindText: kind === 'event' ? '社团活动' : kind === 'notice' ? '社团通知' : '社团风采' });
      this.setData({ staffBatches: result.staffBatches || [], promotions, clubLoading: false });
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
      if (!result || !Array.isArray(result.docs)) throw new Error('社群内容暂不可用，请重试');
      const docs = [];
      for (const doc of result.docs) {
        const images = [];
        for (const image of doc.images || []) {
          images.push({ source: await files.localImage(image.source), caption: image.caption });
          if (!this.valid(scope) || ticket !== this._areaTicket) return;
        }
        docs.push({ ...doc, collection: areas[area], kindText: area === 'showcase' ? '社群风采' : doc.category === 'event' ? '社群活动' : '社群通知',
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
    } catch (cause) { if (current()) this.setData({ honorPins: [], honorsLoading: false, honorsError: cause.message || '荣誉档案暂不可用，请重试' }); }
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
  onShareAppMessage() { return { title: this.data.game.title || '竞在紫荆游戏社群', path: `/pages/community/index?id=${this.data.game.id || ''}&slug=${this.data.game.slug || ''}` }; },
}));
