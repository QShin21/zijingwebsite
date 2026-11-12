import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HomeResponse, EventCard } from "../src/lib/v2/types";
import { CampusHero, HomeReel, PixelGames } from "../src/components/v2/Campus";
import { SuccessMark } from "../src/components/v2/SuccessMark";
import { PixelCorners } from "../src/components/v2/PixelCorners";
import { TopBar, MobileTabs, Footer } from "../src/components/v2/Shell";
import Home from "../src/app/(frontend)/page";
import { read } from "../src/components/v2/data";
import { defaultHomeSections } from "../src/lib/v2/home-sections";
vi.mock("../src/lib/v2", () => ({ getHome: vi.fn() }));
vi.mock("../src/components/v2/data", () => ({ read: vi.fn() }));

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

describe("corner ornaments", () => {
  it("keeps 3–5 cell pieces stable across server renders and varies neighbouring cards", () => {
    const render = (seed: string) =>
      renderToStaticMarkup(createElement(PixelCorners, { seed }));
    const neighbours = ["event:11", "event:12", "event:13", "event:14"].map(
      render,
    );
    expect(new Set(neighbours).size).toBe(4);
    for (let i = 0; i < neighbours.length; i++) {
      expect(neighbours[i]).toBe(render(`event:${11 + i}`));
      const pieces = [
        ...neighbours[i].matchAll(
          /<svg[^>]*data-cells="(\d)"[^>]*>(.*?)<\/svg>/g,
        ),
      ];
      expect(pieces).toHaveLength(2);
      for (const [, count, body] of pieces) {
        expect(Number(count)).toBeGreaterThanOrEqual(3);
        expect(Number(count)).toBeLessThanOrEqual(5);
        expect(body.match(/<rect /g)).toHaveLength(Number(count));
      }
      expect(neighbours[i]).toContain('aria-hidden="true"');
      expect(neighbours[i]).not.toContain("<a");
    }
  });
});

it("keeps ordinary corners static and explicitly opts in actionable corners", () => {
  const plain = renderToStaticMarkup(createElement(PixelCorners));
  const action = renderToStaticMarkup(
    createElement(PixelCorners, { interactive: true }),
  );
  expect(plain).not.toContain("data-interactive");
  expect(action).toContain('data-interactive="true"');
  const mark = renderToStaticMarkup(createElement(SuccessMark));
  expect(mark).toContain("data-confirmed-success");
  expect(mark).toContain('aria-hidden="true"');
  expect(mark).not.toContain('role="status"');
});

it("pairs only the signed-in homepage and combines all community entry points at the bottom", async () => {
  const event: EventCard = {
    key: "club:1",
    ref: { type: "event", source: "club", id: 1, slug: "synthetic" },
    href: "/events/synthetic",
    title: "合成活动",
    summary: null,
    cover: null,
    community: null,
    team: null,
    category: "比赛",
    startAt: null,
    endAt: null,
    location: null,
    state: "upcoming",
    stateLabel: "即将开始",
    signup: {
      mode: "form",
      state: "open",
      label: "报名开放",
      opensAt: null,
      deadline: null,
      viewerSubmitted: false,
    },
    promoted: false,
    demo: true,
    archived: false,
    publishedAt: null,
  };
  const data: HomeResponse = {
    ...home,
    sections: defaultHomeSections.map((item) => ({ ...item })),
    viewer: {
      id: 1,
      name: "合成成员",
      email: "member@example.invalid",
      roles: ["member"],
      department: null,
      capabilities: {
        publishClub: false,
        submitClubContent: false,
        reviewCommunityApplications: false,
        manageStaffRecruitment: false,
        reviewPromotions: false,
        appoint: false,
        reviewEstablishments: false,
        communities: [],
      },
    },
    spotlight: event,
    upcoming: [event],
    openSignups: [event],
    communities: [],
  };
  vi.mocked(read).mockResolvedValue(data);
  const member = renderToStaticMarkup(await Home());
  const positions = [
    "me-title",
    'id="upcoming"',
    'id="spotlight"',
    'id="open"',
    'id="notices"',
    'id="highlights"',
    'data-home-row="games"',
  ].map((key) => member.indexOf(key));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(member.match(/id="games-title"/g)).toHaveLength(1);
  expect(member).not.toContain('id="communities-title"');
  expect(member).toContain("/account?view=applications");
  vi.mocked(read).mockResolvedValue({
    ...data,
    viewer: null,
    communities: null,
  });
  const guest = renderToStaticMarkup(await Home());
  expect(guest).not.toContain("data-home-row=");
  expect(guest).not.toContain("我的工作台");
  expect(guest.indexOf('id="spotlight"')).toBeLessThan(
    guest.indexOf('id="upcoming"'),
  );
});
