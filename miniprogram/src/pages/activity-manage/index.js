const http=require('../../lib/http');
const navigation=require('../../lib/navigation');
const session=require('../../lib/session');
const {actions,protect,error}=require('../../lib/page');
Page({data:{loading:false,error:'',needsLogin:false,kind:'community-posts',docs:[],page:1,hasNextPage:false},...actions,
 onLoad(){this._unsubscribe=session.subscribe(()=>{this._ticket=(this._ticket||0)+1;this.setData({loading:false,docs:[],page:1,hasNextPage:false,needsLogin:!session.user()});});},
 onShow(){return this.load();},retry(){return this.load();},
 onHide(){this._ticket=(this._ticket||0)+1;this.setData({loading:false});},
 onUnload(){this.onHide();if(this._unsubscribe)this._unsubscribe();},
 onPullDownRefresh(){return this.load().finally(()=>wx.stopPullDownRefresh());},
 async load(page=1){const ticket=this._ticket=(this._ticket||0)+1;if(!protect(this)){this.setData({loading:false,docs:[],page:1,hasNextPage:false});return;}this.setData({loading:true,error:'',docs:[]});try{const result=await http.request('/api/activities/manage?kind='+this.data.kind+'&page='+page,{required:true});if(ticket===this._ticket)this.setData({loading:false,...result});}catch(cause){if(ticket===this._ticket){this.setData({docs:[],hasNextPage:false});error(this,cause);}}},
 area(event){this.setData({kind:event.currentTarget.dataset.kind,docs:[]});this.load();},
 open(event){const doc=this.data.docs.find(doc=>String(doc.id)===String(event.currentTarget.dataset.id));if(doc&&(doc.canManage||doc.canViewSignups))navigation.go('signup',{kind:this.data.kind,id:doc.id,mode:doc.canManage?'manage':'view'});},
 previous(){if(this.data.page>1)this.load(this.data.page-1);},next(){if(this.data.hasNextPage)this.load(this.data.page+1);},
});
