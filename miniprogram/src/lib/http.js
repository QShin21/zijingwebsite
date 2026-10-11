const config = require('../config');
const session = require('./session');
const brand = require('./brand');

function url(path) {
  if (typeof path !== 'string' || !/^\/(?!\/)/.test(path) || /[\s\\]/.test(path) ||
      Array.from(path).some(char => char.charCodeAt(0) < 32)) throw new Error('请求地址无效');
  return config.origin + path;
}
function message(data, status) {
  if (status === 401) return '请先登录可用账号';
  if (status === 403) return '当前账号没有此操作权限';
  if (status === 404) return '内容暂不可用';
  if (status === 429) return '请求较多，请稍后再试';
  // Server exceptions and stack traces never enter the page.
  if (status >= 500) return '服务暂时不可用，请稍后重试';
  const errors = data && data.errors;
  const value = data && (data.error || (errors && errors[0] && errors[0].message));
  return typeof value === 'string' && value.length <= 200 && !/stack|SQL|SELECT|password|secret/i.test(value)
    ? value : '操作未完成，请核对内容后重试';
}
function request(path, options = {}) {
  const credential = options.auth === false ? '' : session.token();
  if (options.required && !credential) return Promise.reject(Object.assign(new Error('请先登录'), { status: 401 }));
  return new Promise((resolve, reject) => {
    wx.request({
      url: url(path), method: options.method || 'GET', data: options.data,
      timeout: options.timeout || 20000,
      header: { 'content-type': 'application/json', ...(credential ? { Authorization: `JWT ${credential}` } : {}) },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
            reject(Object.assign(new Error('此功能需要更新网站服务接口'), { status: 404 }));
          } else resolve(brand.display(response.data));
        } else {
          if (response.statusCode === 401 && credential) session.clear();
          reject(Object.assign(new Error(message(response.data, response.statusCode)), { status: response.statusCode }));
        }
      },
      fail() { reject(new Error('连接失败，请检查网络后重试')); },
    });
  });
}
function download(path) {
  const credential = session.token();
  if (!credential) return Promise.reject(new Error('请先登录'));
  return new Promise((resolve, reject) => wx.downloadFile({
    url: url(path), header: { Authorization: `JWT ${credential}` },
    success(result) {
      if (result.statusCode === 200) resolve(result.tempFilePath);
      else reject(new Error('图片暂不可用'));
    }, fail() { reject(new Error('图片加载失败')); },
  }));
}
module.exports = { request, download, url, message };
