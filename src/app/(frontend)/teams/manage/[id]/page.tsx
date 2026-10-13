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
import { formatDate } from "@/lib/rules";
import { ClubFrame } from "../../../_club/ClubPage";
import styles from "../../../_club/ClubPages.module.css";
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
    <ClubFrame>
      <PageHeading
        title={team.title}
        eyebrow="队伍工作台"
        description={`当前状态：${teamLifecycleLabels[team.teamStatus ?? "unestablished"]}。在这里安排招新、处理选拔并查看本队成员记录。`}
        parent={{ href: "/teams/manage", label: "代表队工作台" }}
      />
      <section className="member-shell">
        <nav className="signup-tools" aria-label="本队管理">
          <Link href={`/teams/${team.slug}`}>查看队伍档案</Link>
          <Link href="#team-recruitments">招新批次</Link>
          <Link href="#team-applications">人工审核入队</Link>
          <Link href="#team-members">成员记录</Link>
          <Link href={`/teams/honors?view=review&team=${id}`}>
            审核队伍荣誉
          </Link>
        </nav>
        {team.establishmentApplication && (
          <details className={styles.lifecycle} open>
            <summary>
              调整队伍状态 ·{" "}
              {teamLifecycleLabels[team.teamStatus ?? "unestablished"]}
            </summary>
            <p>
              休整期间可保留队伍档案；归档后停止新的入队申请。成员与任职记录分别保留。
            </p>
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
          </details>
        )}
        <section
          id="team-recruitments"
          className={styles.recordSection}
          aria-labelledby="team-recruitments-title"
        >
          <div className={styles.sectionHead}>
            <h2 id="team-recruitments-title">代表队招新批次</h2>
            <p>{batches.totalDocs} 个批次</p>
          </div>
          {established ? (
            <Link className="button" href={`/teams/manage/${id}?create=1`}>
              建立新招新批次
            </Link>
          ) : (
            <p>
              代表队尚未完成建队审核或已归档。请先由有权限的负责人处理建队或恢复状态。
            </p>
          )}
          {batches.docs.length ? (
            batches.docs.map((batch) => (
              <article className="panel" key={batch.id}>
                <div className={styles.recordHead}>
                  <h3>{batch.title}</h3>
                  <span className={styles.status}>
                    {teamRecruitmentLabels[batch.status]}
                  </span>
                </div>
                <p className={styles.recordDate}>
                  {teamRecruitmentState(
                    batch,
                    normalizeSignup(batch.signupForm),
                  )}
                  {" · 更新于 "}
                  <time dateTime={batch.updatedAt}>
                    {formatDate(batch.updatedAt)}
                  </time>
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
                <div className="team-core-actions">
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
                </div>
              </article>
            ))
          ) : (
            <div className="empty">
              <h3>暂无招新批次</h3>
              <p>
                {established
                  ? "建立一个批次，准备选拔题目与申请截止时间后开放招新。"
                  : "建队获批并恢复开放后，可在这里建立招新批次。"}
              </p>
            </div>
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
        </section>
        <section
          id="team-applications"
          className={styles.recordSection}
          aria-labelledby="team-applications-title"
        >
          <div className={styles.sectionHead}>
            <h2 id="team-applications-title">本队人工审核入队</h2>
            <p>
              {applications.totalDocs} 份 · {teamApplicationLabels[status]}
            </p>
          </div>
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
                <div className={styles.recordHead}>
                  <h3>{doc.title}</h3>
                  <span className={styles.status} data-state={doc.status}>
                    {teamApplicationLabels[doc.status]}
                  </span>
                </div>
                <p className={styles.recordDate}>
                  申请编号 {doc.id} · 更新于{" "}
                  <time dateTime={doc.updatedAt}>
                    {formatDate(doc.updatedAt)}
                  </time>
                </p>
                <TeamCoreAnswers
                  form={normalizeSignup(doc.formSnapshot)}
                  answers={doc.answers as Answers}
                />
                {doc.reviewNote && (
                  <p className="preserve">处理意见：{doc.reviewNote}</p>
                )}
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
            <div className="empty">
              <h3>此状态暂无申请</h3>
              <p>
                可以切换状态查看已处理记录。申请人保存的草稿不进入审核队列。
              </p>
            </div>
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
        <section
          id="team-members"
          className={styles.recordSection}
          aria-labelledby="team-members-title"
        >
          <div className={styles.sectionHead}>
            <h2 id="team-members-title">成员记录</h2>
            <p>{members.totalDocs} 条记录 · 包含历史成员</p>
          </div>
          <p>
            录取后建立本队成员记录。公开队员简介由本人选择展示，入队不会授予社群或平台管理权限。
          </p>
          {members.docs.length ? (
            members.docs.map((doc) => (
              <article className="panel" key={doc.id}>
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
                <p className={styles.recordDate}>
                  记录编号 {doc.id} · 入队于{" "}
                  <time dateTime={doc.joinedAt}>
                    {formatDate(doc.joinedAt)}
                  </time>
                  {doc.leftAt && (
                    <>
                      {" "}
                      · 离队于{" "}
                      <time dateTime={doc.leftAt}>
                        {formatDate(doc.leftAt)}
                      </time>
                    </>
                  )}
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
            <div className="empty">
              <h3>尚无入队成员记录</h3>
              <p>入队申请获批后，成员记录会出现在这里。</p>
            </div>
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
    </ClubFrame>
  );
}
