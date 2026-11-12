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

export function Empty({
  text,
  collection,
}: {
  text?: string;
  collection?: string;
}) {
  const copy: Record<string, [string, string, IconName]> = {
    events: [
      "暂无活动安排",
      "确认后的活动时间与报名方式会在这里发布。",
      "calendar",
    ],
    teams: ["代表队档案正在整理", "项目介绍与赛季信息将在确认后公开。", "team"],
    honors: ["暂无公开荣誉", "经核实的赛事成绩将在这里归档。", "trophy"],
    news: ["暂无社团动态", "社团公告与活动回顾将在这里更新。", "layers"],
    albums: ["暂无公开影像", "获准公开的社团照片将在这里发布。", "camera"],
    recruitment: [
      "暂未发布匹配的招新批次",
      "后续招新安排与报名渠道将在确认后公布。",
      "team",
    ],
    announcements: ["暂无通知", "社团通知确认后将在这里发布。", "layers"],
  };
  const entry = copy[collection || ""] || [
    "内容正在整理",
    "确认后的公开资料会在这里更新。",
    "layers",
  ];
  return (
    <div className={styles.empty}>
      <Icon name={entry[2] as IconName} />
      <div>
        <h3>{text || entry[0]}</h3>
        {!text && <p>{entry[1]}</p>}
        <Link href="/events">浏览社团活动 →</Link>
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
export function JoinCards({ selected }: { selected?: string } = {}) {
  const items: {
    key: string;
    title: string;
    desc: string;
    next: string;
    icon: IconName;
  }[] = [
    {
      key: "members",
      title: "加入游戏社群",
      desc: "寻找同好，了解活动。通过社群联系入口添加管理员微信，由管理员人工拉群。",
      next: "了解普通入社",
      icon: "team",
    },
    {
      key: "teams",
      title: "参加代表队选拔",
      desc: "查看各项目招新与训练安排，提交入队资料，等待社群管理员人工选拔。",
      next: "了解代表队选拔",
      icon: "target",
    },
    {
      key: "staff",
      title: "参与骨干工作",
      desc: "了解执行与宣传方向，选择批次提交申请，查看自己的选拔结果。",
      next: "查看骨干招新",
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
          const state = publicTeamState(metadata.get(doc.id), doc.archived);
          return (
            <article className={styles.teamEntry} key={doc.id}>
              <div className={styles.teamEntryIdentity}>
                {game && (
                  <Link href={`/community/${game.slug}`}>{game.title}</Link>
                )}
                {state && <span className={styles.status}>{state}</span>}
                {doc.demo && <span>演示资料</span>}
              </div>
              <div className={styles.teamEntryBody}>
                <Heading>
                  <Link href={`/teams/${doc.slug}`}>{doc.title}</Link>
                </Heading>
                {doc.summary && <p>{doc.summary}</p>}
                <div className={styles.entryActions}>
                  <Link href={`/teams/${doc.slug}`}>查看队伍</Link>
                  <Link href={`/teams/honors?team=${doc.id}`}>队伍荣誉</Link>
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
              <span>{doc.type || "社团动态"}</span>
              {publishedAt && (
                <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
              )}
              {doc.archived && <span>历史归档</span>}
              {doc.demo && <span>演示资料</span>}
            </div>
            <Heading>
              <Link href={`/news/${doc.slug}`}>{doc.title}</Link>
            </Heading>
            {doc.summary && <p>{doc.summary}</p>}
            <Link
              className={styles.storyRead}
              href={`/news/${doc.slug}`}
              aria-label={`阅读${doc.title}`}
            >
              阅读全文
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
                  {new Intl.DateTimeFormat("zh-CN", {
                    year: "numeric",
                    timeZone: "Asia/Shanghai",
                  }).format(new Date(doc.date))}
                </time>
              )}
              {doc.demo && <span>演示资料</span>}
              {doc.archived && <span>历史归档</span>}
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
                查看成果记录
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
        const label =
          collection === "events"
            ? eventState(doc)
            : kindLabels[doc.kind || ""] ||
              doc.type ||
              names[collection] ||
              "紫荆电竞";
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
                {doc.demo && <span>演示资料</span>}
                {doc.archived && <span>历史归档</span>}
                {doc.date && <span>{formatDate(doc.date)}</span>}
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
                    ? registrationState(doc)
                    : doc.startAt
                      ? formatDate(doc.startAt)
                      : doc.competition ||
                        (collection === "teams" ? "代表队档案" : "")}
                </span>
                <Link href={href} aria-label={`查看${doc.title}`}>
                  查看详情 ↗
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
  const state = registrationState(doc);
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
    const teamState = publicTeamState(metadata?.get(doc.id), doc.archived);
    const hasIntroduction = Boolean(doc.body || doc.sections?.length);
    return (
      <div data-collection="teams">
        <PageHero
          tone="stage"
          eyebrow={linkedGame?.title || "代表队档案"}
          title={doc.title}
          description={doc.summary}
          back={{ href: "/teams", label: "代表队与荣誉" }}
          meta={
            <>
              {teamState && <StatusPill tone="success">{teamState}</StatusPill>}
              {doc.demo && <StatusPill tone="warning">演示资料 · 非真实社团记录</StatusPill>}
              {linkedGame && (
                <Link className={styles.heroLink} href={`/community/${linkedGame.slug}`}>
                  所属社群：{linkedGame.title}
                </Link>
              )}
            </>
          }
        />
        <Wrap className={`${layout.pageBody} ${styles.teamArchive}`}>
        <nav className={styles.sectionIndex} aria-label="代表队档案栏目">
          {hasIntroduction && <a href="#team-introduction">队伍介绍</a>}
          <a href="#public-members">公开成员</a>
          <a href="#team-honors">队伍荣誉</a>
          {history[0].docs.length > 0 && <a href="#team-history">赛季档案</a>}
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
                <h2>队伍介绍</h2>
                <Prose doc={doc} />
              </section>
            ) : (
              <div className={styles.teamBrief}>
                <h2>认识队伍，了解共同经历</h2>
                <p>
                  下方收录成员自选公开的简介与已批准荣誉。入队要求和开放时间请查看招新批次。
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
            <h2 id="team-participation-title">加入与参与</h2>
            <p>
              查看招新要求与时间，提交自己的入队申请，再到回执查看人工选拔结果。
            </p>
            <Link className="button" href="/teams/recruitment">
              查看代表队招新与我的记录
            </Link>
            <div className={styles.participationLinks}>
              <Link href={`/teams/honors?team=${doc.id}`}>
                队伍荣誉档案与投稿
              </Link>
              {linkedGame && (
                <Link href={`/community/${linkedGame.slug}`}>联系所属社群</Link>
              )}
              {managesTeam && (
                <Link href={`/teams/manage/${doc.id}`}>本队工作台</Link>
              )}
            </div>
            <p className={styles.smallNote}>
              入队资格以已批准的成员关系为准，公开阵容和简介不授管理权限。
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
              <h2 id="team-roster-title">档案中的公开阵容</h2>
              <p>按队伍档案保存的名单展示，当前在队资格以成员记录为准。</p>
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
              <h2 id="legacy-honors-title">历史荣誉记录</h2>
              <p>继续查阅此前归档的赛事成果。</p>
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
              <h2 id="season-title">赛季档案</h2>
            </div>
            <nav className={styles.seasonNav} aria-label="赛季导航">
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
              <h2 id="team-events-title">队伍相关活动</h2>
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
        eyebrow={doc.demo ? "演示资料 · 非真实社团记录" : collection === "news" ? "社团动态" : names[collection] || "内容预览"}
        title={doc.title}
        description={doc.summary}
        back={{ href: routeFor[collection] ? `/${routeFor[collection]}` : "/account", label: names[collection] || "档案" }}
        meta={
          <>
            {doc.archived && <StatusPill>历史归档</StatusPill>}
            {collection === "events" && <StatusPill tone="info">{eventState(doc)}</StatusPill>}
            {collection === "recruitment" && <StatusPill tone={state === "报名开放" ? "live" : "neutral"}>{state}</StatusPill>}
            {collection === "news" && <StatusPill>{doc._status === "published" ? "社团公开内容" : "内容预览"}</StatusPill>}
            {publishedAt && <time className={styles.heroMeta} dateTime={publishedAt}>发布于 {formatDate(publishedAt)}</time>}
            {(doc.date || doc.startAt) && <span className={styles.heroMeta}>时间 · {formatDate(doc.date || doc.startAt)}</span>}
            {doc.competition && <span className={styles.heroMeta}>{doc.competition}</span>}
            {linkedGame && (
              <Link className={styles.heroLink} href={`/community/${linkedGame.slug}`}>
                所属社群：{linkedGame.title}
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
              <h2>公开阵容</h2>
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
              <p className={styles.eyebrow}>岗位职责与要求</p>
              <h2>{p.name}</h2>
              <p>{p.duties}</p>
              <p>{p.requirements}</p>
              <p>{p.commitment}</p>
              <p>{p.arrangement}</p>
            </section>
          ))}
          {collection === "albums" && (
            <>
              {!doc.photos?.length && <Empty text="暂无获准公开的照片。" />}
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
                <h2>活动回顾</h2>
                <Cards docs={related[0].docs} collection="news" />
              </section>
              <section>
                <h2>活动相册</h2>
                <Cards docs={related[1].docs} collection="albums" />
              </section>
            </>
          )}
        </div>
        <aside className={styles.sidebar}>
          {(linkedTeam || linkedEvent) && (
            <div className={styles.panel}>
              <p className={styles.eyebrow}>相关内容</p>
              <h2>相关档案</h2>
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
              <p className={styles.eyebrow}>时间与地点</p>
              <h2>活动信息</h2>
              <p className={styles.status}>{eventState(doc)}</p>
              <dl>
                <dt>开始</dt>
                <dd>{formatDate(doc.startAt)}</dd>
                <dt>结束</dt>
                <dd>{formatDate(doc.endAt)}</dd>
                <dt>地点</dt>
                <dd>{doc.location || "待公布"}</dd>
              </dl>
            </div>
          )}
          {collection === "events" && (
            <ActivitySignup kind="events" id={doc.id} />
          )}
          {(collection === "recruitment" ||
            (collection === "events" && !doc.signupForm?.enabled)) && (
            <div className={styles.panel}>
              <p className={styles.eyebrow}>参与方式</p>
              <h2>{state}</h2>
              <p className="preserve">{doc.requirements}</p>
              <p>开始：{formatDate(doc.registrationStart)}</p>
              <p>
                截止：
                {doc.registrationEnd
                  ? formatDate(doc.registrationEnd)
                  : "未设定"}
              </p>
              {state === "报名开放" && (
                <>
                  {safeURL(doc.registrationURL) && (
                    <a
                      className="button light"
                      aria-label="前往外部报名 ↗"
                      href={doc.registrationURL!}
                      rel="noopener noreferrer"
                    >
                      前往外部报名 <Icon name="diagonal" />
                    </a>
                  )}
                  {doc.channelText && (
                    <p className="preserve">{doc.channelText}</p>
                  )}
                  <Picture id={doc.qrCode} />
                  <p className="meta">
                    报名由外部平台受理，请以外部平台提示为准。
                  </p>
                </>
              )}
              {doc.contact && <p>联系：{doc.contact}</p>}
              {doc.channelCheckedAt && (
                <p className="meta">
                  渠道核验：{formatDate(doc.channelCheckedAt)}
                </p>
              )}
            </div>
          )}
          {collection === "honors" && (
            <div className={styles.panel}>
              <Icon name="trophy" />
              <h2>荣誉信息</h2>
              <p>{doc.competition}</p>
              <p className={styles.placing}>
                {[doc.division, doc.placing].filter(Boolean).join(" · ")}
              </p>
              <p>{formatDate(doc.date)}</p>
              {safeURL(doc.sourceURL) && (
                <a
                  className="text-link"
                  href={doc.sourceURL}
                  rel="noopener noreferrer"
                >
                  查看公开来源 <Icon name="diagonal" />
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
export function Pagination({
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
  const href = (p: number) =>
    `${path}?${new URLSearchParams({ ...query, page: String(p) })}`;
  return (
    <nav className={styles.pagination} aria-label="分页">
      {page > 1 ? (
        <Link href={href(page - 1)}>← 上一页</Link>
      ) : (
        <span aria-disabled="true">← 上一页</span>
      )}
      <span>
        第 <strong>{page}</strong> / {total} 页
      </span>
      {page < total ? (
        <Link href={href(page + 1)}>下一页 →</Link>
      ) : (
        <span aria-disabled="true">下一页 →</span>
      )}
    </nav>
  );
}
