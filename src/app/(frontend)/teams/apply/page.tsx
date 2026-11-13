import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreEstablishmentForm, TeamCoreOperation } from "@/components/TeamCoreControls";
import { canProposeTeam, currentTeamActor, positiveID } from "@/lib/team-memberships";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { EmptyState, Notice, StatusPill, type Tone, buttonClass } from "@/components/v2/ui";
import { formatDateTime } from "@/components/v2/format";
import styles from "./apply.module.css";
import { getT } from "@/lib/i18n/server";
import { teamLoginHref } from "../auth-return";
import { applicationLabel } from "../labels";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("申请建立代表队", "Apply to create a team") };
}

const tone: Record<string, Tone> = { pending: "info", approved: "success", returned: "warning", rejected: "danger", withdrawn: "neutral" };

export default async function Apply({ searchParams }: { searchParams: Promise<{ edit?: string; page?: string }> }) {
  const query = await searchParams;
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect(teamLoginHref("/teams/apply", query));
  const { t, locale } = await getT();
  const actor = await currentTeamActor(p, user);
  const games = await p.find({ collection: "games", user: null, overrideAccess: false, draft: false, depth: 0, pagination: false, select: { title: true } });
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
    ? await p.findByID({ collection: "team-establishment-applications", id: positiveID(query.edit)!, user, overrideAccess: false, depth: 0 }).catch(() => null)
    : null;
  const edit = candidate && positiveID(candidate.applicant) === user.id && ["returned", "withdrawn"].includes(candidate.status) ? candidate : null;

  return (
    <TaskFrame
      eyebrow={t("TEAMS · 建队申请", "TEAMS · Team application")}
      title={t("申请建立代表队", "Apply to create a team")}
      description={t("把组织、选拔与训练安排写成计划，交由有建队审批权限的负责人审核。", "Write a plan covering organization, tryouts and training, then submit it to an approver with team-creation permission.")}
      back={{ href: "/teams/manage", label: t("代表队工作台", "Team workspace") }}
      steps={[t("填写建队计划", "Write team plan"), t("负责人审核", "Approver review"), t("进入队伍工作台", "Open team workspace")]}
      current={edit ? 0 : undefined}
      aside={
        <>
          <TaskNote title={t("准备一份建队计划", "Prepare a team plan")}>
            <p>{t("介绍队伍定位、如何选拔队员，以及日常训练安排。", "Describe the team's focus, how players are selected and the regular training schedule.")}</p>
            <p>{t("可申请的社群以当前任职为准。队员公开简介由本人另行选择展示。", "Available communities depend on your current role. Players choose separately whether to show public profiles.")}</p>
          </TaskNote>
          <TaskNote title={t("提交后的进度", "After you submit")} links={[{ href: "#my-establishment-applications", label: t("我的申请与意见", "My applications & feedback") }, { href: "/teams/recruitment", label: t("现有代表队招新", "Current team recruitment") }]}>
            <p>{t("申请提交后等待审核。收到退回意见时，可补充计划后重新提交；批准后进入队伍工作台。", "Submitted applications await review. If returned, revise the plan and resubmit; once approved, open the team workspace.")}</p>
          </TaskNote>
        </>
      }
    >
      <section id="establishment-form" className={styles.form} aria-label={edit ? t("补充建队计划", "Revise team plan") : t("填写建队计划", "Write team plan")}>
        {edit?.reviewNote && (
          <Notice tone="warning">
            <strong>{t("本次需要补充：", "Requested changes: ")}</strong>
            <span className="preserve">{edit.reviewNote}</span>
          </Notice>
        )}
        <TeamCoreEstablishmentForm
          key={query.edit ?? "new"}
          games={allowed.map((g) => ({ id: g.id, title: g.title }))}
          initial={edit ? { id: edit.id, gameID: positiveID(edit.game)!, title: edit.title, reason: edit.reason, revision: edit.updatedAt } : undefined}
        />
      </section>
      <section id="my-establishment-applications" className={styles.history} aria-labelledby="team-applications-title">
        <div className={styles.historyHead}>
          <h2 id="team-applications-title">{t("我的建队申请", "My team applications")}</h2>
          <span>{t(`${applications.totalDocs} 份记录`, `${applications.totalDocs} ${applications.totalDocs === 1 ? "record" : "records"}`)}</span>
        </div>
        {applications.docs.length ? (
          <ol className={styles.timeline}>
            {applications.docs.map((doc) => (
              <li key={doc.id}>
                <article className={styles.record} data-state={doc.status} aria-labelledby={`establishment-${doc.id}`}>
                <div className={styles.recordHead}>
                  <h3 id={`establishment-${doc.id}`}>{doc.title}</h3>
                  <StatusPill tone={tone[doc.status] ?? "neutral"}>{applicationLabel(t, doc.status)}</StatusPill>
                </div>
                <p className={styles.meta}>
                  {t(`申请编号 ${doc.id} · 更新于 ${formatDateTime(doc.updatedAt)}`, `Application #${doc.id} · Updated ${formatDateTime(doc.updatedAt, locale)}`)}
                </p>
                {doc.reviewNote && (
                  <Notice tone="warning">
                    <strong>{t("处理意见：", "Reviewer note: ")}</strong>
                    <span className="preserve">{doc.reviewNote}</span>
                  </Notice>
                )}
                <details className={styles.disclosure}>
                  <summary>{t("查看已提交的建队计划", "View submitted team plan")}</summary>
                  <p className="preserve">{doc.reason}</p>
                </details>
                <div className={styles.actions}>
                  {["returned", "withdrawn"].includes(doc.status) && (
                    <Link className={buttonClass("primary", "small")} href={`/teams/apply?edit=${doc.id}#establishment-form`}>
                      {t("修改并重新提交", "Edit and resubmit")}
                    </Link>
                  )}
                  {doc.status === "approved" && (
                    <Link className={buttonClass("primary", "small")} href={`/teams/manage/${positiveID(doc.team)}`}>
                      {t("进入代表队工作台", "Open team workspace")}
                    </Link>
                  )}
                  {["pending", "returned"].includes(doc.status) && (
                    <TeamCoreOperation operation="withdraw-establishment" id={doc.id} revision={doc.updatedAt} label={t("撤回建队申请", "Withdraw application")} />
                  )}
                </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title={t("暂无建队申请", "No team applications yet")} icon="shield" compact>
            {t("申请提交后，在这里查看审核进度与处理意见。", "After you submit, review progress and feedback appear here.")}
          </EmptyState>
        )}
        <TeamCorePagination page={teamPage(query.page)} total={applications.totalPages} path="/teams/apply" parameter="page" query={query} label={t("我的建队申请", "My team applications")} />
      </section>
    </TaskFrame>
  );
}
