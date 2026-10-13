import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Where } from "payload";
import { bySlug, cms } from "@/lib/content";
import {
  canParticipate,
  canReviewPromotion,
  canReviewShowcase,
  managesGame,
} from "@/lib/rules";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { ShowcaseForm } from "@/components/ShowcaseForm";
import { ShowcaseCard } from "@/components/ShowcaseCard";
import { TeamHonorPins } from "@/components/TeamHonorArchives";
import {
  EmptyState,
  SignalGraphic,
} from "@/components/activity-pages/PublicPages";
import styles from "@/components/activity-pages/ActivityPages.module.css";
export default async function Showcase({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; view?: string; message?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  const manager = canReviewShowcase(user, game.id);
  const view =
    query.view === "mine" && canParticipate(user)
      ? "mine"
      : query.view === "review" && manager
        ? "review"
        : "public";
  const page = pageNumber(query.page);
  const where: Where = { game: { equals: game.id } };
  if (view === "public") where.status = { equals: "visible" };
  if (view === "mine") where.author = { equals: user!.id };
  if (view === "review")
    where.status = { in: ["pending", "rejected", "hidden"] };
  const posts = await p.find({
    collection: "community-showcase",
    overrideAccess: false,
    user: view === "public" ? null : user,
    depth: 0,
    where,
    sort: "-createdAt",
    limit: 6,
    page,
    select: {
      title: true,
      body: true,
      images: true,
      videoURL: true,
      status: true,
      authorName: true,
      createdAt: true,
      ...(view !== "public" ? { reviewNote: true } : {}),
    },
  });
  const base = `/community/${slug}/showcase`;
  return (
    <section className={`community-page ${styles.page} ${styles.community}`}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>MOMENTS / COMMUNITY</p>
          <h2>社群风采</h2>
          <p>把共同经历的精彩留在这里。</p>
        </div>
        <SignalGraphic label="MOMENTS WE SHARE" />
      </header>
      <nav className={styles.tabs} aria-label="风采筛选">
        <Link href={base} aria-current={view === "public" ? "page" : undefined}>
          公开风采
        </Link>
        {canParticipate(user) && (
          <Link
            href={`${base}?view=mine`}
            aria-current={view === "mine" ? "page" : undefined}
          >
            我的投稿
          </Link>
        )}
        {manager && (
          <Link
            href={`${base}?view=review`}
            aria-current={view === "review" ? "page" : undefined}
          >
            审核投稿
          </Link>
        )}
      </nav>
      <p role="status">{query.message}</p>
      {view === "public" && page === 1 && (
        <TeamHonorPins payload={p} game={game.id} />
      )}
      <div className="showcase-feed">
        {posts.docs.map((post) => (
          <ShowcaseCard
            key={post.id}
            post={post}
            manager={manager}
            privateView={view !== "public"}
            promotionHref={
              post.status === "visible" &&
              (managesGame(user, game.id) || canReviewPromotion(user))
                ? "/community/promotions?source=community-showcase&id=" +
                  post.id
                : undefined
            }
          />
        ))}
      </div>
      {!posts.docs.length && (
        <EmptyState
          title={
            view === "public"
              ? "暂无已发布的风采"
              : view === "mine"
                ? "你还没有风采投稿"
                : "当前没有待处理的投稿"
          }
        >
          <p>
            {view === "public"
              ? "欢迎分享活动记录，投稿审核通过后会在这里公开。"
              : view === "mine"
                ? "可以通过下方分享入口记录活动，再从这里查看审核状态。"
                : "新的投稿会按现有权限在此展示。"}
          </p>
        </EmptyState>
      )}
      <CommunityPager
        page={page}
        pages={posts.totalPages}
        base={base}
        query={view !== "public" ? `&view=${view}` : ""}
      />
      {canParticipate(user) ? (
        <ShowcaseForm game={game.id} manager={manager} />
      ) : (
        <Link className="button" href="/login">
          登录后分享社群风采
        </Link>
      )}
    </section>
  );
}
