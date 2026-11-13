const theme = require('../lib/theme');
const session = require('../lib/session');
const i18n = (() => { try { const value = require('../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, subscribe: () => () => {} }; })();
const labelsEn = { home: 'Home', events: 'Schedule', communities: 'Communities', teams: 'Teams', account: 'Me' };
const tabs = [
  { page: 'home', icon: 'home', label: '主场' },
  { page: 'events', icon: 'calendar', label: '日程' },
  { page: 'communities', icon: 'community', label: '社群', campus: true },
  { page: 'teams', icon: 'teams', label: '代表队', campus: true },
  { page: 'account', icon: 'user', label: '我的' },
];

Component({
  data: { items: [], chrome: {} },
  lifetimes: {
    attached() {
      this._off = [theme.subscribe(() => this.sync()), session.subscribe(() => this.sync()), i18n.subscribe(() => this.sync())];
      this.sync();
    },
    detached() { (this._off || []).forEach(off => off()); },
  },
  pageLifetimes: { show() { this.sync(); } },
  methods: {
    sync(route) {
      const pages = getCurrentPages();
      const active = route || (pages.length ? pages[pages.length - 1].route : 'pages/home/index');
      const mode = theme.get();
      const dark = mode === 'dark' || mode === 'summer';
      const campus = session.campus();
      const items = tabs.filter(tab => !tab.campus || campus).map(tab => {
        const url = 'pages/' + tab.page + '/index';
        const selected = url === active;
        return { ...tab, label: i18n.t(tab.label, labelsEn[tab.page]), url: '/' + url, selected,
          image: '/assets/' + tab.icon + (dark ? '-dark' : '') + (selected ? '-active' : '') + '.png' };
      });
      this.setData({ items, chrome: theme.chrome[mode], line: theme.tokens[mode].line });
    },
    change(event) {
      const item = this.data.items.find(tab => tab.url === event.currentTarget.dataset.url);
      if (item && !item.selected && (!item.campus || session.campus())) wx.switchTab({ url: item.url });
    },
  },
});
