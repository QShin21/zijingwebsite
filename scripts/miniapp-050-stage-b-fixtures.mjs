// Isolated synthetic examples. No production records, real contacts or external media.
import { stageAFixtures } from './miniapp-050-fixtures.mjs';

export function stageBFixtures(rt, native, exists) {
  const format = rt.load(native('lib/format.js'));
  const richtext = rt.load(native('lib/richtext.js'));
  const reading = exists(native('lib/native-reading.js')) ? rt.load(native('lib/native-reading.js')) : {
    entry: value => value, article: () => ({}), prose: value => value, catalog: collection => ({ title: collection, intro: '', resultTitle: '' }),
  };
  const user = { id: 900001, name: '合成预览用户', roles: ['member'], accountStatus: 'active' };
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#30262e"/><path d="M-80 520 400 40h570v360L770 600H0" fill="#6f2d67"/><path d="m60 600 400-400h420M280 600l400-400M460 200v400M0 450h960" fill="none" stroke="#d2a4cd" stroke-width="3"/><circle cx="555" cy="360" r="120" fill="none" stroke="#d2a4cd" stroke-width="3"/><path d="M680 40h190v110" fill="none" stroke="#fffdf9" stroke-width="14"/><text x="48" y="70" font-family="sans-serif" font-size="28" fill="#fffdf9">合成媒体 · 非真实活动</text><text x="48" y="550" font-family="sans-serif" font-size="20" fill="#fffdf9">仅用于有图布局核对 / 无照片、二维码与私人资料</text></svg>';
  const image = { url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), alt: '合成场地图形，不是真实活动照片', credit: '本地合成布局素材' };
  const text = value => ({ type: 'text', text: value, format: 0 });
  const body = { root: { type: 'root', children: [
    { type: 'paragraph', children: [text('这是一份明确标注的合成阅读材料，用于核对手机上的正文、标题、引用和列表。它不描述真实的社团活动或成员。')] },
    { type: 'heading', tag: 'h2', children: [text('从共同兴趣开始')] },
    { type: 'paragraph', children: [text('长段落应当自然换行，保留舒适的阅读宽度与行距。'), { ...text('重要信息以清楚的文字呈现。'), format: 1 }] },
    { type: 'quote', children: [text('合成引用：活动安排、参与条件与公开资料以实际发布内容为准。')] },
    { type: 'list', listType: 'bullet', children: [
      { type: 'listitem', children: [text('阅读已经发布的活动说明。')] },
      { type: 'listitem', children: [text('按照现有入口查看报名方式或本人回执。')] },
    ] },
    { type: 'paragraph', children: [{ type: 'link', fields: { url: 'https://example.invalid/synthetic-reading' }, children: [text('合成参考链接')] }] },
  ] } };
  const rendered = richtext.render(body);
  const nodes = reading.prose(rendered.nodes);
  const doc = (id, title, collection, extra = {}) => reading.entry(format.card({
    id, title, slug: 'synthetic-' + id, _status: 'published',
    summary: '合成展示资料，用于核对信息主次、长标题和手机阅读，不代表真实社团内容。',
    publishedAt: '2026-10-12T08:00:00.000Z', coverImage: null, ...extra,
  }, collection));
  const fixture = (name, page, state, data) => ({ name, page, state, data });
  const game = doc(900011, '合成游戏项目', 'games', { coverImage: image });
  const longGame = doc(900012, '合成项目：长名称社群与共同训练交流空间', 'games');
  const communities = { loading: false, error: '', needsLogin: false, user, docs: [game, longGame], search: '', appliedSearch: '', page: 1, hasMore: true, clubLoading: false, clubError: '', staffBatches: [], promotions: [] };
  const account = { user, initial: '合', role: '社团成员', error: '', refreshing: false, reviewCommunity: false, reviewStaff: false };
  const records = {
    news: [doc(900021, '合成记录：在同一片主场留下共同回忆', 'news', { coverImage: image }), doc(900022, '合成记录：跨越多行的长标题与赛后交流笔记', 'news')],
    announcements: [doc(900023, '合成通知：阅读与参与说明', 'announcements')],
    teams: [doc(900024, '合成代表队', 'teams', { game, coverImage: image }), doc(900025, '合成队伍：训练与公开资料', 'teams', { game: longGame })],
    honors: [doc(900026, '合成荣誉：一份公开成果档案', 'honors', { game, date: '2026-10-01T08:00:00.000Z', competition: '合成比赛', division: '合成组别', placing: '合成成果说明', verified: true }), doc(900027, '合成荣誉：赛事日期未公布', 'honors', { verified: true, createdAt: '2026-10-12T08:00:00Z' })],
    albums: [doc(900028, '合成相册：共同经历的影像记录', 'albums', { coverImage: image }), doc(900029, '合成相册：尚无封面', 'albums')],
    recruitment: [doc(900030, '合成招新：参与条件与安排', 'recruitment', { kind: 'members', registrationURL: 'https://example.invalid/synthetic-recruitment', registrationEnd: '2030-10-25T12:00:00Z', coverImage: image }), doc(900031, '合成代表队选拔批次', 'recruitment', { kind: 'teams', channelText: '合成渠道说明', registrationClosed: true })],
    seasons: [doc(900032, '合成赛季阵容', 'seasons', { game })],
    games: [game, longGame],
    pages: [doc(900033, '合成社团资料', 'pages')],
    events: [doc(900034, '合成活动：一起回看精彩比赛', 'events', { startAt: '2030-10-18T11:30:00Z', endAt: '2030-10-18T14:00:00Z', type: '交流', location: '合成地点', coverImage: image })],
  };
  const list = (collection, extra = {}) => ({ loading: false, loadingMore: false, loadMoreError: '', error: '', needsLogin: false,
    collection, title: reading.catalog(collection).title, catalog: reading.catalog(collection), docs: records[collection] || [],
    search: '', page: 1, hasMore: false, years: ['全部年份', '2026', '2025'], year: '全部年份', yearIndex: 0,
    kinds: ['全部', '普通社员', '代表队选拔', '骨干招新'], kind: '全部', games: [{ id: '', title: '全部项目' }, game], gameIndex: 0, ...extra,
  });
  const article = (collection, extra = {}) => {
    const source = { ...(records[collection]?.[0] || doc(900040, '合成阅读详情', collection)), body, ...extra };
    return { loading: false, error: '', needsLogin: false, user, collection, doc: source, reading: reading.article(source, collection),
      nodes, links: rendered.links, photos: [], related: [], previewImages: [], registration: '', coverImage: source.coverImage,
      qr: null, social: false, dateText: reading.article(source, collection).dateText || format.date(source.startAt || source.date || source.publishedAt), endDateText: source.endAt ? format.date(source.endAt) : '',
      registrationStartText: '', registrationEndText: '', signupInfo: null, signupFailed: false, signupStartText: '', signupEndText: '', videoSource: '', videoError: false,
    };
  };
  const fixed = (key, extra = {}) => {
    const source = { id: 900050, title: '合成社团介绍', summary: '合成资料：了解社团与公开参与方式。', publishedAt: '2026-10-12T08:00:00Z', body };
    return { loading: false, error: '', needsLogin: false, key, title: { about: '关于紫荆', contact: '联系我们', privacy: '隐私说明', join: '加入紫荆', 'join-members': '普通社员', 'join-teams': '代表队选拔', 'join-staff': '骨干招新' }[key],
      isJoin: key.startsWith('join'), doc: source, reading: reading.article(source, 'pages'), nodes, links: rendered.links, coverImage: null, contacts: [], batches: [], ...extra,
    };
  };
  const a = stageAFixtures(rt, native, exists);
  const aData = name => a.find(item => item.name === name).data;
  const home = aData('home-populated'), community = aData('community-contact');
  const withImage = { ...home, hero: image, modules: [{ kind: 'events', title: '近期活动', docs: records.events }] };
  return [
    fixture('communities-populated', 'communities', '项目目录；一项合成封面、一项无封面；分页', communities),
    fixture('communities-empty', 'communities', '搜索无结果，保留搜索入口', { ...communities, docs: [], hasMore: false, search: '合成查询', appliedSearch: '合成查询' }),
    fixture('communities-login', 'communities', '未登录，保留现有访问限制', { ...communities, user: null, needsLogin: true, docs: [] }),
    fixture('communities-error', 'communities', '读取失败，显示重试', { ...communities, error: '合成弱网：项目目录暂未读取。', docs: [] }),
    fixture('communities-loading', 'communities', '首次读取项目目录', { ...communities, loading: true, docs: [] }),
    fixture('communities-image-error', 'communities', '原生封面错误后的可见占位；原URL与记录保留', { ...communities, docs: [{ ...game, nativeCoverError: true }, longGame] }),
    fixture('explore-populated', 'explore', '队伍、荣誉与日常档案入口；无虚构统计', { user, needsLogin: false }),
    fixture('explore-login', 'explore', '未登录时遵循现有访问限制', { user: null, needsLogin: true }),
    fixture('account-member', 'account', '普通成员；本人记录分类入口', account),
    fixture('account-login', 'account', '未登录；登录与公开设置', { ...account, user: null, initial: 'Z', role: '' }),
    fixture('account-manager', 'account', '管理入口仅来自实际workbench能力字段', { ...account, reviewCommunity: true, reviewStaff: true }),
    fixture('account-error', 'account', '账号刷新失败；原身份仍可见', { ...account, error: '合成弱网：账户信息尚未刷新。' }),
    ...Object.keys(records).map(collection => fixture('list-' + collection, 'list', '栏目 ' + collection + '；真实投影函数与合成资料', list(collection))),
    fixture('list-showcase', 'list', '已审批社群展示保留来源和原文入口', list('club-showcase', { docs: [{ id: 900060, sourceKey: 'community-showcase:900060', href: '/community/synthetic/showcase/900060', gameTitle: '合成社群', snapshot: { title: '合成社群风采', summary: '合成已审批展示资料。', gameTitle: '合成社群' }, kindText: '社群风采' }] })),
    fixture('list-empty', 'list', '荣誉筛选无结果，显示清除条件', list('honors', { docs: [], search: '合成查询', year: '2025', yearIndex: 2, gameIndex: 1 })),
    fixture('list-loading', 'list', '首次读取栏目', list('news', { loading: true, docs: [] })),
    fixture('list-error', 'list', '栏目读取失败', list('news', { error: '合成弱网：内容暂未读取。', docs: [] })),
    fixture('list-login', 'list', '会话失效，清空受限资料', list('news', { needsLogin: true, docs: [] })),
    fixture('list-pagination-error', 'list', '下一页失败，第一页保留并可重试', list('news', { hasMore: true, loadMoreError: '合成第二页读取失败，请重试。' })),
    fixture('list-image-error', 'list', '合成封面原生错误后保留阅读入口', list('albums', { docs: [{ ...records.albums[0], nativeCoverError: true }, records.albums[1]] })),
    fixture('detail-reading', 'detail', '有封面阅读；嵌套标题、正文、引用与列表', article('news')),
    fixture('detail-reading-no-cover', 'detail', '普通文章无封面；长正文仍保持阅读层次', article('news', { coverImage: null })),
    fixture('detail-signup', 'detail', '真实报名API字段；可填写问卷，不伪造本人报名', { ...article('events'), signupInfo: { form: { enabled: true }, state: '报名开放', signup: null }, signupStartText: '2030.10.10 12:00', signupEndText: '2030.10.17 18:00' }),
    fixture('detail-signup-error', 'detail', '报名状态失败，明确进入报名页重新查询', { ...article('events'), signupFailed: true }),
    fixture('detail-signup-receipt', 'detail', '已存在本人报名回执，动作指向原生报名页', { ...article('events'), signupInfo: { form: { enabled: true }, state: '报名开放', signup: { id: 900071 } } }),
    fixture('detail-signup-manage', 'detail', '只有名单查看能力，保留原生管理入口', { ...article('events'), signupInfo: { form: { enabled: false }, canViewSignups: true, canManage: false } }),
    fixture('detail-team', 'detail', '队伍档案与既有原生成员、荣誉入口', { ...article('teams'), related: [records.seasons[0], records.honors[0]] }),
    fixture('detail-honor', 'detail', '赛事日期与成果，不借用发布时间', article('honors')),
    fixture('detail-album', 'detail', '相册图片、图注与来源；仅合成图片', { ...article('albums'), photos: [{ ...image, caption: '合成图片说明' }], previewImages: [image.url] }),
    fixture('detail-media-error', 'detail', '封面与图片原生损坏后保留图注及重试', { ...article('albums'), coverImageFailed: true, photos: [{ ...image, caption: '合成损坏图片说明', failed: true }] }),
    fixture('detail-social', 'detail', '社群原文与合成图片；视频仅映射尺寸和控件，不加载资源', { ...article('community-showcase', { title: '合成社群风采', body: '合成社群原文。现有原生正文、照片说明与视频入口仍保留。', videoURL: '/synthetic/video.mp4' }), social: true, nodes: [], photos: [{ ...image, caption: '合成社群图片' }], videoSource: 'https://example.invalid/synthetic-video.mp4' }),
    fixture('detail-recruitment', 'detail', '公开报名渠道与真实截止字段', { ...article('recruitment'), registration: '报名开放', registrationEndText: '2030.10.25 20:00' }),
    fixture('detail-recruitment-positions', 'detail', '合成岗位条件、公开渠道和无可扫码信息的图片占位', { ...article('recruitment', { requirements: '合成参与条件：请阅读岗位安排与时间投入。', positions: [{ name: '合成岗位', duties: '合成职责说明，用于核对长行的阅读层次。', requirements: '合成岗位要求', commitment: '合成时间投入说明', arrangement: '合成安排说明' }] }), registration: '报名开放', qr: image }),
    fixture('detail-recruitment-qr-error', 'detail', '公开报名图片原生损坏后显示重试，保留文字渠道', { ...article('recruitment'), registration: '报名开放', qr: image, qrFailed: true }),
    fixture('detail-season', 'detail', '历史公开阵容，与当前成员关系分开', article('seasons', { members: [{ displayName: '合成成员甲', position: '合成位置' }, { displayName: '合成成员乙', position: '' }] })),
    fixture('detail-loading', 'detail', '详情首次读取', { ...article('news'), loading: true, doc: {}, nodes: [], coverImage: null }),
    fixture('detail-error', 'detail', '详情读取失败', { ...article('news'), error: '合成弱网：正文暂未读取。', doc: {}, nodes: [], coverImage: null }),
    fixture('detail-login', 'detail', '未登录，受限正文已清空', { ...article('news'), needsLogin: true, doc: {}, nodes: [], coverImage: null }),
    ...['about', 'contact', 'privacy', 'join', 'join-members', 'join-teams', 'join-staff'].map(key => fixture('fixed-' + key, 'fixed', '固定内容 ' + key + '；合成正文与现有入口', fixed(key, key.startsWith('join') ? { batches: records.recruitment } : key === 'contact' ? { contacts: [{ label: '合成公开说明', text: '此处没有真实联系方式。' }] } : {}))),
    fixture('fixed-cover-error', 'fixed', '固定正文损坏封面，保留来源与重试', fixed('about', { coverImage: image, coverImageFailed: true })),
    fixture('fixed-empty', 'fixed', '暂无固定正文，保留明确空态', fixed('about', { doc: null, nodes: [], links: [], coverImage: null })),
    fixture('fixed-error', 'fixed', '固定正文读取失败，可重试', fixed('about', { error: '合成弱网：资料暂未读取。', doc: null, nodes: [] })),
    fixture('fixed-login', 'fixed', '受限固定页未登录，正文清空', fixed('about', { needsLogin: true, doc: null, nodes: [] })),
    fixture('home-hero-media', 'home', '站点头图和重点活动封面；仅合成媒体', withImage),
    fixture('home-no-media', 'home', '没有授权媒体时使用克制品牌图形', home),
    fixture('home-hero-error', 'home', '站点头图原生失败后的可见占位', { ...withImage, heroErrorURL: image.url }),
    fixture('home-cover-error', 'home', '活动封面失败后仍可阅读标题与详情', { ...home, modules: [{ kind: 'events', title: '近期活动', docs: [{ ...records.events[0], nativeCoverError: true }] }] }),
    fixture('community-no-card', 'community', '无授权名片，解释当前状态并降低CTA层级', { ...community, contactAvailable: false }),
    fixture('community-card-error', 'community', '名片原生加载失败，不能冒充可联系', { ...community, contacts: [{ id: 900201, name: '合成管理员', image: image.url, imageError: true }], contactAvailable: false }),
    fixture('events-pagination-error', 'events', '下一页失败保留已加载活动；重试同一页', { ...aData('events-populated'), hasMore: true, loadMoreError: '合成第二页读取失败，请重试。' }),
  ];
}
