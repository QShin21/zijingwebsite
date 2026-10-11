const brand = require('../../lib/brand');
const http = require('../../lib/http');
const session = require('../../lib/session');
const navigation = require('../../lib/navigation');
const { actions, protect, error } = require('../../lib/page');
const types = ['text', 'textarea', 'single', 'multiple'];
function receipt(value) { return value ? { ...value, rows: (value.questions || []).map(q => ({ label: brand.display(q.label), answer: Array.isArray(value.answers[q.id]) ? value.answers[q.id].join('、') : value.answers[q.id] || '未填写' })) } : null; }
function localParts(value) { if (!value) return { date: '', time: '' }; const d = new Date(value), pad = v => String(v).padStart(2,'0'); return { date: d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()), time: pad(d.getHours())+':'+pad(d.getMinutes()) }; }
Page({
  data: { loading: true, error: '', needsLogin: false, busy: false, message: '', info: null, form: {}, answers: {}, questions: [], receipt: null, edit: false, tab: 'edit', entries: [], page: 1, pages: 0, total: 0, typeLabels: ['单行文本','多行文本','单选','多选'] },
  ...actions,
  onLoad(options) { this._options=options; this._endpoint='/api/activities/'+encodeURIComponent(options.kind)+'/'+encodeURIComponent(options.id)+'/signup'; this.setData({edit:options.mode==='manage'}); },
  onShow() { const user=session.user(); if(!this._loaded || String(user && user.id)!==String(this._userId))this.load(); },
  retry() { this.load(); },
  async load() {
    if(!protect(this)){this.setData({loading:false});return;}this._userId=session.user().id;this.setData({loading:true,error:'',message:''});
    try { const info=await http.request(this._endpoint+(this.data.edit?'?mode=manage':''),{raw:true,required:true});this._loaded=true;
      this.setData({loading:false,info:{...info,title:brand.display(info.title)},receipt:receipt(info.signup),answers:{}});this.setForm(info.form);this.renderQuestions();wx.setNavigationBarTitle({title:this.data.edit?'报名问卷管理':'活动报名'});
    }catch(cause){error(this,cause);}
  },
  setForm(form) { const start=localParts(form.start),end=localParts(form.end);this.setData({form,editQuestions:form.questions.map(q=>({...q,typeIndex:types.indexOf(q.type),optionsText:q.options.join('\n')})),startDate:start.date,startTime:start.time,endDate:end.date,endTime:end.time}); },
  renderQuestions() { this.setData({questions:this.data.form.questions.map(q=>({...q,label:brand.display(q.label),choices:q.options.map(value=>({value,label:brand.display(value),checked:q.type==='multiple'?(this.data.answers[q.id]||[]).includes(value):this.data.answers[q.id]===value}))}))}); },
  answer(event) { const id=event.currentTarget.dataset.id;this.setData({answers:{...this.data.answers,[id]:event.detail.value}});this.renderQuestions(); },
  async submit() { if(this.data.busy)return;this.setData({busy:true,message:''});try{const result=await http.request(this._endpoint,{raw:true,method:'POST',required:true,data:{version:this.data.info.version,answers:this.data.answers}});this.setData({receipt:receipt(result.signup),message:'报名成功，已确认报名'});}catch(cause){this.setData({message:cause.message});}finally{this.setData({busy:false});} },
  manage() { navigation.go('signup',{kind:this._options.kind,id:this._options.id,mode:'manage'}); },
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
  add() { if(this.data.form.questions.length>=20)return;this.setForm({...this.data.form,questions:[...this.data.form.questions,{id:'q'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),label:'',type:'text',required:true,options:[]}]}); },
  move(event) { const i=Number(event.currentTarget.dataset.index),j=i+Number(event.currentTarget.dataset.direction),questions=[...this.data.form.questions];if(j<0||j>=questions.length)return;[questions[i],questions[j]]=[questions[j],questions[i]];this.setForm({...this.data.form,questions}); },
  remove(event) { this.setForm({...this.data.form,questions:this.data.form.questions.filter((_,i)=>i!==Number(event.currentTarget.dataset.index))}); },
  async save() { if(this.data.busy)return;this.setData({busy:true,message:''});try{const result=await http.request(this._endpoint,{raw:true,required:true,method:'PUT',data:{version:this.data.info.version,form:this.data.form}});this.setData({info:{...this.data.info,version:result.version},message:result.message});this.setForm(result.form);}catch(cause){this.setData({message:cause.message});}finally{this.setData({busy:false});} },
  tab(event) { const tab=event.currentTarget.dataset.tab;this.setData({tab,message:''});if(tab==='entries')this.loadEntries(1); },
  async loadEntries(page) { if(this.data.busy)return;this.setData({busy:true,message:''});try{const result=await http.request(this._endpoint+'?mode=entries&page='+page,{raw:true,required:true});this.setData({entries:result.docs.map(receipt),page:result.page,pages:result.totalPages,total:result.totalDocs});}catch(cause){this.setData({message:cause.message});}finally{this.setData({busy:false});} },
  previous() { if(this.data.page>1)this.loadEntries(this.data.page-1); },
  next() { if(this.data.page<this.data.pages)this.loadEntries(this.data.page+1); },
});
