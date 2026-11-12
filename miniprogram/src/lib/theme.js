// Explicit device-local appearance. No system-theme listener and no identity/API dependency.
const KEY = 'zijing_theme';
const modes = ['light', 'dark'];
const { tokens, chrome } = require('./design-tokens');
const tabs = ['home', 'calendar', 'community', 'teams', 'user'];
let initialized = false, current = 'light', tabMode = '', listeners = [];
function style(mode) {
  const palette = tokens[mode];
  return Object.keys(palette).map(key => '--z-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ':' + palette[key]).join(';') +
    ';--z-theme-light-page:' + tokens.light.page + ';--z-theme-light-primary:' + tokens.light.primary +
    ';--z-theme-dark-page:' + tokens.dark.page + ';--z-theme-dark-primary:' + tokens.dark.primary +
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
    target.setData({ theme: mode, themePageStyle: style(mode), themePrimary: tokens[mode].primary, themeMuted: tokens[mode].muted, themeLine: tokens[mode].line });
}
function attach(target) {
  if (target._visualThemeOff) return;
  const listener = mode => apply(target, mode);
  listeners.push(listener);
  target._visualThemeOff = () => { listeners = listeners.filter(value => value !== listener); target._visualThemeOff = null; };
}
function page(definition) {
  const original = { load: definition.onLoad, show: definition.onShow, hide: definition.onHide, unload: definition.onUnload };
  const mode = get();
  return { ...definition, data: { ...definition.data, theme: mode, themePageStyle: style(mode), themePrimary: tokens[mode].primary, themeMuted: tokens[mode].muted, themeLine: tokens[mode].line, themeUnavailable: false, themeError: '', themeNotice: '' },
    onLoad() { attach(this); apply(this, get()); paintChrome(get()); if (original.load) return original.load.apply(this, arguments); },
    onShow() { attach(this); apply(this, get()); paintChrome(get()); if (original.show) return original.show.apply(this, arguments); },
    onHide() { if (original.hide) return original.hide.apply(this, arguments); },
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
