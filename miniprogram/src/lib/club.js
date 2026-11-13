const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();
const http = require('./http');
async function load() {
  const value = await http.request('/api/miniapp/club', { auth: false });
  if (!value || !Array.isArray(value.staffBatches) || !value.promotions) throw new Error(i18n.t('社团入口暂不可用，请重试', 'Club entry is unavailable. Please try again.'));
  return value;
}
module.exports = { load };
