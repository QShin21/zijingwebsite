const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();
const http = require('./http');
const questionnaire = require('./questionnaire');
const { date } = require('./format');
const labelsZh = { draft: '草稿', pending: '待审核', returned: '待补充', rejected: '未通过', withdrawn: '已撤回', approved: '已批准' };
const labelsEn = { draft: 'Draft', pending: 'Pending review', returned: 'Needs more info', rejected: 'Not approved', withdrawn: 'Withdrawn', approved: 'Approved' };
// Read at access time so the current language applies.
const labels = {};
Object.keys(labelsZh).forEach(key => Object.defineProperty(labels, key, { enumerable: true, get: () => i18n.t(labelsZh[key], labelsEn[key]) }));
function receipt(value) {
  if (!value) return null;
  const clean = {};
  for (const key of ['id', 'title', 'status', 'teamID', 'recruitmentID', 'createdAt', 'updatedAt', 'formVersion', 'answers', 'reviewNote']) {
    if (value[key] !== undefined) clean[key] = value[key];
  }
  const form = questionnaire.normalizeSignup(value.formSnapshot);
  return { ...questionnaire.receipt({ ...clean, answers: clean.answers || {}, questions: form.questions }),
    feedback: value.reviewNote || '', statusText: labels[value.status] || i18n.t('状态待确认', 'Status pending'), updatedText: date(value.updatedAt) };
}
function post(data) {
  return http.request('/api/team-core', { raw: true, required: true, questionnaire: true, method: 'POST', data });
}
module.exports = { receipt, labels, post };
