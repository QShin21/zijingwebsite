// Invoke only from a user's explicit action, before choosing personal images.
function authorize() {
  return new Promise((resolve, reject) => {
    if (typeof wx.requirePrivacyAuthorize !== 'function') {
      reject(new Error('当前微信版本暂不支持隐私授权，请升级微信后重试'));
      return;
    }
    wx.requirePrivacyAuthorize({
      success() { resolve(); },
      fail() { reject(new Error('隐私授权未完成，图片未读取；可查看隐私说明后重新选择')); },
    });
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
module.exports = { authorize, openContract };
