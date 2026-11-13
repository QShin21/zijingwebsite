function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const v2 = require('../../lib/v2');
const images = require('../../lib/v2-images');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
const text = {
  eyebrow: ['COMMUNITIES · 游戏社群', 'COMMUNITIES'], title: ['找到同好，从这里开场', 'Find your people, start here'],
  subtitle: ['选择你玩的游戏，看看活动与风采，再联系管理员人工拉你进群。', 'Pick your game, browse events and highlights, then contact an admin to be added to the group.'],
  loginTitle: ['登录后查看游戏社群', 'Sign in to view game communities'], loginBody: ['社群名片与活动仅向社团成员展示。', 'Community cards and events are shown to club members only.'],
  searchPlaceholder: ['搜索游戏名称或介绍', 'Search game name or description'], searchLabel: ['搜索社群', 'Search communities'], find: ['查找', 'Search'],
  resultsPrefix: ['“', 'Results for “'], resultsMiddle: ['”的匹配结果 · ', '” · '], resultsSuffix: [' 个', ''], allCommunities: ['全部社群', 'All communities'],
  communitySuffix: ['社群', ' community'], officer: ['我是管理员', 'I am an admin'],
  loadingMore: ['加载中…', 'Loading…'], retryMore: ['重试加载更多', 'Retry loading more'], loadMore: ['加载更多', 'Load more'],
  noMatchTitle: ['没有找到匹配的社群', 'No matching communities'], emptyTitle: ['社群正在筹备', 'Communities in preparation'],
  noMatchBody: ['换一个游戏名称或关键词试试。', 'Try another game name or keyword.'], emptyBody: ['想组织新的游戏社群，可以提交组织申请。', 'Want to start a new game community? Submit an application.'],
  organizeTitle: ['把热爱的游戏，组织成社群', 'Turn the game you love into a community'],
  organizeBody: ['参与已有社群的组织工作，或为还没出现的游戏发起申请。', 'Help run an existing community, or apply for a game that is not here yet.'],
  apply: ['申请成为社群管理员', 'Apply to be a community admin'],
};
// These five server-prepared defaults have a padded 512px transparent canvas.
const isDefaultIcon = src => typeof src === 'string' && /^\/api\/game-icons\/default\/(honor-of-kings|cs2|stardew-valley|eggy-party|league-of-legends)(?:\?.*)?$/.test(src);

// V2 社群目录 (GET /api/v2/communities). Guests see the login wall; the
// server keeps the member-only rule regardless of this page.
Page(withVisualTheme({
  data: { user: null, needsLogin: false, q: '', input: '', docs: [], page: 0, hasMore: false, total: 0, loading: false, loadingMore: false, error: '', loadMoreError: '', img: {} },
  ...actions,
  onLoad() {
    i18n.bind(this, text);
    // Account change (logout or switch): drop the previous account's directory and ignore its late replies.
    this._unsubscribe = session.subscribe(user => {
      this._ticket = (this._ticket || 0) + 1;
      this._loaded = false;
      this._identity = user ? String(user.id) : '';
      this.setData({ campus: session.campus(user), user: user || null, needsLogin: !user, docs: [], page: 0, hasMore: false, total: 0, loading: false, loadingMore: false, error: '', loadMoreError: '', img: {} });
      if (session.campus(user) && this._visible) this.load();
    });
  },
  onUnload() {
    this._visible = false;
    this._ticket = (this._ticket || 0) + 1;
    if (this._unsubscribe) this._unsubscribe();
    i18n.unbind(this);
  },
  onShow() {
    const relocalized = (i18n.refreshIfStale ? i18n.refreshIfStale(this) : false);
    i18n.navTitle('加入我们', 'Join us');
    const user = session.user();
    const campus = session.campus(user);
    this._visible = campus;
    this.setData({ campus });
    if (!campus) return navigation.go('events');
    const identity = String(user.id);
    if (this._identity === identity && this._loaded && !relocalized) return;
    this._identity = identity;
    this.setData({ user, needsLogin: !user, docs: [], error: '' });
    if (user) return this.load();
  },
  onHide() { this._visible = false; this._ticket = (this._ticket || 0) + 1; this.setData({ loading: false, loadingMore: false }); },
  onPullDownRefresh() { return (this.data.user ? this.load() : Promise.resolve()).then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.user && this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  retry() { return this.load(); },
  onLocaleChange() { if (this._loaded && this._visible && this.data.user) this.load(); },
  register() { navigation.go('auth', { mode: 'register' }); },
  typing(event) { this.setData({ input: String(event.detail.value || '').slice(0, 80) }); },
  search() { if (this.data.loading) return; this.setData({ q: this.data.input.trim() }); return this.load(); },
  clear() { this.setData({ q: '', input: '' }); return this.load(); },
  apply() { navigation.go('applications', { apply: 1 }); },
  async load(more) {
    if (more && (this.data.loadingMore || !this.data.hasMore)) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const alive = () => ticket === this._ticket && this._visible !== false;
    const page = more ? this.data.page + 1 : 1;
    this.setData(more ? { loadingMore: true, loadMoreError: '' } : { loading: true, error: '' });
    try {
      const result = await v2.get('communities', { q: this.data.q, page, limit: 24 }, { required: true });
      if (!alive()) return;
      const seen = more ? this.data.docs.map(doc => doc.key) : [];
      const fresh = result.docs.map(v2.community).filter(doc => !seen.includes(doc.key)).map(doc => ({ ...doc, defaultIcon: isDefaultIcon(doc.coverSrc) }));
      images.attach(this, fresh, alive);
      this._loaded = true;
      this.setData({ docs: more ? this.data.docs.concat(fresh) : fresh, page: result.page, hasMore: result.hasNextPage, total: result.totalDocs, loading: false, loadingMore: false });
    } catch (cause) {
      if (!alive()) return;
      if (cause && cause.status === 401) { this.setData({ user: null, needsLogin: true, loading: false, loadingMore: false }); return; }
      if (more) this.setData({ loadingMore: false, loadMoreError: (cause && cause.message) || i18n.t('加载更多失败', 'Failed to load more') });
      else this.setData({ loading: false, error: (cause && cause.message) || i18n.t('社群目录暂时无法加载', 'The community directory could not be loaded') });
    }
  },
  onShareAppMessage() { return { title: i18n.t('紫荆游戏社群', 'Zijing game communities'), path: '/pages/communities/index' }; },
}));
