import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { PageHeading } from "@/components/PageHeading";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreOperation } from "@/components/TeamCoreControls";
import { positiveID } from "@/lib/team-memberships";
import { teamApplicationLabels, teamRecruitmentState } from "@/lib/team-core";
import { normalizeSignup } from "@/lib/signup-schema";
export const dynamic = "force-dynamic";
export default async function Recruitment({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    ownPage?: string;
    membersPage?: string;
  }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const query = await searchParams,
    page = teamPage(query.page);
  const batches = await p.find({
    collection: "team-recruitments",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page,
    sort: "-createdAt",
    where: { status: { in: ["open", "closed", "archived"] } },
  });
  const own = await p.find({
    collection: "team-join-applications",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.ownPage),
    sort: "-updatedAt",
    where: { applicant: { equals: user.id } },
  });
  const memberships = await p.find({
    collection: "team-memberships",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.membersPage),
    sort: "-updatedAt",
    where: { member: { equals: user.id } },
  });
  return (
    <>
      <PageHeading
        title="代表队招新与我的记录"
        eyebrow="PLAY AS A TEAM"
        description="填写游戏、位置、经历、训练时间和一种联系方式，由本社群管理员人工选拔。"
      />
      <section className="member-shell">
        <nav className="signup-tools" aria-label="参与方式">
          <Link href="/community">普通入社与进群</Link>
          <Link href="/join/staff">骨干招新</Link>
          <Link href="/teams/manage">代表队工作台</Link>
        </nav>
        <h2>代表队招新批次</h2>
        {batches.docs.length ? (
          batches.docs.map((batch) => (
            <article className="panel" key={batch.id}>
              <h3>{batch.title}</h3>
              <p>
                {teamRecruitmentState(batch, normalizeSignup(batch.signupForm))}
              </p>
              <Link className="button" href={`/teams/recruitment/${batch.id}`}>
                查看申请与选拔说明
              </Link>
            </article>
          ))
        ) : (
          <p>目前没有已开放的代表队招新批次。</p>
        )}
        <TeamCorePagination
          page={page}
          total={batches.totalPages}
          path="/teams/recruitment"
          parameter="page"
          query={query}
          label="招新批次"
        />
        <section>
          <h2>我的入队申请</h2>
          {own.docs.length ? (
            own.docs.map((doc) => (
              <article className="panel" key={doc.id}>
                <h3>{doc.title}</h3>
                <p>{teamApplicationLabels[doc.status]}</p>
                <p className="preserve">{doc.reviewNote}</p>
                <Link
                  href={`/teams/recruitment/${positiveID(doc.recruitment)}`}
                >
                  查看回执 / 继续修改
                </Link>
                {["draft", "pending", "returned"].includes(doc.status) && (
                  <TeamCoreOperation
                    operation="withdraw-join"
                    id={doc.id}
                    revision={doc.updatedAt}
                    label="撤回申请"
                  />
                )}
              </article>
            ))
          ) : (
            <p>你还没有提交入队申请。</p>
          )}
        </section>
        <TeamCorePagination
          page={teamPage(query.ownPage)}
          total={own.totalPages}
          path="/teams/recruitment"
          parameter="ownPage"
          query={query}
          label="我的申请"
        />
        <section>
          <h2>我的代表队成员记录</h2>
          {memberships.docs.length ? (
            memberships.docs.map((doc) => (
              <article className="panel" key={doc.id}>
                <h3>{doc.title}</h3>
                <p>
                  关系编号 #{doc.id} ·{" "}
                  {doc.status === "active"
                    ? "在队"
                    : doc.leftAt
                      ? "已离队"
                      : "已撤销"}
                </p>
                <p>入队不授予社群或平台管理权限，公开简介另行授权。</p>
                {doc.status === "active" && positiveID(doc.team) && (
                  <nav className="signup-tools" aria-label="本队成员操作">
                    <Link href={`/teams/profiles/${positiveID(doc.team)}`}>填写或修改我的队内简介</Link>
                    <Link href={`/teams/honors?view=mine&team=${positiveID(doc.team)}`}>本队荣誉与我的投稿</Link>
                  </nav>
                )}
                {doc.status === "active" && (
                  <TeamCoreOperation
                    operation="leave"
                    id={doc.id}
                    revision={doc.updatedAt}
                    label="办理本人离队"
                  />
                )}
              </article>
            ))
          ) : (
            <p>暂无成员关系记录。</p>
          )}
        </section>
        <TeamCorePagination
          page={teamPage(query.membersPage)}
          total={memberships.totalPages}
          path="/teams/recruitment"
          parameter="membersPage"
          query={query}
          label="我的成员记录"
        />
      </section>
    </>
  );
}
