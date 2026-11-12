
const http = require('../../lib/http');
const files = require('../../lib/files');
const navigation = require('../../lib/navigation');
const privacy = require('../../lib/privacy');
const session = require('../../lib/session');
const { page } = require('../../lib/theme');
const { beijingParts, date } = require('../../lib/format');

const labels = { pending: '待审核', confirmed: '已确认', rejected: '已驳回' };
const filters = Object.keys(labels).map(status => ({ status, label: labels[status] }));
const seatLabel = value => {
  const [row, number] = value.split('-');
  return `${row}排${number}座`;
};

function rowsFor(state, selected) {
  return state.rows.map(row => ({
    ...row, indent: row.offset * 30,
    seats: Array.from({ length: row.count }, (_, index) => {
      const id = `${row.row}-${index + 1}`;
      const status = state.occupancy[id];
      const picked = selected.includes(id);
      const stateLabel = status ? labels[status] : picked ? '已选' : '可选';
      return {
        id, number: index + 1, locked: Boolean(status),
        style: status || (picked ? 'selected' : 'available'),
        label: `${seatLabel(id)} · ${stateLabel}`,
      };
    }),
  }));
}

Page(page({
  data: {
    review: false, title: '', loading: true, busy: '', error: '', loadError: '', notice: '',
    needsLogin: false, enabled: false, open: false, loggedIn: false, editable: false,
    scheduled: false, openingLabel: '', opensAt: null, openingDate: '', openingTime: '',
    rows: [], selected: [], selectedLabel: '', phone: '', drafts: [], mine: null,
    seatLimit: 10, proofLimit: 10, proofMB: 8,
    filters, status: 'pending', statusLabel: labels.pending, pageNumber: 1, hasNextPage: false, docs: [],
  },

  onLoad(options) {
    const { kind, id, mode } = options;
    if (['events', 'community-posts'].includes(kind) && /^[1-9]\d*$/.test(String(id)) && Number(id) <= 2147483647)
      this._endpoint = `/api/activities/${kind}/${id}/seating`;
    this._revision = 0;
    this._read = 0;
    this._member = (session.user() || {}).id;
    this.setData({ review: mode === 'review' });
    if (mode === 'review') wx.setNavigationBarTitle({ title: '选座工作台' });
    this._unsubscribe = session.subscribe(user => {
      const member = (user || {}).id;
      if (member === this._member) return;
      this._member = member;
      this._revision++;
      this._state = null;
      clearTimeout(this._openingTimer);
      this.setData({
        rows: [], selected: [], selectedLabel: '', phone: '', drafts: [], mine: null, docs: [],
        busy: '', error: '', notice: '', editable: false, loggedIn: false, needsLogin: !member,
      });
      void this.load();
    });
  },

  onShow() { this._hidden = false; if (!this.data.busy) void this.load(); },
  onHide() { this._hidden = true; clearTimeout(this._openingTimer); },
  onUnload() { this._closed = true; this.onHide(); this._unsubscribe?.(); },
  onPullDownRefresh() {
    return (this.data.busy ? Promise.resolve() : this.load()).finally(() => wx.stopPullDownRefresh());
  },
  back: navigation.back,
  login: navigation.login,

  current(revision) { return !this._closed && revision === this._revision; },

  async load() {
    if (!this._endpoint) {
      this.setData({ loading: false, loadError: '活动信息无效' });
      return;
    }
    const read = ++this._read;
    const revision = this._revision;
    const { review, status, pageNumber } = this.data;
    if (review && !this._member) {
      this.setData({ loading: false, needsLogin: true, loadError: '', docs: [] });
      return;
    }
    this.setData({ loading: true, loadError: '', needsLogin: false });
    try {
      const path = review ? `${this._endpoint}?mode=review&status=${status}&page=${pageNumber}` : this._endpoint;
      const data = await http.request(path, { required: review, raw: true });
      if (!this.current(revision) || read !== this._read) return;
      const opensAt = data.opensAt || null;
      const opening = {
        scheduled: data.scheduled === true, opensAt, openingLabel: opensAt ? date(opensAt) : '',
      };
      clearTimeout(this._openingTimer);
      if (!review && !this._hidden && opening.scheduled && opensAt) {
        const delay = Math.min(2147483647, Math.max(0, Date.parse(opensAt) - data.serverTime) + 200);
        this._openingTimer = setTimeout(() => {
          if (this.current(revision) && !this._hidden) void this.load();
        }, delay);
      }
      if (review) {
        const docs = data.docs.map(row => ({
          ...row, label: labels[row.status], seatLabel: row.seats.map(seatLabel).join('、'),
          submitted: date(row.createdAt), reviewed: row.reviewedAt ? date(row.reviewedAt) : '',
        }));
        const fields = opensAt !== this.data.opensAt ? beijingParts(opensAt) : null;
        this.setData({
          ...opening, title: data.title, enabled: data.enabled, open: data.open, docs, hasNextPage: data.hasNextPage,
          ...(fields ? { openingDate: fields.date, openingTime: fields.time } : {}),
        });
      } else {
        this._state = data;
        const selected = this.data.selected.filter(id => !data.occupancy[id]);
        const mine = data.mine && { ...data.mine, label: labels[data.mine.status], seatLabel: data.mine.seats.map(seatLabel).join('、') };
        const editable = data.open && data.loggedIn && (!mine || mine.status === 'rejected');
        this.setData({
          ...opening, title: data.title, enabled: data.enabled, open: data.open, loggedIn: data.loggedIn,
          editable, mine, drafts: data.drafts, seatLimit: data.seatLimit, proofLimit: data.proofLimit,
          proofMB: data.proofBytes / 1024 / 1024, selected, selectedLabel: selected.map(seatLabel).join('、'),
          rows: data.enabled ? rowsFor(data, selected) : [],
        });
      }
    } catch (cause) {
      if (this.current(revision) && read === this._read)
        this.setData({ loadError: cause.message, ...(review ? { docs: [], hasNextPage: false } : {}) });
    } finally {
      if (this.current(revision) && read === this._read) this.setData({ loading: false });
    }
  },

  refresh() { if (!this.data.busy) return this.load(); },

  toggle(event) {
    if (!this._state || !this.data.editable || this.data.busy || this.data.loading) return;
    const seat = event.currentTarget.dataset.seat;
    if (this._state.occupancy[seat]) return;
    let selected = this.data.selected;
    if (selected.includes(seat)) selected = selected.filter(id => id !== seat);
    else if (selected.length < this.data.seatLimit) selected = [...selected, seat];
    else { this.setData({ error: `每人最多选择 ${this.data.seatLimit} 个座位` }); return; }
    this.setData({ selected, selectedLabel: selected.map(seatLabel).join('、'), rows: rowsFor(this._state, selected), error: '' });
  },

  phone(event) { this.setData({ phone: event.detail.value }); },

  async work(busy, task, refresh = true) {
    if (this.data.busy || this.data.loading) return;
    const revision = this._revision;
    this.setData({ busy, error: '', notice: '' });
    try {
      await task(revision);
    } catch (cause) {
      if (this.current(revision)) this.setData({ error: cause.message });
    } finally {
      if (this.current(revision) && refresh) await this.load();
      if (this.current(revision)) this.setData({ busy: '' });
    }
  },

  chooseProofs() {
    if (!this.data.editable || this.data.drafts.length >= this.data.proofLimit) return;
    return this.work('正在上传凭证', async revision => {
      await privacy.authorize();
      if (!this.current(revision)) return;
      const paths = await files.choose(Math.min(9, this.data.proofLimit - this.data.drafts.length));
      for (const filePath of paths) {
        if (!this.current(revision)) return;
        await http.upload(this._endpoint + '/proofs', filePath, { raw: true });
      }
    });
  },

  removeProof(event) {
    const id = event.currentTarget.dataset.proof;
    if (!this.data.editable || !this.data.drafts.includes(id)) return;
    return this.work('正在移除凭证', () => http.request(`${this._endpoint}/proofs/${id}`, { method: 'DELETE', required: true }));
  },

  previewProof(event) {
    const id = event.currentTarget.dataset.proof;
    return this.work('正在读取凭证', async revision => {
      const path = await http.download(`${this._endpoint}/proofs/${id}`);
      if (this.current(revision)) wx.previewImage({ current: path, urls: [path] });
    }, false);
  },

  submit() {
    if (!this.data.editable) return;
    const { selected, phone, drafts } = this.data;
    if (!selected.length || !drafts.length || !/^\+?[1-9]\d{6,14}$/.test(phone.trim().replace(/[\s-]/g, ''))) {
      this.setData({ error: '请选择座位、上传凭证并填写有效手机号' });
      return;
    }
    return this.work('正在提交选座', async revision => {
      const { mine } = await http.request(this._endpoint, {
        method: 'POST', required: true, raw: true, data: { seats: selected, phone, proofs: drafts },
      });
      if (this.current(revision)) this.setData({
        selected: [], selectedLabel: '', phone: '', drafts: [], editable: false,
        mine: { ...mine, label: labels[mine.status], seatLabel: mine.seats.map(seatLabel).join('、') },
        notice: '选座申请已提交',
      });
    });
  },

  filter(event) {
    const status = event.currentTarget.dataset.status;
    if (!Object.hasOwn(labels, status) || this.data.busy || this.data.loading) return;
    this.setData({ status, statusLabel: labels[status], pageNumber: 1, error: '', notice: '' });
    return this.load();
  },

  turn(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    if (this.data.busy || this.data.loading ||
        (delta === -1 ? this.data.pageNumber <= 1 : delta !== 1 || !this.data.hasNextPage)) return;
    this.setData({ pageNumber: this.data.pageNumber + delta, error: '', notice: '' });
    return this.load();
  },

  changeOpeningDate(event) { this.setData({ openingDate: event.detail.value }); },
  changeOpeningTime(event) { this.setData({ openingTime: event.detail.value }); },

  setEnabled(event) {
    const enabled = event.currentTarget.dataset.enabled === true;
    return this.saveOpening({ enabled }, enabled ? '已启用选座' : '已停用选座');
  },

  scheduleOpening() {
    const { openingDate, openingTime } = this.data;
    if (!openingDate || !openingTime) {
      this.setData({ error: '请选择开放日期和时间' });
      return;
    }
    return this.saveOpening({ enabled: true, opensAt: openingDate + 'T' + openingTime }, '已保存定时开放');
  },

  saveOpening(data, notice) {
    return this.work('正在保存', async revision => {
      await http.request(this._endpoint, { method: 'PUT', required: true, data });
      if (this.current(revision)) this.setData({ notice });
    });
  },

  decide(event) {
    const { id, status } = event.currentTarget.dataset;
    if (status !== 'confirmed' && status !== 'rejected') return;
    return this.work('正在提交审核', async revision => {
      await http.request(this._endpoint, {
        method: 'POST', required: true, data: { action: 'review', id: Number(id), status },
      });
      if (this.current(revision)) this.setData({ notice: status === 'confirmed' ? '已通过并锁定座位' : '已驳回并释放座位' });
    });
  },
}));
