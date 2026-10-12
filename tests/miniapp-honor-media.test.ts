import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type Image = { source: string; caption: string };
type RecordDTO = { id: number; revision: number; team: number; season: number | null; images: Image[]; videoHref?: string | null };
type Input = { title: string; competition: string; placing: string; date: string | null; description: string; images: Image[]; removeVideo?: boolean; team?: number; season?: number | null };
type Video = { filePath: string; size: number };
type Progress = { progress: number; totalBytesWritten: number; totalBytesExpectedToWrite: number };
type Task = { abort(): void; onProgressUpdate(callback: (value: Progress) => void): void;
  onHeadersReceived(callback: (value: { header: { 'Content-Length'?: string; 'content-length'?: string } }) => void): void };
type Scope = { isCurrent(): boolean; sameContext(): boolean; onTask?: (task: Task) => void; onProgress?: (progress: Progress) => void };
type Media = { chooseVideo(options: Scope): Promise<Video>; uploadVideo(record: RecordDTO | null, input: Input, video: Video, options: Scope): Promise<{ record: RecordDTO }>;
  privateVideo(record: RecordDTO, options: Scope): Promise<string>; removeMedia(paths: string[]): void };
type Callback = { success(): void; fail(): void };
type Selection = { count: number; mediaType: string[]; sourceType: string[]; sizeType: string[];
  success(value: { tempFiles: { tempFilePath: string; size: number; fileType: string }[] }): void; fail(): void };
type Stat = { path: string; success(value: { stats: { size: number; isFile(): boolean } }): void; fail(): void };
type Read = { filePath: string; position: number; length: number; success(value: { data: ArrayBuffer }): void; fail(): void };
type Copy = Callback & { srcPath: string; destPath: string };
type Upload = { url: string; filePath: string; name: string; header: { Authorization: string }; formData: Record<string, string>;
  success(value: { statusCode: number; data: string }): void; fail(): void };
type Download = { url: string; filePath?: string; timeout?: number; header: { Authorization: string };
  success(value: { statusCode: number; filePath?: string; tempFilePath?: string }): void; fail(): void };
type File = { size: number; bytes: Uint8Array; isFile?: boolean };
type Session = { save(value: { token: string; exp: number; user: { id: number; name: string; roles: string[]; accountStatus: string } }): void;
  clear(): void; token(): string; user(): { id: number } | null };
type HTTP = { upload(path: string, filePath: string, options?: { name?: string; formData?: object; raw?: boolean; onTask?: (task: Task) => void; onProgress?: (progress: Progress) => void }): Promise<unknown>;
  download(path: string, options?: { filePath?: string; onTask?: (task: Task) => void }): Promise<string> };
const origin = 'https://home.thuzijing.top';
const maxBytes = 10 * 1024 * 1024;
const png = 'data:image/png;base64,iVBORw0KGgo=';
const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
const webp = 'data:image/webp;base64,UklGRgAAAABXRUJQ';
const base: RecordDTO = { id: 101, revision: 3, team: 51, season: 61,
  images: [{ source: png, caption: '合成原说明一' }, { source: jpeg, caption: '合成原说明二' }, { source: webp, caption: '合成原说明三' }],
  videoHref: '/api/team-honor-evidence/101/video?revision=3' };
const input = (images = base.images): Input => ({ title: '合成视频荣誉草稿', competition: '合成赛事', placing: '合成奖项',
  date: '2026-10-12', description: '合成视频证据说明', images: images.map(image => ({ ...image })), removeVideo: false });
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const error = (pending: Promise<unknown>) => pending.catch(cause => cause as Error & { status?: number });
function mp4() {
  const bytes = Buffer.alloc(64);
  bytes.writeUInt32BE(24, 0); bytes.write('ftypisom', 4); bytes.write('iso2mp41', 16);
  bytes.writeUInt32BE(8, 24); bytes.write('moov', 28); bytes.writeUInt32BE(32, 32); bytes.write('mdat', 36);
  return new Uint8Array(bytes);
}
function harness(options: { autoStat?: boolean; autoRead?: boolean; autoCopy?: boolean; loggedIn?: boolean } = {}) {
  let saved: unknown = options.loggedIn === false ? null : { token: 'synthetic-honor-token', exp: 9999999999,
    user: { id: 7, name: '合成视频账号', roles: ['member'], accountStatus: 'active' } };
  const local = new Map<string, File>([['/synthetic-picker/video.mov', { size: 64, bytes: mp4() }]]);
  const authorizations: Callback[] = [], selections: Selection[] = [], stats: Stat[] = [], fileReads: Read[] = [], copies: Copy[] = [];
  const uploads: Upload[] = [], downloads: Download[] = [], tasks: ReturnType<typeof makeTask>[] = [];
  const unlink = vi.fn((value: { filePath: string }) => local.delete(value.filePath));
  function replyStat(value: Stat) {
    const file = local.get(value.path);
    if (file) value.success({ stats: { size: file.size, isFile: () => file.isFile !== false } }); else value.fail();
  }
  function replyRead(value: Read) {
    const file = local.get(value.filePath);
    if (!file) { value.fail(); return; }
    const bytes = file.bytes.slice(value.position, value.position + value.length);
    value.success({ data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
  }
  function replyCopy(value: Copy) {
    const file = local.get(value.srcPath);
    if (!file) { value.fail(); return; }
    local.set(value.destPath, { ...file }); value.success();
  }
  const fs = {
    stat(value: Stat) { stats.push(value); if (options.autoStat !== false) replyStat(value); },
    readFile(value: Read) { fileReads.push(value); if (options.autoRead !== false) replyRead(value); },
    copyFile(value: Copy) { copies.push(value); if (options.autoCopy !== false) replyCopy(value); }, unlink,
    readdir(value: { dirPath: string; success(result: { files: string[] }): void }) {
      value.success({ files: [...local.keys()].filter(path => path.startsWith(value.dirPath + '/')).map(path => path.slice(value.dirPath.length + 1)) });
    },
  };
  function makeTask(fail: () => void) {
    let progress: ((value: Progress) => void) | undefined, headers: ((value: { header: { 'Content-Length'?: string; 'content-length'?: string } }) => void) | undefined;
    return { abort: vi.fn(fail), onProgressUpdate(value: (data: Progress) => void) { progress = value; },
      onHeadersReceived(value: (data: { header: { 'Content-Length'?: string; 'content-length'?: string } }) => void) { headers = value; },
      progress(value: Progress) { progress?.(value); }, headers(value: { 'Content-Length'?: string; 'content-length'?: string }) { headers?.({ header: value }); } };
  }
  const wx = {
    env: { USER_DATA_PATH: '/synthetic' }, getFileSystemManager: () => fs,
    getStorageSync: () => saved, setStorageSync: (_key: string, value: unknown) => { saved = value; }, removeStorageSync: () => { saved = null; },
    requirePrivacyAuthorize: vi.fn((value: Callback) => authorizations.push(value)), openPrivacyContract: vi.fn(),
    chooseMedia: vi.fn((value: Selection) => selections.push(value)), request: vi.fn(), requestSubscribeMessage: vi.fn(),
    uploadFile: vi.fn((value: Upload) => { uploads.push(value); const task = makeTask(value.fail); tasks.push(task); return task; }),
    downloadFile: vi.fn((value: Download) => { downloads.push(value); const task = makeTask(value.fail); tasks.push(task); return task; }),
  };
  const modules = new Map<string, { exports: unknown }>();
  function load(filename: string): unknown {
    filename = resolve(filename);
    if (modules.has(filename)) return modules.get(filename)!.exports;
    const module = { exports: {} as unknown }; modules.set(filename, module);
    runInNewContext(readFileSync(filename, 'utf8'), { module, wx,
      require: (name: string) => load(resolve(dirname(filename), name + '.js')) });
    return module.exports;
  }
  const media = load('miniprogram/src/lib/honor-media.js') as Media;
  const session = load('miniprogram/src/lib/session.js') as Session;
  const http = load('miniprogram/src/lib/http.js') as HTTP;
  const files = load('miniprogram/src/lib/files.js') as { clearPrivate(): void };
  const state = { visible: true, alive: true, context: 1, route: 'honor:101' };
  function scope(): Scope {
    const context = state.context, route = state.route;
    return { isCurrent: () => state.alive && state.visible && context === state.context && route === state.route,
      sameContext: () => state.alive && context === state.context && route === state.route };
  }
  function account(id = 8, token = 'synthetic-new-account-token') {
    session.save({ token, exp: 9999999999, user: { id, name: '合成新账号', roles: ['member'], accountStatus: 'active' } });
  }
  function replyUpload(index = uploads.length - 1, status = 200, record: unknown = { ...base, revision: 4 }) {
    uploads[index].success({ statusCode: status, data: JSON.stringify(status >= 200 && status < 300 ? { record } : { error: '合成服务拒绝', debug: 'synthetic-private-detail' }) });
  }
  function replyDownload(index = downloads.length - 1, status = 200, file: File = { size: 64, bytes: mp4() }, output?: string) {
    const request = downloads[index], path = output || request.filePath || '/synthetic-sdk-temp';
    local.set(path, file); request.success({ statusCode: status, filePath: path, tempFilePath: path });
    return path;
  }
  return { media, session, http, files, wx, state, scope, account, local, authorizations, selections, stats, fileReads, copies,
    uploads, downloads, tasks, unlink, replyStat, replyRead, replyCopy, replyUpload, replyDownload };
}
type Harness = ReturnType<typeof harness>;
async function choose(h: Harness) {
  const pending = h.media.chooseVideo(h.scope()); h.authorizations.at(-1)!.success(); await flush();
  h.selections.at(-1)!.success({ tempFiles: [{ tempFilePath: '/synthetic-picker/video.mov', fileType: 'video', size: h.local.get('/synthetic-picker/video.mov')!.size }] });
  return pending;
}
async function uploading(h: Harness, video: Video, draft = input()) {
  const pending = error(h.media.uploadVideo(base, draft, video, h.scope())); await flush(); return { pending };
}
function invalidate(h: Harness, reason: string) {
  if (reason === 'hide') h.state.visible = false;
  if (reason === 'route') h.state.route = 'honor:102';
  if (reason === 'unload') h.state.alive = false;
  if (reason === 'account') h.account();
  if (reason === 'logout') h.session.clear();
}
const transitions = ['hide', 'route', 'unload', 'account', 'logout'];
const noAutomaticWrites = (h: Harness) => { expect(h.wx.request).not.toHaveBeenCalled(); expect(h.wx.requestSubscribeMessage).not.toHaveBeenCalled(); };

describe('荣誉MP4主动选择：真实privacy/files/session SDK消费者', () => {
  it('模块加载不读取文件、不弹授权、不选图或视频、不申请订阅', () => {
    const h = harness(); expect(h.authorizations).toHaveLength(0); expect(h.selections).toHaveLength(0);
    expect(h.stats).toHaveLength(0); expect(h.downloads).toHaveLength(0); expect(h.uploads).toHaveLength(0); noAutomaticWrites(h);
  });
  it('显式选择先授权，只选一份视频，检查实际字节大小并复制为自有.mp4', async () => {
    const h = harness(); const pending = h.media.chooseVideo(h.scope());
    expect(h.authorizations).toHaveLength(1); expect(h.selections).toHaveLength(0);
    h.authorizations[0].success(); await flush();
    expect(h.selections[0]).toMatchObject({ count: 1, mediaType: ['video'], sourceType: ['album', 'camera'], sizeType: ['compressed'] });
    h.selections[0].success({ tempFiles: [{ tempFilePath: '/synthetic-picker/video.mov', fileType: 'video', size: 64 }] });
    const video = await pending;
    expect(video).toMatchObject({ filePath: expect.stringMatching(/^\/synthetic\/zijing-private-honor-[\w.-]+\.mp4$/), size: 64 });
    expect(h.copies[0]).toMatchObject({ srcPath: '/synthetic-picker/video.mov', destPath: video.filePath });
    expect(h.fileReads.every(read => read.position === 0 && read.length <= 1024)).toBe(true);
    expect(h.uploads).toHaveLength(0); expect(h.downloads).toHaveLength(0); noAutomaticWrites(h);
  });
  it('授权拒绝保持可显式重试；没有选择视频或读取原文件', async () => {
    const h = harness(); const pending = error(h.media.chooseVideo(h.scope())); h.authorizations[0].fail();
    expect((await pending as Error).message).toContain('视频未读取'); expect(h.selections).toHaveLength(0); expect(h.stats).toHaveLength(0);
    const video = await choose(h); expect(video.size).toBe(64); expect(h.authorizations).toHaveLength(2); noAutomaticWrites(h);
  });
  it('隐私API不可用时明确失败，不绕过授权调用chooser', async () => {
    const h = harness(); Object.assign(h.wx, { requirePrivacyAuthorize: undefined });
    await expect(h.media.chooseVideo(h.scope())).rejects.toThrow('隐私授权'); expect(h.selections).toHaveLength(0);
  });
  it('选择尚未完成时重复点击只发一次授权/chooser，完成后显式操作可重试', async () => {
    const h = harness(); const pending = error(h.media.chooseVideo(h.scope()));
    await expect(h.media.chooseVideo(h.scope())).rejects.toThrow('正在进行'); expect(h.authorizations).toHaveLength(1);
    h.authorizations[0].success(); await flush(); h.selections[0].fail(); await pending;
    await choose(h); expect(h.authorizations).toHaveLength(2); expect(h.selections).toHaveLength(2);
  });
  it.each(transitions)('迟到隐私授权在%s后不打开chooser', async reason => {
    const h = harness(); const pending = error(h.media.chooseVideo(h.scope())); invalidate(h, reason); h.authorizations[0].success();
    expect((await pending as Error).message).toContain('页面或账号'); expect(h.selections).toHaveLength(0); expect(h.stats).toHaveLength(0);
  });
  it.each([maxBytes + 1, 23, -1, Number.NaN])('chooser报告非法大小%s时不复制或上传', async size => {
    const h = harness(); const pending = error(h.media.chooseVideo(h.scope())); h.authorizations[0].success(); await flush();
    h.selections[0].success({ tempFiles: [{ tempFilePath: '/synthetic-picker/video.mov', fileType: 'video', size }] });
    expect((await pending as Error).message).toContain('10 MB'); expect(h.copies).toHaveLength(0); expect(h.uploads).toHaveLength(0);
  });
  it('不依赖chooser报告的大小；真实stat超过10MiB时拒绝', async () => {
    const h = harness(); h.local.set('/synthetic-picker/video.mov', { size: maxBytes + 1, bytes: mp4() });
    const pending = error(h.media.chooseVideo(h.scope())); h.authorizations[0].success(); await flush();
    h.selections[0].success({ tempFiles: [{ tempFilePath: '/synthetic-picker/video.mov', fileType: 'video', size: 64 }] });
    expect((await pending as Error).message).toContain('10 MB'); expect(h.copies).toHaveLength(0);
  });
  it('10MiB上限被接受，读取始终只取短头部，服务端仍负责完整MP4校验', async () => {
    const h = harness(); h.local.set('/synthetic-picker/video.mov', { size: maxBytes, bytes: mp4() });
    expect((await choose(h)).size).toBe(maxBytes); expect(h.fileReads.every(read => read.length <= 1024)).toBe(true);
  });
  it.each([
    ['PNG', new Uint8Array([137, 80, 78, 71, ...Array(60).fill(0)])],
    ['JPEG', new Uint8Array([255, 216, ...Array(62).fill(0)])],
    ['WebP', new Uint8Array(Buffer.from('RIFF0000WEBP' + ' '.repeat(52)))],
    ['HTML', new Uint8Array(Buffer.from('<html>synthetic-private-login</html>' + ' '.repeat(32)))],
  ])('%s字节不能成为视频源，改扩展名也不绕过检查', async (_name, bytes) => {
    const h = harness(); h.local.set('/synthetic-picker/video.mov', { size: bytes.length, bytes });
    await expect(choose(h)).rejects.toThrow('MP4'); expect(h.copies).toHaveLength(0); expect(h.uploads).toHaveLength(0);
  });
  it.each(transitions)('复制在%s后迟到完成会删除自有输出，保留用户原文件', async reason => {
    const h = harness({ autoCopy: false }); const pending = error(choose(h)); await flush(); await flush();
    expect(h.copies).toHaveLength(1); const destination = h.copies[0].destPath; invalidate(h, reason); h.replyCopy(h.copies[0]);
    expect((await pending as Error).message).toContain('页面或账号'); expect(h.local.has(destination)).toBe(false);
    expect(h.local.has('/synthetic-picker/video.mov')).toBe(true); expect(h.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: destination }));
  });
  it('复制失败清理可能的部分自有文件，下一次主动选择不被旧锁阻塞', async () => {
    const h = harness({ autoCopy: false }); const pending = error(choose(h)); await flush(); await flush();
    const copy = h.copies[0]; h.local.set(copy.destPath, { size: 24, bytes: mp4() }); copy.fail(); await pending;
    expect(h.local.has(copy.destPath)).toBe(false);
    const retry = choose(h); await flush(); await flush(); h.replyCopy(h.copies[1]); await retry;
  });
});

describe('荣誉视频单文件multipart：真实HTTP SDK与已保存revision', () => {
  it('完整文本/team/season+原图片caption/removal随单独save发送，SDK拥有multipart boundary', async () => {
    const h = harness(), video = await choose(h);
    const draft = input([{ ...base.images[0], caption: '合成改说明一' }, { ...base.images[2], caption: '' }]);
    const { pending } = await uploading(h, video, draft);
    expect(h.uploads).toHaveLength(1); expect(h.uploads[0]).toMatchObject({ url: origin + '/api/team-honors/101', name: 'video', filePath: video.filePath,
      header: { Authorization: 'JWT synthetic-honor-token' }, formData: { id: '101', revision: '3', action: 'save', team: '51', season: '61',
        title: draft.title, competition: draft.competition, placing: draft.placing, date: draft.date, description: draft.description,
        'caption-0': '合成改说明一', 'removeImage-1': 'on', 'caption-2': '' } });
    expect(Object.keys(h.uploads[0].header)).toEqual(['Authorization']);
    expect(JSON.stringify(h.uploads[0].formData)).not.toMatch(/data:image|pictures|videoURL|submittedVersion|"images"|"Origin"/);
    h.replyUpload(); expect(await pending).toMatchObject({ record: { id: 101, revision: 4 } });
    expect(h.uploads).toHaveLength(1); noAutomaticWrites(h);
  });
  it('未先保存record/id/revision时网络前拒绝，不自动创建JSON草稿', async () => {
    const h = harness(), video = await choose(h);
    await expect(h.media.uploadVideo(null, input(), video, h.scope())).rejects.toThrow('先明确保存');
    expect(h.uploads).toHaveLength(0); noAutomaticWrites(h);
  });
  it.each(['new', 'reorder', 'duplicate', 'missing-text', 'missing-date', 'remove-video', 'other-team', 'other-season'])('%s输入在任何上传网络前拒绝，原选择仍可核对后显式重试', async reason => {
    const h = harness(), video = await choose(h), draft = input();
    if (reason === 'new') draft.images.push({ source: 'data:image/png;base64,c3ludGhldGlj', caption: '合成未保存图片' });
    if (reason === 'reorder') draft.images.reverse();
    if (reason === 'duplicate') draft.images.push({ ...draft.images[0] });
    if (reason === 'missing-text') Object.assign(draft, { description: undefined });
    if (reason === 'missing-date') Object.assign(draft, { date: undefined });
    if (reason === 'remove-video') draft.removeVideo = true;
    if (reason === 'other-team') draft.team = 52;
    if (reason === 'other-season') draft.season = 62;
    const reads = h.fileReads.length;
    await expect(h.media.uploadVideo(base, draft, video, h.scope())).rejects.toThrow();
    expect(h.uploads).toHaveLength(0); expect(h.fileReads).toHaveLength(reads); expect(h.local.has(video.filePath)).toBe(true); noAutomaticWrites(h);
  });
  it('既有重复source无法按服务器findIndex分别保留caption，先要求明确JSON核对，不能静默覆盖', async () => {
    const h = harness(), video = await choose(h), record = { ...base, images: [base.images[0], { ...base.images[0], caption: '合成不同重复说明' }] };
    await expect(h.media.uploadVideo(record, input(record.images), video, h.scope())).rejects.toThrow('先保存并核对'); expect(h.uploads).toHaveLength(0);
  });
  it('最多6份已保存图片的说明全部带回；空赛季/日期仍明确发送空值', async () => {
    const h = harness(), video = await choose(h);
    const images = Array.from({ length: 6 }, (_, index) => ({ source: png + String(index), caption: '合成说明' + index }));
    const record = { ...base, season: null, images }, draft = { ...input(images), date: null };
    const pending = h.media.uploadVideo(record, draft, video, h.scope()); await flush();
    expect(h.uploads[0].formData).toMatchObject({ season: '', date: '', 'caption-0': '合成说明0', 'caption-5': '合成说明5' });
    h.replyUpload(); await pending;
  });
  it('重复调用在SDK启动前后都只有一次上传；失败后只由明确操作重试', async () => {
    const h = harness(), video = await choose(h);
    const pending = error(h.media.uploadVideo(base, input(), video, h.scope()));
    await expect(h.media.uploadVideo(base, input(), video, h.scope())).rejects.toThrow('正在上传'); await flush();
    await expect(h.media.uploadVideo(base, input(), video, h.scope())).rejects.toThrow('正在上传'); expect(h.uploads).toHaveLength(1);
    h.uploads[0].fail(); await pending; await flush(); expect(h.uploads).toHaveLength(1); expect(h.local.has(video.filePath)).toBe(true);
    const retry = h.media.uploadVideo(base, input(), video, h.scope()); await flush(); expect(h.uploads).toHaveLength(2); h.replyUpload(1); await retry;
    noAutomaticWrites(h);
  });
  it('已启动上传跨hide保持锁，同context迟到ACK可用于只读对账；不后台abort或自动GET/POST', async () => {
    const h = harness(), video = await choose(h), scope = h.scope(), progress = vi.fn(); scope.onProgress = progress;
    const pending = h.media.uploadVideo(base, input(), video, scope); await flush(); h.state.visible = false;
    h.tasks[0].progress({ progress: 50, totalBytesWritten: 32, totalBytesExpectedToWrite: 64 });
    await expect(h.media.uploadVideo(base, input(), video, { ...scope, isCurrent: () => true })).rejects.toThrow('正在上传');
    h.replyUpload(); await expect(pending).resolves.toMatchObject({ record: { revision: 4 } });
    expect(progress).not.toHaveBeenCalled(); expect(h.tasks[0].abort).not.toHaveBeenCalled(); expect(h.uploads).toHaveLength(1); noAutomaticWrites(h);
  });
  it.each(transitions.filter(reason => reason !== 'hide'))('%s后迟到上传ACK不落旧actor/route，临时视频清理且不重发', async reason => {
    const h = harness(), video = await choose(h); const { pending } = await uploading(h, video); invalidate(h, reason); h.replyUpload();
    expect((await pending as Error).message).toContain('页面或账号'); expect(h.local.has(video.filePath)).toBe(false); expect(h.uploads).toHaveLength(1); noAutomaticWrites(h);
  });
  it('上传期间请求清理延后到ACK/finally；锁未解除时不删SDK正在读的自有文件', async () => {
    const h = harness(), video = await choose(h); const { pending } = await uploading(h, video); h.media.removeMedia([video.filePath]);
    expect(h.local.has(video.filePath)).toBe(true); h.replyUpload(); await pending; expect(h.local.has(video.filePath)).toBe(false);
  });
  it.each([{ id: 102, revision: 4 }, { id: 101, revision: 3 }, { id: 101, revision: 0 }])('ACK编号/revision不符时要求显式重新加载核对：%j', async record => {
    const h = harness(), video = await choose(h); const { pending } = await uploading(h, video); h.replyUpload(0, 200, record);
    expect((await pending as Error).message).toContain('重新加载荣誉核对'); expect(h.uploads).toHaveLength(1); noAutomaticWrites(h);
  });
  it('上传前重查文件，选择后大小变化不发送任何字节', async () => {
    const h = harness(), video = await choose(h); h.local.set(video.filePath, { size: 65, bytes: mp4() });
    await expect(h.media.uploadVideo(base, input(), video, h.scope())).rejects.toThrow('文件已变化'); expect(h.uploads).toHaveLength(0);
  });
  it('其他账号不能上传原账号选中的本地视频，即便给出新的scope', async () => {
    const h = harness(), video = await choose(h); h.account();
    await expect(h.media.uploadVideo(base, input(), video, h.scope())).rejects.toThrow('重新主动选择'); expect(h.uploads).toHaveLength(0);
  });
  it.each([400, 403, 409, 413, 415, 429, 500, 503])('上传HTTP%s拒绝保留同context草稿文件且没有自动重试', async status => {
    const h = harness(), video = await choose(h); const { pending } = await uploading(h, video); h.replyUpload(0, status);
    expect(await pending).toMatchObject({ status }); expect(h.local.has(video.filePath)).toBe(true); expect(h.uploads).toHaveLength(1); noAutomaticWrites(h);
  });
  it.each(['<html>synthetic-login</html>', '{broken-json'])('2xx SDK字符串不是合法JSON时不能误报上传成功：%s', async data => {
    const h = harness(), video = await choose(h); const { pending } = await uploading(h, video);
    h.uploads[0].success({ statusCode: 200, data }); expect((await pending as Error).message).toContain('重新加载核对'); expect(h.uploads).toHaveLength(1);
  });
  it('UI task/progress观察者抛错不会丢失已启动上传ACK或解除调用方锁', async () => {
    const h = harness(), video = await choose(h), scope = h.scope();
    scope.onTask = () => { throw new Error('synthetic UI observer'); }; scope.onProgress = () => { throw new Error('synthetic UI observer'); };
    const pending = h.media.uploadVideo(base, input(), video, scope); await flush();
    h.tasks[0].progress({ progress: 50, totalBytesWritten: 32, totalBytesExpectedToWrite: 64 }); h.replyUpload();
    await expect(pending).resolves.toMatchObject({ record: { revision: 4 } });
  });
});

describe('荣誉私有视频：授权DTO href、JWT下载、本地源与scope清理', () => {
  it('精确id/revision href经JWT下载到自有.mp4，只有200且实际MP4校验后返回本地源', async () => {
    const h = harness(), scope = h.scope(), onTask = vi.fn(), onProgress = vi.fn(); Object.assign(scope, { onTask, onProgress });
    const pending = h.media.privateVideo(base, scope);
    expect(h.downloads[0]).toMatchObject({ url: origin + base.videoHref, header: { Authorization: 'JWT synthetic-honor-token' }, timeout: 60000,
      filePath: expect.stringMatching(/^\/synthetic\/zijing-private-honor-[\w.-]+\.mp4$/) });
    expect(Object.keys(h.downloads[0].header)).toEqual(['Authorization']); expect(onTask).toHaveBeenCalledWith(h.tasks[0]);
    h.tasks[0].progress({ progress: 50, totalBytesWritten: 32, totalBytesExpectedToWrite: 64 }); expect(onProgress).toHaveBeenCalledOnce();
    const path = h.replyDownload(); expect(await pending).toBe(path); expect(path).not.toContain('/api/'); expect(h.local.has(path)).toBe(true);
    h.media.removeMedia([path]); expect(h.local.has(path)).toBe(false); expect(h.uploads).toHaveLength(0); noAutomaticWrites(h);
  });
  it.each([
    '/api/team-honor-evidence/102/video?revision=3', '/api/team-honor-evidence/101/video?revision=4',
    '/api/team-honor-evidence/101/video?revision=3&other=1', '/api/team-honor-evidence/101/video?revision=3#video',
    '/api/team-honor-evidence/101/video?version=' + 'a'.repeat(64), '/api/private-team-honor-videos/synthetic.mp4',
    '/api/showcase-videos/synthetic.mp4', 'https://home.thuzijing.top/api/team-honor-evidence/101/video?revision=3',
    '//example.invalid/private.mp4', png, '/api/team-honor-evidence/0101/video?revision=3',
  ])('拒绝未绑定当前授权DTO的地址：%s', async videoHref => {
    const h = harness(); await expect(h.media.privateVideo({ ...base, videoHref }, h.scope())).rejects.toThrow('入口暂不可用');
    expect(h.downloads).toHaveLength(0); expect(h.stats).toHaveLength(0);
  });
  it('匿名/过期会话不下载，不能靠已缓存URL或cookie进入私有视频', async () => {
    const h = harness({ loggedIn: false }); await expect(h.media.privateVideo(base, h.scope())).rejects.toThrow(); expect(h.downloads).toHaveLength(0);
    await expect(h.http.download(base.videoHref!)).rejects.toMatchObject({ status: 401 });
    await expect(h.http.upload('/api/team-honors/101', '/synthetic/file.mp4')).rejects.toMatchObject({ status: 401 }); expect(h.uploads).toHaveLength(0);
  });
  it.each([206, 302, 401, 403, 404, 409, 416, 429, 500])('SDK成功回调HTTP%s不会产生视频源，并清理已写文件', async status => {
    const h = harness(); const pending = error(h.media.privateVideo(base, h.scope())); const path = h.replyDownload(0, status);
    expect(await pending).toMatchObject({ status }); expect(h.local.has(path)).toBe(false); expect(h.downloads).toHaveLength(1); noAutomaticWrites(h);
  });
  it.each(['PNG', 'JPEG', 'WebP', 'HTML', 'short', 'oversize'])('认证200的%s输出也不能作为视频source', async format => {
    const h = harness(), pending = error(h.media.privateVideo(base, h.scope()));
    const file: File = format === 'short' ? { size: 23, bytes: mp4() } : format === 'oversize' ? { size: maxBytes + 1, bytes: mp4() }
      : { size: 64, bytes: new Uint8Array(Buffer.from(format + ' '.repeat(64 - format.length))) };
    const path = h.replyDownload(0, 200, file); expect(await pending).toMatchObject({ name: 'Error', message: expect.stringContaining('MP4') }); expect(h.local.has(path)).toBe(false);
  });
  it('SDK回报陌生临时地址不能作为source，也不删除用户原文件/陌生路径', async () => {
    const h = harness(), pending = error(h.media.privateVideo(base, h.scope())); const expected = h.downloads[0].filePath!;
    const foreign = h.replyDownload(0, 200, { size: 64, bytes: mp4() }, '/synthetic-picker/video.mov');
    await pending; expect(h.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: expected })); expect(h.local.has(foreign)).toBe(true);
  });
  it.each(transitions)('%s后迟到SDK成功写出的自有文件清理，不展示旧私有视频', async reason => {
    const h = harness(), pending = error(h.media.privateVideo(base, h.scope())); invalidate(h, reason);
    const path = h.replyDownload(); expect((await pending as Error).message).toContain('页面或账号'); expect(h.local.has(path)).toBe(false); noAutomaticWrites(h);
  });
  it('下载200后短头部读取期间hide，迟到读取结果仍被丢弃/清理', async () => {
    const h = harness({ autoRead: false }), pending = error(h.media.privateVideo(base, h.scope())), path = h.replyDownload(); await flush();
    expect(h.fileReads).toHaveLength(1); h.state.visible = false; h.replyRead(h.fileReads[0]); await pending; expect(h.local.has(path)).toBe(false);
  });
  it('旧actor清理后SDK再次生成文件，完成回调二次清理晚到输出', async () => {
    const h = harness(), pending = error(h.media.privateVideo(base, h.scope())), path = h.downloads[0].filePath!;
    h.local.set(path, { size: 24, bytes: mp4() }); h.session.clear(); expect(h.local.has(path)).toBe(false);
    h.replyDownload(); await pending; expect(h.local.has(path)).toBe(false);
    expect(h.unlink.mock.calls.filter(([value]) => value.filePath === path).length).toBeGreaterThanOrEqual(2);
  });
  it.each(['header', 'progress'])('%s显示超过10MiB时中止只读download，不留下可播放文件', async signal => {
    const h = harness(), pending = error(h.media.privateVideo(base, h.scope())), path = h.downloads[0].filePath!;
    h.local.set(path, { size: 24, bytes: mp4() });
    if (signal === 'header') h.tasks[0].headers({ 'Content-Length': String(maxBytes + 1) });
    else h.tasks[0].progress({ progress: 1, totalBytesWritten: 64, totalBytesExpectedToWrite: maxBytes + 1 });
    await pending; expect(h.tasks[0].abort).toHaveBeenCalledOnce(); expect(h.local.has(path)).toBe(false);
  });
  it('只读task可由页面hide主动abort；弱网之后仅明确点击重试下载', async () => {
    const h = harness(), scope = h.scope(); let task: Task | undefined; scope.onTask = value => { task = value; };
    const pending = error(h.media.privateVideo(base, scope)); h.state.visible = false; task!.abort(); await pending;
    expect(h.downloads).toHaveLength(1); await flush(); expect(h.downloads).toHaveLength(1);
    h.state.visible = true; const retry = h.media.privateVideo(base, h.scope()); h.replyDownload(1); await retry; expect(h.downloads).toHaveLength(2);
  });
  it('hide后progress不把旧下载的进度写回页面', async () => {
    const h = harness(), scope = h.scope(), progress = vi.fn(); scope.onProgress = progress;
    const pending = error(h.media.privateVideo(base, scope)); h.state.visible = false;
    h.tasks[0].progress({ progress: 50, totalBytesWritten: 32, totalBytesExpectedToWrite: 64 }); expect(progress).not.toHaveBeenCalled();
    h.replyDownload(); await pending;
  });
});

describe('共享HTTP与files最小兼容：实际SDK字符串/状态和凭据比较', () => {
  it.each(['upload', 'download'])('%s旧请求迟到401不清掉新账号JWT', async kind => {
    const h = harness(); const pending = error(kind === 'upload' ? h.http.upload('/api/team-honors/101', '/synthetic/file.mp4', { raw: true }) : h.http.download(base.videoHref!));
    h.account(); if (kind === 'upload') h.replyUpload(0, 401); else h.replyDownload(0, 401);
    expect(await pending).toMatchObject({ status: 401 }); expect(h.session.user()?.id).toBe(8); expect(h.session.token()).toBe('synthetic-new-account-token');
  });
  it.each(['upload', 'download'])('%s旧请求迟到401不清掉同账号更新的JWT', async kind => {
    const h = harness(); const pending = error(kind === 'upload' ? h.http.upload('/api/team-honors/101', '/synthetic/file.mp4') : h.http.download(base.videoHref!));
    h.account(7, 'synthetic-refreshed-token'); if (kind === 'upload') h.replyUpload(0, 401); else h.replyDownload(0, 401);
    expect(await pending).toMatchObject({ status: 401 }); expect(h.session.user()?.id).toBe(7); expect(h.session.token()).toBe('synthetic-refreshed-token');
  });
  it.each(['upload', 'download'])('%s当前凭据401清理会话与自有媒体', async kind => {
    const h = harness(); const owned = '/synthetic/zijing-private-honor-synthetic.mp4'; h.local.set(owned, { size: 64, bytes: mp4() });
    const pending = error(kind === 'upload' ? h.http.upload('/api/team-honors/101', '/synthetic/file.mp4') : h.http.download(base.videoHref!));
    if (kind === 'upload') h.replyUpload(0, 401); else h.replyDownload(0, 401);
    await pending; expect(h.session.user()).toBeNull(); expect(h.local.has(owned)).toBe(false);
  });
  it('默认旧图片download仍返回SDK tempFilePath；新增filePath选项才使用指定文件结果', async () => {
    const h = harness(), old = h.http.download('/api/miniapp/private-image/1'); h.replyDownload(); expect(await old).toBe('/synthetic-sdk-temp');
    expect(h.downloads[0]).not.toHaveProperty('filePath'); expect(h.downloads[0]).not.toHaveProperty('timeout');
    const modern = h.http.download(base.videoHref!, { filePath: '/synthetic/specific.mp4' }); h.replyDownload(1); expect(await modern).toBe('/synthetic/specific.mp4');
  });
  it('upload的200/201字符串JSON正常解析；服务器5xx/敏感错误内容不暴露', async () => {
    const h = harness();
    const pending = h.http.upload('/api/team-honors/101', '/synthetic/file.mp4', { raw: true }); h.replyUpload(0, 201); await expect(pending).resolves.toMatchObject({ record: { revision: 4 } });
    const failure = error(h.http.upload('/api/team-honors/101', '/synthetic/file.mp4')); h.uploads[1].success({ statusCode: 500, data: JSON.stringify({ error: 'SQL SELECT secret password synthetic-only' }) });
    expect(await failure).toMatchObject({ message: '服务暂时不可用，请稍后重试', status: 500 }); expect(await failure).not.toHaveProperty('debug');
  });
  it('清理仅删除自有honor前缀；登出遗留扫描新增.mp4且保留陌生文件', () => {
    const h = harness();
    const owned = '/synthetic/zijing-private-honor-synthetic.mp4', foreign = '/synthetic/other-synthetic.mp4', image = '/synthetic/zijing-private-avatar.png';
    for (const path of [owned, foreign, image]) h.local.set(path, { size: 64, bytes: mp4() });
    h.media.removeMedia([owned, foreign, image, '/synthetic/zijing-private-honor-../foreign.mp4', '/synthetic-picker/video.mov']);
    expect(h.local.has(owned)).toBe(false); expect(h.local.has(foreign)).toBe(true); expect(h.local.has(image)).toBe(true);
    h.local.set(owned, { size: 64, bytes: mp4() }); h.files.clearPrivate();
    expect(h.local.has(owned)).toBe(false); expect(h.local.has(image)).toBe(false); expect(h.local.has(foreign)).toBe(true); expect(h.local.has('/synthetic-picker/video.mov')).toBe(true);
  });
});
