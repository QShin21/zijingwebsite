import Link from "next/link";
import type { CollectionSlug, Where } from "payload";
import { cms, site, list, names, fixed, type Content } from "@/lib/content";
import { publicHref, sectionMeta } from "@/lib/presentation";
import { Icon } from "@/components/Identity";
import { Picture, Prose } from "@/components/Content";
import { designBase, SectionHeading, EmptyState, DemoTag } from "./DesignUI";
import { PromotedContent } from "@/components/PromotedContent";
import { promotedContent } from "@/lib/content-promotions";
import { StaffRecruitmentNotice } from "@/components/StaffRecruitmentNotice";
import { routeFor, eventState } from "@/lib/rules";
import { DateStamp, HomeEntries, stateTone } from "./HomeSections";
import { CourtMotif } from "./CourtMotif";
import styles from "./Home.module.css";

const defaults = [
  "events",
  "join",
  "news",
  "teams",
  "honors",
  "albums",
  "about",
];
const folio = (value: number) => String(value).padStart(2, "0");
/** The masthead dateline is the request date in Beijing time, not an issue number. */
function dateline(now = new Date()) {
  return {
    label: new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(now),
    iso: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now),
  };
}
type HomeModule = {
  kind: string;
  title?: string | null;
  docs: Content[];
  about: Content | null;
};
export async function FieldHome({
  preview = false,
}: { preview?: boolean } = {}) {
  const [s, games, promotedEvents] = await Promise.all([
    site(),
    list("games", {}, 1, 6),
    cms().then((p) => promotedContent(p, "event")),
  ]);
  const seen = new Set<string>();
  const modules = (
    s.modules?.length
      ? s.modules
      : defaults.map((kind) => ({ kind, enabled: true, title: undefined }))
  ).filter((m) => {
    if (
      !m.enabled ||
      seen.has(m.kind) ||
      ![...Object.keys(sectionMeta), "join", "about"].includes(m.kind)
    )
      return false;
    seen.add(m.kind);
    return true;
  });
  const data: HomeModule[] = await Promise.all(
    modules.map(async (m) => {
      if (m.kind === "join")
        return { ...m, docs: [] as Content[], about: null };
      if (m.kind === "about")
        return { ...m, docs: [] as Content[], about: await fixed("about") };
      const conditions: Where[] = [{ archived: { not_equals: true } }];
      const featured =
        m.kind === "events"
          ? s.featuredEvents
          : m.kind === "honors"
            ? s.featuredHonors
            : null;
      if (featured?.length)
        conditions.push({
          id: { in: featured.map((x) => (typeof x === "number" ? x : x.id)) },
        });
      let result = await list(
        m.kind as CollectionSlug,
        { and: conditions },
        1,
        m.kind === "events" ? 4 : 3,
      );
      if (!result.docs.length && featured?.length)
        result = await list(
          m.kind as CollectionSlug,
          { archived: { not_equals: true } },
          1,
          3,
        );
      return { ...m, docs: result.docs, about: null };
    }),
  );
  const lead = data.find((m) => m.kind === "events")?.docs[0];
  const leadHref = lead
    ? preview
      ? `${designBase}/activity/${lead.id}`
      : `/events/${lead.slug}`
    : "";
  const communityHref = preview ? designBase + "/apply" : "/community/apply";
  const today = dateline();
  // Same visibility rules as before: a missing dataset never becomes a
  // promotional placeholder or a fabricated statistic.
  const chapters = data.filter((m) =>
    m.kind === "join"
      ? true
      : m.kind === "about"
        ? Boolean(m.about)
        : m.docs.length > 0 || m.kind === "events",
  );
  const [first, ...rest] = chapters;
  const communityNumber = first ? 2 : 1;
  const renderChapter = (m: HomeModule, number: number) => {
    if (m.kind === "join")
      return (
        <section
          className={styles.participation}
          key={m.kind}
          data-section={m.kind}
        >
          <div className={styles.sectionIntro}>
            <p className={styles.chapterMark}>
              <span className={styles.chapterNumber} aria-hidden="true">
                {folio(number)}
              </span>
              参与紫荆
            </p>
            <h2>{m.title || "找到适合你的参与方式"}</h2>
            <p>
              认识同好、并肩比赛，或一起把活动办起来。每种参与都有清楚的入口与流程。
            </p>
          </div>
          <div className={styles.participationLinks}>
            {[
              [
                "/join/members",
                "加入游戏社群",
                "联系管理员，由管理员人工拉入微信群",
              ],
              [
                "/teams/recruitment",
                "报名代表队",
                "查看选拔要求与当前招新批次",
              ],
              [
                "/join/staff",
                "参与骨干招新",
                "了解职责，提交申请并查看本人回执",
              ],
            ].map(([href, title, note]) => (
              <Link className="hc-arrow" href={href} key={href}>
                <div>
                  <h3>{title}</h3>
                  <p>{note}</p>
                </div>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </section>
      );
    if (m.kind === "about")
      return m.about ? (
        <section className={styles.about} key={m.kind} data-section={m.kind}>
          <SectionHeading
            index={folio(number)}
            title={m.title || "关于紫荆"}
            href="/about"
            action="了解社团"
          />
          <div className={styles.aboutBody}>
            <Prose doc={m.about} />
          </div>
        </section>
      ) : null;
    return (
      <section
        className={styles.section}
        key={m.kind}
        data-section={m.kind}
        data-kind={m.kind}
      >
        <SectionHeading
          index={folio(number)}
          title={m.title || (m.kind === "events" ? "活动日程" : names[m.kind])}
          href={"/" + routeFor[m.kind]}
          action={m.kind === "events" ? "全部活动" : "查看全部"}
        />
        <HomeEntries
          docs={m.docs}
          kind={m.kind}
          games={games.docs}
          preview={preview}
        />
        {m.kind === "events" && (
          <PromotedContent kind="event" items={promotedEvents} />
        )}
        {!m.docs.length && !(m.kind === "events" && promotedEvents.length) && (
          <EmptyState
            title="下一场活动，敬请期待"
            description="活动发布后，这里会列出时间、参与方式与报名入口。"
            href="/events"
            action="查看活动列表"
          />
        )}
      </section>
    );
  };
  return (
    <div className={styles.home}>
      <section
        className={`${styles.stage} hc-stage`}
        aria-labelledby="home-title"
      >
        <div className={styles.stageBar}>
          <p>{s.name}</p>
          <p>
            今日主场 · <time dateTime={today.iso}>{today.label}</time>
          </p>
        </div>
        <div className={styles.stageBody}>
          <div className={styles.stageCopy}>
            <p className="hc-kicker">紫荆主场</p>
            <h1 id="home-title">{s.heroTitle || "竞在紫荆"}</h1>
            <p className={styles.stageLead}>
              {s.heroSubtitle ||
                "在游戏社群里找到队友，在活动与比赛中一起上场。把共同的热爱，变成校园里的相遇。"}
            </p>
            <div className={styles.stageActions}>
              <Link className="z-button" href="/community">
                寻找游戏社群 <Icon name="arrow" />
              </Link>
              <Link className="z-text-link" href="/events">
                看看有什么活动 <Icon name="diagonal" />
              </Link>
              {s.heroButtonURL &&
                publicHref(s.heroButtonURL, "/community") !== "/community" && (
                  <Link
                    className="z-text-link"
                    href={publicHref(s.heroButtonURL, "/join")}
                  >
                    {s.heroButtonLabel || "了解参与方式"}
                    <Icon name="diagonal" />
                  </Link>
                )}
            </div>
          </div>
          <div className={styles.stageVisual}>
            <CourtMotif className={styles.stageCourt} />
            {s.heroImage ? (
              <figure className={styles.stagePhoto}>
                <Picture
                  id={
                    typeof s.heroImage === "number"
                      ? s.heroImage
                      : s.heroImage.id
                  }
                  priority
                />
                <figcaption>{s.name} · 社团影像</figcaption>
              </figure>
            ) : (
              <aside
                className={styles.ticket}
                aria-label={lead ? "活动速览" : "社群参与方式"}
              >
                <div className={styles.ticketTop}>
                  <span>{lead ? "活动速览" : "找到同好，一起上场"}</span>
                  <Icon name={lead ? "calendar" : "arrow"} />
                </div>
                {lead ? (
                  <>
                    <div className={styles.ticketDate}>
                      <DateStamp value={lead.startAt} />
                      <span
                        className={styles.state}
                        data-tone={stateTone(eventState(lead))}
                      >
                        {eventState(lead)}
                      </span>
                    </div>
                    <div className={styles.ticketBody}>
                      <DemoTag demo={lead.demo} />
                      <h2>
                        <Link href={leadHref}>{lead.title}</Link>
                      </h2>
                      <p>
                        {lead.summary || "查看活动安排、参与条件与报名方式。"}
                      </p>
                      {lead.location && (
                        <p className={styles.meta}>地点 / {lead.location}</p>
                      )}
                    </div>
                    <Link
                      className={`${styles.ticketAction} hc-arrow`}
                      href={leadHref}
                    >
                      查看活动与报名 <Icon name="arrow" />
                    </Link>
                  </>
                ) : (
                  <>
                    <div className={styles.ticketBody}>
                      <h2>
                        从一场游戏，
                        <br />
                        到一群伙伴。
                      </h2>
                      <p>
                        在社群里交流，在赛场上并肩。先找到你喜欢的游戏，再联系社群管理员。
                      </p>
                    </div>
                    <Link
                      className={`${styles.ticketAction} hc-arrow`}
                      href="/community"
                    >
                      浏览游戏社群 <Icon name="arrow" />
                    </Link>
                  </>
                )}
              </aside>
            )}
          </div>
        </div>
        <nav className={styles.stageRoutes} aria-label="参与入口">
          <Link className="hc-arrow" href="/community">
            社群交流 <Icon name="diagonal" />
          </Link>
          <Link className="hc-arrow" href="/teams/recruitment">
            代表队招新 <Icon name="diagonal" />
          </Link>
          <Link className="hc-arrow" href="/account">
            我的事务 <Icon name="diagonal" />
          </Link>
        </nav>
      </section>
      <div className={styles.notices}>
        <StaffRecruitmentNotice home />
      </div>
      {first && renderChapter(first, 1)}
      {!modules.some((m) => m.kind === "events") && (
        <PromotedContent kind="event" items={promotedEvents} />
      )}
      <section className={styles.communitySection} id="communities">
        <div className={styles.sectionIntro}>
          <p className={styles.chapterMark}>
            <span className={styles.chapterNumber} aria-hidden="true">
              {folio(communityNumber)}
            </span>
            游戏社群
          </p>
          <h2>找到你的游戏社群</h2>
          <p>
            从熟悉的游戏开始，认识下一位队友。查看社群介绍，联系管理员，申请加入微信群。
          </p>
          <div className={styles.introLinks}>
            <Link className="z-text-link" href="/community">
              所有游戏社群 <Icon name="arrow" />
            </Link>
            <Link className={styles.secondaryLink} href={communityHref}>
              发起新社群申请 <Icon name="diagonal" />
            </Link>
          </div>
        </div>
        <div className={styles.communityGrid}>
          {games.docs.map((g) => (
            <Link
              className={`${styles.communityCard} hc-arrow`}
              href={(preview ? designBase : "") + "/community/" + g.slug}
              key={g.id}
            >
              <div>
                <DemoTag demo={g.demo} />
                <h3>{g.title}</h3>
                <p>{g.summary || "了解社群，查看联系管理员的方式。"}</p>
              </div>
              <Icon name="arrow" />
            </Link>
          ))}
          {!games.docs.length && (
            <EmptyState
              title="社群列表暂待更新"
              description="获批并公开的游戏社群会在这里展示。"
              href={communityHref}
              action="了解新社群申请"
            />
          )}
        </div>
      </section>
      <div className={styles.promoted}>
        <PromotedContent kind="notice" />
        <PromotedContent kind="showcase" />
      </div>
      {rest.map((m, index) => renderChapter(m, communityNumber + 1 + index))}
    </div>
  );
}
