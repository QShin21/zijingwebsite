function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const cms = require('../../lib/cms');
const club = require('../../lib/club');
const session = require('../../lib/session');
const reading = require('../../lib/native-reading');
const { actions, error, labels } = require('../../lib/page');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const kindsEn = { '全部': 'All', '普通社员': 'Members', '代表队选拔': 'Team trials', '骨干招新': 'Staff recruitment' };
const allGames = () => ({ id: '', title: i18n.t('全部项目', 'All games') });
const text = { back: ['‹ 返回', '‹ Back'], kicker: ['FEED · 动态', 'FEED · Updates'], teamAffairs: ['代表队事务', 'Team affairs'], teamEntryTitle: ['招新与我的队伍', 'Recruitment and my teams'], teamEntryBody: ['查看选拔批次、本人申请与成员关系。', 'See trials, your applications and memberships.'],
  searchPrefix: ['搜索', 'Search '], searchSuffix: ['标题关键词', ' by title'], searchAria: ['搜索当前栏目标题', 'Search titles in this section'], search: ['搜索', 'Search'], year: ['赛事年份', 'Year'], game: ['游戏项目', 'Game'], allYears: ['全部年份', 'All years'],
  kindAria: ['招新分类', 'Recruitment type'], ariaSep: ['，', ', '], selected: ['已选中', 'selected'], unselected: ['未选中', 'not selected'], clear: ['清除筛选', 'Clear filters'], yearHonorsSuffix: ['年荣誉', ' honors'],
  showcaseEmpty: ['暂无已审批社群风采', 'No approved community showcase yet'], showcaseEmptyBody: ['新的记录发布后会出现在这里。', 'New posts will appear here once published.'],
  eventsEmpty: ['暂无符合条件的活动', 'No matching events'], contentEmpty: ['暂无符合条件的内容', 'No matching content'], emptyHint: ['可清除筛选查看全部，或稍后下拉刷新。', 'Clear filters to see everything, or pull down to refresh later.'],
  retryMore: ['重试加载更多', 'Retry loading more'], loadMore: ['加载更多', 'Load more'], end: ['— 已展示全部结果 —', '— End of results —'] };
Page(withVisualTheme({
  data: { loading: true, error: '', needsLogin: false, collection: '', title: '', docs: [], page: 1, hasMore: false,
    catalog: {}, loadingMore: false, loadMoreError: '', search: '', years: ['全部年份'], year: '全部年份', yearIndex: 0, kinds: ['全部', '普通社员', '代表队选拔', '骨干招新'], kind: '全部', games: [{ id: '', title: '全部项目' }], gameIndex: 0 },
  ...actions,
  onLoad(options) {
    i18n.bind(this, text);
    const catalog = reading.catalog(options.collection);
    this._hidden = false; this._unloaded = false;
    this.setData({ collection: options.collection, title: labels[options.collection] || catalog.title, catalog });
    wx.setNavigationBarTitle({ title: labels[options.collection] || catalog.title });
    this.setData({ kindLabels: this.data.kinds.map(kind => i18n.t(kind, kindsEn[kind])), games: [allGames()] });
    const now = new Date().getFullYear();
    this.setData({ years: ['全部年份', ...Array.from({ length: 15 }, (_, i) => String(now - i))] });
    this.setData({ yearLabels: [i18n.t('全部年份', 'All years'), ...this.data.years.slice(1)] });
    this._unsubscribe = session.subscribe(user => {
      this._ticket = (this._ticket || 0) + 1; this._gamesTicket = (this._gamesTicket || 0) + 1;
      this.setData({ loading: false, loadingMore: false, error: '', loadMoreError: '', docs: [], page: 1, hasMore: false, games: [allGames()], gameIndex: 0, needsLogin: !user });
    });
  },
  onShow() { wx.setNavigationBarTitle({ title: this.data.title || i18n.t('资料档案', 'Archive') }); this._hidden = false; this.load(); if (session.campus()) this.loadGames(); },
  onHide() { this._hidden = true; this._ticket = (this._ticket || 0) + 1; this._gamesTicket = (this._gamesTicket || 0) + 1; },
  onLocaleChange() {
    const catalog = reading.catalog(this.data.collection), title = labels[this.data.collection] || catalog.title;
    this.setData({ catalog, title, yearLabels: [i18n.t('全部年份', 'All years'), ...this.data.years.slice(1)], kindLabels: this.data.kinds.map(kind => i18n.t(kind, kindsEn[kind])), games: [allGames(), ...this.data.games.slice(1)] });
    wx.setNavigationBarTitle({ title });
  },
  onUnload() { this._unloaded = true; this.onHide(); i18n.unbind(this); if (this._unsubscribe) this._unsubscribe(); },
  async loadGames() {
    const ticket = this._gamesTicket = (this._gamesTicket || 0) + 1;
    const user = session.user(), userId = user && user.id;
    if (!user) return;
    try {
      const result = await cms.list('games', { limit: 50 });
      const current = session.user();
      if (ticket === this._gamesTicket && !this._hidden && !this._unloaded && current && String(current.id) === String(userId))
        this.setData({ games: [allGames(), ...result.docs] });
    } catch { /* Main query presents authentication errors. */ }
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  input(event) { this.setData({ search: event.detail.value }); },
  search() { this.load(); },
  changeYear(event) { const yearIndex = Number(event.detail.value); this.setData({ year: this.data.years[yearIndex], yearIndex }); this.load(); },
  changeGame(event) { this.setData({ gameIndex: Number(event.detail.value) }); this.load(); },
  changeKind(event) { this.setData({ kind: event.currentTarget.dataset.kind }); this.load(); },
  clearFilters() { this.setData({ search: '', year: '全部年份', yearIndex: 0, gameIndex: 0, kind: '全部' }); return this.load(); },
  retry() { this.load(); },
  nativeCoverError(event) {
    if (this._hidden || this._unloaded || this.data.loading || this.data.needsLogin) return;
    const docs = require('../../lib/native-presentation').markCoverFailure(this.data.docs, event.currentTarget.dataset);
    if (docs !== this.data.docs) this.setData({ docs });
  },
  async load(more = false) {
    if (more && (this.data.loading || this.data.loadingMore)) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    this.setData(more ? { loadingMore: true, loadMoreError: '' } : { loading: true, loadingMore: false, error: '', loadMoreError: '', needsLogin: false, docs: [], hasMore: false });
    try {
      if (this.data.collection === 'club-showcase') {
        const value = await club.load();
        if (ticket === this._ticket) this.setData({ loading: false, loadingMore: false, docs: value.promotions.showcase || [], page: 1, hasMore: false });
        return;
      }
      const kind = { '普通社员': 'members', '代表队选拔': 'teams', '骨干招新': 'staff' }[this.data.kind];
      const result = await cms.list(this.data.collection, { page: more ? this.data.page + 1 : 1,
        search: this.data.search, kind, sort: this.data.collection === 'honors' ? '-date' : undefined,
        game: this.data.games[this.data.gameIndex] && this.data.games[this.data.gameIndex].id,
        year: this.data.collection === 'honors' && this.data.year !== '全部年份' ? this.data.year : undefined });
      const docs = (this.data.collection === 'announcements' ? result.docs : await cms.decorate(result.docs)).map(reading.entry);
      if (ticket !== this._ticket) return;
      this.setData({ loading: false, loadingMore: false, docs: more ? this.data.docs.concat(docs) : docs, page: result.page, hasMore: result.hasNextPage });
    } catch (cause) {
      if (ticket !== this._ticket) return;
      if (more && (!cause || cause.status !== 401)) this.setData({ loadingMore: false, loadMoreError: cause && cause.message || i18n.t('下一页暂时未能读取，请重试。', 'The next page could not be loaded. Please try again.') });
      else { error(this, cause); this.setData({ loadingMore: false, ...(cause && cause.status === 401 ? { docs: [], hasMore: false } : {}) }); }
    }
  },
  onShareAppMessage() { return { title: `${i18n.t('竞在紫荆', 'Zijing Esports')} · ${this.data.title}`, path: `/pages/list/index?collection=${this.data.collection}` }; },
}));
