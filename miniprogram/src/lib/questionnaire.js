const brand = require('./brand');
const schema = require('./generated/signup-schema');
const model = require('./generated/questionnaire-model');
const flow = require('./generated/questionnaire-flow');
const { fromEntries } = require('./questionnaire-runtime');

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
function picker(options, value) {
  const values = ['', ...options];
  return { pickerValues: values, pickerLabels: ['请选择', ...options.map(brand.display)], pickerIndex: Math.max(0, values.indexOf(value)) };
}
function questionView(q, value, number, seed, error) {
  const options = q.randomize ? model.randomizedOptions(q.options, seed + q.id) : q.options;
  const choices = options.map(option => ({ value: option, label: brand.display(option), checked: Array.isArray(value) ? value.includes(option) : value === option }));
  const view = { ...q, number, label: brand.display(q.label), help: brand.display(q.help || ''), value: typeof value === 'string' ? value : '', choices, error: error || '', maxLength: q.maxLength || (q.type === 'textarea' ? 2000 : 200), inputType: q.type === 'number' || q.format === 'number' ? 'text' : q.format === 'phone' ? 'number' : 'text' };
  if (q.type === 'select') Object.assign(view, picker(options, value));
  if (q.type === 'rating' || q.type === 'nps') {
    view.choices = Array.from({ length: q.max - q.min + 1 }, (_, i) => String(q.min + i)).map(n => ({ value: n, label: n, checked: value === n }));
    view.scaleHint = q.type === 'nps' ? '0 = 完全不会推荐，10 = 非常愿意推荐' : `${q.min} = 最低，${q.max} = 最高`;
  }
  if (q.type === 'ranking') {
    const ranked = Array.isArray(value) ? value : [];
    view.rankRows = q.options.map((_, index) => {
      const available = q.options.filter(option => !ranked.includes(option) || ranked[index] === option);
      return { index, value: ranked[index] || '', ...picker(available, ranked[index]) };
    });
  }
  if (model.hasRows(q.type)) {
    const values = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    view.matrixRows = q.rows.map((row, index) => ({ index, key: row, label: brand.display(row), value: typeof values[row] === 'string' ? values[row] : '', choices: options.map(option => ({ value: option, label: brand.display(option), checked: Array.isArray(values[row]) ? values[row].includes(option) : values[row] === option })) }));
  }
  if (q.type === 'group') {
    const rows = entryRows(q, value);
    view.entries = rows.map((row, index) => ({ index, fields: q.fields.map(field => ({ ...field, label: brand.display(field.label), value: typeof row[field.id] === 'string' ? row[field.id] : '', maxLength: field.maxLength || 200, inputType: field.format === 'phone' ? 'number' : 'text', ...picker(field.options || [], row[field.id]) })) }));
    view.canAdd = rows.length < q.maxEntries;
    view.canRemove = rows.length > q.minEntries;
  }
  return view;
}
function presentation(form, answers, step, seed, errors = {}) {
  const route = flow.questionRoute(form, answers);
  const pages = model.questionPages(route.questions, form.pageSize || 5);
  const current = Math.max(0, Math.min(step, pages.length - 1));
  const allErrors = schema.answerErrors(form, answers);
  const answerable = route.questions.filter(q => q.type !== 'description');
  const completed = answerable.filter(q => !allErrors[q.id] && model.formatAnswer(answers[q.id], q) !== '未填写').length;
  const questions = pages[current].map(q => questionView(q, answers[q.id], route.questions.indexOf(q) + 1, seed, errors[q.id]));
  const branchNotice = route.jumps.filter(jump => pages[current].some(q => q.id === jump.from)).map(jump => jump.target === flow.endTarget ? '当前答案将提前结束问卷，下一步核对并提交。' : `当前答案将跳过中间 ${jump.skipped} 题，进入“${form.questions.find(q => q.id === jump.target).label}”。`).join(' ');
  return { questions, step: current, answerPages: pages.length, completed, answerTotal: answerable.length, progress: Math.round(completed / Math.max(1, answerable.length) * 100), branchNotice };
}
function receipt(value) {
  if (!value) return null;
  return { ...value, rows: (value.questions || []).filter(q => Object.prototype.hasOwnProperty.call(value.answers, q.id)).map(q => ({ id: q.id, label: brand.display(q.label), answer: brand.display(model.formatAnswer(value.answers[q.id], q)) })) };
}
module.exports = { ...schema, ...model, ...flow, initialAnswers, changeAnswer, entryRows, presentation, receipt };
