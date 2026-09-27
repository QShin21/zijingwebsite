import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CommunityReactions } from "@/components/CommunityReactions";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { cms, bySlug } from "@/lib/content";
import { canParticipate, formatDate } from "@/lib/rules";
import { commentAction } from "../../../actions";
export default async function ForumThread({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ message?: string; page?: string }>;
}) {
  const { slug, id } = await params;
  const game = await bySlug("games", slug);
  if (!game || !/^\d+$/.test(id)) notFound();
  const p = await cms();
  const post = await p
    .findByID({
      collection: "forum-posts",
      id: Number(id),
      overrideAccess: false,
      user: null,
      depth: 0,
    })
    .catch(() => null);
  if (!post || Number(post.game) !== game.id) notFound();
  const { user } = await p.auth({ headers: await headers() });
  const query = await searchParams;
  const page = pageNumber(query.page);
  const comments = await p.find({
    collection: "comments",
    overrideAccess: false,
    user: null,
    where: {
      and: [
        { targetType: { equals: "forum-posts" } },
        { targetId: { equals: post.id } },
      ],
    },
    sort: "createdAt",
    limit: 30,
    page,
    depth: 0,
  });
  return (
    <>
      <section className="member-shell">
        <Link href={`/community/${slug}/forum`}>← 返回论坛</Link><h2>{post.title}</h2><p>{post.authorName} · {formatDate(post.createdAt)}</p>
        <p className="preserve thread-body">{post.body}</p>
        <CommunityReactions targetType="forum-posts" targetId={post.id} />
        <h2>回复</h2>
        <p role="status">{query.message}</p>
        {!comments.docs.length && (
          <p className="section-description">暂无回复，欢迎分享你的想法。</p>
        )}
        {comments.docs.map((comment) => (
          <article className="community-message" key={comment.id}>
            <strong>{comment.authorName}</strong>
            <small>{formatDate(comment.createdAt)}</small>
            <p className="preserve">{comment.body}</p>
          </article>
        ))}
        <CommunityPager page={page} pages={comments.totalPages} base={`/community/${slug}/forum/${post.id}`} />
        {canParticipate(user) && (
          <form className="member-form" action={commentAction}>
            <input type="hidden" name="targetType" value="forum-posts" />
            <input type="hidden" name="targetId" value={post.id} />
            <label>
              回复
              <textarea name="body" maxLength={5000} required rows={4} />
            </label>
            <SubmitButton className="button light">发表回复</SubmitButton>
          </form>
        )}
        {!canParticipate(user) && (
          <Link className="button" href="/login">
            登录后参与回复
          </Link>
        )}
      </section>
    </>
  );
}
