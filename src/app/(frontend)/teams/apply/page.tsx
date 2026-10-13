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
import { ClubFrame, ClubSteps } from "../../_club/ClubPage";
import styles from "../../_club/ClubPages.module.css";
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
    <ClubFrame>
      <PageHeading
        title="申请建立代表队"
        eyebrow="TEAM FORMATION"
        description="本社群管理员提交组织与训练计划，由现有高权限管理人员审核批准后成立。"
      />
      <ClubSteps
        label="建队申请流程"
        steps={[
          {
            title: "准备建队计划",
            description: "由有资格的本社群管理员提出申请。",
          },
          {
            title: "提交负责人审核",
            description: "查看意见，按需要补充和重提。",
          },
          {
            title: "获批后开启招新",
            description: "进入本队工作台，安排选拔与训练。",
          },
        ]}
      />
      <section className="member-shell">
        <div className={styles.split}>
          <div className={styles.formSurface}>
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
          </div>
          <aside className={styles.aside}>
            <h2>从一个计划开始</h2>
            <p>说明你希望如何组织队伍、安排训练，以及开展选拔。</p>
            <h3>谁可以发起</h3>
            <p>
              申请入口仅列出你当前有资格组织的游戏社群。最终建队由现有高权限管理人员批准。
            </p>
            <h3>申请与任职</h3>
            <p>
              建队、录取与平台管理角色分别处理。公开队员简介仍须由本人授权。
            </p>
            <Link href="/teams/recruitment">查看代表队招新 ↗</Link>
          </aside>
        </div>
        <section
          className={styles.recordSection}
          aria-labelledby="team-applications-title"
        >
          <div className={styles.sectionHead}>
            <h2 id="team-applications-title">我的建队申请</h2>
            <p>状态与处理意见</p>
          </div>
          {applications.docs.length ? (
            applications.docs.map((doc) => (
              <article className="panel" key={doc.id}>
                <div className={styles.recordHead}>
                  <h3>{doc.title}</h3>
                  <span className={styles.status} data-state={doc.status}>
                    {teamApplicationLabels[doc.status]}
                  </span>
                </div>
                <p className="preserve">{doc.reviewNote}</p>
                {["returned", "withdrawn"].includes(doc.status) && (
                  <Link href={`/teams/apply?edit=${doc.id}`}>
                    修改并重新提交
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
                {doc.status === "approved" && (
                  <Link href={`/teams/manage/${positiveID(doc.team)}`}>
                    进入代表队工作台
                  </Link>
                )}
              </article>
            ))
          ) : (
            <div className="empty">
              <div>
                <h3>暂无建队申请。</h3>
                <p>申请提交后，在这里查看审核进度。</p>
              </div>
            </div>
          )}
          <TeamCorePagination
            page={teamPage(query.page)}
            total={applications.totalPages}
            path="/teams/apply"
            parameter="page"
            query={query}
            label="我的建队申请"
          />
        </section>
        <Link href="/teams/manage">返回代表队工作台</Link>
      </section>
    </ClubFrame>
  );
}
