import { describe, expect, it, vi } from "vitest";
import { Overlay, publicationFields, sourceTexts, textHash, translatableCollections, translationFields } from "../src/lib/content-translation/segments";
import { publishedForTranslation } from "../src/lib/content-translation/published";
import { localizeError } from "../src/lib/i18n/messages";

/*
 * 2026-11-14 public-content sources: explicit field allowlist, publication rules, display
 * projection by shape, and the stable English error fallback. Synthetic data only.
 */
const english = (text: string) => `EN<${text}>`;
const overlays = new Map<string, Overlay>();
vi.mock("../src/lib/content-translation/store", () => ({
  loadOverlays: async (refs: { collection: string; id: number }[]) =>
    new Map(refs.map((ref) => `${ref.collection}:${ref.id}`).filter((key) => overlays.has(key)).map((key) => [key, overlays.get(key)!])),
}));
const overlayOf = (...texts: string[]) => new Overlay(Object.fromEntries(texts.map((text) => [textHash(text), english(text)])));
const lexical = (text: string) => ({ root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text }] }] } });

describe("field allowlist", () => {
  it("never lists private or internal fields", () => {
    const sensitive = /contact|qr|author|email|phone|note|answer|ticket|proof|video|member|roster|profile|snapshot|submitted|review|position|season|image/i;
    for (const collection of translatableCollections) {
      for (const field of translationFields[collection]) expect(field, `${collection}.${field}`).not.toMatch(sensitive);
      // Every collection has a publication state, except the always-public site global.
      if (collection !== "site") expect(publicationFields[collection].length).toBeGreaterThan(0);
    }
  });

  it("extracts only allowlisted text from each new collection", () => {
    const honor = sourceTexts("team-honor-records", { title: "合成冠军", competition: "合成联赛", placing: "第一名", description: "合成说明",
      authorName: "合成作者", images: [{ source: "私密证据", caption: "证据说明" }], videoURL: "https://example.invalid/v.mp4", approvedSnapshot: { title: "快照" }, reviewNote: "审核意见" });
    expect(honor).toEqual(["合成冠军", "合成联赛", "第一名", "合成说明"]);
    const showcase = sourceTexts("community-showcase", { title: "合成风采", body: "合成风采正文", authorName: "合成作者", reviewNote: "合成审核意见", images: [{ caption: "合成配图" }] });
    expect(showcase).toEqual(["合成风采", "合成风采正文"]);
    const team = sourceTexts("teams", { title: "合成一队", summary: "合成简介", body: lexical("合成队伍介绍"), positions: [{ name: "合成位置", duties: "合成职责" }] });
    expect(team).toEqual(["合成一队", "合成简介", "合成队伍介绍"]);
    const album = sourceTexts("albums", { title: "合成影像", photos: [{ image: 3, caption: " 合成图注 " }] });
    expect(album).toEqual(["合成影像", "合成图注"]);
    const page = sourceTexts("pages", { key: "about", title: "关于合成", body: lexical("合成正文"), sections: [{ heading: "合成问题", text: "合成回答" }] });
    expect(page).toEqual(["关于合成", "合成问题", "合成回答", "合成正文"]);
    expect(sourceTexts("pages", { key: "privacy", title: "隐私说明", body: lexical("法律条款") })).toEqual([]);
    expect(sourceTexts("news", { title: "合成新闻", signupForm: { enabled: true, questions: [{ id: "q", label: "不应出现", type: "text", required: false, options: [] }] } })).toEqual(["合成新闻"]);
  });

  it("only public states are translated", () => {
    expect(publishedForTranslation("team-honor-records", { state: "pending" })).toBe(false);
    expect(publishedForTranslation("team-honor-records", { state: "hidden" })).toBe(false);
    expect(publishedForTranslation("team-honor-records", { state: "approved" })).toBe(true);
    expect(publishedForTranslation("community-showcase", { status: "pending" })).toBe(false);
    expect(publishedForTranslation("community-showcase", { status: "visible" })).toBe(true);
    expect(publishedForTranslation("pages", { _status: "published", key: "privacy" })).toBe(false);
    expect(publishedForTranslation("pages", { _status: "published", key: "about" })).toBe(true);
    expect(publishedForTranslation("news", { _status: "draft" })).toBe(false);
    expect(publishedForTranslation("games", { _status: "published" })).toBe(true);
  });
});

describe("display projection by shape", () => {
  it("replaces only allowlisted fields of authorized results and keeps identifiers", async () => {
    const { localizeView } = await import("../src/lib/content-translation/localize");
    overlays.clear();
    overlays.set("games:5", overlayOf("合成社群", "合成社群简介", "合成社群介绍"));
    overlays.set("teams:8", overlayOf("合成一队", "合成队伍简介", "合成队伍介绍"));
    overlays.set("community-showcase:3", overlayOf("合成风采", "合成风采正文", "合成作者"));
    overlays.set("team-honor-records:12", overlayOf("合成冠军", "合成联赛", "第一名", "合成说明"));
    overlays.set("news:4", overlayOf("合成新闻", "合成新闻正文"));
    overlays.set("albums:6", overlayOf("合成影像", "合成图注"));
    overlays.set("pages:2", overlayOf("关于合成", "合成问题", "合成回答", "合成正文"));
    overlays.set("pages:9", overlayOf("隐私说明", "法律条款"));
    const community = { id: 5, slug: "synthetic", title: "合成社群", hue: 1 };
    const team = { id: 8, slug: "synthetic-team", title: "合成一队", community };
    const result = await localizeView({
      communities: [{ community, summary: "合成社群简介", counts: { upcomingEvents: 0, teams: 1, showcase: 1 } }],
      detail: { card: { community, summary: "合成社群简介", counts: {} }, body: lexical("合成社群介绍"), officers: [{ id: 1, name: "合成管理员", hasContactCard: true }] },
      teamDetail: { card: { team, summary: "合成队伍简介", counts: {} }, body: lexical("合成队伍介绍"), positions: [], roster: [{ displayName: "合成队员", biography: "合成个人简介" }] },
      showcase: { key: "showcase:3", id: 3, ref: { type: "showcase", id: 3, community: "synthetic" }, href: "/community/synthetic/showcase/3", community, title: "合成风采", body: "合成风采正文", authorName: "合成作者", reviewNote: null },
      honor: { key: "team-honor-records:12", ref: { type: "honor", key: "team-honor-records:12", team: "synthetic-team" }, team, title: "合成冠军", competition: "合成联赛", placing: "第一名", description: "合成说明" },
      legacy: { key: "honors:12", ref: { type: "honor", key: "honors:12", team: "synthetic-team" }, team, title: "合成冠军", competition: "合成联赛", placing: "第一名", description: "合成说明" },
      article: { article: { ref: { type: "album", id: 6, slug: "a" }, title: "合成影像", summary: null }, body: null, bodyText: null, sections: [], photos: { docs: [{ image: { src: "/x" }, caption: "合成图注" }] } },
      news: { article: { ref: { type: "news", id: 4, slug: "n" }, title: "合成新闻", summary: null }, body: lexical("合成新闻正文"), bodyText: null, sections: [], photos: null },
      about: { key: "about", id: 2, title: "关于合成", body: lexical("合成正文"), sections: [{ id: "s", heading: "合成问题", text: "合成回答" }], contacts: null },
      privacy: { key: "privacy", id: 9, title: "隐私说明", body: lexical("法律条款"), sections: [], contacts: null },
    }, "en");
    expect(result.communities[0].community).toEqual({ ...community, title: english("合成社群") });
    expect(result.communities[0].summary).toBe(english("合成社群简介"));
    expect(JSON.stringify(result.detail.body)).toContain(english("合成社群介绍"));
    expect(result.detail.officers[0].name).toBe("合成管理员");
    expect(result.teamDetail.card.team.title).toBe(english("合成一队"));
    expect(JSON.stringify(result.teamDetail.body)).toContain(english("合成队伍介绍"));
    expect(result.teamDetail.roster[0]).toEqual({ displayName: "合成队员", biography: "合成个人简介" });
    expect(result.showcase.title).toBe(english("合成风采"));
    expect(result.showcase.body).toBe(english("合成风采正文"));
    expect(result.showcase.authorName).toBe("合成作者"); // never replaced even if cached
    expect(result.showcase.href).toBe("/community/synthetic/showcase/3");
    expect(result.honor).toMatchObject({ title: english("合成冠军"), competition: english("合成联赛"), placing: english("第一名"), description: english("合成说明") });
    expect(result.legacy.title).toBe("合成冠军");
    expect(result.article.photos.docs[0].caption).toBe(english("合成图注"));
    expect(result.article.article.title).toBe(english("合成影像"));
    expect(JSON.stringify(result.news.body)).toContain(english("合成新闻正文"));
    expect(result.about).toMatchObject({ key: "about", id: 2, title: english("关于合成"), sections: [{ id: "s", heading: english("合成问题"), text: english("合成回答") }] });
    expect(result.privacy.title).toBe("隐私说明");
    expect(JSON.stringify(result.privacy.body)).toContain("法律条款");
    const chinese = await localizeView({ community }, "zh");
    expect(chinese.community.title).toBe("合成社群");
  });
});

describe("stable English for server errors", () => {
  it("keeps Chinese mode and the original message, translates known ones", () => {
    expect(localizeError("某个少见的业务提示", "zh", { status: 409 })).toBe("某个少见的业务提示");
    expect(localizeError("请先登录可用账号", "en", { status: 401 })).toBe("Please sign in with an active account.");
    expect(localizeError("某个少见的业务提示", "en", { status: 409, code: "CONFLICT" })).toBe("The content was updated or already handled. Refresh and try again. (某个少见的业务提示)");
    expect(localizeError("某个少见的业务提示", "en", { status: 502 })).toBe("The service is temporarily unavailable. Please try again later. (某个少见的业务提示)");
    expect(localizeError("某个少见的业务提示", "en", {})).toBe("The action could not be completed. (某个少见的业务提示)");
    expect(localizeError("Already English", "en", { status: 400 })).toBe("Already English");
  });
});

describe("remaining public sources", () => {
  it("projected sources keep to their allowlist", () => {
    expect(sourceTexts("honors", { title: "旧荣誉", competition: "旧赛事", placing: "旧名次", summary: " 旧说明 ", sourceURL: "https://example.invalid", slug: "x" }))
      .toEqual(["旧荣誉", "旧赛事", "旧名次", " 旧说明 ", "旧说明"]);
    expect(sourceTexts("staff-batches", { title: "批次", description: "说明", signupForm: { intro: "隐私说明含微信号" } })).toEqual(["批次", "说明"]);
    expect(sourceTexts("team-recruitments", { title: "选拔", intro: "选拔说明", signupForm: { questions: [{ label: "游戏 ID" }] } })).toEqual(["选拔", "选拔说明"]);
    expect(sourceTexts("site", { heroTitle: "首屏", footer: "页脚", homeSections: [{ title: "近期活动" }], contacts: [{ text: "微信号" }], name: "社团名" }))
      .toEqual(["首屏", "页脚", "近期活动"]);
  });
  it("home, recruitment cards and legacy honor keys receive English", async () => {
    const { localizeView } = await import("../src/lib/content-translation/localize");
    overlays.clear();
    overlays.set("site:1", overlayOf("首屏", "副标题", "按钮", "页脚", "近期活动"));
    overlays.set("staff-batches:4", overlayOf("骨干批次", "骨干说明"));
    overlays.set("team-recruitments:6", overlayOf("选拔批次", "选拔说明"));
    overlays.set("honors:9", overlayOf("旧荣誉", "旧说明"));
    const result = await localizeView({
      home: { sections: [{ kind: "upcoming", enabled: true, title: "近期活动" }], site: { name: "紫荆", heroTitle: "首屏", heroSubtitle: "副标题", heroImage: null, heroAction: { label: "按钮", href: "/join" }, footer: "页脚" } },
      staff: { key: "staff:4", ref: { type: "staffBatch", id: 4 }, title: "骨干批次", summary: "骨干说明", href: "/join/staff/batches/4" },
      team: { key: "team:6", ref: { type: "teamRecruitment", id: 6 }, title: "选拔批次", summary: "选拔说明" },
      legacy: { key: "honors:9", ref: { type: "honor", key: "honors:9", team: "t" }, title: "旧荣誉", description: "旧说明", competition: "未缓存" },
    }, "en");
    expect(result.home.site).toMatchObject({ name: "紫荆", heroTitle: english("首屏"), heroSubtitle: english("副标题"), footer: english("页脚"), heroAction: { label: english("按钮"), href: "/join" } });
    expect(result.home.sections[0]).toEqual({ kind: "upcoming", enabled: true, title: english("近期活动") });
    expect(result.staff).toMatchObject({ title: english("骨干批次"), summary: english("骨干说明"), href: "/join/staff/batches/4" });
    expect(result.team).toMatchObject({ title: english("选拔批次"), summary: english("选拔说明") });
    expect(result.legacy).toMatchObject({ title: english("旧荣誉"), description: english("旧说明"), competition: "未缓存" });
  });
});
