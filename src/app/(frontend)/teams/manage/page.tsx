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
import styles from "../../_club/ClubPages.module.css";
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
    <ClubFrame>
      <PageHeading
        title="代表队工作台"
        eyebrow="队伍管理"
        description="处理本社群的队伍招新、人工选拔与成员记录。入队审核与平台、社群任职分别管理。"
      />
      <section className="member-shell">
        <nav className="signup-tools" aria-label="代表队操作">
          <Link className="button" href="/teams/apply">
            申请建立代表队
          </Link>
          <Link href="/teams/recruitment">招新与我的记录</Link>
          <Link href="/teams">代表队档案</Link>
        </nav>
        <form className="filters" method="get">
          <label>
            按社群管理
            <select name="game" defaultValue={game?.id ?? ""}>
              <option value="">我的全部管理社群</option>
              {allowed.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
          <button className="button">切换社群</button>
        </form>
        <div className={styles.sectionHead}>
          <h2>可管理代表队</h2>
          <p>
            {teams.totalDocs} 支 · {game?.title ?? "我的管理社群"}
          </p>
        </div>
        {teams.docs.length ? (
          <ul className={styles.readingList}>
            {teams.docs.map((team) => (
              <li key={team.id}>
                <div className={styles.recordHead}>
                  <h3>
                    <Link href={`/teams/manage/${team.id}`}>{team.title}</Link>
                  </h3>
                  <span className={styles.status} data-state={team.teamStatus}>
                    {teamLifecycleLabels[team.teamStatus ?? "unestablished"]}
                  </span>
                </div>
                <small>
                  {games.docs.find(
                    (g) =>
                      String(g.id) ===
                      String(
                        typeof team.game === "object" && team.game
                          ? team.game.id
                          : team.game,
                      ),
                  )?.title ?? "历史社群"}{" "}
                  · 招新批次、入队审核与成员记录
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <h3>暂无当前可管理的队伍</h3>
            <p>
              {allowed.length
                ? "可由本社群管理员发起建队申请，获批后在这里安排招新。"
                : "这里根据当前社群任职显示队伍。你可以先查看代表队招新或自己的申请记录。"}
            </p>
          </div>
        )}
        <TeamCorePagination
          page={page}
          total={teams.totalPages}
          path="/teams/manage"
          parameter="page"
          query={query}
          label="代表队"
        />
        {queue && (
          <section
            className={styles.recordSection}
            aria-labelledby="establishment-review-title"
          >
            <div className={styles.sectionHead}>
              <h2 id="establishment-review-title">待审核建队申请</h2>
              <p>{queue.totalDocs} 份待处理 · 全部社群</p>
            </div>
            {queue.docs.length ? (
              queue.docs.map((doc) => (
                <article className="panel" key={doc.id}>
                  <div className={styles.recordHead}>
                    <h3>{doc.title}</h3>
                    <span className={styles.status}>待审核</span>
                  </div>
                  <p className={styles.recordDate}>
                    社群：
                    {games.docs.find(
                      (g) =>
                        g.id ===
                        (typeof doc.game === "object" ? doc.game.id : doc.game),
                    )?.title ?? "历史社群"}{" "}
                    · 提交于{" "}
                    <time dateTime={doc.createdAt}>
                      {formatDate(doc.createdAt)}
                    </time>
                  </p>
                  <p className="preserve">{doc.reason}</p>
                  <TeamCoreDecision
                    kind="establishment"
                    id={doc.id}
                    revision={doc.updatedAt}
                  />
                </article>
              ))
            ) : (
              <div className="empty">
                <h3>暂无待审核建队申请</h3>
                <p>新的申请提交后，将按提交时间排列在这里。</p>
              </div>
            )}
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
      </section>
    </ClubFrame>
  );
}
