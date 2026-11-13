function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: i18n.message('外观设置暂不可用，请重新打开小程序。') } }; }
}
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const config = require('../../config');
const team = require('../../lib/team');
const recruitment = require('../../lib/team-recruitment');
const format = require('../../lib/format');
const { actions, protect } = require('../../lib/page');
const identity = () => String((session.user() || {}).id || '');
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const text = {
  back: ['‹ 返回', '‹ Back'],
  currentTeam: ['当前队伍', 'Current team'],
  kickerJoinSuffix: [' · 工作台', ' · Workbench'],
  kickerEstablishment: ['TEAMS · 建队审核', 'TEAMS · Founding review'],
  titleJoin: ['入队审核', 'Join applications'],
  titleEstablishment: ['建队申请审核', 'Founding applications'],
  leadJoin: ['核对已提交答卷，记录处理意见，再安排本队招新与日常。', 'Check submitted answers, record decisions, then manage recruitment and day-to-day matters.'],
  leadEstablishment: ['核对组织与训练计划，保存人工审核决定。', 'Check the organisation and training plan and save the review decision.'],
  teamStatus: ['队伍状态', 'Team status'],
  busyNote: ['本次确认或保存尚未完成，完成后会核对最新记录。', 'This confirmation or save is still in progress; the latest record will be checked when it finishes.'],
  checking: ['正在核对权限与工作台', 'Checking permissions and workbench'],
  reload: ['重新加载', 'Reload'],
  noAccessTitle: ['当前暂无此工作台的查看权限', 'You cannot view this workbench'],
  noAccessBody: ['可刷新核对当前队伍或建队审核的授权。', 'Refresh to re-check your team or founding-review permissions.'],
  recheck: ['重新核对权限', 'Re-check permissions'],
  editBatch: ['编辑招新批次', 'Edit recruitment batch'],
  newBatch: ['新建招新批次', 'New recruitment batch'],
  batchName: ['批次名称', 'Batch name'],
  questionCountPrefix: ['选拔问卷共 ', 'The trial questionnaire has '],
  questionCountSuffix: [' 题。题型和分支可在网站工作台编辑。', ' questions. Edit question types and branching in the website workbench.'],
  copyQuestionnaire: ['复制网站问卷编辑地址', 'Copy website questionnaire editor link'],
  timeHint: ['以下时间均为北京时间。开始时间留空时，发布后立即接受申请。发布前请填写未来的截止时间。', 'All times are Beijing time. With no start time, applications open on publishing. Set a future deadline before publishing.'],
  startLabel: ['报名开始时间（选填）', 'Applications open (optional)'],
  endLabel: ['报名截止时间', 'Applications close'],
  startDate: ['开始日期', 'Start date'],
  endDate: ['截止日期', 'Deadline date'],
  pickDate: ['选择日期', 'Choose date'],
  startTime: ['开始时刻', 'Start time'],
  endTime: ['截止时刻', 'Deadline time'],
  pickTime: ['选择时刻', 'Choose time'],
  clear: ['清除', 'Clear'],
  activeFirst: ['请在工作台的「调整队伍状态」中将队伍设为活跃，再发布招新。', 'Set the team to active under “Team status” in the workbench before publishing recruitment.'],
  saveOpen: ['保存开放安排', 'Save open schedule'],
  publish: ['发布招新', 'Publish recruitment'],
  saveDraft: ['保存草稿', 'Save draft'],
  saveBatch: ['保存批次', 'Save batch'],
  backToBatches: ['返回批次列表', 'Back to batches'],
  manageRecruitment: ['管理招新', 'Manage recruitment'],
  manageMembers: ['管理成员关系', 'Manage memberships'],
  joinApplications: ['入队申请', 'Join applications'],
  pendingEstablishments: ['待审建队申请', 'Founding applications to review'],
  refresh: ['刷新核对', 'Refresh'],
  applicationStatus: ['申请状态', 'Application status'],
  applicationPrefix: ['申请 ', 'Application '],
  updatedPrefix: ['更新于 ', 'Updated '],
  hideApplication: ['收起申请与处理区', 'Hide application'],
  showApplication: ['查看申请并处理', 'View and handle application'],
  answers: ['申请时提交的答卷', 'Submitted answers'],
  plan: ['组织与训练计划', 'Organisation and training plan'],
  lastNote: ['上次处理意见', 'Previous decision note'],
  decision: ['本次审核决定', 'Decision'],
  decisionHint: ['处理意见会显示在申请人的回执中。', 'The note appears on the applicant\'s receipt.'],
  noteLabel: ['处理意见', 'Decision note'],
  notePlaceholder: ['退回或拒绝时必填具体原因', 'A specific reason is required to return or reject'],
  noteHint: ['最多 1000 字，保存前会再次确认。', 'Up to 1000 characters; you will confirm before saving.'],
  noDecision: ['暂无可执行审核操作。', 'No review action is available.'],
  emptyTitle: ['此状态暂无申请', 'No applications in this status'],
  emptyBody: ['未提交草稿不进入审核队列。', 'Unsubmitted drafts do not enter the review queue.'],
  loadMore: ['加载更多申请', 'Load more applications'],
  batches: ['招新批次', 'Recruitment batches'],
  batchesHint: ['新建批次使用代表队选拔问卷。设置报名时间后即可发布。', 'New batches use the team trial questionnaire. Set the application window, then publish.'],
  addBatch: ['＋ 新建招新批次', '＋ New recruitment batch'],
  teamTrials: ['代表队选拔', 'Team trials'],
  start: ['开始', 'Opens'],
  end: ['截止', 'Closes'],
  viewEntry: ['查看申请入口', 'View application page'],
  editPublish: ['编辑并发布', 'Edit and publish'],
  closeRound: ['关闭本轮招新', 'Close this round'],
  archiveBatch: ['归档批次', 'Archive batch'],
  noBatches: ['暂无本队招新批次。', 'No recruitment batches yet.'],
  moreBatches: ['加载更多批次', 'Load more batches'],
  adjustStatus: ['调整队伍状态', 'Team status'],
  currentStatus: ['当前状态', 'Current status'],
  lifecycleWarning: ['设为休整或归档会关闭当前开放的招新批次，保存前需确认。', 'Resting or archiving closes any open recruitment batch; you will confirm before saving.'],
  setPrefix: ['设为', 'Set to '],
  copyWorkbench: ['复制网站工作台地址', 'Copy website workbench link'],
};
const localized = (zh, en) => { const result = {}; Object.keys(zh).forEach(key => Object.defineProperty(result, key, { enumerable: true, get: () => i18n.t(zh[key], en[key]) })); return result; };
const statusLabels = () => [i18n.t('待人工审核', 'Pending review'), i18n.t('退回补充', 'Returned'), i18n.t('已批准', 'Approved'), i18n.t('未通过', 'Not approved'), i18n.t('已撤回', 'Withdrawn')];

const decisionLabels = localized({ approved: '批准', returned: '退回补充', rejected: '拒绝' }, { approved: 'Approve', returned: 'Return for more', rejected: 'Reject' });
const lifecycle = localized({ active: '活跃', resting: '休整', archived: '已归档', unestablished: '尚未批准成立' }, { active: 'Active', resting: 'Resting', archived: 'Archived', unestablished: 'Not yet approved' });
const statuses = ['pending', 'returned', 'approved', 'rejected', 'withdrawn'];
const unique = docs => docs.filter((doc, index) => docs.findIndex(value => String(value.id) === String(doc.id)) === index);
Page(withVisualTheme({
  data: { needsLogin: false, loading: false, error: '', operationError: '', done: '', allowed: false, busy: false,
    mode: 'establishment', teamID: '', teamDoc: null, teamActions: {}, lifecycleChoices: [], docs: [], expandedId: '', page: 1, hasMore: false,
    status: 'pending', statusIndex: 0, statusLabels: ['待人工审核', '退回补充', '已批准', '未通过', '已撤回'],
    recruitments: [], batchesPage: 1, batchesMore: false, recruitmentEditor: null },
  ...actions,
  toggleRecord(event) {
    if (this.data.busy || this.data.loading || this.data.imageBusy) return;
    const doc = this.data.docs.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (doc) this.setData({ expandedId: this.data.expandedId === doc.id ? '' : doc.id });
  },
  onLoad(options = {}) {
    i18n.bind(this, text); this.setData({ statusLabels: statusLabels() });
    if (this._unsubscribe) this._unsubscribe();
    this._disposed = false; this._visible = false; this._resumeRead = false; this._context = (this._context || 0) + 1; this.invalidate();
    this._identity = identity(); this.resetPrivate(); this._teamID = options.team || options.id || '';
    this.setData({ mode: this._teamID ? 'join' : 'establishment', teamID: this._teamID,
      status: statuses.includes(options.status) ? options.status : 'pending', statusIndex: statuses.includes(options.status) ? statuses.indexOf(options.status) : 0 });
    this._unsubscribe = session.subscribe(() => {
      if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this._resumeRead = false; this.invalidate(); this.resetPrivate(); }
    });
  },
  invalidate() { this._scope = (this._scope || 0) + 1; this._operation = (this._operation || 0) + 1; },
  valid(scope) { return !this._disposed && this._visible !== false && scope === (this._scope || 0) && this._identity === identity() && Boolean(identity()); },
  beginWrite() { this._pendingWrite = true; return this._writeID = (this._writeID || 0) + 1; },
  writeValid(context, actor, writeID) { return !this._disposed && context === this._context && actor === identity() && writeID === this._writeID; },
  async finishWrite(writeID) {
    if (writeID !== this._writeID) return;
    this._pendingWrite = false;
    if (this._disposed) return;
    this.setData({ busy: false });
    if (this._visible && this._resumeRead) { this._resumeRead = false; await this.load(); }
  },
  resetPrivate() { this._recruitmentForm = null; this.setData({ needsLogin: !session.user(), loading: false, error: '', operationError: '', done: '', allowed: false, busy: Boolean(this._pendingWrite),
    teamDoc: null, teamActions: {}, lifecycleChoices: [], docs: [], expandedId: '', page: 1, hasMore: false, recruitments: [], batchesPage: 1, batchesMore: false, recruitmentEditor: null }); },
  onShow() {
    this._visible = true;
    if ((i18n.refreshIfStale ? i18n.refreshIfStale(this) : false)) this.onLocaleChange();
    i18n.navTitle('代表队工作台', 'Team workbench');
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, busy: Boolean(this._pendingWrite) }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); i18n.unbind(this); },
  onLocaleChange() { this.setData({ statusLabels: statusLabels() }); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (!this.data.recruitmentEditor && this.data.hasMore && !this.data.loading && !this.data.busy) return this.load('applications'); },
  moreBatches() { if (this.data.batchesMore && !this.data.loading && !this.data.busy) return this.load('batches'); },
  decorate(doc) {
    const previous = this.data.docs.find(value => String(value.id) === String(doc.id) && value.updatedAt === doc.updatedAt);
    let value = doc;
    if (this.data.mode === 'join') {
      try { value = team.receipt(doc) || doc; }
      catch { value = { ...doc, rows: [], receiptError: i18n.t('已提交答卷暂时无法展示，请刷新重试', 'The submitted answers cannot be shown right now. Refresh and try again.') }; }
    }
    return { ...value, actions: doc.actions || {}, statusText: value.statusText || team.labels[doc.status] || i18n.t('状态待核对', 'Status pending'), dateText: format.date(doc.updatedAt),
      noteDraft: previous ? previous.noteDraft || '' : '',
      decisions: ((doc.actions || {}).reviewDecisions || []).filter(decision => decisionLabels[decision]).map(decision => ({ value: decision, label: decisionLabels[decision] })) };
  },
  async load(more = '') {
    if (this._disposed || this._visible === false) return;
    if (this._pendingWrite) { this._resumeRead = true; return; }
    if (more && (this.data.loading || (more === 'batches' ? !this.data.batchesMore : !this.data.hasMore))) return;
    if (!protect(this)) { this.invalidate(); this.resetPrivate(); return; }
    const scope = this._scope || 0, ticket = this._loadTicket = (this._loadTicket || 0) + 1;
    const page = more ? this.data.page + (more === 'applications' ? 1 : 0) : 1;
    const batchesPage = more ? this.data.batchesPage + (more === 'batches' ? 1 : 0) : 1;
    this.setData({ loading: true, error: '' });
    try {
      const url = this.data.mode === 'establishment' ? `/api/miniapp/team/establishments?mode=review&page=${page}`
        : `/api/miniapp/team/${encodeURIComponent(this._teamID)}/workbench?page=${page}&membersPage=1&batchesPage=${batchesPage}&status=${this.data.status}`;
      const result = await http.request(url, { required: true });
      if (!this.valid(scope) || ticket !== this._loadTicket) return;
      const queue = this.data.mode === 'establishment' ? result : result.applications;
      if (!queue || !Array.isArray(queue.docs)) throw new Error(i18n.t('审核记录暂不可用，请重试', 'Review records are unavailable. Please try again.'));
      if (this.data.mode === 'establishment' && !(result.actions || {}).reviewEstablishments) { this.resetPrivate(); return; }
      if (this.data.mode === 'join' && (!result.team || String(result.team.id) !== String(this._teamID) || !result.recruitments || !Array.isArray(result.recruitments.docs))) throw new Error(i18n.t('队伍工作台暂不可用，请重试', 'The team workbench is unavailable. Please try again.'));
      const values = { allowed: true, loading: false };
      if (!more || more === 'applications') Object.assign(values, { docs: unique((more ? this.data.docs : []).concat(queue.docs.map(doc => this.decorate(doc)))),
        page: queue.page || page, hasMore: Boolean(queue.hasNextPage) });
      if (this.data.mode === 'join') {
        Object.assign(values, { teamDoc: { ...result.team, statusText: lifecycle[result.team.teamStatus] || i18n.t('状态待核对', 'Status pending') }, teamActions: result.actions || {},
          lifecycleChoices: ((result.actions || {}).lifecycleStatuses || []).filter(state => lifecycle[state]).map(state => ({ value: state, label: lifecycle[state] })) });
        if (!more || more === 'batches') Object.assign(values, { recruitments: unique((more ? this.data.recruitments : []).concat(result.recruitments.docs.map(doc => ({ ...doc, ...(doc.state ? { state: i18n.message(doc.state) } : {}), actions: doc.actions || {},
          startText: format.date(doc.startAt), endText: format.date(doc.endAt) })))), batchesPage: result.recruitments.page || batchesPage, batchesMore: Boolean(result.recruitments.hasNextPage) });
      }
      this.setData(values);
    } catch (cause) {
      if (this.valid(scope) && ticket === this._loadTicket) {
        if ([401, 403].includes(cause.status)) this.resetPrivate();
        this.setData({ loading: false, error: cause.message, ...(cause.status === 401 ? { needsLogin: true } : {}) });
      }
    }
  },
  status(event) {
    const index = Number(event.detail.value);
    if (this.data.busy || !statuses[index] || statuses[index] === this.data.status) return;
    this.setData({ status: statuses[index], statusIndex: index, docs: [], expandedId: '', page: 1, hasMore: false }); return this.load();
  },
  note(event) {
    if (this.data.busy) return;
    const index = this.data.docs.findIndex(doc => String(doc.id) === String(event.currentTarget.dataset.id));
    if (index >= 0) this.setData({ [`docs[${index}].noteDraft`]: event.detail.value });
  },
  async decide(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || !this.data.allowed || this.data.loading || this.data.busy) return;
    const { id, decision } = event.currentTarget.dataset;
    const doc = this.data.docs.find(value => String(value.id) === String(id));
    if (!doc || !doc.decisions.some(value => value.value === decision)) return;
    if (doc.receiptError && decision === 'approved') { this.setData({ operationError: i18n.t('请先刷新并完整核对已提交答卷，再批准', 'Refresh and fully check the submitted answers before approving') }); return; }
    const scope = this._scope || 0, operation = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      if (decision !== 'approved' && !(doc.noteDraft || '').trim()) throw new Error(i18n.t('退回或拒绝需要填写具体原因', 'A specific reason is required to return or reject'));
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: this.data.mode === 'join' ? i18n.t('审核入队申请', 'Review join application') : i18n.t('审核建队申请', 'Review founding application'),
        content: i18n.t(`确认${decisionLabels[decision]}这份申请？处理意见会出现在本人的回执中。`, `${decisionLabels[decision]} this application? The note will appear on the applicant's receipt.`), success: value => resolve(value.confirm), fail: () => reject(new Error(i18n.message('确认未完成，请重试'))) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const response = await team.post({ operation: this.data.mode === 'join' ? 'decide-join' : 'decide-establishment', id: doc.id,
        revision: doc.updatedAt, decision, note: doc.noteDraft || '' });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error(i18n.message('处理结果暂不可用，请刷新后核对'));
      const saved = { ...doc, actions: {}, decisions: [], noteDraft: '' };
      for (const key of ['status', 'updatedAt', 'reviewNote']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      saved.statusText = team.labels[saved.status] || i18n.t('状态待核对', 'Status pending'); saved.dateText = format.date(saved.updatedAt);
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(id) ? saved : value), done: i18n.t('审核决定已保存', 'Decision saved') });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
  canEditRecruitment() {
    return this.valid(this._scope) && this.data.allowed && this.data.teamDoc &&
      !this.data.loading && !this.data.busy && !this.data.error;
  },
  recruitmentBatches() {
    if (this.canEditRecruitment()) wx.pageScrollTo({ selector: '#team-recruitment-batches', duration: 200 });
  },
  async openRecruitmentEditor(event) {
    if (!this.canEditRecruitment() || this.data.recruitmentEditor) return;
    const id = event.currentTarget.dataset.id;
    const row = id ? this.data.recruitments.find(doc => String(doc.id) === String(id) && doc.actions.edit) : null;
    if (id ? !row : !this.data.teamActions.createRecruitment) return;

    const scope = this._scope, ticket = this._loadTicket = (this._loadTicket || 0) + 1;
    const teamID = this.data.teamDoc.id;
    const current = () => this.valid(scope) && ticket === this._loadTicket;
    this.setData({ loading: true, operationError: '', done: '' });
    try {
      const { form, title } = row ? await recruitment.read(row.id, teamID) :
        { form: recruitment.defaultTeamForm, title: '代表队新一轮招新' };
      if (!current()) return;
      this._recruitmentForm = form;
      this.setData({ recruitmentEditor: {
        id: row ? row.id : null,
        title,
        status: row ? row.status : 'draft',
        revision: row ? row.updatedAt : '',
        questionCount: form.questions.length,
        start: recruitment.parts(form.start),
        end: recruitment.parts(form.end),
        blocked: false,
      } }, () => wx.pageScrollTo({ scrollTop: 0, duration: 0 }));
    } catch (cause) {
      if (current()) this.setData({ operationError: cause.message });
    } finally {
      if (current()) this.setData({ loading: false });
    }
  },
  back() {
    if (this.data.recruitmentEditor) return this.closeRecruitmentEditor();
    return navigation.back();
  },
  closeRecruitmentEditor() {
    if (this.data.busy) return;
    this._recruitmentForm = null;
    this.setData({ recruitmentEditor: null, operationError: '' });
    return this.load();
  },
  recruitmentTitle(event) {
    const editor = this.data.recruitmentEditor;
    if (!editor || editor.blocked || !this.canEditRecruitment() || typeof event.detail.value !== 'string') return;
    this.setData({ recruitmentEditor: { ...editor, title: event.detail.value }, operationError: '' });
  },
  recruitmentTime(event) {
    const editor = this.data.recruitmentEditor;
    const { key, part } = event.currentTarget.dataset;
    if (!editor || editor.blocked || !this.canEditRecruitment() || !['start', 'end'].includes(key)) return;
    const schedule = recruitment.changeTime(editor[key], key, part, event.detail && event.detail.value);
    this.setData({ recruitmentEditor: { ...editor, [key]: schedule }, operationError: '' });
  },
  async saveRecruitment(event) {
    const editor = this.data.recruitmentEditor;
    if (!editor || editor.blocked || !this._recruitmentForm || !this.canEditRecruitment()) return;
    const { status } = event.currentTarget.dataset;
    const publishing = status === 'open';
    if (!publishing && (status !== editor.status || !['draft', 'closed'].includes(status))) return;

    const teamDoc = this.data.teamDoc;
    let data;
    try {
      data = recruitment.saveInput(teamDoc, editor, this._recruitmentForm, status);
    } catch (cause) {
      this.setData({ operationError: cause.message });
      return;
    }
    const scope = this._scope, context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    let sent = false;
    try {
      if (publishing) {
        const confirmed = await new Promise((resolve, reject) => wx.showModal({
          title: editor.status === 'open' ? i18n.t('更新招新安排', 'Update recruitment schedule') : i18n.t('发布招新', 'Publish recruitment'),
          content: i18n.t('保存后，申请人可在报名时间内填写并提交选拔问卷。', 'After saving, applicants can fill in and submit the trial questionnaire during the application window.'),
          success: value => resolve(value.confirm),
          fail: () => reject(new Error(i18n.message('确认未完成，请重试'))),
        }));
        if (!confirmed || !this.valid(scope)) return;
      }
      sent = true;
      const response = await team.post(data);
      if (!this.writeValid(context, actor, writeID)) return;
      const saved = response && response.result;
      if (!saved || !Number.isSafeInteger(saved.id) || saved.id < 1 || saved.status !== status ||
          (editor.id && saved.id !== editor.id)) throw new Error(i18n.t('保存回执暂不可用', 'The save receipt is unavailable'));
      this._recruitmentForm = null;
      const done = !publishing ? i18n.t('招新批次已保存', 'Recruitment batch saved') : editor.status === 'open' ? i18n.t('招新安排已保存', 'Recruitment schedule saved') : i18n.t('招新批次已发布', 'Recruitment batch published');
      this.setData({ recruitmentEditor: null, done });
      this._resumeRead = true;
    } catch (cause) {
      if (!this.writeValid(context, actor, writeID)) return;
      if (cause.status === 403) {
        this.resetPrivate();
        this.setData({ error: cause.message });
      } else if (sent && (cause.status === 409 || !cause.status || cause.status >= 500)) {
        const message = cause.status === 409 ? cause.message + i18n.t('。请返回批次列表核对。', '. Go back to the batch list to check.') : i18n.t('请返回批次列表，刷新核对本次保存结果。', 'Go back to the batch list and refresh to check this save.');
        this.setData({ recruitmentEditor: { ...editor, blocked: true }, operationError: message });
      } else {
        this.setData({ operationError: cause.message });
      }
    } finally {
      await this.finishWrite(writeID);
    }
  },
  websiteWorkbench(event) {
    if (!this.data.allowed || !this.data.teamDoc || this.data.loading || this.data.busy) return;
    const id = event.currentTarget.dataset.id, create = event.currentTarget.dataset.create;
    if (create && !this.data.teamActions.createRecruitment) return;
    if (id && !this.data.recruitments.some(doc => String(doc.id) === String(id) && doc.actions.edit)) return;
    navigation.copy(config.origin + `/teams/manage/${this.data.teamDoc.id}` + (create ? '?create=1' : id ? '?edit=' + encodeURIComponent(id) : ''), i18n.t('工作台地址已复制，可在浏览器登录后打开', 'Workbench link copied; sign in from a browser to open it'));
  },
  members() { if (this.data.allowed && this.data.teamDoc && !this.data.loading && !this.data.busy) navigation.go('team-members', { team: this.data.teamDoc.id }); },
  openRecruitment(event) {
    const doc = this.data.recruitments.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (doc && doc.actions.view && !this.data.loading && !this.data.busy) navigation.go('signup', { kind: 'team', id: doc.id });
  },
  async operate(event) {
    if (!identity() || this._disposed || this._visible === false || this._pendingWrite || !this.data.allowed || !this.data.teamDoc || this.data.loading || this.data.busy || this.data.recruitmentEditor) return;
    const { operation: operationName, id, status } = event.currentTarget.dataset;
    let target;
    if (operationName === 'lifecycle' && this.data.lifecycleChoices.some(value => value.value === status)) target = this.data.teamDoc;
    if (operationName === 'close-recruitment' && ['closed', 'archived'].includes(status)) target = this.data.recruitments.find(doc => String(doc.id) === String(id) && doc.actions[status === 'closed' ? 'close' : 'archive']);
    if (!target) return;
    const scope = this._scope || 0, operation = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: operationName === 'lifecycle' ? i18n.t('修改队伍运营状态', 'Change team status') : i18n.t('关闭或归档招新', 'Close or archive recruitment'),
        content: operationName === 'lifecycle' ? i18n.t(`确认设为${lifecycle[status]}？休整或归档会关闭当前开放的招新批次。`, `Set to ${lifecycle[status]}? Resting or archiving closes any open recruitment batch.`) : status === 'closed' ? i18n.t('确认关闭本轮招新？已提交申请保留，后续操作以最新回执权限为准。', 'Close this round? Submitted applications are kept; later actions follow the latest receipt permissions.') : i18n.t('确认归档本批次？归档后不能重开，原申请记录保留。', 'Archive this batch? It cannot be reopened; existing applications are kept.'),
        success: value => resolve(value.confirm), fail: () => reject(new Error(i18n.message('确认未完成，请重试'))) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const response = await team.post({ operation: operationName, id: target.id, revision: target.updatedAt, status });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error(i18n.message('处理结果暂不可用，请刷新后核对'));
      const saved = { ...target, actions: {} };
      for (const key of ['status', 'teamStatus', 'updatedAt']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      this.setData({ done: i18n.t('队伍或批次状态已保存', 'Team or batch status saved'), teamActions: {}, lifecycleChoices: [],
        docs: this.data.docs.map(doc => ({ ...doc, actions: {}, decisions: [] })),
        ...(operationName === 'lifecycle' ? { teamDoc: { ...saved, statusText: lifecycle[saved.teamStatus] || i18n.t('状态待核对', 'Status pending') } } : {}),
        recruitments: this.data.recruitments.map(doc => String(doc.id) === String(target.id) && operationName === 'close-recruitment' ? { ...saved, state: i18n.t('已保存，请刷新核对招新窗口', 'Saved; refresh to check the application window') } : { ...doc, actions: {} }) });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
}));
