const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const http = require('../../lib/http');
const v2 = require('../../lib/v2');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const privacy = require('../../lib/privacy');
const { actions } = require('../../lib/page');
const MAX_IMAGES = 6, MAX_BYTES = 2 * 1024 * 1024;
const text = {
  back: ['‹ 返回', '‹ Back'],
  kicker: ['SHOWCASE · 风采投稿', 'SHOWCASE'],
  heroTitle: ['记录一次共同经历', 'Share a moment together'],
  heroLead: ['分享你有权发布的活动照片与视频链接，社群管理员审核后展示。', 'Share event photos and video links you have the right to publish; community admins review them before display.'],
  loginTitle: ['登录后投稿风采', 'Sign in to submit a showcase post'],
  loginBody: ['投稿会记录作者，并由社群管理员审核。', 'Submissions record the author and are reviewed by community admins.'],
  submitted: ['已提交', 'Submitted'],
  doneTitle: ['投稿已提交，等待审核', 'Submitted, awaiting review'],
  doneHint: ['审核结果会显示在社群风采「我的投稿」中。', 'The review result will appear under “My submissions” in the community showcase.'],
  openMine: ['查看我的投稿', 'View my submissions'],
  step1: ['1 · 标题与故事', '1 · Title and story'],
  titleLabel: ['标题 · 必填', 'Title · required'],
  titlePlaceholder: ['例如：秋季联赛小组赛高光', 'e.g. Autumn league group-stage highlights'],
  bodyLabel: ['正文', 'Story'],
  bodyPlaceholder: ['写下这次活动的故事', 'Tell the story of this event'],
  step2: ['2 · 照片与视频', '2 · Photos and video'],
  videoLabel: ['视频链接（可选）', 'Video link (optional)'],
  videoPlaceholder: ['HTTPS 视频链接或 B 站嵌入代码', 'HTTPS video link or Bilibili embed code'],
  photosLabel: ['照片（最多 6 张，单张不超过 2 MB）', 'Photos (up to 6, max 2 MB each)'],
  captionPlaceholder: ['图片说明（可选）', 'Caption (optional)'],
  removePhotoPrefix: ['移除第 ', 'Remove photo '],
  removePhotoSuffix: [' 张图片', ''],
  remove: ['移除', 'Remove'],
  uploadingPrefix: ['正在上传 ', 'Uploading '],
  uploadingSuffix: [' 张…', ' photos…'],
  addPhotos: ['＋ 添加照片', '＋ Add photos'],
  rightsNote: ['仅上传你有权发布的照片；图片先保存为 24 小时内有效的临时文件，提交后由社群管理员审核展示。', 'Only upload photos you may publish. Images are kept as temporary files for 24 hours; after you submit, community admins review them before display.'],
  submitting: ['正在提交…', 'Submitting…'],
  submit: ['提交审核', 'Submit for review'],
};

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
    i18n.bind(this, text);
    const slug = String((options && options.slug) || '');
    this.setData({ slug: /^[a-z0-9-]{1,120}$/.test(slug) ? slug : '', needsLogin: !session.user() });
    if (!this.data.slug) this.setData({ error: i18n.t('社群入口无效，请从社群主页进入投稿。', 'Invalid community link. Open the submission from the community page.') });
  },
  onShow() { i18n.navTitle('风采投稿', 'Showcase Submission'); this.setData({ needsLogin: !session.user() }); },
  onUnload() { this._disposed = true; i18n.unbind(this); },
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
    catch (cause) { if (!this._disposed) this.setData({ error: (cause && cause.message) || i18n.t('需要同意隐私保护指引后才能选择照片', 'Agree to the privacy guide before choosing photos') }); return; }
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
        if (await fileSize(path) > MAX_BYTES) throw new Error(i18n.t('单张图片不得超过 2 MB，请裁剪后重试', 'Each image must be 2 MB or less. Crop it and try again.'));
        const result = await http.upload('/api/v2/uploads', path, { name: 'file', formData: { purpose: 'showcase' } });
        if (this._disposed) return;
        this.setData({ images: this.data.images.concat([{ upload: result.upload.id, caption: '', preview: path }]) });
      } catch (cause) {
        if (!this._disposed) this.setData({ error: (cause && cause.message) || i18n.t('图片上传失败，请重试', 'Image upload failed. Please try again.') });
      } finally {
        if (!this._disposed) this.setData({ uploading: Math.max(0, this.data.uploading - 1) });
      }
    }
  },
  async submit() {
    if (this.data.busy || this.data.uploading || !this.data.slug) return;
    if (!session.user()) return navigation.login();
    if (!this.data.title.trim()) { this.setData({ error: i18n.t('请填写标题', 'Please enter a title.') }); return; }
    this.setData({ busy: true, error: '' });
    try {
      await v2.post('communities/' + encodeURIComponent(this.data.slug) + '/showcase', {
        title: this.data.title.trim(), body: this.data.body, videoURL: this.data.videoURL.trim(),
        images: this.data.images.map(image => ({ upload: image.upload, caption: image.caption })),
      });
      if (this._disposed) return;
      this.setData({ busy: false, done: true });
      wx.showToast({ title: i18n.t('已提交，等待审核', 'Submitted for review'), icon: 'none' });
    } catch (cause) {
      if (this._disposed) return;
      const unknown = !cause || !cause.status;
      this.setData({ busy: false, error: unknown ? i18n.t('提交结果尚未确认，内容已保留。请先到社群风采「我的投稿」核对，避免重复提交。', 'The result is not confirmed yet and your content is kept. Check “My submissions” in the community showcase first to avoid submitting twice.') : cause.message });
    }
  },
  openMine() { navigation.go('community', { slug: this.data.slug, area: 'showcase' }); },
}));
