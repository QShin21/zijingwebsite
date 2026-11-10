function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
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
const decisionLabels = { approved: '批准', returned: '退回补充', rejected: '拒绝' };
const lifecycle = { active: '活跃', resting: '休整', archived: '已归档', unestablished: '尚未批准成立' };
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
    if (this._disposed) return;
    if (this._identity !== identity()) { this._identity = identity(); this._context = (this._context || 0) + 1; this.invalidate(); this.resetPrivate(); }
    return this.load();
  },
  onHide() { this._visible = false; this._resumeRead = false; this.invalidate(); this.setData({ loading: false, busy: Boolean(this._pendingWrite) }); },
  onUnload() { this.onHide(); this._disposed = true; if (this._unsubscribe) this._unsubscribe(); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (!this.data.recruitmentEditor && this.data.hasMore && !this.data.loading && !this.data.busy) return this.load('applications'); },
  moreBatches() { if (this.data.batchesMore && !this.data.loading && !this.data.busy) return this.load('batches'); },
  decorate(doc) {
    const previous = this.data.docs.find(value => String(value.id) === String(doc.id) && value.updatedAt === doc.updatedAt);
    let value = doc;
    if (this.data.mode === 'join') {
      try { value = team.receipt(doc) || doc; }
      catch { value = { ...doc, rows: [], receiptError: '已提交答卷暂时无法展示，请刷新重试' }; }
    }
    return { ...value, actions: doc.actions || {}, statusText: value.statusText || team.labels[doc.status] || '状态待核对', dateText: format.date(doc.updatedAt),
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
      if (!queue || !Array.isArray(queue.docs)) throw new Error('审核记录暂不可用，请重试');
      if (this.data.mode === 'establishment' && !(result.actions || {}).reviewEstablishments) { this.resetPrivate(); return; }
      if (this.data.mode === 'join' && (!result.team || String(result.team.id) !== String(this._teamID) || !result.recruitments || !Array.isArray(result.recruitments.docs))) throw new Error('队伍工作台暂不可用，请重试');
      const values = { allowed: true, loading: false };
      if (!more || more === 'applications') Object.assign(values, { docs: unique((more ? this.data.docs : []).concat(queue.docs.map(doc => this.decorate(doc)))),
        page: queue.page || page, hasMore: Boolean(queue.hasNextPage) });
      if (this.data.mode === 'join') {
        Object.assign(values, { teamDoc: { ...result.team, statusText: lifecycle[result.team.teamStatus] || '状态待核对' }, teamActions: result.actions || {},
          lifecycleChoices: ((result.actions || {}).lifecycleStatuses || []).filter(state => lifecycle[state]).map(state => ({ value: state, label: lifecycle[state] })) });
        if (!more || more === 'batches') Object.assign(values, { recruitments: unique((more ? this.data.recruitments : []).concat(result.recruitments.docs.map(doc => ({ ...doc, actions: doc.actions || {},
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
    if (doc.receiptError && decision === 'approved') { this.setData({ operationError: '请先刷新并完整核对已提交答卷，再批准' }); return; }
    const scope = this._scope || 0, operation = this._operation = (this._operation || 0) + 1;
    const context = this._context, actor = identity(), writeID = this.beginWrite();
    this.setData({ busy: true, operationError: '', done: '' });
    try {
      if (decision !== 'approved' && !(doc.noteDraft || '').trim()) throw new Error('退回或拒绝需要填写具体原因');
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: this.data.mode === 'join' ? '审核入队申请' : '审核建队申请',
        content: `确认${decisionLabels[decision]}这份申请？处理意见会出现在本人的回执中。`, success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const response = await team.post({ operation: this.data.mode === 'join' ? 'decide-join' : 'decide-establishment', id: doc.id,
        revision: doc.updatedAt, decision, note: doc.noteDraft || '' });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error('处理结果暂不可用，请刷新后核对');
      const saved = { ...doc, actions: {}, decisions: [], noteDraft: '' };
      for (const key of ['status', 'updatedAt', 'reviewNote']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      saved.statusText = team.labels[saved.status] || '状态待核对'; saved.dateText = format.date(saved.updatedAt);
      this.setData({ docs: this.data.docs.map(value => String(value.id) === String(id) ? saved : value), done: '审核决定已保存' });
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
          title: editor.status === 'open' ? '更新招新安排' : '发布招新',
          content: '保存后，申请人可在报名时间内填写并提交选拔问卷。',
          success: value => resolve(value.confirm),
          fail: () => reject(new Error('确认未完成，请重试')),
        }));
        if (!confirmed || !this.valid(scope)) return;
      }
      sent = true;
      const response = await team.post(data);
      if (!this.writeValid(context, actor, writeID)) return;
      const saved = response && response.result;
      if (!saved || !Number.isSafeInteger(saved.id) || saved.id < 1 || saved.status !== status ||
          (editor.id && saved.id !== editor.id)) throw new Error('保存回执暂不可用');
      this._recruitmentForm = null;
      const done = !publishing ? '招新批次已保存' : editor.status === 'open' ? '招新安排已保存' : '招新批次已发布';
      this.setData({ recruitmentEditor: null, done });
      this._resumeRead = true;
    } catch (cause) {
      if (!this.writeValid(context, actor, writeID)) return;
      if (cause.status === 403) {
        this.resetPrivate();
        this.setData({ error: cause.message });
      } else if (sent && (cause.status === 409 || !cause.status || cause.status >= 500)) {
        const message = cause.status === 409 ? cause.message + '。请返回批次列表核对。' : '请返回批次列表，刷新核对本次保存结果。';
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
    navigation.copy(config.origin + `/teams/manage/${this.data.teamDoc.id}` + (create ? '?create=1' : id ? '?edit=' + encodeURIComponent(id) : ''), '工作台地址已复制，可在浏览器登录后打开');
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
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: operationName === 'lifecycle' ? '修改队伍运营状态' : '关闭或归档招新',
        content: operationName === 'lifecycle' ? `确认设为${lifecycle[status]}？休整或归档会关闭当前开放的招新批次。` : status === 'closed' ? '确认关闭本轮招新？已提交申请保留，后续操作以最新回执权限为准。' : '确认归档本批次？归档后不能重开，原申请记录保留。',
        success: value => resolve(value.confirm), fail: () => reject(new Error('确认未完成，请重试')) }));
      if (!answer || !this.valid(scope) || operation !== this._operation) return;
      const response = await team.post({ operation: operationName, id: target.id, revision: target.updatedAt, status });
      if (!this.writeValid(context, actor, writeID)) return;
      if (!response || !response.result) throw new Error('处理结果暂不可用，请刷新后核对');
      const saved = { ...target, actions: {} };
      for (const key of ['status', 'teamStatus', 'updatedAt']) if (response.result[key] !== undefined) saved[key] = response.result[key];
      this.setData({ done: '队伍或批次状态已保存', teamActions: {}, lifecycleChoices: [],
        docs: this.data.docs.map(doc => ({ ...doc, actions: {}, decisions: [] })),
        ...(operationName === 'lifecycle' ? { teamDoc: { ...saved, statusText: lifecycle[saved.teamStatus] || '状态待核对' } } : {}),
        recruitments: this.data.recruitments.map(doc => String(doc.id) === String(target.id) && operationName === 'close-recruitment' ? { ...saved, state: '已保存，请刷新核对招新窗口' } : { ...doc, actions: {} }) });
      await this.load();
    } catch (cause) { if (this.writeValid(context, actor, writeID)) this.setData({ operationError: cause.message }); }
    finally { await this.finishWrite(writeID); }
  },
}));
