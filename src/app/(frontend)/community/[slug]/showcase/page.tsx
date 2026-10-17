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
import { ShowcaseCard } from "@/components/ShowcaseCard";
import { TeamHonorPins } from "@/components/TeamHonorArchives";
import {
  CommunityEmpty,
  CommunityPageHeader,
} from "@/components/community-pages/CommunityPages";
import { ClubFrame } from "../../../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";
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
    <ClubFrame className={`${styles.page} ${styles.body}`}>
      <CommunityPageHeader
        title={
          view === "review"
            ? "风采投稿审核"
            : view === "mine"
              ? "我的风采投稿"
              : "社群风采"
        }
        description={
          view === "review"
            ? "核对社群经历与媒体内容，为投稿留下明确的处理意见。"
            : view === "mine"
              ? "查看你分享的活动记录与审核状态。"
              : "照片、视频和代表队荣誉，记录一起参与的校园生活。"
        }
        action={
          canParticipate(user) ? (
            <Link className="button light" href={`${base}/new`}>
              分享社群风采
            </Link>
          ) : undefined
        }
      />
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
      <div className={view === "review" ? undefined : styles.contentWorkspace}>
        <section aria-label={view === "public" ? "公开风采记录" : "投稿记录"}>
          <div className={styles.feed}>
            {posts.docs.map((post) => (
              <ShowcaseCard
                key={post.id}
                post={post}
                manager={manager}
                privateView={view !== "public"}
                href={
                  post.status === "visible" ? `${base}/${post.id}` : undefined
                }
                returnQuery={new URLSearchParams({
                  view,
                  ...(query.page ? { page: String(page) } : {}),
                }).toString()}
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
            <CommunityEmpty
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
                    ? "通过分享入口记录活动，再从这里查看审核状态。"
                    : "新的投稿会按现有权限在此展示。"}
              </p>
            </CommunityEmpty>
          )}
          <CommunityPager
            page={page}
            pages={posts.totalPages}
            base={base}
            query={view !== "public" ? `&view=${view}` : ""}
          />
        </section>
        {view !== "review" && (
          <aside className={styles.publishAside}>
            <h2>记录一次共同经历</h2>
            <p>分享你有权发布的活动照片与视频；社群管理员审核后展示。</p>
            <Link href={`${base}/new`}>前往分享入口</Link>
          </aside>
        )}
      </div>
    </ClubFrame>
  );
}
