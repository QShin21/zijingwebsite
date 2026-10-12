const brand = require('../../lib/brand');
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const questionnaire = require('../../lib/questionnaire');
const config = require('../../config');
const staff = require('../../lib/staff');
const { actions, protect, error } = require('../../lib/page');
const types = ['text', 'textarea', 'single', 'multiple'];
const receipt = questionnaire.receipt;
function localParts(value) { if (!value) return { date: '', time: '' }; const d = new Date(value), pad = v => String(v).padStart(2,'0'); return { date: d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()), time: pad(d.getHours())+':'+pad(d.getMinutes()) }; }
Page({
  data: { loading: true, error: '', needsLogin: false, busy: false, message: '', info: null, form: {}, answers: {}, questions: [], receipt: null, responseEditing: false, review: false, reviewRows: [], answerErrors: {}, step: 0, answerPages: 1, completed: 0, answerTotal: 0, progress: 0, branchNotice: '', advancedEditing: false, edit: false, tab: 'edit', entries: [], page: 1, pages: 0, total: 0, typeLabels: ['单行文本','多行文本','单选','多选'] },
  ...actions,
  onLoad(options) {
    this._options=options; this._seed=String(Math.random()); this._staff=options.kind==='staff';
    this._endpoint=this._staff?'/api/staff/batches/'+encodeURIComponent(options.id)+'/application':'/api/activities/'+encodeURIComponent(options.kind)+'/'+encodeURIComponent(options.id)+'/signup';
    this._readEndpoint=this._staff?'/api/miniapp/staff/'+encodeURIComponent(options.id):this._endpoint;
    this.setData({staff:this._staff,edit:!this._staff&&['manage','view'].includes(options.mode)});
    if(session.subscribe)this._unsubscribe=session.subscribe(user=>{
      if(String(user&&user.id)===String(this._userId))return;
      this._ticket=(this._ticket||0)+1;this._loaded=false;
      this.setData({loading:false,info:null,receipt:null,answers:{},questions:[],reviewRows:[],entries:[],responseEditing:false,review:false,needsLogin:!user});
    });
  },
  onShow() { this._hidden=false;const user=session.user(); if(!this.data.busy&&(!this._loaded || String(user && user.id)!==String(this._userId)))return this.load(); },
  onHide() { this._hidden=true;this._ticket=(this._ticket||0)+1;if(this.data.busy)this._loaded=false; },
  onUnload() { this.onHide();if(this._unsubscribe)this._unsubscribe(); },
  retry() { this.load(); },
  async load() {
    if(this.data.busy)return;
    const ticket=this._ticket=(this._ticket||0)+1;
    if(!protect(this)){this._loaded=false;this.setData({loading:false,info:null,receipt:null,answers:{},questions:[],entries:[]});return;}
    this._userId=session.user().id;this.setData({loading:true,error:'',message:'',info:null,receipt:null});
    try { const info=await http.request(this._readEndpoint+(this.data.edit?'?mode='+ (this._options.mode==='view'?'view':'manage'):''),{raw:true,required:true,questionnaire:true});
      if(ticket!==this._ticket||String(session.user()&&session.user().id)!==String(this._userId))return;this._loaded=true;
      this.setData({loading:false,info:{...info,title:brand.display(info.title)},receipt:this._staff?staff.receipt(info.application):receipt(info.signup),answers:{},responseEditing:false,review:false,step:0,answerErrors:{}});this.setForm(info.form);this.renderQuestions();wx.setNavigationBarTitle({title:this._staff?'骨干申请':this.data.edit?'报名问卷管理':'活动报名'});
      if(this.data.edit&&!info.canManage&&info.canViewSignups){this.setData({tab:'entries'});await this.loadEntries(1);}
    }catch(cause){if(ticket===this._ticket)error(this,cause);}
  },
  setForm(form) { const start=localParts(form.start),end=localParts(form.end);this.setData({form,advancedEditing:form.questions.some(q=>!types.includes(q.type)||q.showWhen||q.display||q.jumps?.length),editQuestions:form.questions.map(q=>({...q,typeIndex:types.indexOf(q.type),typeLabel:questionnaire.questionTypes[q.type],optionsText:q.options.join('\n')})),startDate:start.date,startTime:start.time,endDate:end.date,endTime:end.time}); },
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
    const step=pages.findIndex(page=>page.some(q=>q.id===first.id));this.setData({answerErrors:errors,step,review:false,message:'请检查提示的题目后继续。'});this.renderQuestions();wx.pageScrollTo({selector:'#question-'+first.id,duration:200});return false;
  },
  answerNext() { if(this.data.busy||!this.checkAnswers(this.data.step===this.data.answerPages-1))return;if(this.data.step<this.data.answerPages-1){this.setData({step:this.data.step+1});this.renderQuestions();}else{const answers=questionnaire.validateAnswers(this.data.form,this.data.answers);this.setData({review:true,reviewRows:receipt({questions:questionnaire.visibleQuestions(this.data.form,answers),answers}).rows,message:''});}wx.pageScrollTo({scrollTop:0,duration:200}); },
  answerPrevious() { if(this.data.busy)return;this.setData(this.data.review?{review:false}:{step:Math.max(0,this.data.step-1)});this.renderQuestions();wx.pageScrollTo({scrollTop:0,duration:200}); },
  editAnswers() { if(this.data.busy||!this.data.receipt||!(this._staff?this.data.info.actions&&this.data.info.actions.edit:this.data.info.state==='报名开放'))return;this.setData({responseEditing:true,answers:questionnaire.initialAnswers(this.data.form,this.data.receipt.answers),answerErrors:{},step:0,review:false,message:''});this.renderQuestions(); },
  async refreshStaff(message) {
    this.setData({info:{...this.data.info,actions:{}}});
    try {
      const info=await http.request(this._readEndpoint,{raw:true,required:true,questionnaire:true});
      if(this._hidden||String(session.user()&&session.user().id)!==String(this._userId))return;
      this.setData({info:{...info,title:brand.display(info.title)},receipt:staff.receipt(info.application),message});
    } catch(cause) {
      if(!this._hidden&&session.user()&&String(session.user().id)===String(this._userId))this.setData({message:message+'；回执状态刷新失败：'+cause.message+'。请重新加载确认允许的操作。'});
    }
  },
  async submit() {
    if(this.data.busy||!this.data.review||!this.checkAnswers(true)||!session.user()||String(session.user().id)!==String(this._userId))return;
    if(this._staff&&!(this.data.info.actions&&this.data.info.actions[this.data.responseEditing?'edit':'submit']))return;
    const userId=this._userId,ticket=this._ticket;
    this.setData({busy:true,message:''});
    try{const updating=this.data.responseEditing,reapplying=this._staff&&this.data.receipt&&this.data.receipt.status==='withdrawn',result=await http.request(this._endpoint,{raw:true,method:updating&&!reapplying?'PATCH':'POST',required:true,questionnaire:true,data:{version:this.data.info.version,...(this.data.receipt&&(updating||this._staff)?{revision:this.data.receipt.updatedAt}:{}),answers:questionnaire.validateAnswers(this.data.form,this.data.answers)}});
      if(ticket!==this._ticket||String(session.user()&&session.user().id)!==String(userId))return;
      const message=this._staff?'骨干申请已保存，请查看本人回执':result.message||'报名已保存';
      this.setData({receipt:this._staff?staff.receipt(result.application):receipt(result.signup),responseEditing:false,review:false,answers:{},message});
      if(this._staff)await this.refreshStaff(message);
    }
    catch(cause){if(ticket===this._ticket&&String(session.user()&&session.user().id)===String(userId))this.setData({message:cause.message});}finally{this.setData({busy:false});}
  },
  async withdraw() {
    if(this.data.busy||!this.data.info||!this.data.info.actions||!this.data.info.actions.withdraw)return;
    const userId=this._userId,ticket=this._ticket,saved=this.data.receipt;
    this.setData({busy:true,message:''});
    try {
      const confirm=await new Promise((resolve,reject)=>wx.showModal({title:'撤回骨干申请',content:'确认撤回本批次申请？开放期间可重提同一申请编号。',success:resolve,fail:()=>reject(new Error('确认未完成，请重试'))}));
      if(!confirm.confirm||ticket!==this._ticket||String(session.user()&&session.user().id)!==String(userId))return;
      const result=await http.request(this._endpoint,{raw:true,required:true,questionnaire:true,method:'POST',data:{action:'withdraw',revision:saved.updatedAt}});
      if(ticket!==this._ticket||String(session.user()&&session.user().id)!==String(userId))return;
      this.setData({receipt:staff.receipt(result.application),responseEditing:false,review:false,answers:{},message:'申请已撤回'});
      await this.refreshStaff('申请已撤回');
    }catch(cause){if(ticket===this._ticket)this.setData({message:cause.message});}finally{this.setData({busy:false});}
  },
  staffReview() { if(this.data.info&&this.data.info.actions&&this.data.info.actions.review)navigation.go('staff-review',{id:this._options.id}); },
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
  async save() { if(this.data.busy||this.data.advancedEditing||!this.data.info||!this.data.info.canManage)return;const ticket=this._ticket;this.setData({busy:true,message:''});try{const result=await http.request(this._endpoint,{raw:true,required:true,questionnaire:true,method:'PUT',data:{version:this.data.info.version,form:this.data.form}});if(ticket!==this._ticket)return;this.setData({info:{...this.data.info,version:result.version},message:result.message});this.setForm(result.form);}catch(cause){if(ticket===this._ticket)this.setData({message:cause.message});}finally{this.setData({busy:false});} },
  tab(event) { if(this.data.busy||!this.data.info)return;const tab=event.currentTarget.dataset.tab;if(tab==='edit'&&!this.data.info.canManage||tab==='entries'&&!this.data.info.canViewSignups||!['edit','entries'].includes(tab))return;this.setData({tab,message:''});if(tab==='entries')this.loadEntries(1); },
  async loadEntries(page) { if(this.data.busy||!this.data.info||!this.data.info.canViewSignups)return;const ticket=this._ticket;this.setData({busy:true,message:''});try{const result=await http.request(this._endpoint+'?mode=entries&page='+page,{raw:true,required:true,questionnaire:true});if(ticket!==this._ticket)return;this.setData({entries:result.docs.map(receipt),page:result.page,pages:result.totalPages,total:result.totalDocs});}catch(cause){if(ticket===this._ticket)this.setData({message:cause.message});}finally{this.setData({busy:false});} },
  previous() { if(this.data.page>1)this.loadEntries(this.data.page-1); },
  next() { if(this.data.page<this.data.pages)this.loadEntries(this.data.page+1); },
});
