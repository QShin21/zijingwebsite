import Link from "next/link";
import type { ReactNode } from "react";
import type { ArticleDetail, FeedItem, Page } from "@/lib/v2";
import { ArticleTile, FeedTile, MatchCard } from "./cards";
import { ButtonLink, CommunityChip, DemoPill, EmptyState, Img, LinkTabs, PageHero, Pager, Wrap } from "./ui";
import { RichText, Sections } from "./RichText";
import { PublicationPresentation } from "./PublicationPresentation";
import { emptyCopy, memberOnlyCopy } from "./copy";
import { getT } from "@/lib/i18n/server";
import { articleLabel } from "@/lib/i18n/labels-public";
import { formatDate } from "./format";
import layout from "./layout.module.css";
import styles from "./feed.module.css";

export const feedKinds = [
  { kind: "all", zh: "全部", en: "All", path: "/news" },
  { kind: "announcements", zh: "公告", en: "Notices", path: "/announcements" },
  { kind: "news", zh: "新闻", en: "News", path: "/news?kind=news" },
  { kind: "albums", zh: "影像", en: "Gallery", path: "/gallery" },
  { kind: "showcase", zh: "风采", en: "Showcase", path: "/news?kind=showcase" },
  { kind: "honors", zh: "荣誉", en: "Honors", path: "/news?kind=honors" },
] as const;
export type FeedKind = (typeof feedKinds)[number]["kind"];

export async function FeedView({
  title,
  description,
  kind,
  result,
  signedIn,
  basePath,
  query = {},
}: {
  title: string;
  description: string;
  kind: FeedKind;
  result: Page<FeedItem> & { restricted: boolean };
  signedIn: boolean;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  const { t } = await getT();
  const empty = emptyCopy(t);
  return (
    <>
      <PageHero tone="stage" eyebrow={t("FEED · 动态", "FEED · Updates")} title={title} description={description} />
      <Wrap className={layout.pageBody}>
        {signedIn && (
          <LinkTabs
            label={t("动态分类", "Update categories")}
            items={feedKinds.map((entry) => ({ href: entry.path, label: t(entry.zh, entry.en), current: entry.kind === kind }))}
          />
        )}
        {result.docs.length ? (
          <div className={`${layout.mosaic} ${styles.feed}`}>
            {result.docs.map((item) => (
              <FeedTile key={item.item.key} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState title={kind === "announcements" ? empty.notices.title : empty.feed.title} icon="news">
            {kind === "announcements" ? empty.notices.body : empty.feed.body}
          </EmptyState>
        )}
        <Pager page={result.page} totalPages={result.totalPages} path={basePath} query={query} />
        {result.restricted && (
          <aside className={styles.restricted}>
            <p>{memberOnlyCopy(t)}</p>
            <ButtonLink href={`/login?returnTo=${encodeURIComponent(basePath)}`} size="small">
              {t("登录", "Sign in")}
            </ButtonLink>
          </aside>
        )}
      </Wrap>
    </>
  );
}

const backFor: Record<ArticleDetail["article"]["kind"], { href: string; zh: string; en: string }> = {
  announcement: { href: "/announcements", zh: "公告", en: "Notices" },
  communityNotice: { href: "/news", zh: "动态", en: "Updates" },
  news: { href: "/news?kind=news", zh: "新闻", en: "News" },
  album: { href: "/gallery", zh: "影像", en: "Gallery" },
};

export async function ArticleView({
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
  const { t, locale } = await getT();
  const { article, related } = detail;
  const back =
    article.kind === "communityNotice" && article.community
      ? { href: `/community/${article.community.slug}/updates`, label: t(`${article.community.title} · 活动与通知`, `${article.community.title} · Events & notices`) }
      : { href: backFor[article.kind].href, label: t(backFor[article.kind].zh, backFor[article.kind].en) };
  return (
    <>
      <PageHero
        back={back}
        eyebrow={articleLabel(article.kind, article.label, locale)}
        title={article.title}
        description={article.summary}
        meta={
          <>
            {article.publishedAt && <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time>}
            {article.community && <CommunityChip community={article.community} link />}
            {article.demo && <DemoPill />}
          </>
        }
      />
      <Wrap width="reading" className={layout.pageBody}>
        {notice}
        <article className={styles.reading}>
          {article.cover && !detail.presentation && !detail.images.some(image => image.src === article.cover?.src) && (
            <figure className={styles.cover}>
              <Img image={article.cover} eager sizes="(min-width: 800px) 720px, 100vw" />
            </figure>
          )}
          {detail.presentation ? <PublicationPresentation presentation={detail.presentation} images={detail.images} text={detail.bodyText} /> : <RichText body={detail.body} text={detail.bodyText} />}
          {!detail.presentation && detail.images.length > 0 && (
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
                {t("相册照片", "Album photos")} <span>{t(`${detail.photos.totalDocs} 张公开照片`, `${detail.photos.totalDocs} public photos`)}</span>
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
                <p className={styles.muted}>{t("暂无获准公开的照片。", "No photos approved for public viewing yet.")}</p>
              )}
              {photoPath && <Pager page={detail.photos.page} totalPages={detail.photos.totalPages} path={photoPath} />}
            </section>
          )}
          {(related.event || related.team) && (
            <section className={styles.related} aria-labelledby="related-title">
              <h2 id="related-title">{t("相关", "Related")}</h2>
              {related.event && <MatchCard event={related.event} />}
              {related.team && (
                <Link href={`/teams/${related.team.slug}`} className={styles.teamLink}>
                  {t("代表队：", "Team: ")}
                  {related.team.title} →
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
