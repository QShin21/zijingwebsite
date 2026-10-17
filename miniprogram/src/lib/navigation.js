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
function back() {
  if (typeof getCurrentPages === 'function' && getCurrentPages().length > 1) wx.navigateBack({ delta: 1, fail() { go('home'); } });
  else go('home');
}
function requireUser() { if (session.user()) return true; login(); return false; }
function content(doc) { go('detail', { collection: doc.collection, id: doc.id, slug: doc.slug || '' }); }
function copy(value, label = '链接已复制') {
  if (!value) return;
  wx.setClipboardData({ data: String(value), success() { wx.showToast({ title: label, icon: 'none' }); } });
}
function website(path) {
  if (!path || typeof path !== 'string') return;
  if (path === '/join/members') return go('communities');
  if (path === '/join/staff') return go('staff');
  if (path === '/join/teams' || path === '/teams/recruitment' || path === '/teams/manage') return go('team');
  const honorWorkspace = /^\/teams\/honors(?:\?([^#]*))?$/.exec(path);
  if (honorWorkspace) {
    const values = {};
    for (const pair of (honorWorkspace[1] || '').split('&')) {
      const [key, value] = pair.split('=');
      if (key === 'view' && value === 'review') values.view = 'review';
      if ((key === 'team' || key === 'game') && /^[1-9]\d*$/.test(value || '')) values[key] = value;
    }
    return go('team-honor-workspace', values);
  }
  if (path === '/teams/honors/new') return go('team-honor-edit');
  const honorRecord = /^\/teams\/honors\/([1-9]\d*)$/.exec(path);
  if (honorRecord) return go('team-honor-edit', { id: honorRecord[1] });
  const teamRecruitment = /^\/teams\/recruitment\/([1-9]\d*)$/.exec(path);
  if (teamRecruitment) return go('signup', { kind: 'team', id: teamRecruitment[1] });
  const teamApply = /^\/teams\/apply(?:\?edit=([1-9]\d*))?$/.exec(path);
  if (teamApply) return go('team-apply', teamApply[1] ? { edit: teamApply[1] } : {});
  const teamWorkbench = /^\/teams\/manage\/([1-9]\d*)$/.exec(path);
  if (teamWorkbench) return go('team-review', { team: teamWorkbench[1] });
  const teamProfiles = /^\/teams\/([1-9]\d*)\/profiles$/.exec(path);
  if (teamProfiles) return go('team-profiles', { team: teamProfiles[1] });
  const teamHonors = /^\/teams\/([1-9]\d*)\/honors$/.exec(path);
  if (teamHonors) return go('team-honors', { team: teamHonors[1] });
  const staff = /^\/join\/staff\/batches\/([1-9]\d*)$/.exec(path);
  if (staff) return go('signup', { kind: 'staff', id: staff[1] });
  if (path === '/community/apply') return go('applications', { apply: 1 });
  if (path === '/community/review') return go('review');
  if (path === '/staff/manage') return go('staff');
  const communityHonor = /^\/community\/([a-z0-9-]+)\/showcase\/team-honors\/([1-9]\d*)$/.exec(path);
  if (communityHonor) return go('team-honors', { team: communityHonor[2] });
  const communityArea = /^\/community\/([a-z0-9-]+)\/(updates|showcase)$/.exec(path);
  if (communityArea) return go('community', { slug: communityArea[1], area: communityArea[2] });
  const communityContent = /^\/community\/([a-z0-9-]+)\/(updates|showcase)\/([1-9]\d*)$/.exec(path);
  if (communityContent) return go('detail', { collection: communityContent[2] === 'updates' ? 'community-posts' : 'community-showcase', id: communityContent[3] });
  const community = /^\/community\/([a-z0-9-]+)$/.exec(path);
  if (community) return go('community', { slug: community[1] });
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
module.exports = { go, back, login, requireUser, content, copy, website };
