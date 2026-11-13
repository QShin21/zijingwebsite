// V2 view client for the native app: /api/v2/* with the stored JWT, plus
// presentation projections shared by the V2 pages. No business decisions here;
// the server already applied identity, permission and publication rules.
const http = require('./http');

function query(values) {
  const parts = [];
  Object.keys(values || {}).forEach(key => {
    const value = values[key];
    if (value === undefined || value === null || value === '') return;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  });
  return parts.length ? '?' + parts.join('&') : '';
}
function get(path, values, options) {
  return http.request('/api/v2/' + path + query(values), { required: Boolean(options && options.required) });
}
function post(path, data) {
  return http.request('/api/v2/' + path, { method: 'POST', data, required: true });
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const pad = value => (value < 10 ? '0' : '') + value;
function beijing(iso) {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  const t = new Date(time + 8 * 3600 * 1000);
  const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate();
  return { y, m, d, w: WEEK[t.getUTCDay()], hh: pad(t.getUTCHours()), mm: pad(t.getUTCMinutes()), key: y + '-' + pad(m) + '-' + pad(d) };
}
function dayLabel(iso) { const p = beijing(iso); return p ? p.m + '月' + p.d + '日 ' + p.w : '时间待定'; }
function dateText(iso) { const p = beijing(iso); return p ? p.y + '年' + p.m + '月' + p.d + '日' : ''; }
function shortDate(iso) { const p = beijing(iso); return p ? p.m + '/' + p.d : ''; }
function dateTime(iso) { const p = beijing(iso); return p ? p.m + '月' + p.d + '日 ' + p.hh + ':' + p.mm : ''; }
function range(start, end) {
  const a = beijing(start), b = beijing(end);
  if (!a) return b ? dateTime(end) + ' 结束' : '时间待定';
  if (!b) return a.hh + ':' + a.mm + ' 开始';
  if (a.key === b.key) return a.hh + ':' + a.mm + '–' + b.hh + ':' + b.mm;
  return a.m + '/' + a.d + ' ' + a.hh + ':' + a.mm + ' – ' + b.m + '/' + b.d + ' ' + b.hh + ':' + b.mm;
}
function daysUntil(iso) {
  const target = beijing(iso), today = beijing(new Date().toISOString());
  if (!target || !today) return null;
  return Math.round((Date.UTC(target.y, target.m - 1, target.d) - Date.UTC(today.y, today.m - 1, today.d)) / 86400000);
}
function countdown(iso) {
  const days = daysUntil(iso);
  if (days === null || days < 0) return '';
  return days === 0 ? '今天' : days === 1 ? '明天' : '还有 ' + days + ' 天';
}
function deadline(iso) {
  const days = daysUntil(iso);
  if (days === null) return '';
  if (days < 0) return shortDate(iso) + ' 已截止';
  return days === 0 ? '今天截止' : shortDate(iso) + ' 截止 · 剩 ' + days + ' 天';
}
function initial(title) { const text = String(title || '').trim(); return text ? text.charAt(0).toUpperCase() : '紫'; }
function hue(value) { return Number.isFinite(value) ? value : 262; }

const eventTone = { live: 'live', cancelled: 'danger', postponed: 'warning', ended: 'neutral', upcoming: 'action' };
function signupTone(card) {
  if (card.signup.viewerSubmitted) return 'success';
  return { open: 'success', notStarted: 'info', deadlinePassed: 'neutral', closed: 'neutral' }[card.signup.state] || '';
}
function idOf(ref, key) { return ref && ref.id ? ref.id : Number(String(key || '').split(':')[1]) || 0; }
function eventTarget(card) {
  const ref = card.ref || {};
  return ref.source === 'community'
    ? { page: 'detail', params: { collection: 'community-posts', id: idOf(ref, card.key), category: 'event' } }
    : { page: 'detail', params: { collection: 'events', id: idOf(ref, card.key), slug: ref.slug || '' } };
}
function event(card) {
  const p = beijing(card.startAt);
  const target = eventTarget(card);
  const tone = signupTone(card);
  return {
    key: card.key, title: card.title, summary: card.summary || '',
    community: card.community ? card.community.title : '', hue: card.community ? hue(card.community.hue) : 262, club: !card.community,
    team: card.team ? card.team.title : '', category: card.category || '',
    month: p ? p.m + '月' : '时间', day: p ? pad(p.d) : '待定', week: p ? p.w : '', dayKey: p ? p.key : 'tbd', dayLabel: dayLabel(card.startAt),
    when: card.startAt ? range(card.startAt, card.endAt) : card.publishedAt ? '发布于 ' + dateText(card.publishedAt) : '时间待定',
    location: card.location || '', state: card.state, stateLabel: card.stateLabel, stateTone: eventTone[card.state] || 'neutral',
    signupLabel: card.signup.mode === 'none' || !tone ? '' : card.signup.viewerSubmitted ? '已报名' : card.signup.label, signupTone: tone,
    soon: card.state === 'upcoming' ? countdown(card.startAt) : '',
    deadline: card.signup.state === 'open' && card.signup.deadline && !card.signup.viewerSubmitted ? deadline(card.signup.deadline) : '',
    promoted: card.promoted, demo: card.demo, ended: card.state === 'ended' || card.state === 'cancelled',
    coverSrc: card.cover ? card.cover.src : '', page: target.page, params: target.params,
    // Personal archive target for 我的赛程; it never changes the signup itself.
    archiveTarget: card.key, archived: false, archiving: false,
  };
}
function articleTarget(card) {
  const ref = card.ref || {};
  if (card.kind === 'communityNotice') return { page: 'detail', params: { collection: 'community-posts', id: idOf(ref, card.key), category: 'notice' } };
  const collection = { announcement: 'announcements', news: 'news', album: 'albums' }[card.kind] || 'announcements';
  return { page: 'detail', params: { collection, id: idOf(ref, card.key), slug: ref.slug || '' } };
}
function article(card) {
  const target = articleTarget(card);
  return { key: card.key, kind: 'article', label: card.label, title: card.title, summary: card.summary || '', community: card.community ? card.community.title : '',
    hue: card.community ? hue(card.community.hue) : 262, date: shortDate(card.publishedAt), dateText: dateText(card.publishedAt), promoted: card.promoted, demo: card.demo,
    coverSrc: card.cover ? card.cover.src : '', page: target.page, params: target.params };
}
const showcaseStatus = { visible: ['已展示', 'success'], pending: ['待审核', 'warning'], hidden: ['已隐藏', 'neutral'], rejected: ['已退回', 'danger'] };
function showcase(card) {
  const status = showcaseStatus[card.status] || ['', 'neutral'];
  return { key: card.key, kind: 'showcase', label: '风采', title: card.title, community: card.community.title, hue: hue(card.community.hue), author: card.authorName,
    date: shortDate(card.createdAt), dateText: dateText(card.createdAt), statusLabel: status[0], statusTone: status[1], status: card.status,
    count: card.images.length, video: Boolean(card.video), initial: initial(card.title),
    coverSrc: card.images[0] ? card.images[0].image.src : '', page: 'detail', params: { collection: 'community-showcase', id: card.id } };
}
function honor(card) {
  return { key: card.key, kind: 'honor', label: '荣誉', title: card.title || card.competition, competition: card.competition, placing: card.placing || '荣誉',
    team: card.team.title, teamID: card.team.id, hue: card.team.community ? hue(card.team.community.hue) : 262, date: card.date ? dateText(card.date) : '日期待补',
    year: card.date ? card.date.substring(0, 4) : '日期待补', legacy: card.legacy, coverSrc: card.images[0] ? card.images[0].src : '',
    page: 'team-honors', params: { team: card.team.id } };
}
function feed(item) {
  if (item.kind === 'honor') return honor(item.item);
  if (item.kind === 'showcase') return showcase(item.item);
  return article(item.item);
}
function community(card) {
  const counts = card.counts, facts = [];
  if (counts.upcomingEvents > 0) facts.push('即将活动 ' + counts.upcomingEvents);
  if (counts.teams > 0) facts.push('队伍 ' + counts.teams);
  if (counts.showcase > 0) facts.push('风采 ' + counts.showcase);
  return { key: 'community:' + card.community.id, slug: card.community.slug, title: card.community.title, summary: card.summary || '', hue: hue(card.community.hue),
    initial: initial(card.community.title), facts: facts.join(' · ') || '进入社群查看最新安排', officer: Boolean(card.viewer && card.viewer.isOfficer), demo: card.demo,
    coverSrc: card.cover ? card.cover.src : '', page: 'community', params: { slug: card.community.slug } };
}
const teamTone = { active: 'success', resting: 'warning', archived: 'neutral', unestablished: 'info' };
function team(card) {
  return { key: 'team:' + card.team.id, id: card.team.id, slug: card.team.slug, title: card.team.title, summary: card.summary || '', initial: initial(card.team.title),
    community: card.team.community ? card.team.community.title : '', hue: card.team.community ? hue(card.team.community.hue) : 262,
    statusLabel: card.statusLabel, statusTone: teamTone[card.status] || 'neutral', members: card.counts.publicMembers, honors: card.counts.honors,
    roster: card.roster.map(person => initial(person.name)).slice(0, 5), mine: Boolean(card.viewer && card.viewer.membership === 'active'),
    call: card.openRecruitment ? { id: card.openRecruitment.id, title: card.openRecruitment.title, deadline: deadline(card.openRecruitment.deadline) } : null,
    demo: card.demo, page: 'team-home', params: { slug: card.team.slug } };
}
const callTone = { open: 'success', upcoming: 'info', closed: 'neutral' };
function recruitment(card) {
  return { key: card.key, kind: card.kind, kindLabel: card.kind === 'staff' ? '骨干招新' : '代表队选拔', title: card.title, summary: card.summary || '',
    team: card.team ? card.team.title : '', hue: card.community ? hue(card.community.hue) : 262, stateLabel: card.stateLabel, stateTone: callTone[card.state] || 'neutral',
    deadline: card.state === 'open' ? deadline(card.deadline) : card.state === 'upcoming' && card.opensAt ? dateTime(card.opensAt) + ' 开放' : '',
    mine: card.viewerApplication ? card.viewerApplication.statusLabel : '', page: 'signup', params: { kind: card.kind === 'staff' ? 'staff' : 'team', id: idOf(card.ref, card.key) } };
}
function application(item) {
  return { key: item.key, category: item.categoryLabel, title: item.title, statusLabel: item.statusLabel, tone: item.tone, next: item.next, href: item.href, web: item.webOnly === true,
    steps: item.steps.map((step, index) => ({ label: step.label, state: step.state, index: index + 1 })),
    archiveTarget: item.key, archived: item.archived === true, archiving: false };
}
// 全部报名 rows. archiveTarget mirrors EventCard.key; archiving only hides the activity from 我的赛程.
function receipt(card) {
  const view = card.event ? event(card.event) : null;
  return { key: card.key, title: card.eventTitle, event: view, when: view ? view.when : '活动已撤下',
    submitted: dateTime(card.submittedAt), updated: card.updatedAt !== card.submittedAt ? dateTime(card.updatedAt) : '',
    statusLabel: card.editable ? '可修改' : card.event ? '已提交' : '活动已撤下', statusTone: card.editable ? 'success' : 'neutral',
    page: view ? view.page : '', params: view ? view.params : null,
    archiveTarget: typeof card.archiveTarget === 'string' ? card.archiveTarget : '', archived: card.archived === true, archiving: false };
}
function groupByDay(views) {
  const groups = [];
  views.forEach(view => {
    let group = groups.find(entry => entry.key === view.dayKey);
    if (!group) { group = { key: view.dayKey, label: view.dayLabel, items: [] }; groups.push(group); }
    group.items.push(view);
  });
  return groups;
}
function today(beijingDate) {
  const parts = String(beijingDate || '').split('-').map(Number);
  if (parts.length !== 3 || !parts[0]) return '';
  return parts[1] + '月' + parts[2] + '日 ' + WEEK[new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay()];
}
module.exports = { get, post, query, beijing, dayLabel, dateText, dateTime, shortDate, range, countdown, deadline, initial,
  event, article, showcase, honor, feed, community, team, recruitment, application, receipt, groupByDay, today };
