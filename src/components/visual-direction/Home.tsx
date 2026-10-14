import Link from "next/link";
import type { CollectionSlug, Where } from "payload";
import { site, list, names, fixed, type Content } from "@/lib/content";
import { publicHref, sectionMeta } from "@/lib/presentation";
import { Icon } from "@/components/Identity";
import { Picture, Prose } from "@/components/Content";
import { designBase, SectionHeading, EmptyState, DemoTag } from "./DesignUI";
import { PromotedContent } from "@/components/PromotedContent";
import { StaffRecruitmentNotice } from "@/components/StaffRecruitmentNotice";
import { routeFor, eventState } from "@/lib/rules";
import { DateStamp, HomeEntries } from "./HomeSections";
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
export async function FieldHome({
  preview = false,
}: { preview?: boolean } = {}) {
  const [s, games] = await Promise.all([site(), list("games", {}, 1, 6)]);
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
  const data = await Promise.all(
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
  const communityHref = preview ? designBase + "/apply" : "/community/apply";
  const contentSections = data
    .map((m) => {
      if (m.kind === "join")
        return (
          <section
            className={styles.participation}
            key={m.kind}
            data-section={m.kind}
          >
            <div className={styles.sectionIntro}>
              <p className={styles.sectionLabel}>参与紫荆</p>
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
                <Link href={href} key={href}>
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
              title={m.title || "关于紫荆"}
              href="/about"
              action="了解社团"
            />
            <Prose doc={m.about} />
          </section>
        ) : null;
      // A missing dataset does not become a promotional placeholder or fabricated statistic.
      if (!m.docs.length && m.kind !== "events") return null;
      return (
        <section className={styles.section} key={m.kind} data-section={m.kind}>
          <SectionHeading
            title={
              m.title || (m.kind === "events" ? "活动日程" : names[m.kind])
            }
            href={"/" + routeFor[m.kind]}
            action={m.kind === "events" ? "全部活动" : "查看全部"}
          />
          <HomeEntries
            docs={m.docs}
            kind={m.kind}
            games={games.docs}
            preview={preview}
          />
          {!m.docs.length && (
            <EmptyState
              title="下一场活动，敬请期待"
              description="活动发布后，这里会列出时间、参与方式与报名入口。"
              href="/events"
              action="查看活动列表"
            />
          )}
        </section>
      );
    })
    .filter(Boolean);
  return (
    <div className={styles.home}>
      <section className={styles.cover} aria-labelledby="home-title">
        <div className={styles.coverCopy}>
          <p className={styles.sectionLabel}>{s.name}</p>
          <h1 id="home-title">{s.heroTitle || "竞在紫荆"}</h1>
          <p className={styles.coverDescription}>
            {s.heroSubtitle ||
              "在游戏社群里找到队友，在活动与比赛中一起上场。把共同的热爱，变成校园里的相遇。"}
          </p>
          <div className={styles.coverActions}>
            <Link className="z-button" href="/community">
              寻找游戏社群 <Icon name="arrow" />
            </Link>
            <Link className="z-text-link" href="/events">
              看看有什么活动 <Icon name="diagonal" />
            </Link>
          </div>
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
          <nav className={styles.coverRoutes} aria-label="参与入口">
            <Link href="/community">
              社群交流 <Icon name="diagonal" />
            </Link>
            <Link href="/teams/recruitment">
              代表队招新 <Icon name="diagonal" />
            </Link>
            <Link href="/account">
              我的事务 <Icon name="diagonal" />
            </Link>
          </nav>
        </div>
        {s.heroImage ? (
          <figure className={styles.coverPhoto}>
            <Picture
              id={
                typeof s.heroImage === "number" ? s.heroImage : s.heroImage.id
              }
              priority
            />
            <figcaption>{s.name} · 社团影像</figcaption>
          </figure>
        ) : (
          <aside
            className={styles.coverStory}
            aria-label={lead ? "活动速览" : "社群参与方式"}
          >
            <div className={styles.coverTop}>
              <span>{lead ? "活动速览" : "找到同好，一起上场"}</span>
              <Icon name={lead ? "calendar" : "arrow"} />
            </div>
            {lead ? (
              <>
                <div className={styles.coverDate}>
                  <DateStamp value={lead.startAt} />
                  <span className={styles.state}>{eventState(lead)}</span>
                </div>
                <DemoTag demo={lead.demo} />
                <h2>
                  <Link
                    href={
                      preview
                        ? `${designBase}/activity/${lead.id}`
                        : `/events/${lead.slug}`
                    }
                  >
                    {lead.title}
                  </Link>
                </h2>
                <p>{lead.summary || "查看活动安排、参与条件与报名方式。"}</p>
                {lead.location && (
                  <p className={styles.meta}>地点 / {lead.location}</p>
                )}
                <Link
                  className={styles.coverAction}
                  href={
                    preview
                      ? `${designBase}/activity/${lead.id}`
                      : `/events/${lead.slug}`
                  }
                >
                  查看活动与报名 <Icon name="arrow" />
                </Link>
              </>
            ) : (
              <>
                <h2>
                  从一场游戏，
                  <br />
                  到一群伙伴。
                </h2>
                <p>
                  在社群里交流，在赛场上并肩。先找到你喜欢的游戏，再联系社群管理员。
                </p>
                <Link className={styles.coverAction} href="/community">
                  浏览游戏社群 <Icon name="arrow" />
                </Link>
              </>
            )}
          </aside>
        )}
      </section>
      <div className={styles.notices}>
        <StaffRecruitmentNotice home />
      </div>
      {contentSections[0]}
      <section className={styles.communitySection} id="communities">
        <div className={styles.sectionIntro}>
          <p className={styles.sectionLabel}>游戏社群</p>
          <h2>找到你的游戏社群</h2>
          <p>
            从熟悉的游戏开始，认识下一位队友。查看社群介绍，联系管理员，申请加入微信群。
          </p>
          <Link className="z-text-link" href="/community">
            所有游戏社群 <Icon name="arrow" />
          </Link>
          <Link className={styles.secondaryLink} href={communityHref}>
            发起新社群申请 <Icon name="diagonal" />
          </Link>
        </div>
        <div className={styles.communityRows}>
          {games.docs.map((g) => (
            <Link
              className={styles.communityRow}
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
        <PromotedContent kind="event" />
        <PromotedContent kind="notice" />
        <PromotedContent kind="showcase" />
      </div>
      {contentSections.slice(1)}
    </div>
  );
}
