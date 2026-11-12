import Link from "next/link";
import type { HomeResponse } from "@/lib/v2";
import { ButtonLink, Img } from "./ui";
import { Icon } from "./Icon";
import { formatShort } from "./format";
import {
  CampusCover,
  CampusNews,
  CampusReel,
  type CampusSlide,
} from "./CampusMotion";
import styles from "./campus.module.css";

export function CampusHero({ home }: { home: HomeResponse }) {
  const { site, me } = home;
  const messages = [
    ...home.notices.map((item) => ({
      key: item.key,
      text: item.title,
      href: item.href,
    })),
    ...home.upcoming.map((item) => ({
      key: item.key,
      text: `${item.startAt ? formatShort(item.startAt) + " · " : ""}${item.title}`,
      href: item.href,
    })),
  ].slice(0, 6);
  return (
    <section aria-label="紫荆主场" className={styles.hero}>
      <CampusCover customImage={Boolean(site.heroImage)}>
        {site.heroImage && (
          <div className={styles.customImage}>
            <Img image={site.heroImage} eager sizes="100vw" />
          </div>
        )}
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1>
              {site.heroTitle?.trim() || (
                <>
                  清华园，
                  <br />
                  <em>下一局见</em>
                </>
              )}
            </h1>
            <p>
              {site.heroSubtitle || (
                <>
                  找到队友，认真上场
                  <br />
                  让共同的热爱，在校园相遇
                </>
              )}
            </p>
            <div className={styles.heroActions}>
              <ButtonLink href="/events" tone="accent" icon="arrow">
                进入活动大厅
              </ButtonLink>
              <ButtonLink href={site.heroAction?.href || "/join"} tone="stage">
                {site.heroAction?.label || "加入紫荆"}
              </ButtonLink>
            </div>
            {me && (
              <div className={styles.myShortcuts} aria-label="我的主场">
                <Link href="/account#todo">
                  待办 <strong>{me.todo}</strong>
                </Link>
                <Link href="/account#upcoming">
                  已报名 <strong>{me.upcomingSignups}</strong>
                </Link>
                <Link href="/account#manage">
                  待审核 <strong>{me.reviewPending}</strong>
                </Link>
              </div>
            )}
          </div>
        </div>
        {!site.heroImage && (
          <small className={styles.artCredit}>校园像素概念插画 · AI</small>
        )}
      </CampusCover>
      <div className={styles.newsWrap}>
        <CampusNews items={messages} />
      </div>
      <div className={styles.paths}>
        {[
          {
            href: "/community",
            icon: "community" as const,
            title: "寻找游戏社群",
            text: "找到同频的队友",
          },
          {
            href: "/teams",
            icon: "trophy" as const,
            title: "了解代表队",
            text: "让热爱更进一步",
          },
          {
            href: "/join/staff",
            icon: "flag" as const,
            title: "参与活动筹备",
            text: "一起把好事做成",
          },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Icon name={item.icon} size={26} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </span>
            <Icon name="arrow" />
          </Link>
        ))}
      </div>
    </section>
  );
}

const games = [
  {
    name: "英雄联盟",
    kind: "lol",
    color: "#e2ba64",
    path: "M5 2h7v2h2v7h-2v3H5v-2H3V4h2zm2 2v8h4v-2H9V4z",
  },
  {
    name: "CS",
    kind: "cs",
    color: "#edb18d",
    path: "M7 1h2v4h4v2h2v2h-4v2H9v4H7v-4H5V9H1V7h4V5h2zm0 5v4h3V6z",
  },
  {
    name: "王者荣耀",
    kind: "hok",
    color: "#e2ca80",
    path: "M1 3h2v2h2V3h2V1h2v2h2v2h2V3h2v8h-2v3H3v-3H1zm3 6v2h8V9z",
  },
  {
    name: "瓦罗兰特",
    kind: "valorant",
    color: "#f3979c",
    path: "M1 2h2v2h2v2h2v2h2v2h5v2h-2v2H8v-2H6v-2H4V8H2V6H1zm13 0h1v6h-2v2H9V8h2V6h2V4h1z",
  },
  {
    name: "金铲铲",
    kind: "tft",
    color: "#e5c96b",
    path: "M9 1h4v2h2v5h-2v2h-3v2H8v3H4v-3h2v-2h2V8H6V5h1V3h2zm0 3v3h3V4z",
  },
  {
    name: "我的世界",
    kind: "minecraft",
    color: "#a7ce8c",
    path: "M1 2h14v12H1zm2 2v3h2V5h2v2h2V5h2v2h2V4zm2 5v3h2v-2h2v2h2V9z",
  },
];
export function PixelGames({
  communities,
}: {
  communities: HomeResponse["communities"];
}) {
  return (
    <section className={styles.games} aria-labelledby="games-title">
      <div className={styles.gameIntro}>
        <h2 id="games-title">
          你的热爱
          <br />
          在这里集合
        </h2>
        <Link href="/community">
          全部游戏社群 <Icon name="arrow" size={16} />
        </Link>
      </div>
      <div className={styles.gameList}>
        {games.map((game) => {
          const match = communities?.find((card) =>
            card.community.title.includes(game.name),
          );
          return (
            <Link
              className={styles.game}
              href={match ? `/community/${match.community.slug}` : "/community"}
              key={game.kind}
              aria-label={`${game.name} · 寻找游戏社群`}
            >
              <span style={{ color: game.color }}>
                <svg
                  viewBox="0 0 16 16"
                  width="42"
                  height="42"
                  shapeRendering="crispEdges"
                  aria-hidden="true"
                >
                  <path d={game.path} fill="currentColor" />
                </svg>
              </span>
              <strong>{game.name}</strong>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function HomeReel({ home }: { home: HomeResponse }) {
  const slides: CampusSlide[] = [];
  for (const feed of home.highlights || []) {
    const item = feed.item;
    const image =
      feed.kind === "honor"
        ? feed.item.images[0]
        : feed.kind === "showcase"
          ? feed.item.images[0]?.image
          : feed.item.cover;
    const href = item.href;
    if (image)
      slides.push({
        src: image.src,
        alt: image.alt || item.title,
        title: item.title,
        href,
      });
  }
  if (!slides.length) {
    const source =
      "https://www.gdec.net.cn/2026/actives/newsdetail?id=1320&lang=zh";
    slides.push(
      {
        src: "/pixel-campus/esports-fistbump.jpg",
        alt: "清华参赛队员在赛场碰拳互动",
        title: "默契，从一次碰拳开始",
        href: "/about",
        source,
      },
      {
        src: "/pixel-campus/esports-match.jpg",
        alt: "选手在大学生电竞赛事现场比赛",
        title: "专注，直到最后一刻",
        href: "/about",
        source,
      },
      {
        src: "/pixel-campus/esports-trophy.jpg",
        alt: "大学生电竞赛事获奖队伍举杯合影",
        title: "这一刻，属于团队",
        href: "/about",
        source,
      },
    );
  }
  return <CampusReel slides={slides.slice(0, 6)} />;
}
