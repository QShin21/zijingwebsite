import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import type { Where } from "payload";
import { PageHeading } from "@/components/PageHeading";
import { PromotionControls } from "@/components/PromotionControls";
import { Pagination } from "@/components/Content";
import { cms } from "@/lib/content";
import { readPromotionSource } from "@/lib/content-promotions";
import { canParticipate, canReviewPromotion, communityIDs, managesGame, formatDate } from "@/lib/rules";
import { promotionKindLabels, promotionStatusLabels, supportedPromotionKinds, type PromotionHistory, type PromotionSnapshot, type PromotionSource } from "@/lib/promotion-model";

export default async function Promotions({ searchParams }: { searchParams: Promise<{ view?: string; source?: string; id?: string; page?: string; message?: string }> }) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  if (!canParticipate(user)) redirect("/login");
  const query = await searchParams, reviewer = canReviewPromotion(user), review = query.view === "review";
  if (review && !reviewer) notFound();
  const page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1)));
  const records = await p.find({ collection: "content-promotions", user, overrideAccess: false, depth: 0, page, limit: 20, sort: "-updatedAt",
    where: review ? { status: { equals: "pending" } } : {} });
  const scope: Where[] = [{ status: { equals: "visible" } }, { category: { in: supportedPromotionKinds.filter(kind => kind !== "showcase") } }];
  if (!reviewer) scope.push({ game: { in: communityIDs(user, "publishContent") } });
  if (query.source === "community-posts" && /^\d+$/.test(query.id ?? "")) scope.push({ id: { equals: Number(query.id) } });
  const candidates = review ? { docs: [] } : await p.find({ collection: "community-posts", user: null, overrideAccess: false, depth: 0, limit: 20, sort: "-createdAt",
    where: { and: scope }, select: { title: true } });
  const sources = (await Promise.all(candidates.docs.map(doc => readPromotionSource(p, "community-posts", doc.id).catch(() => null)))).filter(source => source !== null);
  const current = sources.length ? await p.find({ collection: "content-promotions", user, overrideAccess: false, depth: 0, pagination: false, limit: 0,
    where: { sourceKey: { in: sources.map(source => "community-posts:" + source.doc.id) } } }) : { docs: [] };
  const byKey = new Map(current.docs.map(row => [row.sourceKey, row]));
  return <>
    <PageHeading title={review ? "升推审核工作台" : "社群升推工作台"} eyebrow="COMMUNITY HIGHLIGHTS"
      description="将已发布的社群内容推荐到社团首页。原社群归属、活动和报名记录保持；修改正文、问卷或媒体会撤下升推展示，需重新申请复审。" />
    <section className="member-shell">
      <nav className="community-tabs" aria-label="升推工作台"><Link href="/community/promotions" aria-current={!review ? "page" : undefined}>内容与进度</Link>
        {reviewer && <Link href="/community/promotions?view=review" aria-current={review ? "page" : undefined}>待审核申请</Link>}</nav>
      <p role="status">{query.message}</p>
      {!review && <><h2>可升推内容</h2>{!sources.length && <p>暂无可升推的已发布内容。请先在负责的社群发布内容，或核对当前任职。</p>}
        <div className="community-list">{sources.map(source => { const row = byKey.get("community-posts:" + source.doc.id); return <article className="panel" key={source.doc.id} data-promotion-source={"community-posts:" + source.doc.id}>
          <small>{source.game.title} · {promotionKindLabels[source.kind]} · {row ? promotionStatusLabels[row.status] : "尚未申请"}</small>
          <h3><Link href={source.href}>{source.snapshot.title}</Link></h3><p className="preserve">{source.snapshot.body}</p>
          {row?.reviewNote && <p>处理意见：{row.reviewNote}</p>}
          <PromotionControls collection="community-posts" id={source.doc.id} version={source.version} current={row} manager={managesGame(user, source.game.id)} reviewer={reviewer} actor={user!.id} />
        </article>; })}</div></>}
      <h2>{review ? "待审核" : "升推记录"}</h2>
      {!records.docs.length && <p>{review ? "目前没有待审核的升推申请。" : "暂无升推记录。"}</p>}
      <div className="community-list">{records.docs.map(row => {
        const snapshot = (row.requestedSnapshot ?? row.approvedSnapshot) as unknown as PromotionSnapshot | null;
        const history = Array.isArray(row.history) ? row.history as unknown as PromotionHistory[] : [];
        return <article className="panel" key={row.id} data-promotion-record={row.id}>
          <h3>{snapshot?.title ?? "历史内容"}</h3><p>{promotionStatusLabels[row.status]} · {formatDate(row.updatedAt)}</p>
          {row.reason && <p>申请理由：{row.reason}</p>}{row.reviewNote && <p>处理意见：{row.reviewNote}</p>}
          {review && <><p className="preserve">{snapshot?.body}</p><PromotionControls collection={row.sourceCollection as PromotionSource} id={row.sourceID}
            version={row.requestedVersion ?? ""} current={row} manager={false} reviewer={reviewer} actor={user!.id} /></>}
          <details><summary>查看处理记录</summary><ol>{history.map((entry, index) => <li key={index}>{formatDate(entry.at)} · {entry.actorName} · {promotionStatusLabels[entry.to] ?? entry.to}{entry.reason && "：" + entry.reason}</li>)}</ol></details>
        </article>;
      })}</div><Pagination page={page} total={records.totalPages} path="/community/promotions" />
    </section>
  </>;
}
