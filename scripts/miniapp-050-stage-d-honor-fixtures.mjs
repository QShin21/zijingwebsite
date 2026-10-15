// Local synthetic layout states only. No production records, personal data or external media.
// Browser mapping is not the official WeChat compiler, DevTools, or device validation.
export function stageDHonorFixtures(rt, native, exists) {
  void exists;
  const flow = rt.load(native('lib/team-honor-workflow.js'));
  const archive = rt.load(native('lib/team-honor.js'));
  const profile = rt.load(native('lib/team-profile.js'));
  const fixture = (name, page, state, data) => ({ name, page, state: '合成 / ' + state, data });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#f2e6ef"/><path d="M90 70h780v460H90zM480 70v460" fill="none" stroke="#6f2d67" stroke-width="4"/><circle cx="480" cy="300" r="100" fill="none" stroke="#6f2d67" stroke-width="4"/><text x="120" y="150" font-family="sans-serif" font-size="34" fill="#51234c">合成材料 · 非真实证据</text><text x="120" y="485" font-family="sans-serif" font-size="24" fill="#51234c">仅核对原生图片、图注与操作布局</text></svg>';
  const image = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const team = { id: 900051, game: 900041, title: '合成代表队：共同训练与赛事交流', gameTitle: '合成游戏社群', gameSlug: 'synthetic-game' };
  const owner = { edit: true, save: true, submit: true, withdraw: true, hide: false, reviewActions: [] };
  const reviewer = { edit: false, save: false, submit: false, withdraw: false, hide: false, reviewActions: ['approve', 'return', 'reject'] };
  const record = (extra = {}) => flow.record({ id: 900031, revision: 3, state: 'returned', team: team.id, game: team.game, season: 900071,
    title: '合成赛事成果：并肩完成一场跨越多日的团队比赛', authorName: '合成投稿者', competition: '合成高校团队交流赛', placing: '合成组别 · 团体第二名', date: '2026-10-12',
    description: '合成成果说明：队伍共同完成训练与比赛，记录团队配合和赛场收获。此材料只用于本地界面核对，不代表真实比赛或成员。',
    reviewNote: '合成退回说明：请补充材料的赛事名称和日期，确认图片内容已获准公开。', images: [{ source: png, caption: '合成材料说明：赛事名称、日期与队伍成果，仅用于排版核对。' }],
    submittedVersion: 'a'.repeat(64), videoHref: null, actions: owner, ...extra });
  const returned = record();
  const pending = record({ state: 'pending', reviewNote: null, actions: reviewer });
  const approved = record({ state: 'approved', reviewNote: null, actions: { ...reviewer, reviewActions: [], hide: true } });
  const confirmed = record({ revision: 4, state: 'draft', title: '合成已确认保存的荣誉标题', reviewNote: null, actions: {} });
  const sourceRecord = { key: 'team-honor-records:900031', title: returned.title, competition: returned.competition, placing: returned.placing,
    date: returned.date, description: returned.description, authorName: returned.authorName, images: [], videoHref: '/api/team-honor-evidence/900031/video?version=' + 'b'.repeat(64), legacy: false };
  const publicRows = archive.archive({ team, records: [sourceRecord] }, team.id).records.map(value => ({ ...value, images: [], mediaLoading: false,
    archiveYear: value.dateText.slice(0, 4), archiveDate: value.dateText.slice(5).replace('-', '.'), localImages: [{ url: image, caption: '合成公开图片：不包含真实凭证、人员或照片。' }] }));
  const legacyRows = archive.archive({ team, records: [{ ...sourceRecord, key: 'honors:900099', title: '合成历史荣誉：往届队伍公开成果', date: '2025-06-18', legacy: true,
    videoHref: '', sourceHref: '/honors/synthetic-archive', authorName: '' }] }, team.id).records.map(value => ({ ...value, archiveYear: '2025', archiveDate: '06.18', mediaLoading: false }));
  const honors = { loading: false, loaded: true, error: '', needsLogin: false, team, records: publicRows, previewImages: [image] };
  const profileDraft = profile.display({ ...profile.empty(), displayName: '合成昵称：一起认真训练的队友', position: '合成位置 / 团队配合与赛后复盘',
    biography: '合成简介：希望和队友一起练习沟通，分享赛后复盘。\n只填写本人愿意展示的内容，没有真实姓名、学号或联系方式。', avatar: png, visible: false });
  const profiles = { loading: false, loaded: true, needsLogin: false, error: '', operationError: '', message: '', busy: false, eligible: true,
    editing: false, previewing: false, locked: false, conflict: false, confirmationPending: false, draft: profileDraft, draftAvatar: image, imageError: '',
    profiles: [{ id: 900081, displayName: '合成队友甲', position: '合成位置 / 战术协作', biography: '合成简介：喜欢复盘与共同训练，期待一起积累赛场经验。', avatarPath: image },
      { id: 900082, displayName: '合成队友乙：这是较长的公开昵称', position: '合成位置 / 队内沟通', biography: '合成简介：这里核对没有头像时，昵称、位置与长段落的阅读顺序。', avatarPath: '' }] };
  const workspace = { loading: false, ready: true, needsLogin: false, busy: false, error: '', operationError: '', message: '', view: 'mine',
    actions: { create: true, review: false }, teams: [team], docs: [flow.row(returned), flow.row(record({ id: 900032, state: 'draft', title: '合成草稿：下一份成果记录', reviewNote: null, images: [] }))],
    page: 1, totalPages: 1, totalDocs: 2, hasMore: false, detail: null, detailImages: [], imageError: '', videoSource: '', videoError: '' };
  const review = { ...workspace, view: 'review', actions: { create: false, review: true }, teams: [], docs: [flow.row(pending)], totalDocs: 1,
    detail: flow.row(pending), detailImages: [{ index: 0, caption: pending.images[0].caption, path: image }] };
  const edit = { loading: false, needsLogin: false, ready: true, busy: false, error: '', operationError: '', message: '', record: flow.row(returned), teams: [team],
    teamIndex: 0, teamTitle: team.gameTitle + ' · ' + team.title, fields: flow.fields(flow.draft(returned)), images: [{ index: 0, caption: returned.images[0].caption, path: image }], imageError: '',
    editable: true, canSave: true, canSubmit: true, conflict: false, uncertainCreate: false, recentDocs: [], hasSelectedVideo: false, selectedVideoSize: '', videoUploading: false,
    videoProgress: 0, canUploadVideo: false, videoSource: '', videoError: '' };
  const editorConfirmed = { ...edit, record: flow.row(confirmed), fields: flow.fields(flow.draft(confirmed)), images: [], ready: false, editable: false, canSave: false, canSubmit: false,
    message: '草稿已保存；仍须提交并由他人审核后展示。', error: '合成旧读取：保存已确认，读取结果尚未更新，请重新读取回执核对。' };
  return [
    fixture('team-honors-approved', 'team-honors', '公开批准档案；年度、日期、合成图注与受控版本视频', honors),
    fixture('team-honors-legacy', 'team-honors', '历史档案与来源入口；无原始视频回退', { ...honors, records: legacyRows, previewImages: [] }),
    fixture('team-honors-loading', 'team-honors', '首次读取公开档案', { ...honors, loading: true, loaded: false, records: [], team: null, previewImages: [] }),
    fixture('team-honors-empty', 'team-honors', '尚无已公开档案', { ...honors, records: [], previewImages: [] }),
    fixture('team-honors-error', 'team-honors', '弱网读取失败与重试', { ...honors, loaded: false, team: null, records: [], previewImages: [], error: '合成弱网：荣誉档案暂未读取，请稍后重试。' }),
    fixture('team-honors-media-error', 'team-honors', '合成媒体错误；正文、图注与重试仍可用', { ...honors, records: [{ ...publicRows[0], localImages: [], videoSource: '', mediaError: '合成图片加载失败，可重新加载档案后重试。', videoError: '合成受控视频加载失败，请重新加载档案。' }], previewImages: [] }),
    fixture('team-profiles-roster', 'team-profiles', '仍在队且整份可见的简介；本人展示设置入口', profiles),
    fixture('team-profiles-ineligible', 'team-profiles', '无当前入队资格；保留可读的本人选择简介名单', { ...profiles, eligible: false, draft: profile.display(profile.empty()), draftAvatar: '' }),
    fixture('team-profiles-editor-hidden', 'team-profiles', '长字段编辑；整份展示默认关闭；合成头像', { ...profiles, editing: true }),
    fixture('team-profiles-preview-visible', 'team-profiles', '保存前核对整份主动展示的内容', { ...profiles, editing: true, previewing: true, draft: { ...profileDraft, visible: true } }),
    fixture('team-profiles-preview-hidden', 'team-profiles', '保存前核对整份隐藏选择', { ...profiles, editing: true, previewing: true }),
    fixture('team-profiles-period-locked', 'team-profiles', 'membershipVersion变化锁编辑；重载后仍需主动展示选择', { ...profiles, editing: true, locked: true,
      operationError: '入队周期已更新，请重新加载已保存资料，再确认当前周期的展示选择。' }),
    fixture('team-profiles-confirmed-get-failed', 'team-profiles', 'PUT已确认、GET失败；保留确认预览并锁保存', { ...profiles, editing: true, previewing: true, confirmationPending: true,
      draft: { ...profileDraft, visible: true }, message: '简介已确认保存，请成功刷新资料核对当前周期后继续。', error: '合成弱网：当前周期尚未成功刷新。' }),
    fixture('team-honor-workspace-mine', 'team-honor-workspace', '本人退回投稿与草稿；反馈与继续编辑入口', workspace),
    fixture('team-honor-workspace-review-evidence', 'team-honor-workspace', '展开本修订证据；批准、退回和拒绝能力来自回执', review),
    fixture('team-honor-workspace-review-limited', 'team-honor-workspace', '有限审核能力；仅退回动作与必填说明', { ...review,
      docs: [{ ...flow.row(record({ state: 'pending', reviewNote: null, actions: { ...reviewer, reviewActions: ['return'] } })), noteDraft: '合成反馈：请补全赛事日期，并确认材料可以公开。' }] }),
    fixture('team-honor-workspace-approved-hide', 'team-honor-workspace', '已批准档案；仅有隐藏权限和原因输入', { ...review, docs: [flow.row(approved)], detail: flow.row(approved) }),
    fixture('team-honor-workspace-empty', 'team-honor-workspace', '无当前有效队伍；本人投稿为空', { ...workspace, teams: [], actions: { create: false, review: false }, docs: [], totalDocs: 0, totalPages: 0 }),
    fixture('team-honor-workspace-denied', 'team-honor-workspace', '403权限收回；私有材料与操作已清理', { ...workspace, ready: false, teams: [], actions: {}, docs: [], totalDocs: 0,
      error: '合成权限变化：当前暂无荣誉审核入口，请返回本人记录或重新核对权限。' }),
    fixture('team-honor-workspace-confirmed-get-failed', 'team-honor-workspace', '撤回已确认、旧GET被拒；确认回执只读', { ...workspace, ready: false, teams: [], actions: {},
      docs: [flow.row(record({ revision: 4, state: 'withdrawn', reviewNote: null, actions: {} }))], totalDocs: 1,
      message: '荣誉操作已保存，请核对最新回执', error: '操作已确认，读取结果尚未更新，请重新加载核对已保存回执。' }),
    fixture('team-honor-edit-new', 'team-honor-edit', '新建标题草稿；保存、视频上传、正式提交各自独立', { ...edit, record: null, fields: { ...flow.fields(flow.empty()), title: '合成草稿：记录一份队伍成果' }, images: [] }),
    fixture('team-honor-edit-returned-images', 'team-honor-edit', '退回修改；保留长反馈、合成图片及材料说明', edit),
    fixture('team-honor-edit-approved', 'team-honor-edit', '已批准记录可修改；明确保存后撤下展示再审', { ...edit, record: flow.row(record({ state: 'approved', reviewNote: null })) }),
    fixture('team-honor-edit-conflict', 'team-honor-edit', '409版本冲突保留输入；锁写等待明确重载', { ...edit, editable: false, canSave: false, canSubmit: false, conflict: true,
      operationError: '合成冲突：保存记录已更新，当前未保存输入仍保留。请明确重新加载已保存资料后再修改。' }),
    fixture('team-honor-edit-uncertain-create', 'team-honor-edit', '新建结果未知；保留输入与候选本人回执，禁止自动认领或重复写入', { ...edit,
      record: null, uncertainCreate: true, editable: false, canSave: false, canSubmit: false, recentDocs: [flow.row(record({ state: 'draft', reviewNote: null }))],
      operationError: '合成网络中断：本次新建结果尚未确认，请先核对本人投稿。' }),
    fixture('team-honor-edit-selected-video', 'team-honor-edit', '独立MP4已选择但尚未上传；显式上传并保存草稿', { ...edit, hasSelectedVideo: true, selectedVideoSize: '8.4 MB', canUploadVideo: true }),
    fixture('team-honor-edit-upload-100', 'team-honor-edit', '视频传送100%但尚未获得服务器确认；所有写入仍锁定', { ...edit,
      busy: true, hasSelectedVideo: true, selectedVideoSize: '8.4 MB', videoUploading: true, videoProgress: 100, canUploadVideo: false, canSave: false, canSubmit: false }),
    fixture('team-honor-edit-confirmed-get-failed', 'team-honor-edit', '保存ACK revision4；旧GET不覆盖确认内容或恢复写入', editorConfirmed),
  ];
}
