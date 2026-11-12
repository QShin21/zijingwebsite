import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres';
import { up as migrateV2 } from '../src/migrations/20261111_000000_v2_media_schedule';
import { getPayload, createLocalReq, logoutOperation, type Payload } from 'payload';
import { up as migrateHomeSections } from '../src/migrations/20261112_000000_v2_home_sections';
import { getHomePromoted } from '../src/lib/v2/home';
import { reservedTeamSlugs } from '../src/lib/team-slugs';
import config from '../src/payload.config';
import type { User } from '../src/payload-types';
import * as v2 from '../src/lib/v2';
import { v2Request } from '../src/lib/v2/http';
import { serverURL } from '../src/lib/environment';
import { decideCommunityApplication, updateCommunityCard } from '../src/lib/community-operations';
import { profileFixture, saveLoadedProfile } from './team-profiles-fixture';
import { emptyTeamProfile } from '../src/lib/team-profiles-model';
import { updateCommunityPostSchedule } from '../src/lib/v2/schedule';
import { changePromotion, promotedContent, readPromotionSource } from '../src/lib/content-promotions';
import { submitSignup, activity } from '../src/lib/activity-signups';

let p: Payload, leader:User, vice:User, member:User, other:User, reviewer:User, editor:User, backbone:User, suspended:User;
let game:number, hiddenGame:number, club:number, post:number, png:Buffer;
const stamp=randomBytes(6).toString('hex');
const form={enabled:true,questions:[{id:'name',label:'合成称呼',type:'text',required:true}]};
const createUser=async(label:string,roles:User['roles'],extra={})=>p.create({collection:'users',overrideAccess:true,context:{system:true},data:{name:label+'-'+stamp,email:label+'-'+stamp+'@example.invalid',password:randomBytes(24).toString('hex'),roles,...extra}});
beforeAll(async()=>{
 if(process.env.APP_ENV!=='development'||process.env.REBUILD_QA_PROFILE!=='contracts'||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL!).hostname))throw Error('Disposable synthetic contracts DB required');
 p=await getPayload({config});
 leader=await createUser('v2-leader',['president']);vice=await createUser('v2-vice',['vicePresident']);member=await createUser('v2-member',['member']);other=await createUser('v2-other',['member']);reviewer=await createUser('v2-reviewer',['member']);editor=await createUser('v2-editor',['member']);backbone=await createUser('v2-backbone',['backbone'],{department:'publicity'});suspended=await createUser('v2-suspended',['member'],{accountStatus:'suspended'});
 game=(await p.create({collection:'games',overrideAccess:true,context:{system:true},data:{title:'V2合成社群'+stamp,slug:'v2-'+stamp,_status:'published'}})).id;
 hiddenGame=(await p.create({collection:'games',overrideAccess:true,context:{system:true},data:{title:'V2未发布社群',slug:'v2-hidden-'+stamp,_status:'draft'}})).id;
 editor=await p.update({collection:'users',id:editor.id,overrideAccess:true,context:{system:true},data:{communityOffices:[{game,status:'active',publishContent:true,viewSignups:true,exportSignups:false,reviewShowcase:false,handleJoins:true}]}});
 reviewer=await p.update({collection:'users',id:reviewer.id,overrideAccess:true,context:{system:true},data:{communityOffices:[{game,status:'active',reviewShowcase:true,publishContent:false,viewSignups:false,handleJoins:false}]}});
 club=(await p.create({collection:'events',overrideAccess:false,user:leader,context:{manageSignupForm:true},data:{game,title:'V2公开活动',slug:'v2-event-'+stamp,_status:'published',startAt:new Date(Date.now()+3600000).toISOString(),endAt:new Date(Date.now()+7200000).toISOString(),signupForm:form}})).id;
 post=(await p.create({collection:'community-posts',overrideAccess:false,user:editor,context:{manageSignupForm:true},data:{author:editor.id,title:'V2社群活动',body:'合成公开正文',game,category:'event',signupForm:form}})).id;
 png=await sharp({create:{width:4,height:4,channels:3,background:'#7956cf'}}).png().toBuffer();
});
afterAll(async()=>{if(p)await p.destroy();});
describe('V2 actual Payload + synthetic Postgres',()=>{
 it('additive migration preserves preexisting synthetic rows and leaves schedule null',async()=>{
  await p.db.drizzle.transaction(async tx=>{
   const schema=sql.identifier('v2migration_'+stamp);
   await tx.execute(sql`CREATE SCHEMA ${schema}`);await tx.execute(sql`SET LOCAL search_path TO ${schema}`);
   await tx.execute(sql`CREATE TABLE users(id integer PRIMARY KEY); CREATE TABLE community_posts(id integer PRIMARY KEY,title varchar,body varchar); CREATE TABLE payload_locked_documents_rels(id integer PRIMARY KEY); INSERT INTO users VALUES(1); INSERT INTO community_posts VALUES(1,'legacy-synthetic-title','legacy-synthetic-body')`);
   const before=(await tx.execute(sql`SELECT * FROM community_posts ORDER BY id`)).rows;
   await migrateV2({db:tx} as unknown as MigrateUpArgs);
   const after=(await tx.execute(sql`SELECT id,title,body FROM community_posts ORDER BY id`)).rows;expect(after).toEqual(before);
   expect((await tx.execute(sql`SELECT start_at,end_at,location FROM community_posts`)).rows[0]).toEqual({start_at:null,end_at:null,location:null});
   expect((await tx.execute(sql`SELECT COUNT(*)::integer AS count FROM pending_uploads`)).rows[0]).toEqual({count:0});
  });
 });
 it('all public and member read services execute against real schema',async()=>{
  expect((await v2.getSession(p,null)).viewer).toBeNull();
  const home=await v2.getHome(p,null);expect(home.viewer).toBeNull();expect(home.highlights).toBeNull();expect(home.communities).toBeNull();expect(home.upcoming.length).toBeLessThanOrEqual(6);
  expect((await v2.getFeed(p,null,{kind:'honors'})).restricted).toBe(true);
  expect((await v2.getRecruitmentCenter(p,null)).teams).toBeNull();
  expect((await v2.getFixedPage(p,null,{key:'about'})).key).toBe('about');
  expect((await v2.getEventDetail(p,null,{source:'club',id:club})).registration).toBeTruthy();
  for(const user of [member,editor,reviewer,backbone,vice,leader]){
   const session=await v2.getSession(p,user);expect(session.viewer?.id).toBe(user.id);
   expect((await v2.getCommunities(p,user,{q:'V2合成社群'+stamp})).docs.some(g=>g.community.id===game)).toBe(true);
   const community=await v2.getCommunity(p,user,{slug:'v2-'+stamp});expect(community.card.community.id).toBe(game);
   const header=await v2.getCommunityHeader(p,user,{slug:'v2-'+stamp});expect(header.card).toEqual(community.card);expect(header.viewer).toEqual(community.viewer);expect(header).not.toHaveProperty('body');
   expect((await v2.getCommunityPosts(p,user,{slug:'v2-'+stamp})).docs.length).toBeGreaterThan(0);
   expect((await v2.getShowcase(p,user,{slug:'v2-'+stamp})).docs).toEqual([]);
   expect((await v2.getContacts(p,user,{slug:'v2-'+stamp})).contacts).toEqual([]);
   expect(Array.isArray((await v2.getTeams(p,user)).docs)).toBe(true);
   expect(Array.isArray((await v2.getHonors(p,user)).docs)).toBe(true);
   expect(Array.isArray((await v2.getMe(p,user)).todo)).toBe(true);
   expect((await v2.getMyApplications(p,user)).docs).toEqual([]);
   expect((await v2.getMySignups(p,user)).docs).toEqual([]);
   expect(Array.isArray((await v2.getManage(p,user)).queues)).toBe(true);
  }
  expect((await v2.getSession(p,suspended)).viewer).toBeNull();
  await expect(v2.getCommunities(p,null)).rejects.toMatchObject({status:401});
  await expect(v2.getCommunity(p,suspended,{slug:'v2-'+stamp})).rejects.toMatchObject({status:401});
 });
 it('new home-controls migration is additive and the CMS preserves legacy modules',async()=>{
  await p.db.drizzle.transaction(async tx=>{
   const schema=sql.identifier('v2homemigration_'+stamp);
   await tx.execute(sql`CREATE SCHEMA ${schema}`);await tx.execute(sql`SET LOCAL search_path TO ${schema}`);
   await tx.execute(sql`CREATE TABLE site(id integer PRIMARY KEY,name varchar); CREATE TABLE site_modules(id varchar PRIMARY KEY,kind varchar); INSERT INTO site VALUES(1,'synthetic-preserved'); INSERT INTO site_modules VALUES('legacy','events')`);
   const before=(await tx.execute(sql`SELECT * FROM site_modules`)).rows;
   await migrateHomeSections({db:tx} as unknown as MigrateUpArgs);
   expect((await tx.execute(sql`SELECT * FROM site_modules`)).rows).toEqual(before);
   expect((await tx.execute(sql`SELECT COUNT(*)::integer AS count FROM site_home_sections`)).rows[0]).toEqual({count:0});
  });
  const before=await p.findGlobal({slug:'site',overrideAccess:true});
  try {
   await p.updateGlobal({slug:'site',user:leader,overrideAccess:false,data:{homeSections:[{kind:'highlights',enabled:false,title:'合成高光'},{kind:'upcoming',enabled:true,title:'合成赛程'}]}});
   const home=await v2.getHome(p,null);
   expect(home.sections.slice(0,2)).toEqual([{kind:'highlights',enabled:false,title:'合成高光'},{kind:'upcoming',enabled:true,title:'合成赛程'}]);
   expect((await p.findGlobal({slug:'site',overrideAccess:true})).modules).toEqual(before.modules);
   await expect(p.updateGlobal({slug:'site',user:member,overrideAccess:false,data:{homeSections:[]}})).rejects.toMatchObject({status:403});
   await expect(p.updateGlobal({slug:'site',user:leader,overrideAccess:false,data:{homeSections:[{kind:'open'},{kind:'open'}]}})).rejects.toMatchObject({status:400});
  } finally {await p.updateGlobal({slug:'site',user:leader,overrideAccess:false,data:{homeSections:before.homeSections??[]}});}
 });
 it('calendar signupOpen filter and lightweight header have real HTTP parity',async()=>{
  const visible=await v2.getCalendar(p,member,{signupOpen:true,limit:1});
  expect((await v2.getCalendar(p,member,{signupOpen:true,limit:50})).docs.some(row=>row.key==='community:'+post)).toBe(true);
  expect((await v2.getCalendar(p,null,{signupOpen:true,limit:50})).docs.some(row=>row.key==='community:'+post)).toBe(false);
  expect(visible.totalDocs).toBeGreaterThan(0);expect(visible.docs.every(row=>row.signup.state==='open')).toBe(true);
  const base=new URL(serverURL).origin;
  const response=await v2Request(p,new Request(base+'/api/v2/calendar?signupOpen=1&limit=1'),['calendar']);
  expect(response.status).toBe(200);const body=await response.json();expect(body.docs.every((row:{signup:{state:string}})=>row.signup.state==='open')).toBe(true);
  expect(body.totalPages).toBe(body.totalDocs);
  const password=randomBytes(24).toString('hex');
  const user=await p.create({collection:'users',overrideAccess:true,context:{system:true},data:{name:'v2-header-'+stamp,email:'v2-header-'+stamp+'@example.invalid',password,roles:['member']}});
  const login=await p.login({collection:'users',data:{email:user.email,password}});
  const url=base+'/api/v2/communities/v2-'+stamp+'/header';
  expect((await v2Request(p,new Request(url),['communities','v2-'+stamp,'header'])).status).toBe(401);
  const header=await v2Request(p,new Request(url,{headers:{authorization:'JWT '+login.token}}),['communities','v2-'+stamp,'header']);
  expect(header.status).toBe(200);const projection=await header.json();expect(projection.card.community.id).toBe(game);expect(projection).not.toHaveProperty('upcoming');
 });
 it('reserved team routes cannot be created or renamed; existing-data audit is read-only',async()=>{
  const audit=await p.find({collection:'teams',overrideAccess:true,draft:true,depth:0,pagination:false,limit:0,where:{slug:{in:[...reservedTeamSlugs]}},select:{slug:true}});
  expect(Array.isArray(audit.docs)).toBe(true);
  for(const slug of reservedTeamSlugs) {
   await expect(p.create({collection:'teams',user:leader,overrideAccess:false,data:{title:'合成保留词',slug,game,_status:'draft'}})).rejects.toMatchObject({status:400});
   await expect(p.create({collection:'teams',user:leader,overrideAccess:false,draft:true,data:{title:'合成保留词草稿',slug,game}})).rejects.toMatchObject({status:400});
   await expect(p.create({collection:'teams',user:backbone,overrideAccess:false,data:{title:'合成编辑默认草稿',slug,game}})).rejects.toMatchObject({status:400});
  }
  const team=await p.create({collection:'teams',user:leader,overrideAccess:false,data:{title:'合成安全标识',slug:'v2-reserved-audit-'+stamp,game,_status:'draft'}});
  await expect(p.update({collection:'teams',id:team.id,user:leader,overrideAccess:false,data:{slug:'manage'}})).rejects.toMatchObject({status:400});
  await expect(p.update({collection:'teams',id:team.id,user:leader,overrideAccess:false,draft:true,data:{slug:'manage'}})).rejects.toMatchObject({status:400});
  expect((await p.findByID({collection:'teams',id:team.id,overrideAccess:true,depth:0})).slug).toBe(team.slug);
 });
 it('image tickets authenticate current Payload sessions and are revoked by actual logout',async()=>{
  const password=randomBytes(24).toString('hex');
  const user=await p.create({collection:'users',overrideAccess:true,context:{system:true},data:{name:'v2-ticket-'+stamp,email:'v2-ticket-'+stamp+'@example.invalid',password,roles:['member']}});
  const login=await p.login({collection:'users',data:{email:user.email,password}});
  const upload=await v2.createUpload(p,user,{purpose:'showcase',file:new File([new Uint8Array(png)],'ticket.png',{type:'image/png'})});
  const base=new URL(serverURL).origin, headers={authorization:'JWT '+login.token,'content-type':'application/json'};
  const signed=await v2Request(p,new Request(base+'/api/v2/images/sign',{method:'POST',headers,body:JSON.stringify({sources:[upload.upload.preview.src]})}),['images','sign']);
  expect(signed.status).toBe(200);const body=await signed.json();expect(body.images).toHaveLength(1);
  const url=new URL(body.images[0].url,base),path=url.pathname.slice('/api/v2/'.length).split('/');
  expect((await v2Request(p,new Request(url),path)).status).toBe(200);
  expect((await v2Request(p,new Request(new URL(upload.upload.preview.src,base)),path)).status).toBe(404);
  const auth=await p.auth({headers:new Headers({authorization:'JWT '+login.token})});
  expect(auth.user).toBeTruthy();const req=await createLocalReq({user:auth.user!},p);
  await logoutOperation({collection:p.collections.users,req,allSessions:false});
  expect((await v2Request(p,new Request(url,{headers:{'if-none-match':'*'}}),path)).status).toBe(404);
 });
 it('dedicated promoted slots survive ordinary home truncation and remove changed or hidden sources',async()=>{
  const event=await p.create({collection:'community-posts',user:editor,overrideAccess:false,data:{author:editor.id,title:'V2合成无时间精选',body:'合成公开正文',game,category:'event'}});
  const notice=await p.create({collection:'community-posts',user:editor,overrideAccess:false,data:{author:editor.id,title:'V2合成精选通知',body:'合成公开通知',game,category:'notice'}});
  for(const row of [event,notice]) { const source=await readPromotionSource(p,'community-posts',row.id);await changePromotion(p,leader,'community-posts',row.id,'promote',{sourceVersion:source.version,reason:'合成主场独立升推'}); }
  await p.db.drizzle.execute(sql`UPDATE community_posts SET created_at = '2020-01-01' WHERE id IN (${event.id},${notice.id})`);
  const home=await v2.getHome(p,null);
  expect(home.upcoming.some(card=>card.key==='community:'+event.id)).toBe(false);
  expect(home.promoted.events.some(card=>card.key==='community:'+event.id&&card.promoted)).toBe(true);
  expect(home.promoted.notices.some(card=>card.key==='communityNotice:'+notice.id&&card.promoted)).toBe(true);
  expect(home.promoted.showcases).toBeNull();
  await p.update({collection:'community-posts',id:event.id,user:editor,overrideAccess:false,data:{body:'合成内容修改待复审'}});
  await p.update({collection:'community-posts',id:notice.id,user:editor,overrideAccess:false,data:{status:'hidden'}});
  const after=await getHomePromoted(p,member);
  expect(after.events.some(card=>card.key==='community:'+event.id)).toBe(false);
  expect(after.notices.some(card=>card.key==='communityNotice:'+notice.id)).toBe(false);
 });
 it('HTTP uses real cookie/JWT auth, rejects mixed invalid JWT and verifies Origin',async()=>{
  const password=randomBytes(24).toString('hex');
  const user=await p.create({collection:'users',overrideAccess:true,context:{system:true},data:{name:'v2-http-'+stamp,email:'v2-http-'+stamp+'@example.invalid',password,roles:['member']}});
  const login=await p.login({collection:'users',data:{email:user.email,password}});expect(login.token).toBeTruthy();
  const base=new URL(serverURL).origin;
  for(const headers of [{authorization:'JWT '+login.token},{cookie:'payload-token='+login.token,'sec-fetch-site':'same-origin'}] as Record<string,string>[]) {
   const result=await v2Request(p,new Request(base+'/api/v2/session',{headers}),['session']);expect(result.status).toBe(200);expect((await result.json()).viewer.id).toBe(user.id);
  }
  const route=(headers:Record<string,string>)=>v2Request(p,new Request(base+'/api/v2/communities/v2-'+stamp+'/showcase',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({title:'HTTP合成投稿',images:[]})}),['communities','v2-'+stamp,'showcase']);
  expect((await route({cookie:'payload-token='+login.token,Origin:'https://evil.invalid'})).status).toBe(403);
  expect((await route({cookie:'payload-token='+login.token,authorization:'JWT invalid-token'})).status).toBe(401);
  const accepted=await route({authorization:'JWT '+login.token});expect(accepted.status).toBe(201);expect((await accepted.json()).showcase.status).toBe('pending');
 });
 it('current capabilities are independent and stale roles cannot elevate',async()=>{
  const e=(await v2.getSession(p,editor)).viewer!,r=(await v2.getSession(p,reviewer)).viewer!;
  expect(e.capabilities.communities[0]).toMatchObject({publish:true,reviewShowcase:false,manageTeams:true,viewSignups:true,exportSignups:false,contactCard:false});
  expect(r.capabilities.communities[0]).toMatchObject({publish:false,reviewShowcase:true,manageTeams:false,viewSignups:false});
  expect((await v2.getSession(p,{...member,roles:['president']})).viewer?.capabilities.publishClub).toBe(false);
 });
 it('calendar batches own signup flags; receipts never include answer values',async()=>{
  const value=await activity(p,'community-posts',post,member);await submitSignup(p,'community-posts',post,member,value.version,{name:'secret-answer-only-owner'});
  const own=await v2.getCalendar(p,member,{scope:'mine'});expect(own.docs.some(e=>e.key==='community:'+post&&e.signup.viewerSubmitted)).toBe(true);
  expect((await v2.getCalendar(p,other,{scope:'mine'})).docs).toEqual([]);
  expect((await v2.getCommunityPosts(p,member,{slug:'v2-'+stamp})).docs.find(e=>e.key==='community:'+post)).toMatchObject({signup:{viewerSubmitted:true}});
  const receipts=await v2.getMySignups(p,member);expect(receipts.docs).toHaveLength(1);expect(JSON.stringify(receipts)).not.toContain('secret-answer-only-owner');
 });
 it('real established-team projection, roster consent and private answers remain scoped',async()=>{
  const f=await profileFixture(p);
  try {
  const profileValue={...emptyTeamProfile(),displayName:'V2公开队员',position:'合成位置',biography:'合成公开简介',avatar:'data:image/png;base64,'+png.toString('base64'),visible:true};
  const savedProfile=await saveLoadedProfile(p,f.member,f.first.id,null,profileValue);
  const team=await v2.getTeam(p,f.viewer,{slug:f.first.slug});expect(team.card.team.id).toBe(f.first.id);expect(team.roster).toHaveLength(1);expect(team.roster[0].displayName).toBe('V2公开队员');
  expect(team.viewer?.canEditProfile).toBe(false);expect(team.card.viewer?.membership).toBeNull();
  const own=await v2.getTeam(p,f.member,{slug:f.first.slug});expect(own.viewer?.canEditProfile).toBe(true);expect(own.viewer?.membership?.status).toBe('active');
  expect((await v2.getTeams(p,f.member,{community:f.game.slug})).docs).toHaveLength(2);
  expect(JSON.stringify(team)).not.toMatch(/PRIVATE_PROFILE_TEST_ANSWER|@example.invalid|membershipKey|formSnapshot/);
  expect((await v2.getMe(p,f.member)).memberships).toHaveLength(1);
  const image=await v2.getImage(p,null,{kind:'profile',id:team.roster[0].id,index:0});expect(image.status).toBe(200);
  await saveLoadedProfile(p,f.member,f.first.id,savedProfile.revision,{...profileValue,visible:false});
  await expect(v2.getImage(p,null,{kind:'profile',id:team.roster[0].id,index:0,ifNoneMatch:image.headers.get('ETag')})).rejects.toMatchObject({status:404});
  expect((await v2.getImage(p,f.member,{kind:'profile',id:team.roster[0].id,index:0})).status).toBe(200);
  } finally { await f.cleanup(); }
 });
 it('schedule uses CAS and changes invalidate prior promotion while preserving row identity',async()=>{
  const src=await readPromotionSource(p,'community-posts',post);
  await changePromotion(p,leader,'community-posts',post,'promote',{revision:'',sourceVersion:src.version,reason:'合成演练升推'});
  expect((await promotedContent(p,'event')).some(e=>e.sourceKey==='community-posts:'+post)).toBe(true);
  const old=await p.findByID({collection:'community-posts',id:post,overrideAccess:true,depth:0});
  await updateCommunityPostSchedule(p,editor,{id:post,revision:old.updatedAt,startAt:'2027-01-03T18:00',endAt:'2027-01-03T19:00',location:'合成A厅'});
  const saved=await p.findByID({collection:'community-posts',id:post,overrideAccess:true,depth:0});expect(saved.body).toBe(old.body);expect(saved.startAt).toBe('2027-01-03T10:00:00.000Z');
  expect((await promotedContent(p,'event')).some(e=>e.sourceKey==='community-posts:'+post)).toBe(false);
  await expect(updateCommunityPostSchedule(p,editor,{id:post,revision:old.updatedAt,startAt:''})).rejects.toMatchObject({status:409});
  await expect(updateCommunityPostSchedule(p,member,{id:post,revision:saved.updatedAt,startAt:''})).rejects.toMatchObject({status:404});
 });
 it('real upload transaction, image access/caching, single consumption and review CAS',async()=>{
  const up=await v2.createUpload(p,member,{purpose:'showcase',file:new File([new Uint8Array(png)],'synthetic.png',{type:'image/png'})});
  expect(up.upload.preview.src).toMatch(/^\/api\/v2\/images\/upload/);expect(JSON.stringify(up)).not.toContain('data:');
  const version=new URL(up.upload.preview.src,'http://localhost').searchParams.get('v');
  const image=await v2.getImage(p,member,{kind:'upload',id:up.upload.id,index:0,version});expect(image.status).toBe(200);expect(image.headers.get('Cache-Control')).toBe('private, no-store');expect(image.headers.get('Content-Type')).toBe('image/webp');
  const etag=image.headers.get('ETag');expect((await v2.getImage(p,member,{kind:'upload',id:up.upload.id,index:0,ifNoneMatch:etag})).status).toBe(304);
  await expect(v2.getImage(p,other,{kind:'upload',id:up.upload.id,index:0,ifNoneMatch:etag})).rejects.toMatchObject({status:404});
  const result=await v2.createShowcase(p,member,{slug:'v2-'+stamp,title:'合成投稿',body:'合成内容',images:[{upload:up.upload.id}]});expect(result.showcase.status).toBe('pending');
  expect((await v2.getShowcase(p,other,{slug:'v2-'+stamp})).docs).toEqual([]);
  expect((await v2.getShowcase(p,member,{slug:'v2-'+stamp,view:'mine'})).docs).toHaveLength(1);
  await expect(v2.createShowcase(p,member,{slug:'v2-'+stamp,title:'重复消费',images:[{upload:up.upload.id}]})).rejects.toMatchObject({status:409});
  await expect(v2.reviewShowcase(p,reviewer,{id:result.showcase.id,decision:'hidden',revision:result.showcase.revision})).rejects.toMatchObject({status:400});
  await expect(v2.reviewShowcase(p,member,{id:result.showcase.id,decision:'visible',revision:result.showcase.revision})).rejects.toMatchObject({status:404});
  const approved=await v2.reviewShowcase(p,reviewer,{id:result.showcase.id,decision:'visible',revision:result.showcase.revision});expect(approved.showcase.status).toBe('visible');
  await expect(v2.reviewShowcase(p,reviewer,{id:result.showcase.id,decision:'hidden',reviewNote:'合成',revision:result.showcase.revision})).rejects.toMatchObject({status:409});
  expect((await v2.getShowcase(p,other,{slug:'v2-'+stamp})).docs[0].reviewNote).toBeNull();
  const promotionSource=await readPromotionSource(p,'community-showcase',approved.showcase.id);
  await changePromotion(p,leader,'community-showcase',approved.showcase.id,'promote',{sourceVersion:promotionSource.version,reason:'合成主场风采升推'});
  expect((await getHomePromoted(p,other)).showcases?.some(card=>card.id===approved.showcase.id)).toBe(true);
  expect((await getHomePromoted(p,null)).showcases).toBeNull();
  await v2.reviewShowcase(p,reviewer,{id:approved.showcase.id,decision:'hidden',reviewNote:'合成撤下风采',revision:approved.showcase.revision});
  expect((await getHomePromoted(p,other)).showcases?.some(card=>card.id===approved.showcase.id)).toBe(false);
 });
 it('rejects invalid uploads, expiry and bans without unsafe writes',async()=>{
  await expect(v2.createUpload(p,member,{purpose:'showcase',file:new File([new Uint8Array(2*1024*1024+1)],'big.png',{type:'image/png'})})).rejects.toMatchObject({status:413});
  await expect(v2.createUpload(p,member,{purpose:'showcase',file:new File(['<svg/>'],'image.svg',{type:'image/svg+xml'})})).rejects.toMatchObject({status:415});
  await expect(v2.createUpload(p,member,{purpose:'showcase',file:new File(['not an image'],'image.png',{type:'image/png'})})).rejects.toMatchObject({status:400});
  const up=await v2.createUpload(p,other,{purpose:'showcase',file:new File([new Uint8Array(png)],'synthetic.png',{type:'image/png'})});
  await p.db.drizzle.execute(sql`UPDATE pending_uploads SET expires_at = now() - interval '1 day' WHERE id = ${up.upload.id}`);
  await expect(v2.createShowcase(p,other,{slug:'v2-'+stamp,title:'已过期',images:[{upload:up.upload.id}]})).rejects.toMatchObject({status:409});
  await p.create({collection:'community-bans',user:editor,overrideAccess:false,data:{game,member:other.id,active:true,reason:'合成禁言'}});
  await expect(v2.createShowcase(p,other,{slug:'v2-'+stamp,title:'受限',images:[]})).rejects.toMatchObject({status:403});
 });
 it('article/feed projections resolve published event communities without nonexistent game columns',async()=>{
  const news=await p.create({collection:'news',user:leader,overrideAccess:false,data:{title:'V2关联新闻',slug:'v2-news-'+stamp,event:club,_status:'published',type:'新闻'}});
  const album=await p.create({collection:'albums',user:leader,overrideAccess:false,data:{title:'V2关联影像',slug:'v2-album-'+stamp,event:club,_status:'published'}});
  const filtered=await v2.getFeed(p,member,{community:'v2-'+stamp,limit:50});
  expect(filtered.docs.some(row=>row.kind==='article'&&row.item.key==='news:'+news.id)).toBe(true);expect(filtered.docs.some(row=>row.kind==='article'&&row.item.key==='album:'+album.id)).toBe(true);
  expect((await v2.getArticle(p,member,{kind:'news',id:news.id})).article.community?.id).toBe(game);expect((await v2.getArticle(p,member,{kind:'album',id:album.id})).photos?.docs).toEqual([]);
  await expect(v2.getArticle(p,null,{kind:'news',id:news.id})).rejects.toMatchObject({status:401});
  const stored=await p.update({collection:'events',id:club,user:leader,overrideAccess:false,data:{postImages:[{source:'data:image/png;base64,'+png.toString('base64'),alt:'合成公开图片'}]}});
  const detail=await v2.getEventDetail(p,null,{source:'club',id:stored.id});expect(detail.images).toHaveLength(1);expect(JSON.stringify(detail)).not.toContain('data:');
  const image=await v2.getImage(p,null,{kind:'event-post',id:club,index:0});expect(image.status).toBe(200);expect(image.headers.get('Cache-Control')).toBe('private, no-store');
  await p.update({collection:'events',id:club,user:leader,overrideAccess:false,data:{_status:'draft'}});
  await expect(v2.getImage(p,null,{kind:'event-post',id:club,index:0,ifNoneMatch:image.headers.get('ETag')})).rejects.toMatchObject({status:404});
 });
 it('contact cards project consent only and revoke before conditional image caching',async()=>{
  const applicant=await createUser('v2-contact',['member']);
  const app=await p.create({collection:'community-applications',user:applicant,overrideAccess:false,data:{applicant:applicant.id,game,proposedGame:'合成',realName:'合成姓名',phone:'+100000000000',wechatQr:'data:image/png;base64,'+png.toString('base64'),contactConsent:true,reason:'只用于隔离合成测试的申请说明'}});
  await decideCommunityApplication(p,leader,app.id,'approved','',app.updatedAt);
  const approved=await p.findByID({collection:'community-applications',id:app.id,user:applicant,overrideAccess:false,depth:0});
  const contacts=await v2.getContacts(p,member,{slug:'v2-'+stamp});const card=contacts.contacts.find(c=>c.id===applicant.id);expect(card).toBeTruthy();expect(JSON.stringify(contacts)).not.toMatch(/data:|100000000000|@example.invalid|合成姓名/);
  const response=await v2.getImage(p,member,{kind:'contact',id:game,index:applicant.id});expect(response.status).toBe(200);
  await expect(v2.getImage(p,null,{kind:'contact',id:game,index:applicant.id})).rejects.toMatchObject({status:404});
  const readerPassword=randomBytes(24).toString('hex');
  const reader=await p.create({collection:'users',overrideAccess:true,context:{system:true},data:{name:'v2-contact-reader-'+stamp,email:'v2-contact-reader-'+stamp+'@example.invalid',password:readerPassword,roles:['member']}});
  const readerLogin=await p.login({collection:'users',data:{email:reader.email,password:readerPassword}});
  const readerAuth=await p.auth({headers:new Headers({authorization:'JWT '+readerLogin.token})});
  const signed=await v2.signImages(p,readerAuth.user as User,{sources:[card!.qr.src]});
  const signedURL=new URL(signed.images[0].url,serverURL),signedPath=signedURL.pathname.slice('/api/v2/'.length).split('/');
  expect((await v2Request(p,new Request(signedURL),signedPath)).status).toBe(200);
  await updateCommunityCard(p,applicant,app.id,approved.updatedAt,{contactConsent:false});
  expect((await v2Request(p,new Request(signedURL,{headers:{'if-none-match':'*'}}),signedPath)).status).toBe(404);
  expect((await v2.getContacts(p,member,{slug:'v2-'+stamp})).contacts.some(c=>c.id===applicant.id)).toBe(false);
  await expect(v2.getImage(p,member,{kind:'contact',id:game,index:applicant.id,ifNoneMatch:response.headers.get('ETag')})).rejects.toMatchObject({status:404});
 });
 it('production demo and unpublished parent are excluded, private text never leaks',async()=>{
  const g=await p.create({collection:'games',overrideAccess:true,context:{system:true},data:{title:'V2待隐藏',slug:'v2-laterhidden-'+stamp,_status:'published'}});
  const a=await p.update({collection:'users',id:editor.id,overrideAccess:true,context:{system:true},data:{communityOffices:[...editor.communityOffices!,{game:g.id,status:'active',publishContent:true}]}});
  await p.create({collection:'community-posts',user:a,overrideAccess:false,data:{game:g.id,author:a.id,title:'hidden-parent-secret',body:'private-parent-body',category:'event'}});
  await p.update({collection:'games',id:g.id,user:leader,overrideAccess:false,data:{_status:'draft'}});
  expect(JSON.stringify(await v2.getCalendar(p,member))).not.toContain('hidden-parent-secret');expect(JSON.stringify(await v2.getFeed(p,member))).not.toContain('private-parent-body');
  expect(JSON.stringify(await v2.getCalendar(p,null))).not.toContain('合成公开正文');
  const demo=await p.create({collection:'events',user:leader,overrideAccess:false,data:{title:'demo-must-not-project',slug:'v2-demo-'+stamp,_status:'published',demo:true}});
  const oldEnv=process.env.APP_ENV;
  try{process.env.APP_ENV='production';expect(JSON.stringify(await v2.getCalendar(p,null))).not.toContain('demo-must-not-project');await expect(v2.getEventDetail(p,null,{source:'club',id:demo.id})).rejects.toMatchObject({status:404});}finally{process.env.APP_ENV=oldEnv;}
  expect(hiddenGame).toBeGreaterThan(0);
 });
});
