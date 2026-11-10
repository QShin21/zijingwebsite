import type { Metadata } from "next";
import type { Where } from "payload";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { bySlug, cms, list, type Content } from "@/lib/content";
import { Pagination, Picture } from "@/components/Content";
import { dateParts } from "@/lib/presentation";
import { eventState, formatDate, routeFor } from "@/lib/rules";
import styles from "./ActivityPages.module.css";
import { ActivityDetail } from "./ActivityDetail";
import { registrationSummary } from "./registration-summary";

export type PageCollection = "events" | "announcements" | "albums";
export type Query = Record<string, string | string[] | undefined>;
const copy = {
  events: {
    title: "活动",
    headline: "活动日程",
    description:
      "比赛、观赛、交流与训练。从时间和项目出发，找到下一场想参加的活动。",
    empty: "暂无已发布的活动",
    hint: "新的活动安排会在这里发布。可以先查看社团通知。",
  },
  announcements: {
    title: "通知",
    headline: "社团通知",
    description:
      "参与安排、招新与社团事项。查看发布时间和所属社群，了解与你有关的通知。",
    empty: "暂无已发布的通知",
    hint: "新的社团安排发布后会在这里展示。你可以先浏览活动。",
  },
  albums: {
    title: "影像",
    headline: "活动影像",
    description: "比赛与日常留下的共同记忆，收录在每一本活动相册中。",
    empty: "暂无公开相册",
    hint: "获准公开的活动相册会在这里展示。你可以先浏览活动回顾。",
  },
};
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
function DateLabel({ value }: { value?: string }) {
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
        <span>日期待公布</span>
      )}
    </div>
  );
}
export function EventCard({
  doc,
  collection,
  game,
}: {
  doc: Content;
  collection: PageCollection;
  game?: Content;
}) {
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
            aria-label={`打开相册：${doc.title}`}
          >
            <Picture id={doc.cover} />
          </Link>
        )}
        <div className={styles.albumBody}>
          <div className={styles.meta}>
            {doc.date && (
              <time dateTime={doc.date}>{formatDate(doc.date)}</time>
            )}
            {game && <span>{game.title}</span>}
            {doc.demo && <span className="demo-label">演示资料</span>}
            {doc.archived && <span>历史归档</span>}
          </div>
          <h2>
            <Link href={href}>{doc.title}</Link>
          </h2>
          {doc.summary && <p>{doc.summary}</p>}
          <Link className={styles.textAction} href={href}>
            打开相册
          </Link>
        </div>
      </article>
    );
  return (
    <article className={styles.eventCard} data-kind={collection}>
      <DateLabel value={doc.startAt || doc.date} />
      <div className={styles.cardBody}>
        <div className={styles.meta}>
          <span>{eventState(doc)}</span>
          {doc.type && <span>{doc.type}</span>}
          {game ? (
            <Link href={`/community/${game.slug}`}>{game.title}</Link>
          ) : (
            <span>社团活动</span>
          )}
          {doc.demo && <span className="demo-label">演示资料</span>}
          {doc.archived && <span>历史归档</span>}
        </div>
        <h2>
          <Link href={href}>{doc.title}</Link>
        </h2>
        {doc.summary && <p>{doc.summary}</p>}
        <dl className={styles.eventFacts}>
          <div>
            <dt>时间</dt>
            <dd>
              {doc.startAt ? (
                <time dateTime={doc.startAt}>{formatDate(doc.startAt)}</time>
              ) : (
                "待公布"
              )}
            </dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>{doc.location || "待公布"}</dd>
          </div>
        </dl>
      </div>
      <div className={styles.eventAction}>
        <span
          className={styles.status}
          data-open={registration.state === "报名开放"}
        >
          {registration.state}
        </span>
        {registration.deadline && (
          <p>
            报名截止
            <br />
            <time dateTime={registration.deadline}>
              {formatDate(registration.deadline)}
            </time>
          </p>
        )}
        <Link className={styles.textAction} href={href}>
          {registration.state === "报名开放"
            ? "查看活动与报名"
            : "查看活动详情"}
        </Link>
      </div>
      {doc.cover && (
        <Link
          className={styles.eventImage}
          href={href}
          aria-label={`查看${doc.title}`}
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
  const page = Math.floor(
      Math.max(1, Math.min(10000, Number(search.page) || 1)),
    ),
    and: Where[] = [],
    query: Record<string, string> = {};
  if (collection === "events") {
    if (typeof search.game === "string" && /^\d+$/.test(search.game)) {
      and.push({ game: { equals: search.game } });
      query.game = search.game;
    }
    if (
      typeof search.type === "string" &&
      ["比赛", "观赛", "交流", "训练", "其他"].includes(search.type)
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
    list(collection, and.length ? { and } : {}, page),
    list("games", {}, 1, 100),
  ]);
  const meta = copy[collection],
    path = `/${routeFor[collection]}`;
  const gameFor = (doc: Content) =>
    games.docs.find((game) => game.id === doc.game);
  return (
    <div className={styles.page} data-activity-page={collection}>
      <nav className={styles.breadcrumbs} aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span>{meta.title}</span>
      </nav>
      <header className={styles.hero}>
        <div>
          <h1>{meta.headline}</h1>
          <p>{meta.description}</p>
        </div>
        {collection === "events" && (
          <Link className={styles.textAction} href="/account">
            我的报名
          </Link>
        )}
      </header>
      <nav className={styles.sectionNav} aria-label="活动与内容栏目">
        <Link
          href="/events"
          aria-current={collection === "events" ? "page" : undefined}
        >
          活动日程
        </Link>
        <Link
          href="/announcements"
          aria-current={collection === "announcements" ? "page" : undefined}
        >
          社团通知
        </Link>
        <Link
          href="/gallery"
          aria-current={collection === "albums" ? "page" : undefined}
        >
          活动影像
        </Link>
      </nav>
      {collection === "events" && (
        <form className={styles.filter} method="get" aria-label="筛选内容">
          <label>
            游戏项目
            <select name="game" defaultValue={query.game || ""}>
              <option value="">全部项目</option>
              {games.docs.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            活动类型
            <select name="type" defaultValue={query.type || ""}>
              <option value="">全部类型</option>
              {["比赛", "观赛", "交流", "训练", "其他"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            时间
            <select name="time" defaultValue={query.time || ""}>
              <option value="">全部时间</option>
              <option value="upcoming">即将开始</option>
              <option value="past">历史活动</option>
            </select>
          </label>
          <button className={styles.primary} type="submit">
            筛选活动
          </button>
          <Link href={path}>清除筛选</Link>
        </form>
      )}
      <div className={styles.result}>
        <h2>
          {collection === "events"
            ? Object.keys(query).length
              ? "筛选结果"
              : "全部活动"
            : collection === "announcements"
              ? "已发布通知"
              : "相册目录"}
        </h2>
        <span>
          共 {result.totalDocs} 条
          {result.totalPages > 1 && `，第 ${page} / ${result.totalPages} 页`}
        </span>
      </div>
      {!result.docs.length ? (
        <EmptyState
          title={
            Object.keys(query).length ? "没有符合筛选条件的活动" : meta.empty
          }
        >
          <p>
            {Object.keys(query).length
              ? "试试其他游戏项目或时间范围，也可以清除筛选查看全部活动。"
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
              ? "清除筛选"
              : collection === "events"
                ? "查看通知"
                : "浏览活动"}
          </Link>
        </EmptyState>
      ) : collection === "announcements" ? (
        <div className={styles.noticeList}>
          {result.docs.map((doc) => (
            <article className={styles.notice} key={doc.id}>
              <DateLabel value={doc.publishedAt} />
              <div>
                <div className={styles.meta}>
                  <span>{gameFor(doc)?.title || "社团通知"}</span>
                  {doc.demo && <span className="demo-label">演示资料</span>}
                  {doc.archived && <span>历史归档</span>}
                </div>
                <h2>
                  <Link href={`/announcements/${doc.slug}`}>{doc.title}</Link>
                </h2>
                {doc.summary && <p>{doc.summary}</p>}
              </div>
              <Link
                className={styles.textAction}
                href={`/announcements/${doc.slug}`}
                aria-label={`阅读全文：${doc.title}`}
              >
                阅读全文
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
        total={result.totalPages}
        path={path}
        query={query}
      />
    </div>
  );
}
