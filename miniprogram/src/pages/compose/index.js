const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const { actions, protect } = require('../../lib/page');
const targets = { forum: 'forum-posts', showcase: 'community-showcase', event: 'community-posts', notice: 'community-posts' };
Page({
  data: { kind: 'forum', game: 0, title: '', body: '', videoURL: '', images: [], busy: false, error: '', needsLogin: false,
    categories: ['活动', '通知'], categoryIndex: 0 },
  ...actions,
  onLoad(options) {
    this.setData({ kind: targets[options.kind] ? options.kind : 'forum', game: Number(options.game) });
    wx.setNavigationBarTitle({ title: options.kind === 'showcase' ? '分享社群风采' : options.kind === 'forum' ? '发布帖子' : '发布活动与通知' });
  },
  onShow() { protect(this); },
  input(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }); },
  category(event) { this.setData({ categoryIndex: Number(event.detail.value) }); },
  async chooseImages() {
    try {
      const count = 6 - this.data.images.length;
      if (!count) throw new Error('最多添加 6 张图片');
      const paths = await files.choose(count);
      const images = [];
      for (const path of paths) images.push({ path, source: await files.readImage(path), caption: '' });
      this.setData({ images: this.data.images.concat(images), error: '' });
    } catch (cause) { this.setData({ error: cause.message }); }
  },
  removeImage(event) { const images = this.data.images.filter((_, i) => i !== Number(event.currentTarget.dataset.index)); this.setData({ images }); },
  caption(event) { const images = this.data.images.slice(); images[Number(event.currentTarget.dataset.index)].caption = event.detail.value; this.setData({ images }); },
  async submit() {
    if (!session.user() || this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      const { kind, game, title, body, videoURL, images } = this.data;
      if (!Number.isSafeInteger(game) || game <= 0 || !title.trim()) throw new Error('请填写标题并选择有效社群');
      if (!body.trim() && !(kind === 'showcase' && (images.length || videoURL.trim()))) throw new Error('请填写正文或添加照片与视频链接');
      await http.request(`/api/${targets[kind]}`, { method: 'POST', required: true, data: {
        game, author: session.user().id, title: title.trim(), body: body.trim(),
        ...(['event', 'notice'].includes(kind) ? { category: this.data.categoryIndex ? 'notice' : 'event' } : {}),
        ...(kind === 'showcase' ? { videoURL: videoURL.trim(), images: images.map(image => ({ source: image.source, caption: image.caption })) } : {}) } });
      wx.showToast({ title: kind === 'showcase' && !session.manages(game) ? '已提交，等待审核' : '发布成功', icon: 'none' });
      wx.navigateBack();
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
  retry() { protect(this); },
});
