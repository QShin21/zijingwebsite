import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreRecruitmentEditor, TeamCoreOperation, TeamCoreDecision, TeamCoreAnswers } from "@/components/TeamCoreControls";
import { canManageTeam, positiveID, isEstablishedTeam } from "@/lib/team-memberships";
import { defaultTeamForm, teamRecruitmentState } from "@/lib/team-core";
import { normalizeSignup, type Answers } from "@/lib/signup-schema";
import { getT } from "@/lib/i18n/server";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { ButtonLink, EmptyState, KeyValues, Notice, Section, StatusPill, buttonClass, type Tone } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";
import { teamLoginHref } from "../../auth-return";
import { applicationLabel, lifecycleLabel, localDate, recruitmentLabel, recruitmentStateLabel } from "../../labels";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("队伍工作台", "Team workspace"), robots: { index: false, follow: false } };
}

const statuses = ["pending", "returned", "approved", "rejected", "withdrawn"];
const applicationTone: Record<string, Tone> = { pending: "info", returned: "warning", approved: "success", rejected: "danger", withdrawn: "neutral" };
const batchTone: Record<string, Tone> = { draft: "warning", open: "live", closed: "neutral", archived: "neutral" };
const lifecycleTone: Record<string, Tone> = { active: "success", resting: "warning", unestablished: "info", archived: "neutral" };

export default async function ManageTeam({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; create?: string; page?: string; status?: string; membersPage?: string; batchesPage?: string }>;
}) {
  const id = positiveID((await params).id);
  if (!id) notFound();
  const query = await searchParams;
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect(teamLoginHref(`/teams/manage/${id}`, query));
  if (!(await canManageTeam(p, user, id))) notFound();
  const { t, locale } = await getT();
  const page = teamPage(query.page);
  const team = await p.findByID({ collection: "teams", id, user: null, overrideAccess: false, draft: false, depth: 0 });
  const established = await isEstablishedTeam(p, id);
  const batches = await p.find({
    collection: "team-recruitments",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.batchesPage),
    sort: "-createdAt",
    where: { team: { equals: id } },
  });
  const status = statuses.includes(query.status ?? "") ? query.status! : "pending";
  const applications = await p.find({
    collection: "team-join-applications",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page,
    sort: "createdAt",
    where: { and: [{ team: { equals: id } }, { status: { equals: status } }] },
  });
  const members = await p.find({
    collection: "team-memberships",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.membersPage),
    sort: "-joinedAt",
    where: { team: { equals: id } },
  });
  const candidate = positiveID(query.edit)
    ? await p.findByID({ collection: "team-recruitments", id: positiveID(query.edit)!, user, overrideAccess: false, depth: 0 }).catch(() => null)
    : null;
  const edit = candidate && positiveID(candidate.team) === id ? candidate : null;
  const lifecycle = team.teamStatus ?? "unestablished";

  return (
    <TaskFrame
      wide
      eyebrow={t("TEAM WORKBENCH · 队伍工作台", "TEAM WORKBENCH · Team workspace")}
      title={team.title}
      description={t("安排本队招新，处理入队申请，维护成员记录。", "Plan recruitment, review join applications and maintain member records.")}
      back={{ href: "/teams/manage", label: t("代表队工作台", "Team workspace") }}
      actions={
        <ButtonLink href={`/teams/${team.slug}`} tone="stage">
          {t("查看队伍档案", "View team page")}
        </ButtonLink>
      }
      aside={
        <>
          <section className={work.scope} aria-labelledby="team-lifecycle-title">
            <h2 id="team-lifecycle-title">{t("队伍状态", "Team status")}</h2>
            <p>
              <StatusPill tone={lifecycleTone[lifecycle] ?? "neutral"}>{lifecycleLabel(t, lifecycle)}</StatusPill>
            </p>
            {team.establishmentApplication && (
              <details className={work.disclosure}>
                <summary>{t("调整队伍状态", "Change team status")}</summary>
                <p>{t("休整期间保留队伍档案；归档后停止新的入队申请。成员与任职记录分别保留。", "Resting keeps the team page; archiving stops new join applications. Member and role records are kept.")}</p>
                <div className={work.actions}>
                  {["active", "resting", "archived"]
                    .filter((state) => state !== team.teamStatus)
                    .map((state) => (
                      <TeamCoreOperation key={state} operation="lifecycle" id={id} revision={team.updatedAt} status={state} label={t(`设为${lifecycleLabel(t, state)}`, `Set to ${lifecycleLabel(t, state)}`)} />
                    ))}
                </div>
              </details>
            )}
          </section>
          <TaskNote title={t("本队管理范围", "What you manage here")} links={[{ href: `/teams/honors?view=review&team=${id}`, label: t("审核队伍荣誉", "Review team honors") }]}>
            <p>{t("这里处理本队选拔与成员关系。公开简介由队员本人选择展示。", "Handle this team's tryouts and memberships here. Players choose whether to show public profiles.")}</p>
            <p>{t("入队录取建立成员关系，社群与平台管理任职仍按各自流程处理。", "Accepting an application creates a membership; community and platform roles follow their own processes.")}</p>
          </TaskNote>
        </>
      }
    >
      <ul className={work.stats} aria-label={t("本队概况", "Team overview")}>
        <li>
          <strong>{batches.totalDocs}</strong>
          <span>{t("招新批次", "Recruitment batches")}</span>
        </li>
        <li data-hot={(status === "pending" && applications.totalDocs > 0) || undefined}>
          <strong>{applications.totalDocs}</strong>
          <span>{t(`${applicationLabel(t, status)}申请`, `${applicationLabel(t, status)} applications`)}</span>
        </li>
        <li>
          <strong>{members.totalDocs}</strong>
          <span>{t("成员记录（含历史）", "Member records (incl. past)")}</span>
        </li>
      </ul>
      <nav className={work.actions} aria-label={t("本队管理", "Team management")}>
        <a className={work.chipLink} href="#team-recruitments">
          {t("招新批次", "Recruitment batches")}
        </a>
        <a className={work.chipLink} href="#team-applications">
          {t("入队审核", "Join applications")}
        </a>
        <a className={work.chipLink} href="#team-members">
          {t("成员记录", "Member records")}
        </a>
      </nav>

      <Section id="team-recruitments" title={t("招新批次", "Recruitment batches")} description={t(`${batches.totalDocs} 个批次。开放前先保存草稿，确认题目与截止时间后发布。`, `${batches.totalDocs} ${batches.totalDocs === 1 ? "batch" : "batches"}. Save a draft first, then publish once the questions and deadline are confirmed.`)}>
        {established ? (
          <div className={work.actions}>
            <Link className={buttonClass("primary")} href={`/teams/manage/${id}?create=1#team-recruitment-editor`}>
              {t("建立新招新批次", "Create recruitment batch")}
            </Link>
          </div>
        ) : (
          <Notice tone="warning">{t("代表队尚未完成建队审核或已归档。请先由有权限的负责人处理建队或恢复状态。", "This team has not been approved yet or is archived. An authorized approver must handle the application or restore it first.")}</Notice>
        )}
        {established && (query.create || edit) && (
          <div className={work.panel}>
            <TeamCoreRecruitmentEditor
              key={edit?.updatedAt ?? "new"}
              teamID={id}
              defaultForm={defaultTeamForm}
              initial={edit ? { id: edit.id, title: edit.title, status: edit.status, revision: edit.updatedAt, form: normalizeSignup(edit.signupForm) } : undefined}
            />
          </div>
        )}
        <div className={work.records}>
          {batches.docs.length ? (
            batches.docs.map((batch) => (
              <article className={work.record} key={batch.id} data-state={batch.status}>
                <div className={work.recordHead}>
                  <h3>{batch.title}</h3>
                  <StatusPill tone={batchTone[batch.status] ?? "neutral"}>{recruitmentLabel(t, batch.status)}</StatusPill>
                </div>
                <p className={work.meta}>
                  {recruitmentStateLabel(t, teamRecruitmentState(batch, normalizeSignup(batch.signupForm)))}{t("；更新于 ", "; updated ")}<time dateTime={batch.updatedAt}>{localDate(batch.updatedAt, locale)}</time>
                </p>
                <div className={work.actions}>
                  <Link className={work.chipLink} href={`/teams/recruitment/${batch.id}`}>
                    {t("查看申请入口", "View application page")}
                  </Link>
                  {established && batch.status !== "archived" && (
                    <Link className={work.chipLink} href={`/teams/manage/${id}?edit=${batch.id}#team-recruitment-editor`}>
                      {t("编辑表单与窗口", "Edit form and dates")}
                    </Link>
                  )}
                </div>
                {batch.status !== "archived" && (
                  <details className={work.disclosure}>
                    <summary>{t("结束或归档本批次", "Close or archive this batch")}</summary>
                    <p>{t("关闭后停止接收新申请；归档后保留本批次记录。", "Closing stops new applications; archiving keeps this batch's records.")}</p>
                    <div className={work.actions}>
                      {batch.status === "open" && (
                        <TeamCoreOperation operation="close-recruitment" id={batch.id} revision={batch.updatedAt} status="closed" label={t("关闭本轮招新", "Close recruitment")} />
                      )}
                      <TeamCoreOperation operation="close-recruitment" id={batch.id} revision={batch.updatedAt} status="archived" label={t("归档本批次", "Archive batch")} />
                    </div>
                  </details>
                )}
              </article>
            ))
          ) : (
            <EmptyState title={t("暂无招新批次", "No recruitment batches")} icon="flag" compact>
              {established ? t("建立一个批次，准备选拔题目与申请截止时间后开放招新。", "Create a batch, prepare tryout questions and a deadline, then open recruitment.") : t("建队获批并恢复开放后，可在这里建立招新批次。", "Once the team is approved and active, you can create recruitment batches here.")}
            </EmptyState>
          )}
        </div>
        <TeamCorePagination page={teamPage(query.batchesPage)} total={batches.totalPages} path={`/teams/manage/${id}`} parameter="batchesPage" query={query} label={t("招新批次", "Recruitment batches")} />
      </Section>

      <Section id="team-applications" title={t("入队审核", "Join applications")} description={t(`${applications.totalDocs} 份${applicationLabel(t, status)}申请。申请人保存的草稿不进入审核队列。`, `${applications.totalDocs} ${applicationLabel(t, status).toLowerCase()} ${applications.totalDocs === 1 ? "application" : "applications"}. Applicants' drafts do not enter the review queue.`)}>
        <form className={work.filter} method="get" action={`/teams/manage/${id}#team-applications`}>
          <label>
            {t("审核状态", "Review status")}
            <select name="status" defaultValue={status}>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {applicationLabel(t, value)}
                </option>
              ))}
            </select>
          </label>
          <button className={buttonClass("ghost", "small")}>{t("筛选申请", "Filter")}</button>
        </form>
        <div className={work.records}>
          {applications.docs.length ? (
            applications.docs.map((doc) => (
              <article className={work.record} key={doc.id} data-state={doc.status}>
                <div className={work.recordHead}>
                  <h3>{doc.title}</h3>
                  <StatusPill tone={applicationTone[doc.status] ?? "neutral"}>{applicationLabel(t, doc.status)}</StatusPill>
                </div>
                <p className={work.meta}>
                  {t(`申请编号 ${doc.id}，更新于 `, `Application #${doc.id}, updated `)}<time dateTime={doc.updatedAt}>{localDate(doc.updatedAt, locale)}</time>
                </p>
                <div className={doc.status === "pending" ? work.split : undefined}>
                  <div className={work.submission}>
                    <details className={work.disclosure} open={doc.status === "pending"}>
                      <summary>{t("申请内容", "Application")}</summary>
                      <TeamCoreAnswers form={normalizeSignup(doc.formSnapshot)} answers={doc.answers as Answers} />
                    </details>
                    {doc.reviewNote && (
                      <Notice tone="warning">
                        <strong>{t("处理意见：", "Reviewer note: ")}</strong>
                        <span className="preserve">{doc.reviewNote}</span>
                      </Notice>
                    )}
                  </div>
                  {doc.status === "pending" && (
                    <div className={work.decision}>
                      <h4>{t("处理这份申请", "Review this application")}</h4>
                      <p>{t("核对申请内容后，选择录取、退回补充或未通过。", "After checking the application, accept it, return it for more info or decline it.")}</p>
                      <TeamCoreDecision kind="join" id={doc.id} revision={doc.updatedAt} />
                    </div>
                  )}
                </div>
              </article>
            ))
          ) : (
            <EmptyState title={t("此状态暂无申请", "No applications with this status")} icon="inbox" compact>
              {t("可以切换状态查看已处理记录。", "Switch status to view handled applications.")}
            </EmptyState>
          )}
        </div>
        <TeamCorePagination page={page} total={applications.totalPages} path={`/teams/manage/${id}`} parameter="page" query={{ ...query, status }} label={t("申请", "Applications")} />
      </Section>

      <Section id="team-members" title={t("成员记录", "Member records")} description={t(`${members.totalDocs} 条记录，包含历史成员。撤销成员关系后，仅现任队员可使用的功能随之停止。`, `${members.totalDocs} ${members.totalDocs === 1 ? "record" : "records"}, including past members. Revoking a membership ends access to player-only features.`)}>
        <div className={work.records}>
          {members.docs.length ? (
            members.docs.map((doc) => {
              const label = doc.status === "active" ? t("在队", "Active") : doc.leftAt ? t("已离队", "Left") : t("已撤销", "Revoked");
              return (
                <article className={work.record} key={doc.id} data-state={doc.status}>
                  <div className={work.recordHead}>
                    <h3>{doc.title}</h3>
                    <StatusPill tone={doc.status === "active" ? "success" : "neutral"}>{label}</StatusPill>
                  </div>
                  <KeyValues
                    items={[
                      { label: t("记录编号", "Record #"), value: String(doc.id) },
                      { label: t("入队时间", "Joined"), value: <time dateTime={doc.joinedAt}>{localDate(doc.joinedAt, locale)}</time> },
                      { label: t("离队时间", "Left"), value: doc.leftAt ? <time dateTime={doc.leftAt}>{localDate(doc.leftAt, locale)}</time> : null },
                    ]}
                  />
                  {doc.status === "active" && (
                    <details className={work.disclosure}>
                      <summary>{t("管理成员关系", "Manage membership")}</summary>
                      <TeamCoreOperation operation="revoke" id={doc.id} revision={doc.updatedAt} label={t("撤销本队成员关系", "Revoke membership")} noteRequired />
                    </details>
                  )}
                </article>
              );
            })
          ) : (
            <EmptyState title={t("尚无入队成员记录", "No member records yet")} icon="user" compact>
              {t("入队申请获批后，成员记录会出现在这里。", "Member records appear here once join applications are accepted.")}
            </EmptyState>
          )}
        </div>
        <TeamCorePagination page={teamPage(query.membersPage)} total={members.totalPages} path={`/teams/manage/${id}`} parameter="membersPage" query={{ ...query, status }} label={t("成员关系", "Memberships")} />
      </Section>
    </TaskFrame>
  );
}
