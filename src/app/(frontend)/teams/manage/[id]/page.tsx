import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreRecruitmentEditor, TeamCoreOperation, TeamCoreDecision, TeamCoreAnswers } from "@/components/TeamCoreControls";
import { canManageTeam, positiveID, isEstablishedTeam } from "@/lib/team-memberships";
import { defaultTeamForm, teamApplicationLabels, teamLifecycleLabels, teamRecruitmentLabels, teamRecruitmentState } from "@/lib/team-core";
import { normalizeSignup, type Answers } from "@/lib/signup-schema";
import { formatDate } from "@/lib/rules";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { ButtonLink, EmptyState, KeyValues, Notice, Section, StatusPill, buttonClass, type Tone } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "队伍工作台", robots: { index: false, follow: false } };

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
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const id = positiveID((await params).id);
  if (!id || !(await canManageTeam(p, user, id))) notFound();
  const query = await searchParams,
    page = teamPage(query.page);
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
      eyebrow="TEAM WORKBENCH · 队伍工作台"
      title={team.title}
      description="安排本队招新，处理入队申请，维护成员记录。"
      back={{ href: "/teams/manage", label: "代表队工作台" }}
      actions={
        <ButtonLink href={`/teams/${team.slug}`} tone="stage">
          查看队伍档案
        </ButtonLink>
      }
      aside={
        <>
          <section className={work.scope} aria-labelledby="team-lifecycle-title">
            <h2 id="team-lifecycle-title">队伍状态</h2>
            <p>
              <StatusPill tone={lifecycleTone[lifecycle] ?? "neutral"}>{teamLifecycleLabels[lifecycle]}</StatusPill>
            </p>
            {team.establishmentApplication && (
              <details className={work.disclosure}>
                <summary>调整队伍状态</summary>
                <p>休整期间保留队伍档案；归档后停止新的入队申请。成员与任职记录分别保留。</p>
                <div className={work.actions}>
                  {["active", "resting", "archived"]
                    .filter((state) => state !== team.teamStatus)
                    .map((state) => (
                      <TeamCoreOperation key={state} operation="lifecycle" id={id} revision={team.updatedAt} status={state} label={`设为${teamLifecycleLabels[state]}`} />
                    ))}
                </div>
              </details>
            )}
          </section>
          <TaskNote title="本队管理范围" links={[{ href: `/teams/honors?view=review&team=${id}`, label: "审核队伍荣誉" }]}>
            <p>这里处理本队选拔与成员关系。公开简介由队员本人选择展示。</p>
            <p>入队录取建立成员关系，社群与平台管理任职仍按各自流程处理。</p>
          </TaskNote>
        </>
      }
    >
      <ul className={work.stats} aria-label="本队概况">
        <li>
          <strong>{batches.totalDocs}</strong>
          <span>招新批次</span>
        </li>
        <li data-hot={(status === "pending" && applications.totalDocs > 0) || undefined}>
          <strong>{applications.totalDocs}</strong>
          <span>{teamApplicationLabels[status]}申请</span>
        </li>
        <li>
          <strong>{members.totalDocs}</strong>
          <span>成员记录（含历史）</span>
        </li>
      </ul>
      <nav className={work.actions} aria-label="本队管理">
        <a className={work.chipLink} href="#team-recruitments">
          招新批次
        </a>
        <a className={work.chipLink} href="#team-applications">
          入队审核
        </a>
        <a className={work.chipLink} href="#team-members">
          成员记录
        </a>
      </nav>

      <Section id="team-recruitments" title="招新批次" description={`${batches.totalDocs} 个批次。开放前先保存草稿，确认题目与截止时间后发布。`}>
        {established ? (
          <div className={work.actions}>
            <Link className={buttonClass("primary")} href={`/teams/manage/${id}?create=1#team-recruitment-editor`}>
              建立新招新批次
            </Link>
          </div>
        ) : (
          <Notice tone="warning">代表队尚未完成建队审核或已归档。请先由有权限的负责人处理建队或恢复状态。</Notice>
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
                  <StatusPill tone={batchTone[batch.status] ?? "neutral"}>{teamRecruitmentLabels[batch.status]}</StatusPill>
                </div>
                <p className={work.meta}>
                  {teamRecruitmentState(batch, normalizeSignup(batch.signupForm))}；更新于 <time dateTime={batch.updatedAt}>{formatDate(batch.updatedAt)}</time>
                </p>
                <div className={work.actions}>
                  <Link className={work.chipLink} href={`/teams/recruitment/${batch.id}`}>
                    查看申请入口
                  </Link>
                  {established && batch.status !== "archived" && (
                    <Link className={work.chipLink} href={`/teams/manage/${id}?edit=${batch.id}#team-recruitment-editor`}>
                      编辑表单与窗口
                    </Link>
                  )}
                </div>
                {batch.status !== "archived" && (
                  <details className={work.disclosure}>
                    <summary>结束或归档本批次</summary>
                    <p>关闭后停止接收新申请；归档后保留本批次记录。</p>
                    <div className={work.actions}>
                      {batch.status === "open" && (
                        <TeamCoreOperation operation="close-recruitment" id={batch.id} revision={batch.updatedAt} status="closed" label="关闭本轮招新" />
                      )}
                      <TeamCoreOperation operation="close-recruitment" id={batch.id} revision={batch.updatedAt} status="archived" label="归档本批次" />
                    </div>
                  </details>
                )}
              </article>
            ))
          ) : (
            <EmptyState title="暂无招新批次" icon="flag" compact>
              {established ? "建立一个批次，准备选拔题目与申请截止时间后开放招新。" : "建队获批并恢复开放后，可在这里建立招新批次。"}
            </EmptyState>
          )}
        </div>
        <TeamCorePagination page={teamPage(query.batchesPage)} total={batches.totalPages} path={`/teams/manage/${id}`} parameter="batchesPage" query={query} label="招新批次" />
      </Section>

      <Section id="team-applications" title="入队审核" description={`${applications.totalDocs} 份${teamApplicationLabels[status]}申请。申请人保存的草稿不进入审核队列。`}>
        <form className={work.filter} method="get" action={`/teams/manage/${id}#team-applications`}>
          <label>
            审核状态
            <select name="status" defaultValue={status}>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {teamApplicationLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <button className={buttonClass("ghost", "small")}>筛选申请</button>
        </form>
        <div className={work.records}>
          {applications.docs.length ? (
            applications.docs.map((doc) => (
              <article className={work.record} key={doc.id} data-state={doc.status}>
                <div className={work.recordHead}>
                  <h3>{doc.title}</h3>
                  <StatusPill tone={applicationTone[doc.status] ?? "neutral"}>{teamApplicationLabels[doc.status]}</StatusPill>
                </div>
                <p className={work.meta}>
                  申请编号 {doc.id}，更新于 <time dateTime={doc.updatedAt}>{formatDate(doc.updatedAt)}</time>
                </p>
                <div className={doc.status === "pending" ? work.split : undefined}>
                  <div className={work.submission}>
                    <details className={work.disclosure} open={doc.status === "pending"}>
                      <summary>申请内容</summary>
                      <TeamCoreAnswers form={normalizeSignup(doc.formSnapshot)} answers={doc.answers as Answers} />
                    </details>
                    {doc.reviewNote && (
                      <Notice tone="warning">
                        <strong>处理意见：</strong>
                        <span className="preserve">{doc.reviewNote}</span>
                      </Notice>
                    )}
                  </div>
                  {doc.status === "pending" && (
                    <div className={work.decision}>
                      <h4>处理这份申请</h4>
                      <p>核对申请内容后，选择录取、退回补充或未通过。</p>
                      <TeamCoreDecision kind="join" id={doc.id} revision={doc.updatedAt} />
                    </div>
                  )}
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="此状态暂无申请" icon="inbox" compact>
              可以切换状态查看已处理记录。
            </EmptyState>
          )}
        </div>
        <TeamCorePagination page={page} total={applications.totalPages} path={`/teams/manage/${id}`} parameter="page" query={{ ...query, status }} label="申请" />
      </Section>

      <Section id="team-members" title="成员记录" description={`${members.totalDocs} 条记录，包含历史成员。撤销成员关系后，仅现任队员可使用的功能随之停止。`}>
        <div className={work.records}>
          {members.docs.length ? (
            members.docs.map((doc) => {
              const label = doc.status === "active" ? "在队" : doc.leftAt ? "已离队" : "已撤销";
              return (
                <article className={work.record} key={doc.id} data-state={doc.status}>
                  <div className={work.recordHead}>
                    <h3>{doc.title}</h3>
                    <StatusPill tone={doc.status === "active" ? "success" : "neutral"}>{label}</StatusPill>
                  </div>
                  <KeyValues
                    items={[
                      { label: "记录编号", value: String(doc.id) },
                      { label: "入队时间", value: <time dateTime={doc.joinedAt}>{formatDate(doc.joinedAt)}</time> },
                      { label: "离队时间", value: doc.leftAt ? <time dateTime={doc.leftAt}>{formatDate(doc.leftAt)}</time> : null },
                    ]}
                  />
                  {doc.status === "active" && (
                    <details className={work.disclosure}>
                      <summary>管理成员关系</summary>
                      <TeamCoreOperation operation="revoke" id={doc.id} revision={doc.updatedAt} label="撤销本队成员关系" noteRequired />
                    </details>
                  )}
                </article>
              );
            })
          ) : (
            <EmptyState title="尚无入队成员记录" icon="user" compact>
              入队申请获批后，成员记录会出现在这里。
            </EmptyState>
          )}
        </div>
        <TeamCorePagination page={teamPage(query.membersPage)} total={members.totalPages} path={`/teams/manage/${id}`} parameter="membersPage" query={{ ...query, status }} label="成员关系" />
      </Section>
    </TaskFrame>
  );
}
