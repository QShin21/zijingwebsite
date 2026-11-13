import { ActivitySignup } from "./ActivitySignup";
import { PublicationImages } from "./PublicationImages";
import { publicationImages } from "@/lib/publication-images";
import { TeamProfilesPanel } from "./team-profiles/TeamProfilesPanel";
import { TeamHonorsPanel } from "./TeamHonorsPanel";
import {
  publicTeamMeta,
  publicTeamState,
} from "./reading-pages/public-reading-meta";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { cms, list, media, names, type Content } from "@/lib/content";
import { canManageTeam } from "@/lib/team-memberships";
import {
  eventState,
  formatDate,
  registrationState,
  routeFor,
  safeURL,
} from "@/lib/rules";
import { kindLabels } from "@/lib/presentation";
import { Icon, type IconName } from "./Identity";
import { PageHero, StatusPill, Wrap } from "./v2/ui";
import layout from "./v2/layout.module.css";
import styles from "./account-pages/ReadingPages.module.css";
import { getT } from "@/lib/i18n/server";
import { PageStatus } from "./v2/LocalText";
import type { Locale } from "@/lib/i18n/locale";
import { eventStateLabel, publicLabel, signupStateLabel } from "@/lib/i18n/labels-public";

/** formatDate from lib/rules in Chinese; the same Beijing-time style in English. */
export function formatWhen(value: string | null | undefined, locale: Locale) {
  if (locale !== "en") return formatDate(value);
  return value
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "TBA";
}

export async function Empty({
  text,
  collection,
}: {
  text?: string;
  collection?: string;
}) {
  const { t } = await getT();
  const copy: Record<string, [string, string, IconName]> = {
    events: [
      t("暂无活动安排", "No events scheduled"),
      t("确认后的活动时间与报名方式会在这里发布。", "Confirmed event times and sign-up details will be posted here."),
      "calendar",
    ],
    teams: [t("代表队档案正在整理", "Team archives are being prepared"), t("项目介绍与赛季信息将在确认后公开。", "Team and season details will be published once confirmed."), "team"],
    honors: [t("暂无公开荣誉", "No public honors yet"), t("经核实的赛事成绩将在这里归档。", "Verified competition results will be archived here."), "trophy"],
    news: [t("暂无社团动态", "No club updates yet"), t("社团公告与活动回顾将在这里更新。", "Club notices and event recaps will appear here."), "layers"],
    albums: [t("暂无公开影像", "No public galleries yet"), t("获准公开的社团照片将在这里发布。", "Approved club photos will be posted here."), "camera"],
    recruitment: [
      t("暂未发布匹配的招新批次", "No matching recruitment rounds"),
      t("后续招新安排与报名渠道将在确认后公布。", "Upcoming recruitment and sign-up channels will be announced once confirmed."),
      "team",
    ],
    announcements: [t("暂无通知", "No notices yet"), t("社团通知确认后将在这里发布。", "Club notices will be posted here once confirmed."), "layers"],
  };
  const entry = copy[collection || ""] || [
    t("内容正在整理", "Content is being prepared"),
    t("确认后的公开资料会在这里更新。", "Confirmed public information will appear here."),
    "layers",
  ];
  return (
    <div className={styles.empty}>
      <Icon name={entry[2] as IconName} />
      <div>
        <h3>{text || entry[0]}</h3>
        {!text && <p>{entry[1]}</p>}
        <Link href="/events">{t("浏览社团活动 →", "Browse club events →")}</Link>
      </div>
    </div>
  );
}
export async function Picture({
  id,
  priority = false,
  fallback = null,
}: {
  id?: number | null;
  priority?: boolean;
  fallback?: ReactNode;
}) {
  const image = await media(id);
  if (!image?.url) return fallback;
  const card = image.sizes?.card;
  const src = priority ? image.url : card?.url || image.url;
  const srcSet =
    card?.url && card.width && image.width && image.width > card.width
      ? `${card.url} ${card.width}w, ${image.url} ${image.width}w`
      : undefined;
  return (
    <img
      className="picture"
      src={src}
      srcSet={srcSet}
      sizes={
        srcSet
          ? "(max-width: 700px) 100vw, (max-width: 1080px) 50vw, 800px"
          : undefined
      }
      alt={image.alt || ""}
      width={(priority ? image.width : card?.width) || image.width || 800}
      height={(priority ? image.height : card?.height) || image.height || 600}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
export function Prose({ doc }: { doc: Content }) {
  return (
    <div className={styles.prose}>
      {doc.body && (
        <RichText
          data={doc.body}
          converters={({ defaultConverters }) => ({
            ...defaultConverters,
            link: ({ node, nodesToJSX }) => {
              const href = node.fields?.url;
              return safeURL(href) ? (
                <a href={href} rel="noopener noreferrer">
                  {nodesToJSX({ nodes: node.children })}
                </a>
              ) : (
                <span>{nodesToJSX({ nodes: node.children })}</span>
              );
            },
          })}
        />
      )}
      <PublicationImages images={publicationImages(doc.postImages)} />
      {doc.sections?.map((s, i) => (
        <section id={`content-${doc.id}-section-${i}`} key={i}>
          <h2>{s.heading}</h2>
          <p className="preserve">{s.text}</p>
        </section>
      ))}
    </div>
  );
}
export async function JoinCards({ selected }: { selected?: string } = {}) {
  const { t } = await getT();
  const items: {
    key: string;
    title: string;
    desc: string;
    next: string;
    icon: IconName;
  }[] = [
    {
      key: "members",
      title: t("加入游戏社群", "Join a game community"),
      desc: t(
        "寻找同好，了解活动。通过社群联系入口添加管理员微信，由管理员人工拉群。",
        "Find fellow players and events. Add an admin on WeChat through the community contacts; admins invite you to the group.",
      ),
      next: t("了解普通入社", "How to join"),
      icon: "team",
    },
    {
      key: "teams",
      title: t("参加代表队选拔", "Try out for a team"),
      desc: t(
        "查看各项目招新与训练安排，提交入队资料，等待社群管理员人工选拔。",
        "See each game's recruitment and training plans, apply, and wait for community admins to select players.",
      ),
      next: t("了解代表队选拔", "About team tryouts"),
      icon: "target",
    },
    {
      key: "staff",
      title: t("参与骨干工作", "Join the staff"),
      desc: t(
        "了解执行与宣传方向，选择批次提交申请，查看自己的选拔结果。",
        "Learn about the operations and publicity roles, apply in an open round and check your result.",
      ),
      next: t("查看骨干招新", "View staff recruitment"),
      icon: "layers",
    },
  ];
  return (
    <div className={styles.joinGrid}>
      {items.map((item) => (
        <Link
          className={styles.joinCard}
          href={`/join/${item.key}`}
          key={item.key}
          aria-current={selected === item.key ? "page" : undefined}
        >
          <h3>{item.title}</h3>
          <p>{item.desc}</p>
          <span>{item.next}</span>
        </Link>
      ))}
    </div>
  );
}
export async function Cards({
  docs,
  collection,
  games,
  headingLevel = 3,
}: {
  docs: Content[];
  collection: string;
  games?: Content[];
  headingLevel?: 2 | 3;
}) {
  if (!docs.length) return <Empty collection={collection} />;
  const { t, locale } = await getT();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  if (collection === "teams") {
    const metadata = await publicTeamMeta(docs.map((doc) => doc.id));
    const gameIDs = [
      ...new Set(docs.flatMap((doc) => (doc.game ? [doc.game] : []))),
    ];
    const publicGames =
      games ||
      (gameIDs.length
        ? (await list("games", { id: { in: gameIDs } }, 1, gameIDs.length)).docs
        : []);
    const gameByID = new Map(publicGames.map((game) => [game.id, game]));
    return (
      <div className={styles.teamDirectory}>
        {docs.map((doc) => {
          const game = doc.game ? gameByID.get(doc.game) : undefined;
          const state = publicTeamState(metadata.get(doc.id), doc.archived, locale);
          return (
            <article className={styles.teamEntry} key={doc.id}>
              <div className={styles.teamEntryIdentity}>
                {game && (
                  <Link href={`/community/${game.slug}`}>{game.title}</Link>
                )}
                {state && <span className={styles.status}>{state}</span>}
                {doc.demo && <span>{t("演示资料", "Demo content")}</span>}
              </div>
              <div className={styles.teamEntryBody}>
                <Heading>
                  <Link href={`/teams/${doc.slug}`}>{doc.title}</Link>
                </Heading>
                {doc.summary && <p>{doc.summary}</p>}
                <div className={styles.entryActions}>
                  <Link href={`/teams/${doc.slug}`}>{t("查看队伍", "View team")}</Link>
                  <Link href={`/teams/honors?team=${doc.id}`}>{t("队伍荣誉", "Team honors")}</Link>
                </div>
              </div>
              {doc.cover && (
                <Link
                  className={styles.teamEntryImage}
                  href={`/teams/${doc.slug}`}
                  tabIndex={-1}
                  aria-label={doc.title}
                >
                  <Picture id={doc.cover} />
                </Link>
              )}
            </article>
          );
        })}
      </div>
    );
  }
  if (collection === "news") {
    const story = (doc: Content, lead = false) => {
      const publishedAt = doc.publishedAt;
      return (
        <article
          className={lead ? styles.storyLead : styles.storyItem}
          key={doc.id}
        >
          {lead && doc.cover && (
            <Link
              className={styles.storyImage}
              href={`/news/${doc.slug}`}
              tabIndex={-1}
              aria-label={doc.title}
            >
              <Picture id={doc.cover} />
            </Link>
          )}
          <div className={styles.storyContent}>
            <div className={styles.cardMeta}>
              <span>{doc.type ? publicLabel(doc.type, locale) : t("社团动态", "Club update")}</span>
              {publishedAt && (
                <time dateTime={publishedAt}>{formatWhen(publishedAt, locale)}</time>
              )}
              {doc.archived && <span>{t("历史归档", "Archived")}</span>}
              {doc.demo && <span>{t("演示资料", "Demo content")}</span>}
            </div>
            <Heading>
              <Link href={`/news/${doc.slug}`}>{doc.title}</Link>
            </Heading>
            {doc.summary && <p>{doc.summary}</p>}
            <Link
              className={styles.storyRead}
              href={`/news/${doc.slug}`}
              aria-label={t(`阅读${doc.title}`, `Read ${doc.title}`)}
            >
              {t("阅读全文", "Read more")}
            </Link>
          </div>
        </article>
      );
    };
    return (
      <div className={styles.newsIndex}>
        <div
          className={styles.newsOpening}
          data-single={docs.length === 1 || undefined}
        >
          {story(docs[0], true)}
          {docs.length > 1 && (
            <div className={styles.newsSecondary}>
              {docs.slice(1, 4).map((doc) => story(doc))}
            </div>
          )}
        </div>
        {docs.length > 4 && (
          <div className={styles.newsMore}>
            {docs.slice(4).map((doc) => story(doc))}
          </div>
        )}
      </div>
    );
  }
  if (collection === "honors") {
    return (
      <div className={styles.honorIndex}>
        {docs.map((doc) => (
          <article className={styles.honorEntry} key={doc.id}>
            <div className={styles.honorDate}>
              {doc.date && (
                <time dateTime={doc.date}>
                  {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "zh-CN", {
                    year: "numeric",
                    timeZone: "Asia/Shanghai",
                  }).format(new Date(doc.date))}
                </time>
              )}
              {doc.demo && <span>{t("演示资料", "Demo content")}</span>}
              {doc.archived && <span>{t("历史归档", "Archived")}</span>}
            </div>
            <div>
              {doc.competition && (
                <p className={styles.honorCompetition}>{doc.competition}</p>
              )}
              <Heading>
                <Link href={`/honors/${doc.slug}`}>{doc.title}</Link>
              </Heading>
              {doc.placing && (
                <p className={styles.placing}>
                  {[doc.division, doc.placing].filter(Boolean).join(" · ")}
                </p>
              )}
              {doc.summary && (
                <p className={styles.cardSummary}>{doc.summary}</p>
              )}
              <Link className={styles.storyRead} href={`/honors/${doc.slug}`}>
                {t("查看成果记录", "View result")}
              </Link>
            </div>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.cards} data-collection={collection}>
      {docs.map((doc) => {
        const href = `/${routeFor[collection]}/${doc.slug}`;
        const label = publicLabel(
          collection === "events"
            ? eventState(doc)
            : kindLabels[doc.kind || ""] ||
              doc.type ||
              names[collection] ||
              "紫荆电竞", // i18n-exempt: fallback label mapped by publicLabel
          locale,
        );
        return (
          <article className={styles.card} key={doc.id}>
            {doc.cover && collection !== "honors" && (
              <Link
                className={styles.cardImage}
                href={href}
                aria-label={doc.title}
                tabIndex={-1}
              >
                <Picture id={doc.cover} />
              </Link>
            )}
            <div className={styles.cardBody}>
              <div className={styles.cardMeta}>
                <span className={styles.cardLabel}>{label}</span>
                {doc.demo && <span>{t("演示资料", "Demo content")}</span>}
                {doc.archived && <span>{t("历史归档", "Archived")}</span>}
                {doc.date && <span>{formatWhen(doc.date, locale)}</span>}
              </div>
              {collection === "honors" && doc.placing && (
                <p className={styles.placing}>
                  {[doc.division, doc.placing].filter(Boolean).join(" · ")}
                </p>
              )}
              <Heading>
                <Link href={href}>{doc.title}</Link>
              </Heading>
              {doc.summary && (
                <p className={styles.cardSummary}>{doc.summary}</p>
              )}
              <div className={styles.cardBottom}>
                <span>
                  {collection === "recruitment"
                    ? publicLabel(registrationState(doc), locale)
                    : doc.startAt
                      ? formatWhen(doc.startAt, locale)
                      : doc.competition ||
                        (collection === "teams" ? t("代表队档案", "Team archive") : "")}
                </span>
                <Link href={href} aria-label={t(`查看${doc.title}`, `View ${doc.title}`)}>
                  {t("查看详情 ↗", "Details ↗")}
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
export async function Detail({
  doc,
  collection,
  photoPage = 1,
}: {
  doc: Content;
  collection: string;
  photoPage?: number;
}) {
  const { t, locale } = await getT();
  const state = registrationState(doc);
  const stateText = signupStateLabel("", state, locale);
  const eventText = eventStateLabel("", eventState(doc), locale);
  const teamContext =
    collection === "teams"
      ? await (async () => {
          const payload = await cms();
          const { user } = await payload.auth({ headers: await headers() });
          return { payload, user };
        })()
      : null;
  const managesTeam = teamContext
    ? await canManageTeam(teamContext.payload, teamContext.user, doc.id)
    : false;
  const [
    linkedTeam,
    linkedEvent,
    linkedSeason,
    related,
    history,
    linkedGame,
    metadata,
  ] = await Promise.all([
    doc.team
      ? list("teams", { id: { equals: doc.team } }, 1, 1).then((r) => r.docs[0])
      : null,
    doc.event
      ? list("events", { id: { equals: doc.event } }, 1, 1).then(
          (r) => r.docs[0],
        )
      : null,
    doc.season
      ? list("seasons", { id: { equals: doc.season } }, 1, 1).then(
          (r) => r.docs[0],
        )
      : null,
    collection === "events"
      ? Promise.all([
          list("news", { event: { equals: doc.id } }),
          list("albums", { event: { equals: doc.id } }),
        ])
      : null,
    collection === "teams"
      ? Promise.all([
          list("seasons", { team: { equals: doc.id } }, 1, 100),
          list("honors", { team: { equals: doc.id } }),
          list("events", { team: { equals: doc.id } }),
        ])
      : null,
    doc.game
      ? list("games", { id: { equals: doc.game } }, 1, 1).then(
          (result) => result.docs[0],
        )
      : null,
    collection === "teams" ? publicTeamMeta([doc.id]) : null,
  ]);
  if (collection === "teams" && teamContext && history) {
    const teamState = publicTeamState(metadata?.get(doc.id), doc.archived, locale);
    const hasIntroduction = Boolean(doc.body || doc.sections?.length);
    return (
      <div data-collection="teams">
        <PageHero
          tone="stage"
          eyebrow={linkedGame?.title || t("代表队档案", "Team archive")}
          title={doc.title}
          description={doc.summary}
          back={{ href: "/teams", label: t("代表队与荣誉", "Teams & honors") }}
          meta={
            <>
              {teamState && <StatusPill tone="success">{teamState}</StatusPill>}
              {doc.demo && <StatusPill tone="warning">{t("演示资料 · 非真实社团记录", "Demo content · not a real club record")}</StatusPill>}
              {linkedGame && (
                <Link className={styles.heroLink} href={`/community/${linkedGame.slug}`}>
                  {t("所属社群：", "Community: ")}
                  {linkedGame.title}
                </Link>
              )}
            </>
          }
        />
        <Wrap className={`${layout.pageBody} ${styles.teamArchive}`}>
        <nav className={styles.sectionIndex} aria-label={t("代表队档案栏目", "Team archive sections")}>
          {hasIntroduction && <a href="#team-introduction">{t("队伍介绍", "About the team")}</a>}
          <a href="#public-members">{t("公开成员", "Public members")}</a>
          <a href="#team-honors">{t("队伍荣誉", "Team honors")}</a>
          {history[0].docs.length > 0 && <a href="#team-history">{t("赛季档案", "Season archive")}</a>}
        </nav>
        <div className={styles.teamOverview}>
          <div className={styles.teamIntroduction}>
            {doc.cover && (
              <div className={styles.teamCover}>
                <Picture id={doc.cover} priority />
              </div>
            )}
            {hasIntroduction ? (
              <section id="team-introduction">
                <h2>{t("队伍介绍", "About the team")}</h2>
                <Prose doc={doc} />
              </section>
            ) : (
              <div className={styles.teamBrief}>
                <h2>{t("认识队伍，了解共同经历", "Meet the team and its story")}</h2>
                <p>
                  {t(
                    "下方收录成员自选公开的简介与已批准荣誉。入队要求和开放时间请查看招新批次。",
                    "Below are profiles members chose to make public and approved honors. See the recruitment rounds for requirements and dates.",
                  )}
                </p>
              </div>
            )}
            {doc.positions?.map((position, index) => (
              <section className={styles.position} key={index}>
                <h3>{position.name}</h3>
                {[
                  position.duties,
                  position.requirements,
                  position.commitment,
                  position.arrangement,
                ]
                  .filter(Boolean)
                  .map((text, item) => (
                    <p key={item}>{text}</p>
                  ))}
              </section>
            ))}
          </div>
          <aside
            className={styles.teamParticipation}
            aria-labelledby="team-participation-title"
          >
            <h2 id="team-participation-title">{t("加入与参与", "Join & take part")}</h2>
            <p>
              {t(
                "查看招新要求与时间，提交自己的入队申请，再到回执查看人工选拔结果。",
                "Check the requirements and dates, submit your application, then follow the selection result on your receipt.",
              )}
            </p>
            <Link className="button" href="/teams/recruitment">
              {t("查看代表队招新与我的记录", "Team recruitment & my records")}
            </Link>
            <div className={styles.participationLinks}>
              <Link href={`/teams/honors?team=${doc.id}`}>
                {t("队伍荣誉档案与投稿", "Team honors & submissions")}
              </Link>
              {linkedGame && (
                <Link href={`/community/${linkedGame.slug}`}>{t("联系所属社群", "Contact the community")}</Link>
              )}
              {managesTeam && (
                <Link href={`/teams/manage/${doc.id}`}>{t("本队工作台", "Team workspace")}</Link>
              )}
            </div>
            <p className={styles.smallNote}>
              {t(
                "入队资格以已批准的成员关系为准，公开阵容和简介不授管理权限。",
                "Membership follows approved member records; public rosters and profiles grant no management rights.",
              )}
            </p>
          </aside>
        </div>
        <div id="public-members" className={styles.archiveSection}>
          <TeamProfilesPanel teamID={doc.id} />
        </div>
        {Boolean(doc.members?.length) && (
          <section
            className={styles.archiveSection}
            aria-labelledby="team-roster-title"
          >
            <div className={styles.archiveHeading}>
              <h2 id="team-roster-title">{t("档案中的公开阵容", "Archived public roster")}</h2>
              <p>{t("按队伍档案保存的名单展示，当前在队资格以成员记录为准。", "Shown as saved in the team archive; current membership follows member records.")}</p>
            </div>
            <ul className={styles.roster}>
              {doc.members?.map((member, index) => (
                <li key={index}>
                  <strong>{member.displayName}</strong>
                  {member.position && <span>{member.position}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div id="team-honors" className={styles.archiveSection}>
          <TeamHonorsPanel
            payload={teamContext.payload}
            user={teamContext.user}
            view="public"
            team={doc.id}
          />
        </div>
        {history[1].docs.length > 0 && (
          <section
            className={styles.archiveSection}
            aria-labelledby="legacy-honors-title"
          >
            <div className={styles.archiveHeading}>
              <h2 id="legacy-honors-title">{t("历史荣誉记录", "Past honors")}</h2>
              <p>{t("继续查阅此前归档的赛事成果。", "Browse previously archived competition results.")}</p>
            </div>
            <Cards docs={history[1].docs} collection="honors" />
          </section>
        )}
        {history[0].docs.length > 0 && (
          <section
            id="team-history"
            className={styles.archiveSection}
            aria-labelledby="season-title"
          >
            <div className={styles.archiveHeading}>
              <h2 id="season-title">{t("赛季档案", "Season archive")}</h2>
            </div>
            <nav className={styles.seasonNav} aria-label={t("赛季导航", "Seasons")}>
              {history[0].docs.map((season) => (
                <a href={`#season-${season.id}`} key={season.id}>
                  {season.title}
                </a>
              ))}
            </nav>
            <div className={styles.seasonList}>
              {history[0].docs.map((season) => (
                <article
                  className={styles.seasonEntry}
                  id={`season-${season.id}`}
                  key={season.id}
                >
                  <h3>{season.title}</h3>
                  <div>
                    <Prose doc={season} />
                    <ul className={styles.roster}>
                      {season.members?.map((member, index) => (
                        <li key={index}>
                          <strong>{member.displayName}</strong>
                          {member.position && <span>{member.position}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {history[2].docs.length > 0 && (
          <section
            className={styles.archiveSection}
            aria-labelledby="team-events-title"
          >
            <div className={styles.archiveHeading}>
              <h2 id="team-events-title">{t("队伍相关活动", "Team events")}</h2>
            </div>
            <Cards docs={history[2].docs} collection="events" />
          </section>
        )}
        </Wrap>
      </div>
    );
  }
  const publishedAt = doc.publishedAt;
  return (
    <div data-collection={collection}>
      <PageHero
        tone="stage"
        eyebrow={
          doc.demo
            ? t("演示资料 · 非真实社团记录", "Demo content · not a real club record")
            : collection === "news"
              ? t("社团动态", "Club update")
              : names[collection]
                ? publicLabel(names[collection], locale)
                : t("内容预览", "Content preview")
        }
        title={doc.title}
        description={doc.summary}
        back={{ href: routeFor[collection] ? `/${routeFor[collection]}` : "/account", label: names[collection] ? publicLabel(names[collection], locale) : t("档案", "Archive") }}
        meta={
          <>
            {doc.archived && <StatusPill>{t("历史归档", "Archived")}</StatusPill>}
            {collection === "events" && <StatusPill tone="info">{eventText}</StatusPill>}
            {collection === "recruitment" && <StatusPill tone={state === "报名开放" ? "live" : "neutral"}>{stateText}</StatusPill>}
            {collection === "news" && <StatusPill>{doc._status === "published" ? t("社团公开内容", "Public club content") : t("内容预览", "Content preview")}</StatusPill>}
            {publishedAt && (
              <time className={styles.heroMeta} dateTime={publishedAt}>
                {t(`发布于 ${formatDate(publishedAt)}`, `Published ${formatWhen(publishedAt, locale)}`)}
              </time>
            )}
            {(doc.date || doc.startAt) && (
              <span className={styles.heroMeta}>{t(`时间 · ${formatDate(doc.date || doc.startAt)}`, `Time · ${formatWhen(doc.date || doc.startAt, locale)}`)}</span>
            )}
            {doc.competition && <span className={styles.heroMeta}>{doc.competition}</span>}
            {linkedGame && (
              <Link className={styles.heroLink} href={`/community/${linkedGame.slug}`}>
                {t("所属社群：", "Community: ")}
                {linkedGame.title}
              </Link>
            )}
          </>
        }
      />
      <Wrap className={`${layout.pageBody} ${styles.contentDetail}`}>
      {doc.cover && (
        <div className={styles.cover}>
          <Picture id={doc.cover} priority />
        </div>
      )}
      <div
        className={styles.detailLayout}
        data-sidebar={Boolean(
          linkedTeam ||
            linkedEvent ||
            ["events", "recruitment", "honors"].includes(collection),
        )}
      >
        <div className={styles.detailMain}>
          <Prose doc={doc} />
          {Boolean(doc.members?.length) && (
            <section>
              <h2>{t("公开阵容", "Public roster")}</h2>
              <ul className={styles.roster}>
                {doc.members?.map((m, i) => (
                  <li key={i}>
                    <strong>{m.displayName}</strong>
                    <span>{m.position}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {doc.positions?.map((p, i) => (
            <section className={styles.panel} key={i}>
              <p className={styles.eyebrow}>{t("岗位职责与要求", "Duties & requirements")}</p>
              <h2>{p.name}</h2>
              <p>{p.duties}</p>
              <p>{p.requirements}</p>
              <p>{p.commitment}</p>
              <p>{p.arrangement}</p>
            </section>
          ))}
          {collection === "albums" && (
            <>
              {!doc.photos?.length && <Empty text={t("暂无获准公开的照片。", "No photos approved for public viewing yet.")} />}
              <div className={styles.photos}>
                {doc.photos
                  ?.slice((photoPage - 1) * 12, photoPage * 12)
                  .map((p, i) => (
                    <figure key={i}>
                      <Picture id={p.image} />
                      <figcaption>{p.caption}</figcaption>
                    </figure>
                  ))}
              </div>
              <Pagination
                page={photoPage}
                total={Math.ceil((doc.photos?.length || 0) / 12)}
                path={`/gallery/${doc.slug}`}
              />
            </>
          )}
          {related && (
            <>
              <section>
                <h2>{t("活动回顾", "Recaps")}</h2>
                <Cards docs={related[0].docs} collection="news" />
              </section>
              <section>
                <h2>{t("活动相册", "Albums")}</h2>
                <Cards docs={related[1].docs} collection="albums" />
              </section>
            </>
          )}
        </div>
        <aside className={styles.sidebar}>
          {(linkedTeam || linkedEvent) && (
            <div className={styles.panel}>
              <p className={styles.eyebrow}>{t("相关内容", "Related")}</p>
              <h2>{t("相关档案", "Related records")}</h2>
              {linkedTeam && (
                <p>
                  <Link href={`/teams/${linkedTeam.slug}`}>
                    {linkedTeam.title} ↗
                  </Link>
                </p>
              )}
              {linkedSeason && linkedTeam && (
                <p>
                  <Link
                    href={`/teams/${linkedTeam.slug}#season-${linkedSeason.id}`}
                  >
                    {linkedSeason.title} ↗
                  </Link>
                </p>
              )}
              {linkedEvent && (
                <p>
                  <Link href={`/events/${linkedEvent.slug}`}>
                    {linkedEvent.title} ↗
                  </Link>
                </p>
              )}
            </div>
          )}
          {collection === "events" && (
            <div className={styles.panel}>
              <p className={styles.eyebrow}>{t("时间与地点", "Time & place")}</p>
              <h2>{t("活动信息", "Event info")}</h2>
              <p className={styles.status}>{eventText}</p>
              <dl>
                <dt>{t("开始", "Starts")}</dt>
                <dd>{formatWhen(doc.startAt, locale)}</dd>
                <dt>{t("结束", "Ends")}</dt>
                <dd>{formatWhen(doc.endAt, locale)}</dd>
                <dt>{t("地点", "Location")}</dt>
                <dd>{doc.location || t("待公布", "TBA")}</dd>
              </dl>
            </div>
          )}
          {collection === "events" && (
            <ActivitySignup kind="events" id={doc.id} />
          )}
          {(collection === "recruitment" ||
            (collection === "events" && !doc.signupForm?.enabled)) && (
            <div className={styles.panel}>
              <p className={styles.eyebrow}>{t("参与方式", "How to join")}</p>
              <h2>{stateText}</h2>
              <p className="preserve">{doc.requirements}</p>
              <p>{t(`开始：${formatDate(doc.registrationStart)}`, `Opens: ${formatWhen(doc.registrationStart, locale)}`)}</p>
              <p>
                {t("截止：", "Closes: ")}
                {doc.registrationEnd
                  ? formatWhen(doc.registrationEnd, locale)
                  : t("未设定", "Not set")}
              </p>
              {state === "报名开放" && (
                <>
                  {safeURL(doc.registrationURL) && (
                    <a
                      className="button light"
                      aria-label={t("前往外部报名 ↗", "Sign up externally ↗")}
                      href={doc.registrationURL!}
                      rel="noopener noreferrer"
                    >
                      {t("前往外部报名", "Sign up externally")} <Icon name="diagonal" />
                    </a>
                  )}
                  {doc.channelText && (
                    <p className="preserve">{doc.channelText}</p>
                  )}
                  <Picture id={doc.qrCode} />
                  <p className="meta">
                    {t("报名由外部平台受理，请以外部平台提示为准。", "Sign-up is handled by an external platform; follow its instructions.")}
                  </p>
                </>
              )}
              {doc.contact && (
                <p>
                  {t("联系：", "Contact: ")}
                  {doc.contact}
                </p>
              )}
              {doc.channelCheckedAt && (
                <p className="meta">
                  {t(`渠道核验：${formatDate(doc.channelCheckedAt)}`, `Channel verified: ${formatWhen(doc.channelCheckedAt, locale)}`)}
                </p>
              )}
            </div>
          )}
          {collection === "honors" && (
            <div className={styles.panel}>
              <Icon name="trophy" />
              <h2>{t("荣誉信息", "Honor details")}</h2>
              <p>{doc.competition}</p>
              <p className={styles.placing}>
                {[doc.division, doc.placing].filter(Boolean).join(" · ")}
              </p>
              <p>{formatWhen(doc.date, locale)}</p>
              {safeURL(doc.sourceURL) && (
                <a
                  className="text-link"
                  href={doc.sourceURL}
                  rel="noopener noreferrer"
                >
                  {t("查看公开来源", "View public source")} <Icon name="diagonal" />
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
      </Wrap>
    </div>
  );
}
export async function Pagination({
  page,
  total,
  path,
  query = {},
}: {
  page: number;
  total: number;
  path: string;
  query?: Record<string, string>;
}) {
  if (total <= 1) return null;
  const { t } = await getT();
  const href = (p: number) =>
    `${path}?${new URLSearchParams({ ...query, page: String(p) })}`;
  return (
    <nav className={styles.pagination} aria-label={t("分页", "Pagination")}>
      {page > 1 ? (
        <Link href={href(page - 1)}>{t("← 上一页", "← Previous")}</Link>
      ) : (
        <span aria-disabled="true">{t("← 上一页", "← Previous")}</span>
      )}
      <span>
        <PageStatus page={page} totalPages={total} />
      </span>
      {page < total ? (
        <Link href={href(page + 1)}>{t("下一页 →", "Next →")}</Link>
      ) : (
        <span aria-disabled="true">{t("下一页 →", "Next →")}</span>
      )}
    </nav>
  );
}
