import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { PageHeading } from "@/components/PageHeading";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import {
  TeamCoreRecruitmentEditor,
  TeamCoreOperation,
  TeamCoreDecision,
  TeamCoreAnswers,
} from "@/components/TeamCoreControls";
import {
  canManageTeam,
  positiveID,
  isEstablishedTeam,
} from "@/lib/team-memberships";
import {
  defaultTeamForm,
  teamApplicationLabels,
  teamLifecycleLabels,
  teamRecruitmentLabels,
  teamRecruitmentState,
} from "@/lib/team-core";
import { normalizeSignup, type Answers } from "@/lib/signup-schema";
export const dynamic = "force-dynamic";
export default async function ManageTeam({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    edit?: string;
    create?: string;
    page?: string;
    status?: string;
    membersPage?: string;
    batchesPage?: string;
  }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const id = positiveID((await params).id);
  if (!id || !(await canManageTeam(p, user, id))) notFound();
  const query = await searchParams,
    page = teamPage(query.page);
  const team = await p.findByID({
    collection: "teams",
    id,
    user: null,
    overrideAccess: false,
    draft: false,
    depth: 0,
  });
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
  const status = [
    "pending",
    "returned",
    "approved",
    "rejected",
    "withdrawn",
  ].includes(query.status ?? "")
    ? query.status!
    : "pending";
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
    ? await p
        .findByID({
          collection: "team-recruitments",
          id: positiveID(query.edit)!,
          user,
          overrideAccess: false,
          depth: 0,
        })
        .catch(() => null)
    : null;
  const edit =
    candidate && positiveID(candidate.team) === id ? candidate : null;
  return (
    <>
      <PageHeading
        title={team.title}
        eyebrow="TEAM MANAGEMENT"
        description={`当前状态：${teamLifecycleLabels[team.teamStatus ?? "unestablished"]}。成员关系、社群任职和平台角色分别维护。`}
        parent={{ href: "/teams/manage", label: "代表队工作台" }}
      />
      <section className="member-shell">
        <nav className="signup-tools" aria-label="本队管理">
          <Link href={`/teams/${team.slug}`}>查看队伍档案</Link>
          <Link href="#team-applications">人工审核入队</Link>
          <Link href="#team-members">成员关系</Link>
        </nav>
        {team.establishmentApplication && (
          <div className="signup-tools">
            {["active", "resting", "archived"]
              .filter((state) => state !== team.teamStatus)
              .map((state) => (
                <TeamCoreOperation
                  key={state}
                  operation="lifecycle"
                  id={id}
                  revision={team.updatedAt}
                  status={state}
                  label={`设为${teamLifecycleLabels[state]}`}
                />
              ))}
          </div>
        )}
        <h2>代表队招新批次</h2>
        {established ? (
          <Link className="button" href={`/teams/manage/${id}?create=1`}>
            建立新招新批次
          </Link>
        ) : (
          <p>
            代表队尚未完成建队审核或已归档。请先由高权限管理人员处理成立/恢复状态。
          </p>
        )}
        {batches.docs.length ? (
          batches.docs.map((batch) => (
            <article className="panel" key={batch.id}>
              <h3>{batch.title}</h3>
              <p>
                {teamRecruitmentLabels[batch.status]} ·{" "}
                {teamRecruitmentState(batch, normalizeSignup(batch.signupForm))}
              </p>
              <div className="signup-tools">
                <Link href={`/teams/recruitment/${batch.id}`}>
                  查看申请入口
                </Link>
                {established && batch.status !== "archived" && (
                  <Link href={`/teams/manage/${id}?edit=${batch.id}`}>
                    编辑表单与窗口
                  </Link>
                )}
              </div>
              {batch.status === "open" && (
                <TeamCoreOperation
                  operation="close-recruitment"
                  id={batch.id}
                  revision={batch.updatedAt}
                  status="closed"
                  label="关闭本轮招新"
                />
              )}
              {batch.status !== "archived" && (
                <TeamCoreOperation
                  operation="close-recruitment"
                  id={batch.id}
                  revision={batch.updatedAt}
                  status="archived"
                  label="归档本批次"
                />
              )}
            </article>
          ))
        ) : (
          <p>暂无招新批次。</p>
        )}
        <TeamCorePagination
          page={teamPage(query.batchesPage)}
          total={batches.totalPages}
          path={`/teams/manage/${id}`}
          parameter="batchesPage"
          query={query}
          label="招新批次"
        />
        {established && (query.create || edit) && (
          <TeamCoreRecruitmentEditor
            key={edit?.updatedAt ?? "new"}
            teamID={id}
            defaultForm={defaultTeamForm}
            initial={
              edit
                ? {
                    id: edit.id,
                    title: edit.title,
                    status: edit.status,
                    revision: edit.updatedAt,
                    form: normalizeSignup(edit.signupForm),
                  }
                : undefined
            }
          />
        )}
        <section id="team-applications">
          <h2>本队人工审核入队</h2>
          <form className="filters" method="get">
            <label>
              审核状态
              <select name="status" defaultValue={status}>
                {[
                  "pending",
                  "returned",
                  "approved",
                  "rejected",
                  "withdrawn",
                ].map((value) => (
                  <option key={value} value={value}>
                    {teamApplicationLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <button className="button">筛选申请</button>
          </form>
          {applications.docs.length ? (
            applications.docs.map((doc) => (
              <article className="panel" key={doc.id}>
                <h3>{doc.title}</h3>
                <p>
                  {teamApplicationLabels[doc.status]} · 申请编号 {doc.id}
                </p>
                <TeamCoreAnswers
                  form={normalizeSignup(doc.formSnapshot)}
                  answers={doc.answers as Answers}
                />
                <p className="preserve">{doc.reviewNote}</p>
                {doc.status === "pending" && (
                  <TeamCoreDecision
                    kind="join"
                    id={doc.id}
                    revision={doc.updatedAt}
                  />
                )}
              </article>
            ))
          ) : (
            <p>此状态暂无申请。草稿不进入审核队列。</p>
          )}
          <TeamCorePagination
            page={page}
            total={applications.totalPages}
            path={`/teams/manage/${id}`}
            parameter="page"
            query={{ ...query, status }}
            label="申请"
          />
        </section>
        <section id="team-members">
          <h2>权威成员关系</h2>
          {members.docs.length ? (
            members.docs.map((doc) => (
              <article className="panel" key={doc.id}>
                <h3>{doc.title}</h3>
                <p>
                  成员关系 #{doc.id} ·{" "}
                  {doc.status === "active"
                    ? "在队"
                    : doc.leftAt
                      ? "已离队"
                      : "已撤销"}
                </p>
                {doc.status === "active" && (
                  <TeamCoreOperation
                    operation="revoke"
                    id={doc.id}
                    revision={doc.updatedAt}
                    label="撤销本队成员关系"
                    noteRequired
                  />
                )}
              </article>
            ))
          ) : (
            <p>尚无获批准的成员关系。公开简介与历史阵容不能作为成员资格。</p>
          )}
          <TeamCorePagination
            page={teamPage(query.membersPage)}
            total={members.totalPages}
            path={`/teams/manage/${id}`}
            parameter="membersPage"
            query={{ ...query, status }}
            label="成员关系"
          />
        </section>
      </section>
    </>
  );
}
