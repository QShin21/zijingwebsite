import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { PageHeading } from "@/components/PageHeading";
import {
  TeamCoreEstablishmentForm,
  TeamCoreOperation,
} from "@/components/TeamCoreControls";
import {
  canProposeTeam,
  currentTeamActor,
  positiveID,
} from "@/lib/team-memberships";
import { teamApplicationLabels } from "@/lib/team-core";
import { ClubFrame } from "../../_club/ClubPage";
import styles from "@/components/team-pages/TeamPages.module.css";
import {
  TeamTaskNav,
  TeamSectionHeading,
  TeamEmpty,
} from "@/components/team-pages/TeamPageParts";
export const dynamic = "force-dynamic";
export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; page?: string }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const actor = await currentTeamActor(p, user),
    query = await searchParams;
  const games = await p.find({
    collection: "games",
    user: null,
    overrideAccess: false,
    draft: false,
    depth: 0,
    pagination: false,
    select: { title: true },
  });
  const allowed = games.docs.filter((game) => canProposeTeam(actor, game.id));
  const applications = await p.find({
    collection: "team-establishment-applications",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.page),
    sort: "-updatedAt",
    where: { applicant: { equals: user.id } },
  });
  const candidate = positiveID(query.edit)
    ? await p
        .findByID({
          collection: "team-establishment-applications",
          id: positiveID(query.edit)!,
          user,
          overrideAccess: false,
          depth: 0,
        })
        .catch(() => null)
    : null;
  const edit =
    candidate &&
    positiveID(candidate.applicant) === user.id &&
    ["returned", "withdrawn"].includes(candidate.status)
      ? candidate
      : null;

  return (
    <ClubFrame className={styles.workspace}>
      <PageHeading
        title="申请建立代表队"
        eyebrow="建队申请"
        description="把组织、选拔与训练安排写成计划，交由有建队审批权限的负责人审核。"
        parent={{ href: "/teams/manage", label: "代表队工作台" }}
      />
      <TeamTaskNav
        items={[
          {
            href: "#establishment-form",
            label: edit ? "补充建队计划" : "填写建队计划",
          },
          { href: "#my-establishment-applications", label: "我的申请与意见" },
          { href: "/teams/recruitment", label: "现有代表队招新" },
        ]}
      />
      <div className={styles.workspaceGrid}>
        <aside className={styles.taskAside}>
          <h2>准备一份建队计划</h2>
          <p>介绍队伍定位、如何选拔队员，以及日常训练安排。</p>
          <h3>提交后的进度</h3>
          <p>
            申请提交后等待审核。收到退回意见时，可补充计划后重新提交；批准后进入队伍工作台。
          </p>
          <p>可申请的社群以当前任职为准。队员公开简介由本人另行选择展示。</p>
        </aside>
        <div>
          <section id="establishment-form" className={styles.section}>
            {edit?.reviewNote && (
              <div className={styles.note}>
                <h2>本次需要补充</h2>
                <p className="preserve">{edit.reviewNote}</p>
              </div>
            )}
            <TeamCoreEstablishmentForm
              key={query.edit ?? "new"}
              games={allowed.map((g) => ({ id: g.id, title: g.title }))}
              initial={
                edit
                  ? {
                      id: edit.id,
                      gameID: positiveID(edit.game)!,
                      title: edit.title,
                      reason: edit.reason,
                      revision: edit.updatedAt,
                    }
                  : undefined
              }
            />
          </section>
          <section
            id="my-establishment-applications"
            className={styles.section}
            aria-labelledby="team-applications-title"
          >
            <TeamSectionHeading
              id="team-applications-title"
              title="我的建队申请"
            >
              {applications.totalDocs} 份记录
            </TeamSectionHeading>
            <div className={styles.records}>
              {applications.docs.length ? (
                applications.docs.map((doc) => (
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
                    <details className={styles.disclosure}>
                      <summary>查看已提交的建队计划</summary>
                      <p className="preserve">{doc.reason}</p>
                    </details>
                    <div className={styles.actions}>
                      {["returned", "withdrawn"].includes(doc.status) && (
                        <Link
                          className="button"
                          href={`/teams/apply?edit=${doc.id}#establishment-form`}
                        >
                          修改并重新提交
                        </Link>
                      )}
                      {doc.status === "approved" && (
                        <Link
                          className="button"
                          href={`/teams/manage/${positiveID(doc.team)}`}
                        >
                          进入代表队工作台
                        </Link>
                      )}
                      {["pending", "returned"].includes(doc.status) && (
                        <TeamCoreOperation
                          operation="withdraw-establishment"
                          id={doc.id}
                          revision={doc.updatedAt}
                          label="撤回建队申请"
                        />
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <TeamEmpty title="暂无建队申请">
                  申请提交后，在这里查看审核进度与处理意见。
                </TeamEmpty>
              )}
            </div>
            <TeamCorePagination
              page={teamPage(query.page)}
              total={applications.totalPages}
              path="/teams/apply"
              parameter="page"
              query={query}
              label="我的建队申请"
            />
          </section>
        </div>
      </div>
    </ClubFrame>
  );
}
