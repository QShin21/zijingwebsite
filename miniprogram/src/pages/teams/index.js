function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const v2 = require('../../lib/v2');
const images = require('../../lib/v2-images');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions } = require('../../lib/page');
const views = ['teams', 'honors', 'recruitment'];

function yearGroups(items) {
  const groups = [];
  items.forEach(item => {
    let group = groups.find(entry => entry.key === item.year);
    if (!group) { group = { key: item.year, items: [] }; groups.push(group); }
    group.items.push(item);
  });
  return groups;
}

// V2 代表队中心: 队伍 (A11) · 荣誉墙 (A13) · 选拔中心 (A14).
Page(withVisualTheme({
  data: { view: 'teams', user: null, docs: [], groups: [], staff: [], calls: [], mine: [], page: 0, hasMore: false, loading: false, loadingMore: false, error: '', loadMoreError: '', img: {} },
  ...actions,
  onLoad(options) { if (views.includes(options && options.view)) this.setData({ view: options.view }); },
  onShow() {
    const user = session.user();
    const campus = session.campus(user);
    this._visible = campus;
    this.setData({ campus });
    if (!campus) return navigation.go('events');
    const identity = String(user.id);
    if (this._identity === identity && this._loaded) return;
    this._identity = identity;
    this.setData({ user });
    return this.load();
  },
  onHide() { this._visible = false; this._ticket = (this._ticket || 0) + 1; this.setData({ loading: false, loadingMore: false }); },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.view !== 'recruitment' && this.data.hasMore && !this.data.loading && !this.data.loadingMore) return this.load(true); },
  retry() { return this.load(); },
  register() { navigation.go('auth', { mode: 'register' }); },
  switchView(event) {
    const view = event.currentTarget.dataset.view;
    if (!views.includes(view) || view === this.data.view || this.data.loading) return;
    this.setData({ view, docs: [], groups: [], error: '', loadMoreError: '' });
    return this.load();
  },
  openWorkspace() { navigation.go('team'); },
  openStaff() { navigation.go('staff'); },
  openHonorWorkspace() { navigation.go('team-honor-workspace'); },
  async load(more) {
    const view = this.data.view;
    if (more && (this.data.loadingMore || !this.data.hasMore)) return;
    const ticket = this._ticket = (this._ticket || 0) + 1;
    const alive = () => ticket === this._ticket && this._visible !== false && view === this.data.view;
    if (!session.campus()) { this._loaded = true; this.setData({ loading: false, docs: [], groups: [] }); return; }
    this.setData(more ? { loadingMore: true, loadMoreError: '' } : { loading: true, error: '' });
    try {
      if (view === 'recruitment') {
        const center = await v2.get('recruitment');
        if (!alive()) return;
        this._loaded = true;
        this.setData({ loading: false, staff: center.staff.map(v2.recruitment), calls: center.teams ? center.teams.docs.map(v2.recruitment) : [], mine: center.mine ? center.mine.map(v2.application) : [] });
        return;
      }
      const page = more ? this.data.page + 1 : 1;
      const result = await v2.get(view, { page, limit: 20 }, { required: true });
      if (!alive()) return;
      const seen = more ? this.data.docs.map(doc => doc.key) : [];
      const fresh = result.docs.map(view === 'teams' ? v2.team : v2.honor).filter(doc => !seen.includes(doc.key));
      if (view === 'honors') images.attach(this, fresh, alive);
      const docs = more ? this.data.docs.concat(fresh) : fresh;
      this._loaded = true;
      this.setData({ docs, groups: view === 'honors' ? yearGroups(docs) : [], page: result.page, hasMore: result.hasNextPage, loading: false, loadingMore: false });
    } catch (cause) {
      if (!alive()) return;
      if (more) this.setData({ loadingMore: false, loadMoreError: (cause && cause.message) || '加载更多失败' });
      else this.setData({ loading: false, error: (cause && cause.message) || '内容暂时无法加载' });
    }
  },
  onShareAppMessage() { return { title: '紫荆代表队', path: '/pages/teams/index' }; },
}));
