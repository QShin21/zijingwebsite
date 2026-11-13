function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const http = require('../../lib/http');
const files = require('../../lib/files');
const navigation = require('../../lib/navigation');
const privacy = require('../../lib/privacy');
const session = require('../../lib/session');
const format = require('../../lib/format');
const { actions } = require('../../lib/page');

// Activity seat selection (member map + reviewer workbench) over the authorized seating API.
// Server state decides every capability. Phone numbers and proof ids live only in page data
// for the current account: cleared on account change, never stored, logged or shared.
const labels = { pending: '待审核', confirmed: '已确认', rejected: '已驳回', cancelled: '已取消', revoked: '已撤销', blocked: '未开放' };
const tones = { pending: 'warning', confirmed: 'success', rejected: 'neutral', cancelled: 'neutral', revoked: 'neutral' };
const filters = ['pending', 'confirmed', 'rejected', 'cancelled', 'revoked'].map(status => ({ status, label: labels[status] }));
// Pixel-sized targets stay usable on narrow phones; match the zoom rules and gap in index.wxss.
const zooms = [{ size: 44, label: '紧凑' }, { size: 52, label: '标准' }, { size: 60, label: '放大' }];
const GAP = 6; // px between seats, shared by row indents and board width
const phonePattern = /^\+?[1-9]\d{6,14}$/;
const proofPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const seatLabel = value => { const parts = String(value).split('-'); return parts[0] + '排' + parts[1] + '座'; };
const seatNames = seats => (seats || []).map(seatLabel).join('、');
const chipsFor = selected => selected.map(id => ({ id, label: seatLabel(id) }));
const memberOf = user => (user && user.id ? String(user.id) : '');
const step = zoom => zooms[zoom].size + GAP;
const boardWidth = (rows, zoom) => Math.max(...rows.map(row => row.offset + row.count)) * step(zoom) + 24;
// Everything private or account-bound that must disappear when the account changes.
const cleared = () => ({ rows: [], chips: [], selected: [], phone: '', drafts: [], mine: null, tickets: [], ticketSeats: [], ticketUploadErrors: [], docs: [], counts: null, busy: '', error: '', notice: '', proofError: '', proofNotice: '',
  editable: false, editing: false, editRevision: null, editProofs: [], canEditMine: false, loggedIn: false, canReview: false, enabled: false, mode: 'selection', requestedCount: 1, open: false, scheduled: false, opensAt: null, openingLabel: '', openingDate: '', openingTime: '', title: '', loadError: '', selectedBlocked: 0, selectedAvailable: 0, requestNumber: null, existingCount: 0, seatReview: null, inspectedSeat: '', changeReady: false });

function seatCell(id, number, taken, picked, accent, blocked, manage, own) {
  const style = blocked ? 'blocked' : own && picked ? 'selected' : taken || (picked ? 'selected' : 'available');
  const state = blocked ? labels.blocked : taken ? labels[taken] : picked ? '已选' : '可选';
  const inspect = Boolean(manage && taken && !blocked && !own);
  return { id, number, style, picked, locked: Boolean(taken && !(manage && blocked) && !own && !inspect), label: seatLabel(id) + (accent ? ' · 中心区' : '') + ' · ' + state + (picked && (blocked || own) ? ' · 已选' : '') + (inspect ? ' · 查看申请' : '') };
}
function counts(state) {
  const total = state.rows.reduce((sum, row) => sum + row.count, 0);
  const blocked = (state.blockedSeats || []).length;
  const values = Object.keys(state.occupancy || {}).filter(key => !(state.blockedSeats || []).includes(key)).map(key => state.occupancy[key]);
  const pending = values.filter(value => value === 'pending').length, confirmed = values.filter(value => value === 'confirmed').length;
  return { rows: state.rows.length, total, pending, confirmed, blocked, free: Math.max(0, total - pending - confirmed - blocked) };
}
function mineView(mine) {
  return mine && labels[mine.status] ? { status: mine.status, label: labels[mine.status], tone: tones[mine.status], seats: seatNames(mine.seats), count: mine.requestedCount || (mine.seats || []).length } : null;
}
function reviewDoc(row) {
  const unassigned = row.status === 'pending' && row.allocationMode === 'random' && !(row.seats || []).length;
  return { id: row.id, revision: row.revision, memberName: row.memberName || '成员', phone: row.phone || '', status: row.status, label: labels[row.status] || '',
    tone: tones[row.status] || 'neutral', seats: unassigned ? '审核通过后安排' : seatNames(row.seats), seatCount: unassigned ? row.requestedCount : (row.seats || []).length, unassigned,
    seatItems: (row.seats || []).map(id => ({ id, label: seatLabel(id) })),
    releasedSeats: seatNames((row.releasedSeats || []).map(item => item.seat)),
    addedSeats: seatNames((row.addedSeats || []).map(item => item.seat)),
    proofs: (row.proofs || []).filter(id => proofPattern.test(String(id))),
    submitted: format.date(row.createdAt), reviewed: row.reviewedAt ? format.date(row.reviewedAt) : '' };
}

Page(withVisualTheme({
  data: { review: false, manage: false, adding: false, changing: false, changeReady: false, requestNumber: null, existingCount: 0, seatReview: null, inspectedSeat: '', kind: '', title: '', loading: true, busy: '', error: '', loadError: '', notice: '', proofError: '', proofNotice: '', needsLogin: false,
    enabled: false, mode: 'selection', requestedCount: 1, open: false, scheduled: false, opensAt: null, openingLabel: '', openingDate: '', openingTime: '', loggedIn: false, canReview: false, editable: false, editing: false, editRevision: null, editProofs: [], canEditMine: false, counts: null,
    rows: [], boardWidth: 0, zoom: 1, zoomLabel: zooms[1].label, selected: [], selectedBlocked: 0, selectedAvailable: 0, chips: [], phone: '', drafts: [], mine: null, tickets: [], ticketSeats: [], ticketUploadErrors: [],
    seatLimit: 10, proofLimit: 10, proofMB: 8,
    filters, status: 'pending', statusLabel: labels.pending, pageNumber: 1, hasNextPage: false, docs: [] },
  ...actions,

  onLoad(options) {
    const kind = options && options.kind, id = String((options && options.id) || '');
    this._closed = false; this._hidden = false; this._stale = false; this._external = false; this._revision = 0; this._read = 0;
    if (['events', 'community-posts'].includes(kind) && /^[1-9]\d*$/.test(id) && Number(id) <= 2147483647) {
      this._kind = kind; this._id = Number(id); this._endpoint = '/api/activities/' + kind + '/' + id + '/seating';
    }
    const review = Boolean(options && options.mode === 'review');
    const manage = Boolean(options && options.mode === 'manage');
    const adding = Boolean(options && options.mode === 'add');
    const changing = Boolean(options && options.mode === 'change');
    const request = String((options && options.request) || '');
    this._requestID = /^[1-9]\d*$/.test(request) && Number(request) <= 2147483647 ? Number(request) : null;
    this._member = memberOf(session.user());
    this.setData({ review, manage, adding, changing, kind: this._kind || '' });
    wx.setNavigationBarTitle({ title: review ? '选座工作台' : manage ? '管理座位' : adding ? '增加座位' : changing ? '更换座位' : '活动选座' });
    this._unsubscribe = session.subscribe(user => {
      const member = memberOf(user);
      if (member === this._member) return;
      // Another account: drop in-flight replies and every private value of the previous one.
      this._member = member; this._revision++; this._read++; this._state = null; this._seats = null; this._assignment = null; clearTimeout(this._openingTimer);
      this.setData({ ...cleared(), loading: false, needsLogin: false });
      if (!this._closed) this.load();
    });
  },
  onShow() {
    this._hidden = false;
    // Returning from our own proof preview or dialer: no reload unless a read was interrupted.
    if (this._external) { this._external = false; if (!this._stale) { this.scheduleModeRefresh(); return; } }
    if (this.data.busy) { this._stale = true; return; }
    return this.load();
  },
  onHide() {
    this._hidden = true;
    clearTimeout(this._openingTimer);
    clearTimeout(this._modeTimer);
    if (this.data.loading) { this._read++; this._stale = true; this.setData({ loading: false }); }
  },
  onUnload() {
    this._closed = true; this._revision++; this._read++; this._state = null; this._seats = null; this._assignment = null;
    clearTimeout(this._modeTimer);
    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = null;
  },
  onPullDownRefresh() {
    const done = () => wx.stopPullDownRefresh();
    if (this.data.busy) { done(); return; }
    return Promise.resolve(this.load()).then(done, done);
  },
  retry() { if (!this.data.busy) return this.load(); },
  refresh() { if (!this.data.busy && !this.data.loading) return this.load(); },

  current(revision) { return !this._closed && revision === this._revision; },
  reading(read, revision) { return this.current(revision) && read === this._read && !this._hidden; },
  scheduleModeRefresh() {
    clearTimeout(this._modeTimer);
    if (this._closed || this._hidden || this.data.review || this.data.manage || this.data.adding || this.data.changing) return;
    this._modeTimer = setTimeout(() => {
      if (this._closed || this._hidden) return;
      if (this.data.busy || this.data.loading) this.scheduleModeRefresh(); else this.load();
    }, 15000);
    if (this._modeTimer && typeof this._modeTimer.unref === 'function') this._modeTimer.unref();
  },

  async load() {
    if (this._closed) return;
    if (this._hidden) { this._stale = true; return; }
    if (!this._endpoint) { this.setData({ loading: false, loadError: '活动入口无效，请从活动详情重新进入。' }); return; }
    if ((this.data.adding || this.data.changing) && !this._requestID) { this.setData({ loading: false, loadError: '申请入口无效，请从工作台重新进入。' }); return; }
    this._stale = false;
    const read = ++this._read, revision = this._revision, review = this.data.review;
    if ((review || this.data.manage || this.data.adding || this.data.changing) && !session.user()) { this.setData({ ...cleared(), loading: false, needsLogin: true }); return; }
    this.setData({ loading: true, loadError: '', needsLogin: false });
    try {
      const path = review ? this._endpoint + '?mode=review&status=' + this.data.status + '&page=' + this.data.pageNumber : (this.data.adding || this.data.changing) ? this._endpoint + '?mode=assignment&request=' + this._requestID : this.data.manage ? this._endpoint + '?mode=review-map' : this._endpoint;
      const data = await http.request(path, { required: review || this.data.manage || this.data.adding || this.data.changing, raw: true });
      if (!this.reading(read, revision)) return;
      if (this.data.manage && !data.canReview) {
        this._state = null; this._seats = null;
        this.setData({ ...cleared(), loadError: '无权管理此活动的座位' });
        return;
      }
      if (review) { this.showReview(data); void this.loadTicketList(read, revision); }
      else if (this.data.adding || this.data.changing) this.showAssignment(data);
      else { this.showState(data); if (!this.data.manage) void this.loadTicketImages(data, read, revision); }
    } catch (cause) {
      if (!this.reading(read, revision)) return;
      const message = (cause && cause.message) || '选座信息读取失败，请重试';
      // 401 anonymous/expired, 403 revoked reviewer, 404 hidden activity: drop every private value.
      if (cause && cause.status === 401) { this._state = null; this._seats = null; this._assignment = null; this.setData({ ...cleared(), needsLogin: true }); }
      else if (cause && (cause.status === 403 || cause.status === 404 || ((this.data.adding || this.data.changing) && cause.status === 409))) { this._state = null; this._seats = null; this._assignment = null; this.setData({ ...cleared(), loadError: message }); }
      else this.setData({ loadError: message, ...(review ? { docs: [], hasNextPage: false } : {}) });
    } finally {
      if (this.reading(read, revision)) this.setData({ loading: false });
    }
  },
  showState(data) {
    this._state = data;
    clearTimeout(this._openingTimer);
    if (data.scheduled && data.opensAt && !this._hidden) {
      const revision = this._revision;
      const delay = Math.min(2147483647, Math.max(0, Date.parse(data.opensAt) - data.serverTime) + 200);
      this._openingTimer = setTimeout(() => { if (this.current(revision) && !this._hidden && !this.data.busy) this.load(); }, delay);
    }
    const manage = this.data.manage;
    const mode = data.mode === 'random' ? 'random' : 'selection';
    const mine = manage ? null : mineView(data.mine);
    const canEditMine = Boolean(!manage && mine && mine.status === 'pending' && data.mineDetails && data.mineDetails.canEdit);
    const editing = Boolean(this.data.editing && canEditMine && data.mine.revision === this.data.editRevision);
    const editable = manage ? Boolean(data.canReview) : Boolean(editing || (data.enabled && data.open && data.loggedIn && (!mine || mine.status === 'rejected' || mine.status === 'cancelled' || mine.status === 'revoked')));
    // Seats taken by someone else since the last read drop out of the local selection.
    const selected = editable && !manage && mode === 'selection' ? this.data.selected.filter(id => !data.occupancy[id] || (editing && data.mine.seats.includes(id))) : [];
    const showMap = mode === 'selection' || manage || data.canReview;
    this.setData({ title: data.title || '活动选座', enabled: Boolean(data.enabled), mode, ...(mode !== this.data.mode ? { requestedCount: data.mine && data.mine.requestedCount || 1, ...(this.data.title ? { notice: '座位模式已更新，请按当前模式填写申请。' } : {}) } : {}), open: Boolean(data.open), scheduled: data.scheduled === true, opensAt: data.opensAt || null, openingLabel: data.opensAt ? format.date(data.opensAt) : '', loggedIn: Boolean(data.loggedIn),
      canReview: Boolean(data.canReview), editable, editing, canEditMine, mine, drafts: (data.drafts || []).filter(id => proofPattern.test(String(id))),
      ...(!editing && this.data.editing ? { editRevision: null, editProofs: [], phone: '' } : {}),
      seatLimit: data.seatLimit, proofLimit: data.proofLimit, proofMB: Math.round(data.proofBytes / 1024 / 1024),
      selected, selectedBlocked: 0, selectedAvailable: 0, chips: chipsFor(selected), counts: showMap ? counts(data) : null, seatReview: null, inspectedSeat: '',
      rows: showMap && (data.enabled || manage || editing) ? this.layout(data, selected, this.data.zoom, editing) : [], boardWidth: showMap && (data.enabled || manage || editing) ? boardWidth(data.rows, this.data.zoom) : 0 });
    this.scheduleModeRefresh();
  },
  async loadTicketList(read, revision) {
    try {
      const result = await http.request(this._endpoint + '/tickets', { required: true, raw: true });
      if (this.reading(read, revision)) this.setData({ ticketSeats: Array.isArray(result.seats) ? result.seats : [] });
    } catch (cause) {
      if (this.reading(read, revision)) this.setData({ ticketSeats: [], ticketUploadErrors: [(cause && cause.message) || '票据清单读取失败'] });
    }
  },
  async loadTicketImages(data, read, revision) {
    const mine = data.mine;
    if (!mine || mine.status !== 'confirmed') { this.setData({ tickets: [] }); return; }
    const versions = new Map((data.ticketImages || []).map(item => [item.seat, item.version]));
    const previous = this.data.tickets || [];
    const tickets = (mine.seats || []).map(seat => {
      const version = versions.get(seat) || '';
      const prior = previous.find(item => item.seat === seat && item.version === version);
      return { seat, label: seatLabel(seat), version, path: prior && prior.path || '', failed: false };
    });
    this.setData({ tickets });
    await Promise.all(tickets.filter(ticket => ticket.version && !ticket.path).map(async ticket => {
      let path = '';
      try { path = await http.download(this._endpoint + '/tickets/' + encodeURIComponent(ticket.seat) + '?v=' + encodeURIComponent(ticket.version)); }
      catch { /* Keep a retry hint on the receipt. */ }
      if (!this.reading(read, revision)) return;
      const updated = this.data.tickets.map(item => item.seat === ticket.seat && item.version === ticket.version
        ? { ...item, path, failed: !path } : item);
      this.setData({ tickets: updated });
    }));
  },
  previewTicket(event) {
    const seat = String(event.currentTarget.dataset.seat || '');
    const ticket = (this.data.tickets || []).find(item => item.seat === seat && item.path);
    if (!ticket || !this.data.mine || this.data.mine.status !== 'confirmed') return;
    this._external = true;
    wx.previewImage({ current: ticket.path, urls: [ticket.path], fail: () => { this._external = false; } });
  },
  saveTicket(event) {
    const seat = String(event.currentTarget.dataset.seat || '');
    const ticket = (this.data.tickets || []).find(item => item.seat === seat && item.path);
    if (!ticket || !this.data.mine || this.data.mine.status !== 'confirmed') return;
    return this.work('正在保存票据', async revision => {
      await privacy.authorize();
      if (!this.current(revision) || !(this.data.tickets || []).some(item => item.seat === seat && item.version === ticket.version && item.path === ticket.path)) return false;
      await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({ filePath: ticket.path, success: resolve,
        fail: () => reject(new Error('保存失败，请检查微信的相册权限后重试')) }));
      if (this.current(revision)) this.setData({ notice: ticket.label + '的票据已保存到相册。' });
      return false;
    }, false);
  },
  chooseTickets() {
    if (!this.data.review || this.data.busy || this.data.loading || typeof wx.chooseMessageFile !== 'function') return;
    return this.work('正在上传票据', async revision => {
      this.setData({ ticketUploadErrors: [] });
      await privacy.authorize();
      if (!this.current(revision)) return false;
      this._external = true;
      const selected = await new Promise((resolve, reject) => wx.chooseMessageFile({ count: 100, type: 'file', extension: ['jpg', 'jpeg', 'png'],
        success: result => resolve(result.tempFiles || []), fail: result => {
          if (/cancel/i.test(result && result.errMsg || '')) resolve([]);
          else reject(new Error('选择文件失败，请重新选择'));
        } }));
      if (!selected.length || !this.current(revision)) return false;
      const counts = {};
      for (const file of selected) {
        const match = /^(\d{1,2})排(\d{1,2})座\.(jpg|jpeg|png)$/i.exec(file.name || '');
        if (match) { const seat = Number(match[1]) + '-' + Number(match[2]); counts[seat] = (counts[seat] || 0) + 1; }
      }
      const errors = []; let saved = 0;
      for (const file of selected) {
        if (!this.current(revision)) return false;
        const match = /^(\d{1,2})排(\d{1,2})座\.(jpg|jpeg|png)$/i.exec(file.name || '');
        const seat = match && (Number(match[1]) + '-' + Number(match[2]));
        if (!match || !file.path) { errors.push((file.name || '文件') + '：文件名无效'); continue; }
        if (counts[seat] > 1) { errors.push(file.name + '：本次选择中同一座位有多个文件'); continue; }
        if (!file.size || file.size > 8 * 1024 * 1024) { errors.push(file.name + '：单张图片最多 8 MB'); continue; }
        try {
          await http.upload(this._endpoint + '/tickets', file.path, { raw: true, formData: { filename: file.name } });
          saved++;
        } catch (cause) { errors.push(file.name + '：' + ((cause && cause.message) || '上传失败')); }
      }
      if (this.current(revision)) this.setData({ notice: '已保存 ' + saved + ' 张票据' + (errors.length ? '，' + errors.length + ' 张未完成' : '') + '。', ticketUploadErrors: errors });
      return true;
    }, true);
  },
  showReview(data) {
    const opensAt = data.opensAt || null;
    const fields = opensAt !== this.data.opensAt ? format.beijingParts(opensAt) : null;
    this.setData({ title: data.title || '选座工作台', enabled: Boolean(data.enabled), mode: data.mode === 'random' ? 'random' : 'selection', open: Boolean(data.open),
      scheduled: data.scheduled === true, opensAt, openingLabel: opensAt ? format.date(opensAt) : '',
      ...(fields ? { openingDate: fields.date, openingTime: fields.time } : {}),
      docs: (data.docs || []).map(reviewDoc), hasNextPage: Boolean(data.hasNextPage) });
  },
  showAssignment(data) {
    const prior = this._assignment, changing = this.data.changing;
    this._state = data;
    this._assignment = data.request;
    const remaining = Math.max(0, data.seatLimit - data.request.seats.length);
    const same = prior && prior.id === data.request.id && prior.revision === data.request.revision && prior.status === data.request.status;
    const limit = changing ? data.request.seats.length : remaining;
    const selected = changing && !same ? data.request.seats.slice() : this.data.selected.filter(id => !data.occupancy[id] || (changing && data.request.seats.includes(id))).slice(0, limit);
    const changeReady = Boolean(changing && selected.length === limit && data.request.seats.some(id => !selected.includes(id)));
    this.setData({ title: data.title || (changing ? '更换座位' : '增加座位'), requestNumber: data.request.id, existingCount: data.request.seats.length,
      seatLimit: limit, editable: changing || remaining > 0, canReview: true, selected, changeReady, chips: chipsFor(selected), counts: counts(data),
      rows: this.layout(data, selected, this.data.zoom, false), boardWidth: boardWidth(data.rows, this.data.zoom) });
  },
  layout(state, selected, zoom, editing = this.data.editing) {
    const index = {};
    const rows = state.rows.map((row, r) => {
      const accent = Boolean(row.accent);
      return { row: row.row, accent, indent: row.offset * step(zoom), seats: Array.from({ length: row.count }, (_, s) => {
        const id = row.row + '-' + (s + 1);
        index[id] = [r, s, accent];
        const own = Boolean((editing && state.mine && state.mine.seats.includes(id)) || (this.data.changing && state.request && state.request.seats.includes(id)));
        return seatCell(id, s + 1, state.occupancy[id], selected.includes(id), accent, (state.blockedSeats || []).includes(id), this.data.manage, own);
      }) };
    });
    this._seats = index;
    return rows;
  },

  // ---- member map ----
  rescale(event) {
    const zoom = this.data.zoom + Number(event.currentTarget.dataset.delta);
    if (!zooms[zoom] || !this._state || !this.data.rows.length) return;
    const patch = { zoom, zoomLabel: zooms[zoom].label, boardWidth: boardWidth(this._state.rows, zoom) };
    this._state.rows.forEach((row, r) => { patch['rows[' + r + '].indent'] = row.offset * step(zoom); });
    this.setData(patch);
  },
  toggle(event) { return this.pick(event.currentTarget.dataset.seat); },
  unpick(event) { if (this.data.selected.includes(event.currentTarget.dataset.seat)) this.pick(event.currentTarget.dataset.seat); },
  pick(id) {
    const state = this._state, place = this._seats && this._seats[id];
    const blocked = Boolean(state && (state.blockedSeats || []).includes(id));
    const own = Boolean(state && ((this.data.editing && state.mine && state.mine.seats.includes(id)) || (this.data.changing && state.request && state.request.seats.includes(id))));
    if (!state || !place || !this.data.editable || this.data.busy || this.data.loading) return;
    if (this.data.mode === 'random' && !this.data.manage && !this.data.adding && !this.data.changing) return;
    if (this.data.manage && state.occupancy[id] && !blocked) return this.inspectSeat(id);
    if (state.occupancy[id] && !(this.data.manage && blocked) && !own) return;
    let selected = this.data.selected;
    if (selected.includes(id)) selected = selected.filter(value => value !== id);
    else if (this.data.manage || selected.length < this.data.seatLimit) selected = selected.concat(id);
    else { this.setData({ error: '每人最多选择 ' + this.data.seatLimit + ' 个座位' }); return; }
    // Patch just the touched seat instead of re-sending all 381 cells.
    const selectedBlocked = selected.filter(value => (state.blockedSeats || []).includes(value)).length;
    this.setData({ ['rows[' + place[0] + '].seats[' + place[1] + ']']: seatCell(id, place[1] + 1, state.occupancy[id], selected.includes(id), place[2], blocked, this.data.manage, own),
      selected, selectedBlocked, selectedAvailable: selected.length - selectedBlocked, chips: chipsFor(selected), error: '',
      changeReady: Boolean(this.data.changing && state.request && selected.length === state.request.seats.length && state.request.seats.some(value => !selected.includes(value))) });
  },
  startEdit() {
    const state = this._state;
    if (!this.data.canEditMine || !state || !state.mine || !state.mineDetails || this.data.busy || this.data.loading) return;
    const selected = state.mine.seats.slice(), editProofs = state.mineDetails.proofs.concat(state.drafts || []);
    this.setData({ editing: true, editable: true, editRevision: state.mine.revision, editProofs, selected, chips: chipsFor(selected),
      requestedCount: state.mine.requestedCount || state.mine.seats.length || 1, phone: state.mineDetails.phone, rows: this.data.mode === 'random' && !this.data.canReview ? [] : this.layout(state, selected, this.data.zoom, true), boardWidth: boardWidth(state.rows, this.data.zoom), error: '', notice: '', proofError: '', proofNotice: '' });
  },
  cancelEdit() {
    if (!this.data.editing || !this._state || this.data.busy) return;
    this.setData({ editing: false, editable: false, editRevision: null, editProofs: [], selected: [], chips: [], phone: '', error: '', proofError: '', proofNotice: '',
      rows: this._state.enabled ? this.layout(this._state, [], this.data.zoom, false) : [] });
  },
  cancelRequest() {
    const state = this._state;
    if (!state || !state.mine || state.mine.status !== 'pending' || this.data.manage || this.data.review) return;
    return this.work('正在取消申请', async revision => {
      const answer = await new Promise(resolve => wx.showModal({ title: '取消选座申请', content: '取消后全部座位将释放给其他成员。确认取消？',
        confirmText: '确认取消', success: resolve, fail: () => resolve({ confirm: false }) }));
      if (!answer.confirm || !this.current(revision)) return false;
      await http.request(this._endpoint, { method: 'DELETE', required: true, raw: true,
        data: { id: state.mine.id, revision: state.mine.revision } });
      if (this.current(revision)) this.setData({ editing: false, editRevision: null, editProofs: [], selected: [], chips: [], phone: '', proofError: '', proofNotice: '',
        notice: '申请已取消，全部座位已释放。' });
    }, true);
  },
  setSeatBlocks(event) {
    if (!this.data.manage || !this.data.canReview || !this._state) return;
    const blocked = event.currentTarget.dataset.blocked;
    if (typeof blocked !== 'boolean') return;
    const seats = this.data.selected.filter(id => (this._state.blockedSeats || []).includes(id) === !blocked);
    if (!seats.length) return;
    return this.work(blocked ? '正在锁定座位' : '正在解锁座位', async revision => {
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true, data: { action: 'block', seats, blocked } });
      if (this.current(revision)) this.setData({ notice: '已' + (blocked ? '锁定' : '解锁') + ' ' + seats.length + ' 个座位。' });
    }, true);
  },
  phoneInput(event) { if (!this.data.busy) this.setData({ phone: String(event.detail.value || '').slice(0, 24) }); },
  countInput(event) { if (!this.data.busy) this.setData({ requestedCount: event.detail.value }); },

  // One action at a time; every action re-reads the server state unless it reports nothing changed.
  async work(label, task, refresh) {
    if (this.data.busy || this.data.loading || this._closed) return;
    const revision = this._revision;
    this.setData({ busy: label, error: '', notice: '' });
    try {
      if (await task(revision) === false) refresh = false;
    } catch (cause) {
      if (this.current(revision)) this.setData({ error: (cause && cause.message) || '操作未完成，请重试' });
      refresh = true; // A failure (409 conflict included) may mean the seats or proofs changed.
    } finally {
      if (this.current(revision) && refresh) await this.load();
      if (this.current(revision)) this.setData({ busy: '' });
    }
  },
  chooseProofs() {
    const proofs = this.data.editing ? this.data.editProofs : this.data.drafts;
    if (!this.data.editable || proofs.length >= this.data.proofLimit) return;
    return this.work('正在上传凭证', async revision => {
      this.setData({ proofError: '', proofNotice: '' });
      let uploaded = 0;
      try {
        await privacy.authorize();
        if (!this.current(revision)) return false;
        const paths = await files.choose(Math.min(9, this.data.proofLimit - proofs.length));
        for (const filePath of paths) {
          if (!this.current(revision)) return false;
          const result = await http.upload(this._endpoint + '/proofs', filePath, { raw: true });
          if (!this.current(revision)) return false;
          const id = result && String(result.id);
          if (!proofPattern.test(id)) throw new Error('上传结果暂不可确认，请刷新座位后核对');
          const field = this.data.editing ? 'editProofs' : 'drafts';
          if (!this.data[field].includes(id)) this.setData({ [field]: this.data[field].concat(id) });
          uploaded++;
          this.setData({ proofNotice: '已上传 ' + uploaded + ' 张凭证。' });
        }
      } catch (cause) {
        if (cause && cause.code === 'MEDIA_PICK_CANCELLED') return false;
        if (this.current(revision)) this.setData({ proofError: (cause && cause.message) || '凭证上传未完成，请重试' });
        throw cause;
      }
    }, true);
  },
  removeProof(event) {
    const id = String(event.currentTarget.dataset.proof || '');
    const proofs = this.data.editing ? this.data.editProofs : this.data.drafts;
    if (!this.data.editable || !proofPattern.test(id) || !proofs.includes(id)) return;
    this.setData({ proofError: '', proofNotice: '' });
    if (this.data.editing && !this.data.drafts.includes(id)) {
      this.setData({ editProofs: this.data.editProofs.filter(value => value !== id) });
      return;
    }
    if (this.data.editing) this.setData({ editProofs: this.data.editProofs.filter(value => value !== id) });
    return this.work('正在移除凭证', () => http.request(this._endpoint + '/proofs/' + id, { method: 'DELETE', required: true, raw: true }), true);
  },
  previewProof(event) {
    const id = String(event.currentTarget.dataset.proof || '');
    const known = this.data.review ? this.data.docs.some(doc => doc.proofs.includes(id)) : this.data.manage ? Boolean(this.data.seatReview && this.data.seatReview.proofs.includes(id)) : (this.data.editing ? this.data.editProofs : this.data.drafts).includes(id);
    if (!proofPattern.test(id) || !known) return;
    return this.work('正在读取凭证', async revision => {
      const path = await http.download(this._endpoint + '/proofs/' + id);
      if (!this.current(revision) || this._hidden) return false;
      this._external = true;
      wx.previewImage({ current: path, urls: [path], fail: () => { this._external = false; } });
      return false;
    }, false);
  },
  submit() {
    if (!this.data.editable || this.data.busy || this.data.loading) return;
    const selected = this.data.selected, drafts = this.data.editing ? this.data.editProofs : this.data.drafts;
    const phone = String(this.data.phone || '').trim().replace(/[\s-]/g, '');
    const random = this.data.mode === 'random', count = Number(this.data.requestedCount);
    if (random && (!Number.isInteger(count) || count < 1 || count > this.data.seatLimit)) { this.setData({ error: '请输入 1 至 ' + this.data.seatLimit + ' 个座位' }); return; }
    if (!random && !selected.length) { this.setData({ error: '请先在座位图中选择座位' }); return; }
    if (!phonePattern.test(phone)) { this.setData({ error: '请填写有效的手机号' }); return; }
    if (!drafts.length || drafts.length > this.data.proofLimit) { this.setData({ error: '请选择 1 至 ' + this.data.proofLimit + ' 张活动参与凭证' }); return; }
    const editing = this.data.editing;
    const data = random ? { mode: 'random', count, phone, proofs: drafts } : { mode: 'selection', seats: selected, phone, proofs: drafts };
    if (editing) { data.action = 'edit'; data.id = this._state.mine.id; data.revision = this.data.editRevision; }
    return this.work(editing ? '正在保存修改' : '正在提交选座', async revision => {
      const result = await http.request(this._endpoint, { method: 'POST', required: true, raw: true, data });
      if (!this.current(revision)) return false;
      this.setData({ selected: [], chips: [], phone: '', drafts: [], editing: false, editProofs: [], editRevision: null, editable: false, proofError: '', proofNotice: '', mine: mineView(result && result.mine), notice: editing ? '修改已保存，申请继续等待审核。' : random ? '申请已提交，审核通过后安排座位。' : '选座申请已提交，座位进入待审核。' });
    }, true);
  },
  openReview() { if (this.data.canReview && this._endpoint && navigation.requireUser()) navigation.go('activity-seating', { kind: this._kind, id: this._id, mode: 'review' }); },

  // ---- reviewer workbench ----
  openMap() { if (this._endpoint) navigation.go('activity-seating', { kind: this._kind, id: this._id }); },
  openManage() { if (this.data.review && this._endpoint) navigation.go('activity-seating', { kind: this._kind, id: this._id, mode: 'manage' }); },
  inspectSeat(seat) {
    if (!this.data.manage || !this.data.canReview || !this._state || !this._state.occupancy[seat] || (this._state.blockedSeats || []).includes(seat)) return;
    this.setData({ seatReview: null, inspectedSeat: '' });
    return this.work('正在读取座位申请', async revision => {
      const result = await http.request(this._endpoint + '?mode=seat-review&seat=' + encodeURIComponent(seat), { required: true, raw: true });
      if (this.current(revision)) this.setData({ inspectedSeat: seatLabel(seat), seatReview: result && result.request ? reviewDoc(result.request) : null }, () => {
        if (wx.pageScrollTo) wx.pageScrollTo({ selector: '#seat-review-detail', duration: 200 });
      });
      return false;
    }, false);
  },
  closeSeatReview() { this.setData({ seatReview: null, inspectedSeat: '' }); },
  reviewRecord(id) {
    if (this.data.review) return this.data.docs.find(value => value.id === id);
    if (this.data.manage && this.data.canReview && this.data.seatReview && this.data.seatReview.id === id) return this.data.seatReview;
    return null;
  },
  openAdd(event) {
    const request = Number(event.currentTarget.dataset.id);
    const doc = this.reviewRecord(request);
    if (doc && (doc.status === 'pending' || doc.status === 'confirmed') && doc.seatCount < 10 && !this.data.busy && !this.data.loading)
      navigation.go('activity-seating', { kind: this._kind, id: this._id, mode: 'add', request });
  },
  openChange(event) {
    const request = Number(event.currentTarget.dataset.id);
    const doc = this.reviewRecord(request);
    if (doc && (doc.status === 'pending' || doc.status === 'confirmed') && !this.data.busy && !this.data.loading)
      navigation.go('activity-seating', { kind: this._kind, id: this._id, mode: 'change', request });
  },
  submitAdd() {
    const request = this._assignment, seats = this.data.selected.slice();
    if (!this.data.adding || !request || !this.data.editable || !seats.length) return;
    return this.work('正在增加座位', async revision => {
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true,
        data: { action: 'add-seats', id: request.id, revision: request.revision, status: request.status, seats } });
      if (this.current(revision)) this.setData({ selected: [], chips: [], notice: '已为申请增加 ' + seats.length + ' 个座位。' });
    }, true);
  },
  submitChange() {
    const request = this._assignment, seats = this.data.selected.slice();
    if (!this.data.changing || !request || !this.data.editable || !this.data.changeReady) return;
    return this.work('正在更换座位', async revision => {
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true,
        data: { action: 'change-seats', id: request.id, revision: request.revision, status: request.status, seats } });
      if (this.current(revision)) this.setData({ notice: '已更换座位，申请状态保持不变。' });
    }, true);
  },
  filter(event) {
    const status = event.currentTarget.dataset.status;
    if (!this.data.review || !labels[status] || this.data.busy || this.data.loading || status === this.data.status) return;
    this.setData({ status, statusLabel: labels[status], pageNumber: 1, docs: [], hasNextPage: false, error: '', notice: '' });
    return this.load();
  },
  turn(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    if (!this.data.review || this.data.busy || this.data.loading || (delta === -1 ? this.data.pageNumber <= 1 : delta !== 1 || !this.data.hasNextPage)) return;
    this.setData({ pageNumber: this.data.pageNumber + delta, error: '', notice: '' });
    return this.load();
  },
  changeOpeningDate(event) { this.setData({ openingDate: event.detail.value }); },
  changeOpeningTime(event) { this.setData({ openingTime: event.detail.value }); },
  setMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!this.data.review || !['selection', 'random'].includes(mode) || mode === this.data.mode) return;
    return this.work('正在切换座位模式', async revision => {
      await http.request(this._endpoint, { method: 'PUT', required: true, raw: true, data: { mode } });
      if (this.current(revision)) this.setData({ notice: mode === 'random' ? '已切换为随机座位模式。' : '已切换为自主选座模式。' });
    }, true);
  },
  adjustRandomCount(event) {
    const request = Number(event.currentTarget.dataset.id), doc = this.reviewRecord(request);
    if (!doc || !doc.unassigned) return;
    return this.work('正在调整申请数量', async revision => {
      const answer = await new Promise(resolve => wx.showActionSheet({ itemList: Array.from({ length: 10 }, (_, index) => (index + 1) + ' 个座位'), success: resolve, fail: () => resolve(null) }));
      if (!answer || !this.current(revision)) return false;
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true,
        data: { action: 'random-count', id: request, revision: doc.revision, count: answer.tapIndex + 1 } });
      if (this.current(revision)) this.setData({ notice: '申请数量已更新，请重新核对后审核。' });
    }, true);
  },
  setEnabled(event) {
    if (!this.data.review) return;
    const enabled = event && event.currentTarget && typeof event.currentTarget.dataset.enabled === 'boolean'
      ? event.currentTarget.dataset.enabled : !this.data.enabled;
    return this.saveOpening({ enabled }, enabled ? '选座已开启，成员可以提交申请。' : '选座已关闭：已有申请仍可审核。');
  },
  scheduleOpening() {
    const { openingDate, openingTime } = this.data;
    if (!openingDate || !openingTime) { this.setData({ error: '请选择开放日期和时间' }); return; }
    return this.saveOpening({ enabled: true, opensAt: openingDate + 'T' + openingTime }, '已保存定时开放。');
  },
  saveOpening(data, notice) {
    return this.work('正在保存', async revision => {
      await http.request(this._endpoint, { method: 'PUT', required: true, raw: true, data });
      if (this.current(revision)) this.setData({ notice });
    }, true);
  },
  decide(event) {
    const status = event.currentTarget.dataset.status, request = Number(event.currentTarget.dataset.id);
    if ((status !== 'confirmed' && status !== 'rejected') || !Number.isSafeInteger(request) || request <= 0) return;
    const doc = this.reviewRecord(request);
    if (!doc || doc.status !== 'pending') return;
    return this.work(status === 'confirmed' ? '正在通过申请' : '正在驳回申请', async revision => {
      if (status === 'rejected') {
        const answer = await new Promise(resolve => wx.showModal({ title: '驳回选座申请', content: '驳回后座位立即释放给其他成员，且不能撤回。确认驳回？',
          confirmText: '确认驳回', success: resolve, fail: () => resolve({ confirm: false }) }));
        if (!answer.confirm || !this.current(revision)) return false;
      }
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true, data: { action: 'review', id: request, status, revision: doc.revision, ...(doc.unassigned ? { expectedCount: doc.seatCount } : {}) } });
      if (this.current(revision)) this.setData({ notice: status === 'confirmed' ? (doc.unassigned ? '已通过并安排座位。' : '已通过并锁定座位。') : '已驳回并释放座位。' });
    }, true);
  },
  revoke(event) {
    const request = Number(event.currentTarget.dataset.id);
    if (!Number.isSafeInteger(request) || request <= 0) return;
    const doc = this.reviewRecord(request);
    if (!doc || doc.status !== 'confirmed') return;
    return this.work('正在撤销确认', async revision => {
      const answer = await new Promise(resolve => wx.showModal({ title: '撤销确认', content: '撤销后此申请的全部座位将释放给其他成员。确认撤销？',
        confirmText: '确认撤销', success: resolve, fail: () => resolve({ confirm: false }) }));
      if (!answer.confirm || !this.current(revision)) return false;
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true,
        data: { action: 'revoke', id: request, revision: doc.revision } });
      if (this.current(revision)) this.setData({ notice: '已撤销确认，全部座位已释放。' });
    }, true);
  },
  revokeSeat(event) {
    const request = Number(event.currentTarget.dataset.id), seat = String(event.currentTarget.dataset.seat || '');
    if (!Number.isSafeInteger(request) || request <= 0) return;
    const doc = this.reviewRecord(request);
    if (!doc || doc.status !== 'confirmed' || !doc.seatItems.some(item => item.id === seat)) return;
    return this.work('正在撤销座位', async revision => {
      const message = doc.seatCount === 1 ? '这是最后一个座位，撤销后整份申请将变为已撤销。' : '该座位将释放，其余座位继续保持已确认。';
      const answer = await new Promise(resolve => wx.showModal({ title: '撤销 ' + seatLabel(seat), content: message,
        confirmText: '确认撤销', success: resolve, fail: () => resolve({ confirm: false }) }));
      if (!answer.confirm || !this.current(revision)) return false;
      const result = await http.request(this._endpoint, { method: 'POST', required: true, raw: true,
        data: { action: 'revoke-seat', id: request, revision: doc.revision, seat } });
      if (this.current(revision)) this.setData({ notice: result && result.fullyRevoked ? '座位已释放，申请已全部撤销。' : '该座位已释放，其余座位保持已确认。' });
    }, true);
  },
  call(event) {
    const phone = String(event.currentTarget.dataset.phone || '').replace(/[\s-]/g, '');
    const known = this.data.review ? this.data.docs.some(doc => doc.phone.replace(/[\s-]/g, '') === phone) : this.data.manage && this.data.seatReview && this.data.seatReview.phone.replace(/[\s-]/g, '') === phone;
    if (!phonePattern.test(phone) || !known) return;
    this._external = true;
    wx.makePhoneCall({ phoneNumber: phone, fail: () => { this._external = false; } });
  },
}));
