import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HomeResponse } from "../src/lib/v2/types";
import { CampusHero, HomeReel, PixelGames } from "../src/components/v2/Campus";
import { TopBar, MobileTabs, Footer } from "../src/components/v2/Shell";

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) =>
    createElement("img", { src: props.src, alt: props.alt }),
}));
const home: HomeResponse = {
  site: {
    name: "清华大学学生紫荆电竞社",
    heroTitle: null,
    heroSubtitle: null,
    heroImage: null,
    heroAction: null,
    footer: null,
  },
  viewer: null,
  today: "2026-11-12",
  spotlight: null,
  upcoming: [],
  openSignups: [],
  openCalls: [],
  notices: [],
  highlights: null,
  communities: null,
  me: null,
  about: null,
  sections: [],
  promoted: { events: [], notices: [], showcases: null },
};

describe("real campus components preserve functional entry points", () => {
  it("keeps the member account beside the news navigation", () => {
    const html = renderToStaticMarkup(
      createElement(TopBar, {
        name: home.site.name,
        theme: "classic",
        viewer: { name: "合成成员" },
      }),
    );
    expect(html).toContain("紫荆电竞");
    expect(html).toContain("我的主场");
    expect(html.indexOf("动态")).toBeLessThan(html.indexOf("我的主场"));
    expect(html).toContain('href="/account"');
    expect(html).toContain('aria-label="界面风格"');
    expect(html).not.toContain("暂停");
  });
  it("keeps the account entry visible to guests on desktop and mobile", () => {
    for (const html of [
      renderToStaticMarkup(
        createElement(TopBar, {
          name: home.site.name,
          theme: "classic",
          viewer: null,
        }),
      ),
      renderToStaticMarkup(createElement(MobileTabs, { signedIn: false })),
    ]) {
      expect(html).toContain('href="/account"');
      expect(html).toContain("我的主场");
    }
  });
  it("cleans the footer slogan while keeping custom content", () => {
    const html = renderToStaticMarkup(
      createElement(Footer, {
        name: home.site.name,
        footer: "清华大学学生紫荆电竞社。一起玩，认真赢。",
      }),
    );
    expect(html).toContain("一起玩，认真赢");
    expect(html).not.toContain("。");
  });
  it("renders CMS hero content, custom action, image and all personal counts", () => {
    const data: HomeResponse = {
      ...home,
      site: {
        ...home.site,
        heroTitle: "合成标题",
        heroSubtitle: "合成副标题",
        heroImage: {
          src: "/api/media/public-demo",
          alt: "合成封面",
          width: 1200,
          height: 600,
        },
        heroAction: { href: "/join/staff", label: "合成入口" },
      },
      me: { todo: 2, upcomingSignups: 3, reviewPending: 4 },
    };
    const html = renderToStaticMarkup(
      createElement(CampusHero, { home: data }),
    );
    for (const content of [
      "合成标题",
      "合成副标题",
      "合成入口",
      "/api/media/public-demo",
      "/account#todo",
      "/account#upcoming",
      "/account#manage",
      "/events",
    ])
      expect(html).toContain(content);
    expect(html).not.toContain("校园像素概念插画");
  });
  it("uses one visible photograph and manual controls without a pause button", () => {
    const html = renderToStaticMarkup(createElement(HomeReel, { home }));
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).toContain("上一张赛场照片");
    expect(html).toContain("下一张赛场照片");
    expect(html).toContain("赛事摄影来源");
    expect(html).not.toContain("暂停");
  });
  it("connects matching game emblems to the existing community route", () => {
    const html = renderToStaticMarkup(
      createElement(PixelGames, {
        communities: [
          {
            community: { id: 1, title: "英雄联盟", slug: "lol", hue: 20 },
            summary: null,
            cover: null,
            demo: true,
            counts: { upcomingEvents: 0, teams: 0, showcase: 0 },
            viewer: null,
          },
        ],
      }),
    );
    expect(html).toContain('href="/community/lol"');
    for (const game of [
      "英雄联盟",
      "CS",
      "王者荣耀",
      "瓦罗兰特",
      "金铲铲",
      "我的世界",
    ])
      expect(html).toContain(game);
  });
});
