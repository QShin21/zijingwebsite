import Link from "next/link";
import type { ReactNode } from "react";
import { getHome, type HomeResponse, type HomeSection } from "@/lib/v2";
import { read } from "@/components/v2/data";
import { artAsset } from "@/components/v2/art";
import { Stage, StageActions, StageKicker, StageLead, StageTitle, Ticker } from "@/components/v2/Stage";
import { ButtonLink, EmptyState, Img, Section, Wrap } from "@/components/v2/ui";
import { CommunityTile, FeedTile, MatchCard, NoticeRow, RecruitmentTile, ShowcaseTile } from "@/components/v2/cards";
import { Icon } from "@/components/v2/Icon";
import { empty, joinPaths } from "@/components/v2/copy";
import { formatShort, todayLabel } from "@/components/v2/format";
import layout from "@/components/v2/layout.module.css";
import styles from "./home.module.css";

export const metadata = { title: { absolute: "紫荆电竞 · 主场" } };

function JoinPathsCard() {
  return (
    <div className={styles.joinCard}>
      <p className={styles.asideLabel}>加入紫荆的三条路</p>
      <ol>
        {joinPaths.map((path, index) => (
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
function PersonalPanel({ home }: { home: HomeResponse }) {
  const { viewer } = home;
  if (viewer)
    return (
      <section className={`${layout.panel} ${styles.mePanel}`} aria-labelledby="me-title">
        <h2 id="me-title" className={layout.panelTitle}>
          你好，{viewer.name}
          <Link href="/account">进入我的</Link>
        </h2>
        <ul className={styles.quick}>
          <li>
            <Link href="/account#todo">
              <Icon name="bell" />
              待办事项
              <strong>{home.me?.todo ?? 0}</strong>
            </Link>
          </li>
          <li>
            <Link href="/account#upcoming">
              <Icon name="ticket" />
              我的赛程
              <strong>{home.me?.upcomingSignups ?? 0}</strong>
            </Link>
          </li>
          <li>
            <Link href="/teams/recruitment">
              <Icon name="trophy" />
              代表队选拔与我的申请
            </Link>
          </li>
          <li>
            <Link href="/news">
              <Icon name="news" />
              全部动态
            </Link>
          </li>
        </ul>
      </section>
    );
  return (
    <section className={`${layout.panel} ${styles.joinPanel}`} aria-labelledby="join-title">
      <h2 id="join-title" className={layout.panelTitle}>
        三步加入紫荆
        <Link href="/join">了解全部</Link>
      </h2>
      <ol className={styles.joinSteps}>
        {joinPaths.map((path) => (
          <li key={path.key}>
            <strong>{path.title}</strong>
            <p>{path.body}</p>
          </li>
        ))}
      </ol>
      <div className={styles.joinActions}>
        <ButtonLink href="/register" size="small">
          注册账号
        </ButtonLink>
        <ButtonLink href="/login" tone="ghost" size="small">
          已有账号，登录
        </ButtonLink>
      </div>
    </section>
  );
}

/** One CMS-configured block. Titles and order come from site settings; data visibility from the server. */
function HomeBlock({ section, home }: { section: HomeSection; home: HomeResponse }): ReactNode {
  const { viewer } = home;
  switch (section.kind) {
    case "upcoming":
      return (
        <Section id="upcoming" title={section.title} more={{ href: "/events", label: "完整日程" }}>
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
                    查看可报名活动
                  </ButtonLink>
                  {viewer && (
                    <ButtonLink href="/community" tone="ghost" size="small">
                      浏览社群
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
          description="报名开放的活动、骨干招新与代表队选拔，按截止时间排列。"
          more={viewer ? { href: "/teams/recruitment", label: "选拔中心" } : { href: "/events?signupOpen=1", label: "可报名活动" }}
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
        <Section id="notices" title={section.title} more={home.notices.length ? { href: "/announcements", label: "全部公告" } : undefined}>
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
        <Section id="promoted" title={section.title} description="经审核升推到社团主页的社群活动、通知与风采。">
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
        <Section id="communities" title={section.title} more={{ href: "/community", label: "全部社群" }}>
          {home.communities.length ? (
            <div className={layout.communities}>
              {home.communities.map((card) => (
                <CommunityTile key={card.community.id} card={card} />
              ))}
            </div>
          ) : (
            <EmptyState title={empty.communities.title} actions={<ButtonLink href="/community/apply" tone="ghost" size="small">申请组织新社群</ButtonLink>}>
              {empty.communities.body}
            </EmptyState>
          )}
        </Section>
      );
    case "highlights":
      if (!home.highlights?.length) return null;
      return (
        <Section id="highlights" title={section.title} description="最新荣誉、精选风采与社团影像。" more={{ href: "/news", label: "全部动态" }}>
          <div className={`${layout.mosaic} ${styles.highlights}`}>
            {home.highlights.map((item) => (
              <FeedTile key={item.item.key} item={item} promoted />
            ))}
          </div>
        </Section>
      );
    case "about": {
      const art = artAsset("monolith-detail.webp");
      return (
        <section className={styles.about} aria-labelledby="about-title">
          {art && <span className={styles.aboutArt} aria-hidden="true" style={{ backgroundImage: `url(${art})` }} />}
          <div>
            <p className={styles.aboutKicker}>ABOUT ZIJING</p>
            <h2 id="about-title">{section.title}</h2>
            <p>{home.about?.excerpt || "清华大学学生紫荆电竞社，组织校园电竞活动、游戏社群与代表队。"}</p>
          </div>
          <div className={styles.aboutLinks}>
            <ButtonLink href="/about" tone="accent" icon="arrow">
              了解社团
            </ButtonLink>
            <ButtonLink href="/contact" tone="stage">
              联系与合作
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
  const home = await read(getHome, {});
  const { site, viewer, spotlight } = home;
  const title = site.heroTitle?.trim() || null;
  const ticker = home.upcoming
    .filter((event) => event.startAt)
    .map((event) => ({ key: event.key, text: `${formatShort(event.startAt)} · ${event.title}` }));

  const aside = site.heroImage ? (
    <figure className={styles.heroImage}>
      <Img image={site.heroImage} eager sizes="(min-width: 1024px) 40vw, 100vw" />
    </figure>
  ) : spotlight ? (
    <div className={styles.spotlight}>
      <p className={styles.asideLabel}>
        <Icon name="spark" size={16} /> 焦点活动
      </p>
      <MatchCard event={spotlight} variant="spotlight" headingLevel={2} eager />
    </div>
  ) : (
    <JoinPathsCard />
  );

  return (
    <>
      <Stage label="主场" aside={aside} ticker={ticker.length > 1 ? <Ticker label="NEXT UP" items={ticker} /> : undefined}>
        <StageKicker>
          <strong>MATCHDAY</strong>
          清华大学学生紫荆电竞社 · 今天 {todayLabel(home.today)}
        </StageKicker>
        <StageTitle>
          {title ?? (
            <>
              竞在<em>紫荆</em>
            </>
          )}
        </StageTitle>
        <StageLead>{site.heroSubtitle || "一起玩，认真赢。社团活动、游戏社群、代表队与骨干招新，都在这里开场。"}</StageLead>
        <StageActions>
          {viewer ? (
            <ButtonLink href="/events" tone="accent" icon="arrow">
              查看日程
            </ButtonLink>
          ) : (
            <ButtonLink href="/join" tone="accent" icon="arrow">
              加入紫荆
            </ButtonLink>
          )}
          {site.heroAction && (
            <ButtonLink href={site.heroAction.href} tone="stage">
              {site.heroAction.label}
            </ButtonLink>
          )}
          {!viewer && !site.heroAction && (
            <ButtonLink href="/events" tone="stage">
              查看日程
            </ButtonLink>
          )}
        </StageActions>
        {home.me && (
          <ul className={styles.scoreboard} aria-label="我的主场">
            <li>
              <Link href="/account#todo">
                <span>待办</span>
                <strong>{home.me.todo}</strong>
              </Link>
            </li>
            <li>
              <Link href="/account#upcoming">
                <span>已报名</span>
                <strong>{home.me.upcomingSignups}</strong>
              </Link>
            </li>
            <li>
              <Link href="/account#manage">
                <span>待审核</span>
                <strong>{home.me.reviewPending}</strong>
              </Link>
            </li>
          </ul>
        )}
      </Stage>

      <Wrap>
        {site.heroImage && spotlight && (
          <Section id="spotlight" title="焦点活动">
            <MatchCard event={spotlight} variant="row" headingLevel={3} />
          </Section>
        )}
        <div className={styles.personal}>
          <PersonalPanel home={home} />
        </div>
        {home.sections
          .filter((section) => section.enabled)
          .map((section) => (
            <div key={section.kind} data-section={section.kind}>
              <HomeBlock section={section} home={home} />
            </div>
          ))}
      </Wrap>
    </>
  );
}
