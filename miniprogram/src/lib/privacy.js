const session = require('./session');
let registered = false;
let active = null;
// SDK authorization cannot be aborted. Retain its owner until SDK completion,
// including after the visible dialog has been cancelled.
let pendingSDK = null;
const actor = () => String((session.user() || {}).id || '');
const currentPage = () => {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  return pages[pages.length - 1];
};
const unread = () => new Error('隐私授权未完成，图片未读取；可查看隐私说明后重新选择');

// Register once: wx.onNeedPrivacyAuthorization replaces earlier listeners.
function setup() {
  if (registered) return true;
  if (typeof wx.onNeedPrivacyAuthorization !== 'function') return false;
  wx.onNeedPrivacyAuthorization(resolve => {
    const request = pendingSDK;
    if (!request || !request.started || !request.current() || request.sdkResolve) {
      resolve({ event: 'disagree' });
      return;
    }
    request.sdkResolve = resolve;
    request.dialog.waitForAgreement(request);
  });
  registered = true;
  return true;
}
function finish(request, cause) {
  if (active !== request) return;
  active = null;
  if (request.unsubscribe) request.unsubscribe();
  const sdkResolve = request.sdkResolve;
  request.sdkResolve = null;
  request.dialog.close(request);
  if (cause) {
    // Settle the SDK's pending call even when navigation/cancellation happens first.
    try { if (sdkResolve) sdkResolve({ event: 'disagree' }); } catch { /* Still reject the caller. */ }
    request.reject(cause);
  } else request.resolve();
}
// Only called from an explicit choose-image/video action. No file API runs here.
function authorize() {
  if (active) return Promise.reject(new Error('隐私说明正在处理，请先完成或取消当前操作'));
  if (pendingSDK) return Promise.reject(new Error('微信隐私授权正在结束，请稍后重新选择'));
  if (typeof wx.requirePrivacyAuthorize !== 'function' || typeof wx.getPrivacySetting !== 'function' ||
      typeof wx.openPrivacyContract !== 'function' || !setup()) {
    return Promise.reject(new Error('当前微信版本暂不支持隐私授权，请升级微信后重试'));
  }
  const page = currentPage(), who = actor();
  const dialog = page && typeof page.selectComponent === 'function' && page.selectComponent('#privacyConsent');
  if (!who || !dialog || !dialog.available()) return Promise.reject(new Error('页面或账号已更新，请重新操作'));
  return new Promise((resolve, reject) => {
    const request = { dialog, resolve, reject, who, started: false, agreed: false, sdkResolve: null,
      ownsContext: () => active === request && actor() === who && currentPage() === page,
      current: () => active === request && actor() === who && currentPage() === page && dialog.available(),
      cancel: cause => finish(request, cause || unread()),
      start(needAuthorization) {
        if (!request.current() || request.started) return;
        request.started = true;
        pendingSDK = request;
        try { wx.requirePrivacyAuthorize({
          success() {
            if (pendingSDK === request) pendingSDK = null;
            if (active !== request) return;
            if (!request.current() || needAuthorization && !request.agreed) {
              finish(request, new Error('页面或隐私授权状态已更新，请重新操作'));
            } else finish(request);
          },
          fail() { if (pendingSDK === request) pendingSDK = null; finish(request, unread()); },
        }); } catch {
          if (pendingSDK === request) pendingSDK = null;
          finish(request, unread());
        }
      },
      agree(buttonId) {
        if (!request.current() || !request.sdkResolve || request.agreed) return;
        request.agreed = true;
        const sdkResolve = request.sdkResolve; request.sdkResolve = null;
        try { sdkResolve({ event: 'agree', buttonId }); }
        catch { finish(request, unread()); }
      },
    };
    active = request;
    request.unsubscribe = session.subscribe(() => {
      if (actor() !== who) request.cancel(new Error('页面或账号已更新，请重新操作'));
    });
    try { dialog.present(request); } catch (cause) { finish(request, cause); }
  });
}
function setting() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('平台隐私设置读取超时，请重试')), 15000);
    const done = callback => value => { clearTimeout(timer); callback(value); };
    try {
      wx.getPrivacySetting({
        success: done(value => {
          if (!value || typeof value.needAuthorization !== 'boolean' ||
              typeof value.privacyContractName !== 'string' || !value.privacyContractName.trim()) {
            reject(new Error('微信平台隐私指引尚未配置，请联系负责人'));
          } else resolve(value);
        }),
        fail: done(() => reject(new Error('平台隐私设置暂不可用，请重试'))),
      });
    } catch (cause) { clearTimeout(timer); reject(cause); }
  });
}
function openContract() {
  return new Promise((resolve, reject) => {
    if (typeof wx.openPrivacyContract !== 'function') {
      reject(new Error('当前微信版本暂不支持查看平台隐私指引，请升级微信后重试'));
      return;
    }
    wx.openPrivacyContract({ success() { resolve(); }, fail() { reject(new Error('隐私指引暂不可用，请稍后重试')); } });
  });
}
module.exports = { setup, authorize, setting, openContract };
