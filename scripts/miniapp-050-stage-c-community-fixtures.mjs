// Isolated synthetic layout data. No production records, real contacts, network calls or wx effects.
// The runner supplies each real Page's initial data before applying these explicit state overrides.
export function stageCCommunityFixtures(rt, native, exists) {
  if (!exists(native('lib/format.js'))) throw new Error('Synthetic community fixtures require the selected source format module.');
  const format = rt.load(native('lib/format.js'));
  const fixture = (name, page, state, data) => ({ name, page, state: '合成数据；' + state, data });
  const user = { id: 950001, name: '合成预览成员', roles: ['member'], accountStatus: 'active' };
  const game = { id: 950011, title: '合成游戏社群' };
  const longGame = '合成游戏社群：跨校区同好交流与日常训练组织计划的长名称';
  const createdAt = '2026-10-12T08:00:00.000Z';
  const updatedAt = '2026-10-13T08:00:00.000Z';
  const dateText = format.date(createdAt);
  const reason = '合成组织计划：每周安排一次同好交流，提前收集参与时间，并说明活动地点和参与方式。\n合成管理安排：由申请人核对新成员的联系意向，在微信完成好友确认与邀请，再按实际情况记录进群进度。\n合成补充说明：这段长文仅用于检查正文换行、材料阅读和表单保值，不描述任何真实社团活动或个人经历。';
  const reviewNote = '合成处理意见：请补充每周可投入时间、交流安排及管理分工。请保留原申请编号，补充后重新提交，方便负责人对照核验。';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="352" height="352" viewBox="0 0 352 352"><rect width="352" height="352" fill="#fffdf9"/><rect x="24" y="24" width="304" height="304" rx="16" fill="#f1e7ef"/><circle cx="176" cy="128" r="34" fill="#6f2d67"/><path d="M110 220c0-42 132-42 132 0" fill="#6f2d67"/><text x="176" y="267" text-anchor="middle" font-family="sans-serif" font-size="21" fill="#202124">合成名片图形</text><text x="176" y="296" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#62626a">布局测试 · 不能扫码</text></svg>';
  const qr = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const statusLabels = { pending: '待审核', returned: '退回补充', approved: '已批准并开放社群', rejected: '已拒绝', withdrawn: '已撤回' };
  const application = (id, status = 'pending', extra = {}) => ({ id, game: null, proposedGame: '合成游戏社群', realName: '合成申请人', phone: '00000000000', reason,
    contactConsent: true, createdAt, updatedAt, dateText, status, statusText: statusLabels[status], reviewNote: '', reviewDraft: '',
    actions: { edit: false, card: false, withdraw: false, review: false }, ...extra });
  const returned = application(950101, 'returned', { proposedGame: longGame, reviewNote, actions: { edit: true } });
  const approved = application(950102, 'approved', { actions: { card: true } });
  const pending = application(950103, 'pending', { actions: { withdraw: true } });
  const app = { user, needsLogin: false, games: [{ id: '', title: '申请新游戏社群' }, game], docs: [], loading: false, error: '' };
  const draft = { ...app, apply: true, proposedGame: longGame, realName: '合成申请人', phone: '00000000000', reason, qr };
  const approvedSettings = { ...app, apply: true, mode: 'card', editId: approved.id, revision: approved.updatedAt, savedQr: true, docs: [approved] };
  const reviewLabels = { ...statusLabels, approved: '已批准', returned: '已退回补充' };
  const reviewRecord = (id, extra = {}) => {
    const record = application(id, 'pending', { actions: { review: true }, ...extra });
    return { ...record, statusText: reviewLabels[record.status] || '状态待核对' };
  };
  const authorized = reviewRecord(950201, { proposedGame: longGame });
  const noConsent = reviewRecord(950202, { contactConsent: false });
  const review = { allowed: true, needsLogin: false, loading: false, error: '', docs: [authorized] };
  const joinLabels = { requested: '已记录意向，待联系管理员', friendReported: '本人已报告好友申请，待核实', awaitingInvite: '好友已人工确认通过，等待拉群', joined: '管理员已人工确认进群', withdrawn: '网站意向已撤回' };
  const join = (id, status, extra = {}) => ({ id, memberName: '合成成员', createdAt, updatedAt, dateText, status, statusText: joinLabels[status],
    note: '', noteDraft: '', actions: {}, ...extra });
  const requested = join(950301, 'requested', { memberName: '合成成员甲', actions: { confirmFriend: true } });
  const friend = join(950302, 'friendReported', { memberName: '合成成员乙：很长的显示名称用于检查手机自然换行', actions: { confirmFriend: true } });
  const invite = join(950303, 'awaitingInvite', { memberName: '合成成员丙', note: '合成说明：已在微信核实好友添加情况，等待安排邀请。', actions: { confirmJoined: true } });
  const joined = join(950304, 'joined', { memberName: '合成成员丁', note: '合成说明：管理员已核实实际进入微信群。' });
  const joins = { title: longGame, allowed: true, needsLogin: false, loading: false, error: '', docs: [] };
  return [
    fixture('applications-new', 'applications', '本人新申请；空表单；名片同意默认false；空回执', { ...app, apply: true, contactConsent: false }),
    fixture('applications-consent-required', 'applications', '长名称与长组织计划；名片已选；展示同意false；就近必需同意提示', { ...draft, contactConsent: false, formError: '由于入社流程规定，必须展示管理联系方式' }),
    fixture('applications-qr-error', 'applications', '本地名片预览原生错误；原URL和填写内容保留；可重试预览或主动换图', { ...draft, contactConsent: true, qrFailed: true }),
    fixture('applications-returned-edit', 'applications', '退回后同编号修改；保留反馈与修订；展示同意true', { ...draft, mode: 'edit', editId: returned.id, revision: returned.updatedAt, savedQr: true, contactConsent: true, docs: [returned], expandedId: returned.id }),
    fixture('applications-approved-visible', 'applications', '获批后名片设置；已授权true；保留二维码预览入口', { ...approvedSettings, contactConsent: true, qr }),
    fixture('applications-approved-hidden', 'applications', '获批后主动关闭展示false；图片隐私授权失败保留设置', { ...approvedSettings, contactConsent: false, formError: '合成图片隐私授权未完成。已保存的名片与当前填写内容保留，可再次主动选择。' }),
    fixture('applications-receipts', 'applications', '本人待审、退回、批准、拒绝、撤回回执；仅呈现服务端actions；分页', { ...app, docs: [pending, returned, approved, application(950104, 'rejected', { reviewNote }), application(950105, 'withdrawn', { actions: { edit: true } })], hasMore: true }),
    fixture('applications-saving', 'applications', '本人申请主动提交中的busy；字段与授权保持；提交不可重复', { ...draft, contactConsent: true, busy: true }),
    fixture('applications-saved-read-error', 'applications', 'POST成功后GET失败；已确认回执和成功反馈保留；操作暂为空', { ...app, docs: [application(950103)], done: '申请已提交，请在回执中查看状态和处理意见', error: '合成网络错误：最新回执暂未重新读取，请刷新核对。' }),
    fixture('applications-session-expired', 'applications', '401会话失效；受限资料清空；登录入口', { user: null, needsLogin: true, docs: [], apply: false }),

    fixture('review-queue', 'review', '实际workbench审核权限；待审列表；两种名片同意状态；长标题与分页', { ...review, docs: [authorized, noConsent], hasMore: true }),
    fixture('review-consented-materials', 'review', '授权审核者；展开长材料与审核决定；展示同意true可批准', { ...review, expandedId: authorized.id }),
    fixture('review-missing-consent', 'review', '展示同意false；展开审核；批准入口关闭；提示本人补充', { ...review, docs: [noConsent], expandedId: noConsent.id }),
    fixture('review-saving', 'review', '审核确认或写入busy；处理意见保留；各动作锁定', { ...review, docs: [{ ...authorized, reviewDraft: reviewNote }], expandedId: authorized.id, busy: true }),
    fixture('review-saved-read-error', 'review', '审核POST成功后GET失败；真实退回结果及说明保留；actions为空', { ...review, docs: [reviewRecord(950201, { status: 'returned', reviewNote, actions: {} })], expandedId: 950201, done: '已退回补充该申请', error: '合成网络错误：审核列表暂未刷新，请核对已保存结果。' }),
    fixture('review-empty', 'review', '授权范围内没有待审申请；明确空态', { ...review, docs: [] }),
    fixture('review-forbidden', 'review', '无当前审核权限；不借用本地平台角色；无受限资料', { allowed: false, needsLogin: false, docs: [] }),
    fixture('review-session-expired', 'review', '401会话失效；审核资料清空；登录入口', { allowed: false, needsLogin: true, docs: [] }),

    fixture('community-joins-progress', 'community-joins', '当前社群进群管理权限；意向、本人报告、待邀请、已进群、撤回各真实状态', { ...joins, docs: [requested, friend, invite, joined, join(950305, 'withdrawn', { memberName: '合成成员戊' })], hasMore: true }),
    fixture('community-joins-friend', 'community-joins', '本人报告好友申请后仍需管理员核实；展开长处理说明；可确认好友', { ...joins, docs: [{ ...friend, noteDraft: '合成人工核实说明：已到微信查看好友申请，通过与邀请均需人工实际完成。此处只用于验证处理说明的保留与自然换行，不对应任何真实联系人。' }], expandedId: friend.id }),
    fixture('community-joins-invite-busy', 'community-joins', '好友已核实后实际拉群确认；说明保留；busy锁定', { ...joins, docs: [{ ...invite, noteDraft: '合成说明：已人工核实对方进入微信群。' }], expandedId: invite.id, busy: true }),
    fixture('community-joins-saved-read-error', 'community-joins', '人工确认POST成功后GET失败；已进群回执只读保留', { ...joins, docs: [joined], done: '人工确认已保存', error: '合成网络错误：最新进群列表暂未读取，请刷新核对。' }),
    fixture('community-joins-empty', 'community-joins', '授权范围内没有进群意向；明确空态', joins),
    fixture('community-joins-forbidden', 'community-joins', '无此社群进群处理权限；平台角色不代替社群任职', { title: longGame, allowed: false, needsLogin: false, docs: [] }),
    fixture('community-joins-session-expired', 'community-joins', '401会话失效；进群资料清空；登录入口', { title: '合成游戏社群', allowed: false, needsLogin: true, docs: [] }),
  ];
}
