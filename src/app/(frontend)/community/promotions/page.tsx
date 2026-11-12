import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import type { Where } from "payload";
import { PromotionControls } from "@/components/PromotionControls";
import { cms } from "@/lib/content";
import { readPromotionSource } from "@/lib/content-promotions";
import { canParticipate, canReviewPromotion, communityIDs, managesGame, formatDate } from "@/lib/rules";
import {
  promotionKindLabels,
  promotionStatusLabels,
  supportedPromotionKinds,
  type PromotionHistory,
  type PromotionSnapshot,
  type PromotionSource,
} from "@/lib/promotion-model";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { EmptyState, LinkTabs, Pager, Section, StatusPill, type Tone } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";

export const metadata = { title: "内容升推", robots: { index: false, follow: false } };

const tone = (status?: string | null): Tone =>
  status === "approved" ? "success" : status === "pending" ? "info" : status === "returned" || status === "stale" ? "warning" : status === "rejected" ? "danger" : "neutral";

export default async function Promotions({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; source?: string; id?: string; page?: string; message?: string }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!canParticipate(user)) redirect("/login");
  const query = await searchParams,
    reviewer = canReviewPromotion(user),
    review = query.view === "review";
  if (review && !reviewer) notFound();
  const page = Math.max(1, Math.min(10000, Math.floor(Number(query.page) || 1)));
  const returnQuery = new URLSearchParams({
    ...(review ? { view: "review" } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.id ? { id: query.id } : {}),
    ...(query.page ? { page: String(page) } : {}),
  }).toString();
  const records = await p.find({
    collection: "content-promotions",
    user,
    overrideAccess: false,
    depth: 0,
    page,
    limit: 20,
    sort: "-updatedAt",
    where: review ? { status: { equals: "pending" } } : {},
  });
  const scope: Where[] = [{ status: { equals: "visible" } }, { category: { in: supportedPromotionKinds.filter((kind) => kind !== "showcase") } }];
  if (!reviewer) scope.push({ game: { in: communityIDs(user, "publishContent") } });
  if (query.source === "community-posts" && /^\d+$/.test(query.id ?? "")) scope.push({ id: { equals: Number(query.id) } });
  const candidates =
    review || query.source === "community-showcase"
      ? { docs: [] }
      : await p.find({ collection: "community-posts", user: null, overrideAccess: false, depth: 0, limit: 20, sort: "-createdAt", where: { and: scope }, select: { title: true } });
  const showcaseScope: Where[] = [{ status: { equals: "visible" } }];
  if (!reviewer) showcaseScope.push({ game: { in: communityIDs(user, "publishContent") } });
  if (query.source === "community-showcase" && /^\d+$/.test(query.id ?? "")) showcaseScope.push({ id: { equals: Number(query.id) } });
  const showcases =
    review || query.source === "community-posts"
      ? { docs: [] }
      : await p.find({ collection: "community-showcase", user: null, overrideAccess: false, depth: 0, limit: 20, sort: "-createdAt", where: { and: showcaseScope }, select: { title: true } });
  const sources = (
    await Promise.all([
      ...candidates.docs.map((doc) => readPromotionSource(p, "community-posts", doc.id).catch(() => null)),
      ...showcases.docs.map((doc) => readPromotionSource(p, "community-showcase", doc.id).catch(() => null)),
    ])
  ).filter((source) => source !== null);
  const current = sources.length
    ? await p.find({
        collection: "content-promotions",
        user,
        overrideAccess: false,
        depth: 0,
        pagination: false,
        limit: 0,
        where: { sourceKey: { in: sources.map((source) => source.collection + ":" + source.doc.id) } },
      })
    : { docs: [] };
  const byKey = new Map(current.docs.map((row) => [row.sourceKey, row]));
  const recordSources = new Map(
    await Promise.all(
      records.docs.map(async (row) => [row.id, await readPromotionSource(p, row.sourceCollection, row.sourceID).catch(() => null)] as const),
    ),
  );

  return (
    <TaskFrame
      wide
      eyebrow={review ? "PROMOTION · 升推审核" : "PROMOTION · 内容升推"}
      title={review ? "升推审核" : "内容升推"}
      description={
        review
          ? "核对申请时的内容与当前版本，再决定是否展示到社团首页。"
          : "把已发布的活动、通知与风采推荐到社团首页，在这里跟进审核与展示状态。"
      }
      back={{ href: "/community", label: "游戏社群" }}
      aside={
        <TaskNote title="升推只改变展示范围" links={[{ href: "/community", label: "返回游戏社群" }]}>
          <p>社群归属、报名入口与报名记录沿用原内容；正文、问卷或媒体更新后需要重新审核。</p>
          <p>审核时以申请时的内容为准，原内容版本变化后不能直接批准。</p>
        </TaskNote>
      }
    >
      <LinkTabs
        label="升推工作台"
        items={[
          { href: "/community/promotions", label: "内容与进度", current: !review },
          ...(reviewer ? [{ href: "/community/promotions?view=review", label: "待审核申请", current: review }] : []),
        ]}
      />
      {query.message && (
        <p className={work.status} role="status" aria-label="升推操作结果">
          {query.message}
        </p>
      )}

      {!review && (
        <Section id="promotion-candidates" title="可升推内容" description="当前有权处理的已发布内容。">
          {sources.length ? (
            <div className={work.records}>
              {sources.map((source) => {
                const key = source.collection + ":" + source.doc.id,
                  row = byKey.get(key);
                return (
                  <article className={work.record} key={key} data-promotion-source={key} data-state={row?.status}>
                    <header className={work.recordHead}>
                      <div>
                        <p className={work.meta}>
                          {source.game.title} · {promotionKindLabels[source.kind]}
                        </p>
                        <h3>
                          <Link href={source.href}>{source.snapshot.title}</Link>
                        </h3>
                      </div>
                      <StatusPill tone={tone(row?.status)}>{row ? promotionStatusLabels[row.status] : "尚未申请"}</StatusPill>
                    </header>
                    <div className={work.split}>
                      <div className={work.submission}>
                        <h4>内容摘要</h4>
                        <p className="preserve">{source.snapshot.body}</p>
                        <Link className={work.chipLink} href={source.href}>
                          查看完整内容
                        </Link>
                        {row?.reviewNote && (
                          <>
                            <h4>处理意见</h4>
                            <p className="preserve">{row.reviewNote}</p>
                          </>
                        )}
                      </div>
                      <div className={work.decision}>
                        <PromotionControls
                          collection={source.collection}
                          id={source.doc.id}
                          version={source.version}
                          current={row}
                          manager={managesGame(user, source.game.id)}
                          reviewer={reviewer}
                          actor={user!.id}
                          returnQuery={returnQuery}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="暂无可升推内容" icon="megaphone" compact>
              请先在负责的社群发布内容，或核对当前任职。
            </EmptyState>
          )}
        </Section>
      )}

      <Section id="promotion-records" title={review ? "待审核申请" : "升推记录"} description={`${records.totalDocs} 条记录`}>
        {records.docs.length ? (
          <div className={work.records}>
            {records.docs.map((row) => {
              const snapshot = (row.requestedSnapshot ?? row.approvedSnapshot) as unknown as PromotionSnapshot | null;
              const history = Array.isArray(row.history) ? (row.history as unknown as PromotionHistory[]) : [];
              const original = recordSources.get(row.id);
              return (
                <article className={work.record} key={row.id} data-promotion-record={row.id} data-state={row.status}>
                  <header className={work.recordHead}>
                    <div>
                      <h3>{snapshot?.title ?? "历史内容"}</h3>
                      <p className={work.meta}>
                        更新于 <time dateTime={row.updatedAt}>{formatDate(row.updatedAt)}</time>
                      </p>
                    </div>
                    <StatusPill tone={tone(row.status)}>{promotionStatusLabels[row.status]}</StatusPill>
                  </header>
                  <div className={review ? work.split : undefined}>
                    <div className={work.submission}>
                      {row.reason && (
                        <>
                          <h4>申请理由</h4>
                          <p className="preserve">{row.reason}</p>
                        </>
                      )}
                      {row.reviewNote && (
                        <>
                          <h4>处理意见</h4>
                          <p className="preserve">{row.reviewNote}</p>
                        </>
                      )}
                      {review && (
                        <>
                          <h4>申请时的内容</h4>
                          <p className="preserve">{snapshot?.body}</p>
                        </>
                      )}
                      {original ? (
                        <Link className={work.chipLink} href={original.href}>
                          查看原内容、照片或报名表
                        </Link>
                      ) : (
                        <p>原内容目前无法公开，升推展示已关闭。</p>
                      )}
                      <details className={work.disclosure}>
                        <summary>查看处理记录</summary>
                        <ol>
                          {history.map((entry, index) => (
                            <li key={index}>
                              <time dateTime={entry.at}>{formatDate(entry.at)}</time> {entry.actorName} {promotionStatusLabels[entry.to] ?? entry.to}
                              {entry.reason && "：" + entry.reason}
                            </li>
                          ))}
                        </ol>
                      </details>
                    </div>
                    {review && (
                      <section className={work.decision} aria-label="升推审核决定">
                        <h4>审核决定</h4>
                        <PromotionControls
                          collection={row.sourceCollection as PromotionSource}
                          id={row.sourceID}
                          version={row.requestedVersion ?? ""}
                          current={row}
                          manager={false}
                          reviewer={reviewer}
                          actor={user!.id}
                          canApprove={Boolean(original && original.version === row.requestedVersion)}
                          returnQuery={returnQuery}
                        />
                      </section>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title={review ? "目前没有待审核的升推申请" : "暂无升推记录"} icon="inbox" compact>
            {review ? "新的申请会按当前审核权限在此显示。" : "申请或处理升推后，可在这里查看进度与历史。"}
          </EmptyState>
        )}
        <Pager
          page={page}
          totalPages={records.totalPages}
          path="/community/promotions"
          query={{ ...(review ? { view: "review" } : {}), ...(query.source ? { source: query.source } : {}), ...(query.id ? { id: query.id } : {}) }}
        />
      </Section>
    </TaskFrame>
  );
}
