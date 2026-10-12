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
  const method = options.method === undefined ? 'GET' : options.method;
  if (!['OPTIONS', 'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'TRACE', 'CONNECT'].includes(method)) return Promise.reject(new Error('请求方式不受小程序支持'));
  const credential = options.auth === false ? '' : session.token();
  if (options.required && !credential) return Promise.reject(Object.assign(new Error('请先登录'), { status: 401 }));
  return new Promise((resolve, reject) => {
    wx.request({
      url: url(path), method, data: options.data,
      timeout: options.timeout || 20000,
      header: { 'content-type': 'application/json', ...(credential ? { Authorization: `JWT ${credential}` } : {}), ...(options.questionnaire ? { 'x-questionnaire-version': '3' } : {}),
        ...(options.siteWrite === true && options.required && credential && ['POST', 'PUT', 'DELETE'].includes(method) ? { Origin: config.origin } : {}) },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
            reject(Object.assign(new Error('此功能需要更新网站服务接口'), { status: 404 }));
          } else resolve(options.raw ? response.data : brand.display(response.data));
        } else {
          if (response.statusCode === 401 && credential && session.token() === credential) session.clear();
          reject(Object.assign(new Error(message(response.data, response.statusCode)), { status: response.statusCode,
            ...(response.statusCode === 409 && response.data && response.data.code === 'PROFILE_PERIOD_CHANGED' ? { code: 'PROFILE_PERIOD_CHANGED' } : {}) }));
        }
      },
      fail() { reject(new Error('连接失败，请检查网络后重试')); },
    });
  });
}
function taskCallbacks(task, options) {
  try { if (typeof options.onTask === 'function') options.onTask(task); } catch { /* Observers must not lose an in-flight write acknowledgement. */ }
  if (task && typeof task.onProgressUpdate === 'function' && typeof options.onProgress === 'function') task.onProgressUpdate(value => {
    try { options.onProgress(value); } catch { /* UI observers do not change the transport outcome. */ }
  });
}
function upload(path, filePath, options = {}) {
  const credential = session.token();
  if (!credential) return Promise.reject(Object.assign(new Error('请先登录'), { status: 401 }));
  return new Promise((resolve, reject) => {
    // The SDK supplies the multipart boundary; a JSON Content-Type would corrupt this body.
    const task = wx.uploadFile({
      url: url(path), filePath, name: options.name || 'file', formData: options.formData || {},
      timeout: options.timeout || 60000, header: { Authorization: `JWT ${credential}` },
      success(response) {
        let data;
        try { data = JSON.parse(response.data); } catch {
          if (response.statusCode === 401 && session.token() === credential) session.clear();
          reject(Object.assign(new Error(response.statusCode >= 400 ? message(null, response.statusCode) : '上传结果暂不可用，请重新加载核对'), { status: response.statusCode }));
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(options.raw ? data : brand.display(data));
        else {
          if (response.statusCode === 401 && session.token() === credential) session.clear();
          reject(Object.assign(new Error(message(data, response.statusCode)), { status: response.statusCode }));
        }
      },
      fail() { reject(new Error('上传未完成，请检查网络并重新加载核对')); },
    });
    taskCallbacks(task, options);
  });
}
function download(path, options = {}) {
  const credential = session.token();
  if (!credential) return Promise.reject(Object.assign(new Error('请先登录'), { status: 401 }));
  return new Promise((resolve, reject) => {
    const task = wx.downloadFile({
      url: url(path), header: { Authorization: `JWT ${credential}` },
      ...(options.filePath ? { filePath: options.filePath } : {}),
      ...(options.timeout ? { timeout: options.timeout } : {}),
      success(result) {
        if (result.statusCode === 200) resolve(options.filePath ? result.filePath : result.tempFilePath);
        else {
          if (result.statusCode === 401 && session.token() === credential) session.clear();
          reject(Object.assign(new Error('图片暂不可用'), { status: result.statusCode }));
        }
      }, fail() { reject(new Error('图片加载失败')); },
    });
    taskCallbacks(task, options);
  });
}
module.exports = { request, upload, download, url, message };
