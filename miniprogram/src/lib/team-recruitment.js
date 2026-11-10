const http = require('./http');
const { defaultTeamForm } = require('./generated/team-recruitment-form');

const beijingOffset = 8 * 60 * 60 * 1000;

function parts(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return { date: '', time: '', value: '' };
  const local = new Date(timestamp + beijingOffset).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16), value };
}

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
    throw new Error('当前招新批次不可编辑，请刷新工作台核对。');
  return { form: result.form, title: result.title };
}

function saveInput(team, editor, form, status) {
  const title = editor.title.trim();
  const start = editor.start.value;
  const end = editor.end.value;
  if (title.length < 2 || title.length > 120) throw new Error('批次名称须为 2–120 字');
  if (start && end && Date.parse(start) >= Date.parse(end)) throw new Error('报名截止须晚于开始时间');
  if (status === 'open') {
    if (team.teamStatus !== 'active') throw new Error('请将队伍设为活跃后再发布招新');
    if (!end) throw new Error('发布前请填写报名截止时间');
    if (Date.parse(end) <= Date.now()) throw new Error('报名截止须晚于当前时间');
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
