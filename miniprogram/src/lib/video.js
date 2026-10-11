const config = require('../config');
function source(value) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (/^\/api\/showcase-videos\/[0-9a-f-]{36}\.mp4$/.test(url)) return config.origin + url;
  if (/^https:\/\/[^/@\s:#?]+(?:\/[^\s#]*)?\.mp4(?:\?[^\s#]*)?$/i.test(url)) return url;
  return '';
}
module.exports = { source };
