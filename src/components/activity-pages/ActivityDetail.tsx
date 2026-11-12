import Link from "next/link";
import { list, type Content } from "@/lib/content";
import {
  eventState,
  formatDate,
  registrationState,
  safeURL,
} from "@/lib/rules";
import { Pagination, Picture, Prose } from "@/components/Content";
import { ActivitySignup } from "@/components/ActivitySignup";
import { ActivitySeating } from "./ActivitySeating";
import { registrationSummary } from "./registration-summary";
import styles from "./ActivityPages.module.css";

type Collection = "events" | "announcements" | "albums";
const labels = { events: "活动", announcements: "通知", albums: "影像" };
const routes = {
  events: "/events",
  announcements: "/announcements",
  albums: "/gallery",
};
export async function ActivityDetail({
  doc,
  collection,
  photoPage = 1,
}: {
  doc: Content;
  collection: Collection;
  photoPage?: number;
}) {
  const [game, team, event, season, news, albums] = await Promise.all([
    doc.game
      ? list("games", { id: { equals: doc.game } }, 1, 1).then((r) => r.docs[0])
      : null,
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
      ? list("news", { event: { equals: doc.id } })
      : null,
    collection === "events"
      ? list("albums", { event: { equals: doc.id } })
      : null,
  ]);
  const contentDate =
    collection === "announcements" ? doc.publishedAt : doc.startAt || doc.date;
  const isEvent = collection === "events",
    registration = registrationState(doc),
    summary = registrationSummary(doc);
  return (
    <>
      <nav className={styles.breadcrumbs} aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <Link href={routes[collection]}>{labels[collection]}</Link>
        <span aria-hidden="true">/</span>
        <span>详情</span>
      </nav>
      <header className={styles.readingHeader}>
        <div className={styles.meta}>
          <span className={styles.status}>
            {isEvent ? eventState(doc) : labels[collection]}
          </span>
          {game ? (
            <Link href={`/community/${game.slug}`}>{game.title}</Link>
          ) : (
            <span>紫荆电竞社</span>
          )}
          {doc.type && <span>{doc.type}</span>}
          {doc.archived && <span>历史归档</span>}
          {doc.demo && (
            <span className="demo-label">演示资料 · 非真实社团记录</span>
          )}
        </div>
        <h1>{doc.title}</h1>
        {doc.summary && <p className={styles.lead}>{doc.summary}</p>}
        {contentDate && (
          <p className={styles.meta}>
            <span>
              {isEvent
                ? "活动开始"
                : collection === "albums"
                  ? "拍摄日期"
                  : "发布日期"}
            </span>
            <time dateTime={contentDate}>{formatDate(contentDate)}</time>
            {doc.location && <span>{doc.location}</span>}
          </p>
        )}
        {isEvent && (
          <nav className={styles.detailJump} aria-label="活动页内导航">
            <a className={styles.primary} href="#participate">
              {summary.state === "报名开放"
                ? "查看报名与参与方式"
                : "查看报名状态"}
            </a>
            <a href="#activity-content">阅读活动说明</a>
          </nav>
        )}
      </header>
      <div className={styles.detailLayout} data-event={isEvent}>
        {isEvent && (
          <aside
            id="participate"
            className={styles.detailAside}
            aria-label="活动信息与报名"
          >
            <section className={styles.factPanel}>
              <h2>参与这场活动</h2>
              <dl className={styles.facts}>
                <div>
                  <dt>开始</dt>
                  <dd>{formatDate(doc.startAt)}</dd>
                </div>
                <div>
                  <dt>结束</dt>
                  <dd>{formatDate(doc.endAt)}</dd>
                </div>
                <div>
                  <dt>地点</dt>
                  <dd>{doc.location || "待公布"}</dd>
                </div>
                {summary.deadline && (
                  <div>
                    <dt>报名截止</dt>
                    <dd>{formatDate(summary.deadline)}</dd>
                  </div>
                )}
              </dl>
              {doc.requirements && (
                <div className={styles.conditions}>
                  <h3>参与条件</h3>
                  <p className="preserve">{doc.requirements}</p>
                </div>
              )}
            </section>
            <ActivitySignup kind="events" id={doc.id} compact />
            {!doc.signupForm?.enabled && (
              <section className={styles.factPanel}>
                <h2>{registration}</h2>
                <dl className={styles.facts}>
                  <div>
                    <dt>报名开始</dt>
                    <dd>{formatDate(doc.registrationStart)}</dd>
                  </div>
                  <div>
                    <dt>报名截止</dt>
                    <dd>
                      {doc.registrationEnd
                        ? formatDate(doc.registrationEnd)
                        : "未设定"}
                    </dd>
                  </div>
                </dl>
                {registration === "报名开放" && (
                  <>
                    {safeURL(doc.registrationURL) && (
                      <a
                        className={styles.primary}
                        href={doc.registrationURL!}
                        rel="noopener noreferrer"
                      >
                        前往外部报名
                      </a>
                    )}
                    {doc.channelText && (
                      <p className="preserve">{doc.channelText}</p>
                    )}
                    <Picture id={doc.qrCode} />
                    <p className={styles.supportText}>
                      报名和取消规则以受理平台说明为准。
                    </p>
                  </>
                )}
                {doc.contact && <p>联系：{doc.contact}</p>}
                {doc.channelCheckedAt && (
                  <p className={styles.supportText}>
                    渠道核验：{formatDate(doc.channelCheckedAt)}
                  </p>
                )}
              </section>
            )}
            {doc.signupForm?.enabled && doc.contact && (
              <p className={styles.supportText}>参与咨询：{doc.contact}</p>
            )}
          </aside>
        )}
        <article id="activity-content" className={styles.readingBody}>
          {doc.cover && (
            <figure className={styles.cover}>
              <Picture id={doc.cover} priority />
            </figure>
          )}
          {isEvent && <h2 className={styles.sectionTitle}>活动说明</h2>}
          <Prose doc={doc} />
          {collection === "albums" && (
            <section aria-label="活动照片">
              <div className={styles.result}>
                <h2>相册照片</h2>
                <span>{doc.photos?.length || 0} 张公开照片</span>
              </div>
              {!doc.photos?.length && (
                <p className={styles.empty}>暂无获准公开的照片。</p>
              )}
              <div className={styles.photos}>
                {doc.photos
                  ?.slice((photoPage - 1) * 12, photoPage * 12)
                  .map((photo, index) => (
                    <figure key={index}>
                      <Picture id={photo.image} />
                      {photo.caption && (
                        <figcaption>{photo.caption}</figcaption>
                      )}
                    </figure>
                  ))}
              </div>
              <Pagination
                page={photoPage}
                total={Math.ceil((doc.photos?.length || 0) / 12)}
                path={`/gallery/${doc.slug}`}
              />
            </section>
          )}
          {(team || event) && (
            <section className={styles.related}>
              <h2>相关档案</h2>
              {team && <Link href={`/teams/${team.slug}`}>{team.title}</Link>}
              {season && team && (
                <Link href={`/teams/${team.slug}#season-${season.id}`}>
                  {season.title}
                </Link>
              )}
              {event && (
                <Link href={`/events/${event.slug}`}>{event.title}</Link>
              )}
            </section>
          )}
          {news && news.docs.length > 0 && (
            <section className={styles.related}>
              <h2>活动回顾</h2>
              {news.docs.map((item) => (
                <Link key={item.id} href={`/news/${item.slug}`}>
                  {item.title}
                </Link>
              ))}
            </section>
          )}
          {albums && albums.docs.length > 0 && (
            <section className={styles.related}>
              <h2>活动相册</h2>
              {albums.docs.map((item) => (
                <Link key={item.id} href={`/gallery/${item.slug}`}>
                  {item.title}
                </Link>
              ))}
            </section>
          )}
          <p className={styles.backLink}>
            <Link href={routes[collection]}>返回{labels[collection]}列表</Link>
          </p>
        </article>
      </div>
      {isEvent && <ActivitySeating kind="events" id={doc.id} returnTo={`/events/${doc.slug}`} />}
    </>
  );
}
