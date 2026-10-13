// Explicit device-local appearance. No system-theme listener and no identity/API dependency.
const KEY = 'zijing_theme';
const modes = ['light', 'dark'];
const tokens = {
  light: {
    page: '#f4f1ea', text: '#211e27', surface: '#fffdf8', control: '#fffefa', controlBorder: '#9b8aa9',
    brand: '#704693', secondaryText: '#5b368a', subtitle: '#5f536d', line: '#d9d3dc', media: '#ece8f1',
    muted: '#625c68', badgeText: '#5b3188', badgeBg: '#eee6f9', badgeBorder: '#c7b5db',
    primary: '#6839ae', onPrimary: '#fffdf8', secondaryBg: '#f1eaf8', secondaryBorder: '#9077ab',
    link: '#6839ae', dangerText: '#963447', dangerBg: '#f9e9ec', dangerBorder: '#bd6878',
    positive: '#126448', positiveBorder: '#a3c8b5', positiveBg: '#eaf6ef', positiveText: '#254f40',
    positiveLine: '#b1cebf', errorBg: '#f9e9ec', errorBorder: '#b5374b', errorText: '#963447',
    selectedText: '#432164', selectedBg: '#eaddf8', fieldBg: '#fffdf8', fieldBorder: '#94849f',
    body: '#40354d', focus: '#6839ae', halo: '#e8dcf5', heroBorder: '#c4b4d9',
    heroStart: '#f0e9f7', heroMiddle: '#faf8fd', heroEnd: '#edf5f1', heroDescription: '#61536f',
    orbitOuter: '#c0a9d6', orbitMiddle: '#9e7ebe', orbitInner: '#724891', letter: '#8056a4',
    artShadow: '#dfd3ec', joinBg: '#f3eef9', teamStart: '#ece1f8', teamEnd: '#f7f2fb',
    disabledText: '#796b83', disabledBg: '#eee9f3', disabledBorder: '#d1c6dc',
    imageBorder: '#dbd2e5', shadow: '0 4px 14px rgba(52, 34, 79, .035)',
    heroShade: 'linear-gradient(180deg, rgba(248,245,252,0), rgba(248,245,252,.2))',
    videoSurface: '#14131a'
  },
  dark: {
    page: '#131217', text: '#f3eef7', surface: '#1c1922', control: '#211e2c', controlBorder: '#786a89',
    brand: '#c5a6fa', secondaryText: '#e0cafa', subtitle: '#b9b2c9', line: '#4b4058', media: '#282333',
    muted: '#bfb5cc', badgeText: '#d2bafa', badgeBg: '#30263f', badgeBorder: '#514264',
    primary: '#c6a5ef', onPrimary: '#22152f', secondaryBg: '#2c233b', secondaryBorder: '#5d4978',
    link: '#cdb2fa', dangerText: '#ffbac6', dangerBg: '#321d27', dangerBorder: '#6f3b4a',
    positive: '#adedd4', positiveBorder: '#3b6456', positiveBg: '#17231e', positiveText: '#d9f4e7',
    positiveLine: '#334d43', errorBg: '#352027', errorBorder: '#c5788b', errorText: '#ffbac6',
    selectedText: '#eadcff', selectedBg: '#342644', fieldBg: '#17141d', fieldBorder: '#7a6a8c',
    body: '#e1dbe9', focus: '#edb353', halo: '#2e243d', heroBorder: '#56456e',
    heroStart: '#292034', heroMiddle: '#1a1722', heroEnd: '#16151d', heroDescription: '#c5bccf',
    orbitOuter: '#634c80', orbitMiddle: '#8264a4', orbitInner: '#c5a6fa', letter: '#ccb0fa',
    artShadow: '#0f0b18', joinBg: '#211b2c', teamStart: '#392647', teamEnd: '#1e1929',
    disabledText: '#ad9fbb', disabledBg: '#28232f', disabledBorder: '#4c405a',
    imageBorder: '#40384f', shadow: 'none',
    heroShade: 'linear-gradient(180deg, rgba(19,15,27,0), rgba(19,15,27,.24))',
    videoSurface: '#131217'
  }
};
const chrome = {
  light: { frontColor: '#000000', background: '#fffdf8', tabBg: '#fffdf8', tabText: '#625c68', tabSelected: '#6839ae', borderStyle: 'black', textStyle: 'dark' },
  dark: { frontColor: '#ffffff', background: '#17151c', tabBg: '#17151c', tabText: '#bfb5cc', tabSelected: '#cdb2fa', borderStyle: 'white', textStyle: 'light' }
};
const tabs = ['home', 'calendar', 'community', 'explore', 'user'];
let initialized = false, current = 'light', active = null, tabMode = '', listeners = [];
function style(mode) {
  const palette = tokens[mode];
  return Object.keys(palette).map(key => '--z-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ':' + palette[key]).join(';') +
    ';background-color:' + palette.page + ';color:' + palette.text + ';min-height:100vh;';
}
function invoke(name, args) {
  try { if (typeof wx !== 'undefined' && typeof wx[name] === 'function') wx[name]({ ...args, fail: args.fail || function () {} }); }
  catch { /* Appearance must not interrupt native navigation or a business operation. */ }
}
function paintChrome(mode) {
  const palette = chrome[mode];
  invoke('setNavigationBarColor', { frontColor: palette.frontColor, backgroundColor: palette.background, animation: { duration: 0 } });
  invoke('setBackgroundColor', { backgroundColor: tokens[mode].page, backgroundColorTop: tokens[mode].page, backgroundColorBottom: tokens[mode].page });
  invoke('setBackgroundTextStyle', { textStyle: palette.textStyle });
  invoke('setTabBarStyle', { color: palette.tabText, selectedColor: palette.tabSelected, backgroundColor: palette.tabBg, borderStyle: palette.borderStyle });
  if (tabMode !== mode) {
    let remaining = tabs.length;
    tabs.forEach((name, index) => invoke('setTabBarItem', { index,
      iconPath: '/assets/' + name + (mode === 'dark' ? '-dark' : '') + '.png',
      selectedIconPath: '/assets/' + name + (mode === 'dark' ? '-dark-active' : '-active') + '.png',
      success() { remaining--; if (!remaining && current === mode) tabMode = mode; } }));
  }
}
function get() {
  if (!initialized) {
    initialized = true;
    try { const stored = wx.getStorageSync(KEY); current = modes.includes(stored) ? stored : 'light'; }
    catch { current = 'light'; }
  }
  return current;
}
function init() { get(); paintChrome(current); return current; }
function set(mode) {
  if (!modes.includes(mode)) return { ok: false, persisted: false };
  current = mode; initialized = true;
  try { if (typeof getApp === 'function') { const app = getApp(); if (app && app.globalData) app.globalData.theme = mode; } }
  catch { /* The explicit preference also works before an App instance is available. */ }
  let persisted = true;
  try { wx.setStorageSync(KEY, mode); } catch { persisted = false; }
  listeners.slice().forEach(listener => listener(mode));
  paintChrome(mode);
  return { ok: true, persisted };
}
function apply(target, mode) {
  if (target.data.theme !== mode || target.data.themePageStyle !== style(mode))
    target.setData({ theme: mode, themePageStyle: style(mode) });
}
function attach(target) {
  if (target._visualThemeOff) return;
  const listener = mode => apply(target, mode);
  listeners.push(listener);
  target._visualThemeOff = () => { listeners = listeners.filter(value => value !== listener); target._visualThemeOff = null; if (active === target) active = null; };
}
function page(definition) {
  const original = { load: definition.onLoad, show: definition.onShow, hide: definition.onHide, unload: definition.onUnload };
  const mode = get();
  return { ...definition, data: { ...definition.data, theme: mode, themePageStyle: style(mode), themeUnavailable: false, themeError: '', themeNotice: '' },
    onLoad() { attach(this); apply(this, get()); paintChrome(get()); if (original.load) return original.load.apply(this, arguments); },
    onShow() { attach(this); active = this; apply(this, get()); paintChrome(get()); if (original.show) return original.show.apply(this, arguments); },
    onHide() { if (active === this) active = null; if (original.hide) return original.hide.apply(this, arguments); },
    onUnload() { if (this._visualThemeOff) this._visualThemeOff(); if (original.unload) return original.unload.apply(this, arguments); },
    setVisualTheme(event) {
      const mode = event && event.currentTarget && event.currentTarget.dataset.theme;
      const result = set(mode);
      if (!result.ok) return;
      apply(this, mode);
      this.setData({ themeError: result.persisted ? '' : '本次切换已生效，暂无法保存偏好；下次打开可能恢复原设置。',
        themeNotice: result.persisted ? '已记住你的' + (mode === 'light' ? '浅色' : '深色') + '选择。' : '' });
    }
  };
}
module.exports = { KEY, get, init, set, style, page, tokens, chrome };
