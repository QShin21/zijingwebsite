const http = require('./http');
const session = require('./session');
const privacy = require('./privacy');

const maxVideoBytes = 10 * 1024 * 1024;
const owned = new Map();
const uploads = new Set();
let choosing = false;
let sequence = 0;
const actor = () => String((session.user() || {}).id || '');
function id(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
function stale() { return new Error('页面或账号已更新，请重新操作'); }
function guard(options, who, writing = false) {
  const check = writing ? options.sameContext : options.isCurrent;
  try { return Boolean(who && who === actor() && typeof check === 'function' && check()); } catch { return false; }
}
function path() { return `${wx.env.USER_DATA_PATH}/zijing-private-honor-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}.mp4`; }
function ours(value) {
  const prefix = wx.env.USER_DATA_PATH + '/';
  return typeof value === 'string' && value.startsWith(prefix) && /^zijing-private-honor-[\w.-]+\.mp4$/.test(value.slice(prefix.length));
}
function unlink(filePath) {
  if (!ours(filePath)) return;
  owned.delete(filePath);
  try { wx.getFileSystemManager().unlink({ filePath, fail() {} }); } catch { /* Cleanup must not block navigation. */ }
}
function removeMedia(paths) {
  (Array.isArray(paths) ? paths : []).forEach(filePath => {
    const file = owned.get(filePath);
    // An upload may still be reading this file. Its caller keeps the write lock until finally.
    if (file && file.inUse) file.remove = true;
    else unlink(filePath);
  });
}
function stat(filePath) {
  return new Promise((resolve, reject) => wx.getFileSystemManager().stat({
    path: filePath, success(result) {
      const size = result.stats && result.stats.size;
      if (!Number.isSafeInteger(size) || size < 24 || size > maxVideoBytes ||
          typeof result.stats.isFile === 'function' && !result.stats.isFile()) reject(new Error('请选择 10 MB 以内的 MP4 视频'));
      else resolve(size);
    }, fail() { reject(new Error('视频读取失败，请重新选择')); },
  }));
}
async function inspect(filePath) {
  const size = await stat(filePath);
  await new Promise((resolve, reject) => wx.getFileSystemManager().readFile({
    filePath, position: 0, length: Math.min(size, 1024),
    success(result) {
      const bytes = new Uint8Array(result.data || new ArrayBuffer(0));
      const box = bytes.length >= 16 ? ((bytes[0] * 16777216) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) : 0;
      const name = offset => String.fromCharCode(...bytes.slice(offset, offset + 4));
      const supported = offset => /^(isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(name(offset));
      let brand = supported(8);
      for (let offset = 16; offset + 4 <= Math.min(box, bytes.length); offset += 4) brand = brand || supported(offset);
      // This rejects obvious HTML/images. The service performs full container validation.
      if (name(4) !== 'ftyp' || box < 16 || box > 1024 || box > size || box > bytes.length || !brand) reject(new Error('请选择可读取的 MP4 视频'));
      else resolve();
    }, fail() { reject(new Error('视频读取失败，请重新选择')); },
  }));
  return size;
}
async function chooseVideo(options = {}) {
  const who = actor();
  if (!guard(options, who)) throw stale();
  if (choosing) throw new Error('视频选择正在进行，请稍后');
  choosing = true;
  let filePath = '';
  try {
    try { await privacy.authorize(); } catch (error) { throw new Error(String(error.message || '隐私授权未完成').replace(/图片/g, '视频'), { cause: error }); }
    if (!guard(options, who)) throw stale();
    const selected = await new Promise((resolve, reject) => wx.chooseMedia({
      count: 1, mediaType: ['video'], sourceType: ['album', 'camera'], sizeType: ['compressed'],
      success(result) {
        const files = result.tempFiles;
        if (!Array.isArray(files) || files.length !== 1 || !files[0] || typeof files[0].tempFilePath !== 'string' ||
            !files[0].tempFilePath || files[0].fileType && files[0].fileType !== 'video' ||
            !Number.isFinite(files[0].size) || files[0].size < 24 || files[0].size > maxVideoBytes) reject(new Error('请选择 10 MB 以内的单个 MP4 视频'));
        else resolve(files[0].tempFilePath);
      }, fail() { reject(new Error('未选择视频，可重新选择')); },
    }));
    if (!guard(options, who)) throw stale();
    await inspect(selected);
    if (!guard(options, who)) throw stale();
    filePath = path(); owned.set(filePath, { actor: who, selected: true });
    await new Promise((resolve, reject) => wx.getFileSystemManager().copyFile({
      srcPath: selected, destPath: filePath, success() { resolve(); }, fail() { reject(new Error('视频准备失败，请重新选择')); },
    }));
    if (!guard(options, who) || !owned.has(filePath)) throw stale();
    const size = await inspect(filePath);
    if (!guard(options, who) || !owned.has(filePath)) throw stale();
    owned.get(filePath).size = size;
    return { filePath, size };
  } catch (error) { if (filePath) unlink(filePath); throw error; }
  finally { choosing = false; }
}
function multipart(record, input) {
  if (!record || !id(record.id) || !id(record.revision) || !id(record.team) ||
      record.season !== null && record.season !== undefined && !id(record.season)) throw new Error('请先明确保存荣誉草稿，再单独上传视频');
  if (!input || input.removeVideo === true || !Array.isArray(input.images) || !Array.isArray(record.images) ||
      input.images.length > 6 || record.images.length > 6) throw new Error('请先保存并核对图片与视频操作');
  if (input.team !== undefined && input.team !== record.team || input.season !== undefined && input.season !== record.season) throw new Error('荣誉队伍或赛季已变化，请重新加载核对');
  const form = { id: String(record.id), revision: String(record.revision), action: 'save', team: String(record.team), season: record.season ? String(record.season) : '' };
  for (const [key, maximum] of [['title', 120], ['competition', 200], ['placing', 200], ['description', 5000]]) {
    if (typeof input[key] !== 'string' || input[key].trim().length > maximum) throw new Error('请核对完整荣誉文字后再上传');
    form[key] = input[key].trim();
  }
  if (input.date !== null && typeof input.date !== 'string' || input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('请核对赛事日期后再上传');
  form.date = input.date || '';
  const sources = record.images.map(image => image && image.source);
  if (sources.some(source => typeof source !== 'string') || new Set(sources).size !== sources.length) throw new Error('请先保存并核对证据图片，视频上传不能调整图片顺序');
  let previous = -1;
  const retained = new Map();
  input.images.forEach(image => {
    const index = image && sources.indexOf(image.source);
    if (!image || index < 0 || index <= previous || typeof image.caption !== 'string' || image.caption.trim().length > 200)
      throw new Error('请先明确保存新增或重排的图片，再单独上传视频');
    previous = index; retained.set(index, image.caption.trim());
  });
  record.images.forEach((_, index) => {
    if (retained.has(index)) form['caption-' + index] = retained.get(index);
    else form['removeImage-' + index] = 'on';
  });
  return form;
}
async function uploadVideo(record, input, video, options = {}) {
  const formData = multipart(record, input), who = actor();
  if (!guard(options, who) || !guard(options, who, true)) throw stale();
  const file = video && owned.get(video.filePath);
  if (!file || !file.selected || file.actor !== who || !ours(video.filePath)) throw new Error('请重新主动选择视频');
  const key = who + ':' + record.id;
  if (uploads.has(key) || file.inUse) throw new Error('视频正在上传，请等待结果并重新加载核对');
  uploads.add(key); file.inUse = true;
  try {
    const size = await inspect(video.filePath);
    if (size !== video.size || size !== file.size) throw new Error('视频文件已变化，请重新选择');
    if (!guard(options, who) || !guard(options, who, true)) throw stale();
    const result = await http.upload('/api/team-honors/' + record.id, video.filePath, {
      name: 'video', formData, raw: true,
      onTask(task) { if (typeof options.onTask === 'function') options.onTask(task); },
      onProgress(progress) { if (guard(options, who) && typeof options.onProgress === 'function') options.onProgress(progress); },
    });
    if (!guard(options, who, true)) throw stale();
    if (!result || !result.record || result.record.id !== record.id || !id(result.record.revision) || result.record.revision <= record.revision)
      throw new Error('上传结果暂不可用，请重新加载荣誉核对');
    return { record: result.record };
  } finally {
    uploads.delete(key); file.inUse = false;
    if (file.remove || !guard(options, who, true)) unlink(video.filePath);
  }
}
async function privateVideo(record, options = {}) {
  const who = actor();
  if (!guard(options, who)) throw stale();
  if (!record || !id(record.id) || !id(record.revision) ||
      record.videoHref !== `/api/team-honor-evidence/${record.id}/video?revision=${record.revision}`) throw new Error('视频证据入口暂不可用，请重新加载荣誉核对');
  const filePath = path(); owned.set(filePath, { actor: who });
  let tooLarge = false;
  let downloading;
  try {
    const saved = await http.download(record.videoHref, {
      filePath, timeout: 60000,
      onTask(task) {
        downloading = task;
        if (task && typeof task.onHeadersReceived === 'function') task.onHeadersReceived(result => {
          const header = result.header || {}, length = header['Content-Length'] || header['content-length'];
          if (Number(length) > maxVideoBytes) { tooLarge = true; if (typeof task.abort === 'function') task.abort(); }
        });
        if (typeof options.onTask === 'function') options.onTask(task);
        if (!guard(options, who) && task && typeof task.abort === 'function') task.abort();
      },
      onProgress(progress) {
        if (Number(progress.totalBytesWritten) > maxVideoBytes || Number(progress.totalBytesExpectedToWrite) > maxVideoBytes) {
          tooLarge = true; if (downloading && typeof downloading.abort === 'function') downloading.abort();
        }
        if (guard(options, who) && typeof options.onProgress === 'function') options.onProgress(progress);
      },
    });
    if (tooLarge) throw new Error('视频证据超过 10 MB，请重新加载核对');
    if (saved !== filePath || !guard(options, who) || !owned.has(filePath)) throw stale();
    await inspect(filePath);
    if (!guard(options, who) || !owned.has(filePath)) throw stale();
    return filePath;
  } catch (error) {
    unlink(filePath);
    if (error && error.status) throw Object.assign(new Error(http.message(null, error.status)), { status: error.status });
    throw error;
  }
}
module.exports = { chooseVideo, uploadVideo, privateVideo, removeMedia };
