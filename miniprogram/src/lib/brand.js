const name = '竞在紫荆';
// Normalize this client's display text without changing shared website content.
function display(value, key) {
  if (typeof value === 'string') {
    if (/url|path|slug|token|password|email|^id$|wechatQr/i.test(key || '') || /^(?:https?:|data:|wxfile:)/i.test(value)) return value;
    return value.replace(/(?:清华大学学生)?紫荆电竞社/g, name);
  }
  if (Array.isArray(value)) return value.map(item => display(item, key));
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).forEach(field => { result[field] = display(value[field], field); });
    return result;
  }
  return value;
}
module.exports = { name, display };
