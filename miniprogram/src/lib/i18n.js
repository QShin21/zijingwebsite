// Device-local interface language (zh / en). User and CMS content is never translated here;
// published activity/notice text is localized by the server from the x-zijing-locale header.
const KEY = 'zijing_locale';
const LOCALES = ['zh', 'en'];
let current = null;
let listeners = [];

function read() {
  try {
    const stored = typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function' ? wx.getStorageSync(KEY) : '';
    return LOCALES.includes(stored) ? stored : 'zh';
  } catch { return 'zh'; }
}
function locale() {
  if (current === null) current = read();
  return current;
}
function subscribe(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(value => value !== fn); };
}
function setLocale(value) {
  const next = value === 'en' ? 'en' : 'zh';
  current = next;
  let persisted = true;
  try { wx.setStorageSync(KEY, next); } catch { persisted = false; }
  listeners.slice().forEach(fn => { try { fn(next); } catch { /* One page must not stop the others from updating. */ } });
  return { locale: next, persisted };
}
/** Chinese stays the default and the fallback for missing English. */
function t(zh, en) {
  return locale() === 'en' && typeof en === 'string' && en ? en : zh;
}
/**
 * dict: { key: ['中文', 'English'] } -> { key: localized }. An explicit '' English value is kept
 * (used for word-order affixes such as zh '第 ' / ' 名'); a missing English value falls back to Chinese.
 */
function text(dict) {
  const en = locale() === 'en', result = {};
  Object.keys(dict || {}).forEach(key => {
    const pair = dict[key];
    result[key] = en && pair && typeof pair[1] === 'string' ? pair[1] : pair && pair[0];
  });
  return result;
}
function message(chinese) {
  if (locale() !== 'en' || typeof chinese !== 'string' || !chinese) return chinese;
  return require('./i18n-messages').translate(chinese);
}
// Server error for display: known messages are translated; an unknown Chinese message gets a
// stable English sentence by HTTP status plus the original in parentheses. The server
// contract (Chinese text, status, codes) is unchanged and nothing is sent anywhere.
const statusEnglish = { 400: 'The request was not accepted. Check your input and try again.', 401: 'Please sign in with an active account.',
  403: 'You do not have permission for this action.', 404: 'This content is not available.', 409: 'The content was updated or already handled. Refresh and try again.',
  413: 'The request is too large.', 415: 'This file format is not supported.', 429: 'Too many requests. Please try again later.' };
function error(chinese, status) {
  const translated = message(chinese);
  if (locale() !== 'en' || translated !== chinese || typeof chinese !== 'string' || !/[\u3400-\u9fff]/.test(chinese)) return translated;
  const generic = status >= 500 ? 'The service is temporarily unavailable. Please try again later.' : statusEnglish[status] || 'The action could not be completed.';
  return generic + ' (' + chinese + ')';
}

// Strings shared by templates/*.wxml; merged into every bound page's `t`.
const common = {
  // templates/v2.wxml personal archive controls
  cArchive: ['归档', 'Archive'], cUnarchive: ['撤销归档', 'Unarchive'], cArchived: ['已归档', 'Archived'], cColon: ['：', ': '],
  // templates/common.wxml
  cReading: ['正在读取内容', 'Loading content'],
  cLoginTitle: ['登录后继续', 'Sign in to continue'],
  cLoginBody: ['使用紫荆账号登录，完成后回到当前页面。', 'Sign in with your Zijing account to return to this page.'],
  cLoginAction: ['登录账号', 'Sign in'],
  cErrorTitle: ['内容暂时未能读取', 'Content could not be loaded'],
  cRetry: ['重新加载', 'Reload'],
  cEventDate: ['活动日期', 'Event date'],
  cMatchDate: ['赛事日期', 'Match date'],
  cDemo: ['演示资料', 'Demo'],
  cActionEvent: ['活动详情与报名', 'Details and sign-up'],
  cActionTeam: ['查看队伍档案', 'View team profile'],
  cActionHonor: ['查看成果记录', 'View achievement'],
  cActionRecruitment: ['查看参与方式', 'How to take part'],
  cActionRead: ['阅读全文', 'Read more'],
  cEmptyTitle: ['暂无已发布内容', 'Nothing published yet'],
  cEmptyHint: ['新内容发布后会出现在这里，可稍后下拉刷新。', 'New content will appear here. Pull down to refresh later.'],
  // templates/native.wxml
  cTime: ['时间', 'Time'],
  cTba: ['待公布', 'TBA'],
  cStartsSuffix: [' 开始', ' start'],
  cDeadlinePrefix: ['报名截止 ', 'Sign-up closes '],
  cEndPrefix: ['结束 ', 'Ends '],
  cCoverFallback: ['封面暂时无法显示，仍可查看详情。', 'The cover cannot be shown; details are still available.'],
  cEventsEmptyTitle: ['活动日程正在准备', 'Schedule in preparation'],
  cEventsEmptyHint: ['新活动发布后会出现在这里，也可先去寻找游戏社群。', 'New events will appear here. Meanwhile, explore game communities.'],
  cFeatured: ['精选', 'Featured'],
  cOpenCommunityPost: ['查看社群原文', 'View community post'],
  cNotices: ['社团通知', 'Club notices'],
  cAllNotices: ['全部通知', 'All notices'],
  cNoNotices: ['暂时没有新通知。', 'No new notices.'],
  // templates/native-content.wxml
  cHonor: ['荣誉', 'Honor'],
  cCoverUnavailable: ['封面暂时无法显示', 'Cover unavailable'],
  cDateTba: ['日期待公布', 'Date TBA'],
  cVerified: ['已核验', 'Verified'],
  cAlbum: ['影像', 'Gallery'],
  cOpenAlbum: ['打开相册', 'Open album'],
  cTeam: ['代表队', 'Team'],
  cRecruitmentBatch: ['招新批次', 'Recruitment'],
  cClosesPrefix: ['截止 ', 'Closes '],
  cLinks: ['文中链接', 'Links in this article'],
  cCopyLink: ['复制链接，在浏览器打开', 'Copy link to open in a browser'],
  // templates/club.wxml
  cStaffHiring: ['正在招募社团骨干', 'Now recruiting club staff'],
  cStaffHiringBody: ['参与执行部与宣传部的社团工作。', 'Join the operations and publicity teams.'],
  cAllBatches: ['全部批次', 'All batches'],
  cStaffRecruitment: ['骨干招新', 'Staff recruitment'],
  cViewBatch: ['查看批次并申请', 'View batch and apply'],
  cClubShowcase: ['社团展示', 'Club showcase'],
  // templates/v2.wxml
  cClubEvent: ['社团活动', 'Club event'],
  cPhotosSuffix: [' 张', ' photos'],
  cOfficer: ['我是管理员', 'I am an admin'],
  cMyTeam: ['我的队伍', 'My team'],
  cMembersPrefix: ['队员 ', 'Members '],
  cHonorsPrefix: ['荣誉 ', 'Honors '],
  cTrialsOpen: ['选拔开放', 'Trials open'],
  cMyApplicationPrefix: ['我的申请：', 'My application: '],
  cLoading: ['正在加载', 'Loading'],
  cLogin: ['登录', 'Sign in'],
  cRegister: ['注册账号', 'Create account'],
  cCommunitySuffix: ['社群', ' community'],
  // templates/questionnaire.wxml
  qOptional: ['（选填）', ' (optional)'],
  qInput: ['请输入', 'Enter text'],
  qPick: ['请选择', 'Choose'],
  qPickDate: ['选择日期', 'Choose date'],
  qPickTime: ['选择时间', 'Choose time'],
  qRankingHint: ['按偏好从高到低选择，每个选项只使用一次。', 'Rank from most to least preferred; use each option once.'],
  qRankPrefix: ['第 ', 'Rank '],
  qRankSuffix: [' 名', ''],
  qGroupHintPrefix: ['填写 ', 'Add '],
  qGroupHintSuffix: [' 条记录；增加记录后请完成其中的必填信息。', ' entries; complete the required fields of each added entry.'],
  qEntryPrefix: ['第 ', 'Entry '],
  qEntrySuffix: [' 条', ''],
  qRemoveEntry: ['移除此条', 'Remove entry'],
  qAddEntry: ['＋ 增加一条', '＋ Add entry'],
  qClearAnswer: ['清除此题答案', 'Clear answer'],
};

function visiblePage(page) {
  // The foreground page is the last entry of the current stack; hidden tab pages and
  // pages under it update their labels now and refresh script-built text when shown.
  try { const pages = getCurrentPages(); return !pages.length || pages[pages.length - 1] === page; } catch { return true; }
}
/**
 * Sets page data { t, locale } and re-applies it whenever the language changes. One
 * subscription per page (re-binding replaces it). The visible page's onLocaleChange runs
 * at once; other pages are marked and run it from onShow via refreshIfStale().
 */
function bind(page, dict) {
  const merged = { ...common, ...(dict || {}) };
  const apply = () => { try { page.setData({ t: text(merged), locale: locale() }); } catch { /* Unloaded page. */ } };
  if (page._i18nOff) page._i18nOff();
  page._i18nApply = apply;
  page._i18nPending = false;
  page._i18nOff = subscribe(() => {
    apply();
    if (visiblePage(page)) { page._i18nPending = false; if (typeof page.onLocaleChange === 'function') page.onLocaleChange(locale()); }
    else page._i18nPending = true;
  });
  apply();
  return page.data && page.data.t;
}
/** Called first in onShow: true once after the language changed while the page was hidden. */
function refreshIfStale(page) {
  if (!page || !page._i18nPending) return false;
  page._i18nPending = false;
  if (typeof page._i18nApply === 'function') page._i18nApply();
  return true;
}
function unbind(page) {
  if (page && page._i18nOff) { page._i18nOff(); page._i18nOff = null; page._i18nPending = false; }
}
function navTitle(zh, en) {
  try { wx.setNavigationBarTitle({ title: t(zh, en), fail() {} }); } catch { /* Title is cosmetic. */ }
}

module.exports = { KEY, locale, setLocale, t, text, message, error, subscribe, common, bind, unbind, navTitle, refreshIfStale };
