import Link from "next/link";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { formatDate } from "@/lib/rules";
import { Comments } from "@/components/Comments";
import { CommunityReactions } from "@/components/CommunityReactions";
export default async function Update({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ message?: string }> }) {
  const { slug, id } = await params; const game = await bySlug("games", slug);
  if (!game || !/^\d+$/.test(id)) notFound();
  const post = await (await cms()).findByID({ collection: "community-posts", id: Number(id), overrideAccess: false, user: null, depth: 0,
    select: { game: true, title: true, body: true, authorName: true, createdAt: true, category: true } }).catch(() => null);
  if (!post || Number(post.game) !== game.id) notFound();
  return <article className="community-article panel"><Link href={`/community/${slug}/updates`}>← 活动与通知</Link><h2>{post.title}</h2><p>{post.authorName} · {formatDate(post.createdAt)}</p>
    <p className="preserve thread-body">{post.body}</p><p role="status">{(await searchParams).message}</p>
    <CommunityReactions targetType="community-posts" targetId={post.id} event={post.category === "event"} />
    <Comments targetType="community-posts" targetId={post.id} />
  </article>;
}
