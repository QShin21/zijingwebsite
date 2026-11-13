const brand = require('./brand');
const schema = require('./generated/signup-schema');
const model = require('./generated/questionnaire-model');
const flow = require('./generated/questionnaire-flow');
const { fromEntries } = require('./questionnaire-runtime');
const i18n = (() => { try { const value = require('./i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh' }; })();

// Server-provided English labels (`display`) are shown only; answers keep the canonical
// form values. Option/row/field-option labels are [canonicalValue, label] pairs.
function activeDisplay(display) {
  return display && typeof display === 'object' && display.locale === i18n.locale() && i18n.locale() !== 'zh' ? display : null;
}
function questionDisplay(display, id) {
  const value = display && display.questions && display.questions[id];
  return value && typeof value === 'object' ? value : {};
}
function pairLabel(pairs, value) {
  if (Array.isArray(pairs)) {
    const pair = pairs.find(item => Array.isArray(item) && item[0] === value);
    if (pair && typeof pair[1] === 'string' && pair[1]) return pair[1];
  }
  return brand.display(value);
}
function textOr(value, fallback) { return typeof value === 'string' && value ? value : fallback; }
function fieldDisplay(d, id) {
  const value = d.fields && d.fields[id];
  return value && typeof value === 'object' ? value : {};
}
// English mode: localized formatting of a stored answer; Chinese mode keeps the shared formatter.
function formatLocalized(answer, q, d) {
  const empty = i18n.t('未填写', 'Not answered');
  if (answer == null || answer === '') return empty;
  const option = value => (q.options || []).includes(value) ? pairLabel(d.options, value) : value;
  if (Array.isArray(answer)) {
    if (answer.some(value => value && typeof value === 'object')) {
      return answer.map((row, index) => typeof row === 'string' ? row : i18n.t('第 ', 'Entry ') + (index + 1) + i18n.t(' 条：', ': ') +
        Object.keys(row).map(key => {
          const field = (q.fields || []).find(item => item.id === key), fd = fieldDisplay(d, key);
          const value = row[key];
          const shown = field && field.options && field.options.includes(value) ? pairLabel(fd.options, value) : value;
          return textOr(fd.label, field ? brand.display(field.label) : key) + ': ' + (shown || empty);
        }).join('; ')).join('\n') || empty;
    }
    return answer.map(option).join(', ') || empty;
  }
  if (typeof answer === 'object') {
    return Object.keys(answer).map(row => {
      const value = answer[row];
      return pairLabel(d.rows, row) + ': ' + (Array.isArray(value) ? value.map(option).join(', ') || empty : (value ? option(value) : empty));
    }).join('\n');
  }
  return option(answer);
}
function answerText(value, q, display) {
  if (i18n.locale() === 'zh') return brand.display(model.formatAnswer(value, q));
  return formatLocalized(value, q, questionDisplay(activeDisplay(display), q.id));
}
// Validation messages are "题目：提示"; show the displayed label and a translated hint.
function errorText(q, label, message) {
  if (!message || i18n.locale() === 'zh') return message || '';
  const prefix = q.label + '：';
  if (message.indexOf(prefix) === 0) return label + ': ' + i18n.message(message.slice(prefix.length));
  return i18n.message(message);
}

function initialAnswers(form, saved) {
  const clean = model.sanitizeDraft(form, saved || {});
  const ids = new Set(schema.visibleQuestions(form, clean).map(q => q.id));
  return fromEntries(Object.entries(clean).filter(([id]) => ids.has(id)));
}
function changeAnswer(form, answers, id, value) {
  const q = form.questions.find(item => item.id === id);
  if (!q || q.type === 'description') return answers;
  if (q.type === 'multiple' && q.exclusiveOption && Array.isArray(value)) {
    const previous = Array.isArray(answers[id]) ? answers[id] : [];
    const added = value.find(option => !previous.includes(option));
    if (added === q.exclusiveOption) value = [added];
    else if (added) value = value.filter(option => option !== q.exclusiveOption);
  }
  const next = { ...answers, [id]: value };
  const ids = new Set(schema.visibleQuestions(form, next).map(item => item.id));
  return fromEntries(Object.entries(next).filter(([key]) => ids.has(key)));
}
function entryRows(q, value) {
  const rows = Array.isArray(value) ? value.map(row => ({ ...row })) : [];
  while (rows.length < q.minEntries) rows.push({});
  return rows;
}
function picker(options, value, pairs) {
  const values = ['', ...options];
  return { pickerValues: values, pickerLabels: [i18n.t('请选择', 'Choose'), ...options.map(option => pairLabel(pairs, option))], pickerIndex: Math.max(0, values.indexOf(value)) };
}
function questionView(q, value, number, seed, error, display) {
  const d = questionDisplay(activeDisplay(display), q.id);
  const options = q.randomize ? model.randomizedOptions(q.options, seed + q.id) : q.options;
  const choices = options.map(option => ({ value: option, label: pairLabel(d.options, option), checked: Array.isArray(value) ? value.includes(option) : value === option }));
  const label = textOr(d.label, brand.display(q.label));
  const view = { ...q, number, label, help: textOr(d.help, brand.display(q.help || '')), ...(textOr(d.placeholder, '') ? { placeholder: d.placeholder } : {}), value: typeof value === 'string' ? value : '', choices, error: errorText(q, label, error), maxLength: q.maxLength || (q.type === 'textarea' ? 2000 : 200), inputType: q.type === 'number' || q.format === 'number' ? 'text' : q.format === 'phone' ? 'number' : 'text' };
  if (q.type === 'select') Object.assign(view, picker(options, value, d.options));
  if (q.type === 'rating' || q.type === 'nps') {
    view.choices = Array.from({ length: q.max - q.min + 1 }, (_, i) => String(q.min + i)).map(n => ({ value: n, label: n, checked: value === n }));
    view.scaleHint = q.type === 'nps' ? i18n.t('0 = 完全不会推荐，10 = 非常愿意推荐', '0 = not at all likely, 10 = extremely likely') : i18n.t(`${q.min} = 最低，${q.max} = 最高`, `${q.min} = lowest, ${q.max} = highest`);
  }
  if (q.type === 'ranking') {
    const ranked = Array.isArray(value) ? value : [];
    view.rankRows = q.options.map((_, index) => {
      const available = q.options.filter(option => !ranked.includes(option) || ranked[index] === option);
      return { index, value: ranked[index] || '', ...picker(available, ranked[index], d.options) };
    });
  }
  if (model.hasRows(q.type)) {
    const values = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    view.matrixRows = q.rows.map((row, index) => ({ index, key: row, label: pairLabel(d.rows, row), value: typeof values[row] === 'string' ? values[row] : '', choices: options.map(option => ({ value: option, label: pairLabel(d.options, option), checked: Array.isArray(values[row]) ? values[row].includes(option) : values[row] === option })) }));
  }
  if (q.type === 'group') {
    const rows = entryRows(q, value);
    view.entries = rows.map((row, index) => ({ index, fields: q.fields.map(field => { const fd = fieldDisplay(d, field.id); return { ...field, label: textOr(fd.label, brand.display(field.label)), ...(textOr(fd.placeholder, '') ? { placeholder: fd.placeholder } : {}), value: typeof row[field.id] === 'string' ? row[field.id] : '', maxLength: field.maxLength || 200, inputType: field.format === 'phone' ? 'number' : 'text', ...picker(field.options || [], row[field.id], fd.options) }; }) }));
    view.canAdd = rows.length < q.maxEntries;
    view.canRemove = rows.length > q.minEntries;
  }
  return view;
}
function presentation(form, answers, step, seed, errors = {}, display) {
  const route = flow.questionRoute(form, answers);
  const pages = model.questionPages(route.questions, form.pageSize || 5);
  const current = Math.max(0, Math.min(step, pages.length - 1));
  const allErrors = schema.answerErrors(form, answers);
  const answerable = route.questions.filter(q => q.type !== 'description');
  const completed = answerable.filter(q => !allErrors[q.id] && model.formatAnswer(answers[q.id], q) !== '未填写').length;
  const questions = pages[current].map(q => questionView(q, answers[q.id], route.questions.indexOf(q) + 1, seed, errors[q.id], display));
  const branchNotice = route.jumps.filter(jump => pages[current].some(q => q.id === jump.from)).map(jump => {
    if (jump.target === flow.endTarget) return i18n.t('当前答案将提前结束问卷，下一步核对并提交。', 'This answer ends the questionnaire early; review and submit next.');
    const target = form.questions.find(q => q.id === jump.target);
    return i18n.t(`当前答案将跳过中间 ${jump.skipped} 题，进入“${target.label}”。`, `This answer skips ${jump.skipped} question(s) and goes to “${textOr(questionDisplay(activeDisplay(display), target.id).label, target.label)}”.`);
  }).join(' ');
  return { questions, step: current, answerPages: pages.length, completed, answerTotal: answerable.length, progress: Math.round(completed / Math.max(1, answerable.length) * 100), branchNotice };
}
// `display` is optional; Array.map passes an index as the second argument, which is ignored.
function receipt(value, display) {
  if (!value) return null;
  const shown = display && typeof display === 'object' ? display : null;
  return { ...value, rows: (value.questions || []).filter(q => Object.prototype.hasOwnProperty.call(value.answers, q.id)).map(q => ({ id: q.id, label: textOr(questionDisplay(activeDisplay(shown), q.id).label, brand.display(q.label)), answer: answerText(value.answers[q.id], q, shown) })) };
}
module.exports = { ...schema, ...model, ...flow, initialAnswers, changeAnswer, entryRows, presentation, receipt, optionLabel: pairLabel, activeDisplay };
