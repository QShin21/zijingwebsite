const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
Page({
  data: { needsLogin: false, allowed: false, loading: false, error: '', mode: 'applications', game: 0,
    docs: [], page: 1, hasMore: false, busy: false, bans: [], note: '' },
  ...actions,
  onLoad(options) { this.setData({ mode: options.mode === 'showcase' ? 'showcase' : 'applications', game: Number(options.game) || 0 }); },
  onShow() { this.load(); },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(true); },
  async load(more = false) {
    if (!protect(this)) return;
    const allowed = this.data.mode === 'applications' ? session.reviewer() : session.manages(this.data.game);
    this.setData({ allowed }); if (!allowed) return;
    this.setData({ loading: true, error: '' });
    try {
      const collection = this.data.mode === 'applications' ? 'community-applications' : 'community-showcase';
      const fields = this.data.mode === 'applications' ? ['proposedGame', 'realName', 'phone', 'reason', 'status', 'createdAt', 'applicant']
        : ['title', 'body', 'authorName', 'status', 'createdAt', 'images', 'videoURL'];
      const query = { depth: 0, limit: this.data.mode === 'showcase' ? 4 : 12, page: more ? this.data.page + 1 : 1,
        sort: 'createdAt', 'where[status][equals]': 'pending', ...cms.selection(fields),
        ...(this.data.mode === 'showcase' ? { 'where[game][equals]': this.data.game } : {}) };
      const result = await http.request(`/api/${collection}?${cms.query(query)}`, { required: true });
      const docs = [];
      for (const doc of result.docs) {
        const images = [];
        for (const image of (doc.images || [])) images.push(await files.localImage(image.source));
        let applicant = null;
        if (this.data.mode === 'applications' && doc.applicant) applicant = await http.request(`/api/users/${doc.applicant}?depth=0&${cms.query(cms.selection(['name', 'email']))}`, { required: true }).catch(() => null);
        docs.push({ ...doc, dateText: format.date(doc.createdAt), localImages: images, applicantName: applicant && applicant.name, applicantEmail: applicant && applicant.email });
      }
      this.setData({ loading: false, docs: (more ? this.data.docs : []).concat(docs), page: result.page, hasMore: result.hasNextPage });
      if (this.data.mode === 'showcase') {
        const bans = await http.request(`/api/community-bans?${cms.query({ depth: 0, limit: 100, 'where[game][equals]': this.data.game,
          'where[active][equals]': true, ...cms.selection(['member', 'reason', 'active']) })}`, { required: true });
        this.setData({ bans: bans.docs });
      }
    } catch (cause) { this.setData({ loading: false, error: cause.message }); }
  },
  note(event) { this.setData({ note: event.detail.value }); },
  async inspect(event) {
    try { const doc = await http.request(`/api/community-applications/${event.currentTarget.dataset.id}?depth=0&select[wechatQr]=true`, { required: true });
      const image = await files.localImage(doc.wechatQr); if (image) wx.previewImage({ urls: [image] }); }
    catch (cause) { this.setData({ error: cause.message }); }
  },
  async decide(event) {
    if (this.data.busy) return;
    const { id, decision } = event.currentTarget.dataset;
    const answer = await new Promise(resolve => wx.showModal({ title: '审核内容', content: decision === 'approved' || decision === 'visible' ? '确认通过这条申请或投稿？' : '确认退回这条申请或投稿？', success: resolve }));
    if (!answer.confirm) return;
    this.setData({ busy: true, error: '' });
    try {
      await http.request(`/api/${this.data.mode === 'applications' ? 'community-applications' : 'community-showcase'}/${id}`, {
        required: true, method: 'PATCH', data: { status: decision,
          ...(this.data.mode === 'showcase' ? { reviewNote: this.data.note } : {}) } });
      await this.load(); wx.showToast({ title: '审核已完成', icon: 'none' });
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
  async unban(event) {
    const answer = await new Promise(resolve => wx.showModal({ title: '解除禁言', content: '确认恢复该成员在此社群的发言权限？', success: resolve }));
    if (!answer.confirm) return;
    try { await http.request(`/api/community-bans/${event.currentTarget.dataset.id}`, { required: true, method: 'PATCH', data: { active: false } }); this.load(); }
    catch (cause) { this.setData({ error: cause.message }); }
  },
});
