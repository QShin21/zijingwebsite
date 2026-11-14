const theme = require('../../lib/theme');
const i18n = require('../../lib/i18n');
const http = require('../../lib/http');
const session = require('../../lib/session');

const text = {
  title: ['竞猜与抽奖', 'Quiz & prize draw'], lead: ['每轮达到答对门槛，即可从活动共享奖池抽取奖品。', 'Meet the threshold to draw from the shared prize pool.'],
  loading: ['正在加载…', 'Loading…'], login: ['登录后参与', 'Sign in to participate'], retry: ['重新加载', 'Reload'], back: ['← 所有竞猜活动', '← All quiz events'],
  events: ['竞猜活动', 'Quiz events'], empty: ['目前还没有竞猜活动。', 'No quiz events yet.'], draft: ['草稿', 'Draft'], published: ['进行中', 'Active'], archived: ['已结束', 'Archived'],
  create: ['创建竞猜活动', 'Create quiz event'], eventName: ['活动名称', 'Event name'], description: ['活动说明', 'Description'], createDraft: ['创建活动草稿', 'Create draft'],
  manage: ['管理活动', 'Manage event'], saveEvent: ['保存活动', 'Save event'], publish: ['发布活动', 'Publish event'], archive: ['结束活动', 'Archive event'], reopen: ['重新开放活动', 'Reopen event'],
  pool: ['活动共享奖池', 'Shared prize pool'], poolNote: ['奖品按剩余数量随机抽取，所有轮次共用。', 'Prizes are randomly selected by remaining quantity across all rounds.'],
  noPrizes: ['奖池正在设置。', 'The prize pool is being prepared.'], remaining: ['剩余', 'Remaining'], total: ['总数', 'Total'], prizeName: ['奖品名称', 'Prize name'],
  addPrize: ['加入奖池', 'Add prize'], savePrize: ['保存奖品', 'Save prize'], rounds: ['竞猜轮次', 'Quiz rounds'], noRounds: ['轮次正在筹备。', 'Rounds are being prepared.'],
  open: ['作答中', 'Open'], closed: ['已截止', 'Closed'], settled: ['已公布答案', 'Results published'], required: ['答对门槛', 'Correct answers required'],
  cutoff: ['截止', 'Deadline'], submissions: ['已提交人数', 'Submissions'], myChoice: ['你的选择', 'Your choice'], correct: ['正确答案', 'Correct'],
  submit: ['提交竞猜', 'Submit answers'], submitted: ['已提交，等待公布答案。', 'Submitted; waiting for results.'], score: ['答对题数', 'Correct answers'], prize: ['获得奖品', 'Prize'], draw: ['抽取奖品', 'Draw a prize'],
  editRound: ['编辑轮次', 'Edit round'], openRound: ['开放竞猜', 'Open round'], closeRound: ['截止竞猜', 'Close round'], chooseCorrect: ['选择正确答案', 'Select the correct answer'], publishAnswers: ['公布答案', 'Publish answers'],
  addRound: ['新增竞猜轮次', 'Add a round'], roundName: ['轮次名称', 'Round name'], optionalDate: ['截止日期（可选）', 'Deadline date (optional)'], optionalTime: ['截止时间（本地时间）', 'Deadline time (local time)'],
  clearDate: ['清除截止时间', 'Clear deadline'], question: ['题目', 'Question'], option: ['选项', 'Option'], addOption: ['增加选项', 'Add option'], removeOption: ['删除选项', 'Remove option'],
  addQuestion: ['增加题目', 'Add question'], removeQuestion: ['删除本题', 'Remove question'], saveRound: ['保存轮次草稿', 'Save round draft'], cancelEdit: ['取消编辑', 'Cancel editing'],
  winners: ['中奖记录', 'Prize records'], noWinners: ['暂时没有中奖记录。', 'No prizes drawn yet.'], saved: ['操作完成。', 'Saved.'], selectAll: ['请完成每一道题', 'Answer every question'],
  submitConfirm: ['确认提交？提交后不能修改。', 'Submit your answers? They cannot be changed.'], openConfirm: ['开放后题目和门槛将锁定，确认开放？', 'Open this round and lock its questions?'],
  openDraftHint: ['开放本轮时会同时发布活动。', 'Opening this round will also publish the event.'],
  openArchivedHint: ['活动已结束，请先在活动管理中重新开放。', 'Reopen the event in event management first.'],
  openDraftConfirm: ['开放本轮将同时发布活动，并锁定题目和门槛。确认开放？', 'Opening this round will publish the event and lock its questions. Continue?'],
  openingDone: ['本轮已开放，可以开始作答。', 'This round is open for answers.'], working: ['正在处理…', 'Working…'],
  closeConfirm: ['确认截止本轮？', 'Close this round?'], settleConfirm: ['确认公布答案？公布后答案将锁定。', 'Publish and lock the correct answers?'],
  dateError: ['请选择完整的截止日期和时间', 'Select both deadline date and time'],
};
const blankRound = () => ({ title: '', threshold: '1', date: '', time: '', questions: [{ prompt: '', options: ['', ''] }] });
function chosen(map, round, index) { return map[round] && Number.isInteger(map[round][index]) ? map[round][index] : null; }
function decorate(detail, choices, keys, feedback) {
  if (!detail) return null;
  return { ...detail, rounds: detail.rounds.map(round => ({ ...round, feedback: feedback && feedback.roundId === round.id ? feedback : null,
    closesLabel: round.closesAt ? new Date(new Date(round.closesAt).getTime() - new Date(round.closesAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ') : '',
    questions: round.questions.map((q, index) => ({ ...q, index,
    options: q.options.map((label, option) => ({ label, index: option,
      selected: chosen(choices, round.id, index) === option, keySelected: chosen(keys, round.id, index) === option,
      mine: !!round.entry && round.entry.answers[index] === option,
      isCorrect: !!round.correctAnswers && round.correctAnswers[index] === option })) })) })) };
}
function modal(content) { return new Promise(resolve => wx.showModal({ title: i18n.t('请确认', 'Confirm'), content, success: result => resolve(result.confirm), fail: () => resolve(false) })); }

Page(theme.page({
  data: { loading: false, busy: false, error: '', notice: '', listing: null, detail: null, eventId: 0, loggedIn: false,
    createTitle: '', createDescription: '', adminTitle: '', adminDescription: '', prizeName: '', prizeQuantity: '1', prizeEdits: {},
    roundForm: blankRound(), editingRound: 0, roundFeedback: null, pendingRound: 0 },
  onLoad(query = {}) { i18n.bind(this, text); this._choices = {}; this._keys = {}; this._ticket = 0; this._eventId = /^[1-9]\d*$/.test(query.event || '') ? Number(query.event) : 0; },
  onShow() { i18n.navTitle('竞猜与抽奖', 'Quiz & prize draw'); return this.load(); },
  onHide() { this._ticket++; },
  onUnload() { this._ticket++; i18n.unbind(this); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  login() { wx.navigateTo({ url: '/pages/auth/index?mode=login' }); },
  async load() {
    const token = session.token();
    const ticket = ++this._ticket, eventId = this._eventId;
    if (token !== this._token) {
      this._token = token; this._detail = null; this._choices = {}; this._keys = {};
      this.setData({ detail: null, listing: null, notice: '', roundForm: blankRound(), editingRound: 0, roundFeedback: null });
    }
    this.setData({ loggedIn: !!token, loading: !!token, error: '', eventId: this._eventId });
    if (!token) { this.setData({ listing: null, detail: null }); return; }
    try {
      const listing = await http.request('/api/quiz', { required: true, raw: true });
      const detail = eventId ? await http.request('/api/quiz?event=' + eventId, { required: true, raw: true }) : null;
      if (ticket !== this._ticket || token !== session.token() || eventId !== this._eventId) return;
      this._detail = detail;
      const prizeEdits = {};
      if (detail) detail.prizes.forEach(prize => { prizeEdits[prize.id] = { name: prize.name, quantity: String(prize.quantity) }; });
      this.setData({ listing, detail: decorate(detail, this._choices, this._keys, this.data.roundFeedback), prizeEdits,
        adminTitle: detail ? detail.event.title : '', adminDescription: detail ? detail.event.description : '' });
    } catch (error) { if (ticket === this._ticket && token === session.token()) this.setData({ error: error.message || i18n.t('加载失败', 'Unable to load') }); }
    finally { if (ticket === this._ticket) this.setData({ loading: false }); }
  },
  openEvent(event) { this._eventId = Number(event.currentTarget.dataset.id); this._choices = {}; this._keys = {}; this.setData({ detail: null, notice: '', roundForm: blankRound(), editingRound: 0, roundFeedback: null }); return this.load(); },
  back() { this._eventId = 0; this._detail = null; this.setData({ detail: null, notice: '', roundForm: blankRound(), editingRound: 0, roundFeedback: null }); return this.load(); },
  input(event) { const name = event.currentTarget.dataset.field; if (['createTitle', 'createDescription', 'adminTitle', 'adminDescription', 'prizeName', 'prizeQuantity'].includes(name)) this.setData({ [name]: event.detail.value }); },
  prizeInput(event) { const id = Number(event.currentTarget.dataset.id), field = event.currentTarget.dataset.field; if (!this.data.prizeEdits[id] || !['name', 'quantity'].includes(field)) return; this.setData({ [`prizeEdits.${id}.${field}`]: event.detail.value }); },
  roundInput(event) { const field = event.currentTarget.dataset.field; if (['title', 'threshold', 'date', 'time'].includes(field)) this.setData({ [`roundForm.${field}`]: event.detail.value }); },
  clearDate() { this.setData({ 'roundForm.date': '', 'roundForm.time': '' }); },
  questionInput(event) { const q = Number(event.currentTarget.dataset.q), option = event.currentTarget.dataset.option; const items = this.data.roundForm.questions.slice();
    if (!items[q]) return; if (option === undefined) items[q].prompt = event.detail.value; else items[q].options[Number(option)] = event.detail.value; this.setData({ 'roundForm.questions': items }); },
  addQuestion() { const items = this.data.roundForm.questions.slice(); if (items.length < 30) { items.push({ prompt: '', options: ['', ''] }); this.setData({ 'roundForm.questions': items }); } },
  removeQuestion(event) { const items = this.data.roundForm.questions.slice(); if (items.length > 1) { items.splice(Number(event.currentTarget.dataset.q), 1); this.setData({ 'roundForm.questions': items }); } },
  addOption(event) { const items = this.data.roundForm.questions.slice(), q = Number(event.currentTarget.dataset.q); if (items[q] && items[q].options.length < 8) { items[q].options.push(''); this.setData({ 'roundForm.questions': items }); } },
  removeOption(event) { const items = this.data.roundForm.questions.slice(), q = Number(event.currentTarget.dataset.q), index = Number(event.currentTarget.dataset.option); if (items[q] && items[q].options.length > 2) { items[q].options.splice(index, 1); this.setData({ 'roundForm.questions': items }); } },
  editRound(event) { const round = this._detail.rounds.find(item => item.id === Number(event.currentTarget.dataset.id)); if (!round || round.status !== 'draft') return;
    const date = round.closesAt ? new Date(round.closesAt) : null, local = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString() : '';
    this.setData({ editingRound: round.id, roundForm: { title: round.title, threshold: String(round.threshold), date: local.slice(0, 10), time: local.slice(11, 16), questions: round.questions.map(q => ({ prompt: q.prompt, options: q.options.slice() })) } }); },
  cancelEdit() { this.setData({ editingRound: 0, roundForm: blankRound() }); },
  choose(event) { const id = Number(event.currentTarget.dataset.id), q = Number(event.currentTarget.dataset.q), option = Number(event.currentTarget.dataset.option), type = event.currentTarget.dataset.type;
    const round = this._detail && this._detail.rounds.find(item => item.id === id);
    if (!round || (type === 'key' ? !this._detail.admin || round.status !== 'closed' : round.status !== 'open' || round.entry || this._detail.event.status !== 'published')) return;
    const target = type === 'key' ? this._keys : this._choices; if (!target[id]) target[id] = {}; target[id][q] = option; this.setData({ detail: decorate(this._detail, this._choices, this._keys, this.data.roundFeedback) }); },
  feedback(roundId, type, message) {
    const roundFeedback = roundId ? { roundId, type, message } : null;
    this.setData({ roundFeedback, detail: decorate(this._detail, this._choices, this._keys, roundFeedback) });
  },
  async action(data, confirmation) {
    if (this.data.busy) return false;
    const roundId = Number(data.roundId) || 0;
    this.setData({ busy: true, pendingRound: roundId, error: '', notice: '', roundFeedback: null });
    try {
      if (confirmation && !(await modal(confirmation))) return false;
      const token = session.token(), eventId = this._eventId, ticket = this._ticket;
      const result = await http.request('/api/quiz', { method: 'POST', required: true, raw: true, data: { ...data, ...(this._eventId ? { eventId: this._eventId } : {}) } });
      if (token !== session.token() || eventId !== this._eventId || ticket !== this._ticket) return false;
      if (data.action === 'create-event') { this._eventId = result.id; this.setData({ createTitle: '', createDescription: '' }); }
      const notice = result.prize ? i18n.t('获得奖品：', 'Your prize: ') + result.prize : data.action === 'open-round'
        ? i18n.t('本轮已开放，可以开始作答。', 'This round is open for answers.') : i18n.t('操作完成。', 'Saved.');
      if (roundId) this.feedback(roundId, 'success', notice); else this.setData({ notice });
      await this.load(); return true;
    } catch (error) {
      const message = error.message || i18n.t('操作失败', 'Unable to save');
      if (roundId) this.feedback(roundId, 'error', message); else this.setData({ error: message });
      return false;
    }
    finally { this.setData({ busy: false, pendingRound: 0 }); }
  },
  createEvent() { return this.action({ action: 'create-event', title: this.data.createTitle, description: this.data.createDescription }); },
  updateEvent(event) { const status = event.currentTarget.dataset.status || this._detail.event.status; return this.action({ action: 'update-event', title: this.data.adminTitle, description: this.data.adminDescription, status }); },
  addPrize() { return this.action({ action: 'add-prize', name: this.data.prizeName, quantity: this.data.prizeQuantity }).then(ok => { if (ok) this.setData({ prizeName: '', prizeQuantity: '1' }); }); },
  savePrize(event) { const id = Number(event.currentTarget.dataset.id), edit = this.data.prizeEdits[id]; if (edit) return this.action({ action: 'edit-prize', prizeId: id, ...edit }); },
  async saveRound() { const form = this.data.roundForm; if (!!form.date !== !!form.time) { this.setData({ error: i18n.t('请选择完整的截止日期和时间', 'Select both deadline date and time') }); return; }
    const closesAt = form.date ? new Date(form.date + 'T' + form.time + ':00').toISOString() : null;
    const ok = await this.action({ action: 'save-round', ...(this.data.editingRound ? { roundId: this.data.editingRound } : {}), title: form.title, threshold: form.threshold, questions: form.questions, closesAt }); if (ok) this.cancelEdit(); },
  roundAction(event) { const action = event.currentTarget.dataset.action, id = Number(event.currentTarget.dataset.id), round = this._detail.rounds.find(item => item.id === id); if (!round) return;
    if (action === 'submit' || action === 'settle-round') { const map = action === 'submit' ? this._choices : this._keys;
      const answers = round.questions.map((_, index) => chosen(map, id, index));
      if (answers.some(answer => answer === null)) { this.feedback(id, 'error', i18n.t('请完成每一道题', 'Answer every question')); return; }
      return this.action({ action, roundId: id, answers }, action === 'submit' ? i18n.t('确认提交？提交后不能修改。', 'Submit your answers? They cannot be changed.') : i18n.t('确认公布答案？公布后答案将锁定。', 'Publish and lock the correct answers?'));
    }
    const confirmation = action === 'open-round' ? (this._detail.event.status === 'draft'
      ? i18n.t('开放本轮将同时发布活动，并锁定题目和门槛。确认开放？', 'Opening this round will publish the event and lock its questions. Continue?')
      : i18n.t('开放后题目和门槛将锁定，确认开放？', 'Open this round and lock its questions?')) : action === 'close-round' ? i18n.t('确认截止本轮？', 'Close this round?') : '';
    return this.action({ action, roundId: id }, confirmation);
  },
  onShareAppMessage() { return { title: i18n.t('竞猜与抽奖', 'Quiz & prize draw'), path: '/pages/quiz/index' + (this._eventId ? '?event=' + this._eventId : '') }; },
}));
