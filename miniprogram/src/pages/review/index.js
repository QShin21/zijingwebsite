const cms = require('../../lib/cms');
const http = require('../../lib/http');
const session = require('../../lib/session');
const files = require('../../lib/files');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
Page({
  data: { needsLogin: false, allowed: false, loading: false, error: '',
    docs: [], page: 1, hasMore: false, busy: false },
  ...actions,
  onShow() { this.load(); },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(true); },
  async load(more = false) {
    if (!protect(this)) return;
    const allowed = session.reviewer();
    this.setData({ allowed }); if (!allowed) return;
    this.setData({ loading: true, error: '' });
    try {
      const query = { depth: 0, limit: 12, page: more ? this.data.page + 1 : 1,
        sort: 'createdAt', 'where[status][equals]': 'pending',
        ...cms.selection(['proposedGame', 'realName', 'phone', 'reason', 'status', 'createdAt', 'applicant']) };
      const collection = 'community-applications';
      const result = await http.request(`/api/${collection}?${cms.query(query)}`, { required: true });
      const docs = [];
      for (const doc of result.docs) {
        const images = [];
        for (const image of (doc.images || [])) images.push(await files.localImage(image.source));
        let applicant = null;
        if (doc.applicant) applicant = await http.request(`/api/users/${doc.applicant}?depth=0&${cms.query(cms.selection(['name', 'email']))}`, { required: true }).catch(() => null);
        docs.push({ ...doc, dateText: format.date(doc.createdAt), localImages: images, applicantName: applicant && applicant.name, applicantEmail: applicant && applicant.email });
      }
      this.setData({ loading: false, docs: (more ? this.data.docs : []).concat(docs), page: result.page, hasMore: result.hasNextPage });
    } catch (cause) { this.setData({ loading: false, error: cause.message }); }
  },
  async inspect(event) {
    try { const doc = await http.request(`/api/community-applications/${event.currentTarget.dataset.id}?depth=0&select[wechatQr]=true`, { required: true });
      const image = await files.localImage(doc.wechatQr); if (image) wx.previewImage({ urls: [image] }); }
    catch (cause) { this.setData({ error: cause.message }); }
  },
  async decide(event) {
    if (this.data.busy) return;
    const { id, decision } = event.currentTarget.dataset;
    const answer = await new Promise(resolve => wx.showModal({ title: '审核内容', content: decision === 'approved' ? '确认通过这条申请？' : '确认退回这条申请？', success: resolve }));
    if (!answer.confirm) return;
    this.setData({ busy: true, error: '' });
    try {
      await http.request(`/api/community-applications/${id}`, {
        required: true, method: 'PATCH', data: { status: decision } });
      await this.load(); wx.showToast({ title: '审核已完成', icon: 'none' });
    } catch (cause) { this.setData({ error: cause.message }); }
    finally { this.setData({ busy: false }); }
  },
});
