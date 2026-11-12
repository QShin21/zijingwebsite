import Link from "next/link";
import type { HomeResponse } from "@/lib/v2";
import { ButtonLink, Img } from "./ui";
import { Icon } from "./Icon";
import { PixelCorners } from "./PixelCorners";
import { formatShort } from "./format";
import {
  CampusCover,
  CampusNews,
  CampusReel,
  PixelGameIcon,
  type CampusSlide,
} from "./CampusMotion";
import styles from "./campus.module.css";

export function CampusHero({ home }: { home: HomeResponse }) {
  const { site, me } = home;
  const messages = [
    ...home.notices.map((item) => ({
      key: item.key,
      text: `${item.demo ? "演示 · " : ""}${item.title}`,
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
  { name: "英雄联盟", kind: "lol", file: "lol.ico" },
  { name: "CS", kind: "cs", file: "cs.jpg" },
  { name: "王者荣耀", kind: "hok", file: "hok.png" },
  { name: "瓦罗兰特", kind: "valorant", file: "valorant.png" },
  { name: "金铲铲", kind: "tft", file: "tft.png" },
  { name: "我的世界", kind: "minecraft", file: "minecraft.png" },
];
export function PixelGames({
  communities,
  compact = false,
}: {
  communities: HomeResponse["communities"];
  compact?: boolean;
}) {
  return (
    <section
      className={`${styles.games} ${compact ? styles.gamesCompact : ""}`}
      aria-labelledby="games-title"
    >
      {compact && <PixelCorners variant="mint" seed="games" />}
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
              <span>
                <PixelGameIcon src={`/pixel-campus/game-icons/${game.file}`} />
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
