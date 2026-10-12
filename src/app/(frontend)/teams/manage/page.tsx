import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { PageHeading } from "@/components/PageHeading";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreDecision } from "@/components/TeamCoreControls";
import { currentTeamActor } from "@/lib/team-memberships";
import { canPublish, communityIDs } from "@/lib/rules";
import { teamLifecycleLabels } from "@/lib/team-core";
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
    <>
      <PageHeading
        title="代表队工作台"
        eyebrow="TEAM WORKSPACE"
        description="按当前社群任职处理队伍、招新与成员。录取不会授予平台或社群角色。"
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
        <h2>可管理代表队</h2>
        {teams.docs.length ? (
          <ul className="community-list">
            {teams.docs.map((team) => (
              <li key={team.id}>
                <Link href={`/teams/manage/${team.id}`}>{team.title}</Link>
                <span>
                  {teamLifecycleLabels[team.teamStatus ?? "unestablished"]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>暂无当前可管理的队伍。建立代表队须先完成建队审核。</p>
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
          <section>
            <h2>待审核建队申请</h2>
            {queue.docs.length ? (
              queue.docs.map((doc) => (
                <article className="panel" key={doc.id}>
                  <h3>{doc.title}</h3>
                  <p>
                    社群：
                    {games.docs.find(
                      (g) =>
                        g.id ===
                        (typeof doc.game === "object" ? doc.game.id : doc.game),
                    )?.title ?? "历史社群"}
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
              <p>暂无待审核建队申请。</p>
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
    </>
  );
}
