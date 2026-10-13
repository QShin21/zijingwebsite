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

export type PageCollection = "events" | "announcements" | "albums";
export type Query = Record<string, string | string[] | undefined>;
const copy = {
  events: {
    title: "活动",
    headline: "活动日程",
    label: "一起参与",
    description:
      "比赛、观赛、交流与训练。找到想参加的活动，也回看那些值得记住的现场。",
    empty: "下一场精彩，敬请关注",
    hint: "活动安排确认后会在这里发布。可以先查看通知，了解最新安排。",
  },
  announcements: {
    title: "通知",
    headline: "社团通知",
    label: "社团动态",
    description:
      "查看社团通知、参与安排与最新说明。具体事项以已发布的通知内容为准。",
    empty: "暂无已发布的通知",
    hint: "新的社团安排发布后会在这里展示。你可以先浏览活动。",
  },
  albums: {
    title: "影像",
    headline: "活动影像",
    label: "社团档案",
    description: "从赛场到日常，在影像里重新相遇。",
    empty: "精彩影像，正在整理",
    hint: "已获准公开的活动相册会在这里展示。也可以先查看社群风采。",
  },
};
export function SignalGraphic({
  label = "紫荆电竞",
}: {
  label?: string;
}) {
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
export async function publicDoc(collection: PageCollection, slug: string) {
  const doc = await bySlug(collection, slug);
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
        doc={await publicDoc(collection, slug)}
        photoPage={page}
      />
    </div>
  );
}
function DateLabel({ value }: { value?: string }) {
  const date = dateParts(value);
  return date ? (
    <div className={styles.noticeDate}>
      <strong>
        {date.month}.{date.day}
      </strong>
      <span>{date.year}</span>
    </div>
  ) : (
    <div className={styles.noticeDate}>日期待定</div>
  );
}
export function EventCard({
  doc,
  collection,
}: {
  doc: Content;
  collection: PageCollection;
}) {
  const state = collection === "events" ? eventState(doc) : "活动相册";
  const href = `/${routeFor[collection]}/${doc.slug}`;
  return (
    <article className={styles.eventCard} data-kind={collection}>
      <DateLabel value={doc.startAt || doc.date} />
      <div className={styles.cardBody}>
        <div className={styles.meta}>
          <span className={styles.status} data-open={state === "进行中"}>{state}</span>
          {doc.type && <span>{doc.type}</span>}
          {doc.demo && <span className="demo-label">演示资料</span>}
          {doc.archived && <span>历史归档</span>}
        </div>
        <h2><Link href={href}>{doc.title}</Link></h2>
        {doc.summary && <p>{doc.summary}</p>}
        <div className={styles.cardFoot}>
          <div className={styles.meta}>
            {doc.startAt && <time dateTime={doc.startAt}>{formatDate(doc.startAt)}</time>}
            {doc.location && <span>{doc.location}</span>}
          </div>
          <Link href={href}>{collection === "events" ? "活动详情与报名" : "打开相册"} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
      {doc.cover && <Link className={styles.eventImage} href={href} aria-label={`查看${doc.title}`} tabIndex={-1}><Picture id={doc.cover} /></Link>}
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
    collection === "events" ? list("games", {}, 1, 100) : null,
  ]);
  const meta = copy[collection],
    path = `/${routeFor[collection]}`;
  return (
    <div className={styles.page} data-activity-page={collection}>
      <nav className={styles.breadcrumbs} aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span>{meta.title}</span>
      </nav>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{meta.label}</p>
          <h1 style={{ whiteSpace: "pre-line" }}>{meta.headline}</h1>
          <p>{meta.description}</p>
        </div>
        <nav className={styles.sectionNav} aria-label="活动与内容栏目">
          <Link href="/events" aria-current={collection === "events" ? "page" : undefined}>活动</Link>
          <Link href="/announcements" aria-current={collection === "announcements" ? "page" : undefined}>通知</Link>
          <Link href="/gallery" aria-current={collection === "albums" ? "page" : undefined}>影像</Link>
        </nav>
      </header>
      {games && (
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
            查看结果
          </button>
          <Link href={path}>重置</Link>
        </form>
      )}
      <div className={styles.result}>
        <strong>
          {collection === "events"
            ? "活动日程"
            : collection === "announcements"
              ? "最新通知"
              : "影像档案"}
        </strong>
        <span>
          共 {result.totalDocs} 条
          {result.totalPages > 1 && ` · 第 ${page} / ${result.totalPages} 页`}
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
              ? "试试其他游戏项目或时间范围，也可以重置筛选查看全部活动。"
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
              <DateLabel value={doc.date} />
              <div>
                <div className={styles.meta}>
                  <span className={styles.status}>社团通知</span>
                  {doc.demo && <span className="demo-label">演示资料</span>}
                  {doc.archived && <span>历史归档</span>}
                </div>
                <h2>
                  <Link href={`/announcements/${doc.slug}`}>{doc.title}</Link>
                </h2>
                {doc.summary && <p>{doc.summary}</p>}
                <Link href={`/announcements/${doc.slug}`}>
                  阅读全文 <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <Link
                href={`/announcements/${doc.slug}`}
                aria-label={`查看通知：${doc.title}`}
              >
                ↗
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div
          className={styles.eventGrid}
          data-count={Math.min(result.docs.length, 4)}
        >
          {result.docs.map((doc) => (
            <EventCard key={doc.id} doc={doc} collection={collection} />
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
