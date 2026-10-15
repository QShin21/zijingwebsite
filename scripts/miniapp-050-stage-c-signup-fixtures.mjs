// Isolated synthetic states for native auth, signup and activity management.
// Only pure native projection helpers run. No Page lifecycle, wx API or network call.
export function stageCSignupFixtures(rt, native, exists) {
  if (!exists(native('lib/questionnaire.js'))) throw new Error('Native questionnaire runtime is required for signup fixtures');
  const questionnaire = rt.load(native('lib/questionnaire.js'));
  const staff = rt.load(native('lib/staff.js'));
  const team = rt.load(native('lib/team.js'));
  const fixture = (name, page, state, data) => ({ name, page, state, data });
  const seed = 'synthetic-stage-c-signup';
  const stamp = '2030-10-12T08:00:00.000Z';
  const simple = questionnaire.normalizeSignup({ enabled: true, pageSize: 4, intro: '合成报名说明：填写参与安排，提交前可核对。此处没有真实报名资料。', questions: [
    { id: 'nickname', label: '参与活动时使用的昵称', type: 'text', required: true, maxLength: 40 },
    { id: 'direction', label: '希望参与的交流内容', type: 'single', required: true, options: ['观赛交流', '战术复盘与经验分享'] },
    { id: 'interests', label: '想了解的活动安排', type: 'multiple', required: false, options: ['活动时间', '组队方式', '参与准备'] },
    { id: 'notes', label: '补充说明', type: 'textarea', required: false, help: '合成预览，不需要提供真实联系方式。' },
  ] });
  const simpleAnswers = { nickname: '合成参与者', direction: '战术复盘与经验分享', interests: ['活动时间', '参与准备'], notes: '合成说明：已核对参与安排。' };
  const allTypes = questionnaire.normalizeSignup({ enabled: true, pageSize: 20, intro: '合成 16 题型问卷，用于核对原生控件、说明、选项与信息组。所有答案均为隔离样例。', questions: [
    { id: 'text', type: 'text', label: '参与时使用的昵称', maxLength: 40 },
    { id: 'textarea', type: 'textarea', label: '希望在交流中讨论的内容', help: '可填写一段完整说明，长内容应在窄屏自然换行。' },
    { id: 'single', type: 'single', label: '选择参加方式', options: ['现场交流', '合成较长选项：参加赛后复盘并与其他参与者交流准备经验'] },
    { id: 'multiple', type: 'multiple', label: '希望了解的内容（可多选）', options: ['活动安排', '团队配合', '新成员参与方式'] },
    { id: 'select', type: 'select', label: '选择交流方向', options: ['活动组织', '比赛复盘'] },
    { id: 'number', type: 'number', label: '每周可参与的小时数', min: 0, max: 20, step: 0.5 },
    { id: 'date', type: 'date', label: '可参与的日期' },
    { id: 'time', type: 'time', label: '方便开始的时间' },
    { id: 'rating', type: 'rating', label: '对交流内容的期待程度' },
    { id: 'nps', type: 'nps', label: '愿意向同学推荐这类交流吗' },
    { id: 'ranking', type: 'ranking', label: '按偏好排列交流环节', options: ['比赛复盘', '自由交流'] },
    { id: 'matrix', type: 'matrix', label: '各时段的参与安排', rows: ['周中晚上', '周末下午'], options: ['方便', '待确认'] },
    { id: 'matrixMultiple', type: 'matrixMultiple', label: '各环节想了解的内容', rows: ['观赛交流'], options: ['战术配合', '组织安排'] },
    { id: 'blanks', type: 'blanks', label: '补全活动准备信息', rows: ['希望了解', '补充说明'] },
    { id: 'group', type: 'group', label: '同行参与者', minEntries: 1, maxEntries: 2, fields: [
      { id: 'name', label: '参与者昵称', type: 'text', required: true },
      { id: 'direction', label: '交流方向', type: 'select', required: true, options: ['比赛复盘', '自由交流'] },
    ] },
    { id: 'description', type: 'description', label: '填写完成后请核对', help: '此段只作说明，无需作答；核对后才会提交。' },
  ].map(question => ({ required: true, options: [], ...question })) });
  const allAnswers = {
    text: '合成昵称', textarea: '合成答案：希望分享参与准备与比赛复盘的经验，并了解活动中的分工。',
    single: '现场交流', multiple: ['活动安排', '新成员参与方式'], select: '比赛复盘', number: '2.5', date: '2030-10-18', time: '19:30',
    rating: '4', nps: '8', ranking: ['自由交流', '比赛复盘'], matrix: { 周中晚上: '方便', 周末下午: '待确认' },
    matrixMultiple: { 观赛交流: ['战术配合', '组织安排'] }, blanks: { 希望了解: '合成活动安排', 补充说明: '合成参与准备' },
    group: [{ name: '合成同行者', direction: '比赛复盘' }],
  };
  const branchForm = questionnaire.normalizeSignup({ enabled: true, pageSize: 2, intro: '合成分支：当前选择跳过中间题，必填问题仍需完成。', questions: [
    { id: 'path', label: '选择填写范围', type: 'single', required: true, options: ['完整填写', '仅填写安排'], jumps: [{ when: { mode: 'all', rules: [{ questionId: 'path', operator: 'equals', value: '仅填写安排' }] }, target: 'final' }] },
    { id: 'detail', label: '交流经历', type: 'textarea', required: true },
    { id: 'final', label: '可以参与的时间安排', type: 'text', required: true, help: '请补全本题后继续核对。' },
  ] });
  const branchAnswers = { path: '仅填写安排', final: '' };
  const coreQuestions = [
    { id: 'gameID', label: '游戏 ID', type: 'text', required: true },
    { id: 'position', label: '擅长位置', type: 'text', required: true },
    { id: 'experience', label: '比赛经历', type: 'textarea', required: true },
    { id: 'availability', label: '训练时间', type: 'textarea', required: true },
    { id: 'contact', label: '一种联系方式', type: 'text', required: true },
  ];
  const groupForm = questionnaire.normalizeSignup({ enabled: true, pageSize: 5, intro: '合成代表队申请。核心资料与五至六人成员组均使用现有问卷引擎。', questions: [
    ...coreQuestions,
    { id: 'members', label: '五至六人成员名单', type: 'group', required: true, minEntries: 5, maxEntries: 6, fields: [
      { id: 'name', label: '成员昵称', type: 'text', required: true },
      { id: 'position', label: '擅长位置', type: 'select', required: true, options: ['合成位置甲', '合成位置乙'] },
    ] },
  ] });
  const groupAnswers = { gameID: '合成游戏ID', position: '合成位置甲', experience: '合成比赛经历', availability: '合成训练时间', contact: 'synthetic@example.invalid',
    members: Array.from({ length: 6 }, (_, index) => ({ name: '合成成员' + (index + 1), position: index % 2 ? '合成位置乙' : '合成位置甲' })),
  };
  const saved = (id, form = simple, answers = simpleAnswers, extra = {}) => ({ id, createdAt: stamp, updatedAt: stamp, formVersion: 'synthetic-form-v1', questions: form.questions, answers, ...extra });
  const personalReceipt = questionnaire.receipt(saved(900301));
  const staffReceipt = staff.receipt(saved(900302, simple, simpleAnswers, { status: 'returned', feedback: '合成处理反馈：请补充可参与时间，核对后修改同一份申请。' }));
  const draft = team.receipt({ id: 900303, title: '合成代表队申请', status: 'draft', teamID: 900351, recruitmentID: 900371, createdAt: stamp, updatedAt: stamp, formVersion: 'synthetic-form-v1', formSnapshot: groupForm, answers: groupAnswers });
  const confirmed = team.receipt({ id: 900303, title: '合成代表队申请', status: 'pending', teamID: 900351, recruitmentID: 900371, createdAt: stamp, updatedAt: '2030-10-12T09:00:00.000Z', formVersion: 'synthetic-form-v1', formSnapshot: groupForm, answers: groupAnswers });
  const signup = (form = simple, answers = simpleAnswers, extra = {}) => ({
    loading: false, error: '', needsLogin: false, edit: false, team: false, staff: false, applicationMode: false,
    info: { title: '合成活动报名', state: '报名开放', version: 'synthetic-form-v1', canManage: false, canViewSignups: false, actions: {} },
    form, answers, ...questionnaire.presentation(form, answers, 0, seed), ...extra,
  });
  const reviewRows = questionnaire.receipt(saved(900301)).rows;
  const basicTypes = ['text', 'textarea', 'single', 'multiple'];
  const editor = (form, extra = {}) => signup(form, {}, { edit: true,
    info: { title: '合成报名问卷与时间设置', state: '报名开放', version: 'synthetic-form-v1', canManage: true, canViewSignups: true, actions: {} },
    advancedEditing: form.questions.some(question => !basicTypes.includes(question.type) || question.showWhen || question.display || question.jumps?.length),
    editQuestions: form.questions.map(question => ({ ...question, typeIndex: basicTypes.indexOf(question.type), typeLabel: questionnaire.questionTypes[question.type], optionsText: question.options.join('\n') })),
    startDate: '', startTime: '', endDate: '', endTime: '', ...extra,
  });
  const teamInfo = { title: '合成代表队招新：参与训练与成员选拔', state: '申请开放', version: 'synthetic-form-v1', teamID: 900351, actions: { draft: true, submit: true, edit: true, withdraw: false, review: false }, historyNote: '合成历史说明：请以本次申请状态核对后续操作。' };
  const entries = [questionnaire.receipt(saved(900311, simple, simpleAnswers, { memberName: '合成参与者甲' })), questionnaire.receipt(saved(900312, simple, { ...simpleAnswers, nickname: '合成很长昵称用于测试标题换行与报名资料展开', notes: '合成多行答案，用于检查读取资料时的行距。\n没有真实报名信息。' }, { memberName: '合成较长参与者名称与报名记录展示' }))];
  const entryInfo = { title: '合成活动报名名单', state: '报名开放', version: 'synthetic-form-v1', canManage: false, canViewSignups: true, actions: {} };
  const registration = { mode: 'register', name: '合成用于检查窄屏输入的较长昵称', emailPrefix: 'synthetic-only-preview', emailDomain: 'mails.tsinghua.edu.cn', password: 'synthetic-password-only', confirm: 'synthetic-password-only' };
  const manage = extra => ({ loading: false, error: '', needsLogin: false, kind: 'community-posts', docs: [], page: 1, hasNextPage: false, ...extra });
  return [
    fixture('auth-login', 'auth', '登录初始状态；昵称与邮箱共用原登录接口', { mode: 'login' }),
    fixture('auth-register-sent', 'auth', '注册长昵称、邮箱后缀选择与验证码已发送回执；全部为合成输入', { ...registration, sent: true, countdown: 38 }),
    fixture('auth-reset-error', 'auth', '重设密码校验失败，原输入保留；无成功声明', { mode: 'reset', email: 'synthetic@example.invalid', password: 'synthetic-password-only', confirm: 'synthetic-mismatch-only', code: '123456', error: '密码至少 8 位，两次输入需一致' }),
    fixture('auth-bridge-error', 'auth', '账号能力未确认；保留完整邮箱兼容登录和显式检查', { mode: 'login', bridge: false, identifier: 'synthetic@example.invalid', error: '合成网络失败：请检查连接后重新尝试。' }),
    fixture('auth-register-busy', 'auth', '注册正在处理；主动作、验证码和切换模式保留原busy约束', { ...registration, code: '123456', sent: true, busy: true }),
    fixture('signup-all-types', 'signup', '真实生成runtime投影全部16题型；合成合法答案与长选项', signup(allTypes, allAnswers)),
    fixture('signup-validation-branch', 'signup', '真实分支后的第二页；必填错误就近显示，仍需主动核对', signup(branchForm, branchAnswers, { ...questionnaire.presentation(branchForm, branchAnswers, 1, seed, questionnaire.answerErrors(branchForm, branchAnswers)), message: '请检查提示的题目后继续。' })),
    fixture('signup-team-six-draft', 'signup', '代表队草稿第二页；真实五至六人成员组，六条完整记录与草稿入口', signup(groupForm, groupAnswers, { team: true, applicationMode: true, info: teamInfo, receipt: draft, responseEditing: true, ...questionnaire.presentation(groupForm, groupAnswers, 1, seed), message: '草稿已保存，可继续填写；提交后由管理员审核。' })),
    fixture('signup-review-busy', 'signup', '核对页写入中；保留整份核对资料，提交与返回均锁定', signup(simple, simpleAnswers, { review: true, reviewRows, busy: true })),
    fixture('signup-write-unknown', 'signup', '改稿写入结果未知；旧回执与新输入均保留，无自动重发或伪造成功', signup(simple, { ...simpleAnswers, notes: '合成尚未确认的新输入，需核对已保存内容。' }, { receipt: personalReceipt, responseEditing: true, review: true, reviewRows: questionnaire.receipt(saved(900301, simple, { ...simpleAnswers, notes: '合成尚未确认的新输入，需核对已保存内容。' })).rows, message: '合成弱网：提交结果暂未确认，请核对已保存内容后再决定是否重试。' })),
    fixture('signup-receipt-readonly-long', 'signup', '已截止的本人报名回执；完整长答案只读，不能恢复编辑', signup(simple, {}, { info: { title: '合成已结束活动：长标题仍应完整呈现报名归属与回执', state: '报名已结束', canManage: false, canViewSignups: false, actions: {} }, receipt: questionnaire.receipt(saved(900301, simple, { ...simpleAnswers, notes: '合成长内容：以下文字只用于回执换行与完整读取检查。\n' + '请保留已经确认的报名答案及其对应题目，便于本人核对。'.repeat(6) })), message: '报名已保存' })),
    fixture('signup-staff-returned', 'signup', '骨干申请待补充；处理反馈、同编号修改与服务端撤回能力', signup(simple, {}, { staff: true, applicationMode: true, info: { title: '合成骨干招新申请', state: '申请开放', version: 'synthetic-form-v1', actions: { edit: true, withdraw: true, submit: false, review: false }, privacy: '合成资料仅供本人及有权限的选拔人员查看。', deadlinePolicy: '合成截止规则以批次说明为准。' }, receipt: staffReceipt })),
    fixture('signup-team-confirmed-read-error', 'signup', '代表队POST已确认，随后GET失败；保留成功回执，当前能力仍未知', signup(groupForm, {}, { team: true, applicationMode: true, info: null, error: '合成恢复读取网络失败', receipt: null, confirmedReceipt: confirmed, confirmationMessage: '代表队申请已提交，请查看本人回执。当前状态读取失败，请重试核对允许的操作。' })),
    fixture('signup-manage-basic', 'signup', '有问卷与名单能力的管理者；四种原生编辑题型、开放时间与保存', editor({ ...simple, start: '2030-10-10T04:00:00.000Z', end: '2030-10-17T10:00:00.000Z' }, { startDate: '2030-10-10', startTime: '12:00', endDate: '2030-10-17', endTime: '18:00' })),
    fixture('signup-manage-advanced', 'signup', '高级题型保留全问卷概览；原网站编辑入口不伪装成原生制作能力', editor(allTypes)),
    fixture('signup-entries-viewer', 'signup', '仅名单权限；第二页、长名字、展开完整回答，不能编辑问卷', editor(simple, { info: entryInfo, tab: 'entries', entries, expandedEntryId: 900312, total: 4, page: 2, pages: 2 })),
    fixture('signup-entries-empty', 'signup', '名单已读取且为空；与读取失败分别呈现', editor(simple, { info: entryInfo, tab: 'entries', entries: [], total: 0, pages: 0 })),
    fixture('signup-loading', 'signup', '报名首次读取；当前资料尚未取得，不显示过期答案', { loading: true, info: null, team: false, staff: false, applicationMode: false }),
    fixture('signup-login', 'signup', '会话失效；受限资料已清空，保留登录后继续入口', { loading: false, needsLogin: true, info: null, receipt: null, questions: [], entries: [] }),
    fixture('activity-manage-community', 'activity-manage', '社群范围：问卷与名单、仅名单、只读三类服务端能力', manage({ docs: [
      { id: 900401, title: '合成社群活动：交流与复盘', status: 'published', canManage: true, canViewSignups: true },
      { id: 900402, title: '合成活动：仅可查看报名名单', status: 'published', canManage: false, canViewSignups: true },
      { id: 900403, title: '合成已隐藏活动', status: 'hidden', canManage: false, canViewSignups: false },
    ], hasNextPage: true })),
    fixture('activity-manage-site-long', 'activity-manage', '站点范围第二页；长标题、草稿与已公开活动', manage({ kind: 'events', page: 2, docs: [
      { id: 900404, title: '合成站点活动草稿：为不同经验的参与者安排观赛、交流与比赛复盘', _status: 'draft', canManage: true, canViewSignups: false },
      { id: 900405, title: '合成站点活动：报名开放后的组织工作', _status: 'published', canManage: true, canViewSignups: true },
    ] })),
    fixture('activity-manage-empty', 'activity-manage', '当前范围无可管理活动；保留范围切换和下一步说明', manage({ kind: 'events' })),
    fixture('activity-manage-error', 'activity-manage', '活动读取失败；不能渲染成无活动，保留显式重试', manage({ error: '合成网络失败：活动暂未读取，请重新加载。' })),
    fixture('activity-manage-loading', 'activity-manage', '活动范围读取中；切换按钮忙碌且旧列表不出现', manage({ loading: true })),
  ];
}
