import Link from "next/link";
import { list, type Content } from "@/lib/content";
import { eventState, formatDate, registrationState, safeURL } from "@/lib/rules";
import { Pagination, Picture, Prose } from "@/components/Content";
import { ActivitySignup } from "@/components/ActivitySignup";
import styles from "./ActivityPages.module.css";

type Collection = "events" | "announcements" | "albums";
const labels = { events: "活动", announcements: "通知", albums: "影像" };
const routes = { events: "/events", announcements: "/announcements", albums: "/gallery" };

export async function ActivityDetail({ doc, collection, photoPage = 1 }: { doc: Content; collection: Collection; photoPage?: number }) {
  const [team, event, season, news, albums] = await Promise.all([
    doc.team ? list("teams", { id: { equals: doc.team } }, 1, 1).then(r => r.docs[0]) : null,
    doc.event ? list("events", { id: { equals: doc.event } }, 1, 1).then(r => r.docs[0]) : null,
    doc.season ? list("seasons", { id: { equals: doc.season } }, 1, 1).then(r => r.docs[0]) : null,
    collection === "events" ? list("news", { event: { equals: doc.id } }) : null,
    collection === "events" ? list("albums", { event: { equals: doc.id } }) : null,
  ]);
  const registration = registrationState(doc);
  return <>
    <nav className={styles.breadcrumbs} aria-label="面包屑"><Link href="/">首页</Link><span aria-hidden="true">/</span><Link href={routes[collection]}>{labels[collection]}</Link><span aria-hidden="true">/</span><span>详情</span></nav>
    <header className={styles.readingHeader}>
      <div className={styles.meta}><span className={styles.status}>{collection === "events" ? eventState(doc) : labels[collection]}</span>{doc.type && <span>{doc.type}</span>}{doc.archived && <span>历史归档</span>}{doc.demo && <span className="demo-label">演示资料 · 非真实社团记录</span>}</div>
      <h1>{doc.title}</h1>
      {doc.summary && <p className={styles.lead}>{doc.summary}</p>}
      {(doc.startAt || doc.date) && <p className={styles.meta}><time dateTime={doc.startAt || doc.date}>{formatDate(doc.startAt || doc.date)}</time>{doc.location && <span>{doc.location}</span>}</p>}
    </header>
    <div className={styles.detailLayout} data-event={collection === "events"}>
      <article className={styles.readingBody}>
        {doc.cover && <figure className={styles.cover}><Picture id={doc.cover} priority /></figure>}
        <Prose doc={doc} />
        {collection === "albums" && <section aria-label="活动照片">
          {!doc.photos?.length && <p className={styles.empty}>暂无获准公开的照片。</p>}
          <div className={styles.photos}>{doc.photos?.slice((photoPage - 1) * 12, photoPage * 12).map((photo, index) => <figure key={index}><Picture id={photo.image} />{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure>)}</div>
          <Pagination page={photoPage} total={Math.ceil((doc.photos?.length || 0) / 12)} path={`/gallery/${doc.slug}`} />
        </section>}
        {news && news.docs.length > 0 && <section className={styles.related}><h2>活动回顾</h2>{news.docs.map(item => <Link key={item.id} href={`/news/${item.slug}`}><span>{item.title}</span><span aria-hidden="true">→</span></Link>)}</section>}
        {albums && albums.docs.length > 0 && <section className={styles.related}><h2>活动相册</h2>{albums.docs.map(item => <Link key={item.id} href={`/gallery/${item.slug}`}><span>{item.title}</span><span aria-hidden="true">→</span></Link>)}</section>}
        <p className={styles.backLink}><Link href={routes[collection]}>← 返回{labels[collection]}列表</Link></p>
      </article>
      <aside className={styles.detailAside} aria-label={collection === "events" ? "活动信息与报名" : "相关档案"}>
        {collection === "events" && <section className={styles.factPanel}><h2>活动安排</h2><dl className={styles.facts}><div><dt>开始</dt><dd>{formatDate(doc.startAt)}</dd></div><div><dt>结束</dt><dd>{formatDate(doc.endAt)}</dd></div><div><dt>地点</dt><dd>{doc.location || "待公布"}</dd></div></dl></section>}
        {collection === "events" && <ActivitySignup kind="events" id={doc.id} compact />}
        {collection === "events" && !doc.signupForm?.enabled && <section className={styles.factPanel}>
          <h2>{registration}</h2>{doc.requirements && <p className="preserve">{doc.requirements}</p>}
          <dl className={styles.facts}><div><dt>开始</dt><dd>{formatDate(doc.registrationStart)}</dd></div><div><dt>截止</dt><dd>{doc.registrationEnd ? formatDate(doc.registrationEnd) : "未设定"}</dd></div></dl>
          {registration === "报名开放" && <>{safeURL(doc.registrationURL) && <a className={styles.primary} href={doc.registrationURL!} rel="noopener noreferrer">前往外部报名 ↗</a>}{doc.channelText && <p className="preserve">{doc.channelText}</p>}<Picture id={doc.qrCode} /><p className={styles.meta}>报名由外部平台受理，以外部平台提示为准。</p></>}
          {doc.contact && <p>联系：{doc.contact}</p>}{doc.channelCheckedAt && <p className={styles.meta}>渠道核验：{formatDate(doc.channelCheckedAt)}</p>}
        </section>}
        {(team || event) && <section className={styles.factPanel}><h2>相关档案</h2>{team && <p><Link href={`/teams/${team.slug}`}>{team.title} →</Link></p>}{season && team && <p><Link href={`/teams/${team.slug}#season-${season.id}`}>{season.title} →</Link></p>}{event && <p><Link href={`/events/${event.slug}`}>{event.title} →</Link></p>}</section>}
      </aside>
    </div>
  </>;
}
