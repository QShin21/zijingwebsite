const cms = require('../../lib/cms');
const navigation = require('../../lib/navigation');
const { actions, error, protect } = require('../../lib/page');
Page({
  data: { loading: false, error: '', needsLogin: false, user: null, docs: [], page: 1, hasMore: false },
  ...actions,
  onShow() { this.load(); },
  retry() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading) this.load(true); },
  async load(more = false) {
    if (!protect(this)) { this.setData({ loading: false, docs: [] }); return; }
    this.setData({ loading: true, error: '' });
    try {
      const result = await cms.list('games', { page: more ? this.data.page + 1 : 1, limit: 24 });
      const docs = await cms.decorate(result.docs);
      this.setData({ loading: false, docs: more ? this.data.docs.concat(docs) : docs, page: result.page, hasMore: result.hasNextPage });
    } catch (cause) { error(this, cause); }
  },
  openCommunity(event) { const doc = event.currentTarget.dataset.doc; navigation.go('community', { id: doc.id, slug: doc.slug }); },
  apply() { if (navigation.requireUser()) navigation.go('applications', { apply: 1 }); },
});
