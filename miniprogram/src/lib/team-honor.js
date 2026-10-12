const http = require('./http');
const files = require('./files');
function id(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
function videoSource(record) {
  if (!record || record.legacy || typeof record.videoHref !== 'string') return '';
  const key = /^team-honor-records:([1-9]\d*)$/.exec(record.key || '');
  const match = /^\/api\/team-honor-evidence\/([1-9]\d*)\/video\?version=([0-9a-f]{64})$/.exec(record.videoHref);
  return key && match && id(key[1]) && key[1] === match[1] ? http.url(record.videoHref) : '';
}
function sourceHref(record) {
  return record.legacy && /^\/honors\/[a-z0-9-]+$/.test(record.sourceHref || '') ? record.sourceHref : '';
}
function archive(value, team) {
  const teamID = id(team);
  if (!teamID || !value || typeof value !== 'object' || !value.team || id(value.team.id) !== teamID ||
      !Array.isArray(value.records)) throw new Error('荣誉档案与当前队伍不匹配，请重新加载');
  const records = value.records.map(record => {
    if (!record || typeof record !== 'object' || !/^(team-honor-records|honors):[1-9]\d*$/.test(record.key || '') ||
        typeof record.title !== 'string' || !Array.isArray(record.images) || record.images.length > 6) throw new Error('荣誉档案格式暂不可用，请重新加载');
    const images = record.legacy ? [] : record.images.map(image => {
      if (!image || typeof image.source !== 'string' || !/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(image.source) ||
          image.source.length > 11200000 || typeof image.caption !== 'string') throw new Error('荣誉证据图片暂不可用，请重新加载');
      return { source: image.source, caption: image.caption };
    });
    // Keep only the public archive fields. Storage videoURL and private facts never enter page data.
    const accepted = { key: record.key, title: record.title, competition: typeof record.competition === 'string' ? record.competition : '',
      placing: typeof record.placing === 'string' ? record.placing : '', date: typeof record.date === 'string' ? record.date : '',
      description: typeof record.description === 'string' ? record.description : '', authorName: typeof record.authorName === 'string' ? record.authorName : '',
      approvedAt: typeof record.approvedAt === 'string' ? record.approvedAt : '', legacy: record.legacy === true, images,
      videoHref: typeof record.videoHref === 'string' ? record.videoHref : '', sourceHref: typeof record.sourceHref === 'string' ? record.sourceHref : '' };
    const controlledVideo = videoSource(accepted);
    return { ...accepted, dateText: accepted.date.slice(0, 10), videoHref: controlledVideo ? accepted.videoHref : '', videoSource: controlledVideo, sourceHref: sourceHref(accepted),
      localImages: [], mediaLoading: images.length > 0, mediaError: '', videoError: '' };
  });
  return { team: { id: teamID, title: typeof value.team.title === 'string' ? value.team.title : '',
    gameTitle: typeof value.team.gameTitle === 'string' ? value.team.gameTitle : '' }, records };
}
function load(team) {
  const teamID = id(team);
  if (!teamID) return Promise.reject(new Error('队伍入口无效，请返回后重新进入'));
  return http.request('/api/team-honor-archives/' + teamID, { auth: false, raw: true }).then(value => archive(value, teamID));
}
async function pictures(record) {
  const images = await Promise.all(record.images.map(async image => {
    let url = ''; try { url = await files.localImage(image.source); } catch { /* Text stays readable when native file writing fails. */ }
    return { url, caption: image.caption };
  }));
  return { ...record, images: [], localImages: images.filter(image => image.url), mediaLoading: false,
    mediaError: images.some(image => !image.url) ? '部分证据图片暂时无法加载，可重新加载档案后重试' : '' };
}
function removePictures(paths) {
  try {
    const prefix = wx.env.USER_DATA_PATH + '/zijing-private-';
    const fs = wx.getFileSystemManager();
    paths.filter(path => typeof path === 'string' && path.indexOf(prefix) === 0 && /\.webp$/.test(path))
      .forEach(filePath => fs.unlink({ filePath, fail() {} }));
  } catch { /* File cleanup must not block native navigation. */ }
}
module.exports = { id, videoSource, sourceHref, archive, load, pictures, removePictures };
