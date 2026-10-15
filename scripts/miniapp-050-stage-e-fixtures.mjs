// Synthetic WXML states only. No lifecycle, business events, network, or native SDK.
// Keep all A–D cases intact; add only states that existing WXML can actually show.
import { stageAFixtures } from './miniapp-050-fixtures.mjs';
import { stageBFixtures } from './miniapp-050-stage-b-fixtures.mjs';
import { stageCFixtures } from './miniapp-050-stage-c-fixtures.mjs';
import { stageDFixtures } from './miniapp-050-stage-d-fixtures.mjs';

export function stageEFixtures(rt, native, exists) {
  const previous = [
    ...stageAFixtures(rt, native, exists),
    ...stageBFixtures(rt, native, exists),
    ...stageCFixtures(rt, native, exists),
    ...stageDFixtures(rt, native, exists),
  ];
  const added = [], byName = new Map(previous.map(value => [value.name, value]));
  const data = name => {
    const value = byName.get(name);
    if (!value) throw new Error('Unknown stage E source fixture: ' + name);
    return value.data;
  };
  const add = (name, page, state, value) => {
    const fixture = { name: 'e-' + name, page, state: '合成 / E适用状态 / ' + state, data: value };
    if (byName.has(fixture.name)) throw new Error('Duplicate stage E fixture: ' + fixture.name);
    added.push(fixture); byName.set(fixture.name, fixture);
  };
  const variant = (name, source, state, patch) => add(name, byName.get(source).page, state, { ...data(source), ...patch });
  const initial = (name, page, state, patch) => add(name, page, state, { ...rt.page(page), loading: false, error: '', needsLogin: false, ...patch });
  const readError = '合成弱网：当前内容尚未读取，请重新加载核对。';
  const reading = rt.load(native('lib/native-reading.js'));
  const publicCollections = ['events', 'announcements', 'pages'];

  variant('home-anonymous-content', 'home-populated', '匿名首页有公开活动与长内容；没有私人身份', { user: null });
  variant('account-refreshing', 'account-member', 'refreshing状态实际显示正在核对账号与管理权限', { refreshing: true, reviewCommunity: false, reviewStaff: false });
  variant('account-long-name', 'account-member', '合成长昵称自然换行；无真实个人资料', { user: { ...data('account-member').user, name: '合成昵称：与队友一起参与训练和共同记录' } });
  for (const [name, patch, state] of [
    ['loading', { loading: true, docs: [] }, '通知模式首次读取'],
    ['empty', { docs: [], search: '合成无匹配通知' }, '通知模式搜索无结果'],
    ['error', { docs: [], error: readError }, '通知模式读取失败'],
    ['pagination', { hasMore: true, loadingMore: true }, '通知模式加载更多中，已读内容保留'],
    ['pagination-error', { hasMore: true, loadMoreError: readError }, '通知模式后续分页失败，保留第一页'],
  ]) variant('events-announcements-' + name, 'events-announcements', state, patch);
  variant('events-pagination-loading', 'events-populated', '活动分页读取中；入口锁定', { loadingMore: true });
  variant('events-recommendation-error', 'events-populated', '活动可读，社群推荐单独读取失败', { clubError: readError });
  variant('communities-no-published', 'communities-empty', '没有已开放社群；不同于搜索无结果文案', { search: '', appliedSearch: '' });
  variant('communities-pagination-loading', 'communities-populated', '后续社群页在途，已有列表保留', { loading: true });
  variant('communities-recommendation-error', 'communities-populated', '已读目录保留，招新与推荐单独失败', { clubError: readError });

  // List headers, filters and empty bodies differ by collection. Public collections
  // have no initial login barrier; private collections exercise needsLogin.
  const listSources = previous.filter(value => value.page === 'list' && /^list-(news|announcements|teams|honors|albums|recruitment|seasons|games|pages|events|showcase)$/.test(value.name));
  for (const source of listSources) {
    const collection = source.data.collection;
    const matching = previous.filter(value => value.page === 'list' && value.data.collection === collection);
    const vacant = { docs: [], hasMore: false, loadingMore: false, loadMoreError: '' };
    if (!matching.some(value => !value.data.loading && !value.data.error && !value.data.needsLogin && !value.data.docs.length))
      variant('list-' + collection + '-empty', source.name, collection + ' 无已读记录；保留本栏目筛选', vacant);
    if (!matching.some(value => value.data.loading))
      variant('list-' + collection + '-loading', source.name, collection + ' 首次读取；本栏目标题与筛选仍可见', { ...vacant, loading: true });
    if (!matching.some(value => value.data.error))
      variant('list-' + collection + '-error', source.name, collection + ' 首次读取失败', { ...vacant, error: readError });
    if (!publicCollections.includes(collection) && !matching.some(value => value.data.needsLogin))
      variant('list-' + collection + '-login', source.name, collection + ' 未登录或会话失效，记录已清空', { ...vacant, needsLogin: true });
  }
  variant('list-pagination-loading', 'list-news', '已加载栏目内容，下一页正在读取', { hasMore: true, loadingMore: true });
  for (const kind of ['普通社员', '代表队选拔', '骨干招新'])
    variant('list-recruitment-' + ({ 普通社员: 'members', 代表队选拔: 'teams', 骨干招新: 'staff' }[kind]), 'list-recruitment', '招新分类已选中：' + kind, { kind, docs: [], hasMore: false });

  // Detail feedback hides the whole collection-specific body. The existing
  // detail-loading/error/login cases cover that shared visible branch; missing
  // content kinds below exercise their actual successful reading bodies.
  for (const collection of ['announcements', 'games', 'pages']) {
    const source = data('detail-reading-no-cover');
    const doc = { ...source.doc, collection, kindText: '', title: '合成' + reading.catalog(collection).title + '：跨越多行的公开说明与参与安排' };
    const article = reading.article(doc, collection);
    add('detail-' + collection, 'detail', collection + ' 正常长正文；真实阅读投影', { ...source, collection, doc, reading: article, dateText: article.dateText });
  }
  for (const category of ['event', 'notice']) {
    const source = data('detail-social');
    const doc = { ...source.doc, collection: 'community-posts', category, kindText: category === 'event' ? '社群活动' : '社群通知',
      title: category === 'event' ? '合成社群活动：共同训练与报名安排' : '合成社群通知：成员交流与日常安排',
      body: '合成社群原文：只核对现有详情、长文本与报名入口。没有真实活动、账号或联系方式。'.repeat(3), videoURL: '' };
    const article = reading.article(doc, 'community-posts');
    add('detail-community-' + category, 'detail', 'community-posts / ' + category + '；保持社群正文与真实报名能力字段', {
      ...source, collection: 'community-posts', doc, reading: article, dateText: article.dateText, photos: [], videoSource: '',
      signupInfo: category === 'event' ? { form: { enabled: true }, state: '报名开放', signup: null, canManage: false, canViewSignups: false } : null,
    });
  }
  variant('detail-community-event-signup-error', 'e-detail-community-event', '社群活动正文可读，报名状态单独失败', { signupInfo: null, signupFailed: true });
  variant('detail-community-event-viewer', 'e-detail-community-event', '社群活动仅名单查看能力，保留原生入口', { signupInfo: { form: { enabled: false }, canManage: false, canViewSignups: true } });

  // Fixed headings remain visible while loading/empty/error; privacy is public.
  for (const key of ['about', 'contact', 'privacy', 'join', 'join-members', 'join-teams', 'join-staff']) {
    const source = 'fixed-' + key, cleared = { doc: null, nodes: [], links: [], coverImage: null, contacts: [], batches: [] };
    variant('fixed-' + key + '-loading', source, key + ' 首次读取；不保留旧正文', { ...cleared, loading: true });
    if (key !== 'about') {
      variant('fixed-' + key + '-empty', source, key + ' 无已发布正文、联系说明或相关批次', cleared);
      variant('fixed-' + key + '-error', source, key + ' 首次读取失败', { ...cleared, error: readError });
      if (key !== 'privacy') variant('fixed-' + key + '-login', source, key + ' 未登录；受限资料清空', { ...cleared, needsLogin: true });
    }
  }

  for (const area of ['updates', 'showcase']) {
    const source = area === 'updates' ? 'community-updates' : 'community-showcase';
    for (const [state, patch] of [
      ['loading', { loading: true }], ['error', { loading: false, error: readError }], ['login', { loading: false, needsLogin: true }],
    ]) variant('community-' + area + '-' + state, source, area + ' 首次读取或受限资料已清空 / ' + state, {
      ...patch, game: {}, docs: [], nodes: [], contacts: [], join: null, joinActions: {}, honorPins: [], canHandle: false, hasMore: false,
    });
    variant('community-' + area + '-content-loading', source, area + ' 局部内容读取中', { loadingMore: true });
    variant('community-' + area + '-content-error', source, area + ' 局部内容失败；独立重试', { contentError: readError });
  }
  variant('community-updates-empty', 'community-updates', '社群近况为空；无活动或通知', { docs: [], hasMore: false });
  const social = data('e-detail-community-notice').doc;
  const showcaseDoc = { ...social, collection: 'community-showcase', title: '合成共同经历：团队交流与赛后复盘', dateText: '2026年10月15日', localImages: [], videoURL: '', videoSource: '' };
  variant('community-showcase-content', 'community-showcase', '社群风采有长正文与已公开荣誉摘要', {
    docs: [showcaseDoc], honorPins: [{ id: 900051, title: '合成代表队', count: 2, latestTitle: '合成公开成果', latestDate: '2026-10-12' }],
  });
  variant('community-showcase-honors-loading', 'community-showcase', '荣誉索引正在读取；无假空态结论', { honorsLoading: true });
  variant('community-showcase-honors-error', 'community-showcase', '荣誉索引失败，内容仍独立可读', { honorsError: readError });
  variant('community-contacts-loading', 'community-contact', '授权名片与已有进群进度分别更新', { contactsLoading: true, joinLoading: true });
  variant('community-introduction-long', 'community-contact', '展开社群介绍；复用真实富文本投影与合成正文', { introOpen: true, nodes: data('detail-reading').nodes });

  // Auth has busy/sent instead of list loading/empty. Success leaves the page
  // through native toast/navigation and cannot be certified by a static fixture.
  initial('auth-register-initial', 'auth', '注册未发送验证码，空字段', { mode: 'register' });
  initial('auth-reset-initial', 'auth', '重设密码未发送验证码，空字段', { mode: 'reset' });
  initial('auth-reset-sent', 'auth', '重设密码已发送合成验证码，倒计时与回执', { mode: 'reset', email: 'synthetic@example.invalid', sent: true, countdown: 38 });
  initial('auth-reset-busy', 'auth', '重设密码在途，动作锁定', { mode: 'reset', email: 'synthetic@example.invalid', busy: true });
  initial('auth-login-busy', 'auth', '登录在途；保留合成输入并锁定操作', { identifier: 'synthetic@example.invalid', busy: true });

  for (const [page, source] of [['applications', 'applications-receipts'], ['review', 'review-queue'], ['community-joins', 'community-joins-progress']]) {
    initial(page + '-loading', page, '首次核对权限与记录；真实loading分支', { loading: true });
    initial(page + '-read-error', page, '首次读取失败；没有已确认写入或旧私人记录', { error: readError });
    variant(page + '-pagination-loading', source, '后续记录页读取中，原记录保留', { loading: true });
  }
  variant('applications-games-error', 'applications-new', '新申请社群选项读取失败；原表单保留', { games: [], gamesError: readError });
  variant('applications-image-busy', 'applications-qr-error', '主动读取合成名片中；图片与提交动作锁定', { qrFailed: false, imageBusy: true });
  variant('review-image-busy', 'review-consented-materials', '主动读取当前审核名片；操作锁定', { imageBusy: true });
  initial('activity-manage-login', 'activity-manage', '未登录，管理列表清空', { needsLogin: true });
  variant('activity-manage-events-loading', 'activity-manage-loading', '站点活动范围读取中', { kind: 'events' });
  variant('activity-manage-events-error', 'activity-manage-error', '站点活动范围读取失败', { kind: 'events' });
  variant('activity-manage-community-empty', 'activity-manage-empty', '社群活动范围没有可管理记录', { kind: 'community-posts' });
  variant('staff-own-loading', 'staff-member-receipts', '公开批次可读，本人申请独立刷新', { ownLoading: true });
  initial('staff-review-read-error', 'staff-review', '首次审核列表网络失败；无私人答卷', { error: readError });
  variant('staff-review-pagination-loading', 'staff-review-records', '审核列表翻页中；原筛选可见', { loading: true, docs: [], total: 0 });

  const signupScopes = [
    ['staff', { staff: true, team: false, applicationMode: true }],
    ['team', { staff: false, team: true, applicationMode: true }],
    ['manage', { staff: false, team: false, applicationMode: false, edit: true }],
  ];
  for (const [scope, flags] of signupScopes) {
    for (const [state, patch] of [
      ['loading', { loading: true }], ['error', { error: readError }], ['login', { needsLogin: true }],
    ]) initial('signup-' + scope + '-' + state, 'signup', scope + ' / ' + state + '；使用该范围实际标题', { ...flags, ...patch });
  }
  initial('signup-activity-error', 'signup', '活动报名首次读取失败；无旧答案或回执', { error: readError });
  for (const [name, enabled, state] of [['disabled', false, '未启用问卷报名'], ['before-open', true, '报名未开始'], ['closed-empty', true, '报名已结束']])
    variant('signup-' + name, 'signup-all-types', '活动问卷不可填写且本人尚无回执 / ' + state, {
      receipt: null, questions: [], answers: {}, form: { ...data('signup-all-types').form, enabled },
      info: { ...data('signup-all-types').info, state, canManage: false, canViewSignups: false },
    });
  variant('signup-entries-loading', 'signup-entries-viewer', '仅名单权限；名单请求在途，用busy显示真实读取提示', { busy: true });
  variant('signup-community-event', 'signup-all-types', 'community-posts活动报名与events共用填写界面；静态图不验证路由请求', {
    info: { ...data('signup-all-types').info, title: '合成社群活动：共同训练的问卷与报名' },
  });

  // Team views retain their own headings and empty messages while reading.
  for (const [view, source] of [
    ['recruitments', 'team-recruitments'], ['ownApplications', 'team-applications'],
    ['memberships', 'team-memberships'], ['managedTeams', 'team-managed'],
  ]) {
    const matching = previous.filter(value => value.page === 'team' && value.data.view === view);
    const cleared = { docs: [], total: 0, page: 1, hasMore: false, expandedRecord: null };
    if (!matching.some(value => !value.data.loading && !value.data.error && !value.data.needsLogin && !value.data.docs.length))
      variant('team-' + view + '-empty', source, view + ' 无当前记录', cleared);
    if (!matching.some(value => value.data.loading))
      variant('team-' + view + '-loading', source, view + ' 首次读取；保留当前模式介绍', { ...cleared, loading: true });
    if (!matching.some(value => value.data.error))
      variant('team-' + view + '-error', source, view + ' 首次读取失败', { ...cleared, error: readError });
  }
  // team needsLogin hides every view, so the original shared team-login suffices.
  for (const page of ['team-apply', 'team-members', 'team-profiles', 'team-honor-edit']) {
    initial(page + '-loading', page, '首次读取；当前资料尚未取得', { loading: true });
    initial(page + '-login', page, '会话失效；私有资料、操作与输入清空', { needsLogin: true });
    initial(page + '-read-error', page, '首次读取失败；重试核对当前状态', { error: readError });
  }
  for (const mode of ['join', 'establishment']) {
    initial('team-review-' + mode + '-login', 'team-review', mode + ' 会话失效，无答卷或操作', { mode, needsLogin: true });
    initial('team-review-' + mode + '-error', 'team-review', mode + ' 首次读取失败', { mode, error: readError });
    if (mode === 'establishment') {
      initial('team-review-establishment-loading', 'team-review', '建队审核首次核对权限', { mode, loading: true });
      initial('team-review-establishment-denied', 'team-review', '建队审核无当前权限', { mode, allowed: false });
      variant('team-review-establishment-empty', 'team-review-establishment', '有建队审核权，当前队列为空', { docs: [], expandedId: '' });
    }
  }
  variant('team-profiles-empty', 'team-profiles-roster', '本队没有主动选择公开的简介；保留本人资格与设置入口', { profiles: [] });
  variant('team-profiles-saving', 'team-profiles-preview-visible', '简介确认保存中，保留当前展示选择与锁定动作', { busy: true });
  variant('team-profiles-image-error', 'team-profiles-roster', '合成头像读取失败，昵称与正文仍可读', {
    profiles: data('team-profiles-roster').profiles.map(value => ({ ...value, avatarPath: '' })), imageError: '合成头像读取失败，可重新加载。',
  });

  for (const view of ['mine', 'review']) {
    for (const [state, patch] of [
      ['loading', { loading: true }], ['login', { needsLogin: true }], ['error', { error: readError }],
    ]) initial('team-honor-workspace-' + view + '-' + state, 'team-honor-workspace', view + ' / ' + state + '；当前证据和操作已清空', { view, ...patch });
  }
  variant('team-honor-workspace-review-empty', 'team-honor-workspace-review-evidence', '有审核能力，当前范围没有投稿', { docs: [], detail: null, detailImages: [], totalDocs: 0, totalPages: 0 });
  variant('team-honor-workspace-review-denied', 'team-honor-workspace-denied', '审核模式403；清理私有资料并保留真实模式标题', { view: 'review' });
  variant('team-honor-workspace-review-busy', 'team-honor-workspace-review-evidence', '审核确认或写入在途；当前证据保留且动作锁定', { busy: true });
  variant('team-honor-workspace-pagination', 'team-honor-workspace-mine', '本人记录有后续页，分页入口可见', { hasMore: true, totalPages: 2, totalDocs: 13 });
  variant('team-honor-workspace-evidence-error', 'team-honor-workspace-review-evidence', '本次证据读取失败；清空旧动作，保留文字材料', {
    ready: false, actions: {}, detailImages: [], imageError: '合成证据图片读取失败，请重新核对本修订。',
    docs: data('team-honor-workspace-review-evidence').docs.map(value => ({ ...value, actions: {}, decisions: [] })),
  });
  initial('team-honor-edit-no-team', 'team-honor-edit', '已读取但没有有效投稿队伍；新建输入保留，写入不可用', { ready: true });
  variant('team-honor-edit-uploading', 'team-honor-edit-upload-100', '视频传送45%；仍未保存，写入锁保持', { videoProgress: 45 });
  variant('team-honor-edit-media-error', 'team-honor-edit-returned-images', '合成图片失败与隐私授权未完成；原文字和回执保留', { imageError: '合成图片读取失败，请重新选择。', operationError: '合成隐私授权尚未完成，请主动重试。' });
  variant('team-honor-edit-saving', 'team-honor-edit-returned-images', '普通保存草稿中；既有输入与材料仍可读', { busy: true });
  return [...previous, ...added];
}
