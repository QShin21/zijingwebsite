let privateFiles = [];
let privateEpoch = 0;
function readImage(path, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => wx.getFileSystemManager().readFile({
    filePath: path, success(result) {
      if (!result.data || result.data.byteLength > maxBytes) return reject(new Error(`图片请控制在 ${maxBytes / 1024 / 1024} MB 以内`));
      const bytes = new Uint8Array(result.data);
      const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpeg'
        : bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? 'png'
          : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45 ? 'webp'
            : bytes[0] === 0x47 && bytes[1] === 0x49 && maxBytes > 2 * 1024 * 1024 ? 'gif' : '';
      if (!mime) return reject(new Error('请选择 PNG、JPEG 或 WebP 图片'));
      resolve(`data:image/${mime};base64,${wx.arrayBufferToBase64(result.data)}`);
    }, fail() { reject(new Error('图片读取失败，请重新选择')); },
  }));
}
function localImage(data) {
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(data || '');
  if (!match || data.length > 11200000) return Promise.resolve('');
  const filePath = `${wx.env.USER_DATA_PATH}/zijing-private-${Date.now()}-${Math.random().toString(36).slice(2)}.${match[1]}`;
  const epoch = privateEpoch;
  return new Promise(resolve => wx.getFileSystemManager().writeFile({
    filePath, data: match[2], encoding: 'base64',
    success() {
      if (epoch !== privateEpoch) { wx.getFileSystemManager().unlink({ filePath, fail() {} }); resolve(''); return; }
      privateFiles.push(filePath); resolve(filePath);
    }, fail() { resolve(''); },
  }));
}
function clearPrivate() {
  privateEpoch++;
  const fs = wx.getFileSystemManager();
  privateFiles.forEach(filePath => fs.unlink({ filePath, fail() {} }));
  privateFiles = [];
  // Remove files left by a previous interrupted session, limited to our own prefix.
  fs.readdir({ dirPath: wx.env.USER_DATA_PATH, success(result) {
    (result.files || []).filter(name => /^zijing-private-[\w.-]+\.(png|jpeg|webp|gif|mp4)$/.test(name))
      .filter(name => !privateFiles.includes(`${wx.env.USER_DATA_PATH}/${name}`))
      .forEach(name => fs.unlink({ filePath: `${wx.env.USER_DATA_PATH}/${name}`, fail() {} }));
  }, fail() {} });
}
function choose(count = 1) {
  return new Promise((resolve, reject) => wx.chooseMedia({
    count, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'],
    success(result) {
      const selected = result && Array.isArray(result.tempFiles) ? result.tempFiles : [];
      if (!selected.length || selected.some(file => !file || typeof file.tempFilePath !== 'string' || !file.tempFilePath)) {
        reject(Object.assign(new Error('未获取到所选图片，请重新选择'), { code: 'MEDIA_PICK_FAILED' }));
        return;
      }
      resolve(selected.map(file => file.tempFilePath));
    },
    fail(result) {
      const detail = result && typeof result.errMsg === 'string' ? result.errMsg : '';
      const cancelled = /cancel/i.test(detail);
      const denied = /auth(?:orization)?\s*(?:deny|denied)|permission\s*(?:deny|denied)/i.test(detail);
      const message = cancelled ? '未选择图片' : denied ? '图片选择权限不可用，请检查微信相册或相机权限' : '图片选择失败，请重新选择';
      reject(Object.assign(new Error(message), { code: cancelled ? 'MEDIA_PICK_CANCELLED' : 'MEDIA_PICK_FAILED' }));
    },
  }));
}
module.exports = { readImage, localImage, clearPrivate, choose };
