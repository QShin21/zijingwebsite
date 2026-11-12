import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, getEventDetail } from "@/lib/v2";
import { CommunityPostImageEditor } from "@/components/CommunityPostImageEditor";
import { publicationImages } from "@/lib/publication-images";
import { bySlug } from "@/lib/content";
import { canReviewPromotion, managesGame } from "@/lib/rules";
import { read, request, single, type Search } from "@/components/v2/data";
import { EventDetailView } from "@/components/v2/EventDetail";
import { ArticleView } from "@/components/v2/Feed";
import { Notice, buttonClass } from "@/components/v2/ui";
import layout from "@/components/v2/layout.module.css";

/** Community event (A4 community) or community notice (A6) under the historic share path. */
export default async function Update({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Search }) {
  const { slug, id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const path = `/community/${slug}/updates/${id}`;
  const [game, { payload, user }, search] = await Promise.all([bySlug("games", slug), request(), searchParams]);
  if (!game) notFound();
  // Minimal anonymous read decides which view applies (hidden posts stay hidden).
  const post = await payload
    .findByID({
      collection: "community-posts",
      id: Number(id),
      overrideAccess: false,
      user: null,
      depth: 0,
      select: { game: true, category: true, postImages: true, updatedAt: true },
    })
    .catch(() => null);
  if (!post || Number(post.game) !== game.id) notFound();
  const message = single(search.message);
  const notice = message ? <Notice>{message}</Notice> : undefined;
  const canEdit = managesGame(user, game.id);
  const editor = canEdit ? (
    <section className={layout.panel} aria-label="编辑配图">
      <CommunityPostImageEditor key={post.id} id={post.id} game={game.id} images={publicationImages(post.postImages)} revision={post.updatedAt} />
    </section>
  ) : null;
  if (post.category === "event") {
    const detail = await read(getEventDetail, { source: "community", idOrSlug: id }, path);
    return <EventDetailView detail={detail} kind="community-posts" extra={editor} notice={notice} />;
  }
  const detail = await read(getArticle, { kind: "communityNotice", idOrSlug: id }, path);
  return (
    <ArticleView
      detail={detail}
      notice={notice}
      extra={
        <>
          {editor}
          {(canEdit || canReviewPromotion(user)) && (
            <section className={layout.panel}>
              <h2 className={layout.panelTitle}>管理展示范围</h2>
              <p>将当前通知申请展示到社团主页与公告。</p>
              <p style={{ marginTop: 12 }}>
                <Link className={buttonClass("ghost", "small")} href={`/community/promotions?source=community-posts&id=${post.id}`}>
                  申请社团级展示
                </Link>
              </p>
            </section>
          )}
        </>
      }
    />
  );
}
