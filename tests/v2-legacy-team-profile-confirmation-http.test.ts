import { randomBytes } from 'node:crypto';
import { getPayload, type Payload } from 'payload';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { serverURL } from '../src/lib/environment';
import type { User } from '../src/payload-types';
import type { OwnTeamProfile, TeamProfilesView } from '../src/lib/team-profiles-model';
import { profileFixture } from './team-profiles-fixture';

// Server-only extraction of miniapp-team-profile-confirmation-http: real routes,
// JWT, HMAC, ACLs and SQL execute. No client/Page/cache/transport source is read.
// Do not discover credentials or read .env; only explicit synthetic test env is accepted.
vi.mock('dotenv/config', () => ({}));
const locator = vi.hoisted(() => ({ cms: vi.fn() }));
vi.mock('../src/lib/content', () => ({ cms: locator.cms }));
import { GET, PUT } from '../src/app/(frontend)/api/team-profiles/[teamID]/route';

type Data = Record<string, unknown>;
type Login = { token: string; exp: number; user: User };
let p: Payload, fixture: Awaited<ReturnType<typeof profileFixture>>, memberLogin: Login, viewerLogin: Login;
const base = new URL(serverURL).origin;
const context = (team: number) => ({ params: Promise.resolve({ teamID: String(team) }) });
async function route(method: 'GET' | 'PUT', team: number, headers: Record<string, string>, data?: Data) {
  const request = new Request(base + '/api/team-profiles/' + team, { method, headers, ...(data ? { body: JSON.stringify(data) } : {}) });
  const response = method === 'PUT' ? await PUT(request, context(team)) : await GET(request, context(team));
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  return { status: response.status, body: await response.json() as TeamProfilesView & { profile: OwnTeamProfile; error?: string; code?: string } };
}
async function read(actor: Login, team = fixture.first.id) {
  const result = await route('GET', team, { Authorization: 'JWT ' + actor.token }); expect(result.status).toBe(200); return result.body;
}
const profile = (displayName: string, biography = '合成用户明确保存的资料') => ({ displayName, position: '合成位置', biography, avatar: null, visible: true });
const write = (view: TeamProfilesView, displayName: string, team = fixture.first.id, actor = memberLogin) => route('PUT', team,
  { Authorization: 'JWT ' + actor.token, Origin: base, 'content-type': 'application/json' },
  { revision: view.own.profile?.revision ?? null, membershipVersion: view.own.membershipVersion, profile: profile(displayName) });
async function prepareRevisionThree() {
  for (let revision = 1; revision <= 3; revision++) {
    const view = await read(memberLogin);
    const result = await route('PUT', fixture.first.id, { Authorization: 'JWT ' + memberLogin.token, Origin: base, 'content-type': 'application/json' }, {
      revision: view.own.profile?.revision ?? null, membershipVersion: view.own.membershipVersion,
      profile: profile('合成简介基线', '合成准备资料' + revision),
    });
    expect(result.status).toBe(200); expect(result.body.profile.revision).toBe(revision);
  }
}
function noForeignPrivateFields(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(/PRIVATE_PROFILE_TEST_ANSWER|"membership"|"user"|requestKey|reviewNotes|"email"|"phone"/);
}

beforeAll(async () => {
  let db: URL;
  try { db = new URL(process.env.DATABASE_URL || ''); } catch { throw new Error('Explicit isolated synthetic DATABASE_URL required; .env is never loaded'); }
  const delegatedQA = db.hostname === '127.0.0.1' && db.port === '55578' && db.pathname === '/miniapp_team_qa_synthetic';
  const integrationQA = db.hostname === '127.0.0.1' && db.port === '55439' && db.pathname === '/zijing_integration_synthetic' && db.username === 'zijing';
  const v2QA = ['127.0.0.1', 'localhost'].includes(db.hostname) && (db.pathname === '/zijing_v2_backend_synthetic' || db.port === '55617' && db.pathname === '/zijing_rebuild_contracts_synthetic' && db.username === 'rebuild_synthetic' && process.env.REBUILD_QA_PROFILE === 'contracts');
  if (process.env.APP_ENV !== 'development' || process.env.DB_PUSH !== 'false' || !(delegatedQA || integrationQA || v2QA))
    throw new Error('Explicit disposable synthetic profile database and DB_PUSH=false required');
  // Import only after rejecting unsafe or missing env. dotenv/config is mocked.
  const { default: config } = await import('../src/payload.config');
  p = await getPayload({ config, key: 'v2-legacy-profile-confirmation-' + randomBytes(5).toString('hex') }); locator.cms.mockResolvedValue(p);
});
beforeEach(async () => {
  fixture = await profileFixture(p);
  async function login(user: User): Promise<Login> {
    const result = await p.login({ collection: 'users', data: { email: user.email, password: fixture.password } });
    if (!result.token || !result.exp) throw new Error('Synthetic profile login required'); return { token: result.token, exp: result.exp, user };
  }
  memberLogin = await login(fixture.member); viewerLogin = await login(fixture.viewer); await prepareRevisionThree();
});
afterEach(async () => {
  if (!fixture) return;
  const actors = [fixture.admin.id, fixture.member.id, fixture.viewer.id];
  await p.delete({ collection: 'audit', overrideAccess: true, where: { or: [{ actor: { in: actors } }, { object: { in: actors.map(id => 'users:' + id) } }] } });
  await fixture.cleanup();
});
afterAll(async () => { if (p) await p.destroy(); });

describe('V2保留：简介确认边界的真实HTTP/SQL/JWT/HMAC', () => {
  it.each(['network', 'cache'])('GET3→PUT ACK4→%s确认中断：服务端保持4，显式再GET4后保存才产生5', async outcome => {
    const baseline = await read(memberLogin); expect(baseline.own.profile?.revision).toBe(3);
    const ack = await write(baseline, '合成已确认保存四版'); expect(ack.status).toBe(200); expect(ack.body.profile.revision).toBe(4);
    // Transport interruption/cache is represented at the test consumer only.
    // It never invokes a second server write or fabricates a signer/period.
    const interrupted = outcome === 'cache' ? structuredClone(baseline) : null;
    if (interrupted) expect(interrupted.own.profile?.revision).toBe(3);
    expect((await read(memberLogin)).own.profile).toEqual(ack.body.profile);
    const fresh = await read(memberLogin); expect(fresh.own.profile?.revision).toBe(4);
    const next = await write(fresh, '合成用户明确保存五版'); expect(next.status).toBe(200); expect(next.body.profile.revision).toBe(5);
    const confirmed = await read(memberLogin); expect(confirmed.own.profile).toMatchObject({ revision: 5, displayName: '合成用户明确保存五版' });
    noForeignPrivateFields(confirmed); noForeignPrivateFields(ack.body);
    const viewer = await read(viewerLogin); expect(viewer.own).toEqual({ eligible: false, membershipVersion: null, profile: null });
    expect(viewer.profiles).toHaveLength(1); noForeignPrivateFields(viewer);
    expect(JSON.stringify(viewer)).not.toContain(baseline.own.membershipVersion!); expect(viewer.profiles[0]).not.toHaveProperty('revision');
  });
  it('ACK后成员周期变更默认隐藏，拒绝旧HMAC，明确新周期同意才能重新公开', async () => {
    const baseline = await read(memberLogin), ack = await write(baseline, '合成已确认保存四版');
    expect(ack.status).toBe(200); expect(ack.body.profile.revision).toBe(4);
    const joinedAt = new Date(Math.max(Date.now(), Date.parse(fixture.membership.joinedAt) + 1)).toISOString();
    await fixture.changeMembership({ status: 'revoked', leftAt: joinedAt, revokedAt: joinedAt });
    await fixture.changeMembership({ status: 'active', joinedAt, leftAt: null, revokedAt: null });
    const fresh = await read(memberLogin);
    expect(fresh.own.membershipVersion).not.toBe(baseline.own.membershipVersion); expect(fresh.own.profile?.visible).toBe(false);
    expect((await read(viewerLogin)).profiles).toEqual([]);
    const stale = await write({ ...baseline, own: { ...baseline.own, profile: ack.body.profile } }, '合成旧同意不应生效');
    expect(stale.status).toBe(409); expect(stale.body).toEqual({ error: expect.any(String), code: 'PROFILE_PERIOD_CHANGED' });
    expect((await read(memberLogin)).own.profile).toEqual(fresh.own.profile);
    const saved = await write(fresh, '合成新周期主动同意'); expect(saved.status).toBe(200); expect(saved.body.profile.visible).toBe(true);
    expect(saved.body.profile.revision).toBe(5); expect((await read(memberLogin)).own.profile?.visible).toBe(true);
    expect((await read(viewerLogin)).profiles).toHaveLength(1); noForeignPrivateFields(saved.body);
  });
  it.each(['actor', 'route'])('ACK后%s切换不取得旧本人的编辑资格或跨范围写入', async change => {
    const baseline = await read(memberLogin), ack = await write(baseline, '合成已确认保存四版');
    expect(ack.status).toBe(200); expect(ack.body.profile.revision).toBe(4);
    const old = await read(memberLogin); expect(old.own.profile?.revision).toBe(4);
    const actor = change === 'actor' ? viewerLogin : memberLogin, team = change === 'route' ? fixture.second.id : fixture.first.id;
    const current = await read(actor, team); expect(current.own).toEqual({ eligible: false, membershipVersion: null, profile: null });
    const forged = await write(old, '合成跨范围禁止再写', team, actor); expect(forged.status).toBe(403);
    expect((await read(memberLogin)).own.profile).toEqual(ack.body.profile); noForeignPrivateFields(current);
  });
  it('HTTP来源和身份均验证，Origin不能代替JWT且跨站写入不改变SQL修订', async () => {
    const baseline = await read(memberLogin);
    const anonymous = await route('PUT', fixture.first.id, { Origin: base, 'content-type': 'application/json' }, { profile: profile('合成匿名禁止'), membershipVersion: baseline.own.membershipVersion, revision: 3 });
    expect(anonymous.status).toBe(401);
    const cross = await route('PUT', fixture.first.id, { Authorization: 'JWT ' + memberLogin.token, Origin: 'https://untrusted.example.invalid', 'content-type': 'application/json' }, { profile: profile('合成跨站禁止'), membershipVersion: baseline.own.membershipVersion, revision: 3 });
    expect(cross.status).toBe(403); expect((await read(memberLogin)).own.profile?.revision).toBe(3);
  });
});
