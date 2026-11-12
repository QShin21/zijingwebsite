import Link from "next/link";
import type { ReactNode } from "react";
import type { ArticleDetail, FeedItem, Page } from "@/lib/v2";
import { ArticleTile, FeedTile, MatchCard, NoticeRow } from "./cards";
import { ButtonLink, CommunityChip, DemoPill, EmptyState, Img, LinkTabs, PageHero, Pager, Wrap } from "./ui";
import { RichText, Sections } from "./RichText";
import { empty, memberOnly } from "./copy";
import { formatDate } from "./format";
import layout from "./layout.module.css";
import styles from "./feed.module.css";

export const feedKinds = [
  { kind: "all", label: "全部", path: "/news" },
  { kind: "announcements", label: "公告", path: "/announcements" },
  { kind: "news", label: "新闻", path: "/news?kind=news" },
  { kind: "albums", label: "影像", path: "/gallery" },
  { kind: "showcase", label: "风采", path: "/news?kind=showcase" },
  { kind: "honors", label: "荣誉", path: "/news?kind=honors" },
] as const;
export type FeedKind = (typeof feedKinds)[number]["kind"];

export function FeedView({
  title,
  description,
  kind,
  result,
  signedIn,
  basePath,
  query = {},
}: {
  title: string;
  description?: string;
  kind: FeedKind;
  result: Page<FeedItem> & { restricted: boolean };
  signedIn: boolean;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  return (
    <>
      <PageHero tone="stage" title={title} description={description} />
      <Wrap className={layout.pageBody}>
        {signedIn && (
          <LinkTabs
            label="动态分类"
            items={feedKinds.map((entry) => ({ href: entry.path, label: entry.label, current: entry.kind === kind }))}
          />
        )}
        {result.docs.length ? (
          kind === "announcements" ? (
            <ul className={styles.announcements} aria-label="公告列表">
              {result.docs.map((item) => item.kind === "article" ? (
                <NoticeRow key={item.item.key} article={item.item} />
              ) : (
                <li key={item.item.key}><FeedTile item={item} /></li>
              ))}
            </ul>
          ) : (
            <div className={`${layout.mosaic} ${styles.feed}`}>
              {result.docs.map((item) => (
                <FeedTile key={item.item.key} item={item} />
              ))}
            </div>
          )
        ) : (
          <EmptyState title={kind === "announcements" ? empty.notices.title : empty.feed.title} icon="news">
            {kind === "announcements" ? empty.notices.body : empty.feed.body}
          </EmptyState>
        )}
        <Pager page={result.page} totalPages={result.totalPages} path={basePath} query={query} />
        {result.restricted && (
          <aside className={styles.restricted}>
            <p>{memberOnly}</p>
            <ButtonLink href={`/login?returnTo=${encodeURIComponent(basePath)}`} size="small">
              登录
            </ButtonLink>
          </aside>
        )}
      </Wrap>
    </>
  );
}

const backFor: Record<ArticleDetail["article"]["kind"], { href: string; label: string }> = {
  announcement: { href: "/announcements", label: "公告" },
  communityNotice: { href: "/news", label: "动态" },
  news: { href: "/news?kind=news", label: "新闻" },
  album: { href: "/gallery", label: "影像" },
};

export function ArticleView({
  detail,
  photoPath,
  extra,
  notice,
}: {
  detail: ArticleDetail;
  photoPath?: string;
  extra?: ReactNode;
  notice?: ReactNode;
}) {
  const { article, related } = detail;
  const back =
    article.kind === "communityNotice" && article.community
      ? { href: `/community/${article.community.slug}/updates`, label: `${article.community.title} · 活动与通知` }
      : backFor[article.kind];
  return (
    <>
      <PageHero
        back={back}
        eyebrow={article.label}
        title={article.title}
        description={article.summary}
        meta={
          <>
            {article.publishedAt && <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>}
            {article.community && <CommunityChip community={article.community} link />}
            {article.demo && <DemoPill />}
          </>
        }
      />
      <Wrap width="reading" className={layout.pageBody}>
        {notice}
        <article className={styles.reading}>
          {article.cover && (
            <figure className={styles.cover}>
              <Img image={article.cover} eager sizes="(min-width: 800px) 720px, 100vw" />
            </figure>
          )}
          <RichText body={detail.body} text={detail.bodyText} />
          {detail.images.length > 0 && (
            <div className={styles.images}>
              {detail.images.map((image, index) => (
                <figure key={`${image.src}-${index}`}>
                  <Img image={image} sizes="(min-width: 800px) 720px, 100vw" />
                </figure>
              ))}
            </div>
          )}
          <Sections sections={detail.sections} />
          {detail.photos && (
            <section className={styles.photos} aria-labelledby="photos-title">
              <h2 id="photos-title">
                相册照片 <span>{detail.photos.totalDocs} 张公开照片</span>
              </h2>
              {detail.photos.docs.length ? (
                <div className={styles.photoGrid}>
                  {detail.photos.docs.map((photo, index) => (
                    <figure key={`${photo.image.src}-${index}`}>
                      <Img image={photo.image} sizes="(min-width: 800px) 360px, 50vw" />
                      {photo.caption && <figcaption>{photo.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              ) : (
                <p className={styles.muted}>暂无获准公开的照片。</p>
              )}
              {photoPath && <Pager page={detail.photos.page} totalPages={detail.photos.totalPages} path={photoPath} />}
            </section>
          )}
          {(related.event || related.team) && (
            <section className={styles.related} aria-labelledby="related-title">
              <h2 id="related-title">相关</h2>
              {related.event && <MatchCard event={related.event} />}
              {related.team && (
                <Link href={`/teams/${related.team.slug}`} className={styles.teamLink}>
                  代表队：{related.team.title} →
                </Link>
              )}
            </section>
          )}
          {extra}
        </article>
      </Wrap>
    </>
  );
}

export function ArticleGrid({ items }: { items: Parameters<typeof ArticleTile>[0]["article"][] }) {
  return (
    <div className={layout.gridAuto}>
      {items.map((article) => (
        <ArticleTile key={article.key} article={article} />
      ))}
    </div>
  );
}
