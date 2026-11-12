function date(value, short = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return '待公布';
  const time = new Date(Date.parse(value) + 8 * 60 * 60 * 1000);
  const pad = number => String(number).padStart(2, '0');
  return `${time.getUTCFullYear()}.${pad(time.getUTCMonth() + 1)}.${pad(time.getUTCDate())}` +
    (short ? '' : ` ${pad(time.getUTCHours())}:${pad(time.getUTCMinutes())}`);
}
function safeURL(value) {
  // URL is not available on every Mini Program engine.
  return typeof value === 'string' && /^https:\/\/[a-z0-9.-]+(?::443)?(?:[/?#]|$)/i.test(value) &&
    !/[\s\\]/.test(value) && !Array.from(value).some(char => char.charCodeAt(0) < 32);
}
function eventState(doc, now = Date.now()) {
  if (doc.lifecycle === 'cancelled') return '已取消';
  if (doc.lifecycle === 'postponed') return '已延期';
  if (doc.lifecycle === 'ended' || (doc.endAt && now >= Date.parse(doc.endAt))) return '已结束';
  if (doc.startAt && now >= Date.parse(doc.startAt)) return '进行中';
  return '即将开始';
}
function registrationState(doc, now = Date.now()) {
  if (doc._status !== 'published' || doc.archived || doc.registrationClosed ||
      (doc.endAt && now >= Date.parse(doc.endAt)) || ['cancelled', 'postponed', 'ended'].includes(doc.lifecycle)) return '已关闭';
  if (!safeURL(doc.registrationURL) && !(doc.channelText || '').trim()) return '暂无报名渠道';
  if (doc.registrationStart && now < Date.parse(doc.registrationStart)) return '尚未开始';
  if (doc.registrationEnd && now >= Date.parse(doc.registrationEnd)) return '已截止';
  return '报名开放';
}
function card(doc, collection) {
  return { ...doc, collection, dateText: date(doc.startAt || doc.date || doc.publishedAt || doc.createdAt, true),
    statusText: collection === 'events' ? eventState(doc) : collection === 'recruitment' ? registrationState(doc) : '',
    kindText: { members: '普通社员', teams: '代表队选拔', staff: '骨干招新' }[doc.kind] || doc.type || '' };
}
const beijingOffset = 8 * 60 * 60 * 1000;

function beijingParts(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return { date: '', time: '', value: '' };
  const local = new Date(timestamp + beijingOffset).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16), value };
}
module.exports = { date, safeURL, eventState, registrationState, card, beijingParts };
