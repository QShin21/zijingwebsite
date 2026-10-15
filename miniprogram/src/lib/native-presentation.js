// Native display projections only. Keep source objects, actions and permissions intact.
const format = require('./format');

function calendar(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return { known: false, label: '时间待公布' };
  const local = new Date(Date.parse(value) + 8 * 60 * 60 * 1000);
  return {
    known: true,
    year: String(local.getUTCFullYear()),
    month: `${local.getUTCMonth() + 1}月`,
    day: String(local.getUTCDate()).padStart(2, '0'),
    weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][local.getUTCDay()],
    time: `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`,
    label: format.date(value),
  };
}

function content(doc) {
  if (doc.collection !== 'events') return doc;
  // A published/created date is not an activity date. Unknown starts stay unknown.
  const nativeDate = calendar(doc.startAt);
  const hasChannel = format.safeURL(doc.registrationURL) || Boolean((doc.channelText || '').trim());
  return {
    ...doc,
    nativeDate,
    nativeEnd: doc.endAt ? format.date(doc.endAt) : '',
    // The list API does not expose questionnaire state or the user's receipt.
    // Qualify the existing public channel state rather than inventing either.
    nativeChannel: hasChannel ? `公开渠道：${format.registrationState(doc)}` : '',
    nativeDeadline: doc.registrationEnd ? format.date(doc.registrationEnd) : '',
  };
}

function hasContactImage(contacts) {
  return Array.isArray(contacts) && contacts.some(contact => Boolean(contact && contact.image && !contact.imageError));
}

function markCoverFailure(docs, source = {}) {
  if (!Array.isArray(docs) || !source.url || source.id === undefined || !source.collection) return docs;
  let changed = false;
  const next = docs.map(doc => {
    if (String(doc.id) !== String(source.id) || doc.collection !== source.collection ||
        !doc.coverImage || doc.coverImage.url !== source.url || doc.nativeCoverError) return doc;
    changed = true;
    return { ...doc, nativeCoverError: true };
  });
  return changed ? next : docs;
}

module.exports = { calendar, content, hasContactImage, markCoverFailure };
