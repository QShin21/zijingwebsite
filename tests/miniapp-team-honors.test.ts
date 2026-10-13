import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Data = Record<string, unknown>;
type Event = { currentTarget: { dataset: Record<string, string> } };
type Page = { data: { loading: boolean; error: string; loaded: boolean; team: { id: number; title: string } | null; records: Data[]; previewImages: string[] };
  setData(value: Data): void; onLoad(value: { team: string }): void; onShow(): Promise<void>; onHide(): void; onUnload(): void;
  retry(): Promise<void>; load(): Promise<void>; back(): void; source(event: Event): void; preview(event: Event): void; videoError(event: Event): void };
type RequestOptions = { url: string; method: string; header: Record<string, string>; success(value: { statusCode: number; data: unknown }): void; fail(): void };
type WriteOptions = { filePath: string; data: string; encoding: string; success(): void; fail(): void };
type Archive = { key: string; team: { id: number; title: string; gameTitle: string }; records: Data[] };
type Honor = { videoSource(value: Data): string; archive(value: unknown, id: unknown): { team: Data; records: Data[] }; load(id: unknown): Promise<unknown> };
const image = "data:image/webp;base64,UklGRnN5bnRoZXRpYw==";
const version = "a".repeat(64), nextVersion = "b".repeat(64);
const videoHref = "/api/team-honor-evidence/12/video?version=" + version;
const origin = "https://home.thuzijing.top";
function archive(team = 41): Archive {
  return { key: "team-honors:" + team, team: { id: team, title: "紫荆电竞 · 合成服务原文", gameTitle: "合成社群" }, records: [
    { key: "team-honor-records:12", title: "合成批准荣誉", competition: "合成赛事", placing: "合成结果", date: "2024-06-01T00:00:00.000Z",
      description: "服务端已审投影原文", authorName: "合成署名", approvedAt: "2026-10-12T08:00:00Z", legacy: false,
      images: [{ source: image, caption: "合成证据说明" }], videoHref, videoVersion: "c".repeat(64), sourceHref: null,
      videoURL: "/api/showcase-videos/raw-storage-must-not-enter-page.mp4", membershipRef: 999, reviewNote: "private-note", history: ["private-history"] },
    { key: "honors:9", title: "合成历史荣誉", competition: "历史赛事原文", placing: "历史结果原文", date: "2026-05-01T00:00:00Z",
      description: "历史档案说明", authorName: "历史荣誉档案", approvedAt: null, legacy: true, images: [], videoHref: null, sourceHref: "/honors/synthetic-history" },
  ] };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function harness() {
  let saved: unknown = { token: "synthetic-token", exp: 9999999999, user: { id: 7, name: "合成用户", roles: ["member"], accountStatus: "active" } };
  const requests: RequestOptions[] = [], writes: WriteOptions[] = [], patches: Data[] = [];
  const unlink = vi.fn(), stop = vi.fn();
  const fs = { writeFile: (options: WriteOptions) => writes.push(options), unlink, readdir: (options: { success(value: { files: string[] }): void }) => options.success({ files: [] }) };
  const wx = { request: vi.fn((options: RequestOptions) => requests.push(options)), env: { USER_DATA_PATH: "/synthetic" }, getFileSystemManager: () => fs,
    getStorageSync: () => saved, setStorageSync: (_key: string, value: unknown) => { saved = value; }, removeStorageSync: () => { saved = null; },
    setNavigationBarTitle: vi.fn(), stopPullDownRefresh: vi.fn(), previewImage: vi.fn(), navigateTo: vi.fn(), navigateBack: vi.fn(), switchTab: vi.fn(),
    createVideoContext: vi.fn(() => ({ stop })), requestSubscribeMessage: vi.fn(), chooseMedia: vi.fn(), setClipboardData: vi.fn() };
  const modules = new Map<string, { exports: unknown }>();
  function load(filename: string): unknown {
    filename = resolve(filename);
    if (modules.has(filename)) return modules.get(filename)!.exports;
    const module = { exports: {} as unknown }; modules.set(filename, module);
    runInNewContext(readFileSync(filename, "utf8"), { module, wx, require: (name: string) => load(resolve(dirname(filename), name + ".js")) });
    return module.exports;
  }
  const honor = load("miniprogram/src/lib/team-honor.js") as Honor;
  const session = load("miniprogram/src/lib/session.js") as { save(value: unknown): void; clear(): void };
  let page!: Page;
  const filename = resolve("miniprogram/src/pages/team-honors/index.js");
  runInNewContext(readFileSync(filename, "utf8"), { wx, Page: (value: Page) => { page = value; },
    getCurrentPages: () => [{}, {}], require: (name: string) => {
      const path = resolve(dirname(filename), name + ".js");
      if (path.endsWith("/navigation.js")) {
        const module = { exports: {} as unknown };
        runInNewContext(readFileSync(path, "utf8"), { module, wx, getCurrentPages: () => [{}, {}], require: (name: string) => load(resolve(dirname(path), name + ".js")) });
        return module.exports;
      }
      return load(path);
    } });
  page.setData = value => { patches.push(value); Object.assign(page.data, value); };
  const reply = (index: number, value: unknown, status = 200) => requests[index].success({ statusCode: status, data: value });
  return { page, honor, session, wx, requests, writes, unlink, stop, patches, reply };
}

describe("实际荣誉档案HTTP合同的原生只读消费者", () => {
  it("只播放批准版本的受控路径，拒绝原始媒体、任意外链及记录不匹配", () => {
    const h = harness(), valid = { key: "team-honor-records:12", legacy: false, videoHref };
    expect(h.honor.videoSource(valid)).toBe(origin + videoHref);
    for (const invalid of ["/api/showcase-videos/private.mp4", "https://evil.invalid/video.mp4", "//evil.invalid/video.mp4", "/api/team-honor-evidence/12/video",
      "/api/team-honor-evidence/12/video?revision=1", videoHref + "&revision=1", videoHref + "#fragment", videoHref.replace("/12/", "/13/"),
      videoHref.replace(version, version.toUpperCase()), videoHref.replace(version, "%61".repeat(64))]) expect(h.honor.videoSource({ ...valid, videoHref: invalid })).toBe("");
    expect(h.honor.videoSource({ ...valid, legacy: true })).toBe("");
    expect(h.honor.videoSource({ key: valid.key, videoURL: videoHref })).toBe("");
  });
  it("DTO验证当前队伍，保持服务端顺序和事实，白名单剔除原始视频及私人资料", () => {
    const h = harness(), accepted = h.honor.archive(archive(), 41);
    expect(accepted.records.map(record => record.key)).toEqual(["team-honor-records:12", "honors:9"]);
    expect(accepted.records[0]).toMatchObject({ title: "合成批准荣誉", description: "服务端已审投影原文", dateText: "2024-06-01" });
    expect(JSON.stringify(accepted)).not.toMatch(/videoURL|raw-storage|membershipRef|private-note|private-history/);
    expect(() => h.honor.archive(archive(42), 41)).toThrow("当前队伍不匹配");
    expect(() => h.honor.archive("<html>failure</html>", 41)).toThrow();
    expect(() => h.honor.archive({ ...archive(), records: [{}] }, 41)).toThrow("格式暂不可用");
    expect(() => h.honor.archive({ ...archive(), records: [{ ...archive().records[0], images: [{ source: "https://evil.invalid/private.jpg", caption: "无效" }] }] }, 41)).toThrow("证据图片");
  });
  it("实际Page/HTTP/files代码调用合成wx SDK：匿名原文、WebP落盘和历史原生导航", async () => {
    const h = harness(); h.page.onLoad({ team: "41" }); const reading = h.page.onShow();
    expect(h.requests[0]).toMatchObject({ url: origin + "/api/team-honor-archives/41", method: "GET" });
    expect(h.requests[0].header).not.toHaveProperty("Authorization");
    h.reply(0, archive()); await flush();
    expect(h.page.data.loading).toBe(false); expect(h.page.data.team?.title).toBe("紫荆电竞 · 合成服务原文");
    expect(h.writes[0]).toMatchObject({ encoding: "base64", data: image.split(",")[1] });
    h.writes[0].success(); await reading;
    expect(h.page.data.records[0].videoSource).toBe(origin + videoHref);
    expect(h.page.data.records[0].localImages).toEqual([{ url: h.writes[0].filePath, caption: "合成证据说明" }]);
    expect(JSON.stringify(h.patches)).not.toMatch(/videoURL|raw-storage|membershipRef|private-note|private-history/);
    h.page.preview({ currentTarget: { dataset: { url: h.writes[0].filePath } } }); expect(h.wx.previewImage).toHaveBeenCalledWith({ current: h.writes[0].filePath, urls: [h.writes[0].filePath] });
    h.page.preview({ currentTarget: { dataset: { url: "https://evil.invalid/private.jpg" } } }); expect(h.wx.previewImage).toHaveBeenCalledTimes(1);
    h.page.source({ currentTarget: { dataset: { key: "honors:9" } } });
    expect(h.wx.navigateTo).toHaveBeenCalledWith({ url: "/pages/detail/index?collection=honors&slug=synthetic-history" });
    h.page.back(); expect(h.wx.navigateBack).toHaveBeenCalledWith(expect.objectContaining({ delta: 1, fail: expect.any(Function) }));
    expect(h.wx.chooseMedia).not.toHaveBeenCalled(); expect(h.wx.requestSubscribeMessage).not.toHaveBeenCalled();
    expect(h.requests.every(request => request.method === "GET")).toBe(true);
  });
  it("legacy档案不展示图片或视频，即使响应额外包含原始媒体也不采纳", async () => {
    const h = harness(), body = archive(); body.records = [{ ...body.records[1], images: [{ source: image, caption: "不应显示" }], videoHref, videoURL: "https://evil.invalid/private.mp4" }];
    h.page.onLoad({ team: "41" }); const reading = h.page.onShow(); h.reply(0, body); await reading;
    expect(h.writes).toHaveLength(0); expect(h.page.data.records[0]).toMatchObject({ images: [], localImages: [], videoSource: "", videoHref: "", sourceHref: "/honors/synthetic-history" });
    expect(JSON.stringify(h.patches)).not.toContain("evil.invalid");
  });
  it("404为可重试空态，500/断网安全提示且不绕回私人API", async () => {
    const h = harness(); h.page.onLoad({ team: "41" }); const first = h.page.onShow(); h.reply(0, { error: "档案不存在" }, 404); await first;
    expect(h.page.data).toMatchObject({ loaded: true, loading: false, error: "", records: [] });
    const second = h.page.retry(); h.reply(1, { error: "SQL secret-private" }, 500); await second;
    expect(h.page.data.error).toBe("服务暂时不可用，请稍后重试");
    const third = h.page.retry(); h.requests[2].fail(); await third;
    expect(h.page.data.error).toContain("连接失败");
    expect(h.requests.every(request => request.url === origin + "/api/team-honor-archives/41" && !request.header.Authorization)).toBe(true);
  });
  it("慢网重复点击只发一条请求，队伍不匹配和非法入口不落盘", async () => {
    const h = harness(); h.page.onLoad({ team: "41" }); const reading = h.page.onShow(); const retry = h.page.retry();
    expect(h.requests).toHaveLength(1); h.reply(0, archive(42)); await Promise.all([reading, retry]);
    expect(h.page.data.error).toContain("当前队伍不匹配"); expect(h.writes).toHaveLength(0);
    h.page.onLoad({ team: "../private" }); await h.page.onShow(); expect(h.requests).toHaveLength(1);
    expect(h.page.data.error).toContain("队伍入口无效");
  });
  it("路由变化后旧请求迟到不会覆盖新队伍", async () => {
    const h = harness(); h.page.onLoad({ team: "41" }); const first = h.page.onShow();
    h.page.onLoad({ team: "42" }); const second = h.page.onShow(); const body = archive(42); body.records = [];
    h.reply(1, body); await second; h.reply(0, archive()); await first;
    expect(h.page.data.team?.id).toBe(42); expect(h.page.data.records).toEqual([]); expect(h.writes).toHaveLength(0);
  });
  it("隐藏时忽略迟到HTTP，晚到的图片写入完成后只清理本页文件", async () => {
    const h = harness(); h.page.onLoad({ team: "41" }); const first = h.page.onShow(); h.page.onHide(); h.reply(0, archive()); await first;
    expect(h.page.data.records).toEqual([]); expect(h.writes).toHaveLength(0);
    const second = h.page.onShow(); h.reply(1, archive()); await flush(); expect(h.writes).toHaveLength(1);
    h.page.onHide(); h.writes[0].success(); await second;
    expect(h.page.data.records).toEqual([]); expect(h.page.data.previewImages).toEqual([]);
    expect(h.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: h.writes[0].filePath }));
    expect(h.unlink.mock.calls.every(([options]) => options.filePath.startsWith("/synthetic/zijing-private-") && options.filePath.endsWith(".webp"))).toBe(true);
  });
  it("账号切换触发新匿名读取，旧媒体完成后不会恢复旧页面且会清理", async () => {
    const h = harness(); h.page.onLoad({ team: "41" }); const first = h.page.onShow(); h.reply(0, archive()); await flush();
    h.session.save({ token: "synthetic-new-token", exp: 9999999999, user: { id: 8, name: "新合成账号", roles: ["member"], accountStatus: "active" } });
    expect(h.requests).toHaveLength(2); const body = archive(); body.records = [body.records[1]]; h.reply(1, body); await flush();
    h.writes[0].success(); await first; await flush();
    expect(h.page.data.records.map(record => record.key)).toEqual(["honors:9"]); expect(h.page.data.previewImages).toEqual([]);
    expect(h.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: h.writes[0].filePath }));
    expect(h.requests.every(request => !request.header.Authorization)).toBe(true);
  });
  it("hide停止视频，show重新核对投影；过时SDK视频错误不能污染新版本", async () => {
    const h = harness(), body = archive(); body.records = [{ ...body.records[0], images: [] }];
    h.page.onLoad({ team: "41" }); const first = h.page.onShow(); h.reply(0, body); await first;
    h.page.onHide(); expect(h.stop).toHaveBeenCalledTimes(1); expect(h.page.data.records).toEqual([]);
    const second = h.page.onShow(); const refreshed = { ...body, records: [{ ...body.records[0], videoHref: videoHref.replace(version, nextVersion) }] };
    h.reply(1, refreshed); await second;
    h.page.videoError({ currentTarget: { dataset: { key: "team-honor-records:12", source: origin + videoHref } } });
    expect(h.page.data.records[0].videoError).toBe("");
    h.page.videoError({ currentTarget: { dataset: { key: "team-honor-records:12", source: origin + videoHref.replace(version, nextVersion) } } });
    expect(h.page.data.records[0].videoError).toContain("重新加载档案");
  });
  it("本机媒体写入失败保留原文字和其他证据，不使用原始videoURL补救", async () => {
    const h = harness(), body = archive(); body.records = [{ ...body.records[0], videoHref: null, images: [{ source: image, caption: "失败图" }, { source: image, caption: "成功图" }] }];
    h.page.onLoad({ team: "41" }); const reading = h.page.onShow(); h.reply(0, body); await flush(); h.writes[0].fail(); h.writes[1].success(); await reading;
    expect(h.page.data.records[0]).toMatchObject({ title: "合成批准荣誉", description: "服务端已审投影原文", videoSource: "", videoHref: "" });
    expect(h.page.data.records[0].localImages).toEqual([{ url: h.writes[1].filePath, caption: "成功图" }]);
    expect(h.page.data.records[0].mediaError).toContain("部分证据图片"); expect(JSON.stringify(h.patches)).not.toMatch(/videoURL|raw-storage/);
  });
  it("WXML使用用户主动播放、原生返回、图片与失败重试，不展示未接入写入口", () => {
    const wxml = readFileSync("miniprogram/src/pages/team-honors/index.wxml", "utf8");
    expect(wxml).toContain('autoplay="{{false}}"'); expect(wxml).toContain('controls="{{true}}"');
    expect(wxml).toContain('bindtap="back"'); expect(wxml).toContain('bindtap="preview"'); expect(wxml).toContain('bindtap="retry"');
    expect(wxml).not.toMatch(/videoURL|bindtap="submit|审核|录取|订阅/);
    expect(JSON.parse(readFileSync("miniprogram/src/pages/team-honors/index.json", "utf8"))).toMatchObject({ enablePullDownRefresh: true });
  });
});
