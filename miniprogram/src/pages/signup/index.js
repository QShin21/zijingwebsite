function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const brand = require('../../lib/brand');
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const questionnaire = require('../../lib/questionnaire');
const config = require('../../config');
const staff = require('../../lib/staff');
const team = require('../../lib/team');
const { actions, protect, error } = require('../../lib/page');
const types = ['text', 'textarea', 'single', 'multiple'];
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, navTitle() {}, unbind() {}, subscribe: () => () => {} }; })();
const text = {
  back: ["返回", "Back"],
  kickerTeam: ["代表队入队申请", "Team application"],
  staffApplication: ["骨干招新申请", "Staff application"],
  kickerManage: ["活动问卷与报名管理", "Activity form and sign-ups"],
  activitySignup: ["活动报名", "Activity sign-up"],
  teamApplication: ["代表队申请", "Team application"],
  titleManage: ["问卷与报名管理", "Form and sign-ups"],
  applicationWord: ["申请", "Application"],
  signupWord: ["报名", "Sign-up"],
  seatReceipt: ["我的选座回执", "My seat receipt"],
  ticketSuffix: ["电子票据", " e-ticket"],
  ticketLoadFailed: ["图片加载失败，请进入选座页面重试。", "The image failed to load. Open the seating page and try again."],
  ticketPending: ["票据上传后将在这里显示。", "The ticket will appear here once uploaded."],
  openSeat: ["查看选座详情与保存票据", "View seating details and save tickets"],
  lastSaveConfirmed: ["上次保存已确认", "Last save confirmed"],
  feedbackPrefix: ["处理反馈：", "Feedback: "],
  rereadApplication: ["重新读取申请状态", "Reload application status"],
  editForm: ["编辑问卷", "Edit form"],
  signupList: ["报名名单", "Sign-up list"],
  overview: ["题目与分支概览", "Questions and branching"],
  advancedNote: ["此问卷包含高级题型或分支规则。小程序可完整填写与查看报名名单，制作和逻辑设置请在网站编辑。", "This form has advanced question types or branching. The mini program supports filling it in and viewing sign-ups; edit questions and logic on the website."],
  copyEditor: ["复制网站编辑地址", "Copy website editor link"],
  questionPrefix: ["第 ", "Question "],
  questionSuffix: [" 题", ""],
  signupMethod: ["报名方式", "Sign-up method"],
  enableForm: ["启用问卷报名", "Enable form sign-up"],
  enableFormHint: ["每个账号保留一份记录，提交后确认报名。", "One record per account; submitting confirms the sign-up."],
  introAndTime: ["报名说明与开放时间", "Description and schedule"],
  introOptional: ["报名说明（可选）", "Description (optional)"],
  introPlaceholder: ["说明参与条件与填写用途", "Explain who can join and how answers are used"],
  startOptional: ["报名开始（可选）", "Opens (optional)"],
  noStart: ["不设开始时间", "No start time"],
  endOptional: ["报名截止（可选）", "Closes (optional)"],
  noEnd: ["不设截止时间", "No deadline"],
  pause: ["暂停接收报名", "Pause sign-ups"],
  pauseHint: ["已提交的报名记录保留。", "Submitted sign-ups are kept."],
  questionsTitle: ["报名题目", "Questions"],
  questionsHint: ["按填写顺序排列。已有报名保留提交时的题目和答案。", "Listed in answer order. Existing sign-ups keep the questions and answers they were submitted with."],
  questionTitle: ["题目标题", "Question title"],
  questionPlaceholder: ["填写题目", "Enter question"],
  questionType: ["题型", "Type"],
  required: ["此题必填", "Required"],
  optionsPerLine: ["选项（每行一个）", "Options (one per line)"],
  moveUp: ["上移", "Move up"],
  moveDown: ["下移", "Move down"],
  deleteQuestion: ["删除此题", "Delete question"],
  addQuestion: ["添加题目", "Add question"],
  saveHint: ["确认报名时间与题目后，保存本次设置。", "Check the schedule and questions, then save."],
  saveForm: ["保存报名问卷", "Save form"],
  submittedSignups: ["已提交报名", "Submitted sign-ups"],
  readingList: ["正在读取报名名单…", "Loading sign-ups…"],
  collapseEntry: ["收起报名资料", "Hide answers"],
  expandEntry: ["查看已提交资料", "View answers"],
  noSignups: ["暂无报名", "No sign-ups yet"],
  noSignupsHint: ["已提交的报名资料会显示在这里。", "Submitted sign-ups will appear here."],
  previousPage: ["上一页", "Previous"],
  nextPage: ["下一页", "Next"],
  manageForm: ["管理报名问卷", "Manage form"],
  viewList: ["查看报名名单", "View sign-ups"],
  staffReview: ["骨干申请审核", "Review staff applications"],
  teamReview: ["代表队申请审核", "Review team applications"],
  unsaved: ["尚未保存的内容", "Unsaved answers"],
  unsavedHint: ["当前状态无法提交，内容仅在本页保留。可重新加载核对申请状态。", "These cannot be submitted in the current state and are kept on this page only. Reload to check the application status."],
  myApplicationReceipt: ["本人申请回执", "My application receipt"],
  mySignupReceipt: ["本人报名回执", "My sign-up receipt"],
  signedUp: ["已报名", "Signed up"],
  numberPrefix: ["编号 ", "No. "],
  updatedPrefix: ["更新于 ", "Updated "],
  feedback: ["处理反馈", "Feedback"],
  continueDraft: ["继续填写草稿", "Continue draft"],
  resubmit: ["重新提交申请", "Resubmit application"],
  editApplication: ["修改申请", "Edit application"],
  editAnswers: ["修改作答", "Edit answers"],
  withdraw: ["撤回申请", "Withdraw application"],
  readOnly: ["当前回执只读。", "This receipt is read-only. "],
  reloadSubmitted: ["重新加载已提交内容", "Reload submitted answers"],
  savedDraft: ["已保存的草稿", "Saved draft"],
  submittedContent: ["已提交内容", "Submitted answers"],
  teamPrivacy: ["申请资料用于本队选拔，仅供本人及当前有权限的管理者查看。保存草稿后仍需提交，录取不授予平台或社群任职，也不代替公开简介授权。", "Your application is used for this team's trials and is visible only to you and authorized managers. Drafts still need to be submitted; acceptance grants no platform or community role and does not replace public profile consent."],
  signupPrivacy: ["提交的答案仅供本人和有权限的活动管理者查看，用于本次活动组织。", "Your answers are visible only to you and authorized organizers and are used to run this activity."],
  stagesLabel: ["填写、核对、查看回执", "Fill in, review, receipt"],
  stageFill: ["填写资料", "Fill in"],
  stageReview: ["核对提交", "Review"],
  stageReceipt: ["查看回执", "Receipt"],
  reviewTitle: ["核对提交内容", "Review your answers"],
  editSubmitted: ["修改已提交资料", "Edit submitted answers"],
  fillApplication: ["填写申请资料", "Fill in application"],
  fillSignup: ["填写报名资料", "Fill in sign-up"],
  requiredHint: ["带 * 为必填。", "* marks required questions. "],
  hintReview: ["确认本页内容后，使用下方按钮提交。", "Check this page, then submit with the button below."],
  hintPages: ["翻页时会保留已填内容，完成后再核对提交。", "Answers are kept between pages; review and submit at the end."],
  hintSingle: ["完成后可先核对，再提交。", "When done, review before submitting."],
  reviewNoteApplication: ["以下内容将用于本次申请。如需调整，可在下方返回修改。", "These answers will be used for this application. Go back below to make changes."],
  reviewNoteSignup: ["以下内容将用于本次报名。如需调整，可在下方返回修改。", "These answers will be used for this sign-up. Go back below to make changes."],
  pagePrefix: ["第 ", "Page "],
  pageSuffix: [" 页", ""],
  draftHint: ["保存草稿不会进入审核队列，完成后仍需核对提交。", "Drafts do not enter review; review and submit when done."],
  saving: ["正在保存，请稍候。", "Saving, please wait."],
  backToEdit: ["返回修改", "Back to edit"],
  reviewAnswers: ["核对填写内容", "Review answers"],
  submitTeam: ["提交代表队申请", "Submit team application"],
  submitStaff: ["保存并提交骨干申请", "Save and submit staff application"],
  submitChanges: ["提交修改", "Submit changes"],
  submitSignup: ["提交并确认报名", "Submit and confirm sign-up"],
  saveDraft: ["保存草稿，稍后继续", "Save draft and continue later"],
  cannotFill: ["当前暂不能填写", "Not available right now"],
  notOpen: ["当前未开放问卷", "The form is not open"],
  rereadHint: ["请重新读取当前状态，核对允许的操作。", "Reload to check the current status and available actions."],
  rereadState: ["重新读取状态", "Reload status"],
  teamCenter: ["代表队招新与我的成员记录", "Team recruitment and my memberships"]
};
const typesEn = { text: 'Short text', textarea: 'Long text', single: 'Single choice', multiple: 'Multiple choice', select: 'Dropdown', number: 'Number', date: 'Date', time: 'Time', rating: 'Rating', nps: 'NPS', ranking: 'Ranking', matrix: 'Matrix (single)', matrixMultiple: 'Matrix (multiple)', blanks: 'Fill in blanks', group: 'Entry list', description: 'Description' };
const typesZh = { text: '单行文本', textarea: '多行文本', single: '单选', multiple: '多选' };
const typeLabels = () => types.map(type => i18n.t(typesZh[type], typesEn[type]));
const seatStatusZh = { pending: '待审核', confirmed: '已确认', rejected: '已驳回', cancelled: '已取消', revoked: '已撤销' };
const seatStatusEn = { pending: 'Pending', confirmed: 'Confirmed', rejected: 'Rejected', cancelled: 'Cancelled', revoked: 'Revoked' };
const seatStatusLabel = status => seatStatusZh[status] ? i18n.t(seatStatusZh[status], seatStatusEn[status]) : '';
const seatLabel = value => i18n.locale() === 'en' ? 'Row ' + String(value).split('-').join(' Seat ') : String(value).split('-').join('排') + '座';
function localParts(value) { if (!value) return { date: '', time: '' }; const d = new Date(value), pad = v => String(v).padStart(2,'0'); return { date: d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()), time: pad(d.getHours())+':'+pad(d.getMinutes()) }; }
Page(withVisualTheme({
  data: { expandedEntryId: '', loading: true, error: '', needsLogin: false, busy: false, message: '', info: null, form: {}, answers: {}, questions: [], receipt: null, seatReceipt: null, seatTickets: [], responseEditing: false, review: false, reviewRows: [], recoveryRows: [], answerErrors: {}, step: 0, answerPages: 1, completed: 0, answerTotal: 0, progress: 0, branchNotice: '', advancedEditing: false, edit: false, tab: 'edit', entries: [], page: 1, pages: 0, total: 0, typeLabels: ['单行文本','多行文本','单选','多选'], stateText: '', introText: '' },
  ...actions,
  toggleEntry(event) {
    if (this.data.busy || this.data.loading) return;
    const row = this.data.entries.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (row) this.setData({ expandedEntryId: this.data.expandedEntryId === row.id ? '' : row.id });
  },
  onLoad(options) {
    i18n.bind(this, text);this.setData({typeLabels:typeLabels()});
    if(this._unsubscribe)this._unsubscribe();
    this._ticket=(this._ticket||0)+1;this._seatTicket=(this._seatTicket||0)+1;this._context=(this._context||0)+1;this._loaded=false;this._hidden=false;this._disposed=false;this._resumeRead=false;this._recoveryDraft=null;this._teamConfirmation=null;
    this._options=options; this._seed=String(Math.random()); this._staff=options.kind==='staff';this._team=options.kind==='team';
    this._endpoint=this._team?'/api/team-core':this._staff?'/api/staff/batches/'+encodeURIComponent(options.id)+'/application':'/api/activities/'+encodeURIComponent(options.kind)+'/'+encodeURIComponent(options.id)+'/signup';
    this._readEndpoint=this._team?'/api/miniapp/team/recruitment/'+encodeURIComponent(options.id):this._staff?'/api/miniapp/staff/'+encodeURIComponent(options.id):this._endpoint;
    this.setData({staff:this._staff,team:this._team,applicationMode:this._staff||this._team,edit:!this._staff&&!this._team&&['manage','view'].includes(options.mode),loading:false,error:'',info:null,form:{},receipt:null,confirmedReceipt:null,confirmationMessage:'',answers:{},questions:[],reviewRows:[],recoveryRows:[],entries:[],responseEditing:false,review:false});
    if(session.subscribe)this._unsubscribe=session.subscribe(user=>{
      if(String(user&&user.id)===String(this._userId))return;
      this._ticket=(this._ticket||0)+1;this._seatTicket=(this._seatTicket||0)+1;this._context=(this._context||0)+1;this._loaded=false;this._resumeRead=false;this._recoveryDraft=null;this._teamConfirmation=null;
      this.setData({loading:false,info:null,receipt:null,seatReceipt:null,seatTickets:[],confirmedReceipt:null,confirmationMessage:'',answers:{},questions:[],reviewRows:[],recoveryRows:[],entries:[],responseEditing:false,review:false,needsLogin:!user});
      if(user&&!this._hidden)void this.loadSeatReceipt();
    });
  },
  onShow() {
    const relocalized=i18n.refreshIfStale?i18n.refreshIfStale(this):false;
    this.navTitle();
    if(this._disposed)return;this._hidden=false;const user=session.user();void this.loadSeatReceipt();
    const needsRead=!this._loaded||!this.data.info||String(user&&user.id)!==String(this._userId);
    if(this.data.busy){if(needsRead)this._resumeRead=true;else if(relocalized)this.onLocaleChange();return;}
    if(needsRead)return this.load();
    // Language changed while hidden: relabel in place; unsubmitted answers, step and review stay.
    if(relocalized)this.onLocaleChange();
    if(this._team){if(this.data.responseEditing||!this.data.receipt)this._recoveryDraft=this.draftSnapshot();return this.load();}
  },
  onHide() { this._hidden=true;this._resumeRead=false;this._ticket=(this._ticket||0)+1;this._seatTicket=(this._seatTicket||0)+1;if(this.data.loading||this.data.busy)this._loaded=false;this.setData({loading:false,seatReceipt:null,seatTickets:[]}); },
  onUnload() { i18n.unbind(this);this.onHide();this._disposed=true;this._recoveryDraft=null;this._teamConfirmation=null;if(this._unsubscribe)this._unsubscribe(); },
  navTitle() { i18n.navTitle(this._team?'代表队申请':this._staff?'骨干申请':this.data.edit?'报名问卷管理':'活动报名',this._team?'Team application':this._staff?'Staff application':this.data.edit?'Manage sign-up form':'Activity sign-up'); },
  onLocaleChange() {
    this.navTitle();
    const info=this.data.info,form=this.data.form;
    this.setData({typeLabels:typeLabels(),stateText:info?i18n.message(info.state||''):'',introText:this.introText(form)});
    if(form&&form.questions)this.setForm(form);
    this.relabelAnswers();
    void this.relocalize();
  },
  // Re-renders questions, review rows and the activity receipt from the data already on the
  // page (answers are never reset). Receipt objects keep their raw questions/answers.
  relabelAnswers() {
    const info=this.data.info,form=this.data.form;
    if(!info||!form||!form.questions)return;
    const patch={};
    if(!this._team&&!this._staff&&this.data.receipt&&this.data.receipt.questions)patch.receipt=this.receiptView(this.data.receipt);
    if(this.data.review)patch.reviewRows=this.receiptView({questions:questionnaire.visibleQuestions(form,this.data.answers),answers:this.data.answers}).rows;
    if(Object.keys(patch).length)this.setData(patch);
    if(!this.data.review)this.renderQuestions();
  },
  // English labels for the published form come from the server with an English request.
  // After switching to English, read them once (same endpoint, same version) without
  // replacing the form, answers or receipt state. No write is ever repeated.
  async relocalize() {
    if(this._team||this._staff||this.data.edit||!this._loaded||!this.data.info||this._hidden||this._disposed||this.data.busy)return;
    if(i18n.locale()==='zh'||(this._display&&this._display.locale===i18n.locale()))return;
    const read=this._localeRead=(this._localeRead||0)+1,ticket=this._ticket,userId=this._userId,endpoint=this._readEndpoint,version=this.data.info.version;
    try{
      const info=await http.request(endpoint,{raw:true,required:true,questionnaire:true});
      if(read!==this._localeRead||ticket!==this._ticket||!this.validRead(ticket,userId,endpoint)||info.version!==version||i18n.locale()==='zh'||this.data.busy)return;
      this._display=info.display&&typeof info.display==='object'?info.display:null;
      this.setData({info:{...this.data.info,title:brand.display(info.title)},introText:this.introText(this.data.form)});
      this.navTitle();this.relabelAnswers();
    }catch{/* Labels stay in the original language; nothing else changes. */}
  },
  receiptView(value) { return questionnaire.receipt(value,this._display); },
  introText(form) { const display=questionnaire.activeDisplay(this._display);return display&&typeof display.intro==='string'&&display.intro&&form&&form.intro?display.intro:''; },
  retry() { return this.load(); },
  async loadSeatReceipt() {
    const user=session.user(), options=this._options || {};
    if(!user || this.data.edit || !['events','community-posts'].includes(options.kind)) { this.setData({seatReceipt:null,seatTickets:[]}); return; }
    const ticket=this._seatTicket=(this._seatTicket||0)+1, userId=user.id;
    const current=()=>!this._hidden&&!this._disposed&&ticket===this._seatTicket&&String(session.user()&&session.user().id)===String(userId);
    const endpoint='/api/activities/'+encodeURIComponent(options.kind)+'/'+encodeURIComponent(options.id)+'/seating';
    try {
      const result=await http.request(endpoint,{raw:true,required:true});
      if(!current())return;
      const mine=result.mine;
      if(!mine){this.setData({seatReceipt:null,seatTickets:[]});return;}
      const seats=Array.isArray(mine.seats)?mine.seats:[];
      this.setData({seatReceipt:{status:mine.status,statusText:seatStatusLabel(mine.status)||i18n.t('处理中','Processing'),seats:seats.length?seats.map(seatLabel).join(i18n.t('、',', ')):(mine.requestedCount||0)+i18n.t(' 个座位',' seat(s)')},seatTickets:[]});
      if(mine.status!=='confirmed')return;
      const versions=new Map((result.ticketImages||[]).map(item=>[item.seat,item.version]));
      const tickets=await Promise.all(seats.map(async seat=>{
        const version=versions.get(seat);let path='';
        if(version)try{path=await http.download(endpoint+'/tickets/'+encodeURIComponent(seat)+'?v='+encodeURIComponent(version));}catch{}
        return {seat,label:seatLabel(seat),path,uploaded:Boolean(version)};
      }));
      if(current())this.setData({seatTickets:tickets});
    } catch { if(current())this.setData({seatReceipt:null,seatTickets:[]}); }
  },
  openSeatReceipt() { const options=this._options||{}; if(['events','community-posts'].includes(options.kind))navigation.go('activity-seating',{kind:options.kind,id:options.id}); },
  onPullDownRefresh() { void this.loadSeatReceipt(); return this.load().finally(()=>wx.stopPullDownRefresh()); },
  draftSnapshot() { const saved=this.data.receipt;return {userId:this._userId,context:this._context,endpoint:this._readEndpoint,version:this.data.info.version,receiptId:saved&&saved.id,
    revision:saved&&saved.updatedAt,answers:this.data.answers,responseEditing:this.data.responseEditing,review:this.data.review,step:this.data.step}; },
  validRead(ticket,userId,endpoint) { return !this._hidden&&!this._disposed&&ticket===this._ticket&&endpoint===this._readEndpoint&&String(session.user()&&session.user().id)===String(userId); },
  confirmTeamWrite(value,message,scope) {
    if(!this._team||this._disposed||scope.context!==this._context||scope.endpoint!==this._readEndpoint||String(scope.userId)!==String(session.user()&&session.user().id))return;
    const saved=team.receipt(value);
    if(!saved)throw new Error(i18n.t('保存结果暂不可用，请重新加载回执核对','The save result is unavailable. Reload the receipt to check.'));
    this._teamConfirmation={...scope,receipt:saved,message};
  },
  async completeOperation(draft) {
    if(this._disposed)return;this.setData({busy:false});
    if(!this._loaded)this._recoveryDraft=draft&&draft.context===this._context&&draft.endpoint===this._readEndpoint&&String(draft.userId)===String(session.user()&&session.user().id)?draft:null;
    if(this._resumeRead&&!this._hidden){
      this._resumeRead=false;
      await this.load();
    }
  },
  async load() {
    if(this.data.busy||this._hidden||this._disposed)return;
    // A previous success does not make an in-flight reload complete.
    this._loaded=false;this._resumeRead=false;
    const ticket=this._ticket=(this._ticket||0)+1;
    if(!protect(this)){this._loaded=false;this.setData({loading:false,info:null,receipt:null,answers:{},questions:[],reviewRows:[],recoveryRows:[],entries:[]});return;}
    const userId=this._userId=session.user().id,endpoint=this._readEndpoint;
    this.setData({loading:true,error:'',message:'',info:null,receipt:null,confirmedReceipt:null,confirmationMessage:''});
    try { const info=await http.request(endpoint+(this.data.edit?'?mode='+ (this._options.mode==='view'?'view':'manage'):''),{raw:true,required:true,questionnaire:true});
      if(!this.validRead(ticket,userId,endpoint))return;
      this._display=info.display&&typeof info.display==='object'?info.display:null;this.setData({loading:false,info:{...info,title:brand.display(info.title)},stateText:i18n.message(info.state||''),introText:this.introText(info.form),receipt:this._team?team.receipt(info.application):this._staff?staff.receipt(info.application):this.receiptView(info.signup),answers:{},responseEditing:false,review:false,reviewRows:[],recoveryRows:[],step:0,answerErrors:{}});this.setForm(info.form);this.renderQuestions();this.navTitle();
      const draft=this._recoveryDraft,saved=this.data.receipt;
      const unchanged=draft&&draft.context===this._context&&String(draft.userId)===String(userId)&&draft.endpoint===endpoint&&
        (saved?String(saved.id)===String(draft.receiptId)&&saved.updatedAt===draft.revision:!draft.receiptId);
      const allowed=draft&&(this._team?info.actions&&(info.actions.draft||info.actions.submit):this._staff?info.actions&&info.actions[draft.responseEditing?'edit':'submit']:info.state==='报名开放');
      if(unchanged&&allowed){
        const answers=questionnaire.initialAnswers(this.data.form,draft.answers),review=draft.review&&draft.version===info.version;
        this.setData({answers,responseEditing:draft.responseEditing,review,step:draft.step,
          reviewRows:review?this.receiptView({questions:questionnaire.visibleQuestions(this.data.form,answers),answers}).rows:[],message:i18n.t('提交状态已刷新，尚未保存的内容已保留，请核对后重试。','Submission status refreshed. Unsaved answers are kept; check them and try again.')});
        this.renderQuestions();
      }else if(unchanged&&this._team){
        const answers=questionnaire.initialAnswers(this.data.form,draft.answers);
        const rows=this.receiptView({questions:questionnaire.visibleQuestions(this.data.form,answers),answers}).rows;
        this.setData({recoveryRows:rows,message:rows.length?i18n.t('当前状态只读，尚未保存的内容仅在本页保留；恢复操作需以服务端允许的动作核对。','The current state is read-only. Unsaved answers are kept on this page only; recovery depends on the actions the server allows.'):''});
      }
      this._recoveryDraft=this._team&&unchanged&&!allowed&&this.data.recoveryRows.length?draft:null;
      this._loaded=true;this._teamConfirmation=null;
      if(this.data.edit&&!info.canManage&&info.canViewSignups){this.setData({tab:'entries'});await this.loadEntries(1);}
    }catch(cause){if(this.validRead(ticket,userId,endpoint)){
      this._loaded=false;error(this,cause);
      const confirmed=this._teamConfirmation;
      if(cause.status&&cause.status<500&&cause.status!==429)this._teamConfirmation=null;
      else if(confirmed&&confirmed.context===this._context&&confirmed.endpoint===endpoint&&String(confirmed.userId)===String(userId))
        this.setData({confirmedReceipt:confirmed.receipt,confirmationMessage:confirmed.message+i18n.t(' 当前状态读取失败，请重试核对允许的操作。',' The current status could not be read; retry to check the available actions.')});
    }}
  },
  setForm(form) { form=form||questionnaire.normalizeSignup({enabled:false,questions:[]});const start=localParts(form.start),end=localParts(form.end);this.setData({form,advancedEditing:form.questions.some(q=>!types.includes(q.type)||q.showWhen||q.display||q.jumps?.length),editQuestions:form.questions.map(q=>({...q,typeIndex:types.indexOf(q.type),typeLabel:i18n.t(questionnaire.questionTypes[q.type],typesEn[q.type]),optionsText:q.options.join('\n')})),startDate:start.date,startTime:start.time,endDate:end.date,endTime:end.time}); },
  renderQuestions() { this.setData(questionnaire.presentation(this.data.form,this.data.answers,this.data.step,this._seed,this.data.answerErrors,this._display)); },
  change(id,value) { if(this.data.busy)return;this.setData({answers:questionnaire.changeAnswer(this.data.form,this.data.answers,id,value),answerErrors:{},message:'',review:false});this.renderQuestions(); },
  answer(event) { this.change(event.currentTarget.dataset.id,event.detail.value); },
  choose(event) { const q=this.data.questions.find(q=>q.id===event.currentTarget.dataset.id);if(q)this.change(q.id,q.pickerValues[Number(event.detail.value)]||''); },
  clearAnswer(event) { const q=this.data.form.questions.find(q=>q.id===event.currentTarget.dataset.id);if(q)this.change(q.id,['ranking','multiple','group'].includes(q.type)?[]:questionnaire.hasRows(q.type)?{}:''); },
  rowAnswer(event) { const {id,row}=event.currentTarget.dataset,q=this.data.form.questions.find(q=>q.id===id);if(!q||!q.rows.includes(row))return;this.change(id,{...this.data.answers[id],[row]:event.detail.value}); },
  rankAnswer(event) { const {id,index}=event.currentTarget.dataset,q=this.data.questions.find(q=>q.id===id);if(!q)return;const rank=q.rankRows[Number(index)];if(!rank)return;const values=Array.from({length:q.options.length},(_,i)=>(this.data.answers[id]||[])[i]||'');values[Number(index)]=rank.pickerValues[Number(event.detail.value)]||'';this.change(id,values); },
  groupAnswer(event) { const {id,index,field}=event.currentTarget.dataset,q=this.data.form.questions.find(q=>q.id===id);if(!q||q.type!=='group')return;const definition=q.fields.find(item=>item.id===field),i=Number(index);if(!definition||!Number.isInteger(i)||i<0||i>=q.maxEntries)return;const rows=questionnaire.entryRows(q,this.data.answers[id]);if(i>=rows.length)return;rows[i]={...rows[i],[field]:definition.type==='select'?(['',...definition.options][Number(event.detail.value)]||''):event.detail.value};this.change(id,rows); },
  addEntry(event) { const q=this.data.form.questions.find(q=>q.id===event.currentTarget.dataset.id);if(!q||q.type!=='group')return;const rows=questionnaire.entryRows(q,this.data.answers[q.id]);if(rows.length<q.maxEntries)this.change(q.id,[...rows,{}]); },
  removeEntry(event) { const {id,index}=event.currentTarget.dataset,q=this.data.form.questions.find(q=>q.id===id);if(!q||q.type!=='group')return;const rows=questionnaire.entryRows(q,this.data.answers[id]),i=Number(index);if(Number.isInteger(i)&&i>=0&&i<rows.length&&rows.length>q.minEntries)this.change(id,rows.filter((_,n)=>n!==i)); },
  checkAnswers(all) {
    const route=questionnaire.questionRoute(this.data.form,this.data.answers),pages=questionnaire.questionPages(route.questions,this.data.form.pageSize||5),scope=all?route.questions:pages[this.data.step],errors=questionnaire.answerErrors(this.data.form,this.data.answers),first=scope.find(q=>errors[q.id]);
    if(!first)return true;
    const step=pages.findIndex(page=>page.some(q=>q.id===first.id));this.setData({answerErrors:errors,step,review:false,message:i18n.t('请检查提示的题目后继续。','Check the highlighted questions to continue.')});this.renderQuestions();wx.pageScrollTo({selector:'#question-'+first.id,duration:0});return false;
  },
  answerNext() { if(this.data.busy||!this.checkAnswers(this.data.step===this.data.answerPages-1))return;if(this.data.step<this.data.answerPages-1){this.setData({step:this.data.step+1});this.renderQuestions();}else{const answers=questionnaire.validateAnswers(this.data.form,this.data.answers);this.setData({review:true,reviewRows:this.receiptView({questions:questionnaire.visibleQuestions(this.data.form,answers),answers}).rows,message:''});}wx.pageScrollTo({scrollTop:0,duration:0}); },
  answerPrevious() { if(this.data.busy)return;this.setData(this.data.review?{review:false}:{step:Math.max(0,this.data.step-1)});this.renderQuestions();wx.pageScrollTo({scrollTop:0,duration:0}); },
  editAnswers() { if(this.data.busy||!this.data.info||!this.data.receipt||!(this._staff||this._team?this.data.info.actions&&this.data.info.actions.edit:this.data.info.state==='报名开放'))return;this.setData({responseEditing:true,answers:questionnaire.initialAnswers(this.data.form,this.data.receipt.answers),answerErrors:{},step:0,review:false,message:''});this.renderQuestions(); },
  async refreshStaff(message) {
    const ticket=this._ticket,userId=this._userId,endpoint=this._readEndpoint;
    this.setData({info:{...this.data.info,actions:{}}});
    try {
      const info=await http.request(endpoint,{raw:true,required:true,questionnaire:true});
      if(!this.validRead(ticket,userId,endpoint))return;
      if(this._team)this._teamConfirmation=null;
      this._display=info.display&&typeof info.display==='object'?info.display:null;this.setData({info:{...info,title:brand.display(info.title)},stateText:i18n.message(info.state||''),introText:this.introText(info.form),receipt:this._team?team.receipt(info.application):staff.receipt(info.application),message});
      if(this._staff||this._team){
        this.setForm(info.form);
        this.setData({review:false,reviewRows:[],answerErrors:{},...(this.data.responseEditing?{answers:questionnaire.initialAnswers(this.data.form,this.data.answers)}:{})});
        this.renderQuestions();
      }
    } catch(cause) {
      if(this.validRead(ticket,userId,endpoint))this.setData({message:message+i18n.t('；回执状态刷新失败：','; receipt refresh failed: ')+cause.message+i18n.t('。请重新加载确认允许的操作。','. Reload to confirm the available actions.')});
    }
  },
  async submit() {
    if(this._team)return this.writeTeam('submit');
    if(this.data.busy||this.data.loading||!this.data.info||this._hidden||this._disposed||!this.data.review||!this.checkAnswers(true)||!session.user()||String(session.user().id)!==String(this._userId))return;
    if(this._staff&&!(this.data.info.actions&&this.data.info.actions[this.data.responseEditing?'edit':'submit']))return;
    const userId=this._userId,ticket=this._ticket;
    const draft={userId,context:this._context,endpoint:this._readEndpoint,version:this.data.info.version,receiptId:this.data.receipt&&this.data.receipt.id,
      revision:this.data.receipt&&this.data.receipt.updatedAt,answers:this.data.answers,responseEditing:this.data.responseEditing,review:this.data.review,step:this.data.step};
    this.setData({busy:true,message:''});
    try{const updating=this.data.responseEditing,reapplying=this._staff&&this.data.receipt&&this.data.receipt.status==='withdrawn',result=await http.request(this._endpoint,{raw:true,method:'POST',required:true,questionnaire:true,data:{...(updating&&!reapplying?{action:'edit'}:{}),version:this.data.info.version,...(this.data.receipt&&(updating||this._staff)?{revision:this.data.receipt.updatedAt}:{}),answers:questionnaire.validateAnswers(this.data.form,this.data.answers)}});
      if(ticket!==this._ticket||String(session.user()&&session.user().id)!==String(userId))return;
      const message=this._staff?i18n.t('骨干申请已保存，请查看本人回执','Staff application saved. See your receipt.'):i18n.message(result.message||'报名已保存');
      this.setData({receipt:this._staff?staff.receipt(result.application):this.receiptView(result.signup),responseEditing:false,review:false,answers:{},message});
      if(this._staff)await this.refreshStaff(message);
    }
    catch(cause){if(ticket===this._ticket&&String(session.user()&&session.user().id)===String(userId))this.setData({message:cause.message});}finally{await this.completeOperation(draft);}
  },
  saveDraft() { if(this._team)return this.writeTeam('draft'); },
  async writeTeam(action) {
    if(!this._team||this.data.busy||this.data.loading||!this.data.info||this._hidden||this._disposed||!session.user()||String(session.user().id)!==String(this._userId))return;
    if(!this.data.info.actions||!this.data.info.actions[action]||(action==='submit'&&(!this.data.review||!this.checkAnswers(true))))return;
    const userId=this._userId,ticket=this._ticket,saved=this.data.receipt;
    const draft={userId,context:this._context,endpoint:this._readEndpoint,version:this.data.info.version,receiptId:saved&&saved.id,
      revision:saved&&saved.updatedAt,answers:this.data.answers,responseEditing:this.data.responseEditing,review:this.data.review,step:this.data.step};
    this.setData({busy:true,message:''});
    try {
      const answers=action==='submit'?questionnaire.validateAnswers(this.data.form,this.data.answers):questionnaire.sanitizeDraft(this.data.form,this.data.answers);
      const result=await team.post({operation:'save-join',id:this._options.id,action,version:this.data.info.version,...(saved?{revision:saved.updatedAt}:{}),answers});
      const message=action==='draft'?i18n.t('草稿已保存，可继续填写；提交后由管理员审核。','Draft saved. Keep filling in; admins review it after you submit.'):i18n.t('代表队申请已提交，请查看本人回执。','Team application submitted. See your receipt.');
      this.confirmTeamWrite(result.result,message,{userId,context:draft.context,endpoint:draft.endpoint});
      if(!this.validRead(ticket,userId,this._readEndpoint))return;
      this.setData({receipt:team.receipt(result.result),responseEditing:action==='draft',review:false,answers:action==='draft'?questionnaire.initialAnswers(this.data.form,result.result.answers):{},message});
      await this.refreshStaff(message);
    }catch(cause){if(this.validRead(ticket,userId,this._readEndpoint))this.setData({message:cause.message});}finally{await this.completeOperation(draft);}
  },
  async withdraw() {
    if(this.data.busy||this.data.loading||this._hidden||this._disposed||!this.data.receipt||!this.data.info||!this.data.info.actions||!this.data.info.actions.withdraw)return;
    const userId=this._userId,ticket=this._ticket,saved=this.data.receipt,context=this._context,endpoint=this._readEndpoint;
    this.setData({busy:true,message:''});
    try {
      const confirm=await new Promise((resolve,reject)=>wx.showModal({title:this._team?i18n.t('撤回代表队申请','Withdraw team application'):i18n.t('撤回骨干申请','Withdraw staff application'),content:i18n.t('确认撤回本批次申请？开放期间可重提同一申请编号。','Withdraw your application for this batch? While it is open you can resubmit under the same number.'),...(i18n.locale()==='en'?{confirmText:'Withdraw',cancelText:'Cancel'}:{}),success:resolve,fail:()=>reject(new Error(i18n.message('确认未完成，请重试')))}));
      if(!confirm.confirm||ticket!==this._ticket||String(session.user()&&session.user().id)!==String(userId))return;
      const result=this._team?await team.post({operation:'withdraw-join',id:saved.id,revision:saved.updatedAt}):await http.request(this._endpoint,{raw:true,required:true,questionnaire:true,method:'POST',data:{action:'withdraw',revision:saved.updatedAt}});
      if(this._team)this.confirmTeamWrite(result.result,i18n.t('申请已撤回','Application withdrawn'),{userId,context,endpoint});
      if(ticket!==this._ticket||String(session.user()&&session.user().id)!==String(userId))return;
      this.setData({receipt:this._team?team.receipt(result.result):staff.receipt(result.application),responseEditing:false,review:false,answers:{},message:i18n.t('申请已撤回','Application withdrawn')});
      await this.refreshStaff(i18n.t('申请已撤回','Application withdrawn'));
    }catch(cause){if(ticket===this._ticket)this.setData({message:cause.message});}finally{await this.completeOperation();}
  },
  staffReview() { if(this.data.info&&this.data.info.actions&&this.data.info.actions.review)navigation.go('staff-review',{id:this._options.id}); },
  teamReview() { if(this._team&&this.data.info&&this.data.info.actions&&this.data.info.actions.review)navigation.go('team-review',{team:this.data.info.teamID}); },
  websiteEditor() { wx.setClipboardData({data:config.origin+'/activities/'+encodeURIComponent(this._options.kind)+'/'+encodeURIComponent(this._options.id)+'/manage'}); },
  manage() { if(this.data.info&&(this.data.info.canManage||this.data.info.canViewSignups))navigation.go('signup',{kind:this._options.kind,id:this._options.id,mode:this.data.info.canManage?'manage':'view'}); },
  field(event) { const key=event.currentTarget.dataset.key;this.setForm({...this.data.form,[key]:event.detail.value}); },
  time(event) {
    const key=event.currentTarget.dataset.key,part=event.currentTarget.dataset.part,current=localParts(this.data.form[key]);current[part]=event.detail.value;
    if(!current.date)current.date=localParts(new Date().toISOString()).date;if(!current.time)current.time=key==='end'?'23:59':'00:00';
    this.setForm({...this.data.form,[key]:new Date(current.date+'T'+current.time+':00').toISOString()});
  },
  clearTime(event) { this.setForm({...this.data.form,[event.currentTarget.dataset.key]:''}); },
  question(event) { const index=Number(event.currentTarget.dataset.index),key=event.currentTarget.dataset.key;let value=event.detail.value;
    if(key==='type')value=types[Number(value)];if(key==='options')value=value.split('\n');const questions=this.data.form.questions.map((q,i)=>i===index?{...q,[key]:value}:q);this.setForm({...this.data.form,questions});
  },
  add() { if(this.data.advancedEditing)return;this.setForm({...this.data.form,questions:[...this.data.form.questions,{id:'q'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),label:'',type:'text',required:true,options:[]}]}); },
  move(event) { const i=Number(event.currentTarget.dataset.index),j=i+Number(event.currentTarget.dataset.direction),questions=[...this.data.form.questions];if(j<0||j>=questions.length)return;[questions[i],questions[j]]=[questions[j],questions[i]];this.setForm({...this.data.form,questions}); },
  remove(event) { this.setForm({...this.data.form,questions:this.data.form.questions.filter((_,i)=>i!==Number(event.currentTarget.dataset.index))}); },
  async save() { if(this.data.busy||this.data.advancedEditing||!this.data.info||!this.data.info.canManage)return;const ticket=this._ticket;this.setData({busy:true,message:''});try{const result=await http.request(this._endpoint,{raw:true,required:true,questionnaire:true,method:'PUT',data:{version:this.data.info.version,form:this.data.form}});if(ticket!==this._ticket)return;this.setData({info:{...this.data.info,version:result.version},message:result.message});this.setForm(result.form);}catch(cause){if(ticket===this._ticket)this.setData({message:cause.message});}finally{await this.completeOperation();} },
  tab(event) { if(this.data.busy||!this.data.info)return;const tab=event.currentTarget.dataset.tab;if(tab==='edit'&&!this.data.info.canManage||tab==='entries'&&!this.data.info.canViewSignups||!['edit','entries'].includes(tab))return;this.setData({tab,message:''});if(tab==='entries')this.loadEntries(1); },
  async loadEntries(page) { if(this.data.busy||!this.data.info||!this.data.info.canViewSignups)return;const ticket=this._ticket;this.setData({busy:true,message:''});try{const result=await http.request(this._endpoint+'?mode=entries&page='+page,{raw:true,required:true,questionnaire:true});if(ticket!==this._ticket)return;this.setData({entries:result.docs.map(doc=>this.receiptView(doc)),page:result.page,pages:result.totalPages,total:result.totalDocs});}catch(cause){if(ticket===this._ticket)this.setData({message:cause.message});}finally{await this.completeOperation();} },
  previous() { if(this.data.page>1)this.loadEntries(this.data.page-1); },
  next() { if(this.data.page<this.data.pages)this.loadEntries(this.data.page+1); },
}));
