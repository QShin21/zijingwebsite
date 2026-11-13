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
import { getT } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/i18n/locale";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";
import { keyedLabel, promotionKindLabelsEn, promotionStatusLabelsEn } from "@/lib/i18n/labels-account";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("内容升推", "Content promotion"), robots: { index: false, follow: false } };
}

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
  const { t, locale } = await getT();
  const when = (value?: string | null) => (locale === "en" ? formatDateTime(value, "en") || "TBA" : formatDate(value));
  const statusLabel = (status: string) => keyedLabel(locale, status, promotionStatusLabelsEn, promotionStatusLabels[status]);
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
      : await p.find({ collection: "community-posts", user, overrideAccess: false, depth: 0, limit: 20, sort: "-createdAt", where: { and: scope }, select: { title: true } });
  const showcaseScope: Where[] = [{ status: { equals: "visible" } }];
  if (!reviewer) showcaseScope.push({ game: { in: communityIDs(user, "publishContent") } });
  if (query.source === "community-showcase" && /^\d+$/.test(query.id ?? "")) showcaseScope.push({ id: { equals: Number(query.id) } });
  const showcases =
    review || query.source === "community-posts"
      ? { docs: [] }
      : await p.find({ collection: "community-showcase", user: null, overrideAccess: false, depth: 0, limit: 20, sort: "-createdAt", where: { and: showcaseScope }, select: { title: true } });
  const sources = (
    await Promise.all([
      ...candidates.docs.map((doc) => readPromotionSource(p, "community-posts", doc.id, undefined, true).catch(() => null)),
      ...showcases.docs.map((doc) => readPromotionSource(p, "community-showcase", doc.id, undefined, true).catch(() => null)),
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
      records.docs.map(async (row) => [row.id, await readPromotionSource(p, row.sourceCollection, row.sourceID, undefined, row.status === "approved").catch(() => null)] as const),
    ),
  );

  return (
    <TaskFrame
      wide
      eyebrow={review ? t("PROMOTION · 升推审核", "PROMOTION · Review") : t("PROMOTION · 内容升推", "PROMOTION · Content")}
      title={review ? t("升推审核", "Promotion review") : t("内容升推", "Content promotion")}
      description={
        review
          ? t("核对申请时的内容与当前版本，再决定是否展示到社团首页。", "Compare the requested content with the current version, then decide whether to show it on the club front page.")
          : t("把已发布的活动、通知与风采推荐到社团首页，在这里跟进审核与展示状态。", "Recommend published events, notices and showcase posts for the club front page, and track review and display status here.")
      }
      back={{ href: "/community", label: t("游戏社群", "Game communities") }}
      aside={
        <TaskNote title={t("升推只改变展示范围", "Promotion only changes where content is shown")} links={[{ href: "/community", label: t("返回游戏社群", "Back to communities") }]}>
          <p>{t("社群归属、报名入口与报名记录沿用原内容；正文、问卷或媒体更新后需要重新审核。", "Community, sign-up entry and sign-up records stay with the original. Changes to text, questionnaire or media need another review.")}</p>
          <p>{t("审核时以申请时的内容为准，原内容版本变化后不能直接批准。", "Reviews use the content as requested; if the original changes, it cannot be approved directly.")}</p>
        </TaskNote>
      }
    >
      <LinkTabs
        label={t("升推工作台", "Promotion workspace")}
        items={[
          { href: "/community/promotions", label: t("内容与进度", "Content and progress"), current: !review },
          ...(reviewer ? [{ href: "/community/promotions?view=review", label: t("待审核申请", "Pending requests"), current: review }] : []),
        ]}
      />
      {query.message && (
        <p className={work.status} role="status" aria-label={t("升推操作结果", "Promotion result")}>
          {localizeAccountMessage(query.message, locale)}
        </p>
      )}

      {!review && (
        <Section id="promotion-candidates" title={t("可升推内容", "Promotable content")} description={t("当前有权处理的已发布内容。", "Published content you can currently handle.")}>
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
                          {source.game.title} · {keyedLabel(locale, source.kind, promotionKindLabelsEn, promotionKindLabels[source.kind])}
                        </p>
                        <h3>
                          <Link href={source.href}>{source.snapshot.title}</Link>
                        </h3>
                      </div>
                      <StatusPill tone={tone(row?.status)}>{row ? statusLabel(row.status) : t("尚未申请", "Not requested")}</StatusPill>
                    </header>
                    <div className={work.split}>
                      <div className={work.submission}>
                        <h4>{t("内容摘要", "Summary")}</h4>
                        <p className="preserve">{source.snapshot.body}</p>
                        <Link className={work.chipLink} href={source.href}>
                          {t("查看完整内容", "View full content")}
                        </Link>
                        {row?.reviewNote && (
                          <>
                            <h4>{t("处理意见", "Review note")}</h4>
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
            <EmptyState title={t("暂无可升推内容", "Nothing to promote")} icon="megaphone" compact>
              {t("请先在负责的社群发布内容，或核对当前任职。", "Publish content in a community you manage first, or check your current position.")}
            </EmptyState>
          )}
        </Section>
      )}

      <Section id="promotion-records" title={review ? t("待审核申请", "Pending requests") : t("升推记录", "Promotion records")} description={t(`${records.totalDocs} 条记录`, `${records.totalDocs} records`)}>
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
                      <h3>{snapshot?.title ?? t("历史内容", "Earlier content")}</h3>
                      <p className={work.meta}>
                        {t("更新于", "Updated")} <time dateTime={row.updatedAt}>{when(row.updatedAt)}</time>
                      </p>
                    </div>
                    <StatusPill tone={tone(row.status)}>{statusLabel(row.status)}</StatusPill>
                  </header>
                  <div className={review ? work.split : undefined}>
                    <div className={work.submission}>
                      {row.reason && (
                        <>
                          <h4>{t("申请理由", "Reason")}</h4>
                          <p className="preserve">{row.reason}</p>
                        </>
                      )}
                      {row.reviewNote && (
                        <>
                          <h4>{t("处理意见", "Review note")}</h4>
                          <p className="preserve">{row.reviewNote}</p>
                        </>
                      )}
                      {review && (
                        <>
                          <h4>{t("申请时的内容", "Content as requested")}</h4>
                          <p className="preserve">{snapshot?.body}</p>
                        </>
                      )}
                      {original ? (
                        <Link className={work.chipLink} href={original.href}>
                          {t("查看原内容、照片或报名表", "View original content, photos or sign-up form")}
                        </Link>
                      ) : (
                        <p>{t("原内容目前无法公开，升推展示已关闭。", "The original is not public right now; promoted display is off.")}</p>
                      )}
                      <details className={work.disclosure}>
                        <summary>{t("查看处理记录", "View history")}</summary>
                        <ol>
                          {history.map((entry, index) => (
                            <li key={index}>
                              <time dateTime={entry.at}>{when(entry.at)}</time> {entry.actorName} {promotionStatusLabels[entry.to] ? statusLabel(entry.to) : entry.to}
                              {entry.reason && t("：", ": ") + entry.reason}
                            </li>
                          ))}
                        </ol>
                      </details>
                    </div>
                    {review && (
                      <section className={work.decision} aria-label={t("升推审核决定", "Promotion decision")}>
                        <h4>{t("审核决定", "Decision")}</h4>
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
          <EmptyState title={review ? t("目前没有待审核的升推申请", "No promotion requests pending review") : t("暂无升推记录", "No promotion records")} icon="inbox" compact>
            {review ? t("新的申请会按当前审核权限在此显示。", "New requests appear here according to your review permissions.") : t("申请或处理升推后，可在这里查看进度与历史。", "After requesting or handling a promotion, track progress and history here.")}
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
