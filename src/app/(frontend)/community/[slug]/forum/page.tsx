import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Where } from "payload";
import { bySlug, cms } from "@/lib/content";
import { canParticipate, managesGame, formatDate } from "@/lib/rules";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { ForumModeration } from "@/components/ForumModeration";
import { SubmitButton } from "@/components/SubmitButton";
import { publishCommunityAction } from "../../actions";
export default async function Forum({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; sort?: string; featured?: string; message?: string }> }) {
  const { slug } = await params; const query = await searchParams;
  const game = await bySlug("games", slug); if (!game) notFound();
  const p = await cms(); const { user } = await p.auth({ headers: await headers() });
  const page = pageNumber(query.page); const hot = query.sort === "hot"; const featured = query.featured === "1";
  const where: Where = { game: { equals: game.id }, ...(featured ? { featured: { equals: true } } : {}) };
  const entries = await p.find({ collection: "forum-posts", overrideAccess: false, user: null, depth: 0, where,
    sort: hot ? ["-pinned", "-heat", "-createdAt", "-id"] : ["-pinned", "-createdAt", "-id"], limit: 20, page,
    select: { title: true, body: true, createdAt: true, authorName: true, pinned: true, featured: true, heat: true } });
  const base = `/community/${slug}/forum`;
  return <section className="community-page"><div className="dialog-top"><h2>{featured ? "精华帖集合" : "论坛讨论"}</h2>{canParticipate(user) && <a className="button" href="#compose">发表帖子 ↗</a>}</div>
    <nav className="community-tabs" aria-label="论坛筛选"><Link href={base} aria-current={!hot && !featured ? "page" : undefined}>最新发布</Link><Link href={`${base}?sort=hot`} aria-current={hot && !featured ? "page" : undefined}>按热度</Link><Link href={`${base}?featured=1`} aria-current={featured ? "page" : undefined}>精华帖集合</Link></nav>
    <p className="section-description">置顶帖优先展示 · 热度为点赞数与可见回复数之和</p><p role="status">{query.message}</p>
    <div className="forum-list">{entries.docs.map(post => <article className="panel" key={post.id}>
      <div className="forum-badges">{post.pinned && <span>置顶</span>}{post.featured && <span>精华</span>}</div>
      <h3><Link href={`${base}/${post.id}`}>{post.title}</Link></h3><p className="community-excerpt">{post.body}</p>
      <small>{post.authorName} · {formatDate(post.createdAt)} · 热度 {post.heat || 0}</small>
      {managesGame(user, game.id) && <ForumModeration id={post.id} game={game.id} pinned={Boolean(post.pinned)} featured={Boolean(post.featured)} />}
    </article>)}</div>{!entries.docs.length && <p>暂无{featured ? "精华帖" : "帖子"}。</p>}
    <CommunityPager page={page} pages={entries.totalPages} base={base} query={`${hot ? "&sort=hot" : ""}${featured ? "&featured=1" : ""}`} />
    {canParticipate(user) ? <section id="compose" className="panel"><h2>发表论坛帖子</h2><form className="member-form" action={publishCommunityAction}>
      <input type="hidden" name="game" value={game.id} /><input type="hidden" name="kind" value="forum" />
      <label>标题<input name="title" maxLength={120} required /></label><label>内容<textarea name="body" rows={8} maxLength={5000} required /></label><SubmitButton className="button">发布到论坛</SubmitButton>
    </form></section> : <Link href="/login">登录后发帖</Link>}
  </section>;
}
