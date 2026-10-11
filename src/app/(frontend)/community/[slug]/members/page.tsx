import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms, bySlug } from "@/lib/content";
import { canHandleCommunityJoins } from "@/lib/rules";
import { joinLabels } from "@/lib/community-status";
import { handleJoinAction } from "../../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
export default async function Members({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; message?: string }> }) {
  const { slug } = await params, query = await searchParams;
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const game = await bySlug("games", slug);
  if (!game || !canHandleCommunityJoins(user, game.id)) notFound();
  const page = pageNumber(query.page);
  const rows = await p.find({ collection: "community-joins", overrideAccess: false, user, depth: 0, limit: 20, page, sort: "createdAt",
    where: { and: [{ game: { equals: game.id } }, { status: { in: ["requested", "friendReported", "awaitingInvite"] } }] } });
  return <section className="member-shell"><h2>人工进群管理</h2><p>先在微信核实好友申请，再实际拉群。仅在微信操作完成后保存对应人工确认。</p>
    <p role="status">{query.message}</p>
    {rows.docs.map(row => <article className="panel" key={row.id}><h3>{row.memberName}</h3><p>{joinLabels[row.status]}</p>
      <form action={handleJoinAction} className="member-form"><input type="hidden" name="game" value={game.id} /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="revision" value={row.updatedAt} />
        <label>处理说明（可选）<textarea name="note" maxLength={500} rows={2} /></label>
        {row.status === "awaitingInvite" ? <SubmitButton name="action" value="confirmJoined">已人工拉群，确认进群</SubmitButton>
          : <SubmitButton name="action" value="confirmFriend">好友已通过，等待拉群</SubmitButton>}
      </form></article>)}
    {!rows.docs.length && <p>暂无待处理进群意向。</p>}
    <CommunityPager page={page} pages={rows.totalPages} base={`/community/${slug}/members`} />
  </section>;
}
