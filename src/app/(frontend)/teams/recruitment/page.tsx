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
import { ClubFrame, ClubSteps } from "../../_club/ClubPage";
import styles from "../../_club/ClubPages.module.css";
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
    <ClubFrame>
      <PageHeading
        title="代表队招新与我的记录"
        eyebrow="代表队选拔"
        description="填写游戏、位置、经历、训练时间和一种联系方式，由本社群管理员人工选拔。"
      />
      <ClubSteps
        label="代表队选拔流程"
        steps={[
          {
            title: "找到招新批次",
            description: "阅读当前选拔要求与开放时间。",
          },
          {
            title: "填写并核对申请",
            description: "可保存草稿，确认后提交审核。",
          },
          {
            title: "查看人工选拔结果",
            description: "处理意见与入队记录持续保留。",
          },
        ]}
      />
      <section className="member-shell">
        <nav className="signup-tools" aria-label="参与方式">
          <Link href="/community">普通入社与进群</Link>
          <Link href="/join/staff">骨干招新</Link>
          <Link href="/teams/manage">代表队工作台</Link>
        </nav>
        <div className={styles.sectionHead}>
          <h2>代表队招新批次</h2>
          <p>{batches.totalDocs} 个公开批次</p>
        </div>
        <div className={styles.batchGrid}>
          {batches.docs.length ? (
            batches.docs.map((batch) => (
              <article className="panel" key={batch.id}>
                <p className={styles.kicker}>代表队招新</p>
                <h3>{batch.title}</h3>
                <p className={styles.status}>
                  {teamRecruitmentState(
                    batch,
                    normalizeSignup(batch.signupForm),
                  )}
                </p>
                <Link
                  className="button"
                  href={`/teams/recruitment/${batch.id}`}
                >
                  查看申请与选拔说明
                </Link>
              </article>
            ))
          ) : (
            <div className="empty">
              <div>
                <h3>目前没有已开放的代表队招新批次。</h3>
                <p>新的选拔安排确认后将在这里发布。</p>
              </div>
            </div>
          )}
        </div>
        <TeamCorePagination
          page={page}
          total={batches.totalPages}
          path="/teams/recruitment"
          parameter="page"
          query={query}
          label="招新批次"
        />
        <section className={styles.recordSection}>
          <h2>我的入队申请</h2>
          {own.docs.length ? (
            own.docs.map((doc) => (
              <article className="panel" key={doc.id}>
                <div className={styles.recordHead}>
                  <h3>{doc.title}</h3>
                  <span className={styles.status} data-state={doc.status}>
                    {teamApplicationLabels[doc.status]}
                  </span>
                </div>
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
            <div className="empty">
              <div>
                <h3>你还没有提交入队申请。</h3>
                <p>选择上方批次了解选拔，填写后可先保存草稿。</p>
              </div>
            </div>
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
        <section className={styles.recordSection}>
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
                    <Link href={`/teams/profiles/${positiveID(doc.team)}`}>
                      填写或修改我的队内简介
                    </Link>
                    <Link
                      href={`/teams/honors?view=mine&team=${positiveID(doc.team)}`}
                    >
                      本队荣誉与我的投稿
                    </Link>
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
            <div className="empty">
              <div>
                <h3>暂无成员关系记录。</h3>
                <p>人工录取通过后，可查看队内简介和荣誉投稿入口。</p>
              </div>
            </div>
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
    </ClubFrame>
  );
}
