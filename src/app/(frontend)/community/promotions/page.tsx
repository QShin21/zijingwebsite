import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import type { Where } from "payload";
import pageStyles from "@/components/activity-pages/ActivityPages.module.css";
import styles from "@/components/activity-pages/Workspace.module.css";
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
  const candidates = review || query.source === "community-showcase" ? { docs: [] } : await p.find({ collection: "community-posts", user: null, overrideAccess: false, depth: 0, limit: 20, sort: "-createdAt",
    where: { and: scope }, select: { title: true } });
  const showcaseScope: Where[] = [{ status: { equals: "visible" } }];
  if (!reviewer) showcaseScope.push({ game: { in: communityIDs(user, "publishContent") } });
  if (query.source === "community-showcase" && /^\d+$/.test(query.id ?? "")) showcaseScope.push({ id: { equals: Number(query.id) } });
  const showcases = review || query.source === "community-posts" ? { docs: [] } : await p.find({ collection: "community-showcase", user: null, overrideAccess: false, depth: 0, limit: 20, sort: "-createdAt",
    where: { and: showcaseScope }, select: { title: true } });
  const sources = (await Promise.all([...candidates.docs.map(doc => readPromotionSource(p, "community-posts", doc.id).catch(() => null)),
    ...showcases.docs.map(doc => readPromotionSource(p, "community-showcase", doc.id).catch(() => null))])).filter(source => source !== null);
  const current = sources.length ? await p.find({ collection: "content-promotions", user, overrideAccess: false, depth: 0, pagination: false, limit: 0,
    where: { sourceKey: { in: sources.map(source => source.collection + ":" + source.doc.id) } } }) : { docs: [] };
  const byKey = new Map(current.docs.map(row => [row.sourceKey, row]));
  const recordSources = new Map(await Promise.all(records.docs.map(async row => [row.id,
    await readPromotionSource(p, row.sourceCollection, row.sourceID).catch(() => null)] as const)));
  return <div className={`${pageStyles.page} ${styles.workspace}`}>
    <nav className={pageStyles.breadcrumbs} aria-label="工作台导航"><Link href="/community">游戏社群</Link><span aria-hidden="true">/</span><span>内容升推</span></nav>
    <header className={pageStyles.hero}><div><p className={pageStyles.eyebrow}>{review ? "社团内容审核" : "社群内容管理"}</p><h1>{review ? "升推审核" : "内容升推"}</h1><p>把已发布的社群内容推荐到社团首页。修改正文、问卷或媒体后需重新申请审核。</p></div></header>
    <section>
      <nav className={pageStyles.tabs} aria-label="升推工作台"><Link href="/community/promotions" aria-current={!review ? "page" : undefined}>内容与进度</Link>{reviewer && <Link href="/community/promotions?view=review" aria-current={review ? "page" : undefined}>待审核申请</Link>}</nav>
      <p className={styles.scope}>升推仅改变同一内容的展示范围。社群归属、报名入口与报名记录沿用原内容；申请与审核依照当前权限进行。</p>
      <p role="status">{query.message}</p>
      {!review && <><h2>可升推内容</h2>{!sources.length && <p>暂无可升推的已发布内容。请先在负责的社群发布内容，或核对当前任职。</p>}
        <div className={styles.records}>{sources.map(source => { const key = source.collection + ":" + source.doc.id, row = byKey.get(key); return <article className={styles.record} key={key} data-promotion-source={key}>
          <small>{source.game.title} · {promotionKindLabels[source.kind]} · {row ? promotionStatusLabels[row.status] : "尚未申请"}</small>
          <h3><Link href={source.href}>{source.snapshot.title}</Link></h3><p className={styles.excerpt}>{source.snapshot.body}</p>
          {row?.reviewNote && <p>处理意见：{row.reviewNote}</p>}
          <PromotionControls collection={source.collection} id={source.doc.id} version={source.version} current={row} manager={managesGame(user, source.game.id)} reviewer={reviewer} actor={user!.id} />
        </article>; })}</div></>}
      <h2>{review ? "待审核" : "升推记录"}</h2>
      {!records.docs.length && <p>{review ? "目前没有待审核的升推申请。" : "暂无升推记录。"}</p>}
      <div className={styles.records}>{records.docs.map(row => {
        const snapshot = (row.requestedSnapshot ?? row.approvedSnapshot) as unknown as PromotionSnapshot | null;
        const history = Array.isArray(row.history) ? row.history as unknown as PromotionHistory[] : [];
        const original = recordSources.get(row.id);
        return <article className={styles.record} key={row.id} data-promotion-record={row.id}>
          <h3>{snapshot?.title ?? "历史内容"}</h3><p>{promotionStatusLabels[row.status]} · {formatDate(row.updatedAt)}</p>
          {row.reason && <p>申请理由：{row.reason}</p>}{row.reviewNote && <p>处理意见：{row.reviewNote}</p>}
          {original ? <Link href={original.href}>查看原内容、照片或报名表 ↗</Link> : <p>原内容目前无法公开，升推展示已关闭。</p>}
          {review && <><p className="preserve">{snapshot?.body}</p><PromotionControls collection={row.sourceCollection as PromotionSource} id={row.sourceID}
            version={row.requestedVersion ?? ""} current={row} manager={false} reviewer={reviewer} actor={user!.id}
            canApprove={Boolean(original && original.version === row.requestedVersion)} /></>}
          <details><summary>查看处理记录</summary><ol>{history.map((entry, index) => <li key={index}>{formatDate(entry.at)} · {entry.actorName} · {promotionStatusLabels[entry.to] ?? entry.to}{entry.reason && "：" + entry.reason}</li>)}</ol></details>
        </article>;
      })}</div><Pagination page={page} total={records.totalPages} path="/community/promotions" query={{ ...(review ? { view: "review" } : {}), ...(query.source ? { source: query.source } : {}), ...(query.id ? { id: query.id } : {}) }} />
    </section>
  </div>;
}
