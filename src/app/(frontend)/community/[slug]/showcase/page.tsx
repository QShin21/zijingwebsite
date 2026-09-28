import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Where } from "payload";
import { bySlug, cms } from "@/lib/content";
import { canParticipate, managesGame } from "@/lib/rules";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { ShowcaseForm } from "@/components/ShowcaseForm";
import { ShowcaseCard } from "@/components/ShowcaseCard";
export default async function Showcase({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; view?: string; message?: string }> }) {
  const { slug } = await params; const query = await searchParams; const game = await bySlug("games", slug); if (!game) notFound();
  const p = await cms(); const { user } = await p.auth({ headers: await headers() }); const manager = managesGame(user, game.id);
  const view = query.view === "mine" && canParticipate(user) ? "mine" : query.view === "review" && manager ? "review" : "public";
  const page = pageNumber(query.page);
  const where: Where = { game: { equals: game.id } };
  if (view === "public") where.status = { equals: "visible" };
  if (view === "mine") where.author = { equals: user!.id };
  if (view === "review") where.status = { in: ["pending", "rejected", "hidden"] };
  const posts = await p.find({ collection: "community-showcase", overrideAccess: false, user: view === "public" ? null : user, depth: 0, where, sort: "-createdAt", limit: 6, page,
    select: { title: true, body: true, images: true, videoURL: true, status: true, authorName: true, createdAt: true, ...(view !== "public" ? { reviewNote: true } : {}) } });
  const base = `/community/${slug}/showcase`;
  return <section className="community-page"><h2>社群风采</h2><p>把共同经历的精彩留在这里。</p><nav className="community-tabs" aria-label="风采筛选">
    <Link href={base} aria-current={view === "public" ? "page" : undefined}>公开风采</Link>{canParticipate(user) && <Link href={`${base}?view=mine`} aria-current={view === "mine" ? "page" : undefined}>我的投稿</Link>}{manager && <Link href={`${base}?view=review`} aria-current={view === "review" ? "page" : undefined}>审核投稿</Link>}
  </nav><p role="status">{query.message}</p>
    <div className="showcase-feed">{posts.docs.map(post => <ShowcaseCard key={post.id} post={post} manager={manager} privateView={view !== "public"} />)}</div>
    {!posts.docs.length && <p>{view === "public" ? "暂无已发布的风采，欢迎分享活动记录。" : "此处暂无投稿。"}</p>}
    <CommunityPager page={page} pages={posts.totalPages} base={base} query={view !== "public" ? `&view=${view}` : ""} />
    {canParticipate(user) ? <ShowcaseForm game={game.id} manager={manager} /> : <Link href="/login">登录后分享社群风采</Link>}
  </section>;
}
