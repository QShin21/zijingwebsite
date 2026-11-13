const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();
const http = require('./http');
const session = require('./session');
const files = require('./files');

const labelsZh = { draft: '草稿', pending: '待审核', withdrawn: '已撤回', returned: '退回修改', rejected: '已拒绝', approved: '已批准', hidden: '已隐藏' };
const labelsEn = { draft: 'Draft', pending: 'Pending review', withdrawn: 'Withdrawn', returned: 'Returned for changes', rejected: 'Rejected', approved: 'Approved', hidden: 'Hidden' };
const reviewZh = { approve: '批准荣誉', return: '退回修改', reject: '拒绝荣誉' };
const reviewEn = { approve: 'Approve honor', return: 'Return for changes', reject: 'Reject honor' };
// Read at access time so the current language applies.
const localized = (zh, en) => { const result = {}; Object.keys(zh).forEach(key => Object.defineProperty(result, key, { enumerable: true, get: () => i18n.t(zh[key], en[key]) })); return result; };
const labels = localized(labelsZh, labelsEn);
const reviewLabels = localized(reviewZh, reviewEn);
const actor = () => String((session.user() || {}).id || '');
function id(value) { return ['string', 'number'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null; }
function text(value, limit, fallback = '') { return typeof value === 'string' && value.length <= limit ? value : fallback; }
function image(value) {
  const match = typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || value.length > 11200000) throw new Error(i18n.t('证据图片暂不可用，请重新加载', 'Evidence images are unavailable. Please reload.'));
  return value;
}
function bytes(value) { const encoded = value.split(',')[1] || ''; return Math.floor(encoded.length * 3 / 4) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0); }
function permissions(value) {
  const actions = value && typeof value === 'object' ? value : {};
  return { edit: actions.edit === true, save: actions.save === true, submit: actions.submit === true, withdraw: actions.withdraw === true, hide: actions.hide === true,
    reviewActions: Array.isArray(actions.reviewActions) ? actions.reviewActions.filter(action => Object.prototype.hasOwnProperty.call(reviewLabels, action)) : [] };
}
function record(value, withActions = true) {
  if (!value || !id(value.id) || !id(value.team) || !id(value.game) || !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.images) || value.images.length > 6)
    throw new Error(i18n.t('荣誉回执暂不可用，请重新加载', 'The honor receipt is unavailable. Please reload.'));
  const submittedVersion = typeof value.submittedVersion === 'string' && /^[a-f0-9]{64}$/.test(value.submittedVersion) ? value.submittedVersion : null;
  const videoHref = value.videoHref === `/api/team-honor-evidence/${value.id}/video?revision=${value.revision}` ? value.videoHref : null;
  return { id: id(value.id), revision: value.revision, state: text(value.state, 32), team: id(value.team), game: id(value.game), season: id(value.season),
    title: text(value.title, 120), authorName: text(value.authorName, 120), competition: text(value.competition, 200), placing: text(value.placing, 200),
    date: text(value.date, 40) || null, description: text(value.description, 5000), reviewNote: text(value.reviewNote, 1000) || null,
    images: value.images.map(item => { if (!item || typeof item.caption !== 'string' || item.caption.length > 200) throw new Error(i18n.t('证据图片说明暂不可用，请重新加载', 'Evidence image captions are unavailable. Please reload.')); return { source: image(item.source), caption: item.caption }; }),
    submittedVersion, videoHref, actions: withActions ? permissions(value.actions) : {} };
}
function row(value, previous) {
  return { id: value.id, revision: value.revision, state: value.state, statusText: labels[value.state] || i18n.t('状态待核对', 'Status pending'), team: value.team, game: value.game, season: value.season,
    title: value.title, authorName: value.authorName, competition: value.competition, placing: value.placing, date: value.date ? value.date.slice(0, 10) : '',
    description: value.description, reviewNote: value.reviewNote || '', imageCount: Number.isSafeInteger(value.imageCount) ? value.imageCount : value.images.length, hasVideo: Boolean(value.videoHref), actions: value.actions,
    decisions: (value.actions.reviewActions || []).map(action => ({ action, label: reviewLabels[action] })), noteDraft: previous && previous.revision === value.revision ? previous.noteDraft || '' : '' };
}
function metadata(value) { return { ...value, imageCount: Number.isSafeInteger(value.imageCount) ? value.imageCount : value.images.length, images: [] }; }
function empty() { return { title: '', competition: '', placing: '', date: '', description: '', images: [], removeVideo: false }; }
function draft(value) { return value ? { title: value.title, competition: value.competition, placing: value.placing, date: value.date ? value.date.slice(0, 10) : '', description: value.description,
  images: value.images.map(item => ({ ...item })), removeVideo: false } : empty(); }
function fields(value) { return { title: value.title, competition: value.competition, placing: value.placing, date: value.date, description: value.description, removeVideo: value.removeVideo === true }; }
function input(value, current, team, submit = false) {
  const result = {};
  for (const [key, maximum] of [['title', 120], ['competition', 200], ['placing', 200], ['description', 5000]]) {
    if (typeof value[key] !== 'string' || value[key].trim().length > maximum) throw new Error(i18n.t('请核对文字长度后重试', 'Check the text length and try again.'));
    result[key] = value[key].trim();
  }
  if (!result.title) throw new Error(i18n.t('请填写荣誉标题', 'Please enter an honor title.'));
  if (value.date && (!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0, 10) !== value.date)) throw new Error(i18n.t('请选择有效的赛事日期', 'Choose a valid competition date.'));
  result.date = value.date || null;
  if (!Array.isArray(value.images) || value.images.length > 6) throw new Error(i18n.t('证据图片最多 6 份', 'Up to 6 evidence images.'));
  result.images = value.images.map(item => {
    if (!item || typeof item.caption !== 'string' || item.caption.trim().length > 200) throw new Error(i18n.t('图片说明最多 200 字', 'Captions can be up to 200 characters.'));
    const source = image(item.source), retained = current && current.images.some(old => old.source === source);
    if (!retained && bytes(source) > 2 * 1024 * 1024) throw new Error(i18n.t('新图片每份最多 2 MB', 'Each new image can be up to 2 MB.'));
    return { source, caption: item.caption.trim() };
  });
  if (result.images.reduce((sum, item) => sum + bytes(item.source), 0) > 12 * 1024 * 1024) throw new Error(i18n.t('证据图片合计最多 12 MB', 'Evidence images can total up to 12 MB.'));
  result.removeVideo = value.removeVideo === true;
  if (!current) { if (!id(team)) throw new Error(i18n.t('请选择服务端提供的有效队伍', 'Choose a valid team from the list.')); result.team = id(team); }
  if (submit) {
    if (['competition', 'placing', 'date', 'description'].some(key => !result[key])) throw new Error(i18n.t('提交前请填写赛事、奖项、赛事日期和获奖说明', 'Before submitting, fill in the competition, award, date and description.'));
    if (!result.images.length && !(current && current.videoHref && !result.removeVideo)) throw new Error(i18n.t('提交前请添加至少一份证据图片或已保存视频', 'Before submitting, add at least one evidence image or a saved video.'));
    if (result.images.some(item => !item.caption)) throw new Error(i18n.t('提交前请为每份证据图片填写说明', 'Before submitting, add a caption to every evidence image.'));
  }
  return result;
}
function list(options = {}) {
  const view = options.view === 'review' ? 'review' : 'mine', page = Number(options.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return Promise.reject(new Error(i18n.t('页码无效，请重新加载', 'Invalid page number. Please reload.')));
  const query = [`view=${view}`, `page=${page}`];
  for (const key of ['team', 'game']) if (options[key]) { if (!id(options[key])) return Promise.reject(new Error(i18n.t('荣誉入口无效，请返回后重新进入', 'Invalid honor link. Go back and open it again.'))); query.push(key + '=' + id(options[key])); }
  return http.request('/api/team-honors?' + query.join('&'), { required: true, raw: true }).then(value => {
    if (!value || !Array.isArray(value.docs) || !Array.isArray(value.teams) || !Number.isSafeInteger(value.page) || value.page < 1 || !Number.isSafeInteger(value.totalPages) || value.totalPages < 0 || !Number.isSafeInteger(value.totalDocs) || value.totalDocs < 0)
      throw new Error(i18n.t('荣誉列表暂不可用，请重试', 'The honor list is unavailable. Please try again.'));
    return { docs: value.docs.map(item => record(item)), page: value.page, totalPages: value.totalPages, totalDocs: value.totalDocs,
      teams: value.teams.filter(team => team && id(team.id) && id(team.game)).map(team => ({ id: id(team.id), title: text(team.title, 200), game: id(team.game), gameTitle: text(team.gameTitle, 200), gameSlug: text(team.gameSlug, 200) })),
      actions: { create: Boolean(value.actions && value.actions.create === true), review: Boolean(value.actions && value.actions.review === true) } };
  });
}
function detail(value) {
  if (!id(value)) return Promise.reject(new Error(i18n.t('荣誉入口无效，请返回后重新进入', 'Invalid honor link. Go back and open it again.')));
  return http.request('/api/team-honors/' + id(value), { required: true, raw: true }).then(result => { const clean = record(result && result.record); if (clean.id !== id(value)) throw new Error(i18n.t('荣誉回执与当前入口不符，请重试', 'The honor receipt does not match this link. Please try again.')); return clean; });
}
function allowed(value, action) { return ['approve', 'return', 'reject'].includes(action) ? (value.actions.reviewActions || []).includes(action) : value.actions[action] === true; }
function change(value, action, options = {}) {
  if (value && !allowed(value, action)) return Promise.reject(new Error(i18n.t('当前暂无此操作，请重新加载核对', 'This action is not available now. Reload to check.')));
  const data = { action };
  if (value) data.revision = value.revision;
  if (['save', 'submit'].includes(action)) data.input = input(options.draft, value, options.team, action === 'submit');
  else {
    if (!value || !allowed(value, action)) return Promise.reject(new Error(i18n.t('当前暂无此操作，请重新加载核对', 'This action is not available now. Reload to check.')));
    const note = typeof options.note === 'string' ? options.note.trim() : '';
    if (note.length > 1000 || ['return', 'reject', 'hide'].includes(action) && !note) return Promise.reject(new Error(i18n.t('退回、拒绝或隐藏须填写 1–1000 字的具体说明', 'Returning, rejecting or hiding needs a specific note of 1–1000 characters.')));
    data.note = note;
    if (action === 'approve') { if (!value.submittedVersion) return Promise.reject(new Error(i18n.t('提交版本暂不可用，请重新加载后核对', 'The submitted version is unavailable. Reload to check.'))); data.submittedVersion = value.submittedVersion; }
  }
  return http.request('/api/team-honors' + (value ? '/' + value.id : ''), { method: 'POST', required: true, raw: true, data }).then(result => {
    const clean = record(result && result.record, false); if (value && clean.id !== value.id) throw new Error(i18n.t('保存回执与当前记录不符，请重新加载', 'The save receipt does not match this record. Please reload.')); return clean;
  });
}
function removePictures(paths) {
  try { const prefix = wx.env.USER_DATA_PATH + '/zijing-private-', fs = wx.getFileSystemManager();
    (paths || []).filter(path => typeof path === 'string' && path.startsWith(prefix) && /\.(png|jpeg|webp)$/.test(path)).forEach(filePath => fs.unlink({ filePath, fail() {} }));
  } catch { /* A cleanup error must not block return navigation. */ }
}
function pending(page) { return Boolean(page._write || page._file || page._modal); }
function sync(page) { if (!page._disposed) page.setData({ busy: pending(page) }); }
function connect(page, route) {
  if (page._unsubscribe) page._unsubscribe();
  page._disposed = false; page._visible = false; page._resumeRead = false; page._context = (page._context || 0) + 1; page._epoch = (page._epoch || 0) + 1;
  page._actor = actor(); page._route = route; page.resetPrivate();
  page._unsubscribe = session.subscribe(() => {
    if (page._actor === actor()) return;
    page._actor = actor(); page._context++; page._epoch++; page._resumeRead = false; page.resetPrivate();
    if (page._visible) page.load();
  });
}
function capture(page) { return { context: page._context, epoch: page._epoch, actor: actor(), route: page._route }; }
function same(page, token) { return !page._disposed && token.context === page._context && token.actor === actor() && Boolean(token.actor) && token.route === page._route; }
function visible(page, token) { return same(page, token) && page._visible && token.epoch === page._epoch; }
function begin(page, slot) { if (pending(page)) return null; const token = { ...capture(page), slot, id: page._operation = (page._operation || 0) + 1 }; page[slot] = token.id; sync(page); return token; }
async function finish(page, token) {
  if (!token || page[token.slot] !== token.id) return;
  page[token.slot] = null; sync(page);
  if (!page._disposed && page._visible && !pending(page) && page._resumeRead) { page._resumeRead = false; await page.load(); }
}
function show(page) {
  if (page._disposed) return; page._visible = true;
  if (page._actor !== actor()) { page._actor = actor(); page._context++; page._epoch++; page.resetPrivate(); }
  return page.load();
}
function hide(page) {
  page._visible = false; page._epoch++; page._resumeRead = false; page._loading = null; page.clearMedia(); page._fresh = false;
  page.setData({ loading: false, ready: false, busy: pending(page) });
}
function unload(page) { hide(page); page._context++; page.resetPrivate(); page._disposed = true; if (page._unsubscribe) page._unsubscribe(); }
function confirm(title, content) { return new Promise((resolve, reject) => wx.showModal({ title, content, success: value => resolve(value.confirm), fail: () => reject(new Error(i18n.t('确认未完成，请重试', 'Confirmation was not completed. Please try again.'))) })); }
module.exports = { labels, reviewLabels, actor, id, image, bytes, record, row, metadata, empty, draft, fields, input, list, detail, allowed, change, removePictures,
  pending, sync, connect, capture, same, visible, begin, finish, show, hide, unload, confirm, files };
