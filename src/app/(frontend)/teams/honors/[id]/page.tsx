import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms } from "@/lib/content";
import { teamHonorService } from "@/lib/team-honor-service";
import { honorError, honorReviewerOf } from "@/lib/team-honor-web";
import { TeamHonorRecordCard } from "@/components/TeamHonorRecord";
import { TeamHonorEditor } from "@/components/TeamHonorEditor";
import { pageNumber } from "@/components/CommunityPager";
import { teamHonorQuery, teamHonorScopeID } from "@/components/TeamHonorNavigation";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { buttonClass } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";
import { getT } from "@/lib/i18n/server";
import { honorMessage } from "../messages";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("荣誉记录", "Honor record"), robots: { index: false, follow: false } };
}
export default async function HonorRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)
    notFound();
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  const record = await p
    .findByID({
      collection: "team-honor-records",
      id: Number(id),
      user,
      overrideAccess: false,
      depth: 0,
    })
    .catch(() => null);
  if (!record) notFound();
  const query = await searchParams;
  const scopeTeam = query.team ? teamHonorScopeID(query.team) : undefined;
  const scopeGame = query.game ? teamHonorScopeID(query.game) : undefined;
  if (scopeTeam === null || scopeGame === null) notFound();
  const owner = user?.id === Number(record.author);
  const reviewer = honorReviewerOf(user, record);
  const returnQuery = teamHonorQuery({
    view: !owner && reviewer ? "review" : "mine",
    page: pageNumber(typeof query.page === "string" ? query.page : undefined),
    team: scopeTeam,
    game: scopeGame,
  });
  let memberships: Awaited<ReturnType<typeof teamHonorService.availableTeams>> =
      [],
    error = "";
  if (user?.id === Number(record.author))
    try {
      memberships = await teamHonorService.availableTeams(p, user);
    } catch (cause) {
      error = honorError(cause);
    }
  const editable = memberships.some(
    (membership) =>
      membership.id === record.membershipRef &&
      membership.team === Number(record.team),
  );
  const [team, game] = await Promise.all([
    p
      .findByID({
        collection: "teams",
        id: Number(record.team),
        user: null,
        overrideAccess: false,
        depth: 0,
        draft: false,
        select: { title: true },
      })
      .catch(() => null),
    p
      .findByID({
        collection: "games",
        id: Number(record.game),
        user: null,
        overrideAccess: false,
        depth: 0,
        draft: false,
        select: { title: true },
      })
      .catch(() => null),
  ]);
  const reviewing = !owner && reviewer;
  const { t, locale } = await getT();
  return (
    <TaskFrame
      eyebrow={reviewing ? t("HONORS · 荣誉材料审核", "HONORS · Honor review") : t("HONORS · 本人荣誉回执", "HONORS · My honor receipt")}
      title={record.title}
      description={(team?.title || t("已归档代表队", "Archived team")) + " · " + (game?.title || t("已归档游戏社群", "Archived game community"))}
      back={{ href: "/teams/honors?" + returnQuery, label: reviewing ? t("审核本社群荣誉", "Review community honors") : t("我的荣誉记录", "My honor records") }}
      actions={
        editable ? (
          <a className={buttonClass("stage")} href="#honor-editor">
            {t("修改荣誉内容与材料", "Edit honor details and materials")}
          </a>
        ) : undefined
      }
      aside={
        <TaskNote title={reviewing ? t("审核要点", "Review checklist") : t("回执说明", "About this receipt")} links={[{ href: "/teams/honors", label: t("荣誉墙", "Honor wall") }]}>
          {reviewing ? (
            <p>{t("核对比赛名称、名次与证明材料；退回或未通过时写明处理意见，申请人可据此修改。", "Check the event name, placing and proof. When returning or rejecting, explain why so the submitter can revise.")}</p>
          ) : (
            <p>{t("荣誉经社群审核通过后才会公开展示。被退回时可按处理意见修改材料后重新提交。", "Honors become public only after community approval. If returned, revise per the note and resubmit.")}</p>
          )}
        </TaskNote>
      }
    >
      <p className={work.status} role="status">
        {honorMessage(typeof query.message === "string" ? query.message || error : error, locale)}
      </p>
      <div className={work.flow}>
        <TeamHonorRecordCard locale={locale} record={record} headingLevel="h2" reviewer={reviewer} owner={owner} editable={editable} returnQuery={returnQuery} />
        {editable && (
          <section className={work.panel} aria-label={t("修改荣誉内容与材料", "Edit honor details and materials")}>
            <TeamHonorEditor key={record.id + ":" + record.revision} record={record} memberships={memberships} returnQuery={returnQuery} />
          </section>
        )}
      </div>
    </TaskFrame>
  );
}
