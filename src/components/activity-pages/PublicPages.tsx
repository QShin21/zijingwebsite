import type { Metadata } from "next";
import type { Where } from "payload";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { bySlug, cms, list, type Content } from "@/lib/content";
import { communityEventPage } from "@/lib/community-event-list";
import { Pagination, Picture } from "@/components/Content";
import { dateParts } from "@/lib/presentation";
import { eventState, formatDate, routeFor } from "@/lib/rules";
import styles from "./ActivityPages.module.css";
import { ActivityDetail } from "./ActivityDetail";
import { registrationSummary } from "./registration-summary";
import { formatWhen } from "@/components/Content";
import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/locale";
import { eventStateLabel, publicLabel, signupStateLabel } from "@/lib/i18n/labels-public";

export type PageCollection = "events" | "announcements" | "albums";
export type Query = Record<string, string | string[] | undefined>;
// i18n-exempt: CMS select option values (query and filter values); labels via publicLabel
const eventTypes = ["比赛", "观赛", "交流", "训练", "其他"];
const copy = (t: Translate) => ({
  events: {
    title: t("活动", "Events"),
    headline: t("活动日程", "Event schedule"),
    description: t(
      "浏览站点活动和社团精选活动，或按游戏项目查看已发布的活动。",
      "Browse site and featured club events, or filter published events by game.",
    ),
    empty: t("暂无已发布的活动", "No published events"),
    hint: t("新的活动安排会在这里发布。可以先查看社团通知。", "New events will be posted here. Check the club notices meanwhile."),
  },
  announcements: {
    title: t("通知", "Notices"),
    headline: t("社团通知", "Club notices"),
    description: t(
      "参与安排、招新与社团事项。查看发布时间和所属社群，了解与你有关的通知。",
      "Plans, recruitment and club matters. Check the date and community to find notices relevant to you.",
    ),
    empty: t("暂无已发布的通知", "No published notices"),
    hint: t("新的社团安排发布后会在这里展示。你可以先浏览活动。", "New club plans will appear here. Browse events meanwhile."),
  },
  albums: {
    title: t("影像", "Gallery"),
    headline: t("活动影像", "Event gallery"),
    description: t("比赛与日常留下的共同记忆，收录在每一本活动相册中。", "Shared memories from matches and everyday club life, collected in event albums."),
    empty: t("暂无公开相册", "No public albums"),
    hint: t("获准公开的活动相册会在这里展示。你可以先浏览活动回顾。", "Approved event albums will appear here. Browse event recaps meanwhile."),
  },
});
// i18n-exempt: decorative aria-hidden wordmark
export function SignalGraphic({ label = "紫荆电竞" }: { label?: string }) {
  return (
    <div className={styles.graphic} aria-hidden="true">
      <span>{label}</span>
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export async function publicDoc(collection: PageCollection, slug: string, includePostImages = false) {
  const doc = await bySlug(collection, slug, includePostImages);
  if (doc) return doc;
  const redirects = await (
    await cms()
  ).find({
    collection: "redirects",
    overrideAccess: false,
    user: null,
    depth: 0,
    where: { from: { equals: `/${routeFor[collection]}/${slug}` } },
    limit: 1,
  });
  if (redirects.docs[0]) permanentRedirect(redirects.docs[0].to);
  notFound();
}
export async function detailMetadata(
  collection: PageCollection,
  slug: string,
): Promise<Metadata> {
  const doc = await publicDoc(collection, slug),
    url = `/${routeFor[collection]}/${slug}`;
  const title = doc.seoTitle || doc.title;
  return {
    title,
    description: doc.seoDescription || doc.summary,
    alternates: { canonical: url },
    openGraph: { title, description: doc.summary, url },
  };
}
export async function PublicDetail({
  collection,
  slug,
  search = {},
}: {
  collection: PageCollection;
  slug: string;
  search?: Query;
}) {
  const page = Math.floor(
    Math.max(1, Math.min(10000, Number(search.page) || 1)),
  );
  return (
    <div
      className={`${styles.page} ${styles.detail}`}
      data-activity-page={collection}
    >
      <ActivityDetail
        collection={collection}
        doc={await publicDoc(collection, slug, collection !== "albums")}
        photoPage={page}
      />
    </div>
  );
}
function DateLabel({ value, t }: { value?: string; t: Translate }) {
  const date = dateParts(value);
  return (
    <div className={styles.noticeDate}>
      {date ? (
        <>
          <strong>
            {date.month}.{date.day}
          </strong>
          <span>{date.year}</span>
        </>
      ) : (
        <span>{t("日期待公布", "Date TBA")}</span>
      )}
    </div>
  );
}
export async function EventCard({
  doc,
  collection,
  game,
}: {
  doc: Content;
  collection: PageCollection;
  game?: Content;
}) {
  const { t, locale } = await getT();
  const href = `/${routeFor[collection]}/${doc.slug}`;
  const registration = registrationSummary(doc);
  if (collection === "albums")
    return (
      <article className={styles.album}>
        {doc.cover && (
          <Link
            href={href}
            className={styles.albumImage}
            tabIndex={-1}
            aria-label={t(`打开相册：${doc.title}`, `Open album: ${doc.title}`)}
          >
            <Picture id={doc.cover} />
          </Link>
        )}
        <div className={styles.albumBody}>
          <div className={styles.meta}>
            {doc.date && (
              <time dateTime={doc.date}>{formatWhen(doc.date, locale)}</time>
            )}
            {game && <span>{game.title}</span>}
            {doc.demo && <span className="demo-label">{t("演示资料", "Demo content")}</span>}
            {doc.archived && <span>{t("历史归档", "Archived")}</span>}
          </div>
          <h2>
            <Link href={href}>{doc.title}</Link>
          </h2>
          {doc.summary && <p>{doc.summary}</p>}
          <Link className={styles.textAction} href={href}>
            {t("打开相册", "Open album")}
          </Link>
        </div>
      </article>
    );
  return (
    <article className={styles.eventCard} data-kind={collection}>
      <DateLabel value={doc.startAt || doc.date} t={t} />
      <div className={styles.cardBody}>
        <div className={styles.meta}>
          <span>{eventStateLabel("", eventState(doc), locale)}</span>
          {doc.type && <span>{publicLabel(doc.type, locale)}</span>}
          {game ? (
            <Link href={`/community/${game.slug}`}>{game.title}</Link>
          ) : (
            <span>{t("社团活动", "Club event")}</span>
          )}
          {doc.demo && <span className="demo-label">{t("演示资料", "Demo content")}</span>}
          {doc.archived && <span>{t("历史归档", "Archived")}</span>}
        </div>
        <h2>
          <Link href={href}>{doc.title}</Link>
        </h2>
        {doc.summary && <p>{doc.summary}</p>}
        <dl className={styles.eventFacts}>
          <div>
            <dt>{t("时间", "Time")}</dt>
            <dd>
              {doc.startAt ? (
                <time dateTime={doc.startAt}>{formatWhen(doc.startAt, locale)}</time>
              ) : (
                t("待公布", "TBA")
              )}
            </dd>
          </div>
          <div>
            <dt>{t("地点", "Location")}</dt>
            <dd>{doc.location || t("待公布", "TBA")}</dd>
          </div>
        </dl>
      </div>
      <div className={styles.eventAction}>
        <span
          className={styles.status}
          data-open={registration.state === "报名开放"}
        >
          {signupStateLabel("", registration.state, locale)}
        </span>
        {registration.deadline && (
          <p>
            {t("报名截止", "Sign-up closes")}
            <br />
            <time dateTime={registration.deadline}>
              {formatWhen(registration.deadline, locale)}
            </time>
          </p>
        )}
        <Link className={styles.textAction} href={href}>
          {registration.state === "报名开放"
            ? t("查看活动与报名", "Event & sign-up")
            : t("查看活动详情", "Event details")}
        </Link>
      </div>
      {doc.cover && (
        <Link
          className={styles.eventImage}
          href={href}
          aria-label={t(`查看${doc.title}`, `View ${doc.title}`)}
          tabIndex={-1}
        >
          <Picture id={doc.cover} />
        </Link>
      )}
    </article>
  );
}
export async function PublicList({
  collection,
  search,
}: {
  collection: PageCollection;
  search: Query;
}) {
  const { t, locale } = await getT();
  const limit = 12;
  const page = Math.floor(
      Math.max(1, Math.min(10000, Number(search.page) || 1)),
    ),
    and: Where[] = [],
    query: Record<string, string> = {};
  if (collection === "events") {
    const gameID = typeof search.game === "string" && /^\d+$/.test(search.game) ? Number(search.game) : 0;
    if (gameID > 0 && gameID <= 2_147_483_647) {
      and.push({ game: { equals: gameID } });
      query.game = String(gameID);
    }
    if (
      typeof search.type === "string" &&
      eventTypes.includes(search.type)
    ) {
      and.push({ type: { equals: search.type } });
      query.type = search.type;
    }
    if (search.time === "upcoming") {
      and.push({ startAt: { greater_than_equal: new Date().toISOString() } });
      query.time = "upcoming";
    }
    if (search.time === "past") {
      and.push({ endAt: { less_than_equal: new Date().toISOString() } });
      query.time = "past";
    }
  }
  const [result, games] = await Promise.all([
    list(collection, and.length ? { and } : {}, page, limit),
    list("games", {}, 1, 100),
  ]);
  const selectedGame = games.docs.find((game) => String(game.id) === query.game);
  // Community posts have no structured event type or start/end time.
  const community = collection === "events" && !query.type && !query.time && (!query.game || selectedGame)
    ? await communityEventPage(await cms(), selectedGame, page, limit)
    : { docs: [], totalDocs: 0, totalPages: 0 };
  const totalDocs = result.totalDocs + community.totalDocs;
  const totalPages = Math.max(result.totalPages, community.totalPages);
  const meta = copy(t)[collection],
    path = `/${routeFor[collection]}`;
  const gameFor = (doc: Content) =>
    games.docs.find((game) => game.id === doc.game);
  return (
    <div className={styles.page} data-activity-page={collection}>
      <nav className={styles.breadcrumbs} aria-label={t("面包屑", "Breadcrumb")}>
        <Link href="/">{t("首页", "Home")}</Link>
        <span aria-hidden="true">/</span>
        <span>{meta.title}</span>
      </nav>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{t(`紫荆主场 · ${meta.title}`, `Zijing Home · ${meta.title}`)}</p>
          <h1>{meta.headline}</h1>
          <p>{meta.description}</p>
        </div>
        {collection === "events" && (
          <Link className={styles.textAction} href="/account">
            {t("我的报名", "My sign-ups")}
          </Link>
        )}
      </header>
      <nav className={styles.sectionNav} aria-label={t("活动与内容栏目", "Events & content sections")}>
        <Link
          href="/events"
          aria-current={collection === "events" ? "page" : undefined}
        >
          {t("活动日程", "Event schedule")}
        </Link>
        <Link
          href="/announcements"
          aria-current={collection === "announcements" ? "page" : undefined}
        >
          {t("社团通知", "Club notices")}
        </Link>
        <Link
          href="/gallery"
          aria-current={collection === "albums" ? "page" : undefined}
        >
          {t("活动影像", "Event gallery")}
        </Link>
      </nav>
      {collection === "events" && (
        <form className={styles.filter} method="get" aria-label={t("筛选内容", "Filter content")}>
          <label>
            {t("游戏项目", "Game")}
            <select name="game" defaultValue={query.game || ""}>
              <option value="">{t("全部项目", "All games")}</option>
              {games.docs.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("活动类型", "Event type")}
            <select name="type" defaultValue={query.type || ""}>
              <option value="">{t("全部类型", "All types")}</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {publicLabel(type, locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("时间", "Time")}
            <select name="time" defaultValue={query.time || ""}>
              <option value="">{t("全部时间", "All times")}</option>
              <option value="upcoming">{t("即将开始", "Upcoming")}</option>
              <option value="past">{t("历史活动", "Past events")}</option>
            </select>
          </label>
          <button className={styles.primary} type="submit">
            {t("筛选活动", "Filter events")}
          </button>
          <Link href={path}>{t("清除筛选", "Clear filters")}</Link>
        </form>
      )}
      <div className={styles.result}>
        <h2>
          {collection === "events"
            ? Object.keys(query).length
              ? t("筛选结果", "Filtered results")
              : t("全部活动", "All events")
            : collection === "announcements"
              ? t("已发布通知", "Published notices")
              : t("相册目录", "Albums")}
        </h2>
        <span>
          {t(`共 ${totalDocs} 条`, `${totalDocs} items`)}
          {totalPages > 1 && t(`，第 ${page} / ${totalPages} 页`, `, page ${page} of ${totalPages}`)}
        </span>
      </div>
      {!result.docs.length && !community.docs.length ? (
        <EmptyState
          title={
            Object.keys(query).length ? t("没有符合筛选条件的活动", "No events match these filters") : meta.empty
          }
        >
          <p>
            {Object.keys(query).length
              ? t("试试其他游戏项目或时间范围，也可以清除筛选查看全部活动。", "Try another game or time range, or clear the filters to see all events.")
              : meta.hint}
          </p>
          <Link
            className={styles.primary}
            href={
              Object.keys(query).length
                ? path
                : collection === "events"
                  ? "/announcements"
                  : "/events"
            }
          >
            {Object.keys(query).length
              ? t("清除筛选", "Clear filters")
              : collection === "events"
                ? t("查看通知", "View notices")
                : t("浏览活动", "Browse events")}
          </Link>
        </EmptyState>
      ) : collection === "announcements" ? (
        <div className={styles.noticeList}>
          {result.docs.map((doc) => (
            <article className={styles.notice} key={doc.id}>
              <DateLabel value={doc.publishedAt} t={t} />
              <div>
                <div className={styles.meta}>
                  <span>{gameFor(doc)?.title || t("社团通知", "Club notice")}</span>
                  {doc.demo && <span className="demo-label">{t("演示资料", "Demo content")}</span>}
                  {doc.archived && <span>{t("历史归档", "Archived")}</span>}
                </div>
                <h2>
                  <Link href={`/announcements/${doc.slug}`}>{doc.title}</Link>
                </h2>
                {doc.summary && <p>{doc.summary}</p>}
              </div>
              <Link
                className={styles.textAction}
                href={`/announcements/${doc.slug}`}
                aria-label={t(`阅读全文：${doc.title}`, `Read more: ${doc.title}`)}
              >
                {t("阅读全文", "Read more")}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div
          className={
            collection === "albums" ? styles.albumGrid : styles.eventGrid
          }
        >
          {community.docs.map((event) => (
            <article className={styles.eventCard} key={event.href}>
              <span className={styles.noticeDate}>{event.promoted ? t("社团精选", "Club pick") : t("社群活动", "Community event")}</span>
              <div className={styles.cardBody}>
                <div className={styles.meta}>
                  <span>{event.gameTitle}</span>
                  {event.createdAt && (
                    <time dateTime={event.createdAt}>{t(`发布于 ${formatDate(event.createdAt)}`, `Published ${formatWhen(event.createdAt, locale)}`)}</time>
                  )}
                </div>
                <h2><Link href={event.href}>{event.title}</Link></h2>
                {event.summary && <p>{event.summary}</p>}
              </div>
              <div className={styles.eventAction}>
                <Link className={styles.textAction} href={event.href}>{t("查看活动详情", "Event details")}</Link>
              </div>
            </article>
          ))}
          {result.docs.map((doc) => (
            <EventCard
              key={doc.id}
              doc={doc}
              collection={collection}
              game={gameFor(doc)}
            />
          ))}
        </div>
      )}
      <Pagination
        page={page}
        total={totalPages}
        path={path}
        query={query}
      />
    </div>
  );
}
