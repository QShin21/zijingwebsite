const http=require('../../lib/http');
const navigation=require('../../lib/navigation');
const {actions,protect,error}=require('../../lib/page');
Page({data:{loading:false,error:'',needsLogin:false,kind:'community-posts',docs:[],page:1,hasNextPage:false},...actions,
 onShow(){this.load();},retry(){this.load();},
 async load(page=1){if(!protect(this))return;const ticket=this._ticket=(this._ticket||0)+1;this.setData({loading:true,error:''});try{const result=await http.request('/api/activities/manage?kind='+this.data.kind+'&page='+page,{required:true});if(ticket===this._ticket)this.setData({loading:false,...result});}catch(cause){if(ticket===this._ticket)error(this,cause);}},
 area(event){this.setData({kind:event.currentTarget.dataset.kind,docs:[]});this.load();},
 open(event){const doc=this.data.docs.find(doc=>String(doc.id)===String(event.currentTarget.dataset.id));if(doc&&(doc.canManage||doc.canViewSignups))navigation.go('signup',{kind:this.data.kind,id:doc.id,mode:doc.canManage?'manage':'view'});},
 previous(){if(this.data.page>1)this.load(this.data.page-1);},next(){if(this.data.hasNextPage)this.load(this.data.page+1);},
});
