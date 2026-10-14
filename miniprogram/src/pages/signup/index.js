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
const receipt = questionnaire.receipt;
function localParts(value) { if (!value) return { date: '', time: '' }; const d = new Date(value), pad = v => String(v).padStart(2,'0'); return { date: d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()), time: pad(d.getHours())+':'+pad(d.getMinutes()) }; }
Page(withVisualTheme({
  data: { expandedEntryId: '', loading: true, error: '', needsLogin: false, busy: false, message: '', info: null, form: {}, answers: {}, questions: [], receipt: null, responseEditing: false, review: false, reviewRows: [], recoveryRows: [], answerErrors: {}, step: 0, answerPages: 1, completed: 0, answerTotal: 0, progress: 0, branchNotice: '', advancedEditing: false, edit: false, tab: 'edit', entries: [], page: 1, pages: 0, total: 0, typeLabels: ['单行文本','多行文本','单选','多选'] },
  ...actions,
  toggleEntry(event) {
    if (this.data.busy || this.data.loading) return;
    const row = this.data.entries.find(value => String(value.id) === String(event.currentTarget.dataset.id));
    if (row) this.setData({ expandedEntryId: this.data.expandedEntryId === row.id ? '' : row.id });
  },
  onLoad(options) {
    if(this._unsubscribe)this._unsubscribe();
    this._ticket=(this._ticket||0)+1;this._context=(this._context||0)+1;this._loaded=false;this._hidden=false;this._disposed=false;this._resumeRead=false;this._recoveryDraft=null;this._teamConfirmation=null;
    this._options=options; this._seed=String(Math.random()); this._staff=options.kind==='staff';this._team=options.kind==='team';
    this._endpoint=this._team?'/api/team-core':this._staff?'/api/staff/batches/'+encodeURIComponent(options.id)+'/application':'/api/activities/'+encodeURIComponent(options.kind)+'/'+encodeURIComponent(options.id)+'/signup';
    this._readEndpoint=this._team?'/api/miniapp/team/recruitment/'+encodeURIComponent(options.id):this._staff?'/api/miniapp/staff/'+encodeURIComponent(options.id):this._endpoint;
    this.setData({staff:this._staff,team:this._team,applicationMode:this._staff||this._team,edit:!this._staff&&!this._team&&['manage','view'].includes(options.mode),loading:false,error:'',info:null,form:{},receipt:null,confirmedReceipt:null,confirmationMessage:'',answers:{},questions:[],reviewRows:[],recoveryRows:[],entries:[],responseEditing:false,review:false});
    if(session.subscribe)this._unsubscribe=session.subscribe(user=>{
      if(String(user&&user.id)===String(this._userId))return;
      this._ticket=(this._ticket||0)+1;this._context=(this._context||0)+1;this._loaded=false;this._resumeRead=false;this._recoveryDraft=null;this._teamConfirmation=null;
      this.setData({loading:false,info:null,receipt:null,confirmedReceipt:null,confirmationMessage:'',answers:{},questions:[],reviewRows:[],recoveryRows:[],entries:[],responseEditing:false,review:false,needsLogin:!user});
    });
  },
  onShow() {
    if(this._disposed)return;this._hidden=false;const user=session.user();
    const needsRead=!this._loaded||!this.data.info||String(user&&user.id)!==String(this._userId);
    if(this.data.busy){if(needsRead)this._resumeRead=true;return;}
    if(needsRead)return this.load();
    if(this._team){if(this.data.responseEditing||!this.data.receipt)this._recoveryDraft=this.draftSnapshot();return this.load();}
  },
  onHide() { this._hidden=true;this._resumeRead=false;this._ticket=(this._ticket||0)+1;if(this.data.loading||this.data.busy)this._loaded=false;this.setData({loading:false}); },
  onUnload() { this.onHide();this._disposed=true;this._recoveryDraft=null;this._teamConfirmation=null;if(this._unsubscribe)this._unsubscribe(); },
  retry() { return this.load(); },
  onPullDownRefresh() { return this.load().finally(()=>wx.stopPullDownRefresh()); },
  draftSnapshot() { const saved=this.data.receipt;return {userId:this._userId,context:this._context,endpoint:this._readEndpoint,version:this.data.info.version,receiptId:saved&&saved.id,
    revision:saved&&saved.updatedAt,answers:this.data.answers,responseEditing:this.data.responseEditing,review:this.data.review,step:this.data.step}; },
  validRead(ticket,userId,endpoint) { return !this._hidden&&!this._disposed&&ticket===this._ticket&&endpoint===this._readEndpoint&&String(session.user()&&session.user().id)===String(userId); },
  confirmTeamWrite(value,message,scope) {
    if(!this._team||this._disposed||scope.context!==this._context||scope.endpoint!==this._readEndpoint||String(scope.userId)!==String(session.user()&&session.user().id))return;
    const saved=team.receipt(value);
    if(!saved)throw new Error('保存结果暂不可用，请重新加载回执核对');
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
      this.setData({loading:false,info:{...info,title:brand.display(info.title)},receipt:this._team?team.receipt(info.application):this._staff?staff.receipt(info.application):receipt(info.signup),answers:{},responseEditing:false,review:false,reviewRows:[],recoveryRows:[],step:0,answerErrors:{}});this.setForm(info.form);this.renderQuestions();wx.setNavigationBarTitle({title:this._team?'代表队申请':this._staff?'骨干申请':this.data.edit?'报名问卷管理':'活动报名'});
      const draft=this._recoveryDraft,saved=this.data.receipt;
      const unchanged=draft&&draft.context===this._context&&String(draft.userId)===String(userId)&&draft.endpoint===endpoint&&
        (saved?String(saved.id)===String(draft.receiptId)&&saved.updatedAt===draft.revision:!draft.receiptId);
      const allowed=draft&&(this._team?info.actions&&(info.actions.draft||info.actions.submit):this._staff?info.actions&&info.actions[draft.responseEditing?'edit':'submit']:info.state==='报名开放');
      if(unchanged&&allowed){
        const answers=questionnaire.initialAnswers(this.data.form,draft.answers),review=draft.review&&draft.version===info.version;
        this.setData({answers,responseEditing:draft.responseEditing,review,step:draft.step,
          reviewRows:review?receipt({questions:questionnaire.visibleQuestions(this.data.form,answers),answers}).rows:[],message:'提交状态已刷新，尚未保存的内容已保留，请核对后重试。'});
        this.renderQuestions();
      }else if(unchanged&&this._team){
        const answers=questionnaire.initialAnswers(this.data.form,draft.answers);
        const rows=receipt({questions:questionnaire.visibleQuestions(this.data.form,answers),answers}).rows;
        this.setData({recoveryRows:rows,message:rows.length?'当前状态只读，尚未保存的内容仅在本页保留；恢复操作需以服务端允许的动作核对。':''});
      }
      this._recoveryDraft=this._team&&unchanged&&!allowed&&this.data.recoveryRows.length?draft:null;
      this._loaded=true;this._teamConfirmation=null;
      if(this.data.edit&&!info.canManage&&info.canViewSignups){this.setData({tab:'entries'});await this.loadEntries(1);}
    }catch(cause){if(this.validRead(ticket,userId,endpoint)){
      this._loaded=false;error(this,cause);
      const confirmed=this._teamConfirmation;
      if(cause.status&&cause.status<500&&cause.status!==429)this._teamConfirmation=null;
      else if(confirmed&&confirmed.context===this._context&&confirmed.endpoint===endpoint&&String(confirmed.userId)===String(userId))
        this.setData({confirmedReceipt:confirmed.receipt,confirmationMessage:confirmed.message+' 当前状态读取失败，请重试核对允许的操作。'});
    }}
  },
  setForm(form) { form=form||questionnaire.normalizeSignup({enabled:false,questions:[]});const start=localParts(form.start),end=localParts(form.end);this.setData({form,advancedEditing:form.questions.some(q=>!types.includes(q.type)||q.showWhen||q.display||q.jumps?.length),editQuestions:form.questions.map(q=>({...q,typeIndex:types.indexOf(q.type),typeLabel:questionnaire.questionTypes[q.type],optionsText:q.options.join('\n')})),startDate:start.date,startTime:start.time,endDate:end.date,endTime:end.time}); },
  renderQuestions() { this.setData(questionnaire.presentation(this.data.form,this.data.answers,this.data.step,this._seed,this.data.answerErrors)); },
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
    const step=pages.findIndex(page=>page.some(q=>q.id===first.id));this.setData({answerErrors:errors,step,review:false,message:'请检查提示的题目后继续。'});this.renderQuestions();wx.pageScrollTo({selector:'#question-'+first.id,duration:0});return false;
  },
  answerNext() { if(this.data.busy||!this.checkAnswers(this.data.step===this.data.answerPages-1))return;if(this.data.step<this.data.answerPages-1){this.setData({step:this.data.step+1});this.renderQuestions();}else{const answers=questionnaire.validateAnswers(this.data.form,this.data.answers);this.setData({review:true,reviewRows:receipt({questions:questionnaire.visibleQuestions(this.data.form,answers),answers}).rows,message:''});}wx.pageScrollTo({scrollTop:0,duration:0}); },
  answerPrevious() { if(this.data.busy)return;this.setData(this.data.review?{review:false}:{step:Math.max(0,this.data.step-1)});this.renderQuestions();wx.pageScrollTo({scrollTop:0,duration:0}); },
  editAnswers() { if(this.data.busy||!this.data.info||!this.data.receipt||!(this._staff||this._team?this.data.info.actions&&this.data.info.actions.edit:this.data.info.state==='报名开放'))return;this.setData({responseEditing:true,answers:questionnaire.initialAnswers(this.data.form,this.data.receipt.answers),answerErrors:{},step:0,review:false,message:''});this.renderQuestions(); },
  async refreshStaff(message) {
    const ticket=this._ticket,userId=this._userId,endpoint=this._readEndpoint;
    this.setData({info:{...this.data.info,actions:{}}});
    try {
      const info=await http.request(endpoint,{raw:true,required:true,questionnaire:true});
      if(!this.validRead(ticket,userId,endpoint))return;
      if(this._team)this._teamConfirmation=null;
      this.setData({info:{...info,title:brand.display(info.title)},receipt:this._team?team.receipt(info.application):staff.receipt(info.application),message});
      if(this._staff||this._team){
        this.setForm(info.form);
        this.setData({review:false,reviewRows:[],answerErrors:{},...(this.data.responseEditing?{answers:questionnaire.initialAnswers(this.data.form,this.data.answers)}:{})});
        this.renderQuestions();
      }
    } catch(cause) {
      if(this.validRead(ticket,userId,endpoint))this.setData({message:message+'；回执状态刷新失败：'+cause.message+'。请重新加载确认允许的操作。'});
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
      const message=this._staff?'骨干申请已保存，请查看本人回执':result.message||'报名已保存';
      this.setData({receipt:this._staff?staff.receipt(result.application):receipt(result.signup),responseEditing:false,review:false,answers:{},message});
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
      const message=action==='draft'?'草稿已保存，可继续填写；提交后由管理员审核。':'代表队申请已提交，请查看本人回执。';
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
      const confirm=await new Promise((resolve,reject)=>wx.showModal({title:this._team?'撤回代表队申请':'撤回骨干申请',content:'确认撤回本批次申请？开放期间可重提同一申请编号。',success:resolve,fail:()=>reject(new Error('确认未完成，请重试'))}));
      if(!confirm.confirm||ticket!==this._ticket||String(session.user()&&session.user().id)!==String(userId))return;
      const result=this._team?await team.post({operation:'withdraw-join',id:saved.id,revision:saved.updatedAt}):await http.request(this._endpoint,{raw:true,required:true,questionnaire:true,method:'POST',data:{action:'withdraw',revision:saved.updatedAt}});
      if(this._team)this.confirmTeamWrite(result.result,'申请已撤回',{userId,context,endpoint});
      if(ticket!==this._ticket||String(session.user()&&session.user().id)!==String(userId))return;
      this.setData({receipt:this._team?team.receipt(result.result):staff.receipt(result.application),responseEditing:false,review:false,answers:{},message:'申请已撤回'});
      await this.refreshStaff('申请已撤回');
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
  async loadEntries(page) { if(this.data.busy||!this.data.info||!this.data.info.canViewSignups)return;const ticket=this._ticket;this.setData({busy:true,message:''});try{const result=await http.request(this._endpoint+'?mode=entries&page='+page,{raw:true,required:true,questionnaire:true});if(ticket!==this._ticket)return;this.setData({entries:result.docs.map(receipt),page:result.page,pages:result.totalPages,total:result.totalDocs});}catch(cause){if(ticket===this._ticket)this.setData({message:cause.message});}finally{await this.completeOperation();} },
  previous() { if(this.data.page>1)this.loadEntries(this.data.page-1); },
  next() { if(this.data.page<this.data.pages)this.loadEntries(this.data.page+1); },
}));
