const http = require('./http');
const questionnaire = require('./questionnaire');
const { date } = require('./format');
const labels = { draft: '草稿', pending: '待审核', returned: '待补充', rejected: '未通过', withdrawn: '已撤回', approved: '已批准' };
function receipt(value) {
  if (!value) return null;
  const clean = {};
  for (const key of ['id', 'title', 'status', 'teamID', 'recruitmentID', 'createdAt', 'updatedAt', 'formVersion', 'answers', 'reviewNote']) {
    if (value[key] !== undefined) clean[key] = value[key];
  }
  const form = questionnaire.normalizeSignup(value.formSnapshot);
  return { ...questionnaire.receipt({ ...clean, answers: clean.answers || {}, questions: form.questions }),
    feedback: value.reviewNote || '', statusText: labels[value.status] || '状态待确认', updatedText: date(value.updatedAt) };
}
function post(data) {
  return http.request('/api/team-core', { raw: true, required: true, questionnaire: true, method: 'POST', data });
}
module.exports = { receipt, labels, post };
