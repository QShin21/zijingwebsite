function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const http = require('../../lib/http');
const v2 = require('../../lib/v2');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const privacy = require('../../lib/privacy');
const { actions } = require('../../lib/page');
const MAX_IMAGES = 6, MAX_BYTES = 2 * 1024 * 1024;

function fileSize(path) {
  return new Promise(resolve => wx.getFileInfo({ filePath: path, success: info => resolve(info.size), fail: () => resolve(0) }));
}
function compress(path) {
  return new Promise(resolve => wx.compressImage({ src: path, quality: 70, success: result => resolve(result.tempFilePath), fail: () => resolve(path) }));
}

// V2 风采投稿 (A16 uploads + A17 showcase). Every image is uploaded once as a
// private temporary record; the server consumes it atomically on submit.
Page(withVisualTheme({
  data: { slug: '', needsLogin: false, title: '', body: '', videoURL: '', images: [], uploading: 0, busy: false, error: '', done: false },
  ...actions,
  onLoad(options) {
    const slug = String((options && options.slug) || '');
    this.setData({ slug: /^[a-z0-9-]{1,120}$/.test(slug) ? slug : '', needsLogin: !session.user() });
    if (!this.data.slug) this.setData({ error: '社群入口无效，请从社群主页进入投稿。' });
  },
  onShow() { this.setData({ needsLogin: !session.user() }); },
  onUnload() { this._disposed = true; },
  register() { navigation.go('auth', { mode: 'register' }); },
  field(event) {
    const name = event.currentTarget.dataset.field, limits = { title: 120, body: 5000, videoURL: 2000 };
    if (!limits[name]) return;
    this.setData({ [name]: String(event.detail.value || '').slice(0, limits[name]), error: '' });
  },
  caption(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!this.data.images[index]) return;
    this.setData({ ['images[' + index + '].caption']: String(event.detail.value || '').slice(0, 200) });
  },
  remove(event) {
    if (this.data.busy) return;
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ images: this.data.images.filter((_, position) => position !== index) });
  },
  async choose() {
    if (this.data.busy || this.data.uploading || !this.data.slug) return;
    const room = MAX_IMAGES - this.data.images.length;
    if (room <= 0) return;
    try { await privacy.authorize(); }
    catch (cause) { if (!this._disposed) this.setData({ error: (cause && cause.message) || '需要同意隐私保护指引后才能选择照片' }); return; }
    if (this._disposed) return;
    let picked;
    try {
      picked = await new Promise((resolve, reject) => wx.chooseMedia({ count: room, mediaType: ['image'], sizeType: ['compressed'], success: resolve, fail: reject }));
    } catch { return; /* The member cancelled the picker. */ }
    const files = (picked.tempFiles || []).slice(0, room);
    this.setData({ uploading: files.length, error: '' });
    for (const file of files) {
      if (this._disposed) return;
      try {
        let path = file.tempFilePath;
        if ((file.size || await fileSize(path)) > MAX_BYTES) path = await compress(path);
        if (await fileSize(path) > MAX_BYTES) throw new Error('单张图片不得超过 2 MB，请裁剪后重试');
        const result = await http.upload('/api/v2/uploads', path, { name: 'file', formData: { purpose: 'showcase' } });
        if (this._disposed) return;
        this.setData({ images: this.data.images.concat([{ upload: result.upload.id, caption: '', preview: path }]) });
      } catch (cause) {
        if (!this._disposed) this.setData({ error: (cause && cause.message) || '图片上传失败，请重试' });
      } finally {
        if (!this._disposed) this.setData({ uploading: Math.max(0, this.data.uploading - 1) });
      }
    }
  },
  async submit() {
    if (this.data.busy || this.data.uploading || !this.data.slug) return;
    if (!session.user()) return navigation.login();
    if (!this.data.title.trim()) { this.setData({ error: '请填写标题' }); return; }
    this.setData({ busy: true, error: '' });
    try {
      await v2.post('communities/' + encodeURIComponent(this.data.slug) + '/showcase', {
        title: this.data.title.trim(), body: this.data.body, videoURL: this.data.videoURL.trim(),
        images: this.data.images.map(image => ({ upload: image.upload, caption: image.caption })),
      });
      if (this._disposed) return;
      this.setData({ busy: false, done: true });
      wx.showToast({ title: '已提交，等待审核', icon: 'none' });
    } catch (cause) {
      if (this._disposed) return;
      const unknown = !cause || !cause.status;
      this.setData({ busy: false, error: unknown ? '提交结果尚未确认，内容已保留。请先到社群风采「我的投稿」核对，避免重复提交。' : cause.message });
    }
  },
  openMine() { navigation.go('community', { slug: this.data.slug, area: 'showcase' }); },
}));
