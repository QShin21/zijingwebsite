const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();
const http = require('./http');
const { defaultTeamForm } = require('./generated/team-recruitment-form');

const { beijingParts: parts } = require('./format');

function changeTime(previous, key, part, selection) {
  if (part === 'clear') return parts('');
  if (!['date', 'time'].includes(part) || typeof selection !== 'string') return previous;
  const date = part === 'date' ? selection : previous.date || parts(new Date().toISOString()).date;
  const time = part === 'time' ? selection : previous.time || (key === 'end' ? '23:59' : '00:00');
  const timestamp = Date.parse(date + 'T' + time + ':00+08:00');
  if (!Number.isFinite(timestamp)) return previous;
  return parts(new Date(timestamp).toISOString());
}

async function read(id, teamID) {
  const result = await http.request('/api/miniapp/team/recruitment/' + id, { required: true, raw: true });
  if (!result || result.recruitmentID !== id || result.teamID !== teamID || result.readOnly ||
      !result.actions || result.actions.workbench !== true || typeof result.title !== 'string' ||
      !result.form || !Array.isArray(result.form.questions))
    throw new Error(i18n.t('当前招新批次不可编辑，请刷新工作台核对。', 'This recruitment batch cannot be edited. Refresh the workspace to check.'));
  return { form: result.form, title: result.title };
}

function saveInput(team, editor, form, status) {
  const title = editor.title.trim();
  const start = editor.start.value;
  const end = editor.end.value;
  if (title.length < 2 || title.length > 120) throw new Error(i18n.t('批次名称须为 2–120 字', 'The batch name must be 2–120 characters.'));
  if (start && end && Date.parse(start) >= Date.parse(end)) throw new Error(i18n.t('报名截止须晚于开始时间', 'The deadline must be after the start time.'));
  if (status === 'open') {
    if (team.teamStatus !== 'active') throw new Error(i18n.t('请将队伍设为活跃后再发布招新', 'Set the team to active before publishing recruitment.'));
    if (!end) throw new Error(i18n.t('发布前请填写报名截止时间', 'Set a sign-up deadline before publishing.'));
    if (Date.parse(end) <= Date.now()) throw new Error(i18n.t('报名截止须晚于当前时间', 'The deadline must be in the future.'));
  }
  return {
    operation: 'save-recruitment',
    teamID: team.id,
    ...(editor.id ? { id: editor.id, revision: editor.revision } : {}),
    title,
    status,
    form: { ...form, start, end, ...(status === 'open' ? { enabled: true, closed: false } : {}) },
  };
}

module.exports = { changeTime, defaultTeamForm, parts, read, saveInput };
