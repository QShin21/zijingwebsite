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
import { ClubFrame } from "../../_club/ClubPage";
import styles from "@/components/team-pages/TeamPages.module.css";
import {
  TeamTaskNav,
  TeamSectionHeading,
  TeamEmpty,
} from "@/components/team-pages/TeamPageParts";
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
    <ClubFrame className={styles.workspace}>
      <PageHeading
        title="代表队招新与我的记录"
        eyebrow="代表队选拔"
        description="找到适合的队伍，提交游戏经历与训练安排，由本社群管理员人工选拔。"
      />
      <TeamTaskNav
        label="招新与本人事务"
        items={[
          { href: "#my-team-applications", label: "我的入队申请" },
          { href: "#team-recruitment-list", label: "查看招新" },
          { href: "#my-team-memberships", label: "我的成员记录" },
          { href: "/teams", label: "代表队档案" },
        ]}
      />
      <div className={styles.workspaceGrid}>
        <aside className={styles.taskAside}>
          <h2>从招新到入队</h2>
          <p>
            先阅读批次要求与开放时间，填写后可保存草稿。提交后在本人回执查看审核意见。
          </p>
          <h3>加入社团的其他方式</h3>
          <div className={styles.actions}>
            <Link href="/community">联系游戏社群</Link>
            <Link href="/join/staff">了解骨干招新</Link>
          </div>
          <div className={styles.actions}>
            <Link href="/teams/manage">代表队工作台</Link>
          </div>
        </aside>
        <div>
          <section
            id="my-team-applications"
            className={styles.section}
            aria-labelledby="my-team-applications-title"
          >
            <TeamSectionHeading
              id="my-team-applications-title"
              title="我的入队申请"
            >
              {own.totalDocs} 份记录
            </TeamSectionHeading>
            <div className={styles.records}>
              {own.docs.length ? (
                own.docs.map((doc) => (
                  <article className={styles.record} key={doc.id}>
                    <div className={styles.recordHead}>
                      <h3>{doc.title}</h3>
                      <span className={styles.status} data-state={doc.status}>
                        {teamApplicationLabels[doc.status]}
                      </span>
                    </div>
                    <p className={styles.recordDate}>申请编号 {doc.id}</p>
                    {doc.reviewNote && (
                      <div className={styles.note}>
                        <h4>处理意见</h4>
                        <p className="preserve">{doc.reviewNote}</p>
                      </div>
                    )}
                    <div className={styles.actions}>
                      <Link
                        className="button light"
                        href={`/teams/recruitment/${positiveID(doc.recruitment)}`}
                      >
                        查看回执 / 继续修改
                      </Link>
                      {["draft", "pending", "returned"].includes(
                        doc.status,
                      ) && (
                        <TeamCoreOperation
                          operation="withdraw-join"
                          id={doc.id}
                          revision={doc.updatedAt}
                          label="撤回申请"
                        />
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <TeamEmpty title="还没有入队申请">
                  从下方招新批次开始，了解选拔要求；填写后可以先保存草稿。
                </TeamEmpty>
              )}
            </div>
            <TeamCorePagination
              page={teamPage(query.ownPage)}
              total={own.totalPages}
              path="/teams/recruitment"
              parameter="ownPage"
              query={query}
              label="我的申请"
            />
          </section>
          <section
            id="team-recruitment-list"
            className={styles.section}
            aria-labelledby="team-recruitment-list-title"
          >
            <TeamSectionHeading
              id="team-recruitment-list-title"
              title="代表队招新批次"
            >
              {batches.totalDocs} 个公开批次
            </TeamSectionHeading>
            <div className={styles.records}>
              {batches.docs.length ? (
                batches.docs.map((batch) => (
                  <article className={styles.record} key={batch.id}>
                    <div className={styles.recordHead}>
                      <h3>
                        <Link href={`/teams/recruitment/${batch.id}`}>
                          {batch.title}
                        </Link>
                      </h3>
                      <span className={styles.status} data-state={batch.status}>
                        {teamRecruitmentState(
                          batch,
                          normalizeSignup(batch.signupForm),
                        )}
                      </span>
                    </div>
                    {normalizeSignup(batch.signupForm).intro && (
                      <p className={styles.muted}>
                        {normalizeSignup(batch.signupForm).intro}
                      </p>
                    )}
                    <div className={styles.actions}>
                      <Link href={`/teams/recruitment/${batch.id}`}>
                        查看申请与选拔说明
                      </Link>
                    </div>
                  </article>
                ))
              ) : (
                <TeamEmpty title="目前没有公开招新批次">
                  新的选拔安排确认后将在这里发布。
                </TeamEmpty>
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
          </section>
          <section
            id="my-team-memberships"
            className={styles.section}
            aria-labelledby="my-team-memberships-title"
          >
            <TeamSectionHeading
              id="my-team-memberships-title"
              title="我的代表队成员记录"
            >
              {memberships.totalDocs} 条记录
            </TeamSectionHeading>
            <p className={styles.muted}>
              在队时可填写本人简介、投稿队伍荣誉。公开简介须由本人明确选择展示。
            </p>
            <div className={styles.records}>
              {memberships.docs.length ? (
                memberships.docs.map((doc) => (
                  <article className={styles.record} key={doc.id}>
                    <div className={styles.recordHead}>
                      <h3>{doc.title}</h3>
                      <span className={styles.status} data-state={doc.status}>
                        {doc.status === "active"
                          ? "在队"
                          : doc.leftAt
                            ? "已离队"
                            : "已撤销"}
                      </span>
                    </div>
                    <p className={styles.recordDate}>成员关系编号 {doc.id}</p>
                    {doc.status === "active" && positiveID(doc.team) && (
                      <nav className={styles.actions} aria-label="本队成员操作">
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
                      <details className={styles.disclosure}>
                        <summary>办理离队</summary>
                        <p className={styles.muted}>
                          离队后会停止仅现任队员可使用的编辑与投稿权限，历史记录继续保留。
                        </p>
                        <TeamCoreOperation
                          operation="leave"
                          id={doc.id}
                          revision={doc.updatedAt}
                          label="办理本人离队"
                        />
                      </details>
                    )}
                  </article>
                ))
              ) : (
                <TeamEmpty title="暂无成员关系记录">
                  人工录取通过后，可查看队内简介和荣誉投稿入口。
                </TeamEmpty>
              )}
            </div>
            <TeamCorePagination
              page={teamPage(query.membersPage)}
              total={memberships.totalPages}
              path="/teams/recruitment"
              parameter="membersPage"
              query={query}
              label="我的成员记录"
            />
          </section>
        </div>
      </div>
    </ClubFrame>
  );
}
