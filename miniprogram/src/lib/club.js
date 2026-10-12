const http = require('./http');
async function load() {
  const value = await http.request('/api/miniapp/club', { auth: false });
  if (!value || !Array.isArray(value.staffBatches) || !value.promotions) throw new Error('社团入口暂不可用，请重试');
  return value;
}
module.exports = { load };
