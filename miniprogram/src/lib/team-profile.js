const http = require('./http');
const files = require('./files');

function id(value) {
  return ['number', 'string'].includes(typeof value) && /^(?:[1-9]\d*)$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
function empty() { return { displayName: '', position: '', biography: '', avatar: null, visible: false }; }
function avatar(value) {
  return typeof value === 'string' && value.length <= 2800000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null;
}
function draft(value) {
  if (!value || typeof value !== 'object' || ['displayName', 'position', 'biography'].some(key => typeof value[key] !== 'string')) throw new Error('简介资料暂不可用，请重新加载');
  return { displayName: value.displayName, position: value.position, biography: value.biography, avatar: avatar(value.avatar), visible: value.visible === true };
}
function own(value) {
  if (value === null) return null;
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.visible !== 'boolean') throw new Error('本人简介版本暂不可用，请重新加载');
  return { ...draft(value), revision: value.revision };
}
function view(value) {
  if (!value || !Array.isArray(value.profiles) || !value.own || typeof value.own.eligible !== 'boolean' ||
      (value.own.membershipVersion !== null && (typeof value.own.membershipVersion !== 'string' || !value.own.membershipVersion)) ||
      value.own.eligible && !value.own.membershipVersion) throw new Error('简介列表暂不可用，请重新加载');
  const profiles = value.profiles.map(value => {
    if (!value || !id(value.id)) throw new Error('简介列表暂不可用，请重新加载');
    const clean = draft(value);
    return { id: id(value.id), displayName: clean.displayName, position: clean.position, biography: clean.biography, avatar: clean.avatar };
  });
  return { profiles, eligible: value.own.eligible, period: value.own.membershipVersion, profile: own(value.own.profile) };
}
function display(value) { return { displayName: value.displayName, position: value.position, biography: value.biography, visible: value.visible, hasAvatar: Boolean(value.avatar) }; }
function validate(value) {
  for (const [key, title, max] of [['displayName', '公开昵称', 40], ['position', '位置 / 游戏角色', 60], ['biography', '简短介绍', 400]]) {
    if (typeof value[key] !== 'string' || value[key].trim().length > max || (key === 'displayName' && !value[key].trim())) throw new Error(title + (key === 'displayName' ? '必填，' : '') + '最多 ' + max + ' 字');
  }
  return { displayName: value.displayName.trim(), position: value.position.trim(), biography: value.biography.trim(), avatar: avatar(value.avatar), visible: value.visible === true };
}
function load(team) {
  if (!id(team)) return Promise.reject(new Error('队伍入口无效，请返回后重新进入'));
  return http.request('/api/team-profiles/' + id(team), { required: true, raw: true }).then(view);
}
function save(team, revision, period, value) {
  if (!id(team)) return Promise.reject(new Error('队伍入口无效，请返回后重新进入'));
  return http.request('/api/team-profiles/' + id(team), { method: 'PUT', required: true, raw: true, siteWrite: true,
    data: { revision, membershipVersion: period, profile: validate(value) } }).then(result => {
    if (!result || !result.profile) throw new Error('保存结果暂不可用，请刷新后核对');
    return own(result.profile);
  });
}
function pictures(values) { return Promise.all(values.map(async value => {
  if (!avatar(value)) return '';
  try { return await files.localImage(value); } catch { return ''; }
})); }
function removePictures(paths) {
  try {
    const prefix = wx.env.USER_DATA_PATH + '/zijing-private-', fs = wx.getFileSystemManager();
    (paths || []).filter(path => typeof path === 'string' && path.indexOf(prefix) === 0 && /\.(png|jpeg|webp)$/.test(path))
      .forEach(filePath => fs.unlink({ filePath, fail() {} }));
  } catch { /* Cleanup must not block native navigation. */ }
}
module.exports = { id, empty, avatar, draft, own, view, display, validate, load, save, pictures, removePictures };
