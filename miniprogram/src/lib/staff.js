const questionnaire = require('./questionnaire');
const { date } = require('./format');
const labels = { submitted: '已提交', reviewing: '选拔处理中', returned: '待补充', accepted: '已录用', rejected: '未录用', withdrawn: '已撤回' };
// Keep internal review notes, request keys and history out of page data.
function receipt(value) {
  if (!value) return null;
  const clean = {};
  for (const key of ['id', 'batch', 'batchTitle', 'memberName', 'status', 'createdAt', 'updatedAt', 'formVersion', 'questions', 'answers', 'feedback']) {
    if (value[key] !== undefined) clean[key] = value[key];
  }
  return { ...questionnaire.receipt(clean), statusText: labels[value.status] || '状态待确认', updatedText: date(value.updatedAt) };
}
module.exports = { receipt, labels };
