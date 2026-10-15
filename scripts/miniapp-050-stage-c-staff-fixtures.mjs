// Isolated synthetic layouts only. No production records, real contacts, network calls or wx actions.
export function stageCStaffFixtures(rt, native, exists) {
  if (!exists(native('lib/staff.js'))) throw new Error('The native staff helper is required for synthetic fixtures.');
  const staff = rt.load(native('lib/staff.js'));
  const questionnaire = rt.load(native('lib/questionnaire.js'));
  const { date } = rt.load(native('lib/format.js'));
  const fixture = (name, page, state, data) => ({ name, page, state: '合成数据；' + state, data });
  const user = { id: 903001, name: '合成申请人', roles: ['member'], accountStatus: 'active' };
  const manager = { id: 903002, name: '合成审核人', roles: ['vicePresident'], accountStatus: 'active' };
  const directions = [{ value: '', label: '全部方向' }, { value: 'execution', label: '执行部' }, { value: 'publicity', label: '宣传部' }, { value: 'both', label: '执行/宣传均可' }];
  const states = [{ value: '', label: '全部状态' }, ...Object.keys(staff.labels).map(value => ({ value, label: staff.labels[value] }))];
  const batch = (id, title, state, endAt, description) => ({ id, title, state, endAt, deadlineText: endAt ? date(endAt) : '', description });
  const batches = [
    batch(903011, '合成秋季骨干招新：执行部与宣传部', '申请开放', '2030-10-25T12:00:00Z', '合成岗位说明：阅读本批次的工作安排与投入要求，在申请中选择执行部、宣传部或两者均可。这里没有真实招新安排。'),
    batch(903012, '合成历史批次：一次跨越多行的骨干招新与共同协作安排', '申请已截止', '2026-09-01T12:00:00Z', '合成历史资料：截止后保留已有申请与处理回执。'),
  ];
  const oldRevision = '2026-10-14T08:00:00Z', newRevision = '2026-10-15T09:30:00Z';
  const own = (id, status, index = 0) => ({ id, batch: batches[index].id, batchTitle: batches[index].title, statusText: staff.labels[status], updatedText: date(newRevision) });
  const directory = { loading: false, error: '', needsLogin: false, user, docs: batches, page: 1, hasMore: true,
    own: [], ownPage: 1, ownHasMore: false, ownLoading: false, ownError: '', legacy: [], legacyError: '', reviewStaff: false };
  const baseQuestions = [
    { id: 'department', label: '意向方向', type: 'single', required: true, options: ['执行部', '宣传部', '执行/宣传均可'] },
    { id: 'name', label: '姓名', type: 'text', required: true },
    { id: 'school', label: '学校、院系与年级', type: 'text', required: true },
    { id: 'motivation', label: '申请动机', type: 'textarea', required: true },
    { id: 'experience', label: '相关经验（无经验可说明兴趣）', type: 'textarea', required: true },
    { id: 'time', label: '可投入时间与时段', type: 'textarea', required: true },
    { id: 'contact', label: '一种便于联系的方式', type: 'text', required: true },
  ];
  const form = questionnaire.normalizeSignup({ enabled: true, title: '合成骨干申请问卷', pageSize: 4, questions: baseQuestions });
  const answers = { department: '执行部', name: '合成申请人甲', school: '合成学校、合成院系与合成年级',
    motivation: '合成回答：希望参与活动准备与现场协作，了解从前期沟通到复盘的完整过程。',
    experience: '合成回答：曾在模拟任务中整理活动流程与参与说明。这里不描述真实经历。',
    time: '合成回答：每周可安排两个时段，具体时间在录用联系时确认。', contact: 'synthetic-applicant@example.invalid' };
  const record = (id, status = 'reviewing', allowedStatuses = ['returned', 'accepted', 'rejected'], extra = {}) => {
    const source = { id, batch: batches[0].id, batchTitle: batches[0].title, memberName: '合成申请人甲', status,
      createdAt: oldRevision, updatedAt: oldRevision, formVersion: 'synthetic-staff-form-v3', questions: form.questions, answers, feedback: '', ...extra };
    return { ...staff.receipt(source), allowed: allowedStatuses.map(value => ({ value, label: staff.labels[value] })), decisionIndex: 0, feedbackDraft: source.feedback };
  };
  const basicRecord = record(903021);
  const review = { expandedId: '', loading: false, error: '', needsLogin: false, busy: false, docs: [basicRecord], page: 1, pages: 1, total: 1,
    department: '', status: '', message: '', directions, states, departmentIndex: 0, statusIndex: 0 };
  const advancedForm = questionnaire.normalizeSignup({ enabled: true, title: '合成完整题型问卷', pageSize: 20, questions: [
    ...baseQuestions,
    { id: 'multiple', label: '合成多选：想参与的工作', type: 'multiple', options: ['合成活动准备', '合成内容整理'] },
    { id: 'select', label: '合成下拉选择：沟通方式', type: 'select', options: ['合成文字沟通', '合成现场沟通'] },
    { id: 'number', label: '合成数字：每周可投入小时', type: 'number', min: 0, max: 20, step: 0.5 },
    { id: 'date', label: '合成日期：可开始日期', type: 'date' },
    { id: 'clock', label: '合成时间：方便沟通时刻', type: 'time' },
    { id: 'rating', label: '合成评分：协作兴趣', type: 'rating' },
    { id: 'nps', label: '合成量表：推荐意愿', type: 'nps' },
    { id: 'ranking', label: '合成排序：工作偏好', type: 'ranking', options: ['合成策划', '合成执行', '合成复盘'] },
    { id: 'matrix', label: '合成矩阵：时段安排', type: 'matrix', rows: ['合成工作日', '合成周末'], options: ['合成可参与', '合成需协调'] },
    { id: 'matrixMultiple', label: '合成多选矩阵：可参与的协作', type: 'matrixMultiple', rows: ['合成前期', '合成当天'], options: ['合成文字', '合成现场'] },
    { id: 'blanks', label: '合成多项填空：补充计划', type: 'blanks', rows: ['合成第一步', '合成后续安排'] },
    { id: 'group', label: '合成五人小组资料', type: 'group', minEntries: 5, maxEntries: 6, fields: [
      { id: 'name', label: '合成称呼', type: 'text', required: true }, { id: 'role', label: '合成分工', type: 'text', required: true },
    ] },
    { id: 'description', label: '合成说明题：只读说明不产生答案', type: 'description' },
  ] });
  const advancedAnswers = { ...answers, department: '执行/宣传均可',
    motivation: '合成长回答：希望在实际任务中学习沟通、协作与复盘。申请资料需要完整阅读，较长的段落应自然换行，并保留足够的行距。\n\n合成补充：这段文字用于核对长答卷，内容不代表真实经历或实际安排。',
    multiple: ['合成活动准备', '合成内容整理'], select: '合成文字沟通', number: '3.5', date: '2030-10-21', clock: '18:30', rating: '5', nps: '8',
    ranking: ['合成策划', '合成执行', '合成复盘'], matrix: { 合成工作日: '合成需协调', 合成周末: '合成可参与' },
    matrixMultiple: { 合成前期: ['合成文字'], 合成当天: ['合成文字', '合成现场'] },
    blanks: { 合成第一步: '合成内容：阅读岗位说明并确认时间。', 合成后续安排: '合成内容：按约定提供补充材料。' },
    group: Array.from({ length: 5 }, (_, index) => ({ name: '合成成员' + (index + 1), role: '合成分工' + (index + 1) })) };
  const advanced = record(903022, 'reviewing', ['returned', 'accepted', 'rejected'], { questions: advancedForm.questions, answers: advancedAnswers });
  const rejected = { ...record(903023, 'submitted', ['returned', 'accepted', 'rejected'], {
    memberName: '合成申请人乙（长称呼用于窄屏核对）', updatedAt: newRevision, answers: { ...answers, department: '宣传部' },
    feedback: '合成已有反馈：请补充能够投入的时间，以及一次具体协作经历。',
  }), decisionIndex: 2, feedbackDraft: '合成未录用原因：本批次安排的时段与申请中可参与的时间不一致。感谢提供完整资料，可关注后续批次。' };
  const readonly = record(903024, 'withdrawn', [], { memberName: '合成已撤回申请人', updatedAt: newRevision });
  const legacy = [{ id: 903031, collection: 'recruitment', title: '合成历史外部骨干招新', summary: '合成历史参与说明，不包含真实外部联系方式。', kindText: '骨干招新', dateText: '2026.09.01' }];
  return [
    fixture('staff-visitor-batches', 'staff', '访客；公开批次开放与截止；原登录入口', { ...directory, user: null }),
    fixture('staff-member-receipts', 'staff', '本人待补充与已撤回回执；同批次原生改稿入口；本人分页', { ...directory, own: [own(903021, 'returned'), own(903024, 'withdrawn', 1)], ownHasMore: true }),
    fixture('staff-manager-batches', 'staff', '审核能力显式为true；本人已录用回执与历史外部资料；角色不推导能力', { ...directory, user: manager, reviewStaff: true, own: [own(903025, 'accepted')], legacy }),
    fixture('staff-loading', 'staff', '批次与本人回执读取中', { ...directory, loading: true, docs: [], ownLoading: true, hasMore: false }),
    fixture('staff-empty', 'staff', '登录成员；无已发布批次与本人记录', { ...directory, docs: [], hasMore: false }),
    fixture('staff-error', 'staff', '公开批次读取失败，显示重试', { ...directory, error: '合成弱网：招新批次暂未读取，请重新加载。', docs: [], hasMore: false }),
    fixture('staff-own-error', 'staff', '刷新本人回执失败但原回执保留；历史资料单独失败', { ...directory, own: [own(903021, 'returned')], ownError: '合成弱网：本人回执尚未刷新，请重试核对。', legacyError: '合成历史资料读取失败。' }),
    fixture('staff-review-records', 'staff-review', '授权审核概览；多状态、长称呼与分页；答卷未展开', { ...review, docs: [basicRecord, rejected, readonly], total: 15, pages: 2 }),
    fixture('staff-review-advanced', 'staff-review', '完整16题型原问卷；答卷用现有formatter投影，说明题无答案；五人小组自然长阅读', { ...review, docs: [advanced], expandedId: advanced.id }),
    fixture('staff-review-rejected', 'staff-review', '宣传方向；新updatedAt修订；已有反馈和未录用原因；保存前核对决定', { ...review, docs: [rejected], expandedId: rejected.id, department: 'publicity', departmentIndex: 2 }),
    fixture('staff-review-busy', 'staff-review', '确认或POST在途；原筛选、反馈、决定与分页busy锁', { ...review, docs: [basicRecord], expandedId: basicRecord.id, busy: true, total: 13, pages: 2 }),
    fixture('staff-review-readonly', 'staff-review', '已撤回申请没有允许动作；原答卷可读', { ...review, docs: [readonly], expandedId: readonly.id }),
    fixture('staff-review-saved-refresh-error', 'staff-review', '匹配POST已确认录用；后续GET失败仍保留已保存提示；无旧动作', { ...review, docs: [], total: 0, message: '处理结果已保存：已录用；录用未授予平台角色。', error: '合成弱网：最新列表尚未读取，已确认的处理结果仍然保留。' }),
    fixture('staff-review-unknown', 'staff-review', '写入结果未知；只提示手动读取核对，不渲染成功或补发入口', { ...review, docs: [], total: 0, message: '处理结果暂不可确认，请刷新回执核对', error: '合成弱网：回执读取失败，请重新加载核对。' }),
    fixture('staff-review-loading', 'staff-review', '首次授权资料读取中；未展示私有答卷', { ...review, loading: true, docs: [], total: 0 }),
    fixture('staff-review-empty', 'staff-review', '筛选后无申请；保留方向和状态选项', { ...review, docs: [], total: 0, department: 'execution', departmentIndex: 1, status: 'returned', statusIndex: 3 }),
    fixture('staff-review-login', 'staff-review', '未登录或会话失效；私有资料清空', { ...review, needsLogin: true, docs: [], total: 0 }),
    fixture('staff-review-forbidden', 'staff-review', '403无权；私有答卷、总数与动作均已清空', { ...review, error: '合成无权：当前账号不能审核这个骨干招新批次。', docs: [], total: 0 }),
  ];
}
