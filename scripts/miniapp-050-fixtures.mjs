/** Synthetic layout inputs only. Never import these fixtures into production content. */
export function stageAFixtures(rt, native, exists) {
  const projectionFile = native('lib/native-presentation.js');
  const format = rt.load(native('lib/format.js'));
  // The same inputs can map the immutable pre-change source for before/after evidence.
  const project = exists(projectionFile) ? rt.load(projectionFile).content : value => value;
  const user = { id: 900001, name: '合成预览用户', email: '', roles: ['member'], accountStatus: 'active' };
  const content = (id, title, collection = 'events', fields = {}) => project(format.card({
    id, collection, title, slug: 'synthetic-' + id,
    type: collection === 'events' ? '交流' : '社团通知', _status: 'published',
    publishedAt: '2026-10-14T08:00:00.000Z', createdAt: '2026-10-12T08:00:00.000Z',
    summary: '此条为合成内容，检查标题、时间与操作入口的排版，不代表真实安排。',
    startAt: collection === 'events' ? '2026-10-18T06:30:00.000Z' : null,
    endAt: collection === 'events' ? '2026-10-18T09:00:00.000Z' : null,
    channelText: collection === 'events' ? '合成报名说明，详情页查看' : '',
    location: '合成场地 · 校园活动空间', coverImage: null, ...fields,
  }, collection));
  const activity = content(900010, '合成活动：周末复盘与新成员组队交流');
  const longActivity = content(900012, '合成活动：一场围绕团队协作、战术复盘与新成员组队的长标题交流活动', 'events', {
    location: '合成场地名称很长时仍应完整显示：校园活动空间东侧会议区',
    summary: '合成长文：这段说明用于检查窄屏的行距、段落宽度与动作区是否清楚。参与方式和地点都应从真实发布的内容中读取。',
    startAt: '2026-10-17T18:30:00.000Z', endAt: '2026-10-17T21:00:00.000Z',
    registrationEnd: '2026-10-17T12:00:00.000Z',
  });
  const undatedActivity = content(900013, '合成活动：时间尚未公布的交流安排', 'events', {
    startAt: null, endAt: null, channelText: '', location: '',
  });
  const notice = content(900002, '合成通知：活动报名与参与说明', 'announcements');
  const site = {
    name: '竞在紫荆', heroTitle: '同场相逢，\n并肩而行。',
    heroSubtitle: '从一场活动、一个社群开始，记录赛场与日常。此处为合成排版预览。',
    footer: '合成内容预览 · 无生产写入', description: '此处仅使用合成资料检验版式。', navigation: [],
  };
  const home = {
    loading: false, error: '', user, hero: null, site,
    announcements: [notice],
    modules: [
      { kind: 'events', title: '近期活动', docs: [activity, longActivity, undatedActivity] },
      { kind: 'news', title: '社团近况', docs: [content(900014, '合成记录：一次团队交流的共同回忆', 'news')] },
    ],
    showJoin: true, showAbout: true, staffBatches: [], promotions: { event: [], notice: [], showcase: [] }, clubError: '',
  };
  const events = {
    loading: false, error: '', mode: 'events', types: ['全部', '比赛', '观赛', '交流', '训练', '其他'],
    type: '全部', search: '', docs: [activity, longActivity, undatedActivity], page: 1,
    hasMore: true, loadingMore: false, promoted: [], clubError: '',
  };
  // Deliberately non-scannable text image. No genuine photo, QR, or contact identifier.
  const placeholder = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="0 0 560 560"><rect width="560" height="560" fill="#f1e7ef"/><rect x="30" y="30" width="500" height="500" rx="24" fill="none" stroke="#6f2d67" stroke-width="2"/><text x="280" y="265" text-anchor="middle" fill="#6f2d67" font-family="sans-serif" font-size="36">合成布局图片</text><text x="280" y="315" text-anchor="middle" fill="#62626a" font-family="sans-serif" font-size="26">非微信名片 · 无二维码</text></svg>');
  const mediaActivity = { ...activity, coverImage: { url: placeholder, alt: '合成媒体占位，无真实照片或二维码' } };
  const community = {
    loading: false, needsLogin: false, error: '',
    game: { id: 900011, slug: 'synthetic-game', title: '合成游戏社群', summary: '本地合成社群，用于检查联系、加入意向与人工进群回执。' },
    nodes: [], introOpen: false, area: 'contacts', contacts: [], contactsLoading: false, contactsError: '',
    join: { id: 900101, status: 'friendReported', statusText: '已报告发送好友申请，待管理员确认', note: '合成回执：管理员会根据微信中的实际情况核实。', confirmedText: '' },
    joinActions: { request: false, reportFriend: false, withdraw: true },
    joinLoading: false, joinBusy: false, joinError: '', joinDone: '', canHandle: false,
    staffBatches: [], promotions: [], clubLoading: false, clubError: '',
    docs: [], page: 1, hasMore: false, loadingMore: false, contentError: '', honorPins: [], honorsLoading: false, honorsError: '',
  };
  const fixture = (name, page, state, data) => ({ name, page, state, data });
  return [
    fixture('home-populated', 'home', '已登录；保留CMS模块顺序；活动重点、长标题与未定时间', home),
    fixture('home-media', 'home', 'CMS活动有封面；仅用无二维码的合成图片占位', { ...home, modules: [{ kind: 'events', title: '近期活动', docs: [mediaActivity, longActivity] }] }),
    fixture('home-empty', 'home', '匿名；活动与通知为空；只显示已有公开入口', { ...home, user: null, announcements: [], modules: [{ kind: 'events', title: '近期活动', docs: [] }], showJoin: false, showAbout: false }),
    fixture('home-loading', 'home', '首页首次读取，尚无内容', { ...home, loading: true, user: null, modules: [], announcements: [] }),
    fixture('home-error', 'home', '首页读取失败，可重试；未编造活动', { ...home, error: '合成网络错误：暂时无法读取首页，请重试。', modules: [], announcements: [] }),
    fixture('home-partial-error', 'home', '部分CMS模块与推荐失败；已读活动和通知仍可见', { ...home,
      modules: [home.modules[0], { kind: 'news', title: '社团近况', docs: [], error: '合成读取失败：这个栏目稍后可重试。' }],
      clubError: '合成读取失败：招新与社群推荐暂不可用。',
    }),
    fixture('events-populated', 'events', '日程、长标题、无活动日期；显示分页入口', events),
    fixture('events-media', 'events', 'CMS活动有封面；其余活动无图片', { ...events, docs: [mediaActivity, undatedActivity], hasMore: false }),
    fixture('events-empty', 'events', '搜索无结果，保留输入与筛选', { ...events, search: '合成不存在关键词', type: '训练', docs: [], hasMore: false }),
    fixture('events-loading', 'events', '活动列表首次读取', { ...events, loading: true, docs: [], hasMore: false }),
    fixture('events-error', 'events', '活动读取失败，保留搜索字段', { ...events, search: '合成搜索词', error: '合成网络错误：读取失败，请稍后重试。', docs: [], hasMore: false }),
    fixture('events-announcements', 'events', '通知模式；长标题，无报名状态', { ...events, mode: 'announcements', docs: [notice, content(900003, '合成通知：跨越多行的长标题用于核对窄屏信息层级与完整阅读路径', 'announcements')], hasMore: false }),
    fixture('community-contact', 'community', '无授权名片；好友申请已报告，等待人工确认', community),
    fixture('community-read-errors', 'community', '进度和名片读取失败；分别重试，不冒充空结果', { ...community,
      join: null, joinActions: {}, joinError: '合成弱网：进度暂未读取，请刷新核对。',
      contactsError: '合成弱网：授权名片暂时无法读取，请重试。',
    }),
    fixture('community-awaiting-invite', 'community', '已人工核实好友；仍等待管理员在微信邀请入群', { ...community,
      join: { id: 900101, status: 'awaitingInvite', statusText: '管理员已核实好友申请，等待人工邀请入群', note: '', confirmedText: '' },
    }),
    fixture('community-request', 'community', '合成授权图片占位；尚无加入意向；长社群名称', { ...community,
      game: { ...community.game, title: '合成长名称游戏项目社群与共同训练交流空间' },
      contacts: [{ id: 900201, name: '合成管理员', image: placeholder }], join: null,
      joinActions: { request: true, reportFriend: false, withdraw: false },
    }),
    fixture('community-requested', 'community', '已记录联系意向；可报告好友申请；处理中禁止重复', { ...community,
      contacts: [{ id: 900201, name: '合成管理员', image: '' }],
      join: { id: 900101, status: 'requested', statusText: '已记录加入意向', note: '', confirmedText: '' },
      joinActions: { request: false, reportFriend: true, withdraw: true }, joinBusy: true,
    }),
    fixture('community-joined', 'community', '已由人工确认入群；管理入口来自既有权限字段', { ...community,
      join: { id: 900101, status: 'joined', statusText: '管理员已确认进群', note: '合成说明：以微信中的实际成员状态为准。', confirmedAt: '2026-10-14T08:00:00.000Z', confirmedText: '2026年10月14日' },
      joinActions: { request: false, reportFriend: false, withdraw: false }, canHandle: true,
    }),
    fixture('community-login', 'community', '未登录，遵循现有访问限制', { ...community, needsLogin: true }),
    fixture('community-loading', 'community', '社群首次读取，无业务状态', { ...community, loading: true, join: null }),
    fixture('community-error', 'community', '社群读取失败，可重试', { ...community, error: '合成网络错误：暂时无法读取该社群。' }),
    fixture('community-updates', 'community', '社群活动与通知；长内容；加载更多', { ...community, area: 'updates', hasMore: true, docs: [
      { ...activity, category: 'event', body: '合成活动正文：从一次交流开始，活动详情与报名入口延续现有路由。', authorName: '合成发布者' },
      { ...notice, category: 'notice', body: '合成通知正文：此处测试社群内公开动态，不读取真实私人资料。', authorName: '' },
    ] }),
    fixture('community-showcase', 'community', '社群风采和公开荣誉无结果', { ...community, area: 'showcase', docs: [], honorPins: [] }),
  ].map(fixture => fixture.page === 'community' ? { ...fixture, data: {
    ...fixture.data,
    contactAvailable: Boolean((fixture.data.contacts || []).some(contact => contact.image && !contact.imageError)),
  } } : fixture);
}
