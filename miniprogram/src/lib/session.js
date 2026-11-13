const config = require('../config');
let listeners = [];

function read() {
  const saved = wx.getStorageSync(config.sessionKey);
  if (!saved || typeof saved.token !== 'string' || !saved.token ||
      !saved.user || saved.user.accountStatus === 'suspended' ||
      !Number.isFinite(saved.exp) || saved.exp * 1000 <= Date.now()) {
    if (saved) clear();
    return null;
  }
  return saved;
}
function user() { const saved = read(); return saved ? saved.user : null; }
function campus(value = user()) { return Boolean(value && (!value.affiliation || value.affiliation === 'tsinghua')); }
function token() { const saved = read(); return saved ? saved.token : ''; }
function project(value) {
  return {
    id: value.id, name: value.name || '社团成员', email: value.email || '',
    roles: value.roles || [], accountStatus: value.accountStatus, affiliation: value.affiliation || 'tsinghua',
    communities: (value.communities || []).map(v => typeof v === 'object' ? v.id : v),
    publishCommunities: (value.capabilities && value.capabilities.publishCommunities) || [],
  };
}
function save(result) {
  if (!result.token || !result.user || result.user.accountStatus === 'suspended' ||
      !Number.isFinite(result.exp) || result.exp * 1000 <= Date.now()) throw new Error('登录未完成，请重试');
  const saved = { token: result.token, exp: result.exp, user: project(result.user) };
  wx.setStorageSync(config.sessionKey, saved);
  publish(saved.user);
}
function refreshUser(value) {
  const saved = read();
  if (!saved) return;
  if (!value || value.accountStatus === 'suspended') { clear(); return; }
  saved.user = project(value);
  wx.setStorageSync(config.sessionKey, saved);
  publish(saved.user);
}
function publish(value) {
  if (typeof getApp === 'function') {
    const app = getApp();
    if (app) app.globalData.user = value;
  }
  listeners.forEach(callback => callback(value));
}
function clear() {
  wx.removeStorageSync(config.sessionKey);
  require('./files').clearPrivate();
  publish(null);
}
function subscribe(callback) {
  listeners.push(callback);
  return () => { listeners = listeners.filter(value => value !== callback); };
}
function manages(game) {
  const current = user();
  return Boolean(campus(current) && (current.roles.some(role => ['president', 'vicePresident'].includes(role)) ||
    (current.publishCommunities || []).some(id => String(id) === String(game))));
}
function reviewer() { const current = user(); return Boolean(campus(current) && current.roles.some(role => ['president', 'vicePresident'].includes(role))); }
module.exports = { read, user, token, save, refreshUser, clear, subscribe, manages, reviewer, campus };
