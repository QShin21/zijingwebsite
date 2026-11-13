const { safeURL } = require('./format');
const session = require('./session');
const tabs = ['home', 'events', 'communities', 'teams', 'account'];
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
// Static /community/* segments are pages, never community slugs.
const communityStatic = ['apply', 'review', 'promotions'];
function website(path) {
  if (!path || typeof path !== 'string') return;
  // Historical receipt/form anchors on the web apply pages (e.g. ApplicationItem.href) open the
  // matching native apply page; the web href itself is left unchanged.
  const applyAnchor = /^\/(teams|community)\/apply#([a-z-]+)$/.exec(path);
  if (applyAnchor) {
    if (applyAnchor[1] === 'teams' && ['team-applications-title', 'my-establishment-applications', 'establishment-form'].includes(applyAnchor[2])) return go('team-apply');
    if (applyAnchor[1] === 'community' && ['my-applications-title', 'my-applications'].includes(applyAnchor[2])) return go('applications');
    if (applyAnchor[1] === 'community' && applyAnchor[2] === 'application-form-title') return go('applications', { apply: 1 });
  }
  if (path === '/join/members') return go('communities');
  if (path === '/join/staff') return go('staff');
  // V2 destinations: 代表队中心、选拔中心、我的与日程筛选。
  if (path === '/teams') return go('teams');
  if (path === '/join/teams' || path === '/teams/recruitment' || /^\/teams\/recruitment#/.test(path)) return go('recruitment');
  if (path === '/teams/manage') return go('team');
  // 全部报名 / 全部申请（含已归档记录与撤销归档）。
  const records = /^\/account\?view=(signups|applications|history)(?:[&#].*)?$/.exec(path);
  if (records) return go('records', { mode: records[1] === 'signups' ? 'signups' : 'applications' });
  if (/^\/account(?:[?#].*)?$/.test(path)) return go('account');
  if (/^\/events\?scope=mine/.test(path)) return go('events');
  const communityApply = /^\/community\/apply\?edit=([1-9]\d*)$/.exec(path);
  if (communityApply) return go('applications', { apply: 1 });
  const showcaseNew = /^\/community\/([a-z0-9-]+)\/showcase\/new$/.exec(path);
  if (showcaseNew) return go('showcase-new', { slug: showcaseNew[1] });
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
  // Activity seating: the reviewer workbench and the member anchor on V2 event pages. The
  // seating page re-checks the session and the server re-checks review rights on every call.
  const seatWorkbench = /^\/activities\/(events|community-posts)\/([1-9]\d{0,9})\/seating$/.exec(path);
  if (seatWorkbench) return go('activity-seating', { kind: seatWorkbench[1], id: seatWorkbench[2], mode: 'review' });
  const communitySeating = /^\/community\/([a-z0-9-]+)\/updates\/([1-9]\d{0,9})#activity-seating$/.exec(path);
  if (communitySeating && !communityStatic.includes(communitySeating[1])) return go('activity-seating', { kind: 'community-posts', id: communitySeating[2] });
  const eventSeating = /^\/events\/([a-z0-9-]+)#activity-seating$/.exec(path);
  if (eventSeating) return go('detail', { collection: 'events', slug: eventSeating[1] });
  if (path === '/community/apply') return go('applications', { apply: 1 });
  if (path === '/community/review') return go('review');
  if (path === '/staff/manage') return go('staff');
  const communityHonor = /^\/community\/([a-z0-9-]+)\/showcase\/team-honors\/([1-9]\d*)$/.exec(path);
  if (communityHonor) return go('team-honors', { team: communityHonor[2] });
  // 「加入社群」= 联系管理员：网页 /community/{slug}/join 与 #community-contacts 都进入名片区。
  const communityJoin = /^\/community\/([a-z0-9-]+)(?:\/join|#community-contacts)$/.exec(path);
  if (communityJoin) return go('community', { slug: communityJoin[1], area: 'contacts' });
  const communityArea = /^\/community\/([a-z0-9-]+)\/(updates|showcase)$/.exec(path);
  if (communityArea && !communityStatic.includes(communityArea[1])) return go('community', { slug: communityArea[1], area: communityArea[2] });
  const communityContent = /^\/community\/([a-z0-9-]+)\/(updates|showcase)\/([1-9]\d*)$/.exec(path);
  if (communityContent && !communityStatic.includes(communityContent[1])) return go('detail', { collection: communityContent[2] === 'updates' ? 'community-posts' : 'community-showcase', id: communityContent[3] });
  const community = /^\/community\/([a-z0-9-]+)$/.exec(path);
  if (community && !communityStatic.includes(community[1])) return go('community', { slug: community[1] });
  const fixed = { '/about': 'about', '/contact': 'contact', '/privacy': 'privacy', '/join': 'join', '/join/members': 'join-members', '/join/teams': 'join-teams', '/join/staff': 'join-staff' };
  if (fixed[path]) return go('fixed', { key: fixed[path] });
  if (path === '/') return go('home');
  if (path === '/community') return go('communities');
  if (path === '/events') return go('events');
  const teamHome = /^\/teams\/([a-z0-9-]*[a-z-][a-z0-9-]*)$/.exec(path);
  if (teamHome && !['apply', 'honors', 'manage', 'recruitment', 'profiles'].includes(teamHome[1])) return go('team-home', { slug: teamHome[1] });
  const match = /^\/(events|teams|honors|news|gallery|recruitment|announcements)(?:\/([a-z0-9-]+))?$/.exec(path);
  if (match) {
    const collection = match[1] === 'gallery' ? 'albums' : match[1];
    return go(match[2] ? 'detail' : 'list', { collection, ...(match[2] ? { slug: match[2] } : {}) });
  }
  // Any other site page has no native equivalent (old share links included): offer the web link.
  if (/^\/(?!\/)/.test(path)) return copy(require('../config').origin + path, '请在网页端打开，链接已复制');
  if (safeURL(path)) return copy(path, '链接已复制，可在浏览器打开');
}
/** Server-declared destinations (ApplicationItem/TodoItem/ManageQueue): webOnly items are completed on the website. */
function open(path, webOnly) {
  if (!path || typeof path !== 'string' || !/^\/(?!\/)/.test(path)) return;
  if (webOnly === true) return copy(require('../config').origin + path, '请在网页端完成，链接已复制');
  return website(path);
}
module.exports = { go, back, login, requireUser, content, copy, website, open };
