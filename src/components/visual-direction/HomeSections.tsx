import Link from "next/link";
import type { Content } from "@/lib/content";
import { dateParts } from "@/lib/presentation";
import { eventState, formatDate, routeFor } from "@/lib/rules";
import { Picture } from "@/components/Content";
import { Icon } from "@/components/Identity";
import { DemoTag, designBase } from "./DesignUI";
import styles from "./Home.module.css";

export function DateStamp({ value }: { value?: string | null }) {
  const parts = dateParts(value);
  return parts && value ? (
    <time
      className={styles.dateStamp}
      dateTime={value}
      aria-label={formatDate(value)}
    >
      <span>
        {parts.year} / {parts.month}月
      </span>
      <strong>{parts.day}</strong>
    </time>
  ) : (
    <span className={styles.datePending}>时间待公布</span>
  );
}

function destination(doc: Content, kind: string, preview: boolean) {
  return kind === "events" && preview
    ? `${designBase}/activity/${doc.id}`
    : `/${routeFor[kind] || kind}/${doc.slug}`;
}

/** Each collection keeps its actual fields and reading order. */
export function HomeEntries({
  docs,
  kind,
  games,
  preview,
}: {
  docs: Content[];
  kind: string;
  games: Content[];
  preview: boolean;
}) {
  if (kind === "events")
    return (
      <div className={styles.schedule}>
        {docs.map((doc) => (
          <article className={styles.scheduleRow} key={doc.id}>
            <DateStamp value={doc.startAt} />
            <div className={styles.entryCopy}>
              <DemoTag demo={doc.demo} />
              <h3>
                <Link href={destination(doc, kind, preview)}>{doc.title}</Link>
              </h3>
              <p>{doc.summary || "查看活动安排、参与条件与报名方式。"}</p>
              {doc.location && <p className={styles.meta}>{doc.location}</p>}
            </div>
            <div className={styles.entryAction}>
              <span className={styles.state}>{eventState(doc)}</span>
              <Link
                className="z-text-link"
                href={destination(doc, kind, preview)}
              >
                活动详情 <Icon name="arrow" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    );

  if (kind === "honors")
    return (
      <div className={styles.archive}>
        {docs.map((doc) => (
          <article className={styles.archiveRow} key={doc.id}>
            <div className={styles.archiveDate}>
              {doc.date ? (
                <time dateTime={doc.date}>{formatDate(doc.date)}</time>
              ) : (
                <span>荣誉档案</span>
              )}
              {games.find((game) => game.id === doc.game)?.title && (
                <span>{games.find((game) => game.id === doc.game)?.title}</span>
              )}
            </div>
            <div className={styles.entryCopy}>
              <DemoTag demo={doc.demo} />
              <h3>
                <Link href={destination(doc, kind, preview)}>{doc.title}</Link>
              </h3>
              {doc.summary && <p>{doc.summary}</p>}
            </div>
            <div className={styles.entryAction}>
              {doc.placing && (
                <strong className={styles.placing}>{doc.placing}</strong>
              )}
              <Link
                className="z-text-link"
                href={destination(doc, kind, preview)}
              >
                查看记录 <Icon name="arrow" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    );

  if (kind === "teams")
    return (
      <div className={styles.teamDirectory}>
        {docs.map((doc) => (
          <article className={styles.teamEntry} key={doc.id}>
            <div className={styles.entryCopy}>
              <p className={styles.meta}>
                {games.find((game) => game.id === doc.game)?.title ||
                  "紫荆代表队"}
              </p>
              <DemoTag demo={doc.demo} />
              <h3>
                <Link href={destination(doc, kind, preview)}>{doc.title}</Link>
              </h3>
              {doc.summary && <p>{doc.summary}</p>}
            </div>
            <Link
              className="z-text-link"
              href={destination(doc, kind, preview)}
            >
              队伍档案 <Icon name="arrow" />
            </Link>
          </article>
        ))}
      </div>
    );

  return (
    <div className={kind === "albums" ? styles.albumShelf : styles.journal}>
      {docs.map((doc, index) => (
        <article
          className={index === 0 ? styles.leadStory : styles.story}
          key={doc.id}
        >
          {doc.cover && (
            <Link
              className={styles.storyImage}
              href={destination(doc, kind, preview)}
              tabIndex={-1}
              aria-hidden="true"
            >
              <Picture id={doc.cover} />
            </Link>
          )}
          <div className={styles.entryCopy}>
            {(doc.publishedAt || doc.date) && (
              <p className={styles.meta}>
                <time dateTime={doc.publishedAt || doc.date}>
                  {formatDate((doc.publishedAt || doc.date)!)}
                </time>
              </p>
            )}
            <DemoTag demo={doc.demo} />
            <h3>
              <Link href={destination(doc, kind, preview)}>{doc.title}</Link>
            </h3>
            {doc.summary && <p>{doc.summary}</p>}
            <Link
              className="z-text-link"
              href={destination(doc, kind, preview)}
            >
              {kind === "albums" ? "打开影像" : "阅读全文"}{" "}
              <Icon name="arrow" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
