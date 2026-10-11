const { safeURL } = require('./format');
const session = require('./session');
const tabs = ['home', 'events', 'communities', 'explore', 'account'];
function go(page, values = {}) {
  const suffix = Object.keys(values).filter(key => values[key] !== undefined).map(key =>
    `${encodeURIComponent(key)}=${encodeURIComponent(String(values[key]))}`).join('&');
  const url = `/pages/${page}/index${suffix ? '?' + suffix : ''}`;
  if (tabs.includes(page)) wx.switchTab({ url: `/pages/${page}/index` });
  else wx.navigateTo({ url });
}
function login() { go('auth', { mode: 'login' }); }
function requireUser() { if (session.user()) return true; login(); return false; }
function content(doc) { go('detail', { collection: doc.collection, id: doc.id, slug: doc.slug || '' }); }
function copy(value, label = '链接已复制') {
  if (!value) return;
  wx.setClipboardData({ data: String(value), success() { wx.showToast({ title: label, icon: 'none' }); } });
}
function website(path) {
  if (!path || typeof path !== 'string') return;
  if (path === '/join/members') return go('communities');
  const fixed = { '/about': 'about', '/contact': 'contact', '/privacy': 'privacy', '/join': 'join', '/join/members': 'join-members', '/join/teams': 'join-teams', '/join/staff': 'join-staff' };
  if (fixed[path]) return go('fixed', { key: fixed[path] });
  if (path === '/') return go('home');
  if (path === '/community') return go('communities');
  if (path === '/events') return go('events');
  const match = /^\/(events|teams|honors|news|gallery|recruitment|announcements)(?:\/([a-z0-9-]+))?$/.exec(path);
  if (match) {
    const collection = match[1] === 'gallery' ? 'albums' : match[1];
    return go(match[2] ? 'detail' : 'list', { collection, ...(match[2] ? { slug: match[2] } : {}) });
  }
  if (safeURL(path)) return copy(path, '链接已复制，可在浏览器打开');
}
module.exports = { go, login, requireUser, content, copy, website };
