import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { createRequire } from 'node:module';
import pg from 'pg';
import sharp from 'sharp';
import { type MigrateUpArgs } from '@payloadcms/db-postgres';
import { migrations } from '../src/migrations';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import * as v2 from '../src/lib/v2';
import { mediaRef } from '../src/lib/v2/shared';
import { controlledImageRef } from '../src/lib/v2/images';
import { seatActivity, seatingState, seatProof, seatingWorkbench } from '../src/lib/activity-seating';
import { v2Request } from '../src/lib/v2/http';

const url = new URL(process.env.DATABASE_URL!);
assert.equal(process.env.V2_COMPAT_SYNTHETIC, 'true');
assert.equal(process.env.APP_ENV, 'development');
assert.equal(process.env.DB_PUSH, 'false');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.pathname, '/zijing_v2_backend_synthetic');
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
assert.equal((await db.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0].n, 0);
const require = createRequire(import.meta.url);
const adapterRequire = createRequire(require.resolve('@payloadcms/db-postgres'));
const { PgDialect } = adapterRequire('drizzle-orm/pg-core');
const dialect = new PgDialect();
const executor = { execute: async (statement: Parameters<typeof dialect.sqlToQuery>[0]) => {
  const query = dialect.sqlToQuery(statement);
  return db.query(query.sql, query.params);
} };
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
type Census = Record<string, { columns: string[]; count: number; sha256: string }>;
async function census(previous?: Census): Promise<Census> {
  const columns = previous ? Object.entries(previous).flatMap(([table_name, value]) => value.columns.map(column_name => ({ table_name, column_name })))
    : (await db.query<{ table_name: string; column_name: string }>("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
  const tables = new Map<string, string[]>();
  for (const { table_name, column_name } of columns) {
    if (table_name === 'payload_migrations') continue;
    tables.set(table_name, [...tables.get(table_name) ?? [], column_name]);
  }
  const result: Census = {};
  for (const [name, columns] of tables) {
    const rows = (await db.query(`SELECT row_to_json(t)::text row FROM (SELECT ${columns.map(quote).join(',')} FROM ${quote(name)}) t ORDER BY row_to_json(t)::text`)).rows;
    result[name] = { columns, count: rows.length, sha256: createHash('sha256').update(rows.map(row => row.row).join('\n')).digest('hex') };
  }
  return result;
}
const checkpoints: { baseline: string; before: Census; comparedAfter?: string }[] = [];
const password = 'Synthetic-Only-Legacy-Password-20261112', salt = 'Synthetic-Legacy-Salt';
const legacyHash = pbkdf2Sync(password, salt, 25000, 512, 'sha256').toString('hex');
const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#7956cf' } }).png().toBuffer();
const dataImage = 'data:image/png;base64,' + image.toString('base64');
const proofImage = await sharp(image).webp().toBuffer();
let member = 0, manager = 0, game = 0, event = 0, post = 0, showcase = 0, media = 0;
let interruptedMigrationAtomic = false;
const mainSeating = process.env.V2_COMPAT_SEATING === 'true';
const applied = new Set<number>();
const appliedNames: string[] = [];
let historicalProof = '';
async function insert(table: string, values: Record<string, unknown>): Promise<number> {
  const keys = Object.keys(values);
  return (await db.query(`INSERT INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`, Object.values(values))).rows[0].id;
}
async function apply(index: number) {
  const migration = migrations[index];
  await db.query('BEGIN');
  try {
    await migration.up({ db: executor } as unknown as MigrateUpArgs);
    await db.query('INSERT INTO payload_migrations(name,batch) VALUES($1,$2)', [migration.name, index + 1]);
    await db.query('COMMIT');
    applied.add(index); appliedNames.push(migration.name);
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}
try {
  for (let i = 0; i < migrations.length; i++) {
    if (applied.has(i)) continue;
    // Simulate a process interruption during an additive migration, then retry.
    if (migrations[i].name === '20261111_000000_v2_media_schedule') {
      const before = await census();
      await db.query('BEGIN');
      await migrations[i].up({ db: executor } as unknown as MigrateUpArgs);
      await db.query('ROLLBACK');
      assert.deepEqual(await census(), before);
      assert.equal((await db.query("SELECT to_regclass('public.pending_uploads') name")).rows[0].name, null);
      interruptedMigrationAtomic = true;
    }
    await apply(i);
    console.log('Applied ' + migrations[i].name);
    if (i === 2) {
      member = await insert('users', { name: 'SyntheticMember', account: '900001', email: 'member@example.invalid', salt, hash: legacyHash });
      manager = await insert('users', { name: 'SyntheticManager', account: '900002', email: 'manager@example.invalid', salt, hash: legacyHash });
      await db.query("INSERT INTO users_roles(\"order\",parent_id,value) VALUES(1,$1,'member'),(1,$2,'communityAdmin')", [member, manager]);
      media = await insert('media', { alt: 'Synthetic legacy image', credit: 'Synthetic fixture', filename: 'synthetic-legacy.png', mime_type: 'image/png', filesize: image.length, width: 4, height: 4, url: 'http://localhost:3000/api/media/file/synthetic-legacy.png' });
      await fs.writeFile(path.join(process.env.MEDIA_DIR!, 'synthetic-legacy.png'), image);
      game = await insert('games', { title: 'Synthetic legacy community', slug: 'synthetic-legacy', _status: 'published', cover_id: media });
      const team = await insert('teams', { title: 'Synthetic legacy team', slug: 'synthetic-legacy-team', game_id: game, _status: 'published' });
      const season = await insert('seasons', { title: 'Synthetic legacy season', slug: 'synthetic-legacy-season', team_id: team, _status: 'published' });
      await db.query("INSERT INTO seasons_members(_order,_parent_id,id,display_name,consent) VALUES(1,$1,'synthetic-consented','Visible synthetic member',true),(2,$1,'synthetic-private','Private synthetic member',false)", [season]);
      const site = await insert('site', { name: 'Synthetic legacy site', hero_image_id: media });
      await db.query("INSERT INTO site_modules(_order,_parent_id,id,kind,enabled,title) VALUES(1,$1,'synthetic-module','events',false,'Preserve this legacy setting')", [site]);
      event = await insert('events', { title: 'Synthetic legacy event', slug: 'synthetic-legacy-event', game_id: game, _status: 'published', cover_id: media });
      post = await insert('community_posts', { title: 'Synthetic legacy post', body: 'Preserve legacy body', game_id: game, author_id: manager, category: 'event' });
      await insert('community_applications', { applicant_id: manager, game_id: game, proposed_game: 'Synthetic legacy community', reason: 'Synthetic legacy application', status: 'approved' });
      await db.query("INSERT INTO users_rels(\"order\",parent_id,path,games_id) VALUES(1,$1,'communities',$3),(1,$2,'communities',$3)", [member, manager, game]);
      checkpoints.push({ baseline: migrations[i].name, before: await census() });
    }
    if (i === 4) await db.query('UPDATE community_applications SET wechat_qr=$1,real_name=$2,phone=$3', [dataImage, 'Synthetic Name', '13900000000']);
    if (i === 7) {
      showcase = await insert('community_showcase', { title: 'Synthetic old showcase', game_id: game, author_id: member, status: 'visible' });
      await db.query("INSERT INTO community_showcase_images(_order,_parent_id,id,source) VALUES(1,$1,'synthetic-image',$2)", [showcase, dataImage]);
    }
    if (i === 10) {
      await insert('event_signups', { activity_type: 'events', activity_i_d: event, dedupe_key: 'legacy-synthetic-signup', member_id: member, organizer_id: manager, game_id: game, member_name: 'SyntheticMember', event_title: 'Synthetic legacy event', form_version: 'legacy-synthetic', questions: '[]', answers: JSON.stringify({ synthetic: 'Preserve answer' }) });
      checkpoints.push({ baseline: migrations[i].name, before: await census() });
    }
    if (i === 17) {
      await db.query('UPDATE events SET post_images=$1 WHERE id=$2', [JSON.stringify([{ source: dataImage, alt: 'Synthetic old publication' }]), event]);
      checkpoints.push({ baseline: migrations[i].name, before: await census() });
      if (mainSeating) {
        // main deployed seating before either V2 migration. Keep its original name
        // and rows, then apply the missing V2 migrations without recreating it.
        const index = migrations.findIndex(m => m.name === '20261112_000000_activity_seating');
        assert.ok(index > i); await apply(index);
        const setting = await insert('activity_seatings', { event_id: event, enabled: true });
        const oldRequest = await insert('activity_seat_requests', { seating_id: setting, member_id: member,
          member_name: 'Synthetic historical member', phone: '13900000000', seats: ['1-1', '1-2'], status: 'pending' });
        await db.query("INSERT INTO activity_seat_claims(seating_id,seat,request_id) VALUES($1,'1-1',$2),($1,'1-2',$2)", [setting, oldRequest]);
        historicalProof = '12345678-1234-4567-89ab-1234567890ab';
        await db.query('INSERT INTO activity_seat_proofs(id,seating_id,member_id,request_id,picture) VALUES($1,$2,$3,$4,$5)',
          [historicalProof, setting, member, oldRequest, proofImage]);
        const otherSetting = await insert('activity_seatings', { post_id: post, enabled: false });
        await insert('activity_seat_requests', { seating_id: otherSetting, member_id: manager,
          member_name: 'Synthetic historical manager', phone: '13900000001', seats: ['2-1'], status: 'rejected',
          reviewer_id: member, reviewed_at: new Date('2026-11-01T01:00:00Z') });
        checkpoints.push({ baseline: 'main-7f56e08-with-activity-seating-before-v2', before: await census() });
      }
    }
  }
  // The earliest checkpoint predates intentionally added fixture rows/fields.
  // Compare it immediately on its unchanged tables, and all 58-table/November
  // baselines over every original business column.
  for (const checkpoint of checkpoints.slice(1)) {
    const after = await census(checkpoint.before);
    // A later synthetic seed intentionally fills events.post_images, a column
    // absent from the September/October baselines.
    assert.deepEqual(after, checkpoint.before);
    checkpoint.comparedAfter = migrations.at(-1)!.name;
  }
  const earlyUsers = checkpoints[0].before.users;
  assert.deepEqual((await census({ users: earlyUsers })).users, earlyUsers);
  assert.equal((await db.query('SELECT account FROM users WHERE id=$1', [member])).rows[0].account, '900001');
  assert.equal((await db.query('SELECT count(*)::int n FROM users_community_offices WHERE _parent_id=$1', [member])).rows[0].n, 0);
  assert.equal((await db.query('SELECT count(*)::int n FROM community_joins')).rows[0].n, 0);
  assert.equal((await db.query('SELECT count(*)::int n FROM team_memberships')).rows[0].n, 0);
  const office = (await db.query('SELECT * FROM users_community_offices WHERE _parent_id=$1', [manager])).rows[0];
  assert.equal(office.game_id, game); assert.equal(office.view_signups, true); assert.equal(office.contact_consent, true);
  assert.equal((await db.query('SELECT start_at FROM community_posts WHERE id=$1', [post])).rows[0].start_at, null);
  for (const names of [['DuplicateName', 'duplicatename'], [' invalid-name', 'ValidName']]) {
    await db.query('BEGIN');
    try {
      await db.query('CREATE SCHEMA synthetic_nickname_guard; SET LOCAL search_path TO synthetic_nickname_guard');
      await db.query('CREATE TABLE users(id integer PRIMARY KEY,name varchar,account varchar NOT NULL); CREATE UNIQUE INDEX users_account_idx ON users(account)');
      await db.query(`INSERT INTO users VALUES(1,$1,'900001'),(2,$2,'900002')`, names);
      const before = (await db.query('SELECT * FROM users ORDER BY id')).rows;
      await db.query('SAVEPOINT before_invalid_nickname');
      await assert.rejects(() => migrations[3].up({ db: executor } as unknown as MigrateUpArgs), /Nickname migration stopped/);
      await db.query('ROLLBACK TO SAVEPOINT before_invalid_nickname');
      assert.deepEqual((await db.query('SELECT * FROM users ORDER BY id')).rows, before);
      assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='synthetic_nickname_guard' AND column_name='name_key'")).rows[0].n, 0);
    } finally { await db.query('ROLLBACK'); }
  }
  const p = await getPayload({ config });
  try {
    const beforeRerun = await census();
    const migrationRows = (await db.query('SELECT * FROM payload_migrations ORDER BY id')).rows;
    await p.db.migrate();
    assert.deepEqual((await db.query('SELECT * FROM payload_migrations ORDER BY id')).rows, migrationRows);
    assert.deepEqual(await census(), beforeRerun);
    const schemaReadCollections: string[] = [];
    for (const collection of p.config.collections) {
      await p.find({ collection: collection.slug, overrideAccess: true, depth: 0, limit: 1 });
      schemaReadCollections.push(collection.slug);
    }
    await p.findGlobal({ slug: 'site', overrideAccess: true, depth: 0 });
    if (mainSeating) {
      const { GET } = await import('../src/app/health/ready/route');
      assert.equal((await GET()).status, 200);
    }
    const actor = await p.findByID({ collection: 'users', id: member, overrideAccess: true });
    if (mainSeating) {
      const activity = await seatActivity(p, 'events', event, actor);
      const state = await seatingState(p, activity, actor);
      assert.deepEqual(state.occupancy, { '1-1': 'pending', '1-2': 'pending' });
      assert.equal(state.mine?.status, 'pending');
      assert.deepEqual(await seatProof(p, activity, actor, historicalProof), proofImage);
      const reviewer = await p.findByID({ collection: 'users', id: manager, overrideAccess: true });
      assert.equal((await seatingWorkbench(p, activity, reviewer, 'pending', 1)).docs.length, 1);
    }
    const home = await v2.getHome(p, null);
    assert.equal(home.viewer, null);
    assert.equal((await v2.getCommunity(p, actor, { slug: 'synthetic-legacy' })).card.community.id, game);
    assert.equal((await v2.getMySignups(p, actor)).docs.length, 1);
    assert.equal((await v2.getShowcase(p, actor, { slug: 'synthetic-legacy' })).docs[0].title, 'Synthetic old showcase');
    const imageRef = controlledImageRef('showcase', showcase, 0, dataImage)!;
    assert.equal((await v2.getImage(p, actor, { kind: 'showcase', id: showcase, index: 0 })).status, 200);
    assert.equal(imageRef.src.startsWith('/api/v2/images/showcase/'), true);
    // Payload may return an absolute own-origin URL even for ordinary local uploads.
    const projectedMedia = await mediaRef(p, media);
    assert.equal(projectedMedia?.src, '/api/media/file/synthetic-legacy.png');
    assert.equal(createHash('sha256').update(await fs.readFile(path.join(process.env.MEDIA_DIR!, 'synthetic-legacy.png'))).digest('hex'), createHash('sha256').update(image).digest('hex'));
    await assert.rejects(() => v2.getMySignups(p, null), { status: 401 });
    const login = await p.login({ collection: 'users', data: { email: actor.email, password } });
    assert.ok(login.token); assert.ok(login.user); assert.equal(login.user.id, member);
    for (const headers of [{ authorization: 'JWT ' + login.token }, { cookie: 'payload-token=' + login.token, 'sec-fetch-site': 'same-origin' }] as Record<string, string>[]) {
      const response = await v2Request(p, new Request('http://localhost:3000/api/v2/session', { headers }), ['session']);
      assert.equal(response.status, 200); assert.equal((await response.json()).viewer.id, member);
    }
    const newUser = await p.create({ collection: 'users', overrideAccess: true, context: { system: true }, data: { name: 'SyntheticNewUser', email: 'new@example.invalid', password, roles: ['member'] } });
    assert.equal((await db.query('SELECT account FROM users WHERE id=$1', [newUser.id])).rows[0].account, null);
    await fs.writeFile(process.env.V2_COMPAT_EVIDENCE!, JSON.stringify({
      at: new Date().toISOString(), result: 'PASS', productionAccess: false, databasePush: false,
      source: mainSeating ? 'new 90c7c8d plus main d3a1446 seating integration; synthetic main-to-new upgrade' : 'new checkout with compatibility fixes',
      migrationsApplied: appliedNames, schemaReadCollections, mainSeatingHistoryPreserved: mainSeating,
      preservedCheckpoints: checkpoints.slice(1).map(c => ({ baseline: c.baseline, tables: Object.keys(c.before).length, rows: Object.values(c.before).reduce((n, t) => n + t.count, 0), unchangedOriginalColumnsSHA256: true })),
      preNicknameAccountAndAuthColumnsPreserved: true, invalidOrDuplicateNicknamesFailWithoutChanges: true, legacyPasswordLogin: true,
      websiteCookieAndMiniappJWT: true, rerunSkipsAppliedMigrations: true, interruptedMigrationAtomic,
      noInventedTeamOrWeChatMembership: true, managerOfficeBackfillAndOrdinaryUserPrivileges: true,
      oldSignupAndShowcaseReadable: true, oldMediaBytesAndSameOriginProjection: true,
      fullBackupRestore: 'NOT RUN: pg_dump/pg_restore unavailable in this executor',
      productionSchemaAndStorage: 'NOT INSPECTED',
    }, null, 2) + '\n');
  } finally { await p.destroy(); }
} finally { await db.end(); }

// Payload auth housekeeping may retain timers after destroy; this worker owns
// no server and has closed both clients before completing.
process.exit(0);
