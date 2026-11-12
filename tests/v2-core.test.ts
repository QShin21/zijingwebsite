import { describe, expect, it, vi } from 'vitest';
import type { Payload } from 'payload';
import type { User } from '../src/payload-types';
import { beijingScheduleTime, communitySchedule } from '../src/lib/v2/schedule';
import { promotionVersion } from '../src/lib/promotion-model';
import { pageInput, paginate, safeBody } from '../src/lib/v2/shared';
import { getSession } from '../src/lib/v2/identity';
import { isGuestPage } from '../src/lib/page-access';
const actor=(roles: User['roles'],extra={})=>({id:1,name:'合成',email:'synthetic@example.invalid',roles,accountStatus:'active',...extra} as User);
describe('V2 schedule, safe projection and current authority',()=>{
 it.each(['2026-02-30T12:10','2026-13-01T12:10','2026-11-11T25:00','2026-11-11T12:00Z','x'])('rejects invalid Beijing datetime %s',value=>expect(()=>beijingScheduleTime(value)).toThrow());
 it('parses Beijing independent of server timezone and rejects impossible schedule',()=>{expect(beijingScheduleTime('2026-11-11T12:00')).toBe('2026-11-11T04:00:00.000Z');expect(beijingScheduleTime('')).toBeNull();expect(()=>communitySchedule({startAt:'2026-11-11T10:00Z',endAt:'2026-11-11T09:00Z'},'event')).toThrow();expect(()=>communitySchedule({location:'合成地点'},'notice')).toThrow();expect(communitySchedule({},'notice')).toEqual({startAt:null,endAt:null,location:null});});
 it('schedule fields bind promotion revision; empty legacy fields keep prior revision',()=>{const legacy={title:'合成',body:'合成',game:1,status:'visible',category:'event'};expect(promotionVersion({...legacy,startAt:null,endAt:null,location:null})).toBe(promotionVersion(legacy));for(const key of ['startAt','endAt','location'])expect(promotionVersion({...legacy,[key]:'2026-11-11T10:00:00Z'})).not.toBe(promotionVersion(legacy));});
 it('caps pagination and does not promote unknown nodes or unsafe rich links',()=>{expect(pageInput({page:-1,limit:1000})).toEqual({page:1,limit:50});expect(paginate([1,2],{page:9})).toMatchObject({docs:[],totalDocs:2,hasNextPage:false});expect(safeBody({root:{type:'root',children:[{type:'script',text:'secret'}]}})).toBeNull();expect(safeBody({root:{type:'root',children:[{type:'link',fields:{url:'javascript:alert(1)'}}]}})).toBeNull();});
 it.each(['/','/join','/about','/contact','/join/staff','/join/staff/batches/3'])('opens intended guest page %s',path=>expect(isGuestPage(path)).toBe(true));
 it.each(['/community','/teams','/account','/join/teams','/join/members','/join-anything','/about-private'])('does not open private prefix %s',path=>expect(isGuestPage(path)).toBe(false));
 it.each([
 ['member',{}],['communityAdmin',{}],['backbone',{department:'publicity'}],['vicePresident',{}],['president',{}],
 ] as const)('projects current %s authority without serializing internal user',async(role,extra)=>{const user=actor([role],{...extra,phone:'secret-phone',internalNotes:'secret-note'});const p={findByID:vi.fn().mockResolvedValue(user),find:vi.fn().mockResolvedValue({docs:[]})} as unknown as Payload;const result=await getSession(p,actor(['president']));expect(result.viewer?.roles).toEqual([role]);expect(result.viewer?.capabilities.publishClub).toBe(['president','vicePresident'].includes(role));expect(JSON.stringify(result)).not.toMatch(/secret-phone|secret-note/);});
 it('revoked offices are not inherited from token; contact consent is explicit',async()=>{const stale=actor(['president'],{communityOffices:[{game:1,status:'active',contactConsent:true}]});const p={findByID:vi.fn().mockResolvedValue(actor(['member'],{communityOffices:[]}))} as unknown as Payload;expect((await getSession(p,stale)).viewer?.capabilities).toMatchObject({publishClub:false,communities:[]});});
 it('suspended account becomes guest, missing user never reuses stale token',async()=>{const p={findByID:vi.fn().mockResolvedValue(actor(['president'],{accountStatus:'suspended'}))} as unknown as Payload;expect(await getSession(p,actor(['president']))).toEqual({viewer:null});});
});
