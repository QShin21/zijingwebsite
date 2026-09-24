import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { cms, bySlug } from "@/lib/content";
import { canParticipate, formatDate } from "@/lib/rules";
import { commentAction } from "../../../actions";
export default async function ForumThread({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ message?: string }>;
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
    limit: 100,
    depth: 0,
  });
  return (
    <>
      <PageHeading
        title={post.title}
        eyebrow="FORUM / DISCUSSION"
        description={`${post.authorName} · ${formatDate(post.createdAt)}`}
        parent={{ href: `/community/${slug}`, label: game.title }}
      />
      <section className="member-shell">
        <p className="preserve thread-body">{post.body}</p>
        <h2>回复</h2>
        <p role="status">{(await searchParams).message}</p>
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
