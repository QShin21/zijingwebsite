import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Actual native Page, HTTP, session, privacy and private-file modules; no real account, service or SDK.
type Values = Record<string, unknown>;
type Image = { source: string; caption: string };
type Permissions = { edit: boolean; save: boolean; submit: boolean; withdraw: boolean; hide: boolean; reviewActions: string[] };
type RecordDTO = { id: number; revision: number; team: number; game: number; season: number | null; state: string; title: string;
  authorName: string; competition: string; placing: string; date: string | null; description: string; images: Image[];
  videoHref: string | null; submittedVersion: string | null; reviewNote: string | null; canReview: boolean; actions?: Permissions; [key: string]: unknown };
type Row = { id: number; revision: number; title: string; actions: Permissions; decisions: { action: string }[]; noteDraft: string; imageCount: number; hasVideo: boolean; [key: string]: unknown };
type PageData = { loading: boolean; ready: boolean; busy: boolean; needsLogin: boolean; error: string; operationError: string; message: string;
  docs: Row[]; record: Row | null; detail: Row | null; detailImages: { path: string; caption: string }[];
  images: { path: string; caption: string }[]; fields: { title: string; competition: string; placing: string; date: string; description: string; removeVideo: boolean };
  canSave: boolean; canSubmit: boolean; editable: boolean; conflict: boolean; uncertainCreate: boolean; recentDocs: Row[]; page: number; hasMore: boolean; teams: Values[]; [key: string]: unknown };
type Event = { currentTarget: { dataset: Values }; detail: { value?: unknown } };
type NativePage = { data: PageData; setData(values: Values): void; onLoad(options?: Record<string, string>): void; onShow(): Promise<void>; onHide(): void; onUnload(): void;
  retry(): Promise<void>; onReachBottom(): Promise<void>; save(): Promise<void>; submit(): Promise<void>; write(action: string): Promise<void>; reload(): Promise<void>;
  perform(event: Event): Promise<void>; note(event: Event): void; inspect(event: Event): Promise<void>; previewEvidence(event: Event): void;
  input(event: Event): void; date(event: Event): void; caption(event: Event): void; chooseImages(): Promise<void>; removeImage(event: Event): Promise<void>;
  chooseVideo(): Promise<void>; uploadVideo(): Promise<void>; viewVideo(): Promise<void>; videoError(event: Event): void;
  openPrivacy(): Promise<void>; create(): void; edit(event: Event): void; view(event: Event): Promise<void>; mine(): void; [key: string]: unknown };
type Request = { url: string; method: string; header: Record<string, string>; data?: Values;
  success(result: { statusCode: number; data: unknown }): void; fail(): void };
type Callback = { success(): void; fail(): void };
type PrivacyRequest = { start(needAuthorization: boolean): void };
type Modal = { success(value: { confirm: boolean }): void; fail(): void };
type Selection = { mediaType: string[]; success(value: { tempFiles: { tempFilePath: string; size?: number; fileType?: string }[] }): void; fail(): void };
type FileRead = { filePath: string; success(value: { data: ArrayBuffer }): void; fail(): void };
type FileWrite = { filePath: string; success(): void; fail(): void };
type Upload = { url: string; filePath: string; name: string; header: Record<string, string>; formData: Record<string, string>; success(value: { statusCode: number; data: string }): void; fail(): void };
type Download = { url: string; filePath: string; header: Record<string, string>; success(value: { statusCode: number; filePath: string }): void; fail(): void };
const owner: Permissions = { edit: true, save: true, submit: true, withdraw: true, hide: true, reviewActions: [] };
const reviewer: Permissions = { edit: false, save: false, submit: false, withdraw: false, hide: true, reviewActions: ['approve', 'return', 'reject'] };
const none: Permissions = { edit: false, save: false, submit: false, withdraw: false, hide: false, reviewActions: [] };
const hash = 'ab'.repeat(32), origin = 'https://home.thuzijing.top';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlYQAAAAASUVORK5CYII=';
const event = (dataset: Values, value?: unknown): Event => ({ currentTarget: { dataset }, detail: { value } });
const record = (extra: Partial<RecordDTO> = {}): RecordDTO => ({ id: 31, revision: 3, state: 'returned', team: 51, game: 41, season: 71,
  title: '合成荣誉投稿', authorName: '合成作者', competition: '合成赛事', placing: '合成奖项', date: '2026-10-12T00:00:00.000Z', description: '合成待审成果说明',
  images: [{ source: png, caption: '合成证据说明' }], videoHref: null, submittedVersion: hash, reviewNote: '合成反馈：请补充证据说明', canReview: false, actions: owner, ...extra });
const list = (docs = [record()], extra: Values = {}) => ({ docs, page: 1, totalPages: 1, totalDocs: docs.length,
  teams: [{ id: 51, title: '合成有效队伍', game: 41, gameTitle: '合成游戏', gameSlug: 'synthetic-game' }], actions: { create: true, review: true }, ...extra });
const flush = async () => { for (let i = 0; i < 18; i++) await Promise.resolve(); };
function harness(name: 'workspace' | 'edit', options: { route?: Record<string, string>; modalAuto?: boolean; privacyAuto?: boolean; selectionAuto?: boolean; imageReadAuto?: boolean; imageWriteAuto?: boolean; loggedOut?: boolean } = {}) {
  let stored: unknown = options.loggedOut ? null : { token: 'synthetic-honor-a', exp: 9999999999, user: { id: 7, name: '合成账号甲', roles: ['president'], accountStatus: 'active' } };
  const requests: Request[] = [], patches: Values[] = [], modals: Modal[] = [], authorizations: Callback[] = [], selections: Selection[] = [], fileReads: FileRead[] = [], fileWrites: FileWrite[] = [], uploads: Upload[] = [], downloads: Download[] = [];
  const unlink = vi.fn(), binary = Buffer.from(png.split(',')[1], 'base64');
  const bytes = () => binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) as ArrayBuffer;
  const mp4 = new Uint8Array(64); mp4.set([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 1, 105, 115, 111, 109]);
  const fs = { readFile(value: FileRead) { fileReads.push(value); if (value.filePath.endsWith('.mp4')) value.success({ data: mp4.buffer }); else if (options.imageReadAuto !== false) value.success({ data: bytes() }); },
    writeFile(value: FileWrite) { fileWrites.push(value); if (options.imageWriteAuto !== false) value.success(); }, unlink,
    stat(value: { success(result: { stats: { size: number; isFile(): boolean } }): void }) { value.success({ stats: { size: 64, isFile: () => true } }); },
    copyFile(value: { success(): void }) { value.success(); },
    readdir(value: { success(result: { files: string[] }): void }) { value.success({ files: [] }); } };
  // This fixture starts after nonempty website policy text and prior agreement.
  const policy = { loaded: true, text: '合成已发布网站隐私正文：仅主动选择后读取荣誉证据。' };
  const dialog = { available: () => policy.loaded && Boolean(policy.text.trim()),
    present: (request: PrivacyRequest) => request.start(false), close: vi.fn() };
  const currentPages = [{}, { selectComponent: (selector: string) => selector === '#privacyConsent' ? dialog : null }];
  const wx = { request: vi.fn((value: Request) => requests.push(value)), env: { USER_DATA_PATH: '/synthetic-private' }, getFileSystemManager: () => fs,
    getStorageSync: () => stored, setStorageSync: (_key: string, value: unknown) => { stored = value; }, removeStorageSync: () => { stored = null; },
    requirePrivacyAuthorize: vi.fn((value: Callback) => { authorizations.push(value); if (options.privacyAuto !== false) value.success(); }),
    openPrivacyContract: vi.fn((value: Callback) => value.success()),
    onNeedPrivacyAuthorization: vi.fn(), getPrivacySetting: vi.fn(),
    chooseMedia: vi.fn((value: Selection) => { selections.push(value); if (options.selectionAuto !== false) value.success({ tempFiles: [{ tempFilePath: value.mediaType.includes('video') ? '/synthetic-selected.mp4' : '/synthetic-selected.png', size: 64, fileType: value.mediaType.includes('video') ? 'video' : 'image' }] }); }),
    arrayBufferToBase64: (value: ArrayBuffer) => Buffer.from(value).toString('base64'),
    showModal: vi.fn((value: Modal) => { modals.push(value); if (options.modalAuto !== false) value.success({ confirm: true }); }),
    previewImage: vi.fn(), setNavigationBarTitle: vi.fn(), stopPullDownRefresh: vi.fn(), navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(), setClipboardData: vi.fn(),
    requestSubscribeMessage: vi.fn(), uploadFile: vi.fn((value: Upload) => { uploads.push(value); return { abort: vi.fn(() => value.fail()), onProgressUpdate: vi.fn() }; }),
    downloadFile: vi.fn((value: Download) => { downloads.push(value); return { abort: vi.fn(() => value.fail()), onProgressUpdate: vi.fn(), onHeadersReceived: vi.fn() }; }),
    createVideoContext: vi.fn(() => ({ stop: vi.fn() })) };
  const modules = new Map<string, { exports: unknown }>();
  function load(filename: string): unknown {
    filename = resolve(filename); if (modules.has(filename)) return modules.get(filename)!.exports;
    const module = { exports: {} as unknown }; modules.set(filename, module);
    runInNewContext(readFileSync(filename, 'utf8'), { module, wx, getCurrentPages: () => currentPages, require: (path: string) => load(resolve(dirname(filename), path + '.js')) });
    return module.exports;
  }
  const session = load('miniprogram/src/lib/session.js') as { save(value: unknown): void; clear(): void; user(): { id: number } | null };
  const consumer = load('miniprogram/src/lib/team-honor-workflow.js') as { record(value: unknown, withActions?: boolean): RecordDTO; row(value: RecordDTO): Row; input(value: Values, current: RecordDTO | null, team: number, submit: boolean): Values };
  let page!: NativePage; const path = resolve('miniprogram/src/pages/team-honor-' + name + '/index.js');
  runInNewContext(readFileSync(path, 'utf8'), { wx, Page: (value: NativePage) => { page = value; }, require: (name: string) => load(resolve(dirname(path), name + '.js')) });
  page.setData = values => {
    patches.push(values);
    for (const [key, value] of Object.entries(values)) {
      const match = /^(docs|images)\[(\d+)\]\.(\w+)$/.exec(key);
      if (match) (page.data[match[1]] as Values[])[Number(match[2])][match[3]] = value; else page.data[key] = value;
    }
  };
  page.onLoad(options.route || (name === 'workspace' ? { view: 'mine' } : { id: '31' }));
  return { name, page, wx, consumer, session, requests, patches, modals, authorizations, selections, fileReads, fileWrites, uploads, downloads, unlink, bytes,
    reply(index: number, value: unknown, status = 200) { requests[index].success({ statusCode: status, data: value }); },
    changeActor(id: number, token = 'synthetic-honor-' + id) { session.save({ token, exp: 9999999999, user: { id, name: '合成账号' + id, roles: ['member'], accountStatus: 'active' } }); } };
}
type Harness = ReturnType<typeof harness>;
const writes = (h: Harness) => h.requests.filter(request => request.method === 'POST');
const reads = (h: Harness) => h.requests.filter(request => request.method === 'GET');
async function ready(name: 'workspace' | 'edit', value = record(), options: Parameters<typeof harness>[1] = {}) {
  const h = harness(name, options), showing = h.page.onShow(); h.reply(0, name === 'workspace' || !options.route?.id && options.route ? list([value]) : { record: value }); await showing; return h;
}
function fill(h: Harness, description = '合成未保存的新说明') {
  for (const [field, value] of [['title', '合成完整新投稿'], ['competition', '合成完整赛事'], ['placing', '合成完整奖项'], ['description', description]]) h.page.input(event({ field }, value));
  h.page.date(event({}, '2026-10-12'));
}
function act(h: Harness) { return h.name === 'edit' ? h.page.save() : h.page.perform(event({ id: 31, action: 'withdraw' })); }
function noPrivate(h: Harness) {
  if (h.name === 'workspace') { expect(h.page.data.docs).toEqual([]); expect(h.page.data.detail).toBeNull(); expect(h.page.data.detailImages).toEqual([]); }
  else { expect(h.page.data.record).toBeNull(); expect(h.page.data.fields.description).toBe(''); expect(h.page.data.images).toEqual([]); }
}

describe('Native private honor JSON flows and minimum DTO', () => {
  it('lists only projected text/counts/actions and lazily loads one record before a user-triggered image preview', async () => {
    const raw = record({ author: 999, membershipRef: 801, history: ['synthetic-private-audit'], videoURL: '/api/private-team-honor-videos/raw.mp4' });
    const h = await ready('workspace', raw);
    expect(h.requests[0]).toMatchObject({ method: 'GET', header: { Authorization: 'JWT synthetic-honor-a' } });
    expect(h.requests[0].url).toContain('/api/team-honors?view=mine&page=1'); expect(h.fileWrites).toHaveLength(0);
    expect(h.page.data.docs[0]).toMatchObject({ id: 31, imageCount: 1, hasVideo: false });
    const inspecting = h.page.inspect(event({ id: 31 })); h.reply(1, { record: raw }); await inspecting;
    expect(h.requests[1].url).toBe(origin + '/api/team-honors/31'); expect(h.fileWrites).toHaveLength(1); expect(h.wx.previewImage).not.toHaveBeenCalled();
    const path = h.page.data.detailImages[0].path; h.page.previewEvidence(event({ path })); expect(h.wx.previewImage).toHaveBeenCalledWith({ current: path, urls: [path] });
    expect(JSON.stringify(h.patches)).not.toMatch(/data:image|submittedVersion|membershipRef|synthetic-private-audit|videoURL|private-team-honor-videos/);
  });

  it('denies late button events using explicit server actions even with cached president roles or canReview=true', async () => {
    const h = harness('workspace'), showing = h.page.onShow(); h.reply(0, list([record({ canReview: true, actions: none })], { actions: { create: false, review: false } })); await showing;
    h.page.create(); h.page.edit(event({ id: 31 })); await h.page.perform(event({ id: 31, action: 'approve' })); await h.page.perform(event({ id: 31, action: 'withdraw' }));
    expect(writes(h)).toHaveLength(0); expect(h.wx.navigateTo).not.toHaveBeenCalled();
    const e = await ready('edit', record({ canReview: true, actions: none })); fill(e); await e.page.save(); await e.page.submit();
    expect(e.page.data.editable).toBe(false); expect(writes(e)).toHaveLength(0); expect(e.wx.showModal).not.toHaveBeenCalled();
  });

  it('creates an image draft, then submits the same id with its real numeric revision and exact JSON whitelist', async () => {
    const h = await ready('edit', record(), { route: { team: '51' } }); fill(h);
    const selecting = h.page.chooseImages(); await selecting; h.page.caption(event({ index: 0 }, '合成主动授权证据说明'));
    const saving = h.page.save(); await flush(); expect(writes(h)).toHaveLength(1);
    expect(writes(h)[0]).toMatchObject({ url: origin + '/api/team-honors', data: { action: 'save', input: { team: 51, title: '合成完整新投稿', images: [{ source: png, caption: '合成主动授权证据说明' }] } } });
    const saved = record({ id: 91, revision: 1, state: 'draft', images: [{ source: png, caption: '合成主动授权证据说明' }], submittedVersion: null });
    h.reply(1, { record: saved }, 201); await flush(); expect(h.page.data.record).toMatchObject({ id: 91, revision: 1, state: 'draft', actions: {} });
    h.reply(2, { record: saved }); await saving;
    const submitting = h.page.submit(); await flush(); expect(writes(h)[1].data).toMatchObject({ action: 'submit', revision: 1 });
    expect(writes(h)[1].url).toBe(origin + '/api/team-honors/91'); expect(Object.keys(writes(h)[1].data!).sort()).toEqual(['action', 'input', 'revision']);
    expect(writes(h)[1].data!.input).not.toHaveProperty('team'); expect(writes(h)[1].data!.input).not.toHaveProperty('season');
    h.reply(3, { record: { ...saved, revision: 2, state: 'pending', submittedVersion: hash } }); await flush();
    h.reply(4, { record: { ...saved, revision: 2, state: 'pending', submittedVersion: hash, actions: { ...owner, save: false, submit: false } } }); await submitting;
    expect(h.page.data.record).toMatchObject({ id: 91, revision: 2, state: 'pending' }); expect(writes(h)).toHaveLength(2);
    expect(h.wx.requirePrivacyAuthorize).toHaveBeenCalledTimes(1); expect(h.wx.requestSubscribeMessage).not.toHaveBeenCalled();
    expect(JSON.stringify(h.patches)).not.toContain('data:image'); expect(JSON.stringify(h.patches)).not.toContain(hash);
  });

  it.each(['returned', 'withdrawn', 'approved'])('edits %s only with server actions, preserves original team/season and submits the latest revision', async state => {
    const h = await ready('edit', record({ state })); fill(h);
    const saving = h.page.submit(); await flush(); expect(writes(h)[0].url).toBe(origin + '/api/team-honors/31');
    expect(writes(h)[0].data).toMatchObject({ action: 'submit', revision: 3 }); expect(writes(h)[0].data!.input).not.toHaveProperty('team'); expect(writes(h)[0].data!.input).not.toHaveProperty('season');
    h.reply(1, { record: record({ state: 'pending', revision: 4 }) }); await flush(); h.reply(2, { record: record({ state: 'pending', revision: 4 }) }); await saving;
    expect(h.page.data.record).toMatchObject({ id: 31, revision: 4, state: 'pending', season: 71 });
  });

  it.each(['approve', 'return', 'reject', 'withdraw', 'hide'])('uses the original action %s and caches confirmed results read-only until GET succeeds', async action => {
    const h = await ready('workspace', record({ state: action === 'hide' ? 'approved' : 'pending', actions: { ...reviewer, withdraw: true } }));
    h.page.note(event({ id: 31 }, '合成明确处理说明'));
    const saving = h.page.perform(event({ id: 31, action })); await flush();
    expect(writes(h)[0].data).toMatchObject({ action, revision: 3, note: '合成明确处理说明' }); expect(writes(h)[0].data).not.toHaveProperty('input');
    if (action === 'approve') expect(writes(h)[0].data!.submittedVersion).toBe(hash); else expect(writes(h)[0].data).not.toHaveProperty('submittedVersion');
    const confirmed = record({ revision: 4, state: action === 'approve' ? 'approved' : action === 'return' ? 'returned' : action === 'reject' ? 'rejected' : action === 'withdraw' ? 'withdrawn' : 'hidden' });
    h.reply(1, { record: confirmed }); await flush(); expect(h.page.data.docs[0]).toMatchObject({ revision: 4, state: confirmed.state }); expect(h.page.data.docs[0].actions).toEqual({});
    h.requests[2].fail(); await saving; expect(h.page.data.ready).toBe(false);
    await h.page.perform(event({ id: 31, action })); expect(writes(h)).toHaveLength(1);
    const retry = h.page.retry(); h.reply(3, list([confirmed])); await retry; expect(h.page.data.ready).toBe(true); expect(writes(h)).toHaveLength(1);
  });

  it.each(['return', 'reject', 'hide'])('%s asks for a note without dropping fresh actions or the ability to complete the form', async action => {
    const h = await ready('workspace', record({ actions: reviewer })); await h.page.perform(event({ id: 31, action }));
    expect(writes(h)).toHaveLength(0); expect(h.page.data.busy).toBe(false); expect(h.page.data.ready).toBe(true);
    h.page.note(event({ id: 31 }, '合成补充处理说明')); expect(h.page.data.docs[0].noteDraft).toBe('合成补充处理说明');
  });

  it('holds a slow page-two read, retries without skipping pages, and removes duplicate rows', async () => {
    const h = harness('workspace'), initial = h.page.onShow(); h.reply(0, list([record()], { totalPages: 2, totalDocs: 3 })); await initial;
    const more = h.page.onReachBottom(); await h.page.onReachBottom(); expect(reads(h)).toHaveLength(2); expect(reads(h)[1].url).toContain('page=2');
    h.requests[1].fail(); await more; expect(h.page.data.page).toBe(1);
    const retry = h.page.retry(); h.reply(2, list([record()], { totalPages: 2, totalDocs: 3 })); await retry;
    const next = h.page.onReachBottom(); h.reply(3, list([record(), record({ id: 32 })], { page: 2, totalPages: 2, totalDocs: 3 })); await next;
    expect(h.page.data.docs.map(doc => doc.id)).toEqual([31, 32]); expect(h.page.data.page).toBe(2); expect(h.page.data.hasMore).toBe(false);
  });

  it('keeps paginated workspace caches free of image bytes while a single active inspection can still show its evidence', async () => {
    const h = harness('workspace'), first = h.page.onShow(); h.reply(0, list([record()], { totalPages: 2, totalDocs: 2 })); await first;
    const second = h.page.onReachBottom(); h.reply(1, list([record({ id: 32 })], { page: 2, totalPages: 2, totalDocs: 2 })); await second;
    const cached = () => Array.from((h.page._records as Map<number, RecordDTO>).values());
    expect(JSON.stringify(cached())).not.toContain('data:image'); expect(h.page.data.docs.map(doc => doc.imageCount)).toEqual([1, 1]); expect(h.fileWrites).toHaveLength(0);
    const inspecting = h.page.inspect(event({ id: 31 })); h.reply(2, { record: record() }); await inspecting;
    expect(h.page.data.detailImages).toHaveLength(1); expect(h.fileWrites).toHaveLength(1); expect(JSON.stringify(cached())).not.toContain('data:image');
  });
});

describe('Native honor deferred POST, context and media boundaries', () => {
  it.each(['workspace', 'edit'] as const)('%s keeps modal/write locks through hide/show and duplicate events, then only GET recovers', async name => {
    const h = await ready(name); if (name === 'edit') fill(h);
    const saving = act(h); await flush(); h.page.onHide(); await h.page.onShow(); await act(h);
    expect(writes(h)).toHaveLength(1); expect(reads(h)).toHaveLength(1); expect(h.page.data.busy).toBe(true);
    const confirmed = record({ revision: 4, state: name === 'workspace' ? 'withdrawn' : 'draft' }); h.reply(1, { record: confirmed }); await flush();
    h.reply(2, name === 'workspace' ? list([confirmed]) : { record: confirmed }); await saving;
    expect(writes(h)).toHaveLength(1); expect(h.page.data.busy).toBe(false); expect(reads(h)).toHaveLength(2);
  });

  it.each((['workspace', 'edit'] as const).flatMap(name => [false, true].map(error => ({ name, error }))))('$name settles while hidden (error=$error) with no hidden GET or automatic write', async ({ name, error }) => {
    const h = await ready(name); if (name === 'edit') fill(h);
    const saving = act(h); await flush(); h.page.onHide();
    if (error) h.requests[1].fail(); else h.reply(1, { record: record({ revision: 4, state: 'draft' }) });
    await saving; expect(reads(h)).toHaveLength(1); expect(h.page.data.busy).toBe(false); await act(h); expect(writes(h)).toHaveLength(1);
    const showing = h.page.onShow(); h.reply(2, name === 'workspace' ? list([record({ revision: error ? 3 : 4 })]) : { record: record({ revision: error ? 3 : 4 }) }); await showing;
    expect(writes(h)).toHaveLength(1); if (name === 'edit' && error) expect(h.page.data.fields.description).toBe('合成未保存的新说明');
  });

  it.each(['workspace', 'edit'] as const)('%s rejects an A→B→A late POST without restoring old private state or releasing its lock early', async name => {
    const h = await ready(name); if (name === 'edit') fill(h);
    const saving = act(h); await flush(); h.changeActor(8); h.changeActor(7, 'synthetic-honor-new-a');
    noPrivate(h); expect(h.page.data.busy).toBe(true); expect(reads(h)).toHaveLength(1); await act(h); expect(writes(h)).toHaveLength(1);
    h.reply(1, { record: record({ title: '合成旧context迟到保存', revision: 4 }) }); await flush();
    expect(h.page.data.record?.title).not.toBe('合成旧context迟到保存'); if (name === 'workspace') expect(h.page.data.docs).toEqual([]); else expect(h.page.data.record).toBeNull();
    expect(reads(h)[1].header.Authorization).toBe('JWT synthetic-honor-new-a');
    h.reply(2, name === 'workspace' ? list([record({ title: '合成当前GET回执' })]) : { record: record({ title: '合成当前GET回执' }) }); await saving;
    expect(name === 'workspace' ? h.page.data.docs[0].title : h.page.data.record?.title).toBe('合成当前GET回执'); expect(writes(h)).toHaveLength(1);
  });

  it.each(['workspace', 'edit'] as const)('%s discards same-account old-route POST and reads the newly loaded route', async name => {
    const h = await ready(name); if (name === 'edit') fill(h);
    const saving = act(h); await flush(); h.page.onLoad(name === 'edit' ? { id: '32' } : { view: 'mine', team: '52' }); await h.page.onShow();
    noPrivate(h); expect(h.page.data.busy).toBe(true); expect(reads(h)).toHaveLength(1);
    h.reply(1, { record: record({ title: '合成旧路由迟到保存', revision: 4 }) }); await flush();
    expect(reads(h)[1].url).toContain(name === 'edit' ? '/team-honors/32' : 'team=52');
    h.reply(2, name === 'edit' ? { record: record({ id: 32, title: '合成新路由回执' }) } : list([record({ id: 32, team: 52, title: '合成新路由回执' })])); await saving;
    expect(name === 'edit' ? h.page.data.record?.id : h.page.data.docs[0].id).toBe(32); expect(writes(h)).toHaveLength(1);
  });

  it.each(['workspace', 'edit'] as const)('%s ignores late POST after unload, clears private data and issues no recovery GET', async name => {
    const h = await ready(name); if (name === 'edit') fill(h); const saving = act(h); await flush(); h.page.onUnload(); noPrivate(h);
    h.reply(1, { record: record({ revision: 4 }) }); await saving; await h.page.onShow(); expect(reads(h)).toHaveLength(1); expect(writes(h)).toHaveLength(1); noPrivate(h);
  });

  it.each(['workspace', 'edit'] as const)('%s cancels confirmation after hide and keeps its pending modal locked until it settles', async name => {
    const h = await ready(name, record(), { modalAuto: false }); if (name === 'edit') fill(h);
    const confirming = act(h); await act(h); expect(h.modals).toHaveLength(1); h.page.onHide(); await h.page.onShow(); expect(h.page.data.busy).toBe(true);
    h.modals[0].success({ confirm: true }); await flush(); expect(writes(h)).toHaveLength(0);
    h.reply(1, name === 'workspace' ? list() : { record: record() }); await confirming; expect(h.page.data.busy).toBe(false);
  });

  it.each(['workspace', 'edit'] as const)('%s keeps a confirmed hidden POST result read-only if the foreground recovery GET fails', async name => {
    const h = await ready(name); if (name === 'edit') fill(h); const saving = act(h); await flush(); h.page.onHide(); await h.page.onShow();
    h.reply(1, { record: record({ revision: 4, state: 'draft', title: '合成服务端已确认结果' }) }); await flush(); h.requests[2].fail(); await saving;
    const actual = name === 'workspace' ? h.page.data.docs[0] : h.page.data.record;
    expect(actual).toMatchObject({ revision: 4, title: '合成服务端已确认结果' }); expect(actual?.actions).toEqual({}); expect(h.page.data.ready).toBe(false);
    await act(h); expect(writes(h)).toHaveLength(1);
  });

  it('preserves conflict drafts and does not attach them to a newer revision until an explicit confirmed reload', async () => {
    const h = await ready('edit'); fill(h); const saving = h.page.save(); await flush(); h.reply(1, { error: '合成荣誉修订冲突' }, 409); await saving;
    expect(h.page.data.fields.description).toBe('合成未保存的新说明'); expect(h.page.data.canSave).toBe(false);
    const retry = h.page.retry(); h.reply(2, { record: record({ revision: 4, description: '合成已保存的其他修订' }) }); await retry;
    expect(h.page.data.conflict).toBe(true); expect(h.page.data.fields.description).toBe('合成未保存的新说明'); await h.page.save(); expect(writes(h)).toHaveLength(1);
    const reloading = h.page.reload(); await flush(); h.reply(3, { record: record({ revision: 4, description: '合成已保存的其他修订' }) }); await reloading;
    expect(h.page.data.fields.description).toBe('合成已保存的其他修订'); expect(h.page.data.canSave).toBe(true);
  });

  it('keeps an uncertain create draft locked even after mine is read, with no guessed matching record or repeated POST', async () => {
    const h = await ready('edit', record(), { route: { team: '51' } }); fill(h); const saving = h.page.save(); await flush(); h.requests[1].fail(); await saving;
    expect(h.page.data.uncertainCreate).toBe(true); expect(h.page.data.fields.description).toBe('合成未保存的新说明'); await h.page.save(); expect(writes(h)).toHaveLength(1);
    const retry = h.page.retry(); h.reply(2, list([record({ title: '合成完整新投稿' })])); await retry;
    expect(h.page.data.record).toBeNull(); expect(h.page.data.recentDocs).toHaveLength(1); expect(h.page.data.canSave).toBe(false); await h.page.submit(); expect(writes(h)).toHaveLength(1);
  });

  it('selects images only after privacy consent, retains a file lock through hide, and discards late selection', async () => {
    const h = await ready('edit', record(), { privacyAuto: false }); const choosing = h.page.chooseImages(); expect(h.authorizations).toHaveLength(1); expect(h.selections).toHaveLength(0);
    h.page.onHide(); await h.page.onShow(); await h.page.save(); expect(writes(h)).toHaveLength(0); expect(h.page.data.busy).toBe(true);
    h.authorizations[0].success(); await flush(); expect(h.selections).toHaveLength(0); h.reply(1, { record: record() }); await choosing;
    expect(h.page.data.busy).toBe(false); expect(h.page.data.images).toHaveLength(1);
  });

  it('denied privacy and an oversized image do not replace the original evidence or produce business writes', async () => {
    const h = await ready('edit', record(), { privacyAuto: false, imageReadAuto: false }); const denied = h.page.chooseImages(); h.authorizations[0].fail(); await denied;
    expect(h.page.data.images).toHaveLength(1); expect(h.page.data.operationError).toContain('隐私授权未完成');
    const selecting = h.page.chooseImages(); h.authorizations[1].success(); await flush();
    h.fileReads[0].success({ data: new ArrayBuffer(2 * 1024 * 1024 + 1) }); await selecting;
    expect(h.page.data.images).toHaveLength(1); expect(h.page.data.operationError).toContain('2 MB'); expect(writes(h)).toHaveLength(0);
  });

  it('deletes a late private picture after actor change and never previews the old evidence', async () => {
    const h = await ready('workspace', record(), { imageWriteAuto: false }); const inspecting = h.page.inspect(event({ id: 31 })); h.reply(1, { record: record() }); await flush();
    expect(h.fileWrites).toHaveLength(1); h.changeActor(8); h.fileWrites[0].success(); await flush(); h.reply(2, list([])); await inspecting;
    expect(h.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: h.fileWrites[0].filePath })); expect(h.wx.previewImage).not.toHaveBeenCalled(); expect(h.page.data.detailImages).toEqual([]);
  });

  it.each([401, 403, 404, 409, 500])('handles private GET %s with return/retry, never reads raw collections or sends business writes', async status => {
    const h = harness('workspace'), showing = h.page.onShow(); h.reply(0, { error: '合成读取失败' }, status); await showing;
    expect(h.page.data.loading).toBe(false); expect(h.page.data.ready).toBe(false); expect(h.page.data.error || h.page.data.needsLogin).toBeTruthy();
    expect(writes(h)).toHaveLength(0); expect(h.requests.every(request => request.url.includes('/api/team-honors'))).toBe(true);
  });

  it.each(['workspace', 'edit'] as const)('%s WXML bindings have real handlers and anonymous pages never send private GET', async name => {
    const h = harness(name, { loggedOut: true }); await h.page.onShow(); expect(h.requests).toHaveLength(0); expect(h.page.data.needsLogin).toBe(true);
    const bindings = [...readFileSync('miniprogram/src/pages/team-honor-' + name + '/index.wxml', 'utf8').matchAll(/bind(?:tap|input|change|error)="([^"]+)"/g)].map(match => match[1]);
    for (const binding of bindings) expect(typeof h.page[binding], binding).toBe('function');
  });
});

describe('Native honor page integration with the frozen private MP4 helper', () => {
  it('requires a real saved record and explicit video choice/upload, then retains the hidden ACK without a second mutation', async () => {
    const fresh = await ready('edit', record(), { route: { team: '51' } }); await fresh.page.chooseVideo(); expect(fresh.selections).toHaveLength(0);
    const h = await ready('edit'); await h.page.chooseVideo(); expect(h.page.data.hasSelectedVideo).toBe(true); expect(h.uploads).toHaveLength(0); expect(writes(h)).toHaveLength(0);
    const uploading = h.page.uploadVideo(); await flush(); expect(h.uploads).toHaveLength(1);
    expect(h.uploads[0]).toMatchObject({ url: origin + '/api/team-honors/31', name: 'video', header: { Authorization: 'JWT synthetic-honor-a' },
      formData: { action: 'save', id: '31', revision: '3', title: '合成荣誉投稿', description: '合成待审成果说明', 'caption-0': '合成证据说明' } });
    expect(JSON.stringify(h.uploads[0].formData)).not.toContain('data:image');
    h.page.onHide(); await h.page.onShow(); await h.page.uploadVideo(); await h.page.save(); expect(h.uploads).toHaveLength(1); expect(writes(h)).toHaveLength(0); expect(reads(h)).toHaveLength(1);
    const saved = record({ revision: 4, state: 'draft', videoHref: '/api/team-honor-evidence/31/video?revision=4' });
    h.uploads[0].success({ statusCode: 200, data: JSON.stringify({ record: saved }) }); await flush(); h.requests[1].fail(); await uploading;
    expect(h.page.data.record).toMatchObject({ revision: 4, state: 'draft', hasVideo: true }); expect(h.page.data.record?.actions).toEqual({});
    expect(h.page.data.canSave).toBe(false); expect(h.page.data.canSubmit).toBe(false); expect(h.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: h.uploads[0].filePath }));
    expect(h.uploads).toHaveLength(1); expect(writes(h)).toHaveLength(0);
  });

  it('does not bundle unsaved new/duplicate images into a video multipart upload or automatically JSON-save them', async () => {
    const h = await ready('edit'); await h.page.chooseImages(); h.page.caption(event({ index: 1 }, '合成未保存新图'));
    await h.page.chooseVideo(); await h.page.uploadVideo(); expect(h.uploads).toHaveLength(0); expect(writes(h)).toHaveLength(0);
    expect(h.page.data.operationError).toContain('先'); expect(h.page.data.images).toHaveLength(2);
  });

  it.each(['workspace', 'edit'] as const)('%s downloads only matching private revision to a local source and aborts/cleans on hide', async name => {
    const value = record({ videoHref: '/api/team-honor-evidence/31/video?revision=3' }), h = await ready(name, value);
    if (name === 'workspace') { const inspecting = h.page.inspect(event({ id: 31 })); h.reply(1, { record: value }); await inspecting; }
    const reading = h.page.viewVideo(); await flush(); expect(h.downloads).toHaveLength(1);
    expect(h.downloads[0]).toMatchObject({ url: origin + value.videoHref, header: { Authorization: 'JWT synthetic-honor-a' } });
    h.downloads[0].success({ statusCode: 200, filePath: h.downloads[0].filePath }); await reading;
    expect(h.page.data.videoSource).toBe(h.downloads[0].filePath); expect(h.page.data.videoSource).toMatch(/zijing-private-honor-.*\.mp4$/);
    const again = h.page.viewVideo(); await flush(); h.page.onHide(); await again;
    expect(h.page.data.videoSource).toBe(''); expect(h.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: h.downloads[1].filePath }));
    expect(JSON.stringify(h.patches)).not.toMatch(/data:image|submittedVersion|videoURL|\/api\/team-honor-evidence/);
  });

  it('discards an A→B→A late multipart ACK and restores the current editor only through GET', async () => {
    const h = await ready('edit'); await h.page.chooseVideo(); const uploading = h.page.uploadVideo(); await flush(); expect(h.uploads).toHaveLength(1);
    h.changeActor(8); h.changeActor(7, 'synthetic-honor-third-a'); noPrivate(h); expect(h.page.data.busy).toBe(true);
    h.uploads[0].success({ statusCode: 200, data: JSON.stringify({ record: record({ revision: 4, title: '合成旧multipart回执' }) }) }); await flush();
    expect(h.page.data.record).toBeNull(); expect(h.requests[1].header.Authorization).toBe('JWT synthetic-honor-third-a');
    h.reply(1, { record: record({ title: '合成当前scope资料' }) }); await uploading;
    expect(h.page.data.record?.title).toBe('合成当前scope资料'); expect(h.uploads).toHaveLength(1); expect(writes(h)).toHaveLength(0);
  });
});

describe('Native honor successful-read then denied-detail regression', () => {
  it.each([403, 404, 409])('closes stale workspace actions after inspect GET %s and restores only a successful list GET', async status => {
    const value = record({ state: 'pending', actions: reviewer }), h = await ready('workspace', value);
    h.page.note(event({ id: 31 }, '合成未提交审核意见：请核对成果说明'));
    const inspecting = h.page.inspect(event({ id: 31 })); expect(h.page.data.busy).toBe(true);
    h.reply(1, { error: '合成证据读取被拒绝' }, status); await inspecting;
    expect(h.page.data.ready).toBe(false); expect(h.page.data.busy).toBe(false); expect(h.page.data.detail).toBeNull(); expect(h.page.data.detailImages).toEqual([]);
    expect((h.page._records as Map<number, RecordDTO>).has(31)).toBe(false);
    expect(h.page.data.docs[0].actions).toEqual({}); expect(h.page.data.docs[0].decisions).toEqual([]);
    expect(h.page.data.docs[0].noteDraft).toBe('合成未提交审核意见：请核对成果说明');
    await h.page.perform(event({ id: 31, action: 'approve' })); expect(writes(h)).toHaveLength(0);
    const retry = h.page.retry(); const fresh = record({ state: 'pending', actions: { ...reviewer, reviewActions: ['return'] } }); h.reply(2, list([fresh])); await retry;
    expect(h.page.data.ready).toBe(true); expect(h.page.data.docs[0].decisions).toEqual([{ action: 'return', label: '退回修改' }]);
    expect(h.page.data.docs[0].noteDraft).toBe('合成未提交审核意见：请核对成果说明'); expect(writes(h)).toHaveLength(0);
  });

  it.each((['workspace', 'edit'] as const).flatMap(name => [403, 404, 409].map(status => ({ name, status }))))('$name clears prior private playback and stale actions after download $status, preserves text drafts and waits for GET', async ({ name, status }) => {
    const value = record({ state: 'pending', videoHref: '/api/team-honor-evidence/31/video?revision=3', actions: name === 'workspace' ? reviewer : owner }), h = await ready(name, value);
    if (name === 'workspace') {
      h.page.note(event({ id: 31 }, '合成尚未提交的处理意见')); const inspecting = h.page.inspect(event({ id: 31 })); h.reply(1, { record: value }); await inspecting;
    } else fill(h, '合成视频拒绝后保留的未保存文字');
    const initial = h.page.viewVideo(); await flush(); h.downloads[0].success({ statusCode: 200, filePath: h.downloads[0].filePath }); await initial;
    const oldPath = h.page.data.videoSource, stops = h.wx.createVideoContext.mock.calls.length;
    const denied = h.page.viewVideo(); await flush(); expect(h.page.data.busy).toBe(true);
    h.downloads[1].success({ statusCode: status, filePath: h.downloads[1].filePath }); await denied;
    expect(h.page.data.videoSource).toBe(''); expect(h.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: oldPath }));
    expect(h.wx.createVideoContext.mock.calls.length).toBeGreaterThan(stops); expect(h.page.data.ready).toBe(false); expect(h.page.data.busy).toBe(false);
    if (name === 'workspace') {
      expect(h.page.data.detail).toBeNull(); expect(h.page.data.docs[0].actions).toEqual({}); expect(h.page.data.docs[0].noteDraft).toBe('合成尚未提交的处理意见');
      await h.page.perform(event({ id: 31, action: 'approve' }));
    } else {
      expect(h.page.data.canSave).toBe(false); expect(h.page.data.canSubmit).toBe(false); expect(h.page.data.record?.actions).toEqual({});
      expect(h.page.data.fields.description).toBe('合成视频拒绝后保留的未保存文字'); await h.page.save();
    }
    expect(writes(h)).toHaveLength(0); const retry = h.page.retry();
    const fresh = record({ ...value, actions: name === 'workspace' ? { ...reviewer, reviewActions: ['return'] } : { ...owner, submit: false } });
    h.reply(name === 'workspace' ? 2 : 1, name === 'workspace' ? list([fresh]) : { record: fresh }); await retry;
    expect(h.page.data.ready).toBe(true); expect(writes(h)).toHaveLength(0);
    if (name === 'workspace') expect(h.page.data.docs[0].decisions).toEqual([{ action: 'return', label: '退回修改' }]);
    else { expect(h.page.data.canSave).toBe(true); expect(h.page.data.canSubmit).toBe(false); expect(h.page.data.fields.description).toBe('合成视频拒绝后保留的未保存文字'); }
  });

  it.each((['workspace', 'edit'] as const).flatMap(name => [500, 'network'].map(status => ({ name, status }))))('$name download $status preserves draft text while withholding old write actions', async ({ name, status }) => {
    const value = record({ state: 'pending', videoHref: '/api/team-honor-evidence/31/video?revision=3', actions: name === 'workspace' ? reviewer : owner }), h = await ready(name, value);
    if (name === 'workspace') { h.page.note(event({ id: 31 }, '合成断网保留审核意见')); const inspecting = h.page.inspect(event({ id: 31 })); h.reply(1, { record: value }); await inspecting; }
    else fill(h, '合成断网保留原输入');
    const reading = h.page.viewVideo(); await flush();
    if (status === 'network') h.downloads[0].fail(); else h.downloads[0].success({ statusCode: Number(status), filePath: h.downloads[0].filePath }); await reading;
    expect(h.page.data.ready).toBe(false); expect(h.page.data.busy).toBe(false);
    if (name === 'workspace') { expect(h.page.data.docs[0].noteDraft).toBe('合成断网保留审核意见'); await h.page.perform(event({ id: 31, action: 'approve' })); }
    else { expect(h.page.data.fields.description).toBe('合成断网保留原输入'); await h.page.save(); }
    expect(writes(h)).toHaveLength(0);
  });
});

describe('Native honor confirmed revision floor — actual Page and HTTP', () => {
  const confirmed = (name: 'workspace' | 'edit', revision = 4) => record({ revision,
    state: name === 'workspace' ? 'withdrawn' : 'draft', title: '合成服务端已确认荣誉', description: '合成已确认保存的新说明' });
  const displayed = (h: Harness) => h.name === 'workspace' ? h.page.data.docs[0] : h.page.data.record;
  const readBody = (h: Harness, value: RecordDTO) => h.name === 'workspace' ? list([value]) : { record: value };

  it.each((['workspace', 'edit'] as const).flatMap(name => ['older', 'missing'].map(snapshot => ({ name, snapshot }))))('$name keeps ACK4 and closes writes after a successful $snapshot GET, then a current GET alone restores actions', async ({ name, snapshot }) => {
    const h = await ready(name); if (name === 'edit') fill(h);
    const saving = act(h); await flush(); h.reply(1, { record: confirmed(name) }); await flush();
    h.reply(2, snapshot === 'older' ? readBody(h, record()) : name === 'workspace' ? list([]) : { record: null }); await saving;
    expect(displayed(h)).toMatchObject({ revision: 4, title: '合成服务端已确认荣誉' });
    expect(h.page.data.ready).toBe(false); expect(h.page.data.error).not.toBe('');
    if (name === 'edit') { expect(h.page.data.fields.description).toBe('合成已确认保存的新说明'); expect(h.page.data.canSave).toBe(false); }
    await act(h); expect(writes(h)).toHaveLength(1);
    const retrying = h.page.retry(); h.reply(3, readBody(h, confirmed(name))); await retrying;
    expect(h.page.data.ready).toBe(true); expect(displayed(h)?.revision).toBe(4); expect(writes(h)).toHaveLength(1);
  });

  it.each((['workspace', 'edit'] as const).flatMap(name => [4, 5].map(revision => ({ name, revision }))))('$name accepts current revision $revision and remembers that floor across later reads', async ({ name, revision }) => {
    const h = await ready(name); if (name === 'edit') fill(h);
    const saving = act(h); await flush(); h.reply(1, { record: confirmed(name) }); await flush(); h.reply(2, readBody(h, confirmed(name, revision))); await saving;
    expect(h.page.data.ready).toBe(true); expect(displayed(h)?.revision).toBe(revision);
    const reading = name === 'edit' ? h.page.reload() : h.page.retry(); h.reply(3, readBody(h, record({ revision: revision - 1 }))); await reading;
    expect(h.page.data.ready).toBe(false); expect(displayed(h)?.revision).toBe(revision); await act(h); expect(writes(h)).toHaveLength(1);
    const fresh = h.page.retry(); h.reply(4, readBody(h, confirmed(name, revision))); await fresh;
    expect(h.page.data.ready).toBe(true); expect(displayed(h)?.revision).toBe(revision);
  });

  it('does not let an older inspection replace the confirmed workspace record or read its evidence', async () => {
    const h = await ready('workspace'); const saving = act(h); await flush();
    h.reply(1, { record: confirmed('workspace') }); await flush(); h.reply(2, list([confirmed('workspace')])); await saving;
    const inspecting = h.page.inspect(event({ id: 31 })); h.reply(3, { record: record() }); await inspecting;
    expect(h.fileWrites).toHaveLength(0); expect(h.page.data.detail).toBeNull(); expect(displayed(h)?.revision).toBe(4);
    expect(h.page.data.ready).toBe(false); await act(h); expect(writes(h)).toHaveLength(1);
  });

  it.each((['workspace', 'edit'] as const).flatMap(name => [401, 403].map(status => ({ name, status }))))('$name clears private ACK content and capabilities after GET $status', async ({ name, status }) => {
    const h = await ready(name); if (name === 'edit') fill(h);
    const saving = act(h); await flush(); h.reply(1, { record: confirmed(name) }); await flush(); h.reply(2, { error: '合成当前权限已失效' }, status); await saving;
    noPrivate(h); expect(h.page.data.ready).toBe(false); await act(h); expect(writes(h)).toHaveLength(1);
    if (status === 401) expect(h.page.data.needsLogin).toBe(true);
  });

  it.each((['workspace', 'edit'] as const).flatMap(name => ['actor', 'route'].map(scope => ({ name, scope }))))('$name discards the confirmed floor on a new $scope without blocking its own lower revision', async ({ name, scope }) => {
    const h = await ready(name); if (name === 'edit') fill(h);
    const saving = act(h); await flush(); h.reply(1, { record: confirmed(name) }); await flush(); h.requests[2].fail(); await saving;
    if (scope === 'actor') { h.changeActor(8); h.changeActor(7, 'synthetic-honor-new-scope'); }
    else h.page.onLoad(name === 'workspace' ? { view: 'mine', team: '52' } : { id: '32' });
    noPrivate(h);
    const showing = h.page.onShow(), requestIndex = h.requests.length - 1;
    const current = record({ id: scope === 'route' ? 32 : 31, team: scope === 'route' ? 52 : 51, revision: 1, title: '合成当前范围的一版' });
    h.reply(requestIndex, readBody(h, current)); await showing;
    if (scope === 'actor') { h.reply(3, readBody(h, confirmed(name))); await flush(); }
    expect(displayed(h)).toMatchObject({ revision: 1, title: '合成当前范围的一版' }); expect(h.page.data.ready).toBe(true); expect(writes(h)).toHaveLength(1);
  });

  it('keeps a multipart ACK and its saved video when the follow-up JSON GET is older', async () => {
    const h = await ready('edit'); await h.page.chooseVideo(); const uploading = h.page.uploadVideo(); await flush();
    const saved = confirmed('edit'); saved.videoHref = '/api/team-honor-evidence/31/video?revision=4';
    h.uploads[0].success({ statusCode: 200, data: JSON.stringify({ record: saved }) }); await flush(); h.reply(1, { record: record() }); await uploading;
    expect(h.page.data.record).toMatchObject({ revision: 4, hasVideo: true }); expect(h.page.data.fields.description).toBe(saved.description);
    expect(h.page.data.canSave).toBe(false); expect(h.page.data.canSubmit).toBe(false); expect(h.page.data.message).toContain('已上传并保存草稿');
    await h.page.uploadVideo(); await h.page.save(); expect(h.uploads).toHaveLength(1); expect(writes(h)).toHaveLength(0);
    const retrying = h.page.retry(); h.reply(2, { record: saved }); await retrying; expect(h.page.data.canSave).toBe(true);
  });
});
