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
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const labelsZh = { pending: '待审核', confirmed: '已确认', rejected: '已驳回', cancelled: '已取消', revoked: '已撤销', blocked: '未开放' };
const labelsEn = { pending: 'Pending', confirmed: 'Confirmed', rejected: 'Rejected', cancelled: 'Cancelled', revoked: 'Revoked', blocked: 'Closed' };
// Read at access time so the current language applies.
const labels = {};
Object.keys(labelsZh).forEach(key => Object.defineProperty(labels, key, { enumerable: true, get: () => i18n.t(labelsZh[key], labelsEn[key]) }));
// Busy states keep their Chinese value (compared in WXML); busyText is the displayed form.
const busyEn = { '正在保存票据': 'Saving ticket', '正在上传票据': 'Uploading tickets', '正在读取座位图': 'Loading seat map', '正在保存座位图': 'Saving seat map', '正在取消申请': 'Cancelling request', '正在锁定座位': 'Locking seats', '正在解锁座位': 'Unlocking seats',
  '正在上传凭证': 'Uploading proof', '正在移除凭证': 'Removing proof', '正在读取凭证': 'Loading proof', '正在保存修改': 'Saving changes', '正在提交选座': 'Submitting seat request', '正在读取座位申请': 'Loading seat request', '正在增加座位': 'Adding seats',
  '正在更换座位': 'Changing seats', '正在切换座位模式': 'Switching seat mode', '正在调整申请数量': 'Adjusting seat count', '正在保存': 'Saving', '正在通过申请': 'Approving request', '正在驳回申请': 'Rejecting request', '正在撤销确认': 'Revoking confirmation', '正在撤销座位': 'Revoking seat' };
const titleZh = data => data.review ? '选座工作台' : data.manage ? '管理座位' : data.adding ? '增加座位' : data.changing ? '更换座位' : '活动选座';
const titleEn = { '选座工作台': 'Seating workbench', '管理座位': 'Manage seats', '增加座位': 'Add seats', '更换座位': 'Change seats', '活动选座': 'Seat selection' };
const text = { back: ['‹ 返回', '‹ Back'], kickerReview: ['SEATING · 选座工作台', 'SEATING · Workbench'], kickerManage: ['SEATING · 管理座位', 'SEATING · Manage seats'], kickerAdd: ['SEATING · 增加座位', 'SEATING · Add seats'], kickerChange: ['SEATING · 更换座位', 'SEATING · Change seats'], kickerSelect: ['SEATING · 活动选座', 'SEATING · Seat selection'],
  titleReview: ['选座工作台', 'Seating workbench'], titleManage: ['管理座位', 'Manage seats'], titleAdd: ['增加座位', 'Add seats'], titleChange: ['更换座位', 'Change seats'], titleSelect: ['活动选座', 'Seat selection'],
  waiting: ['等待开放', 'Opening soon'], openNow: ['选座开放中', 'Seat selection open'], closed: ['选座已关闭', 'Seat selection closed'], notOpened: ['选座未开启', 'Seat selection not opened'], openShort: ['选座开放', 'Seat selection open'], notEnabled: ['选座未启用', 'Seat selection not enabled'],
  requestPrefix: ['为申请 #', 'Request #'], addSuffix: [' 增加座位', ': add seats'], changeSuffix: [' 更换座位', ': change seats'],
  rowsSuffix: [' 排 · ', ' rows · '], seatsSuffix: [' 座 · 剩余 ', ' seats · free '], reviewHint: ['核对手机号与凭证：通过锁定，驳回释放', 'Check phone and proof: approve to lock, reject to release'], refreshing: ['正在刷新…', 'Refreshing…'], ellipsisSuffix: ['…', '…'],
  settings: ['选座设置', 'Seat settings'], open: ['开放中', 'Open'], closedShort: ['已关闭', 'Closed'], notOpenedShort: ['未开启', 'Not opened'],
  hintScheduled: ['开放时间到达后，成员可在活动页选座并提交凭证。', 'Once open, members can pick seats and submit proof on the event page.'], hintEnabled: ['成员可在活动页选座并提交凭证。关闭后不再接收新申请，已提交的申请仍在此审核。', 'Members can pick seats and submit proof on the event page. After closing, no new requests are accepted; submitted ones are still reviewed here.'], hintDisabled: ['开启后成员可选择 1–10 个座位并提交手机号与凭证；未公开的活动不能开启。', 'Once opened, members can pick 1–10 seats and submit a phone number and proof; unpublished events cannot be opened.'],
  opensPrefix: ['将于北京时间 ', 'Opens at '], opensSuffix: [' 开放选座。', ' (Beijing time).'], modePrefix: ['当前模式：', 'Current mode: '], modeRandom: ['随机安排', 'random assignment'], modeSelection: ['自主选座', 'self-selection'], modeSuffix: ['。已确认座位及已有申请保持不变。', '. Confirmed seats and existing requests stay unchanged.'],
  selection: ['自主选座', 'Self-selection'], random: ['随机座位', 'Random seats'], scheduleLabel: ['定时开放（北京时间）', 'Scheduled opening (Beijing time)'], openingDate: ['开放日期', 'Opening date'], openingTime: ['开放时间', 'Opening time'], pickDate: ['选择日期', 'Choose date'], pickTime: ['选择时间', 'Choose time'], saveOpening: ['保存开放时间', 'Save opening time'],
  openImmediately: ['立即开放', 'Open now'], enable: ['开启选座', 'Open seat selection'], disable: ['关闭选座', 'Close seat selection'], viewMap: ['查看座位图', 'View seat map'], manageAndReview: ['管理座位和查看申请', 'Manage seats and requests'],
  layoutTitle: ['自定义座位图', 'Custom seat map'], collapse: ['收起', 'Collapse'], editLayout: ['编辑座位图', 'Edit seat map'], layoutHint: ['设置排数、列数，点击方格切换座位与空位。', 'Set rows and columns; tap a cell to toggle seat or gap.'],
  layoutLegacy: ['当前原座位图已有占用、锁定或票据，继续保留原图。新活动可配置自定义座位图。', 'The current seat map already has requests, locks or tickets, so it is kept. New events can use a custom map.'], layoutNumbering: ['保存后按方格的排号、列号作为座位编号；票据文件名与座位编号对应。', 'After saving, row and column numbers become seat numbers; ticket file names match them.'],
  rowCount: ['排数', 'Rows'], columnCount: ['每排列数', 'Columns per row'], applySize: ['应用行列', 'Apply size'], allSeats: ['全部设为座位', 'Make all seats'], clearCells: ['清空方格', 'Clear cells'],
  layoutNowPrefix: ['当前 ', 'Now '], layoutRowsSuffix: [' 排 × ', ' rows × '], layoutColumnsSuffix: [' 列，', ' columns, '], layoutSeatsSuffix: [' 个座位。已有申请、锁定或票据的座位保持不变。', ' seats. Seats with requests, locks or tickets stay unchanged.'],
  rowLabelSuffix: ['排', ''], rowAriaPrefix: ['第 ', 'Row '], rowAriaMiddle: [' 排第 ', ', column '], columnAriaSuffix: [' 列，', ', '], seat: ['座位', 'seat'], gap: ['空位', 'gap'], saveLayout: ['保存座位图', 'Save seat map'],
  tickets: ['座位电子票据', 'Seat e-tickets'], ticketsHint: ['从微信聊天文件中批量选择 JPG 或 PNG，文件名例如 01排01座.jpg。单张最多 8 MB；重新上传会更新对应座位的票据。', 'Select JPG or PNG files from WeChat chats in bulk, named like 01排01座.jpg. Up to 8 MB each; re-uploading replaces that seat\'s ticket.'],
  ticketsUploadedPrefix: ['已上传 ', 'Tickets uploaded for '], ticketsUploadedSuffix: [' 个座位的票据，已确认座位的成员可在回执查看和保存。', ' seats; members with confirmed seats can view and save them on their receipt.'], chooseTickets: ['选择票据文件', 'Choose ticket files'],
  emptyPrefix: ['此页没有', 'No '], emptySuffix: ['的选座申请', ' seat requests on this page'], emptyPending: ['新的选座申请提交后会出现在这里。', 'New seat requests will appear here.'], emptyOther: ['切换上方状态查看其他申请。', 'Switch the status above to see other requests.'],
  phone: ['手机号', 'Phone'], seats: ['座位', 'Seats'], countSuffix: [' 个 · ', ' · '], released: ['已释放座位', 'Released seats'], added: ['管理员增加座位', 'Seats added by admin'], submitted: ['提交时间', 'Submitted'], reviewed: ['审核时间', 'Reviewed'],
  proofsPrefix: ['活动参与凭证 ', 'Participation proof: '], proofsSuffix: [' 张', ''], proofPrefix: ['凭证 ', 'Proof '], revokeSingle: ['撤销单个座位', 'Revoke a single seat'], revokePrefix: ['撤销 ', 'Revoke '], call: ['拨打', 'Call'], adjustCount: ['调整数量', 'Adjust count'],
  addSeats: ['增加座位', 'Add seats'], changeSeats: ['更换座位', 'Change seats'], approve: ['通过并锁定', 'Approve and lock'], reject: ['驳回并释放', 'Reject and release'], revoke: ['撤销确认', 'Revoke confirmation'], previous: ['上一页', 'Previous'], pagePrefix: ['第 ', 'Page '], pageSuffix: [' 页', ''], next: ['下一页', 'Next'],
  mine: ['我的选座申请', 'My seat request'], seatCountSuffix: [' 个座位', ' seats'],
  minePendingSeats: ['座位已为你保留，等待管理员核对凭证后锁定。', 'Your seats are held and will be locked after an admin checks your proof.'], minePending: ['申请等待审核，通过后可查看座位。', 'Your request is awaiting review; seats are shown once approved.'], mineConfirmed: ['审核已通过，座位已锁定。', 'Approved; your seats are locked.'], mineCancelled: ['申请已取消，座位已释放。', 'Request cancelled; seats released.'], mineRevoked: ['管理员已撤销确认，座位已释放。', 'An admin revoked the confirmation; seats released.'], mineRejectedEditable: ['申请已驳回，座位已释放；可以重新选座并提交凭证。', 'Request rejected; seats released. You can pick seats and submit proof again.'], mineRejected: ['申请已驳回，座位已释放。', 'Request rejected; seats released.'],
  ticketAriaSuffix: ['电子票据', ' e-ticket'], saveTicket: ['保存票据到相册', 'Save ticket to album'], ticketFailed: ['票据读取失败，请刷新重试。', 'The ticket failed to load. Refresh to retry.'], ticketLoading: ['正在读取票据…', 'Loading ticket…'], ticketPending: ['票据上传后将在这里显示。', 'The ticket will appear here once uploaded.'],
  editRequest: ['修改申请', 'Edit request'], cancelRequest: ['取消选座申请', 'Cancel seat request'], workbench: ['选座工作台', 'Seating workbench'],
  addExistingPrefix: ['已有 ', 'Has '], addExistingMiddle: [' 个座位，最多还可增加 ', ' seats; up to '], addExistingSuffix: [' 个；申请状态保持不变。', ' more can be added. The request status stays the same.'],
  changeHintPrefix: ['先取消要换出的座位，再选择新座位，保留 ', 'Deselect the seats to swap out, then pick new ones, keeping '], changeHintSuffix: [' 个座位；申请状态保持不变。', ' seats. The request status stays the same.'],
  legend: ['座位状态图例', 'Seat status legend'], available: ['可选', 'Available'], picked: ['已选', 'Selected'], pending: ['待审核', 'Pending'], confirmed: ['已确认', 'Confirmed'], blocked: ['未开放', 'Closed'], accent: ['中心区', 'Center'],
  zoom: ['座位图缩放', 'Seat map zoom'], zoomOut: ['缩小座位图', 'Zoom out'], zoomIn: ['放大座位图', 'Zoom in'], stage: ['舞台 · 屏幕', 'Stage · Screen'],
  manageHint: ['左右滑动查看座位。点击待审核或已确认的座位查看申请；点选空座锁定，点选未开放的座位解锁。', 'Swipe to see seats. Tap a pending or confirmed seat to view its request; tap free seats to lock or closed seats to unlock.'], scrollHint: ['左右滑动查看整排座位', 'Swipe sideways to see whole rows'], scrollEditHint: ['；点选可选座位，再点一次取消', '; tap an available seat, tap again to deselect'], periodSuffix: ['。', '.'],
  randomNotice: ['当前为随机座位模式，审核通过后系统安排座位，并优先安排同排连坐。', 'Random seat mode: seats are assigned after approval, keeping groups together in a row where possible.'],
  inspectSuffix: ['的申请', ': request'], close: ['关闭', 'Close'], requestNumber: ['申请编号', 'Request no.'], noRequest: ['该座位当前没有申请，请刷新座位图。', 'This seat has no request. Refresh the seat map.'],
  selectedPrefix: ['已选 ', 'Selected '], selectedMiddle: [' 个空座、', ' free and '], selectedSuffix: [' 个未开放座位', ' closed seats'], lockSelected: ['锁定所选空座', 'Lock selected free seats'], unlockSelected: ['解锁所选座位', 'Unlock selected seats'],
  closedNotice: ['当前活动选座已关闭，不再接收新的申请；已提交的申请仍由管理员处理。', 'Seat selection is closed and no longer accepts requests; submitted ones are still handled by admins.'], notOpenedTitle: ['本活动暂未开启选座', 'Seat selection is not open for this event'], notOpenedBody: ['开启后会在活动详情显示选座入口。', 'Once opened, the event page shows a seat selection entry.'],
  refreshSeats: ['刷新座位', 'Refresh seats'], loginToSelect: ['登录后选座', 'Sign in to pick seats'], addTitle: ['选择要增加的座位', 'Choose seats to add'], limitPrefix: ['/ ', '/ '], tapHint: ['在座位图中点选可用座位。', 'Tap available seats on the map.'], confirmAdd: ['确认增加座位', 'Confirm added seats'],
  changeTitle: ['更换后的座位', 'New seats'], changeCountHint: ['选择与原申请相同数量的座位后确认。', 'Choose the same number of seats as the original request, then confirm.'], confirmChange: ['确认更换座位', 'Confirm seat change'],
  editTitle: ['修改选座申请', 'Edit seat request'], submitTitle: ['提交选座申请', 'Submit seat request'], requestedCount: ['订座数量', 'Number of seats'], countHintPrefix: ['可申请 1–', 'Request 1–'], countHintSuffix: [' 个座位，审核后安排。', ' seats; assigned after review.'],
  unpickPrefix: ['取消 ', 'Deselect '], pickHintPrefix: ['在座位图中点选 1–', 'Tap 1–'], pickHintSuffix: [' 个座位。', ' seats on the map.'], phonePlaceholder: ['仅供本活动审核联系', 'Only used to contact you about this event'],
  proof: ['活动参与凭证', 'Participation proof'], proofCountPrefix: ['已选择 ', 'Selected '], proofCountMiddle: [' 张 · JPEG/PNG/WebP · 单张最多 ', ' · JPEG/PNG/WebP · up to '], proofCountSuffix: [' MB', ' MB each'],
  view: ['查看', 'View'], removeProofPrefix: ['移除凭证 ', 'Remove proof '], remove: ['移除', 'Remove'], uploadingProof: ['正在上传凭证…', 'Uploading proof…'], uploadProof: ['＋ 上传凭证', '＋ Upload proof'],
  hintEditing: ['保存后申请继续等待审核。', 'After saving, the request stays in review.'], hintRandom: ['手机号与凭证仅供本活动审核使用。审核通过后系统安排座位。', 'Your phone and proof are used only to review this event. Seats are assigned after approval.'], hintSelection: ['手机号与凭证仅供本活动审核使用。提交后座位进入待审核；每人每场活动只保留一份待审核或已确认的申请。', 'Your phone and proof are used only to review this event. Submitted seats go to review; each person keeps one pending or confirmed request per event.'],
  cancelEdit: ['取消修改', 'Cancel editing'], saveEdit: ['保存修改', 'Save changes'], submit: ['提交选座', 'Submit seat request'] };
const tones = { pending: 'warning', confirmed: 'success', rejected: 'neutral', cancelled: 'neutral', revoked: 'neutral' };
const filterList = () => ['pending', 'confirmed', 'rejected', 'cancelled', 'revoked'].map(status => ({ status, label: labels[status] }));
const filters = filterList();
// Pixel-sized targets stay usable on narrow phones; match the zoom rules and gap in index.wxss.
const zooms = [{ size: 44, label: '紧凑' }, { size: 52, label: '标准' }, { size: 60, label: '放大' }];
const zoomEn = ['Compact', 'Standard', 'Large'];
const zoomName = index => i18n.t(zooms[index].label, zoomEn[index]);
const GAP = 6; // px between seats, shared by row indents and board width
const phonePattern = /^\+?[1-9]\d{6,14}$/;
const proofPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const seatLabel = value => { const parts = String(value).split('-'); return i18n.t(parts[0] + '排' + parts[1] + '座', 'Row ' + parts[0] + ' Seat ' + parts[1]); };
const seatNames = seats => (seats || []).map(seatLabel).join(i18n.t('、', ', '));
const chipsFor = selected => selected.map(id => ({ id, label: seatLabel(id) }));
const memberOf = user => (user && user.id ? String(user.id) : '');
const step = zoom => zooms[zoom].size + GAP;
const boardWidth = (rows, zoom) => Math.max(...rows.map(row => row.offset + row.count)) * step(zoom) + 24;
const draftCells = (grid, protectedSeats, lockedLegacy) => {
  const gaps = new Set(grid.gaps || []), locked = new Set(protectedSeats || []);
  return Array.from({ length: grid.rowCount }, (_, row) => ({ row: row + 1,
    cells: Array.from({ length: grid.columnCount }, (_, column) => {
      const id = (row + 1) + '-' + (column + 1);
      return { id, number: column + 1, present: !gaps.has(id), locked: !lockedLegacy && locked.has(id) };
    }) }));
};
// Everything private or account-bound that must disappear when the account changes.
const cleared = () => ({ rows: [], chips: [], selected: [], phone: '', drafts: [], mine: null, tickets: [], ticketSeats: [], ticketUploadErrors: [], layoutOpen: false, layoutInfo: null, layoutGrid: null, layoutCells: [], docs: [], counts: null, busy: '', error: '', notice: '', proofError: '', proofNotice: '',
  editable: false, editing: false, editRevision: null, editProofs: [], canEditMine: false, loggedIn: false, canReview: false, enabled: false, mode: 'selection', requestedCount: 1, open: false, scheduled: false, opensAt: null, openingLabel: '', openingDate: '', openingTime: '', title: '', loadError: '', selectedBlocked: 0, selectedAvailable: 0, requestNumber: null, existingCount: 0, seatReview: null, inspectedSeat: '', changeReady: false });

function seatCell(id, number, taken, picked, accent, blocked, manage, own) {
  const style = blocked ? 'blocked' : own && picked ? 'selected' : taken || (picked ? 'selected' : 'available');
  const state = blocked ? labels.blocked : taken ? labels[taken] : picked ? i18n.t('已选', 'Selected') : i18n.t('可选', 'Available');
  const inspect = Boolean(manage && taken && !blocked && !own);
  const locked = Boolean(taken && !(manage && blocked) && !own && !inspect);
  return { id, number, style, ...(picked ? { picked: true } : {}), ...(locked ? { locked: true } : {}), label: seatLabel(id) + (accent ? ' · ' + i18n.t('中心区', 'Center') : '') + ' · ' + state + (picked && (blocked || own) ? ' · ' + i18n.t('已选', 'Selected') : '') + (inspect ? ' · ' + i18n.t('查看申请', 'View request') : '') };
}
function counts(state) {
  const missing = new Set(state.missingSeats || []);
  const locked = new Set(state.blockedSeats || []);
  const total = state.rows.reduce((sum, row) => sum + row.count, 0) - missing.size;
  const blocked = (state.blockedSeats || []).filter(key => !missing.has(key)).length;
  const values = Object.keys(state.occupancy || {}).filter(key => !locked.has(key) && !missing.has(key)).map(key => state.occupancy[key]);
  const pending = values.filter(value => value === 'pending').length, confirmed = values.filter(value => value === 'confirmed').length;
  return { rows: state.rows.length, total, pending, confirmed, blocked, free: Math.max(0, total - pending - confirmed - blocked) };
}
function mineView(mine) {
  return mine && labels[mine.status] ? { status: mine.status, label: labels[mine.status], tone: tones[mine.status], seats: seatNames(mine.seats), count: mine.requestedCount || (mine.seats || []).length } : null;
}
function reviewDoc(row) {
  const unassigned = row.status === 'pending' && row.allocationMode === 'random' && !(row.seats || []).length;
  return { id: row.id, revision: row.revision, memberName: row.memberName || i18n.t('成员', 'Member'), phone: row.phone || '', status: row.status, label: labels[row.status] || '',
    tone: tones[row.status] || 'neutral', seats: unassigned ? i18n.t('审核通过后安排', 'Assigned after approval') : seatNames(row.seats), seatCount: unassigned ? row.requestedCount : (row.seats || []).length, unassigned,
    seatItems: (row.seats || []).map(id => ({ id, label: seatLabel(id) })),
    releasedSeats: seatNames((row.releasedSeats || []).map(item => item.seat)),
    addedSeats: seatNames((row.addedSeats || []).map(item => item.seat)),
    proofs: (row.proofs || []).filter(id => proofPattern.test(String(id))),
    submitted: format.date(row.createdAt), reviewed: row.reviewedAt ? format.date(row.reviewedAt) : '' };
}

Page(withVisualTheme({
  data: { review: false, manage: false, adding: false, changing: false, changeReady: false, requestNumber: null, existingCount: 0, seatReview: null, inspectedSeat: '', kind: '', title: '', loading: true, busy: '', error: '', loadError: '', notice: '', proofError: '', proofNotice: '', needsLogin: false,
    enabled: false, mode: 'selection', requestedCount: 1, open: false, scheduled: false, opensAt: null, openingLabel: '', openingDate: '', openingTime: '', loggedIn: false, canReview: false, editable: false, editing: false, editRevision: null, editProofs: [], canEditMine: false, counts: null,
    rows: [], boardWidth: 0, zoom: 1, zoomLabel: zooms[1].label, busyText: '', selected: [], selectedBlocked: 0, selectedAvailable: 0, chips: [], phone: '', drafts: [], mine: null, tickets: [], ticketSeats: [], ticketUploadErrors: [],
    layoutOpen: false, layoutInfo: null, layoutGrid: null, layoutCells: [], layoutRowInput: '10', layoutColumnInput: '10', layoutWidth: 0, layoutCount: 0, layoutLegacyLocked: false,
    seatLimit: 10, proofLimit: 10, proofMB: 8,
    filters, status: 'pending', statusLabel: labels.pending, pageNumber: 1, hasNextPage: false, docs: [] },
  ...actions,

  onLoad(options) {
    i18n.bind(this, text);
    this.setData({ filters: filterList(), statusLabel: labels[this.data.status], zoomLabel: zoomName(this.data.zoom) });
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
    const title = titleZh({ review, manage, adding, changing }); i18n.navTitle(title, titleEn[title]);
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
    // Language changed while hidden: relabel now and treat the view as stale (reloads when not busy).
    if ((i18n.refreshIfStale ? i18n.refreshIfStale(this) : false)) { this._stale = true; this.onLocaleChange(); }
    const title = titleZh(this.data); i18n.navTitle(title, titleEn[title]);
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
  onLocaleChange() {
    this.setData({ filters: filterList(), statusLabel: labels[this.data.status], zoomLabel: zoomName(this.data.zoom), ...(this.data.busy ? { busyText: i18n.t(this.data.busy, busyEn[this.data.busy]) } : {}) });
    if (!this.data.busy && !this.data.loading && !this._hidden && !this._closed) this.load();
  },
  onUnload() {
    i18n.unbind(this);
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
    if (!this._endpoint) { this.setData({ loading: false, loadError: i18n.t('活动入口无效，请从活动详情重新进入。', 'Invalid activity link. Open it again from the event page.') }); return; }
    if ((this.data.adding || this.data.changing) && !this._requestID) { this.setData({ loading: false, loadError: i18n.t('申请入口无效，请从工作台重新进入。', 'Invalid request link. Open it again from the workbench.') }); return; }
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
        this.setData({ ...cleared(), loadError: i18n.t('无权管理此活动的座位', 'You cannot manage seats for this event') });
        return;
      }
      if (review) { this.showReview(data); void this.loadTicketList(read, revision); }
      else if (this.data.adding || this.data.changing) this.showAssignment(data);
      else { this.showState(data); if (!this.data.manage) void this.loadTicketImages(data, read, revision); }
    } catch (cause) {
      if (!this.reading(read, revision)) return;
      const message = (cause && cause.message) || i18n.t('选座信息读取失败，请重试', 'Seat information failed to load. Please try again.');
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
    this.setData({ title: data.title || i18n.t('活动选座', 'Seat selection'), enabled: Boolean(data.enabled), mode, ...(mode !== this.data.mode ? { requestedCount: data.mine && data.mine.requestedCount || 1, ...(this.data.title ? { notice: i18n.t('座位模式已更新，请按当前模式填写申请。', 'The seat mode changed. Fill in the request for the current mode.') } : {}) } : {}), open: Boolean(data.open), scheduled: data.scheduled === true, opensAt: data.opensAt || null, openingLabel: data.opensAt ? format.date(data.opensAt) : '', loggedIn: Boolean(data.loggedIn),
      canReview: Boolean(data.canReview), editable, editing, canEditMine, mine, drafts: (data.drafts || []).filter(id => proofPattern.test(String(id))),
      ...(!editing && this.data.editing ? { editRevision: null, editProofs: [], phone: '' } : {}),
      seatLimit: data.seatLimit, proofLimit: data.proofLimit, proofMB: Math.round(data.proofBytes / 1024 / 1024),
      selected, selectedBlocked: 0, selectedAvailable: 0, chips: chipsFor(selected), counts: showMap ? counts(data) : null, hasAccent: data.rows.some(row => row.accent), seatReview: null, inspectedSeat: '',
      rows: showMap && (data.enabled || manage || editing) ? this.layout(data, selected, this.data.zoom, editing) : [], boardWidth: showMap && (data.enabled || manage || editing) ? boardWidth(data.rows, this.data.zoom) : 0 });
    this.scheduleModeRefresh();
  },
  async loadTicketList(read, revision) {
    try {
      const result = await http.request(this._endpoint + '/tickets', { required: true, raw: true });
      if (this.reading(read, revision)) this.setData({ ticketSeats: Array.isArray(result.seats) ? result.seats : [] });
    } catch (cause) {
      if (this.reading(read, revision)) this.setData({ ticketSeats: [], ticketUploadErrors: [(cause && cause.message) || i18n.t('票据清单读取失败', 'The ticket list failed to load')] });
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
        fail: () => reject(new Error(i18n.t('保存失败，请检查微信的相册权限后重试', 'Saving failed. Check WeChat album permission and try again.'))) }));
      if (this.current(revision)) this.setData({ notice: i18n.t(ticket.label + '的票据已保存到相册。', 'Ticket for ' + ticket.label + ' saved to album.') });
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
          else reject(new Error(i18n.t('选择文件失败，请重新选择', 'File selection failed. Please choose again.')));
        } }));
      if (!selected.length || !this.current(revision)) return false;
      const counts = {};
      for (const file of selected) {
        const match = /^(\d{1,3})排(\d{1,3})座\.(jpg|jpeg|png)$/i.exec(file.name || '');
        if (match) { const seat = Number(match[1]) + '-' + Number(match[2]); counts[seat] = (counts[seat] || 0) + 1; }
      }
      const errors = []; let saved = 0;
      for (const file of selected) {
        if (!this.current(revision)) return false;
        const match = /^(\d{1,3})排(\d{1,3})座\.(jpg|jpeg|png)$/i.exec(file.name || '');
        const seat = match && (Number(match[1]) + '-' + Number(match[2]));
        if (!match || !file.path) { errors.push((file.name || i18n.t('文件', 'File')) + i18n.t('：文件名无效', ': invalid file name')); continue; }
        if (counts[seat] > 1) { errors.push(file.name + i18n.t('：本次选择中同一座位有多个文件', ': several files for the same seat in this selection')); continue; }
        if (!file.size || file.size > 8 * 1024 * 1024) { errors.push(file.name + i18n.t('：单张图片最多 8 MB', ': images can be up to 8 MB')); continue; }
        try {
          await http.upload(this._endpoint + '/tickets', file.path, { raw: true, formData: { filename: file.name } });
          saved++;
        } catch (cause) { errors.push(file.name + i18n.t('：', ': ') + ((cause && cause.message) || i18n.t('上传失败', 'Upload failed'))); }
      }
      if (this.current(revision)) this.setData({ notice: i18n.t('已保存 ' + saved + ' 张票据' + (errors.length ? '，' + errors.length + ' 张未完成' : '') + '。', 'Saved ' + saved + ' tickets' + (errors.length ? ', ' + errors.length + ' not completed' : '') + '.'), ticketUploadErrors: errors });
      return true;
    }, true);
  },
  showReview(data) {
    const opensAt = data.opensAt || null;
    const fields = opensAt !== this.data.opensAt ? format.beijingParts(opensAt) : null;
    this.setData({ title: data.title || i18n.t('选座工作台', 'Seating workbench'), enabled: Boolean(data.enabled), mode: data.mode === 'random' ? 'random' : 'selection', open: Boolean(data.open),
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
    this.setData({ title: data.title || (changing ? i18n.t('更换座位', 'Change seats') : i18n.t('增加座位', 'Add seats')), requestNumber: data.request.id, existingCount: data.request.seats.length,
      seatLimit: limit, editable: changing || remaining > 0, canReview: true, selected, changeReady, chips: chipsFor(selected), counts: counts(data), hasAccent: data.rows.some(row => row.accent),
      rows: this.layout(data, selected, this.data.zoom, false), boardWidth: boardWidth(data.rows, this.data.zoom) });
  },
  openLayout() {
    if (!this.data.review || this.data.busy || this.data.loading) return;
    if (this.data.layoutOpen) { this.setData({ layoutOpen: false }); return; }
    return this.work('正在读取座位图', async revision => {
      const info = await http.request(this._endpoint + '/layout', { required: true, raw: true });
      if (!this.current(revision)) return false;
      const grid = info.layout || { rowCount: 10, columnCount: 10, gaps: [] };
      const protectedSeats = Array.isArray(info.protectedSeats) ? info.protectedSeats : [];
      const locked = !info.layout && protectedSeats.length > 0;
      this.setData({ layoutOpen: true, layoutInfo: info, layoutGrid: grid, layoutCells: draftCells(grid, protectedSeats, locked),
        layoutRowInput: String(grid.rowCount), layoutColumnInput: String(grid.columnCount), layoutWidth: grid.columnCount * 42 + 52,
        layoutCount: grid.rowCount * grid.columnCount - grid.gaps.length, layoutLegacyLocked: locked });
      return false;
    }, false);
  },
  layoutInput(event) {
    const key = event.currentTarget.dataset.key;
    if (key === 'row' || key === 'column') this.setData({ [key === 'row' ? 'layoutRowInput' : 'layoutColumnInput']: event.detail.value });
  },
  layoutResize() {
    const rows = Number(this.data.layoutRowInput), columns = Number(this.data.layoutColumnInput);
    const info = this.data.layoutInfo, old = this.data.layoutGrid;
    if (!info || !old || this.data.layoutLegacyLocked) return;
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 || rows > 100 || columns > 100) {
      this.setData({ error: i18n.t('行数和列数请填写 1–100 的整数。', 'Rows and columns must be whole numbers from 1 to 100.') }); return;
    }
    if (info.layout && (info.protectedSeats || []).some(id => { const p = id.split('-').map(Number); return p[0] > rows || p[1] > columns; })) {
      this.setData({ error: i18n.t('调整范围需保留已有申请、锁定或票据的座位。', 'The new size must keep seats that have requests, locks or tickets.') }); return;
    }
    const grid = { rowCount: rows, columnCount: columns, gaps: old.gaps.filter(id => { const p = id.split('-').map(Number); return p[0] <= rows && p[1] <= columns; }) };
    this.setData({ layoutGrid: grid, layoutCells: draftCells(grid, info.protectedSeats, false), layoutWidth: columns * 42 + 52,
      layoutCount: rows * columns - grid.gaps.length, error: '', notice: i18n.t('方格已调整，请确认座位后保存。', 'Grid resized. Check the seats, then save.') });
  },
  layoutToggle(event) {
    if (this.data.busy || this.data.loading || this.data.layoutLegacyLocked) return;
    const r = Number(event.currentTarget.dataset.row), c = Number(event.currentTarget.dataset.column);
    const cell = this.data.layoutCells[r] && this.data.layoutCells[r].cells[c], grid = this.data.layoutGrid;
    if (!cell || cell.locked || !grid) return;
    const gaps = cell.present ? grid.gaps.concat(cell.id) : grid.gaps.filter(id => id !== cell.id);
    this.setData({ layoutGrid: { ...grid, gaps }, ['layoutCells[' + r + '].cells[' + c + '].present']: !cell.present,
      layoutCount: grid.rowCount * grid.columnCount - gaps.length, error: '', notice: '' });
  },
  layoutAll(event) {
    const info = this.data.layoutInfo, old = this.data.layoutGrid;
    if (!info || !old || this.data.layoutLegacyLocked) return;
    const present = event.currentTarget.dataset.present === true;
    const locked = new Set(info.layout ? info.protectedSeats || [] : []);
    const gaps = present ? [] : Array.from({ length: old.rowCount }, (_, row) => Array.from({ length: old.columnCount }, (_, col) => (row + 1) + '-' + (col + 1))).flat().filter(id => !locked.has(id));
    const grid = { ...old, gaps };
    this.setData({ layoutGrid: grid, layoutCells: draftCells(grid, info.protectedSeats, false), layoutCount: grid.rowCount * grid.columnCount - gaps.length, error: '', notice: '' });
  },
  saveLayout() {
    const info = this.data.layoutInfo, grid = this.data.layoutGrid;
    if (!info || !grid || this.data.layoutLegacyLocked || !this.data.layoutCount) return;
    return this.work('正在保存座位图', async revision => {
      const result = await http.request(this._endpoint + '/layout', { method: 'PUT', required: true, raw: true,
        data: { layout: grid, revision: info.revision } });
      if (this.current(revision)) this.setData({ layoutInfo: result, layoutGrid: result.layout, layoutCells: draftCells(result.layout, result.protectedSeats, false), notice: i18n.t('座位图已保存，成员端和工作台已更新。', 'Seat map saved; members and the workbench are updated.') });
      return true;
    }, true);
  },
  layout(state, selected, zoom, editing = this.data.editing) {
    const index = {};
    const missing = new Set(state.missingSeats || []);
    const locked = new Set(state.blockedSeats || []);
    const rows = state.rows.map((row, r) => {
      const accent = Boolean(row.accent);
      return { row: row.row, accent, indent: row.offset * step(zoom), seats: Array.from({ length: row.count }, (_, s) => {
        const id = row.row + '-' + (s + 1);
        if (missing.has(id)) return { id, missing: true };
        index[id] = [r, s, accent];
        const own = Boolean((editing && state.mine && state.mine.seats.includes(id)) || (this.data.changing && state.request && state.request.seats.includes(id)));
        return seatCell(id, s + 1, state.occupancy[id], selected.includes(id), accent, locked.has(id), this.data.manage, own);
      }) };
    });
    this._seats = index;
    return rows;
  },

  // ---- member map ----
  rescale(event) {
    const zoom = this.data.zoom + Number(event.currentTarget.dataset.delta);
    if (!zooms[zoom] || !this._state || !this.data.rows.length) return;
    const patch = { zoom, zoomLabel: zoomName(zoom), boardWidth: boardWidth(this._state.rows, zoom) };
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
    else { this.setData({ error: i18n.t('每人最多选择 ' + this.data.seatLimit + ' 个座位', 'Each person can pick up to ' + this.data.seatLimit + ' seats') }); return; }
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
      const answer = await new Promise(resolve => wx.showModal({ title: i18n.t('取消选座申请', 'Cancel seat request'), content: i18n.t('取消后全部座位将释放给其他成员。确认取消？', 'All seats will be released to other members. Cancel the request?'),
        confirmText: i18n.t('确认取消', 'Confirm cancel'), ...(i18n.locale() === 'en' ? { cancelText: 'Cancel' } : {}), success: resolve, fail: () => resolve({ confirm: false }) }));
      if (!answer.confirm || !this.current(revision)) return false;
      await http.request(this._endpoint, { method: 'DELETE', required: true, raw: true,
        data: { id: state.mine.id, revision: state.mine.revision } });
      if (this.current(revision)) this.setData({ editing: false, editRevision: null, editProofs: [], selected: [], chips: [], phone: '', proofError: '', proofNotice: '',
        notice: i18n.t('申请已取消，全部座位已释放。', 'Request cancelled; all seats released.') });
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
      if (this.current(revision)) this.setData({ notice: i18n.t('已' + (blocked ? '锁定' : '解锁') + ' ' + seats.length + ' 个座位。', (blocked ? 'Locked ' : 'Unlocked ') + seats.length + ' seats.') });
    }, true);
  },
  phoneInput(event) { if (!this.data.busy) this.setData({ phone: String(event.detail.value || '').slice(0, 24) }); },
  countInput(event) { if (!this.data.busy) this.setData({ requestedCount: event.detail.value }); },

  // One action at a time; every action re-reads the server state unless it reports nothing changed.
  async work(label, task, refresh) {
    if (this.data.busy || this.data.loading || this._closed) return;
    const revision = this._revision;
    this.setData({ busy: label, busyText: i18n.t(label, busyEn[label]), error: '', notice: '' });
    try {
      if (await task(revision) === false) refresh = false;
    } catch (cause) {
      if (this.current(revision)) this.setData({ error: (cause && cause.message) || i18n.t('操作未完成，请重试', 'The action was not completed. Please try again.') });
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
          if (!proofPattern.test(id)) throw new Error(i18n.t('上传结果暂不可确认，请刷新座位后核对', 'The upload result cannot be confirmed. Refresh the seats to check.'));
          const field = this.data.editing ? 'editProofs' : 'drafts';
          if (!this.data[field].includes(id)) this.setData({ [field]: this.data[field].concat(id) });
          uploaded++;
          this.setData({ proofNotice: i18n.t('已上传 ' + uploaded + ' 张凭证。', 'Uploaded ' + uploaded + ' proof images.') });
        }
      } catch (cause) {
        if (cause && cause.code === 'MEDIA_PICK_CANCELLED') return false;
        if (this.current(revision)) this.setData({ proofError: (cause && cause.message) || i18n.t('凭证上传未完成，请重试', 'The proof upload did not finish. Please try again.') });
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
    if (random && (!Number.isInteger(count) || count < 1 || count > this.data.seatLimit)) { this.setData({ error: i18n.t('请输入 1 至 ' + this.data.seatLimit + ' 个座位', 'Enter 1 to ' + this.data.seatLimit + ' seats') }); return; }
    if (!random && !selected.length) { this.setData({ error: i18n.t('请先在座位图中选择座位', 'Pick seats on the map first') }); return; }
    if (!phonePattern.test(phone)) { this.setData({ error: i18n.t('请填写有效的手机号', 'Enter a valid phone number') }); return; }
    if (!drafts.length || drafts.length > this.data.proofLimit) { this.setData({ error: i18n.t('请选择 1 至 ' + this.data.proofLimit + ' 张活动参与凭证', 'Choose 1 to ' + this.data.proofLimit + ' participation proof images') }); return; }
    const editing = this.data.editing;
    const data = random ? { mode: 'random', count, phone, proofs: drafts } : { mode: 'selection', seats: selected, phone, proofs: drafts };
    if (editing) { data.action = 'edit'; data.id = this._state.mine.id; data.revision = this.data.editRevision; }
    return this.work(editing ? '正在保存修改' : '正在提交选座', async revision => {
      const result = await http.request(this._endpoint, { method: 'POST', required: true, raw: true, data });
      if (!this.current(revision)) return false;
      this.setData({ selected: [], chips: [], phone: '', drafts: [], editing: false, editProofs: [], editRevision: null, editable: false, proofError: '', proofNotice: '', mine: mineView(result && result.mine), notice: editing ? i18n.t('修改已保存，申请继续等待审核。', 'Changes saved; the request stays in review.') : random ? i18n.t('申请已提交，审核通过后安排座位。', 'Request submitted; seats are assigned after approval.') : i18n.t('选座申请已提交，座位进入待审核。', 'Seat request submitted; the seats are pending review.') });
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
      if (this.current(revision)) this.setData({ selected: [], chips: [], notice: i18n.t('已为申请增加 ' + seats.length + ' 个座位。', 'Added ' + seats.length + ' seats to the request.') });
    }, true);
  },
  submitChange() {
    const request = this._assignment, seats = this.data.selected.slice();
    if (!this.data.changing || !request || !this.data.editable || !this.data.changeReady) return;
    return this.work('正在更换座位', async revision => {
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true,
        data: { action: 'change-seats', id: request.id, revision: request.revision, status: request.status, seats } });
      if (this.current(revision)) this.setData({ notice: i18n.t('已更换座位，申请状态保持不变。', 'Seats changed; the request status is unchanged.') });
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
      if (this.current(revision)) this.setData({ notice: mode === 'random' ? i18n.t('已切换为随机座位模式。', 'Switched to random seat mode.') : i18n.t('已切换为自主选座模式。', 'Switched to self-selection mode.') });
    }, true);
  },
  adjustRandomCount(event) {
    const request = Number(event.currentTarget.dataset.id), doc = this.reviewRecord(request);
    if (!doc || !doc.unassigned) return;
    return this.work('正在调整申请数量', async revision => {
      const answer = await new Promise(resolve => wx.showActionSheet({ itemList: Array.from({ length: 10 }, (_, index) => i18n.t((index + 1) + ' 个座位', (index + 1) + ' seats')), success: resolve, fail: () => resolve(null) }));
      if (!answer || !this.current(revision)) return false;
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true,
        data: { action: 'random-count', id: request, revision: doc.revision, count: answer.tapIndex + 1 } });
      if (this.current(revision)) this.setData({ notice: i18n.t('申请数量已更新，请重新核对后审核。', 'Seat count updated. Check again before reviewing.') });
    }, true);
  },
  setEnabled(event) {
    if (!this.data.review) return;
    const enabled = event && event.currentTarget && typeof event.currentTarget.dataset.enabled === 'boolean'
      ? event.currentTarget.dataset.enabled : !this.data.enabled;
    return this.saveOpening({ enabled }, enabled ? i18n.t('选座已开启，成员可以提交申请。', 'Seat selection opened; members can submit requests.') : i18n.t('选座已关闭：已有申请仍可审核。', 'Seat selection closed; existing requests can still be reviewed.'));
  },
  scheduleOpening() {
    const { openingDate, openingTime } = this.data;
    if (!openingDate || !openingTime) { this.setData({ error: i18n.t('请选择开放日期和时间', 'Choose an opening date and time') }); return; }
    return this.saveOpening({ enabled: true, opensAt: openingDate + 'T' + openingTime }, i18n.t('已保存定时开放。', 'Scheduled opening saved.'));
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
        const answer = await new Promise(resolve => wx.showModal({ title: i18n.t('驳回选座申请', 'Reject seat request'), content: i18n.t('驳回后座位立即释放给其他成员，且不能撤回。确认驳回？', 'Seats are released to other members immediately and this cannot be undone. Reject?'),
          confirmText: i18n.t('确认驳回', 'Confirm reject'), ...(i18n.locale() === 'en' ? { cancelText: 'Cancel' } : {}), success: resolve, fail: () => resolve({ confirm: false }) }));
        if (!answer.confirm || !this.current(revision)) return false;
      }
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true, data: { action: 'review', id: request, status, revision: doc.revision, ...(doc.unassigned ? { expectedCount: doc.seatCount } : {}) } });
      if (this.current(revision)) this.setData({ notice: status === 'confirmed' ? (doc.unassigned ? i18n.t('已通过并安排座位。', 'Approved and seats assigned.') : i18n.t('已通过并锁定座位。', 'Approved and seats locked.')) : i18n.t('已驳回并释放座位。', 'Rejected and seats released.') });
    }, true);
  },
  revoke(event) {
    const request = Number(event.currentTarget.dataset.id);
    if (!Number.isSafeInteger(request) || request <= 0) return;
    const doc = this.reviewRecord(request);
    if (!doc || doc.status !== 'confirmed') return;
    return this.work('正在撤销确认', async revision => {
      const answer = await new Promise(resolve => wx.showModal({ title: i18n.t('撤销确认', 'Revoke confirmation'), content: i18n.t('撤销后此申请的全部座位将释放给其他成员。确认撤销？', 'All seats of this request will be released to other members. Revoke?'),
        confirmText: i18n.t('确认撤销', 'Confirm revoke'), ...(i18n.locale() === 'en' ? { cancelText: 'Cancel' } : {}), success: resolve, fail: () => resolve({ confirm: false }) }));
      if (!answer.confirm || !this.current(revision)) return false;
      await http.request(this._endpoint, { method: 'POST', required: true, raw: true,
        data: { action: 'revoke', id: request, revision: doc.revision } });
      if (this.current(revision)) this.setData({ notice: i18n.t('已撤销确认，全部座位已释放。', 'Confirmation revoked; all seats released.') });
    }, true);
  },
  revokeSeat(event) {
    const request = Number(event.currentTarget.dataset.id), seat = String(event.currentTarget.dataset.seat || '');
    if (!Number.isSafeInteger(request) || request <= 0) return;
    const doc = this.reviewRecord(request);
    if (!doc || doc.status !== 'confirmed' || !doc.seatItems.some(item => item.id === seat)) return;
    return this.work('正在撤销座位', async revision => {
      const message = doc.seatCount === 1 ? i18n.t('这是最后一个座位，撤销后整份申请将变为已撤销。', 'This is the last seat; revoking it revokes the whole request.') : i18n.t('该座位将释放，其余座位继续保持已确认。', 'This seat will be released; the other seats stay confirmed.');
      const answer = await new Promise(resolve => wx.showModal({ title: i18n.t('撤销 ', 'Revoke ') + seatLabel(seat), content: message,
        confirmText: i18n.t('确认撤销', 'Confirm revoke'), ...(i18n.locale() === 'en' ? { cancelText: 'Cancel' } : {}), success: resolve, fail: () => resolve({ confirm: false }) }));
      if (!answer.confirm || !this.current(revision)) return false;
      const result = await http.request(this._endpoint, { method: 'POST', required: true, raw: true,
        data: { action: 'revoke-seat', id: request, revision: doc.revision, seat } });
      if (this.current(revision)) this.setData({ notice: result && result.fullyRevoked ? i18n.t('座位已释放，申请已全部撤销。', 'Seat released; the whole request is revoked.') : i18n.t('该座位已释放，其余座位保持已确认。', 'Seat released; the other seats stay confirmed.') });
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
