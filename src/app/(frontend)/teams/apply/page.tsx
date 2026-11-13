import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreEstablishmentForm, TeamCoreOperation } from "@/components/TeamCoreControls";
import { canProposeTeam, currentTeamActor, positiveID } from "@/lib/team-memberships";
import { teamApplicationLabels } from "@/lib/team-core";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { EmptyState, Notice, StatusPill, type Tone, buttonClass } from "@/components/v2/ui";
import { formatDateTime } from "@/components/v2/format";
import styles from "./apply.module.css";
import { teamLoginHref } from "../auth-return";

export const dynamic = "force-dynamic";
export const metadata = { title: "申请建立代表队" };

const tone: Record<string, Tone> = { pending: "info", approved: "success", returned: "warning", rejected: "danger", withdrawn: "neutral" };

export default async function Apply({ searchParams }: { searchParams: Promise<{ edit?: string; page?: string }> }) {
  const query = await searchParams;
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect(teamLoginHref("/teams/apply", query));
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
      eyebrow="TEAMS · 建队申请"
      title="申请建立代表队"
      description="把组织、选拔与训练安排写成计划，交由有建队审批权限的负责人审核。"
      back={{ href: "/teams/manage", label: "代表队工作台" }}
      steps={["填写建队计划", "负责人审核", "进入队伍工作台"]}
      current={edit ? 0 : undefined}
      aside={
        <>
          <TaskNote title="准备一份建队计划">
            <p>介绍队伍定位、如何选拔队员，以及日常训练安排。</p>
            <p>可申请的社群以当前任职为准。队员公开简介由本人另行选择展示。</p>
          </TaskNote>
          <TaskNote title="提交后的进度" links={[{ href: "#my-establishment-applications", label: "我的申请与意见" }, { href: "/teams/recruitment", label: "现有代表队招新" }]}>
            <p>申请提交后等待审核。收到退回意见时，可补充计划后重新提交；批准后进入队伍工作台。</p>
          </TaskNote>
        </>
      }
    >
      <section id="establishment-form" className={styles.form} aria-label={edit ? "补充建队计划" : "填写建队计划"}>
        {edit?.reviewNote && (
          <Notice tone="warning">
            <strong>本次需要补充：</strong>
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
          <h2 id="team-applications-title">我的建队申请</h2>
          <span>{applications.totalDocs} 份记录</span>
        </div>
        {applications.docs.length ? (
          <ol className={styles.timeline}>
            {applications.docs.map((doc) => (
              <li key={doc.id}>
                <article className={styles.record} data-state={doc.status} aria-labelledby={`establishment-${doc.id}`}>
                <div className={styles.recordHead}>
                  <h3 id={`establishment-${doc.id}`}>{doc.title}</h3>
                  <StatusPill tone={tone[doc.status] ?? "neutral"}>{teamApplicationLabels[doc.status]}</StatusPill>
                </div>
                <p className={styles.meta}>
                  申请编号 {doc.id} · 更新于 {formatDateTime(doc.updatedAt)}
                </p>
                {doc.reviewNote && (
                  <Notice tone="warning">
                    <strong>处理意见：</strong>
                    <span className="preserve">{doc.reviewNote}</span>
                  </Notice>
                )}
                <details className={styles.disclosure}>
                  <summary>查看已提交的建队计划</summary>
                  <p className="preserve">{doc.reason}</p>
                </details>
                <div className={styles.actions}>
                  {["returned", "withdrawn"].includes(doc.status) && (
                    <Link className={buttonClass("primary", "small")} href={`/teams/apply?edit=${doc.id}#establishment-form`}>
                      修改并重新提交
                    </Link>
                  )}
                  {doc.status === "approved" && (
                    <Link className={buttonClass("primary", "small")} href={`/teams/manage/${positiveID(doc.team)}`}>
                      进入代表队工作台
                    </Link>
                  )}
                  {["pending", "returned"].includes(doc.status) && (
                    <TeamCoreOperation operation="withdraw-establishment" id={doc.id} revision={doc.updatedAt} label="撤回建队申请" />
                  )}
                </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="暂无建队申请" icon="shield" compact>
            申请提交后，在这里查看审核进度与处理意见。
          </EmptyState>
        )}
        <TeamCorePagination page={teamPage(query.page)} total={applications.totalPages} path="/teams/apply" parameter="page" query={query} label="我的建队申请" />
      </section>
    </TaskFrame>
  );
}
