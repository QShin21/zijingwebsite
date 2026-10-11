import { cms } from '@/lib/content';
import { canPublish, hasRole } from '@/lib/rules';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const headers={'Cache-Control':'private, no-store'};const p=await cms(),{user}=await p.auth({headers:request.headers});
  if(!hasRole(user,'president','vicePresident','communityAdmin'))return Response.json({error:'无权管理活动'}, {status:403,headers});
  const url=new URL(request.url),kind=url.searchParams.get('kind')||'events',page=Math.max(1,Math.min(100000,Math.floor(Number(url.searchParams.get('page')))||1));
  if(kind==='events'){
    const data=await p.find({collection:'events',overrideAccess:false,user,draft:true,depth:0,limit:20,page,sort:'-updatedAt',where:canPublish(user)?{}:{submittedBy:{equals:user!.id}},select:{title:true,_status:true}});
    return Response.json({docs:data.docs,page:data.page,hasNextPage:data.hasNextPage},{headers});
  }
  if(kind!=='community-posts')return Response.json({error:'活动类型无效'},{status:400,headers});
  const games=(user!.communities||[]).map(v=>typeof v==='object'?v.id:v);
  if(!canPublish(user)&&!games.length)return Response.json({docs:[],page:1,hasNextPage:false},{headers});
  const data=await p.find({collection:'community-posts',overrideAccess:false,user,depth:0,limit:20,page,sort:'-updatedAt',where:{and:[{category:{equals:'event'}},...(canPublish(user)?[]:[{game:{in:games}}])]},select:{title:true,status:true}});
  return Response.json({docs:data.docs,page:data.page,hasNextPage:data.hasNextPage},{headers});
}
