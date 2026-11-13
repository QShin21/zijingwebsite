import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreDecision } from "@/components/TeamCoreControls";
import { currentTeamActor } from "@/lib/team-memberships";
import { canPublish, communityIDs } from "@/lib/rules";
import { getT } from "@/lib/i18n/server";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { ButtonLink, EmptyState, Section, StatusPill, buttonClass, type Tone } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";
import { teamLoginHref } from "../auth-return";
import { lifecycleLabel, localDate } from "../labels";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("代表队工作台", "Team workspace"), robots: { index: false, follow: false } };
}

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
  const { t, locale } = await getT();
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
    return games.docs.find((g) => String(g.id) === String(id))?.title ?? t("历史社群", "Former community");
  };

  return (
    <TaskFrame
      wide
      eyebrow={t("TEAMS · 代表队工作台", "TEAMS · Team workspace")}
      title={t("代表队工作台", "Team workspace")}
      description={t("从当前有权管理的社群进入队伍，安排招新、入队选拔与成员事务。", "Open teams in the communities you manage to plan recruitment, tryouts and member affairs.")}
      back={{ href: "/teams", label: t("代表队", "Teams") }}
      actions={
        <ButtonLink href="/teams/apply" tone="accent" icon="arrow">
          {t("申请建立代表队", "Apply to create a team")}
        </ButtonLink>
      }
      aside={
        <>
          <section className={work.scope} aria-labelledby="team-scope-title">
            <h2 id="team-scope-title">{t("管理范围", "Scope")}</h2>
            <form method="get">
              <label>
                {t("社群范围", "Communities")}
                <select name="game" defaultValue={game?.id ?? ""}>
                  <option value="">{t("我的全部管理社群", "All communities I manage")}</option>
                  {allowed.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className={buttonClass("ghost", "small")}>{t("切换社群", "Switch")}</button>
            </form>
            <p>{t("管理范围以当前社群任职为准；队伍招新、入队选拔与成员关系在各队工作台内处理。", "Scope follows your current community roles. Recruitment, tryouts and memberships are handled in each team's workspace.")}</p>
          </section>
          <TaskNote
            title={t("相关入口", "Related")}
            links={[
              { href: "/teams/recruitment", label: t("选拔中心与我的记录", "Tryout center & my records") },
              { href: "/teams", label: t("代表队档案", "Team pages") },
              { href: "/teams/honors?view=review", label: t("荣誉审核", "Honor review") },
            ]}
          >
            <p>{t("建队审批只对拥有全局发布权限的负责人显示。录取队员不会授予平台或社群管理权限。", "Team approvals appear only for leads with global publishing permission. Accepting players grants no platform or community admin rights.")}</p>
          </TaskNote>
        </>
      }
    >
      <ul className={work.stats} aria-label={t("工作台概况", "Workspace overview")}>
        <li>
          <strong>{teams.totalDocs}</strong>
          <span>{game?.title ?? t("全部管理社群", "All managed communities")}{t(" · 代表队", " · Teams")}</span>
        </li>
        <li>
          <strong>{allowed.length}</strong>
          <span>{t("可管理社群", "Managed communities")}</span>
        </li>
        {queue && (
          <li data-hot={queue.totalDocs > 0 || undefined}>
            <strong>{queue.totalDocs}</strong>
            <span>{t("待审核建队申请", "Pending team applications")}</span>
          </li>
        )}
      </ul>

      <Section id="managed-teams" title={t("可管理代表队", "Teams you manage")} description={t(`${teams.totalDocs} 支队伍，按当前任职范围显示。`, `${teams.totalDocs} ${teams.totalDocs === 1 ? "team" : "teams"}, shown by your current roles.`)}>
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
                    <StatusPill tone={lifecycleTone[state] ?? "neutral"}>{lifecycleLabel(t, state)}</StatusPill>
                  </div>
                  <p className={work.meta}>{gameTitle(team.game)}</p>
                  <div className={work.actions}>
                    <Link className={work.chipLink} href={`/teams/manage/${team.id}#team-recruitments`}>
                      {t("安排招新", "Recruitment")}
                    </Link>
                    <Link className={work.chipLink} href={`/teams/manage/${team.id}#team-applications`}>
                      {t("处理入队申请", "Join applications")}
                    </Link>
                    <Link className={work.chipLink} href={`/teams/manage/${team.id}#team-members`}>
                      {t("查看成员", "Members")}
                    </Link>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState title={t("暂无当前可管理的队伍", "No teams to manage")} icon="trophy" compact>
              {allowed.length
                ? t("可由本社群管理员发起建队申请，获批后在这里安排招新。", "A community admin can apply to create a team; once approved, plan recruitment here.")
                : t("这里根据当前社群任职显示队伍。你可以先查看代表队招新或自己的申请记录。", "Teams appear here based on your community roles. Meanwhile, browse team recruitment or your own applications.")}
            </EmptyState>
          )}
        </div>
        <TeamCorePagination page={page} total={teams.totalPages} path="/teams/manage" parameter="page" query={query} label={t("代表队", "Teams")} />
      </Section>

      {queue && (
        <Section id="establishment-review" title={t("待审核建队申请", "Pending team applications")} description={t(`${queue.totalDocs} 份待处理，覆盖全部社群，按提交时间排列。`, `${queue.totalDocs} pending across all communities, oldest first.`)}>
          <div className={work.records}>
            {queue.docs.length ? (
              queue.docs.map((doc) => (
                <article className={work.record} key={doc.id} data-state="pending">
                  <div className={work.recordHead}>
                    <h3>{doc.title}</h3>
                    <StatusPill tone="info">{t("待审核", "Pending review")}</StatusPill>
                  </div>
                  <p className={work.meta}>
                    <span>{gameTitle(doc.game)}</span>
                    <span>
                      {t("提交于 ", "Submitted ")}<time dateTime={doc.createdAt}>{localDate(doc.createdAt, locale)}</time>
                    </span>
                  </p>
                  <div className={work.split}>
                    <div className={work.submission}>
                      <h4>{t("组织与训练计划", "Organization & training plan")}</h4>
                      <p className="preserve">{doc.reason}</p>
                    </div>
                    <div className={work.decision}>
                      <h4>{t("建队处理意见", "Decision")}</h4>
                      <TeamCoreDecision kind="establishment" id={doc.id} revision={doc.updatedAt} />
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title={t("暂无待审核建队申请", "No pending team applications")} icon="check" compact>
                {t("新的申请提交后，将按提交时间排列在这里。", "New applications will be listed here by submission time.")}
              </EmptyState>
            )}
          </div>
          <TeamCorePagination page={reviewPage} total={queue.totalPages} path="/teams/manage" parameter="reviewPage" query={query} label={t("建队申请", "Team applications")} />
        </Section>
      )}
    </TaskFrame>
  );
}
