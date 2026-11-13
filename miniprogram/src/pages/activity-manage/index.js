function withVisualTheme(definition) {
  try { return require('../../lib/theme').page(definition); }
  catch { return { ...definition, data: { ...definition.data, theme: 'light', themePageStyle: '', themeUnavailable: true, themeError: '外观设置暂不可用，请重新打开小程序。' } }; }
}
const i18n = (() => { try { const value = require('../../lib/i18n'); if (value && typeof value.t === 'function') return value; } catch { /* Harnesses may omit the locale module. */ } return { t: zh => zh, message: value => value, locale: () => 'zh', bind() {}, unbind() {}, navTitle() {}, subscribe: () => () => {} }; })();
const http=require('../../lib/http');
const text={back:['‹ 返回','‹ Back'],kicker:['WORKBENCH · 活动工作台','WORKBENCH · Activities'],title:['问卷与报名','Forms and sign-ups'],lead:['选择活动，处理报名问卷与已提交资料。','Choose an activity to manage its sign-up form and submissions.'],
 communityEvents:['社群活动','Community events'],siteEvents:['站点活动与草稿','Site events and drafts'],communityHint:['当前社群范围内的活动，按活动授权开放问卷与名单。','Events in your communities; forms and lists follow each event\'s permissions.'],siteHint:['包含当前账号有权访问的站点活动与草稿。','Site events and drafts this account can access.'],
 siteTitle:['站点活动','Site events'],pagePrefix:['第 ','Page '],pageSuffix:[' 页',''],draft:['草稿','Draft'],hidden:['已隐藏','Hidden'],public:['已公开','Public'],draftHint:['发布前需完成审核','Needs review before publishing'],
 manageBoth:['管理问卷与报名','Manage form and sign-ups'],editForm:['编辑报名问卷','Edit sign-up form'],viewList:['查看报名名单','View sign-up list'],readonly:['当前只读','Read only'],
 emptyTitle:['此范围暂无可管理活动','No manageable activities here'],emptyBody:['已有活动授权后会显示在这里。可切换活动范围；创建活动或保存草稿请前往网站。','Activities appear here once you are authorized. Switch scope, or use the website to create events or save drafts.'],
 previous:['上一页','Previous'],next:['下一页','Next']};
const navigation=require('../../lib/navigation');
const session=require('../../lib/session');
const {actions,protect,error}=require('../../lib/page');
Page(withVisualTheme({data:{loading:false,error:'',needsLogin:false,kind:'community-posts',docs:[],page:1,hasNextPage:false},...actions,
 onLoad(){i18n.bind(this,text);this._unsubscribe=session.subscribe(()=>{this._ticket=(this._ticket||0)+1;this.setData({loading:false,docs:[],page:1,hasNextPage:false,needsLogin:!session.user()});});},
 onShow(){i18n.navTitle('活动问卷管理','Activity forms');return this.load();},retry(){return this.load();},
 onHide(){this._ticket=(this._ticket||0)+1;this.setData({loading:false});},
 onUnload(){this.onHide();i18n.unbind(this);if(this._unsubscribe)this._unsubscribe();},
 onPullDownRefresh(){return this.load().finally(()=>wx.stopPullDownRefresh());},
 async load(page=1){const ticket=this._ticket=(this._ticket||0)+1;if(!protect(this)){this.setData({loading:false,docs:[],page:1,hasNextPage:false});return;}this.setData({loading:true,error:'',docs:[]});try{const result=await http.request('/api/activities/manage?kind='+this.data.kind+'&page='+page,{required:true});if(ticket===this._ticket)this.setData({loading:false,...result});}catch(cause){if(ticket===this._ticket){this.setData({docs:[],hasNextPage:false});error(this,cause);}}},
 area(event){this.setData({kind:event.currentTarget.dataset.kind,docs:[]});this.load();},
 open(event){const doc=this.data.docs.find(doc=>String(doc.id)===String(event.currentTarget.dataset.id));if(doc&&(doc.canManage||doc.canViewSignups))navigation.go('signup',{kind:this.data.kind,id:doc.id,mode:doc.canManage?'manage':'view'});},
 previous(){if(this.data.page>1)this.load(this.data.page-1);},next(){if(this.data.hasNextPage)this.load(this.data.page+1);},
}));
