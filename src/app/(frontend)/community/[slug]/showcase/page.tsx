import Link from "next/link";
import { notFound } from "next/navigation";
import type { Where } from "payload";
import { getShowcase } from "@/lib/v2";
import { bySlug } from "@/lib/content";
import { canReviewPromotion, canReviewShowcase, managesGame } from "@/lib/rules";
import { ShowcaseCard } from "@/components/ShowcaseCard";
import { TeamHonorPins } from "@/components/TeamHonorArchives";
import { pageNumber, read, request, single, type Search } from "@/components/v2/data";
import { ButtonLink, EmptyState, LinkTabs, Notice, Pager, Wrap } from "@/components/v2/ui";
import { ShowcaseTile } from "@/components/v2/cards";
import { empty } from "@/components/v2/copy";
import layout from "@/components/v2/layout.module.css";
import styles from "@/components/v2/community.module.css";
import legacy from "@/components/community-pages/CommunityPages.module.css";
import { getT } from "@/lib/i18n/server";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";

export default async function Showcase({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Search }) {
  const { slug } = await params;
  const { t, locale } = await getT();
  const search = await searchParams;
  const [game, { payload, user }] = await Promise.all([bySlug("games", slug), request()]);
  if (!game) notFound();
  const manager = canReviewShowcase(user, game.id);
  const requested = single(search.view);
  const view = requested === "mine" && user ? "mine" : requested === "review" && manager ? "review" : "public";
  const page = pageNumber(search.page);
  const base = `/community/${slug}/showcase`;
  const message = single(search.message);

  // Public gallery comes from the V2 projection; private views keep the review workflow.
  const publicPage = view === "public" ? await read(getShowcase, { slug, view: "public", page, limit: 12 }, base) : null;
  const where: Where = { game: { equals: game.id } };
  if (view === "mine") where.author = { equals: user!.id };
  if (view === "review") where.status = { in: ["pending", "rejected", "hidden"] };
  const posts =
    view === "public"
      ? null
      : await payload.find({
          collection: "community-showcase",
          overrideAccess: false,
          user,
          depth: 0,
          where,
          sort: "-createdAt",
          limit: 6,
          page,
          select: { title: true, body: true, images: true, videoURL: true, status: true, authorName: true, createdAt: true, updatedAt: true, reviewNote: true },
        });

  return (
    <Wrap className={layout.pageBody}>
      <div className={layout.sidebarLayout}>
        <div>
          <h1 className={styles.pageTitle}>{view === "review" ? t("风采投稿审核", "Showcase review") : view === "mine" ? t("我的风采投稿", "My showcase posts") : t("社群风采", "Community showcase")}</h1>
          <LinkTabs
            label={t("风采筛选", "Showcase filter")}
            items={[
              { href: base, label: t("公开风采", "Public showcase"), current: view === "public" },
              ...(user ? [{ href: `${base}?view=mine`, label: t("我的投稿", "My posts"), current: view === "mine" }] : []),
              ...(manager ? [{ href: `${base}?view=review`, label: t("审核投稿", "Review posts"), current: view === "review" }] : []),
            ]}
          />
          {message && <Notice>{localizeAccountMessage(message, locale)}</Notice>}
          {view === "public" && page === 1 && <TeamHonorPins payload={payload} game={game.id} locale={locale} />}
          {publicPage &&
            (publicPage.docs.length ? (
              <div className={layout.grid3}>
                {publicPage.docs.map((item) => (
                  <ShowcaseTile key={item.key} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={t(empty.showcase.title, "No showcase yet")}
                icon="image"
                actions={
                  <ButtonLink href={`${base}/new`} tone="ghost" size="small">
                    {t("分享社群风采", "Share to showcase")}
                  </ButtonLink>
                }
              >
                {t(empty.showcase.body, "Members' highlights appear here after admin review.")}
              </EmptyState>
            ))}
          {publicPage && <Pager page={publicPage.page} totalPages={publicPage.totalPages} path={base} />}
          {posts && (
            <>
              <div className={legacy.feed}>
                {posts.docs.map((post) => (
                  <ShowcaseCard
                    key={post.id}
                    post={post}
                    manager={manager}
                    privateView
                    href={post.status === "visible" ? `${base}/${post.id}` : undefined}
                    returnQuery={new URLSearchParams({ view, ...(search.page ? { page: String(page) } : {}) }).toString()}
                    promotionHref={
                      post.status === "visible" && (managesGame(user, game.id) || canReviewPromotion(user))
                        ? "/community/promotions?source=community-showcase&id=" + post.id
                        : undefined
                    }
                  />
                ))}
              </div>
              {!posts.docs.length && (
                <EmptyState title={view === "mine" ? t("你还没有风采投稿", "You have no showcase posts yet") : t("当前没有待处理的投稿", "No posts awaiting review")} icon="inbox">
                  {view === "mine" ? t("通过分享入口记录活动，再从这里查看审核状态。", "Share an activity, then check its review status here.") : t("新的投稿会按现有权限在此展示。", "New posts appear here according to your permissions.")}
                </EmptyState>
              )}
              <Pager page={page} totalPages={posts.totalPages} path={base} query={{ view }} />
            </>
          )}
        </div>
        <aside className={`${layout.panel} ${layout.sticky}`}>
          <h2 className={layout.panelTitle}>{t("记录一次共同经历", "Record a shared moment")}</h2>
          <p className={styles.asideText}>{t("分享你有权发布的活动照片与视频；社群管理员审核后展示。", "Share activity photos and videos you have the right to publish; they appear after community admin review.")}</p>
          <p style={{ marginTop: 14 }}>
            <ButtonLink href={`${base}/new`} icon="plus" size="small">
              {t("分享社群风采", "Share to showcase")}
            </ButtonLink>
          </p>
          {manager && (
            <p style={{ marginTop: 10 }}>
              <Link className="text-link" href={`${base}?view=review`}>
                {t("进入审核", "Open review")}
              </Link>
            </p>
          )}
        </aside>
      </div>
    </Wrap>
  );
}
