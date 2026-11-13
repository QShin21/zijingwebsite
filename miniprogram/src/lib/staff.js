const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();
const questionnaire = require('./questionnaire');
const { date } = require('./format');
const labelsZh = { submitted: '已提交', reviewing: '选拔处理中', returned: '待补充', accepted: '已录用', rejected: '未录用', withdrawn: '已撤回' };
const labelsEn = { submitted: 'Submitted', reviewing: 'In review', returned: 'Needs more info', accepted: 'Accepted', rejected: 'Not accepted', withdrawn: 'Withdrawn' };
// Read at access time so the current language applies.
const labels = {};
Object.keys(labelsZh).forEach(key => Object.defineProperty(labels, key, { enumerable: true, get: () => i18n.t(labelsZh[key], labelsEn[key]) }));
// Keep internal review notes, request keys and history out of page data.
function receipt(value) {
  if (!value) return null;
  const clean = {};
  for (const key of ['id', 'batch', 'batchTitle', 'memberName', 'status', 'createdAt', 'updatedAt', 'formVersion', 'questions', 'answers', 'feedback']) {
    if (value[key] !== undefined) clean[key] = value[key];
  }
  return { ...questionnaire.receipt(clean), statusText: labels[value.status] || i18n.t('状态待确认', 'Status pending'), updatedText: date(value.updatedAt) };
}
module.exports = { receipt, labels };
