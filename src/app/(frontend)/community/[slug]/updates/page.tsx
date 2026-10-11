import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { managesGame, formatDate } from "@/lib/rules";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { SubmitButton } from "@/components/SubmitButton";
import { publishCommunityAction } from "../../actions";
export default async function Updates({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; message?: string }> }) {
  const { slug } = await params; const query = await searchParams;
  const game = await bySlug("games", slug); if (!game) notFound();
  const p = await cms(); const { user } = await p.auth({ headers: await headers() });
  const page = pageNumber(query.page);
  const entries = await p.find({ collection: "community-posts", overrideAccess: false, user: null, depth: 0,
    where: { game: { equals: game.id } }, sort: "-createdAt", limit: 10, page,
    select: { title: true, body: true, category: true, createdAt: true, authorName: true } });
  return <section className="community-page"><h2>活动与通知</h2><p role="status">{query.message}</p>
    <div className="community-list">{entries.docs.map(post => <article className="panel" key={post.id}>
      <small>{post.category === "event" ? "社群活动" : "社群通知"} · {formatDate(post.createdAt)}</small>
      <h3><Link href={`/community/${slug}/updates/${post.id}`}>{post.title}</Link></h3>
      <p className="community-excerpt">{post.body}</p><Link href={`/community/${slug}/updates/${post.id}`}>阅读全文 ↗</Link>
    </article>)}</div>{!entries.docs.length && <p>暂无活动与通知。</p>}
    <CommunityPager page={page} pages={entries.totalPages} base={`/community/${slug}/updates`} />
    {managesGame(user, game.id) && <details className="panel"><summary>发布活动与通知</summary><form className="member-form" action={publishCommunityAction}>
      <input type="hidden" name="game" value={game.id} /><label>类型<select name="kind"><option value="event">社群活动</option><option value="notice">社群通知</option></select></label>
      <label>标题<input name="title" maxLength={120} required /></label><label>内容<textarea name="body" rows={8} maxLength={5000} required /></label><SubmitButton className="button">发布</SubmitButton>
    </form></details>}
  </section>;
}
