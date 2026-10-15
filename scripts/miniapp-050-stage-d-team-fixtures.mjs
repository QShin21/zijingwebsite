// Isolated synthetic layout inputs. Never import into production content or run page lifecycle methods.
export function stageDTeamFixtures(rt, native, exists) {
  if (!exists(native('lib/team.js'))) throw new Error('Stage D team fixtures require the actual native team projection');
  const format = rt.load(native('lib/format.js'));
  const team = rt.load(native('lib/team.js'));
  const questionnaire = rt.load(native('lib/questionnaire.js'));
  const fixture = (name, page, state, data) => ({ name, page, state, data });
  const updatedAt = '2026-10-15T08:30:00.000Z';
  const common = { needsLogin: false, loading: false, error: '', operationError: '', done: '', busy: false };
  const paged = (docs = [], extra = {}) => ({ docs, page: 1, hasNextPage: false, totalPages: 1, totalDocs: docs.length, ...extra });
  const longTitle = '合成代表队：跨项目交流与长期共同训练计划的完整队伍名称';
  const plan = '合成组织计划：由自愿参与的成员共同讨论训练目标，按每周可参加的时间安排复盘与练习。\n合成训练安排：记录每次练习中的问题，交流不同位置的配合方式，并在下一次训练前核对参与情况。此文字不描述真实队伍或制度。';
  const reviewNote = '合成处理意见：请补充可持续的训练时间、成员组织方式与负责人的安排，再使用原申请编号提交。长反馈应完整换行，便于本人逐项核对。';
  const proposal = { id: 900011, title: '合成游戏社群与长期交流训练项目', actions: { establish: true } };
  const teamDoc = { id: 900052, title: longTitle, teamStatus: 'active', statusText: '活跃', updatedAt, actions: { workbench: true } };
  const recruitment = (extra = {}) => {
    const doc = { id: 900061, title: '合成秋季招新：训练安排与队员选拔', teamID: 900052, gameID: 900011, status: 'open', state: '招新开放',
      startAt: '2026-10-10T04:00:00.000Z', endAt: '2026-10-28T12:00:00.000Z', updatedAt, actions: { view: true, apply: true }, ...extra };
    return { ...doc, dateText: format.date(doc.updatedAt), startText: format.date(doc.startAt), endText: format.date(doc.endAt) };
  };
  const membership = (extra = {}) => {
    const doc = { id: 900071, title: '合成成员甲', teamID: 900052, gameID: 900011, status: 'active', joinedAt: '2026-09-10T08:00:00.000Z',
      leftAt: null, revokedAt: null, updatedAt, actions: { leave: true, revoke: true }, noteDraft: '', ...extra };
    return { ...doc, dateText: format.date(doc.updatedAt), joinedText: format.date(doc.joinedAt), endText: doc.leftAt || doc.revokedAt ? format.date(doc.leftAt || doc.revokedAt) : '',
      statusText: doc.status === 'active' ? '成员关系未撤销' : doc.leftAt ? '已离队' : '已撤销' };
  };
  const establishment = (extra = {}) => {
    const doc = { id: 900081, title: longTitle, gameID: 900011, status: 'pending', reason: plan, updatedAt, actions: { withdraw: true }, ...extra };
    return { ...doc, statusText: team.labels[doc.status] || '状态待核对', dateText: format.date(doc.updatedAt) };
  };
  const decisionLabels = { approved: '批准', returned: '退回补充', rejected: '拒绝' };
  const decisions = ['approved', 'returned', 'rejected'];
  const decorateReview = doc => ({ ...doc, noteDraft: doc.noteDraft || '', decisions: (doc.actions.reviewDecisions || []).map(value => ({ value, label: decisionLabels[value] })) });
  const basicSnapshot = questionnaire.normalizeSignup({ enabled: true, questions: ['gameID', 'position', 'experience', 'availability', 'contact'].map(id => ({ id,
    label: { gameID: '合成游戏 ID', position: '合成位置', experience: '合成经历', availability: '合成可参加时间', contact: '合成联系方式' }[id], type: 'text', required: true, options: [] })) });
  const basicAnswers = { gameID: '合成玩家 ID', position: '合成位置说明', experience: '合成经历：与不同成员共同完成训练和复盘。', availability: '合成时间：周末讨论安排', contact: 'synthetic@example.invalid' };
  const join = (extra = {}) => {
    const doc = { id: 900091, title: '合成成员的入队申请', teamID: 900052, recruitmentID: 900061, status: 'pending', updatedAt,
      formSnapshot: basicSnapshot, formVersion: 'synthetic-form-v1', answers: basicAnswers, reviewNote: '', actions: { view: true, withdraw: true, reviewDecisions: decisions }, ...extra };
    return decorateReview({ ...doc, ...team.receipt(doc), actions: doc.actions, dateText: format.date(doc.updatedAt), noteDraft: doc.noteDraft || '' });
  };
  const extensions = [
    { type: 'text' }, { type: 'textarea' }, { type: 'single', options: ['合成 A', '合成 B'] }, { type: 'multiple', options: ['合成 A', '合成 B'] },
    { type: 'select', options: ['合成 A', '合成 B'] }, { type: 'number' }, { type: 'date' }, { type: 'time' }, { type: 'rating' }, { type: 'nps' },
    { type: 'ranking', options: ['合成 A', '合成 B'] }, { type: 'matrix', rows: ['合成训练时段'], options: ['合成 A', '合成 B'] },
    { type: 'matrixMultiple', rows: ['合成可选场景'], options: ['合成 A', '合成 B'] }, { type: 'blanks', rows: ['合成子题'] },
    { type: 'group', minEntries: 5, maxEntries: 6, fields: [{ id: 'name', label: '合成成员代号', type: 'text', required: true, options: [] }] },
    { type: 'description' },
  ].map(question => ({ id: 'q_' + question.type, label: '合成题型 ' + question.type, required: true, options: [], ...question }));
  const fullSnapshot = questionnaire.normalizeSignup({ enabled: true, questions: [...basicSnapshot.questions, ...extensions] });
  const fullAnswers = { ...basicAnswers, q_text: '合成短文本', q_textarea: '合成长文本：完整答卷使用提交时的问卷快照，保留不同题型的展示与长答案换行。',
    q_single: '合成 A', q_multiple: ['合成 A', '合成 B'], q_select: '合成 B', q_number: '3', q_date: '2026-10-15', q_time: '19:30', q_rating: '5', q_nps: '8',
    q_ranking: ['合成 B', '合成 A'], q_matrix: { 合成训练时段: '合成 B' }, q_matrixMultiple: { 合成可选场景: ['合成 A', '合成 B'] },
    q_blanks: { 合成子题: '合成填空内容' }, q_group: Array.from({ length: 5 }, (_, index) => ({ name: '合成成员 ' + (index + 1) })) };
  const fullReceipt = join({ title: '合成完整入队答卷：十六题型与五人组', formSnapshot: fullSnapshot, answers: fullAnswers, reviewNote, noteDraft: '合成审核意见草稿：待核对共同训练安排。' });
  const openBatch = recruitment();
  const closedBatch = recruitment({ id: 900062, title: '合成长标题招新批次：已结束的历史申请与回执仍可查看', status: 'closed', state: '招新已关闭', actions: { view: true } });
  const ownReturned = join({ status: 'returned', reviewNote, actions: { view: true, edit: true, withdraw: true } });
  const ownApproved = join({ id: 900092, title: '合成已批准申请', status: 'approved', actions: { view: true } });
  const currentMember = membership();
  const formerMember = membership({ id: 900072, title: '合成成员乙：用于核对较长展示名称的历史关系', status: 'revoked', leftAt: '2026-10-01T08:00:00.000Z', actions: {} });
  const revokedMember = membership({ id: 900073, title: '合成已撤销成员', status: 'revoked', revokedAt: '2026-10-02T08:00:00.000Z', actions: {} });
  const hub = (view = 'recruitments', docs = [openBatch, closedBatch], extra = {}) => ({ ...common, view, docs, total: docs.length, page: 1, hasMore: false, expandedRecord: null,
    actions: {}, recruitments: paged(view === 'recruitments' ? docs : [openBatch]), ownApplications: paged(view === 'ownApplications' ? docs : []),
    memberships: paged(view === 'memberships' ? docs : []), managedTeams: paged(view === 'managedTeams' ? docs : []), ...extra });
  const ownApplication = (extra = {}) => ({ ...common, docs: [], expandedId: '', page: 1, hasMore: false, games: [proposal], actions: { establish: true },
    apply: false, editId: '', revision: '', formGameID: proposal.id, gameIndex: 0, gameTitle: proposal.title, title: '', reason: '', canSubmit: true, pendingEdit: '', formError: '', ...extra });
  const reviewer = (extra = {}) => ({ ...common, allowed: true, mode: 'join', teamID: teamDoc.id, teamDoc,
    teamActions: { createRecruitment: true }, lifecycleChoices: [{ value: 'resting', label: '休整' }, { value: 'archived', label: '已归档' }],
    docs: [join()], expandedId: '', page: 1, hasMore: false, status: 'pending', statusIndex: 0,
    statusLabels: ['待人工审核', '退回补充', '已批准', '未通过', '已撤回'], recruitments: [recruitment({ actions: { view: true, edit: true, close: true, archive: true } })], batchesPage: 1, batchesMore: false, ...extra });
  const members = (extra = {}) => ({ ...common, allowed: true, teamDoc, docs: [currentMember, formerMember, revokedMember], expandedId: '', page: 1, hasMore: false, ...extra });
  const returnedEstablishment = establishment({ status: 'returned', reviewNote, actions: { edit: true, withdraw: true } });
  const confirmedEstablishment = establishment({ status: 'pending', actions: {} });
  const establishmentReview = decorateReview(establishment({ actions: { reviewDecisions: decisions }, noteDraft: '合成意见：请补充时间安排。' }));
  const unknownResult = '合成断网：本次写入结果尚未确认。请先刷新回执核对，避免重复提交。';
  return [
    fixture('team-recruitments', 'team', '普通成员；开放与关闭的招新批次、长标题和独立日期', hub('recruitments', [openBatch, closedBatch], { hasMore: true })),
    fixture('team-applications', 'team', '本人退回与已批准申请；保留反馈、同编号改稿和原生问卷入口', hub('ownApplications', [ownReturned, ownApproved])),
    fixture('team-memberships', 'team', '本人与历史成员关系；展开公开简介、荣誉入口', hub('memberships', [membership({ title: longTitle }), formerMember], { expandedRecord: currentMember.id })),
    fixture('team-managed', 'team', '当前管理任职；工作台、成员与建队审核来自实际actions', hub('managedTeams', [teamDoc], { actions: { establish: true, reviewEstablishments: true }, expandedRecord: teamDoc.id })),
    fixture('team-empty', 'team', '本人申请为空；明确进入招新批次', hub('ownApplications', [])),
    fixture('team-loading', 'team', '首次读取；无假计数与空列表结论', hub('recruitments', [], { loading: true })),
    fixture('team-error', 'team', '目录读取失败；可重试且不显示空列表', hub('recruitments', [], { error: '合成弱网：代表队记录暂未读取，请重试。' })),
    fixture('team-login', 'team', '未登录；私人记录清空', hub('recruitments', [], { needsLogin: true })),
    fixture('team-apply-new', 'team-apply', '有建队权限的社群管理员；社群、队名与计划原生字段', ownApplication({ apply: true, title: '合成训练代表队', reason: plan })),
    fixture('team-apply-edit-unknown', 'team-apply', '原申请改稿；未知写入结果保留社群、编号、修订和输入', ownApplication({ apply: true, editId: returnedEstablishment.id, revision: updatedAt, docs: [returnedEstablishment], title: longTitle, reason: plan, formError: unknownResult })),
    fixture('team-apply-confirmed-error', 'team-apply', 'POST已确认但随后GET失败；只读回执与成功提示共存', ownApplication({ docs: [confirmedEstablishment, returnedEstablishment], expandedId: confirmedEstablishment.id, done: '建队申请已提交，请刷新回执查看处理状态', error: '合成弱网：回执暂未刷新，已确认提交的记录仍保留。' })),
    fixture('team-apply-pending-edit', 'team-apply', '深链改稿尚未定位；加载更多原回执，不显示新建表单', ownApplication({ apply: true, pendingEdit: '900089', canSubmit: false, hasMore: true, docs: [confirmedEstablishment], formError: '请继续加载本人回执查找此申请；当前不会创建新申请' })),
    fixture('team-apply-denied-empty', 'team-apply', '当前无建队权限且无本人历史回执', ownApplication({ games: [], actions: {}, formGameID: '', gameTitle: '', canSubmit: false })),
    fixture('team-apply-busy', 'team-apply', '保存尚未完成；填写内容可见、字段与提交动作锁定', ownApplication({ apply: true, busy: true, title: '合成正在保存的建队计划', reason: plan })),
    fixture('team-review-join', 'team-review', '当前队伍管理任职；申请、招新批次和运营动作分别呈现', reviewer({ hasMore: true, batchesMore: true })),
    fixture('team-review-full-questionnaire', 'team-review', '使用真实team.receipt；十六题型、五人组、完整反馈与审核意见', reviewer({ docs: [fullReceipt], expandedId: fullReceipt.id })),
    fixture('team-review-establishment', 'team-review', '有建队审核授权；组织计划与本次处理意见，保留三种决定', reviewer({ mode: 'establishment', teamID: '', teamDoc: null, teamActions: {}, lifecycleChoices: [], recruitments: [], docs: [establishmentReview], expandedId: establishmentReview.id })),
    fixture('team-review-receipt-error', 'team-review', '答卷投影失败；原申请保留、批准禁用，允许原有退回或拒绝', reviewer({ docs: [{ ...join(), rows: [], receiptError: '合成异常：已提交答卷暂时无法展示，请刷新重试', noteDraft: '合成说明：请核对答卷。' }], expandedId: 900091 })),
    fixture('team-review-empty', 'team-review', '当前状态无申请也无批次；运营授权仍可见', reviewer({ docs: [], recruitments: [] })),
    fixture('team-review-denied', 'team-review', '管理授权不可用；不保留队伍与答卷', reviewer({ allowed: false, teamDoc: null, docs: [], recruitments: [], teamActions: {}, lifecycleChoices: [] })),
    fixture('team-review-loading', 'team-review', '正在核对权限；未展示私有队伍与审核记录', reviewer({ loading: true, allowed: false, teamDoc: null, docs: [], recruitments: [], teamActions: {}, lifecycleChoices: [] })),
    fixture('team-members-current', 'team-members', '管理任职；当前、主动离队与已撤销三类关系，长成员名', members({ hasMore: true })),
    fixture('team-members-revoke-busy', 'team-members', '撤销确认或写入在途；具体原因保留，单次写入锁定', members({ docs: [membership({ noteDraft: '合成撤销原因：已核对本人结束共同训练的安排。' })], expandedId: currentMember.id, busy: true })),
    fixture('team-members-confirmed-error', 'team-members', '撤销POST已确认而GET失败；历史关系与已保存回执继续可读', members({ docs: [revokedMember], done: '成员关系撤销已保存', error: '合成弱网：最新成员列表尚未读取，已保存的关系记录仍保留。' })),
    fixture('team-members-denied', 'team-members', '无成员管理权限；不显示私有成员或撤销入口', members({ allowed: false, teamDoc: null, docs: [] })),
    fixture('team-members-empty', 'team-members', '有管理权限且本队暂未产生成员关系', members({ docs: [] })),
  ];
}
