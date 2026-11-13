const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();
// Presentation only: keep the original record, navigation and access fields intact.
const format = require('./format');
const presentation = require('./native-presentation');

const catalogs = {
  events: [['活动', '查看活动时间、参与条件与报名方式。', '活动日程'], ['Events', 'See event times, eligibility and how to sign up.', 'Event schedule']],
  announcements: [['通知', '查阅社团发布的通知与安排。', '通知索引'], ['Notices', 'Read notices and arrangements from the club.', 'Notice index']],
  news: [['社团动态', '阅读社团近况，回看已经发生的共同经历。', '动态索引'], ['Club news', 'Catch up on club news and shared moments.', 'News index']],
  pages: [['社团资料', '查阅已经发布的社团介绍与说明。', '资料索引'], ['Club info', 'Read published club introductions and guides.', 'Info index']],
  teams: [['代表队', '认识代表队，查阅队伍介绍、赛季与公开资料。', '代表队档案'], ['Teams', 'Meet the teams: profiles, seasons and public records.', 'Team profiles']],
  recruitment: [['招新批次', '查看参与条件、截止时间与报名渠道。', '招新批次'], ['Recruitment', 'See eligibility, deadlines and sign-up channels.', 'Recruitment']],
  honors: [['荣誉档案', '按赛事日期查阅已核验的项目与成果。', '已核验档案'], ['Honors', 'Verified results by competition date.', 'Verified records']],
  albums: [['影像', '浏览活动相册，查看照片与记录。', '活动相册'], ['Gallery', 'Browse event albums and photos.', 'Event albums']],
  seasons: [['赛季阵容', '查阅各赛季已经公开的阵容与记录。', '赛季档案'], ['Season rosters', 'Public rosters and records for each season.', 'Season records']],
  games: [['游戏项目', '查阅已经发布的游戏项目介绍。', '项目索引'], ['Games', 'Read published game introductions.', 'Game index']],
  'club-showcase': [['社群风采 · 社团展示', '来自游戏社群的共同经历。每条记录保留原社群与原文。', '社群风采'], ['Community showcase · Club display', 'Shared moments from game communities, each with its original community and text.', 'Community showcase']],
};

function catalog(collection) {
  const pair = catalogs[collection] || [['栏目', '查阅已经发布的社团记录。', '已发布内容'], ['Section', 'Browse published club records.', 'Published content']];
  const [zh, en] = pair;
  return { title: i18n.t(zh[0], en[0]), intro: i18n.t(zh[1], en[1]), resultTitle: i18n.t(zh[2], en[2]) };
}

function dateParts(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return { known: false, text: i18n.t('待公布', 'TBA'), year: '', day: '' };
  const text = format.date(value, true);
  return { known: true, text, year: text.slice(0, 4), day: text.slice(5) };
}

function entry(doc) {
  const collection = doc.collection;
  // An archive's event date must never be borrowed from its publication date.
  const date = dateParts(collection === 'honors' ? doc.date : collection === 'events' ? doc.startAt : doc.publishedAt || doc.createdAt || doc.date);
  return { ...presentation.content(doc), nativeReading: {
    date,
    deadline: collection === 'recruitment' && doc.registrationEnd ? format.date(doc.registrationEnd) : '',
    action: i18n.locale() === 'en'
      ? { teams: 'View team profile', honors: 'View achievement', recruitment: 'How to take part', albums: 'Open album', seasons: 'View season roster', games: 'View game intro' }[collection] || 'Read more'
      : { teams: '查看队伍档案', honors: '查看成果记录', recruitment: '查看参与方式', albums: '打开相册', seasons: '查看赛季阵容', games: '查看项目介绍' }[collection] || '阅读全文',
  } };
}

function article(doc, collection) {
  const scheduled = collection === 'events' || Boolean(doc.startAt);
  const value = scheduled ? doc.startAt : collection === 'honors' ? doc.date : doc.publishedAt || doc.createdAt || doc.date;
  return {
    label: doc.kindText || (i18n.locale() === 'en'
      ? { events: 'Event details', teams: 'Team profile', seasons: 'Season roster', honors: 'Honors', albums: 'Event album', news: 'Club news', announcements: 'Club notice', recruitment: 'Recruitment', pages: 'Club info', games: 'Games', 'community-posts': 'Community update', 'community-showcase': 'Community showcase' }[collection] || 'Club post'
      : { events: '活动详情', teams: '代表队档案', seasons: '赛季阵容', honors: '荣誉档案', albums: '活动相册', news: '社团动态', announcements: '社团通知', recruitment: '招新批次', pages: '社团资料', games: '游戏项目', 'community-posts': '社群近况', 'community-showcase': '社群风采' }[collection] || '社团发布'),
    scheduled,
    dateLabel: scheduled ? i18n.t('活动开始', 'Starts') : collection === 'honors' ? i18n.t('赛事日期', 'Match date') : i18n.t('发布时间', 'Published'),
    dateText: format.date(value),
    date: dateParts(value),
  };
}

const proseStyles = {
  p: 'margin:0 0 18px;font-size:16px;line-height:1.85;',
  h1: 'margin:28px 0 14px;font-size:23px;line-height:1.45;font-weight:650;',
  h2: 'margin:28px 0 14px;font-size:21px;line-height:1.45;font-weight:650;',
  h3: 'margin:24px 0 12px;font-size:19px;line-height:1.5;font-weight:650;',
  h4: 'margin:20px 0 12px;font-size:17px;line-height:1.55;font-weight:650;',
  h5: 'margin:20px 0 12px;font-size:16px;line-height:1.6;font-weight:650;',
  h6: 'margin:20px 0 12px;font-size:16px;line-height:1.6;font-weight:650;',
  blockquote: 'margin:20px 0;padding:4px 0 4px 16px;border-left:3px solid var(--z-secondary-border);font-size:16px;line-height:1.85;',
  ul: 'margin:14px 0 20px;padding-left:24px;font-size:16px;line-height:1.85;',
  ol: 'margin:14px 0 20px;padding-left:24px;font-size:16px;line-height:1.85;',
  li: 'margin:6px 0;font-size:16px;line-height:1.85;',
  code: 'font-size:15px;line-height:1.8;word-break:break-word;',
};

function prose(nodes) {
  return (nodes || []).map(node => {
    if (!node || typeof node !== 'object') return node;
    const style = proseStyles[node.name];
    return { ...node,
      ...(style ? { attrs: { ...node.attrs, style: ((node.attrs && node.attrs.style) || '') + style } } : {}),
      ...(Array.isArray(node.children) ? { children: prose(node.children) } : {}),
    };
  });
}

module.exports = { catalog, dateParts, entry, article, prose };
