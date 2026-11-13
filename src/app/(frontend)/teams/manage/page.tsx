import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreDecision } from "@/components/TeamCoreControls";
import { currentTeamActor } from "@/lib/team-memberships";
import { canPublish, communityIDs, formatDate } from "@/lib/rules";
import { teamLifecycleLabels } from "@/lib/team-core";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { ButtonLink, EmptyState, Section, StatusPill, buttonClass, type Tone } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";
import { teamLoginHref } from "../auth-return";

export const dynamic = "force-dynamic";
export const metadata = { title: "代表队工作台", robots: { index: false, follow: false } };

const lifecycleTone: Record<string, Tone> = { active: "success", resting: "warning", unestablished: "info", archived: "neutral" };

export default async function Manage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; page?: string; reviewPage?: string }>;
}) {
  const query = await searchParams;
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect(teamLoginHref("/teams/manage", query));
  const actor = await currentTeamActor(p, user),
    scope = communityIDs(actor, "handleJoins");
  const page = teamPage(query.page);
  const reviewPage = teamPage(query.reviewPage);
  const games = await p.find({
    collection: "games",
    user: null,
    overrideAccess: false,
    draft: false,
    depth: 0,
    pagination: false,
    select: { title: true },
  });
  const allowed = games.docs.filter((g) => canPublish(actor) || scope.includes(String(g.id)));
  const game = allowed.find((g) => String(g.id) === query.game);
  const teams = await p.find({
    collection: "teams",
    user: null,
    overrideAccess: false,
    draft: false,
    depth: 0,
    limit: 20,
    page,
    where: { game: { in: game ? [game.id] : allowed.map((g) => g.id) } },
    select: { title: true, game: true, teamStatus: true },
  });
  const queue = canPublish(actor)
    ? await p.find({
        collection: "team-establishment-applications",
        user,
        overrideAccess: false,
        depth: 0,
        limit: 20,
        page: reviewPage,
        sort: "createdAt",
        where: { status: { equals: "pending" } },
      })
    : null;
  const gameTitle = (value: unknown) => {
    const id = typeof value === "object" && value ? (value as { id: unknown }).id : value;
    return games.docs.find((g) => String(g.id) === String(id))?.title ?? "历史社群";
  };

  return (
    <TaskFrame
      wide
      eyebrow="TEAMS · 代表队工作台"
      title="代表队工作台"
      description="从当前有权管理的社群进入队伍，安排招新、入队选拔与成员事务。"
      back={{ href: "/teams", label: "代表队" }}
      actions={
        <ButtonLink href="/teams/apply" tone="accent" icon="arrow">
          申请建立代表队
        </ButtonLink>
      }
      aside={
        <>
          <section className={work.scope} aria-labelledby="team-scope-title">
            <h2 id="team-scope-title">管理范围</h2>
            <form method="get">
              <label>
                社群范围
                <select name="game" defaultValue={game?.id ?? ""}>
                  <option value="">我的全部管理社群</option>
                  {allowed.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className={buttonClass("ghost", "small")}>切换社群</button>
            </form>
            <p>管理范围以当前社群任职为准；队伍招新、入队选拔与成员关系在各队工作台内处理。</p>
          </section>
          <TaskNote
            title="相关入口"
            links={[
              { href: "/teams/recruitment", label: "选拔中心与我的记录" },
              { href: "/teams", label: "代表队档案" },
              { href: "/teams/honors?view=review", label: "荣誉审核" },
            ]}
          >
            <p>建队审批只对拥有全局发布权限的负责人显示。录取队员不会授予平台或社群管理权限。</p>
          </TaskNote>
        </>
      }
    >
      <ul className={work.stats} aria-label="工作台概况">
        <li>
          <strong>{teams.totalDocs}</strong>
          <span>{game?.title ?? "全部管理社群"} · 代表队</span>
        </li>
        <li>
          <strong>{allowed.length}</strong>
          <span>可管理社群</span>
        </li>
        {queue && (
          <li data-hot={queue.totalDocs > 0 || undefined}>
            <strong>{queue.totalDocs}</strong>
            <span>待审核建队申请</span>
          </li>
        )}
      </ul>

      <Section id="managed-teams" title="可管理代表队" description={`${teams.totalDocs} 支队伍，按当前任职范围显示。`}>
        <div className={work.records}>
          {teams.docs.length ? (
            teams.docs.map((team) => {
              const state = team.teamStatus ?? "unestablished";
              return (
                <article className={work.record} key={team.id} data-state={state}>
                  <div className={work.recordHead}>
                    <h3>
                      <Link href={`/teams/manage/${team.id}`}>{team.title}</Link>
                    </h3>
                    <StatusPill tone={lifecycleTone[state] ?? "neutral"}>{teamLifecycleLabels[state]}</StatusPill>
                  </div>
                  <p className={work.meta}>{gameTitle(team.game)}</p>
                  <div className={work.actions}>
                    <Link className={work.chipLink} href={`/teams/manage/${team.id}#team-recruitments`}>
                      安排招新
                    </Link>
                    <Link className={work.chipLink} href={`/teams/manage/${team.id}#team-applications`}>
                      处理入队申请
                    </Link>
                    <Link className={work.chipLink} href={`/teams/manage/${team.id}#team-members`}>
                      查看成员
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState title="暂无当前可管理的队伍" icon="trophy" compact>
              {allowed.length
                ? "可由本社群管理员发起建队申请，获批后在这里安排招新。"
                : "这里根据当前社群任职显示队伍。你可以先查看代表队招新或自己的申请记录。"}
            </EmptyState>
          )}
        </div>
        <TeamCorePagination page={page} total={teams.totalPages} path="/teams/manage" parameter="page" query={query} label="代表队" />
      </Section>

      {queue && (
        <Section id="establishment-review" title="待审核建队申请" description={`${queue.totalDocs} 份待处理，覆盖全部社群，按提交时间排列。`}>
          <div className={work.records}>
            {queue.docs.length ? (
              queue.docs.map((doc) => (
                <article className={work.record} key={doc.id} data-state="pending">
                  <div className={work.recordHead}>
                    <h3>{doc.title}</h3>
                    <StatusPill tone="info">待审核</StatusPill>
                  </div>
                  <p className={work.meta}>
                    <span>{gameTitle(doc.game)}</span>
                    <span>
                      提交于 <time dateTime={doc.createdAt}>{formatDate(doc.createdAt)}</time>
                    </span>
                  </p>
                  <div className={work.split}>
                    <div className={work.submission}>
                      <h4>组织与训练计划</h4>
                      <p className="preserve">{doc.reason}</p>
                    </div>
                    <div className={work.decision}>
                      <h4>建队处理意见</h4>
                      <TeamCoreDecision kind="establishment" id={doc.id} revision={doc.updatedAt} />
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title="暂无待审核建队申请" icon="check" compact>
                新的申请提交后，将按提交时间排列在这里。
              </EmptyState>
            )}
          </div>
          <TeamCorePagination page={reviewPage} total={queue.totalPages} path="/teams/manage" parameter="reviewPage" query={query} label="建队申请" />
        </Section>
      )}
    </TaskFrame>
  );
}
