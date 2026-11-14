import Link from "next/link";
import type { ReactNode } from "react";
import { getHome, type HomeResponse, type HomeSection } from "@/lib/v2";
import { read } from "@/components/v2/data";
import { CampusHero, HeroActions, HeroKicker, HeroLead, HeroTitle } from "@/components/v2/CampusHero";
import { HighlightsCarousel, NextUpStrip } from "@/components/v2/CampusMotion";
import { pairHomeBlocks } from "@/components/v2/home-layout";
import { ButtonLink, EmptyState, Section, Wrap } from "@/components/v2/ui";
import { CommunityTile, FeedTile, MatchCard, NoticeRow, RecruitmentTile, ShowcaseTile } from "@/components/v2/cards";
import { Icon } from "@/components/v2/Icon";
import { emptyCopy, joinPathsCopy } from "@/components/v2/copy";
import { getT } from "@/lib/i18n/server";
import type { Locale, Translate } from "@/lib/i18n/locale";
import { defaultHomeSections } from "@/lib/v2/home-sections";
import { formatShort, todayLabel } from "@/components/v2/format";
import layout from "@/components/v2/layout.module.css";
import styles from "./home.module.css";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: { absolute: t("紫荆电竞 · 主场", "Zijing Esports · Home") } };
}

/** English for the built-in section titles; titles edited in the CMS are content and stay as entered. */
const sectionTitlesEn: Record<HomeSection["kind"], string> = {
  upcoming: "Coming up",
  open: "Open now",
  notices: "Club notices",
  promoted: "Club picks",
  communities: "Game communities",
  highlights: "Highlights",
  about: "About Zijing",
};
function sectionTitle(section: HomeSection, locale: Locale) {
  const fallback = defaultHomeSections.find((entry) => entry.kind === section.kind)?.title;
  return locale === "en" && section.title === fallback ? sectionTitlesEn[section.kind] ?? section.title : section.title;
}

function JoinPathsCard({ t }: { t: Translate }) {
  return (
    <div className={styles.joinCard}>
      <p className={styles.asideLabel}>{t("加入紫荆的三条路", "Three ways to join Zijing")}</p>
      <ol>
        {joinPathsCopy(t).map((path, index) => (
          <li key={path.key}>
            <span className={styles.joinIndex}>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <Link href={path.href}>{path.title}</Link>
              <p>{path.steps.join(" → ")}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Personal row: shortcuts for members, the three join paths for guests. Not a CMS block. */
function PersonalPanel({ home, t }: { home: HomeResponse; t: Translate }) {
  const { viewer } = home;
  if (viewer)
    return (
      <section className={`${layout.panel} ${styles.mePanel}`} aria-labelledby="me-title">
        <h2 id="me-title" className={layout.panelTitle}>
          {t(`你好，${viewer.name}`, `Hi, ${viewer.name}`)}
          <Link href="/account">{t("进入我的", "Go to Me")}</Link>
        </h2>
        <ul className={styles.quick}>
          <li>
            <Link href="/account#todo">
              <Icon name="bell" />
              {t("待办事项", "To-dos")}
              <strong>{home.me?.todo ?? 0}</strong>
            </Link>
          </li>
          <li>
            <Link href="/account#upcoming">
              <Icon name="ticket" />
              {t("我的赛程", "My schedule")}
              <strong>{home.me?.upcomingSignups ?? 0}</strong>
            </Link>
          </li>
          {viewer.affiliation === "tsinghua" && <li>
            <Link href="/teams/recruitment">
              <Icon name="trophy" />
              {t("代表队选拔与我的申请", "Team tryouts & my applications")}
            </Link>
          </li>}
          <li>
            <Link href={viewer.affiliation === "tsinghua" ? "/news" : "/announcements"}>
              <Icon name="news" />
              {viewer.affiliation === "tsinghua" ? t("全部动态", "All updates") : t("查看公告", "View notices")}
            </Link>
          </li>
        </ul>
      </section>
    );
  return (
    <section className={`${layout.panel} ${styles.joinPanel}`} aria-labelledby="join-title">
      <h2 id="join-title" className={layout.panelTitle}>
        {t("三步加入紫荆", "Join Zijing in three steps")}
        <Link href="/join">{t("了解全部", "Learn more")}</Link>
      </h2>
      <ol className={styles.joinSteps}>
        {joinPathsCopy(t).map((path) => (
          <li key={path.key}>
            <strong>{path.title}</strong>
            <p>{path.body}</p>
          </li>
        ))}
      </ol>
      <div className={styles.joinActions}>
        <ButtonLink href="/register" size="small">
          {t("注册账号", "Create account")}
        </ButtonLink>
        <ButtonLink href="/login" tone="ghost" size="small">
          {t("已有账号，登录", "Have an account? Sign in")}
        </ButtonLink>
      </div>
    </section>
  );
}

/** One CMS-configured block. Titles and order come from site settings; data visibility from the server. */
function HomeBlock({ section: raw, home, t, locale }: { section: HomeSection; home: HomeResponse; t: Translate; locale: Locale }): ReactNode {
  const { viewer } = home;
  const empty = emptyCopy(t);
  const section = { ...raw, title: sectionTitle(raw, locale) };
  switch (section.kind) {
    case "upcoming":
      return (
        <Section id="upcoming" title={section.title} more={{ href: "/events", label: t("完整日程", "Full schedule") }}>
          {home.upcoming.length ? (
            <div className={layout.rail}>
              {home.upcoming.map((event) => (
                <MatchCard key={event.key} event={event} variant="tile" />
              ))}
            </div>
          ) : (
            <EmptyState
              title={empty.weekEvents.title}
              actions={
                <>
                  <ButtonLink href="/events?signupOpen=1" tone="ghost" size="small">
                    {t("查看可报名活动", "Events open for sign-up")}
                  </ButtonLink>
                  {viewer && (
                    <ButtonLink href="/community" tone="ghost" size="small">
                      {t("浏览社群", "Browse communities")}
                    </ButtonLink>
                  )}
                </>
              }
            >
              {empty.weekEvents.body}
            </EmptyState>
          )}
        </Section>
      );
    case "open":
      if (!home.openCalls.length && !home.openSignups.length) return null;
      return (
        <Section
          id="open"
          title={section.title}
          description={t("报名开放的活动、骨干招新与代表队选拔，按截止时间排列。", "Events open for sign-up, staff recruitment and team tryouts, by deadline.")}
          more={
            viewer
              ? { href: "/teams/recruitment", label: t("选拔中心", "Tryouts") }
              : { href: "/events?signupOpen=1", label: t("可报名活动", "Open for sign-up") }
          }
        >
          <div className={layout.grid3}>
            {home.openCalls.map((call) => (
              <RecruitmentTile key={call.key} call={call} />
            ))}
            {home.openSignups.map((event) => (
              <MatchCard key={`open-${event.key}`} event={event} variant="tile" />
            ))}
          </div>
        </Section>
      );
    case "notices":
      return (
        <Section id="notices" title={section.title} more={home.notices.length ? { href: "/announcements", label: t("全部公告", "All notices") } : undefined}>
          {home.notices.length ? (
            <ul className={`${layout.list} ${layout.panel}`}>
              {home.notices.map((notice) => (
                <NoticeRow key={notice.key} article={notice} />
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>{empty.notices.body}</p>
          )}
        </Section>
      );
    case "promoted": {
      const { events, notices, showcases } = home.promoted;
      if (!events.length && !notices.length && !showcases?.length) return null;
      return (
        <Section id="promoted" title={section.title} description={t("经审核升推到社团主页的社群活动、通知与风采。", "Community events, notices and showcase posts promoted to the club home after review.")}>
          {events.length > 0 && (
            <div className={layout.grid3}>
              {events.map((event) => (
                <MatchCard key={`promoted-${event.key}`} event={event} variant="tile" />
              ))}
            </div>
          )}
          {notices.length > 0 && (
            <ul className={`${layout.list} ${layout.panel}`}>
              {notices.map((notice) => (
                <NoticeRow key={`promoted-${notice.key}`} article={notice} />
              ))}
            </ul>
          )}
          {showcases && showcases.length > 0 && (
            <div className={layout.grid3}>
              {showcases.map((item) => (
                <ShowcaseTile key={`promoted-${item.key}`} item={item} promoted />
              ))}
            </div>
          )}
        </Section>
      );
    }
    case "communities":
      if (!home.communities) return null;
      return (
        <Section id="communities" title={section.title} more={{ href: "/community", label: t("全部社群", "All communities") }}>
          {home.communities.length ? (
            <div className={layout.communities}>
              {home.communities.map((card) => (
                <CommunityTile key={card.community.id} card={card} />
              ))}
            </div>
          ) : (
            <EmptyState title={empty.communities.title} actions={<ButtonLink href="/community/apply" tone="ghost" size="small">{t("申请组织新社群", "Start a new community")}</ButtonLink>}>
              {empty.communities.body}
            </EmptyState>
          )}
        </Section>
      );
    case "highlights":
      if (!home.highlights?.length) return null;
      return (
        <Section id="highlights" title={section.title} description={t("最新荣誉、精选风采与社团影像。", "Latest honors, featured showcase posts and club galleries.")}
          more={{ href: "/news", label: t("全部动态", "All updates") }}
        >
          <HighlightsCarousel
            title={section.title}
            labels={home.highlights.map((item) => (item.kind === "honor" ? item.item.title || item.item.competition : item.item.title))}
            slides={home.highlights.map((item) => (
              <FeedTile key={item.item.key} item={item} promoted />
            ))}
          />
        </Section>
      );
    case "about": {
      return (
        <section className={styles.about} aria-labelledby="about-title">
          <div>
            <p className={styles.aboutKicker}>ABOUT ZIJING</p>
            <h2 id="about-title">{section.title}</h2>
            <p>{home.about?.excerpt ||
                t("清华大学学生紫荆电竞社，组织校园电竞活动、游戏社群与代表队。", "Tsinghua University's student esports club, running campus events, game communities and teams.")}</p>
          </div>
          <div className={styles.aboutLinks}>
            <ButtonLink href="/about" tone="accent" icon="arrow">
              {t("了解社团", "About the club")}
            </ButtonLink>
            <ButtonLink href="/contact" tone="stage">
              {t("联系与合作", "Contact & partner")}
            </ButtonLink>
          </div>
        </section>
      );
    }
    default:
      return null;
  }
}

export default async function Home() {
  const { t, locale } = await getT();
  const home = await read(getHome, {});
  const { site, viewer, spotlight } = home;
  const campus = viewer?.affiliation === "tsinghua";
  const title = site.heroTitle?.trim() || null;
  const ticker = home.upcoming
    .filter((event) => event.startAt)
    .map((event) => ({ key: event.key, href: event.href, text: `${formatShort(event.startAt)} · ${event.title}` }));

  const feature = spotlight ? (
    <div className={styles.spotlight}>
      <p className={styles.asideLabel}>
        <Icon name="spark" size={16} /> {t("焦点活动", "Spotlight")}
      </p>
      <MatchCard event={spotlight} variant="spotlight" headingLevel={2} eager />
    </div>
  ) : campus ? (
    <JoinPathsCard t={t} />
  ) : (
    <div className={styles.spotlight}>
      <p className={styles.asideLabel}>{t("校园电竞活动", "Campus esports events")}</p>
      <ButtonLink href="/events" tone="ghost">
        {t("浏览日程", "Browse schedule")}
      </ButtonLink>
    </div>
  );

  // CMS order, titles and visibility are kept; only blocks that render take part in the layout.
  const blocks = home.sections
    .filter((section) => section.enabled)
    .map((section) => ({ kind: section.kind, node: HomeBlock({ section, home, t, locale }) }))
    .filter((block) => block.node !== null && block.node !== undefined && block.node !== false);

  return (
    <>
      <CampusHero
        label={t("主场", "Home")}
        heroImage={site.heroImage}
        feature={feature}
        side={ticker.length ? <NextUpStrip items={ticker} /> : undefined}
      >
        <HeroKicker>
          <strong>MATCHDAY</strong>
          {t(`清华大学学生紫荆电竞社 · 今天 ${todayLabel(home.today)}`, `Tsinghua Zijing Esports Club · Today ${todayLabel(home.today, locale)}`)}
        </HeroKicker>
        <HeroTitle>
          {title ??
            (locale === "en" ? (
              <>
                Play at <em>Zijing</em>
              </>
            ) : (
              <>
                竞在<em>紫荆</em>
              </>
            ))}
        </HeroTitle>
        <HeroLead>
          {site.heroSubtitle ||
            (campus
              ? t(
                  "一起玩，认真赢。社团活动、游戏社群、代表队与骨干招新，都在这里开场。",
                  "Play together, win for real. Club events, game communities, teams and staff recruitment all kick off here.",
                )
              : t("查看紫荆电竞社的活动日程与公告。", "See the Zijing Esports Club schedule and notices."))}
        </HeroLead>
        <HeroActions>
          {viewer ? (
            <ButtonLink href="/events" tone="accent" icon="arrow">
              {t("查看日程", "View schedule")}
            </ButtonLink>
          ) : (
            <ButtonLink href="/join" tone="accent" icon="arrow">
              {t("加入紫荆", "Join Zijing")}
            </ButtonLink>
          )}
          {site.heroAction && (
            <ButtonLink href={site.heroAction.href} tone="stage">
              {site.heroAction.label}
            </ButtonLink>
          )}
          {!viewer && !site.heroAction && (
            <ButtonLink href="/events" tone="stage">
              {t("查看日程", "View schedule")}
            </ButtonLink>
          )}
          <ButtonLink href="/quiz" tone="stage">
            {t("竞猜与抽奖", "Quiz & prize draw")}
          </ButtonLink>
        </HeroActions>
        {home.me && (
          <ul className={styles.scoreboard} aria-label={t("我的主场", "My home")}>
            <li>
              <Link href="/account#todo">
                <span>{t("待办", "To-do")}</span>
                <strong>{home.me.todo}</strong>
              </Link>
            </li>
            <li>
              <Link href="/account#upcoming">
                <span>{t("已报名", "Signed up")}</span>
                <strong>{home.me.upcomingSignups}</strong>
              </Link>
            </li>
            {campus && <li>
              <Link href="/account#manage">
                <span>{t("待审核", "To review")}</span>
                <strong>{home.me.reviewPending}</strong>
              </Link>
            </li>}
          </ul>
        )}
      </CampusHero>

      <Wrap>
        <div className={styles.personal}>
          {(viewer || campus) && <PersonalPanel home={home} t={t} />}
        </div>
        {pairHomeBlocks(blocks).map((row) => (
          <div key={row.map((block) => block.kind).join("+")} className={row.length === 2 ? styles.pair : undefined}>
            {row.map((block) => (
              <div key={block.kind} data-section={block.kind} className={styles.block}>
                {block.node}
              </div>
            ))}
          </div>
        ))}
      </Wrap>
    </>
  );
}
