import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { PageHeading } from "@/components/PageHeading";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreDecision } from "@/components/TeamCoreControls";
import { currentTeamActor } from "@/lib/team-memberships";
import { canPublish, communityIDs, formatDate } from "@/lib/rules";
import { teamLifecycleLabels } from "@/lib/team-core";
import { ClubFrame } from "../../_club/ClubPage";
import styles from "@/components/team-pages/TeamPages.module.css";
import {
  TeamTaskNav,
  TeamSectionHeading,
  TeamEmpty,
} from "@/components/team-pages/TeamPageParts";
export const dynamic = "force-dynamic";
export default async function Manage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; page?: string; reviewPage?: string }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const actor = await currentTeamActor(p, user),
    scope = communityIDs(actor, "handleJoins"),
    query = await searchParams;
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
  const allowed = games.docs.filter(
    (g) => canPublish(actor) || scope.includes(String(g.id)),
  );
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
  return (
    <ClubFrame className={styles.workspace}>
      <PageHeading
        title="代表队工作台"
        eyebrow="队伍管理"
        description="从当前有权管理的社群进入队伍，安排招新与成员事务。"
      />
      <div className={styles.summary}>
        <p>
          {game?.title ?? "我的管理社群"}：{teams.totalDocs} 支代表队。
          {queue
            ? `另有 ${queue.totalDocs} 份建队申请待处理。`
            : "管理范围以当前社群任职为准。"}
        </p>
        <Link className="button" href="/teams/apply">
          申请建立代表队
        </Link>
      </div>
      <TeamTaskNav
        label="代表队操作"
        items={[
          { href: "#managed-teams", label: "可管理队伍" },
          ...(queue
            ? [{ href: "#establishment-review", label: "建队申请审核" }]
            : []),
          { href: "/teams/recruitment", label: "招新与我的记录" },
          { href: "/teams", label: "代表队档案" },
        ]}
      />
      <div className={styles.workspaceGrid}>
        <aside className={styles.taskAside}>
          <h2>选择管理社群</h2>
          <form className="member-form" method="get">
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
            <button className="button light">切换社群</button>
          </form>
          <p>队伍招新、入队选拔与成员关系在各队工作台内处理。</p>
        </aside>
        <div>
          <section
            id="managed-teams"
            className={styles.section}
            aria-labelledby="managed-teams-title"
          >
            <TeamSectionHeading id="managed-teams-title" title="可管理代表队">
              {teams.totalDocs} 支队伍
            </TeamSectionHeading>
            <div className={styles.records}>
              {teams.docs.length ? (
                teams.docs.map((team) => (
                  <article className={styles.record} key={team.id}>
                    <div className={styles.recordHead}>
                      <h3>
                        <Link href={`/teams/manage/${team.id}`}>
                          {team.title}
                        </Link>
                      </h3>
                      <span
                        className={styles.status}
                        data-state={team.teamStatus}
                      >
                        {
                          teamLifecycleLabels[
                            team.teamStatus ?? "unestablished"
                          ]
                        }
                      </span>
                    </div>
                    <p className={styles.muted}>
                      {games.docs.find(
                        (g) =>
                          String(g.id) ===
                          String(
                            typeof team.game === "object" && team.game
                              ? team.game.id
                              : team.game,
                          ),
                      )?.title ?? "历史社群"}
                    </p>
                    <div className={styles.actions}>
                      <Link href={`/teams/manage/${team.id}#team-recruitments`}>
                        安排招新
                      </Link>
                      <Link href={`/teams/manage/${team.id}#team-applications`}>
                        处理入队申请
                      </Link>
                      <Link href={`/teams/manage/${team.id}#team-members`}>
                        查看成员
                      </Link>
                    </div>
                  </article>
                ))
              ) : (
                <TeamEmpty title="暂无当前可管理的队伍">
                  {allowed.length
                    ? "可由本社群管理员发起建队申请，获批后在这里安排招新。"
                    : "这里根据当前社群任职显示队伍。你可以先查看代表队招新或自己的申请记录。"}
                </TeamEmpty>
              )}
            </div>
            <TeamCorePagination
              page={page}
              total={teams.totalPages}
              path="/teams/manage"
              parameter="page"
              query={query}
              label="代表队"
            />
          </section>
          {queue && (
            <section
              id="establishment-review"
              className={styles.section}
              aria-labelledby="establishment-review-title"
            >
              <TeamSectionHeading
                id="establishment-review-title"
                title="待审核建队申请"
              >
                {queue.totalDocs} 份待处理，全部社群
              </TeamSectionHeading>
              <div className={styles.records}>
                {queue.docs.length ? (
                  queue.docs.map((doc) => (
                    <article className={styles.record} key={doc.id}>
                      <div className={styles.recordHead}>
                        <h3>{doc.title}</h3>
                        <span className={styles.status} data-state="pending">
                          待审核
                        </span>
                      </div>
                      <p className={styles.recordDate}>
                        {games.docs.find(
                          (g) =>
                            g.id ===
                            (typeof doc.game === "object"
                              ? doc.game.id
                              : doc.game),
                        )?.title ?? "历史社群"}
                        ，提交于{" "}
                        <time dateTime={doc.createdAt}>
                          {formatDate(doc.createdAt)}
                        </time>
                      </p>
                      <div className={styles.reviewGrid}>
                        <div className={styles.reviewContent}>
                          <h4>组织与训练计划</h4>
                          <p className="preserve">{doc.reason}</p>
                        </div>
                        <div className={styles.reviewAction}>
                          <h4>建队处理意见</h4>
                          <TeamCoreDecision
                            kind="establishment"
                            id={doc.id}
                            revision={doc.updatedAt}
                          />
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <TeamEmpty title="暂无待审核建队申请">
                    新的申请提交后，将按提交时间排列在这里。
                  </TeamEmpty>
                )}
              </div>
              <TeamCorePagination
                page={reviewPage}
                total={queue.totalPages}
                path="/teams/manage"
                parameter="reviewPage"
                query={query}
                label="建队申请"
              />
            </section>
          )}
        </div>
      </div>
    </ClubFrame>
  );
}
