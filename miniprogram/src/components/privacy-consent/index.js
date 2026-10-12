/* global Component */
const cms = require('../../lib/cms');
const privacy = require('../../lib/privacy');
const { render } = require('../../lib/richtext');
function hasText(nodes) {
  return nodes.some(node => node.type === 'text' ? Boolean(String(node.text || '').replace(/[\s\u200b-\u200d\ufeff]/g, '')) : hasText(node.children || []));
}
Component({
  data: { shown: false, loading: false, error: '', title: '', nodes: [], sections: [], links: [],
    docReady: false, sdkReady: false, contractName: '', contractOpening: false, contractOpened: false },
  lifetimes: {
    attached() { this._disposed = false; this._visible = true; },
    detached() { this._disposed = true; this.cancel(new Error('页面或账号已更新，请重新操作')); },
  },
  pageLifetimes: {
    show() { this._visible = true; this._contractVisit = null; },
    hide() {
      this._visible = false;
      // API success may precede hide. Keep one owned contract visit until show.
      const visit = this._contractVisit;
      if (visit && visit.request === this._request && !visit.hidden && visit.request.ownsContext()) visit.hidden = true;
      else this.cancel(new Error('页面或账号已更新，请重新操作'));
    },
  },
  methods: {
    available() { return !this._disposed && this._visible !== false; },
    stop() {},
    present(request) {
      this._request = request;
      this.setData({ shown: true, loading: false, error: '', title: '', nodes: [], sections: [], links: [],
        docReady: false, sdkReady: false, contractName: '', contractOpening: false, contractOpened: false });
      return this.load();
    },
    close(request) {
      if (this._request !== request) return;
      this._request = null; this._turn = (this._turn || 0) + 1;
      this._contractVisit = null;
      if (!this._disposed) this.setData({ shown: false, loading: false, docReady: false, sdkReady: false,
        nodes: [], sections: [], links: [], contractOpened: false, contractOpening: false });
    },
    cancel(cause) { if (this._request) this._request.cancel(cause); },
    deny() { this.cancel(); },
    retry() { return this.load(); },
    async load() {
      const request = this._request;
      if (!request || !request.current() || request.started || this.data.loading) return;
      const turn = this._turn = (this._turn || 0) + 1;
      this.setData({ loading: true, error: '', docReady: false, sdkReady: false, nodes: [], sections: [], links: [], contractOpened: false });
      try {
        const [result, setting] = await Promise.all([cms.list('pages', { key: 'privacy', limit: 1 }), privacy.setting()]);
        if (this._request !== request || turn !== this._turn || !request.current()) return;
        const doc = result.docs[0], rendered = render(doc && doc.body);
        const sections = (doc && Array.isArray(doc.sections) ? doc.sections : []).map(section => ({
          heading: typeof section.heading === 'string' ? section.heading : '',
          text: typeof section.text === 'string' ? section.text.trim() : '',
        })).filter(section => section.text.replace(/[\s\u200b-\u200d\ufeff]/g, ''));
        if (!doc || doc._status !== 'published' || !hasText(rendered.nodes) && !sections.length) {
          throw new Error('网站隐私说明尚未发布完整正文，暂不能选择图片或视频；请稍后重试或联系负责人');
        }
        this.setData({ loading: false, docReady: true, title: doc.title || '网站隐私说明', nodes: rendered.nodes,
          sections, links: rendered.links, contractName: setting.privacyContractName });
        // Even an already-authorized SDK user must pass the nonempty published-policy gate.
        request.start(setting.needAuthorization);
      } catch (cause) {
        if (this._request === request && turn === this._turn && request.current()) {
          this.setData({ loading: false, docReady: false, sdkReady: false, error: cause.message || '隐私说明读取失败，请重试' });
        }
      }
    },
    waitForAgreement(request) {
      if (this._request === request && request.current() && this.data.docReady) this.setData({ sdkReady: true });
      else request.cancel(new Error('隐私说明未准备完成，请重新操作'));
    },
    async openPlatform() {
      const request = this._request;
      if (!request || !request.current() || !this.data.docReady || this._readingContract) return;
      this._readingContract = true;
      this._contractVisit = { request, hidden: false };
      this.setData({ contractOpening: true, error: '' });
      try {
        await privacy.openContract();
        if (this._request === request && request.ownsContext() && !this._disposed) this.setData({ contractOpened: true });
      } catch (cause) {
        this._contractVisit = null;
        if (this._request === request && request.ownsContext() && !this._disposed) this.setData({ error: cause.message, contractOpened: false });
      } finally {
        this._readingContract = false;
        if (this._request === request && !this._disposed) this.setData({ contractOpening: false });
      }
    },
    agree(event) {
      const request = this._request;
      if (!request || !request.current() || !this.data.docReady || !this.data.sdkReady ||
          !this.data.contractOpened || this.data.contractOpening || this._readingContract ||
          !event || !event.currentTarget || event.currentTarget.id !== 'zijing-privacy-agree') return;
      // This method is bound only to the platform's agreeprivacyauthorization event.
      this._contractVisit = null;
      request.agree('zijing-privacy-agree');
    },
  },
});
