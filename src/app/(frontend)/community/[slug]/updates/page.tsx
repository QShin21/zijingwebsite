import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { managesGame, formatDate } from "@/lib/rules";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { CommunityActivityComposer } from "@/components/CommunityActivityComposer";
import { StaffRecruitmentNotice } from "@/components/StaffRecruitmentNotice";

export default async function Updates({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; message?: string }> }) {
  const { slug } = await params; const query = await searchParams;
  const game = await bySlug("games", slug); if (!game) notFound();
  const p = await cms(); const { user } = await p.auth({ headers: await headers() });
  const page = pageNumber(query.page);
  const entries = await p.find({ collection: "community-posts", overrideAccess: false, user: null, depth: 0,
    where: { game: { equals: game.id } }, sort: "-createdAt", limit: 10, page,
    select: { title: true, body: true, category: true, createdAt: true, authorName: true } });
  return <section className="community-page"><h2>活动与通知</h2><p role="status">{query.message}</p>
    <StaffRecruitmentNotice />
    <div className="community-list">{entries.docs.map(post => <article className="panel" key={post.id}>
      <small>{post.category === "event" ? "社群活动" : "社群通知"} · {formatDate(post.createdAt)}</small>
      <h3><Link href={`/community/${slug}/updates/${post.id}`}>{post.title}</Link></h3>
      <p className="community-excerpt">{post.body}</p><Link href={`/community/${slug}/updates/${post.id}`}>阅读全文 ↗</Link>
    </article>)}</div>{!entries.docs.length && <p>暂无活动与通知。</p>}
    <CommunityPager page={page} pages={entries.totalPages} base={`/community/${slug}/updates`} />
    {managesGame(user, game.id) && <CommunityActivityComposer game={game.id} />}
  </section>;
}
