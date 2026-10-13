import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms, bySlug } from "@/lib/content";
import { canHandleCommunityJoins, formatDate } from "@/lib/rules";
import { joinLabels } from "@/lib/community-status";
import { handleJoinAction } from "../../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { ClubFrame } from "../../../_club/ClubPage";
import styles from "../../../_club/ClubPages.module.css";

export default async function Members({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; message?: string }> }) {
  const { slug } = await params, query = await searchParams;
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const game = await bySlug("games", slug);
  if (!game || !canHandleCommunityJoins(user, game.id)) notFound();
  const page = pageNumber(query.page);
  const rows = await p.find({ collection: "community-joins", overrideAccess: false, user, depth: 0, limit: 20, page, sort: "createdAt",
    where: { and: [{ game: { equals: game.id } }, { status: { in: ["requested", "friendReported", "awaitingInvite"] } }] } });
  return <ClubFrame className={styles.communityBody}>
    <section className="member-shell" aria-labelledby="manual-join-title">
      <div className={styles.sectionHead}><h2 id="manual-join-title">人工进群管理</h2><p>{rows.totalDocs} 条待处理意向</p></div>
      <p>先在微信核实好友申请，再实际拉群。仅在微信操作完成后保存对应人工确认。</p>
      <p role="status">{query.message}</p>
      {rows.docs.map(row => <article className="panel" key={row.id}>
        <div className={styles.recordHead}><h3>{row.memberName}</h3><span className={styles.status} data-state={row.status}>{joinLabels[row.status]}</span></div>
        <p className={styles.recordDate}>记录于 <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time> · 最近更新 <time dateTime={row.updatedAt}>{formatDate(row.updatedAt)}</time></p>
        {row.note && <p className="preserve">上次说明：{row.note}</p>}
        <form action={handleJoinAction} className="member-form">
          <input type="hidden" name="game" value={game.id} /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="revision" value={row.updatedAt} />
          <label>处理说明（可选）<textarea name="note" maxLength={500} rows={2} /></label>
          <div className="reaction-bar">{row.status === "awaitingInvite" ? <SubmitButton name="action" value="confirmJoined">已人工拉群，确认进群</SubmitButton>
            : <SubmitButton name="action" value="confirmFriend">好友已通过，等待拉群</SubmitButton>}</div>
        </form>
      </article>)}
      {!rows.docs.length && <div className="empty"><h3>暂无待处理进群意向</h3><p>成员记录意向或自报好友申请后，会在此显示。只有实际完成微信操作后，才更新人工确认。</p></div>}
      <CommunityPager page={page} pages={rows.totalPages} base={`/community/${slug}/members`} />
    </section>
  </ClubFrame>;
}
