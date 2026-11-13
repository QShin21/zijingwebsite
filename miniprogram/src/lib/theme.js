// Explicit device-local appearance. No system-theme listener and no identity/API dependency.
const KEY = 'zijing_theme';
const choices = [
  { id: 'dark', label: '清华经典' },
  { id: 'summer', label: '清凉夏夜' },
  { id: 'light', label: '温煦冬日' },
  { id: 'simple', label: '简约' },
];
const modes = choices.map(choice => choice.id);
const generated = require('./design-tokens');
const tokens = {
  ...generated.tokens,
  summer: { ...generated.tokens.dark, page: '#0f2530', surface: '#16323f', raised: '#1d3f4e', text: '#eef8f3', muted: '#b9d3d3',
    primary: '#8fe8c9', primaryHover: '#b4f3dc', onPrimary: '#0b2a24', tint: '#1f4655', accent: '#ffd36e', onAccent: '#2a2208',
    line: '#2c5262', lineStrong: '#5a8796', field: '#0c1f28', fieldBorder: '#7fa8b4', focus: '#ffd36e',
    stage: '#08202a', stage2: '#0f3240', stageInk: '#eef8f3', stageMuted: '#b6d0cf', stageLine: 'rgba(238,248,243,.15)' },
  simple: { ...generated.tokens.light, page: '#f7f7f5', surface: '#ffffff', text: '#1c1c21', muted: '#57585f', tint: '#efe9f4',
    primary: '#5a2d82', accent: '#5a2d82', line: '#e3e3e0', lineStrong: '#c4c4c0', field: '#ffffff', fieldBorder: '#77777e',
    stage: '#f0edf4', stage2: '#f0edf4', stageInk: '#1c1c21', stageMuted: '#57585f', stageLine: '#c4c4c0' },
};
const chrome = {
  ...generated.chrome,
  summer: { ...generated.chrome.dark, background: tokens.summer.page, tabBg: tokens.summer.surface,
    tabText: tokens.summer.muted, tabSelected: tokens.summer.primary },
  simple: { ...generated.chrome.light, background: tokens.simple.page, tabBg: tokens.simple.surface,
    tabText: tokens.simple.muted, tabSelected: tokens.simple.primary },
};
const scenes = {
  dark: '/assets/tsinghua-second-gate.webp',
  summer: '/assets/tsinghua-lotus-pond.webp',
  light: '/assets/tsinghua-auditorium-snow.webp',
  simple: '',
};
const isDark = mode => mode === 'dark' || mode === 'summer';
let initialized = false, current = 'light', listeners = [];
function style(mode) {
  const palette = tokens[mode];
  return Object.keys(palette).map(key => '--z-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ':' + palette[key]).join(';') +
    ';--z-theme-light-page:' + tokens.light.page + ';--z-theme-light-primary:' + tokens.light.primary +
    ';--z-theme-dark-page:' + tokens.dark.page + ';--z-theme-dark-primary:' + tokens.dark.primary +
    ';--z-theme-summer-page:' + tokens.summer.page + ';--z-theme-summer-primary:' + tokens.summer.primary +
    ';--z-theme-simple-page:' + tokens.simple.page + ';--z-theme-simple-primary:' + tokens.simple.primary +
    ';--zp-outline:' + (mode === 'simple' ? palette.lineStrong : isDark(mode) ? '#130b22' : '#392a46') +
    ';--zp-shadow:' + (mode === 'simple' ? 'transparent' : isDark(mode) ? '#0b0714' : 'rgba(47,30,58,.25)') +
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
function presentation(mode) {
  return {
    theme: isDark(mode) ? 'dark' : 'light',
    palette: mode, scene: scenes[mode], themeChoices: choices,
    themePageStyle: style(mode), themePrimary: tokens[mode].primary,
    themeMuted: tokens[mode].muted, themeLine: tokens[mode].line,
  };
}
function apply(target, mode) {
  if (target.data.palette !== mode) target.setData(presentation(mode));
}
function subscribe(listener) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(value => value !== listener); };
}
function attach(target) {
  if (!target._visualThemeOff) target._visualThemeOff = subscribe(mode => apply(target, mode));
}
function page(definition) {
  const original = { load: definition.onLoad, show: definition.onShow, hide: definition.onHide, unload: definition.onUnload };
  const mode = get();
  return { ...definition, data: { ...definition.data, ...presentation(mode), themeUnavailable: false, themeError: '', themeNotice: '' },
    onLoad() { attach(this); apply(this, get()); paintChrome(get()); if (original.load) return original.load.apply(this, arguments); },
    onShow() {
      attach(this);
      apply(this, get());
      paintChrome(get());
      const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
      if (tabBar && typeof tabBar.sync === 'function') tabBar.sync(this.route);
      if (original.show) return original.show.apply(this, arguments);
    },
    onHide() { if (original.hide) return original.hide.apply(this, arguments); },
    onUnload() { if (this._visualThemeOff) this._visualThemeOff(); this._visualThemeOff = null; if (original.unload) return original.unload.apply(this, arguments); },
    setVisualTheme(event) {
      const mode = event && event.currentTarget && event.currentTarget.dataset.theme;
      const result = set(mode);
      if (!result.ok) return;
      apply(this, mode);
      this.setData({ themeError: result.persisted ? '' : '本次切换已生效，暂无法保存偏好；下次打开可能恢复原设置。',
        themeNotice: result.persisted ? '已切换至' + choices.find(choice => choice.id === mode).label + '。' : '' });
    }
  };
}
module.exports = { KEY, get, init, set, style, page, subscribe, tokens, chrome };
