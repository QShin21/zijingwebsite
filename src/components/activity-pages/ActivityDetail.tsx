import Link from "next/link";
import { list, type Content } from "@/lib/content";
import {
  eventState,
  formatDate,
  registrationState,
  safeURL,
} from "@/lib/rules";
import { Pagination, Picture, Prose, formatWhen } from "@/components/Content";
import { getT } from "@/lib/i18n/server";
import { eventStateLabel, signupStateLabel } from "@/lib/i18n/labels-public";
import { ActivitySignup } from "@/components/ActivitySignup";
import { registrationSummary } from "./registration-summary";
import styles from "./ActivityPages.module.css";

type Collection = "events" | "announcements" | "albums";
const labels = {
  events: { zh: "活动", en: "Events" },
  announcements: { zh: "通知", en: "Notices" },
  albums: { zh: "影像", en: "Gallery" },
};
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
  const { t, locale } = await getT();
  const label = t(labels[collection].zh, labels[collection].en);
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
      <nav className={styles.breadcrumbs} aria-label={t("面包屑", "Breadcrumb")}>
        <Link href="/">{t("首页", "Home")}</Link>
        <span aria-hidden="true">/</span>
        <Link href={routes[collection]}>{label}</Link>
        <span aria-hidden="true">/</span>
        <span>{t("详情", "Details")}</span>
      </nav>
      <header className={styles.readingHeader}>
        <div className={styles.meta}>
          <span className={styles.status}>
            {isEvent ? eventStateLabel("", eventState(doc), locale) : label}
          </span>
          {game ? (
            <Link href={`/community/${game.slug}`}>{game.title}</Link>
          ) : (
            <span>{t("紫荆电竞社", "Zijing Esports Club")}</span>
          )}
          {doc.type && <span>{doc.type}</span>}
          {doc.archived && <span>{t("历史归档", "Archived")}</span>}
          {doc.demo && (
            <span className="demo-label">{t("演示资料 · 非真实社团记录", "Demo content · not a real club record")}</span>
          )}
        </div>
        <h1>{doc.title}</h1>
        {doc.summary && <p className={styles.lead}>{doc.summary}</p>}
        {contentDate && (
          <p className={styles.meta}>
            <span>
              {isEvent
                ? t("活动开始", "Starts")
                : collection === "albums"
                  ? t("拍摄日期", "Taken")
                  : t("发布日期", "Published")}
            </span>
            <time dateTime={contentDate}>{formatWhen(contentDate, locale)}</time>
            {doc.location && <span>{doc.location}</span>}
          </p>
        )}
        {isEvent && (
          <nav className={styles.detailJump} aria-label={t("活动页内导航", "On this page")}>
            <a className={styles.primary} href="#participate">
              {summary.state === "报名开放"
                ? t("查看报名与参与方式", "How to sign up & join")
                : t("查看报名状态", "Sign-up status")}
            </a>
            <a href="#activity-content">{t("阅读活动说明", "Read event details")}</a>
          </nav>
        )}
      </header>
      <div className={styles.detailLayout} data-event={isEvent}>
        {isEvent && (
          <aside
            id="participate"
            className={styles.detailAside}
            aria-label={t("活动信息与报名", "Event info & sign-up")}
          >
            <section className={styles.factPanel}>
              <h2>{t("参与这场活动", "Join this event")}</h2>
              <dl className={styles.facts}>
                <div>
                  <dt>{t("开始", "Starts")}</dt>
                  <dd>{formatWhen(doc.startAt, locale)}</dd>
                </div>
                <div>
                  <dt>{t("结束", "Ends")}</dt>
                  <dd>{formatWhen(doc.endAt, locale)}</dd>
                </div>
                <div>
                  <dt>{t("地点", "Location")}</dt>
                  <dd>{doc.location || t("待公布", "TBA")}</dd>
                </div>
                {summary.deadline && (
                  <div>
                    <dt>{t("报名截止", "Sign-up closes")}</dt>
                    <dd>{formatWhen(summary.deadline, locale)}</dd>
                  </div>
                )}
              </dl>
              {doc.requirements && (
                <div className={styles.conditions}>
                  <h3>{t("参与条件", "Requirements")}</h3>
                  <p className="preserve">{doc.requirements}</p>
                </div>
              )}
            </section>
            <ActivitySignup kind="events" id={doc.id} compact />
            {!doc.signupForm?.enabled && (
              <section className={styles.factPanel}>
                <h2>{signupStateLabel("", registration, locale)}</h2>
                <dl className={styles.facts}>
                  <div>
                    <dt>{t("报名开始", "Sign-up opens")}</dt>
                    <dd>{formatWhen(doc.registrationStart, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t("报名截止", "Sign-up closes")}</dt>
                    <dd>
                      {doc.registrationEnd
                        ? formatWhen(doc.registrationEnd, locale)
                        : t("未设定", "Not set")}
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
                        {t("前往外部报名", "Sign up externally")}
                      </a>
                    )}
                    {doc.channelText && (
                      <p className="preserve">{doc.channelText}</p>
                    )}
                    <Picture id={doc.qrCode} />
                    <p className={styles.supportText}>
                      {t("报名和取消规则以受理平台说明为准。", "Sign-up and cancellation rules follow the host platform.")}
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
                  <p className={styles.supportText}>
                    {t(`渠道核验：${formatDate(doc.channelCheckedAt)}`, `Channel verified: ${formatWhen(doc.channelCheckedAt, locale)}`)}
                  </p>
                )}
              </section>
            )}
            {doc.signupForm?.enabled && doc.contact && (
              <p className={styles.supportText}>
                {t("参与咨询：", "Questions: ")}
                {doc.contact}
              </p>
            )}
          </aside>
        )}
        <article id="activity-content" className={styles.readingBody}>
          {doc.cover && (
            <figure className={styles.cover}>
              <Picture id={doc.cover} priority />
            </figure>
          )}
          {isEvent && <h2 className={styles.sectionTitle}>{t("活动说明", "About this event")}</h2>}
          <Prose doc={doc} />
          {collection === "albums" && (
            <section aria-label={t("活动照片", "Event photos")}>
              <div className={styles.result}>
                <h2>{t("相册照片", "Album photos")}</h2>
                <span>{t(`${doc.photos?.length || 0} 张公开照片`, `${doc.photos?.length || 0} public photos`)}</span>
              </div>
              {!doc.photos?.length && (
                <p className={styles.empty}>{t("暂无获准公开的照片。", "No photos approved for public viewing yet.")}</p>
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
              <h2>{t("相关档案", "Related records")}</h2>
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
              <h2>{t("活动回顾", "Recaps")}</h2>
              {news.docs.map((item) => (
                <Link key={item.id} href={`/news/${item.slug}`}>
                  {item.title}
                </Link>
              ))}
            </section>
          )}
          {albums && albums.docs.length > 0 && (
            <section className={styles.related}>
              <h2>{t("活动相册", "Albums")}</h2>
              {albums.docs.map((item) => (
                <Link key={item.id} href={`/gallery/${item.slug}`}>
                  {item.title}
                </Link>
              ))}
            </section>
          )}
          <p className={styles.backLink}>
            <Link href={routes[collection]}>{t(`返回${labels[collection].zh}列表`, `Back to ${labels[collection].en.toLowerCase()}`)}</Link>
          </p>
        </article>
      </div>
    </>
  );
}
