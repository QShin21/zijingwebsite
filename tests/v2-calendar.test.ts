import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payload } from 'payload';
import type { User } from '../src/payload-types';
vi.mock('../src/lib/content-promotions',()=>({promotedContent:async()=>[]}));
import { getCalendar, getCalendarDays, signupSummary } from '../src/lib/v2/events';
const user={id:2,roles:['member'],accountStatus:'active'} as User;
const pub={_status:'published',signupForm:{enabled:false},lifecycle:'scheduled'};
const game={id:8,slug:'sample',title:'合成社群',_status:'published'};
function pWith(club:Record<string,unknown>[],community:Record<string,unknown>[]=[]) {
 const find=vi.fn(async(args:Record<string,unknown>)=>({docs:args.collection==='events'?club:args.collection==='community-posts'?community:args.collection==='games'?[game]:args.collection==='event-signups'?[{id:1,dedupeKey:'events:1:2'}]:[]}));
 return {find,findByID:vi.fn(async()=>user)} as unknown as Payload;
}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));});afterEach(()=>vi.useRealTimers());
describe('V2 calendar bounded candidates and effective registration',()=>{
 it('one signup query per calendar independent of number of cards',async()=>{const rows=Array.from({length:20},(_,i)=>({id:i+1,...pub,title:'合成'+i,startAt:'2026-11-12T10:00:00Z',endAt:'2026-11-12T11:00:00Z',game:8}));const p=pWith(rows);const result=await getCalendar(p,user,{limit:50});expect(result.docs).toHaveLength(20);expect(result.docs[0].signup.viewerSubmitted).toBe(true);expect(result.docs[1].signup.viewerSubmitted).toBe(false);expect(vi.mocked(p.find).mock.calls.filter(([arg])=>arg.collection==='event-signups')).toHaveLength(1);});
 it('keeps old undated club events and relegates old undated community events to past',async()=>{const p=pWith([{id:1,...pub,title:'社团时间待定',createdAt:'2026-08-01'}],[{id:2,title:'老社群',category:'event',status:'visible',game:8,createdAt:'2026-08-01'},{id:3,title:'新社群',category:'event',status:'visible',game:8,createdAt:'2026-11-01'}]);const upcoming=await getCalendar(p,user);expect(upcoming.docs.map(v=>v.title)).toEqual(['新社群','社团时间待定']);const past=await getCalendar(p,user,{range:'past'});expect(past.docs.map(v=>v.title)).toEqual(['老社群']);});
 it('month boundary is Beijing and past DB candidates are descending before limit500',async()=>{const p=pWith([{id:1,...pub,title:'北京时间下月',startAt:'2026-11-30T16:30:00Z'},{id:2,...pub,title:'北京时间本月',startAt:'2026-11-30T15:30:00Z'}]);expect((await getCalendar(p,null,{range:'month',month:'2026-11'})).docs.map(v=>v.title)).toEqual(['北京时间本月']);await getCalendar(p,null,{range:'past'});expect(p.find).toHaveBeenCalledWith(expect.objectContaining({collection:'events',limit:500,sort:'-startAt'}));expect(JSON.stringify(vi.mocked(p.find).mock.calls[0][0].where)).toContain('2026-10-31T16:00:00.000Z');});
 it('team filter is applied to source query before pagination and suppresses unrelated community source',async()=>{const p=pWith([]);await getCalendar(p,user,{team:15,scope:'club'});expect(p.find).toHaveBeenCalledWith(expect.objectContaining({collection:'events',where:expect.objectContaining({and:expect.any(Array)})}));expect(JSON.stringify(vi.mocked(p.find).mock.calls.find(([arg])=>arg.collection==='events')?.[0].where)).toContain('"team":{"equals":15}');expect(vi.mocked(p.find).mock.calls.some(([arg])=>arg.collection==='community-posts')).toBe(false);});
 it('effective start is latest and deadline earliest of active questionnaire + event windows',()=>{const card=signupSummary({id:1,_status:'published',signupForm:{enabled:true,start:'2026-11-12T10:00:00Z',end:'2026-12-01T10:00:00Z',questions:[{id:'name',label:'合成',type:'text',required:true}]},registrationStart:'2026-11-13T10:00:00Z',registrationEnd:'2026-11-20T10:00:00Z'},'club',null);expect(card.opensAt).toBe('2026-11-13T10:00:00.000Z');expect(card.deadline).toBe('2026-11-20T10:00:00.000Z');expect(card.state).toBe('notStarted');});
});

it('signupOpen filters effective state before pagination and keeps totals consistent', async () => {
 const openForm={enabled:true,questions:[{id:'name',label:'合成',type:'text',required:true}]};
 const p=pWith([
  {id:1,...pub,title:'无报名'},
  {id:2,...pub,title:'开放',signupForm:openForm},
  {id:3,...pub,title:'关闭',signupForm:{...openForm,closed:true}},
  {id:4,...pub,title:'开放外链',registrationURL:'https://example.invalid/signup'},
  {id:5,...pub,title:'未开始',signupForm:{...openForm,start:'2026-12-01T00:00:00Z'}},
 ]);
 const first=await getCalendar(p,null,{signupOpen:'1',limit:1});
 expect(first).toMatchObject({totalDocs:2,totalPages:2,page:1,hasNextPage:true});
 expect(first.docs.every(event=>event.signup.state==='open')).toBe(true);
 const second=await getCalendar(p,null,{signupOpen:true,limit:1,page:2});
 expect(second).toMatchObject({totalDocs:2,totalPages:2,page:2,hasNextPage:false});
 expect(second.docs[0].signup.mode).toBe('external');
 expect((await getCalendar(p,null,{signupOpen:false})).totalDocs).toBe(5);
 await expect(getCalendar(p,null,{signupOpen:'yes'})).rejects.toMatchObject({status:400});
});


it('marks the full Beijing month beyond the first page and distinguishes own signups', async () => {
 const rows=Array.from({length:60},(_,i)=>({id:i+1,...pub,title:'合成'+i,startAt:'2026-11-14T10:00:00Z',endAt:'2026-11-14T11:00:00Z'}));
 rows.push({id:61,...pub,title:'下月',startAt:'2026-11-30T16:30:00Z',endAt:'2026-12-01T01:00:00Z'});
 const p=pWith(rows);
 expect(await getCalendarDays(p,user,{month:'2026-11',scope:'mine',signupOpen:true,page:2,limit:1})).toEqual([{date:'2026-11-14',count:60,mine:1}]);
 expect(await getCalendarDays(p,null,{month:'2026-11'})).toEqual([{date:'2026-11-14',count:60,mine:0}]);
});
it('filters a clicked Beijing day before pagination and rejects impossible dates', async () => {
 const p=pWith([
  {id:1,...pub,title:'前一天',startAt:'2026-11-13T15:30:00Z'},
  {id:2,...pub,title:'当天',startAt:'2026-11-13T16:30:00Z'},
  {id:3,...pub,title:'当天第二场',startAt:'2026-11-14T10:00:00Z'},
 ]);
 const result=await getCalendar(p,user,{range:'month',month:'2026-11',day:'2026-11-14',limit:1,page:2});
 expect(result).toMatchObject({totalDocs:2,totalPages:2});
 expect(result.docs[0].title).toBe('当天第二场');
 for(const day of ['2026-11-31','2026-12-01','invalid']) await expect(getCalendar(p,user,{range:'month',month:'2026-11',day})).rejects.toMatchObject({status:400});
});
it('omits cancelled events from calendar markers', async () => {
 const p=pWith([{id:1,...pub,title:'取消',lifecycle:'cancelled',startAt:'2026-11-14T10:00:00Z'}]);
 expect(await getCalendarDays(p,user,{month:'2026-11'})).toEqual([]);
});
