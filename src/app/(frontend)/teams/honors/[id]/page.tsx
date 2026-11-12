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
export const dynamic = "force-dynamic";
export const metadata = { title: "荣誉记录", robots: { index: false, follow: false } };
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
  return (
    <TaskFrame
      eyebrow={reviewing ? "HONORS · 荣誉材料审核" : "HONORS · 本人荣誉回执"}
      title={record.title}
      description={(team?.title || "已归档代表队") + " · " + (game?.title || "已归档游戏社群")}
      back={{ href: "/teams/honors?" + returnQuery, label: reviewing ? "审核本社群荣誉" : "我的荣誉记录" }}
      actions={
        editable ? (
          <a className={buttonClass("stage")} href="#honor-editor">
            修改荣誉内容与材料
          </a>
        ) : undefined
      }
      aside={
        <TaskNote title={reviewing ? "审核要点" : "回执说明"} links={[{ href: "/teams/honors", label: "荣誉墙" }]}>
          {reviewing ? (
            <p>核对比赛名称、名次与证明材料；退回或未通过时写明处理意见，申请人可据此修改。</p>
          ) : (
            <p>荣誉经社群审核通过后才会公开展示。被退回时可按处理意见修改材料后重新提交。</p>
          )}
        </TaskNote>
      }
    >
      <p className={work.status} role="status">
        {typeof query.message === "string" ? query.message || error : error}
      </p>
      <div className={work.flow}>
        <TeamHonorRecordCard record={record} headingLevel="h2" reviewer={reviewer} owner={owner} editable={editable} returnQuery={returnQuery} />
        {editable && (
          <section className={work.panel} aria-label="修改荣誉内容与材料">
            <TeamHonorEditor key={record.id + ":" + record.revision} record={record} memberships={memberships} returnQuery={returnQuery} />
          </section>
        )}
      </div>
    </TaskFrame>
  );
}
