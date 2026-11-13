// 个人归档：仅本人展示偏好，跨网站与小程序同步。设置为明确的归档/未归档值（非切换），
// 不取消报名、不撤回申请、不改变审核状态。
const v2 = require('./v2');
const pattern = /^(staff|teamJoin|teamEstablishment|communityOfficer|club|community):[1-9]\d{0,9}$/;
function valid(target) { return typeof target === 'string' && pattern.test(target); }
function set(target, archived) {
  if (!valid(target) || typeof archived !== 'boolean') return Promise.reject(new Error('归档对象无效'));
  return v2.post('me/archive', { target, archived });
}
// Flip the archive flag of one row in a list without mutating the original.
function mark(list, target, patch) {
  return (list || []).map(item => item.archiveTarget === target ? Object.assign({}, item, patch) : item);
}
module.exports = { valid, set, mark };
